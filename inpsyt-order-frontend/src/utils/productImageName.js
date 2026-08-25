// 개별 상품 이미지 첨부 — 파일명을 안전하게 새로 짓는 순수 로직.
// 일괄 업로드(handleImageUpload)는 엑셀 '이미지' 열과 파일명을 맞춰야 해서 원본 파일명을 강제하고
// 한글 파일명을 거부하지만, 개별 첨부는 우리가 image_filename을 직접 채우므로 그럴 필요가 없다.
// 여기서 파일명을 새로 지어 SAFE_IMAGE_FILENAME(영숫자·._-) 통과를 보장한다
// → 한글·공백 파일명 사진도 그대로 첨부 가능(운영자 친화가 목적).

// 허용 확장자 화이트리스트. 원본 확장자를 소문자로 보존하되 이 목록만 통과.
export const IMAGE_EXT_WHITELIST = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

// 하드 상한 1MB — 폰 사진 첨부 현실 반영. 엑셀 양식 안내문의 "200KB 이내"는 권장으로만 두고
// 하드 거부는 1MB(안내 문구에 "200KB 이하 권장" 표기).
export const MAX_IMAGE_BYTES = 1024 * 1024;

// 원본 파일명에서 확장자만 소문자로. 확장자 없음·화이트리스트 밖이면 null.
export const getSafeImageExtension = (originalName) => {
  const name = String(originalName || '');
  const dot = name.lastIndexOf('.');
  if (dot < 0 || dot === name.length - 1) return null;
  const ext = name.slice(dot + 1).toLowerCase();
  return IMAGE_EXT_WHITELIST.includes(ext) ? ext : null;
};

// 상품코드/ID를 SAFE_IMAGE_FILENAME 통과 조각으로. 비안전 문자는 '-'로, 앞뒤 대시 정리, 빈값은 'item'.
const sanitizeCodePart = (raw) => {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'item';
};

// 개별 첨부용 안전 파일명 생성. 예: p1234-1724500000000.webp
// 확장자가 화이트리스트 밖이면 null(호출부에서 거부 안내). 결과는 항상 SAFE_IMAGE_FILENAME 통과.
export const buildProductImageFilename = ({ originalName, productCode, productId, now = Date.now() }) => {
  const ext = getSafeImageExtension(originalName);
  if (!ext) return null;
  const codePart = sanitizeCodePart(productCode || productId);
  return `p${codePart}-${now}.${ext}`;
};
