/**
 * 현재 KST(UTC+9) 날짜를 'YYYY-MM-DD' 문자열로 반환한다.
 * DB의 date 타입(시간 정보 없음)과 직접 문자열 비교할 수 있게 하기 위함.
 */
export function getTodayKST() {
  const now = new Date();
  const kstMs = now.getTime() + (9 * 60 - now.getTimezoneOffset()) * 60 * 1000;
  return new Date(kstMs).toISOString().slice(0, 10);
}

/**
 * KST 날짜 문자열 비교로 학회 상태를 판단한다.
 * Date 객체 비교는 UTC 자정 기준이라 KST로 9시간 어긋나는 버그가 있어
 * 문자열 비교로 통일.
 * @param {string} startDate 'YYYY-MM-DD'
 * @param {string} endDate   'YYYY-MM-DD'
 */
export function getEventStatusKST(startDate, endDate) {
  if (!startDate || !endDate) return { label: '미정', color: 'default' };
  const today = getTodayKST();
  if (today < startDate) return { label: '예정', color: 'info' };
  if (today > endDate) return { label: '종료', color: 'default' };
  return { label: '진행중', color: 'success' };
}
