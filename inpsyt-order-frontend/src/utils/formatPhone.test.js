import { describe, it, expect } from 'vitest';
import { formatPhone, normalizePhone } from './formatPhone';

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
