import { supabase } from '../supabaseClient';

// 상품 이미지 저장소 — 공개 버킷(public read / authenticated write).
// 카드가 anon(고객)에 노출되므로 서명URL이 아니라 getPublicUrl 사용.
export const PRODUCT_IMAGE_BUCKET = 'product-images';

/**
 * image_filename(버킷 내 객체 경로)으로 공개 이미지 URL을 만든다.
 * @param {string|null|undefined} filename - products.image_filename. NULL이면 이미지 없음.
 * @returns {string|null} 공개 URL 또는 null(미등록 → 플레이스홀더)
 */
export const getProductImageUrl = (filename) => {
  if (!filename) return null;
  const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(filename);
  return data?.publicUrl || null;
};

/**
 * 파일 하나를 product-images 버킷에 업로드한다(파일명 그대로, 같은 이름이면 덮어씀).
 * @param {File} file - 업로드할 이미지 파일
 * @returns {Promise<{ error: Error|null }>}
 */
export const uploadProductImage = async (file) => {
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(file.name, file, { upsert: true, contentType: file.type || undefined });
  return { error };
};
