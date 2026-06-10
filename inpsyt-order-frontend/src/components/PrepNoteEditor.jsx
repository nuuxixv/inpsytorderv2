import React, { useEffect, useRef } from 'react';
import Editor from '@toast-ui/editor';
import '@toast-ui/editor/dist/toastui-editor.css';
import { supabase } from '../supabaseClient';
import { sanitizePrepNoteHTML } from './prepNoteSanitizer';
import { resolveForDisplay, createImageDisplayUrl } from '../utils/prepNoteImages';

/**
 * 통합 준비 노트 에디터 (Toast UI Editor — 바닐라) — L2 학회 상세 전용.
 * React.lazy로 지연 로드(EventDetailPage에서 Suspense로 감쌈) → 초기/공개 번들 0 영향.
 * CSS import도 이 파일 안에 둬 lazy 청크에 포함시킴.
 *
 * ⚠️ @toast-ui/react-editor(React 17 전용)는 React 19와 비호환(findDOMNode 등) →
 *    바닐라 Editor를 ref로 직접 인스턴스화(프레임워크 무관).
 *
 * - 준비물 = 에디터 task-list 체크박스
 * - 이미지(프로그램·부스배치도) = addImageBlobHook → event-images 버킷 업로드 → 표시용 서명 URL 삽입
 *   (dropImage 플러그인·md paste 핸들러가 양 모드 공통이라 Markdown 모드에서도 동작)
 *   저장 시 EventDetailPage가 encodeForStorage로 경로 플레이스홀더로 치환(만료 무관),
 *   진입 시 resolveForDisplay로 새 서명 URL 재발급(utils/prepNoteImages.js).
 * - 학회 정보(설치/철거 등) = 자유 텍스트
 *
 * 모드: WYSIWYG에는 마크다운 입력 룰이 없어 `##`·`- [ ]` 자동변환 불가 →
 *   하단 Markdown/WYSIWYG 탭 노출. 신규(빈) 노트는 markdown 기본.
 *   기존 노트는 HTML 저장본이라 markdown 모드로 열면 raw HTML이 노출되므로 wysiwyg 기본
 *   (탭 전환 시 convertor가 마크다운으로 변환해 보여줌). 저장은 양 모드 모두 getHTML().
 *
 * props:
 *  - eventId: string             (이미지 업로드 경로 prefix)
 *  - initialValue: string        (events.prep_note HTML — 마운트 시점 값으로 1회 주입)
 *  - onReady: (getHTML) => void  (저장 버튼이 본문을 읽을 수 있게 getHTML 접근자 전달.
 *                                 에디터 준비 전/해제 후 호출 시 null 반환 — 저장 가드용)
 *  - onImageError: (msg) => void (검증/업로드 실패 토스트)
 */

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

const PrepNoteEditor = ({ eventId, initialValue, onReady, onImageError }) => {
  const elRef = useRef(null);
  const instRef = useRef(null);
  // 최신 props를 마운트-1회 훅 안에서 참조하기 위한 ref (에디터 재생성 방지)
  const eventIdRef = useRef(eventId);
  eventIdRef.current = eventId;
  const onImageErrorRef = useRef(onImageError);
  onImageErrorRef.current = onImageError;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    if (!elRef.current) return undefined;

    const addImageBlobHook = async (blob, callback) => {
      try {
        const type = blob.type || '';
        if (!ALLOWED_TYPES.includes(type)) {
          onImageErrorRef.current?.('JPG·PNG·WEBP 이미지만 업로드할 수 있어요.');
          return;
        }
        if (blob.size > MAX_BYTES) {
          onImageErrorRef.current?.('이미지는 5MB 이하만 업로드할 수 있어요.');
          return;
        }
        const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
        const path = `${eventIdRef.current || 'unknown'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from('event-images')
          .upload(path, blob, { contentType: type, upsert: false });
        if (upErr) {
          onImageErrorRef.current?.(`이미지 업로드 실패: ${upErr.message}`);
          return;
        }

        const signedUrl = await createImageDisplayUrl(path);
        if (!signedUrl) {
          onImageErrorRef.current?.('이미지 주소 생성에 실패했어요.');
          return;
        }
        callback(signedUrl, '학회 자료');
      } catch (e) {
        console.error(e);
        onImageErrorRef.current?.('이미지 업로드 중 오류가 발생했어요.');
      }
    };

    // getHTML 접근자는 호출 시점의 인스턴스를 참조 — 준비 전(재서명 중)/해제 후엔 null
    onReadyRef.current?.(() => (instRef.current ? instRef.current.getHTML() || '' : null));

    // 본문 내 경로 플레이스홀더(+레거시 서명 URL) → 새 서명 URL 재발급 후 에디터 생성
    let editor = null;
    let cancelled = false;
    resolveForDisplay(initialValue || '').then((resolved) => {
      if (cancelled || !elRef.current) return;
      editor = new Editor({
        el: elRef.current,
        initialValue: resolved,
        initialEditType: resolved ? 'wysiwyg' : 'markdown',
        previewStyle: 'tab',
        height: '420px',
        usageStatistics: false,
        hideModeSwitch: false,
        autofocus: false,
        toolbarItems: [
          ['heading', 'bold', 'italic'],
          ['hr', 'quote'],
          ['ul', 'ol', 'task'],
          ['image', 'link'],
        ],
        hooks: { addImageBlobHook },
        customHTMLSanitizer: sanitizePrepNoteHTML, // 최신 DOMPurify 주입(보안 검토 중2)
      });
      instRef.current = editor;
    });

    return () => {
      cancelled = true;
      editor?.destroy();
      instRef.current = null;
    };
    // 마운트 시 1회 생성(initialValue는 진입 시점 값). 콜백/eventId는 ref로 최신 참조.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={elRef} />;
};

export default PrepNoteEditor;
