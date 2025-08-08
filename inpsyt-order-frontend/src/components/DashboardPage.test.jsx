import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DashboardPage from './DashboardPage';
import { supabase } from '../supabaseClient'; // 모킹할 대상

// supabaseClient 모킹
vi.mock('../supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        gte: vi.fn(() => ({ // dateRange 필터링 체인
          data: [],
          error: null,
        })),
        // gte가 호출되지 않는 경우 (전체 기간)
        data: [],
        error: null,
      })),
    })),
  },
}));

describe('DashboardPage', () => {
  it('renders dashboard title after data fetching', async () => {
    // 모의 데이터 설정
    const mockOrders = [
      { created_at: new Date().toISOString(), total_amount: 10000, order_items: [{ quantity: 1, price_at_purchase: 10000, product_id: 'P01' }] },
    ];
    const mockProducts = [
      { product_code: 'P01', type: '도서' },
    ];

    // supabase.from 호출에 대한 모의 구현 설정
    supabase.from.mockImplementation((tableName) => {
      if (tableName === 'orders') {
        return {
          select: vi.fn().mockReturnThis(), // .select()가 this를 반환하여 체이닝 가능하게
          gte: vi.fn().mockResolvedValue({ data: mockOrders, error: null }),
        };
      } 
      if (tableName === 'products') {
        return {
          select: vi.fn().mockResolvedValue({ data: mockProducts, error: null }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) }; // 기본값
    });


    render(<DashboardPage />);

    // "대시보드" 텍스트가 나타날 때까지 기다림
    const titleElement = await screen.findByText('대시보드');
    expect(titleElement).toBeInTheDocument();

    // 추가적으로, 모의 데이터가 잘 렌더링되었는지 확인
    const totalSalesElement = await screen.findByText(/총 매출/);
    expect(totalSalesElement).toBeInTheDocument();
    // expect(await screen.findByText('10,000원')).toBeInTheDocument(); // StatCard 값 검증
  });
});