import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import Editor from '@toast-ui/editor';
import '@toast-ui/editor/dist/toastui-editor-viewer.css';

/**
 * 통합 준비 노트 읽기 뷰 (Toast UI Viewer — 바닐라) — L2 학회 상세 전용.
 * React.lazy로 지연 로드. Viewer는 기본 sanitize 적용(XSS 방어).
 * (react-editor 미사용 — React 19 비호환. Editor.factory({viewer:true})로 직접 생성.)
 *
 * 본문 내 img 클릭 → onImageClick(src) 호출(부모가 MUI Dialog 라이트박스 오픈).
 *
 * props:
 *  - content: string                 (events.prep_note HTML)
 *  - onImageClick: (src) => void
 */
const PrepNoteViewer = ({ content, onImageClick }) => {
  const elRef = useRef(null);

  // content 변경 시 Viewer 재생성(비용 낮음 — 정적 본문).
  useEffect(() => {
    if (!elRef.current) return undefined;
    const viewer = Editor.factory({
      el: elRef.current,
      viewer: true,
      initialValue: content || '',
      usageStatistics: false,
    });
    return () => viewer.destroy();
  }, [content]);

  // 본문 이미지 클릭 → 라이트박스. 래퍼(elRef)에 위임 — Viewer 재생성돼도 유지.
  useEffect(() => {
    const el = elRef.current;
    if (!el) return undefined;
    const handler = (e) => {
      const target = e.target;
      if (target && target.tagName === 'IMG' && target.src) onImageClick?.(target.src);
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [onImageClick]);

  return (
    <Box
      ref={elRef}
      sx={{
        '& .toastui-editor-contents img': { cursor: 'zoom-in', maxWidth: '100%', borderRadius: 1 },
      }}
    />
  );
};

export default PrepNoteViewer;
