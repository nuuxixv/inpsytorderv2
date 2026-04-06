// 주문 상태 5단계 정의
// pending   → 결제대기  : 고객이 주문서 제출 완료
// paid      → 결제완료  : 현장 담당자가 결제 처리
// completed → 처리완료  : 출고 담당자가 출고처리 (최종)
// cancelled → 주문취소  : 결제대기 상태에서 취소 (매출 없음)
// refunded  → 결제취소  : 결제완료 후 취소 (카드단말기 취소)

export const STATUS_TO_KOREAN = {
  pending:   '결제대기',
  paid:      '결제완료',
  completed: '처리완료',
  cancelled: '주문취소',
  refunded:  '결제취소',
};

export const STATUS_COLORS = {
  pending:   '#F59E0B',
  paid:      '#10B981',
  completed: '#6366F1',
  cancelled: '#EF4444',
  refunded:  '#F43F5E',
};

// 매출에 포함되는 상태 (취소/환불 제외)
export const REVENUE_STATUSES = ['pending', 'paid', 'completed'];
