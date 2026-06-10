import { supabase } from '../supabaseClient';

// 준비 노트(prep_note) 이미지 URL 수명 관리 — L2 학회 상세 전용.
// 배경(2026-06-10): 기존엔 1년 만료 서명 URL을 본문 HTML에 그대로 저장 → 만료 시 영구 깨짐.
// → DB에는 경로 플레이스홀더(storage://event-images/<path>)만 저장하고,
//   열 때마다 짧은 TTL 서명 URL을 일괄 재발급해 치환한다.
//   레거시 저장본(서명 URL 직저장)도 렌더 전처리에서 path 추출·재서명되므로 자연 치유.

const BUCKET = 'event-images';
export const DISPLAY_TTL = 60 * 60 * 6; // 6시간 — 표시 세션용(저장본에는 토큰 미포함)

// supabase 서명 URL: https://<proj>.supabase.co/storage/v1/object/sign/event-images/<path>?token=...
const SIGNED_URL_RE = /https?:\/\/[^"'<>\s]+\/storage\/v1\/object\/sign\/event-images\/([^"'<>\s?]+)\?[^"'<>\s]*/g;
const PLACEHOLDER_RE = /storage:\/\/event-images\/([^"'<>\s]+)/g;

// 저장 직전: 본문 내 서명 URL(토큰 만료 여부 무관) → 경로 플레이스홀더.
export const encodeForStorage = (html) =>
  (html || '').replace(SIGNED_URL_RE, (_, path) => `storage://event-images/${path}`);

// 본문에서 이미지 경로 수집 — 플레이스홀더 + 레거시 서명 URL 모두(중복 제거).
export const collectStoragePaths = (html) => {
  const source = html || '';
  const paths = new Set();
  for (const m of source.matchAll(PLACEHOLDER_RE)) paths.add(m[1]);
  for (const m of source.matchAll(SIGNED_URL_RE)) paths.add(m[1]);
  return [...paths];
};

// 경로→서명URL 맵으로 치환. 맵에 없는 경로(재서명 실패)는 원문 유지(깨진 채 표시).
export const applySignedUrls = (html, urlByPath) =>
  (html || '')
    .replace(PLACEHOLDER_RE, (m, path) => urlByPath[path] || m)
    .replace(SIGNED_URL_RE, (m, path) => urlByPath[path] || m);

// 렌더 직전: 경로/레거시 URL → 새 서명 URL 일괄 발급(단일 배치 요청) 후 치환.
// 실패해도 본문 표시는 막지 않는다(이미지만 깨짐 + 콘솔 경고).
export const resolveForDisplay = async (html) => {
  const source = html || '';
  const paths = collectStoragePaths(source);
  if (paths.length === 0) return source;
  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, DISPLAY_TTL);
    if (error) throw error;
    const urlByPath = {};
    (data || []).forEach((item, i) => {
      const path = item?.path || paths[i];
      if (item?.signedUrl) urlByPath[path] = item.signedUrl;
      else console.warn(`준비 노트 이미지 재서명 실패: ${path}`, item?.error);
    });
    return applySignedUrls(source, urlByPath);
  } catch (e) {
    console.warn('준비 노트 이미지 재서명 실패 — 원문 그대로 표시', e);
    return source;
  }
};

// 업로드 직후 에디터 본문 삽입용 단건 서명 URL(저장 시 encodeForStorage가 경로로 되돌림).
export const createImageDisplayUrl = async (path) => {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, DISPLAY_TTL);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
};
