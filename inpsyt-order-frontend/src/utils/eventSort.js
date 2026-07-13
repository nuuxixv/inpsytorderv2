import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getTodayKST } from './date';

/**
 * 학회 시작일을 드롭다운 표기용 'yyyy.M.d'로 포맷한다.
 * @param {string|null} startDate - 'YYYY-MM-DD'
 * @returns {string|null} 포맷 문자열. 없으면 null.
 */
export function formatEventStartDate(startDate) {
  if (!startDate) return null;
  return format(new Date(startDate + 'T00:00:00'), 'yyyy.M.d', { locale: ko });
}

/**
 * 학회 드롭다운용 그룹 분리.
 * 오늘(KST) 기준 start_date가 [오늘-7일, 오늘+7일] 이내인 학회를 pinned 그룹으로,
 * 나머지를 rest 그룹으로 나눈다. 두 그룹 모두 start_date 내림차순으로 정렬하며,
 * start_date가 없는(null) 학회는 rest 맨 뒤로 보낸다(pinned는 start_date 필수라 null 없음).
 * @param {Array<{start_date?: string|null}>} events - events 행 배열('YYYY-MM-DD' 문자열)
 * @returns {{ pinned: Array, rest: Array }} 그룹별 새 배열
 */
export function groupEventsForDropdown(events) {
  if (!Array.isArray(events)) return { pinned: [], rest: [] };

  const today = new Date(getTodayKST() + 'T00:00:00');
  const lo = new Date(today);
  lo.setDate(lo.getDate() - 7);
  const hi = new Date(today);
  hi.setDate(hi.getDate() + 7);
  const toStr = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const loStr = toStr(lo);
  const hiStr = toStr(hi);

  const isPinned = (e) => !!e.start_date && e.start_date >= loStr && e.start_date <= hiStr;

  const byStartDesc = (a, b) => {
    if (!a.start_date && !b.start_date) return 0;
    if (!a.start_date) return 1;
    if (!b.start_date) return -1;
    return b.start_date.localeCompare(a.start_date);
  };

  const pinned = [];
  const rest = [];
  for (const e of events) {
    (isPinned(e) ? pinned : rest).push(e);
  }
  pinned.sort(byStartDesc);
  rest.sort(byStartDesc);
  return { pinned, rest };
}

/**
 * 학회 드롭다운용 정렬(flat).
 * groupEventsForDropdown 결과를 [...pinned, ...rest]로 이어붙인 배열.
 * @param {Array<{start_date?: string|null}>} events - events 행 배열('YYYY-MM-DD' 문자열)
 * @returns {Array} 정렬된 새 배열
 */
export function sortEventsForDropdown(events) {
  const { pinned, rest } = groupEventsForDropdown(events);
  return [...pinned, ...rest];
}
