import React, { useEffect, useRef } from 'react';
import Editor from '@toast-ui/editor';
import '@toast-ui/editor/dist/toastui-editor.css';
import { supabase } from '../supabaseClient';

/**
 * 통합 준비 노트 에디터 (Toast UI Editor — 바닐라) — L2 학회 상세 전용.
 * React.lazy로 지연 로드(EventDetailPage에서 Suspense로 감쌈) → 초기/공개 번들 0 영향.
 * CSS import도 이 파일 안에 둬 lazy 청크에 포함시킴.
 *
 * ⚠️ @toast-ui/react-editor(React 17 전용)는 React 19와 비호환(findDOMNode 등) →
 *    바닐라 Editor를 ref로 직접 인스턴스화(프레임워크 무관).
 *
 * - 준비물 = 에디터 task-list 체크박스
 * - 이미지(프로그램·부스배치도) = addImageBlobHook → event-images 버킷 업로드 → 서명 URL 삽입
 * - 학회 정보(설치/철거 등) = 자유 텍스트
 *
 * props:
 *  - eventId: string             (이미지 업로드 경로 prefix)
 *  - initialValue: string        (events.prep_note HTML — 마운트 시점 값으로 1회 주입)
 *  - onReady: (getHTML) => void  (저장 버튼이 본문을 읽을 수 있게 getHTML 접근자 전달)
 *  - onImageError: (msg) => void (검증/업로드 실패 토스트)
 */

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 길게(1년) — 비공개 버킷 본문 표시용

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

        const { data, error: signErr } = await supabase.storage
          .from('event-images')
          .createSignedUrl(path, SIGNED_URL_TTL);
        if (signErr || !data?.signedUrl) {
          onImageErrorRef.current?.('이미지 주소 생성에 실패했어요.');
          return;
        }
        callback(data.signedUrl, '학회 자료');
      } catch (e) {
        console.error(e);
        onImageErrorRef.current?.('이미지 업로드 중 오류가 발생했어요.');
      }
    };

    const editor = new Editor({
      el: elRef.current,
      initialValue: initialValue || '',
      initialEditType: 'wysiwyg',
      previewStyle: 'vertical',
      height: '420px',
      usageStatistics: false,
      hideModeSwitch: true,
      autofocus: false,
      toolbarItems: [
        ['heading', 'bold', 'italic'],
        ['hr', 'quote'],
        ['ul', 'ol', 'task'],
        ['image', 'link'],
      ],
      hooks: { addImageBlobHook },
    });
    instRef.current = editor;
    onReadyRef.current?.(() => editor.getHTML() || '');

    return () => {
      editor.destroy();
      instRef.current = null;
    };
    // 마운트 시 1회 생성(initialValue는 진입 시점 값). 콜백/eventId는 ref로 최신 참조.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={elRef} />;
};

export default PrepNoteEditor;
