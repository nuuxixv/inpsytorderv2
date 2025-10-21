
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OrderDetailModal from './OrderDetailModal';
import { NotificationContext } from '../NotificationContext';
import { supabase } from '../supabaseClient';

// supabase 클라이언트 모킹(가짜로 만들기)
vi.mock('../supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

const addNotification = vi.fn();

// 테스트를 위한 가짜(mock) 데이터
const mockOrder = {
  id: 1,
  created_at: new Date().toISOString(),
  customer_name: '홍길동',
  email: 'hong@example.com',
  phone_number: '010-1234-5678',
  shipping_address: {
    address: '서울시 강남구',
    postcode: '12345',
    detail: '테스트 빌딩 101호',
  },
  status: 'paid',
  event_id: 101,
  order_items: [{ product_id: 1, quantity: 2 }],
  admin_memo: '테스트 메모',
  customer_request: '배송 전 연락주세요',
  final_payment: 45000,
};

const mockEvents = [
  { id: 101, name: '테스트 학회 A', discount_rate: 0.1 },
  { id: 102, name: '테스트 학회 B', discount_rate: 0.2 },
];

const mockProducts = [
  { id: 1, name: '테스트 상품 1', list_price: 25000 },
  { id: 2, name: '테스트 상품 2', list_price: 30000 },
];

const mockProductsMap = {
  1: { id: 1, name: '테스트 상품 1', list_price: 25000 },
  2: { id: 2, name: '테스트 상품 2', list_price: 30000 },
};

// 컴포넌트를 렌더링하는 헬퍼 함수
const renderModal = (order) => {
  return render(
    <NotificationContext.Provider value={{ addNotification }}>
      <OrderDetailModal
        open={true}
        onClose={vi.fn()}
        order={order}
        statusToKorean={{ paid: '결제완료', pending: '입금대기' }}
        productsMap={mockProductsMap}
        products={mockProducts}
        events={mockEvents}
        addNotification={addNotification}
        onUpdate={vi.fn()}
        productsLoading={false}
      />
    </NotificationContext.Provider>
  );
};

describe('OrderDetailModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('주문 데이터가 주어졌을 때, 초기 정보를 올바르게 렌더링해야 한다', () => {
    renderModal(mockOrder);

    // 주문 기본 정보 확인
    expect(screen.getByText('상품주문정보 조회')).toBeInTheDocument();
    expect(screen.getByText(mockOrder.id)).toBeInTheDocument();
    expect(screen.getByText('테스트 학회 A')).toBeInTheDocument();

    // 주문자 정보 확인
    expect(screen.getByText(mockOrder.customer_name)).toBeInTheDocument();
    expect(screen.getByText(mockOrder.phone_number)).toBeInTheDocument();
    expect(screen.getByText(mockOrder.email)).toBeInTheDocument();

    // 배송지 정보 확인
    expect(screen.getByText(mockOrder.shipping_address.postcode)).toBeInTheDocument();
    expect(screen.getByText(mockOrder.shipping_address.address)).toBeInTheDocument();
    expect(screen.getByText(mockOrder.shipping_address.detail)).toBeInTheDocument();
    expect(screen.getByText(mockOrder.customer_request)).toBeInTheDocument();

    // 관리자 메모 확인
    expect(screen.getByText(mockOrder.admin_memo)).toBeInTheDocument();

    // 주문 상품 목록 확인
    expect(screen.getByText('테스트 상품 1')).toBeInTheDocument();
    expect(screen.getByText('25,000원')).toBeInTheDocument(); // 정가
    expect(screen.getByText('2')).toBeInTheDocument(); // 수량
  });

  it('편집 후 저장 버튼을 누르면, rpc 함수가 올바른 데이터와 함께 호출되어야 한다', async () => {
    // supabase.rpc가 성공적으로 응답하도록 모킹
    supabase.rpc.mockResolvedValue({ error: null });

    renderModal(mockOrder);

    // 1. '편집' 버튼을 클릭하여 편집 모드로 전환
    const editButton = screen.getByRole('button', { name: /편집/i });
    fireEvent.click(editButton);

    // 2. '주문자명' 입력 필드의 값을 '김민준'으로 변경
    const customerNameInput = screen.getByDisplayValue('홍길동');
    fireEvent.change(customerNameInput, { target: { value: '김민준' } });

    // 3. '저장' 버튼 클릭
    const saveButton = screen.getByRole('button', { name: /저장/i });
    fireEvent.click(saveButton);

    // 4. supabase.rpc 함수가 올바른 인자와 함께 호출되었는지 확인
    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledTimes(1);
      expect(supabase.rpc).toHaveBeenCalledWith(
        'update_order_details',
        expect.objectContaining({
          updates_param: expect.objectContaining({
            customer_name: '김민준', // 변경된 이름이 포함되었는지 확인
          }),
        })
      );
    });

    // 5. 성공 알림이 표시되는지 확인
    await waitFor(() => {
        expect(addNotification).toHaveBeenCalledWith('주문 정보가 성공적으로 업데이트되었습니다.', 'success');
    });
  });
});
