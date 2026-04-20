/**
 * 검색용 정규화: 소문자화 + 공백·특수문자 제거.
 * "DSM-5-TR(제5판)" 과 "DSM5TR제5판"을 동일하게 매칭시키기 위함.
 */
export function normalizeForSearch(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .toLowerCase()
    .replace(/[\s\-_+:().,/[\]{}*!?'"`~@#$%^&]/g, '');
}

/**
 * 다중 키워드 AND 매칭.
 * 검색어를 공백으로 쪼개 모든 토큰이 정규화된 텍스트에 포함되면 매칭.
 *
 * 예: query="CDI 표준형" vs name="K-CDI 2: SR ... 표준형_검사지..." → true
 * 예: query="DSM5 편람" vs name="DSM-5-TR정신질환의...편람..." → true
 *
 * @param {string} text 원본 텍스트 (예: 상품명)
 * @param {string} query 검색어
 * @returns {boolean}
 */
export function matchesSearch(text, query) {
  if (!query || !String(query).trim()) return true;
  const normalizedText = normalizeForSearch(text);
  return String(query)
    .trim()
    .split(/\s+/)
    .every((token) => normalizedText.includes(normalizeForSearch(token)));
}
