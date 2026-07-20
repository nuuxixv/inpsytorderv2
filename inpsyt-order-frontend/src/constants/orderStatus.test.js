import { describe, it, expect } from 'vitest';
import { ALLOWED_TRANSITIONS } from './orderStatus';

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
