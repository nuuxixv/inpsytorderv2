// 검수(테스트) 주문 전용 예약 번호 — ?qa=1 자동 입력이 채우는 값이자,
// 알림톡 발송 생략 판정의 단일 기준(건우님 규칙 2026-08-26: 테스트 주문엔 알림톡을 보내지 않는다).
export const QA_TEST_PHONE_DIGITS = '01000000000';

export const normalizePhone = (v) => String(v ?? '').replace(/\D/g, '');

// 휴대폰 번호 유효성 — 정규화 후 "01로 시작하는 10~11자리"만 통과.
// 접수 확인 알림톡이 이 번호로만 발송되므로 미완성·지역번호(02 등)를 걸러낸다.
export const isValidMobile = (v) => /^01\d{8,9}$/.test(normalizePhone(v));

export const formatPhone = (v) => {
  const d = normalizePhone(v);
  if (!d) return '';
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) {
    return d.startsWith('02')
      ? `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`
      : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (d.length === 9 && d.startsWith('02')) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
  if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return d;
};
