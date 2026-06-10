import DOMPurify from 'dompurify';

// 준비 노트(prep_note) HTML sanitizer — Toast UI customHTMLSanitizer 주입용.
// 배경(보안 검토 2026-06-10 중2): @toast-ui/editor 3.2.x 내장 DOMPurify가 2.3.3(2021)로
// mXSS 우회(CVE-2024-45801/47875) 미패치 → 최신 dompurify(3.x)로 교체 주입.
// FORBID_TAGS는 CTO 권고 목록. input은 Toast UI task-list 체크박스가 li 속성
// (task-list-item·checked class) 기반으로 렌더되므로 금지해도 체크박스 표시 무손실.
const FORBID_TAGS = [
  'input', 'script', 'textarea', 'form', 'button',
  'select', 'meta', 'style', 'link', 'title', 'object', 'base',
];

export const sanitizePrepNoteHTML = (html) =>
  DOMPurify.sanitize(html || '', { FORBID_TAGS });
