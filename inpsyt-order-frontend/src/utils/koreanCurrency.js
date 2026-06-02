// 숫자 → 한글 금액 (입금결의서용). 정자 스타일 — 1도 '일'로 표기(일만, 일천, 일십).
//   11000 → '일만일천', 352500 → '삼십오만이천오백', 2227600 → '이백이십이만칠천육백'
// '금'/'원정'은 양식 셀(A5/M5)이 감싸므로 순수 한글 숫자만 반환한다.
// (2026-06-01 건우님: "일도 붙여야 해요" — 1-자리도 생략 없이 일 표기)

const DIGITS = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
const SMALL_UNITS = ['', '십', '백', '천']; // 4자리 그룹 내부
const BIG_UNITS = ['', '만', '억', '조', '경']; // 4자리 그룹 단위

function fourDigitsToKorean(n) {
  let s = '';
  const t = String(n).padStart(4, '0');
  for (let i = 0; i < 4; i++) {
    const d = Number(t[i]);
    if (d) s += DIGITS[d] + SMALL_UNITS[3 - i]; // 1도 '일' 유지(일천/일백/일십/일)
  }
  return s;
}

/**
 * 숫자를 한글 금액 문자열로 변환. (음수·소수는 절대값·정수 처리)
 * @param {number} num
 * @returns {string} 예: '이백이십이만칠천육백' (0이면 '영')
 */
export function numberToKoreanCurrency(num) {
  const n = Math.floor(Math.abs(Number(num) || 0));
  if (n === 0) return '영';
  const groups = [];
  let rest = n;
  while (rest > 0) {
    groups.push(rest % 10000);
    rest = Math.floor(rest / 10000);
  }
  let s = '';
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i]) s += fourDigitsToKorean(groups[i]) + BIG_UNITS[i];
  }
  return s;
}
