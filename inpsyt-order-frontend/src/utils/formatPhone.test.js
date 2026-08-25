import { describe, it, expect } from 'vitest';
import { formatPhone, normalizePhone, isValidMobile } from './formatPhone';

describe('normalizePhone', () => {
  it('숫자만 남긴다', () => {
    expect(normalizePhone('010-1234-5678')).toBe('01012345678');
    expect(normalizePhone('(02) 123-4567')).toBe('021234567');
    expect(normalizePhone(' 010 1234 5678 ')).toBe('01012345678');
  });

  it('null·undefined·빈값은 빈 문자열', () => {
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone(undefined)).toBe('');
    expect(normalizePhone('')).toBe('');
  });

  it('idempotent (이미 정규화된 값 재정규화해도 동일)', () => {
    const once = normalizePhone('010-1234-5678');
    expect(normalizePhone(once)).toBe(once);
  });
});

describe('formatPhone', () => {
  it('11자리 → XXX-XXXX-XXXX', () => {
    expect(formatPhone('01012345678')).toBe('010-1234-5678');
  });

  it('10자리 02 시작 → 02-XXXX-XXXX', () => {
    expect(formatPhone('0212345678')).toBe('02-1234-5678');
  });

  it('10자리 비02 → XXX-XXX-XXXX', () => {
    expect(formatPhone('0311234567')).toBe('031-123-4567');
  });

  it('9자리 02 시작 → 02-XXX-XXXX', () => {
    expect(formatPhone('021234567')).toBe('02-123-4567');
  });

  it('9자리 비02 → digits 그대로(fallback)', () => {
    expect(formatPhone('031123456')).toBe('031123456');
  });

  it('8자리 → XXXX-XXXX', () => {
    expect(formatPhone('12345678')).toBe('1234-5678');
  });

  it('하이픈 입력 라운드트립(정규화 후 재포맷)', () => {
    expect(formatPhone('010-1234-5678')).toBe('010-1234-5678');
    expect(formatPhone('02-123-4567')).toBe('02-123-4567');
  });

  it('공백·괄호 입력도 정규화 후 포맷', () => {
    expect(formatPhone('(02) 1234 5678')).toBe('02-1234-5678');
    expect(formatPhone(' 010 1234 5678 ')).toBe('010-1234-5678');
  });

  it('null·undefined·빈값 → 빈 문자열', () => {
    expect(formatPhone(null)).toBe('');
    expect(formatPhone(undefined)).toBe('');
    expect(formatPhone('')).toBe('');
  });

  it('미매칭 자리수는 digits 그대로 (손실·throw 없음)', () => {
    expect(formatPhone('12345')).toBe('12345');
    expect(formatPhone('0101234567890')).toBe('0101234567890');
  });

  it('비숫자 포함 입력은 숫자만 추출해 처리', () => {
    expect(formatPhone('abc01012345678xyz')).toBe('010-1234-5678');
  });
});

describe('isValidMobile', () => {
  it('11자리 정상 휴대폰 → true', () => {
    expect(isValidMobile('01012345678')).toBe(true);
    expect(isValidMobile('010-1234-5678')).toBe(true);
  });

  it('10자리 01X(구번호) → true', () => {
    expect(isValidMobile('0111234567')).toBe(true);
    expect(isValidMobile('011-123-4567')).toBe(true);
    expect(isValidMobile('017-123-4567')).toBe(true);
  });

  it('미완성 번호 → false', () => {
    expect(isValidMobile('010-1234')).toBe(false);
    expect(isValidMobile('0101234')).toBe(false);
    expect(isValidMobile('010123456789')).toBe(false); // 12자리 초과
  });

  it('공란·null·undefined → false', () => {
    expect(isValidMobile('')).toBe(false);
    expect(isValidMobile(null)).toBe(false);
    expect(isValidMobile(undefined)).toBe(false);
  });

  it('하이픈·공백 포함 입력도 정규화 후 판정', () => {
    expect(isValidMobile(' 010 1234 5678 ')).toBe(true);
    expect(isValidMobile('(010) 1234-5678')).toBe(true);
  });

  it('지역번호(02 등)·비01 시작 → false', () => {
    expect(isValidMobile('0212345678')).toBe(false); // 02 지역번호
    expect(isValidMobile('02-1234-5678')).toBe(false);
    expect(isValidMobile('031-123-4567')).toBe(false);
    expect(isValidMobile('123')).toBe(false); // 과거 검수용 난수
  });
});
