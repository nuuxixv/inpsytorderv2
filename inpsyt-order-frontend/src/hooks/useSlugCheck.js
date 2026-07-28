import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { isValidSlug } from '../utils/eventForm';

// '/admin/events/new' 는 생성 페이지 라우트 — slug로 쓰면 L2 상세 접근 불가.
const RESERVED_SLUGS = ['new'];

/**
 * 주문 URL(slug) 형식·예약·중복을 즉시 검사하는 훅.
 * EventCreatePage 인라인 로직에서 추출 — 생성/편집 공용.
 *
 * @param {string} slug - events.order_url_slug
 * @param {{ excludeId?: number|string }} opts - excludeId 지정 시 자기 자신 제외(편집)
 * @returns {{
 *   status: 'idle'|'checking'|'available'|'taken'|'error',
 *   displayMsg: { text: string, color: string },
 *   formatBad: boolean, reserved: boolean, taken: boolean, error: boolean,
 *   isAvailable: boolean, isBusy: boolean,
 * }}
 */
export const useSlugCheck = (slug, { excludeId } = {}) => {
  // { status: 'idle'|'checking'|'available'|'taken'|'error', message? }
  const [check, setCheck] = useState({ status: 'idle' });

  useEffect(() => {
    if (!slug || !isValidSlug(slug) || RESERVED_SLUGS.includes(slug)) {
      setCheck({ status: 'idle' });
      return undefined;
    }
    let cancelled = false;
    setCheck({ status: 'checking' });
    const t = setTimeout(async () => {
      let query = supabase.from('events').select('id').eq('order_url_slug', slug);
      // 편집: 자기 slug가 '이미 사용중'으로 뜨는 것 방지.
      if (excludeId != null) query = query.not('id', 'eq', excludeId);
      const { data, error } = await query.maybeSingle();
      if (cancelled) return;
      if (error) setCheck({ status: 'error', message: error.message });
      else setCheck({ status: data ? 'taken' : 'available' });
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [slug, excludeId]);

  const formatBad = Boolean(slug && !isValidSlug(slug));
  const reserved = Boolean(slug && isValidSlug(slug) && RESERVED_SLUGS.includes(slug));

  let displayMsg;
  if (formatBad) displayMsg = { text: '고유 주소는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.', color: 'error.main' };
  else if (reserved) displayMsg = { text: "'new'는 사용할 수 없는 예약 주소입니다. 다른 주소를 사용하세요.", color: 'error.main' };
  else if (check.status === 'checking') displayMsg = { text: '확인 중...', color: 'text.secondary' };
  else if (check.status === 'available') displayMsg = { text: '사용 가능한 주소입니다', color: 'success.main' };
  else if (check.status === 'taken') displayMsg = { text: '이미 사용중인 고유 주소입니다', color: 'error.main' };
  else if (check.status === 'error') displayMsg = { text: `중복 검사 실패: ${check.message}`, color: 'error.main' };
  else displayMsg = { text: '주문 페이지 주소로 사용됩니다. 영문, 숫자, 하이픈만 가능', color: 'text.secondary' };

  return {
    status: check.status,
    displayMsg,
    formatBad,
    reserved,
    taken: check.status === 'taken',
    error: check.status === 'error',
    isBusy: check.status === 'checking',
    isAvailable:
      Boolean(slug) && isValidSlug(slug) && !RESERVED_SLUGS.includes(slug) && check.status === 'available',
  };
};

export default useSlugCheck;
