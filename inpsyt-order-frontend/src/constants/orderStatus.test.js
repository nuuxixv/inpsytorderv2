import { describe, it, expect } from 'vitest';
import { ALLOWED_TRANSITIONS, getStatusOptions } from './orderStatus';

describe('ALLOWED_TRANSITIONS', () => {
  it('pending에서 결제완료·주문취소만 허용 (처리완료 회귀 금지)', () => {
    expect(ALLOWED_TRANSITIONS.pending).toEqual(['paid', 'cancelled']);
  });

  it('paid에서 결제취소만 허용 (목록에서 completed 전이 금지)', () => {
    expect(ALLOWED_TRANSITIONS.paid).toEqual(['refunded']);
  });

  it('종결 3종(completed·cancelled·refunded)은 전이 없음', () => {
    expect(ALLOWED_TRANSITIONS.completed).toEqual([]);
    expect(ALLOWED_TRANSITIONS.cancelled).toEqual([]);
    expect(ALLOWED_TRANSITIONS.refunded).toEqual([]);
  });
});

describe('getStatusOptions', () => {
  it('현재 상태를 선두로 두고 허용 전이를 이어붙인다', () => {
    expect(getStatusOptions('pending')).toEqual(['pending', 'paid', 'cancelled']);
    expect(getStatusOptions('paid')).toEqual(['paid', 'refunded']);
  });

  it('종결 상태는 현재 상태 1개만 반환', () => {
    expect(getStatusOptions('completed')).toEqual(['completed']);
    expect(getStatusOptions('cancelled')).toEqual(['cancelled']);
    expect(getStatusOptions('refunded')).toEqual(['refunded']);
  });

  it('중복 없이 현재 상태가 선두', () => {
    const opts = getStatusOptions('pending');
    expect(opts[0]).toBe('pending');
    expect(opts).toEqual([...new Set(opts)]);
  });

  it('알 수 없는 상태는 자기 자신만', () => {
    expect(getStatusOptions('unknown')).toEqual(['unknown']);
  });
});
