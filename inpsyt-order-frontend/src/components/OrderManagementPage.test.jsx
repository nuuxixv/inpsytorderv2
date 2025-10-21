import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OrderManagementPage from './OrderManagementPage';
import { AuthContext } from '../AuthContext';
import { NotificationContext } from '../NotificationContext';
import { supabase } from '../supabaseClient';

// Mocking supabase client
vi.mock('../supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

const mockUser = { id: 'test-user-id' };
const addNotification = vi.fn();

const renderWithProviders = (ui) => {
  return render(
    <AuthContext.Provider value={{ user: mockUser }}>
      <NotificationContext.Provider value={{ addNotification }}>
        {ui}
      </NotificationContext.Provider>
    </AuthContext.Provider>
  );
};

// Mock data
const mockOrders = [
  {
    id: 1,
    created_at: new Date().toISOString(),
    customer_name: '홍길동',
    email: 'hong@example.com',
    event_id: 101,
    final_payment: 50000,
    status: 'paid',
    order_items: [{ product_id: 1, quantity: 2 }],
  },
  {
    id: 2,
    created_at: new Date().toISOString(),
    customer_name: '김철수',
    email: 'kim@example.com',
    event_id: 102,
    final_payment: 30000,
    status: 'pending',
    order_items: [{ product_id: 2, quantity: 1 }],
  },
];

const mockEvents = [
  { id: 101, name: '테스트 학회 A', discount_rate: 0.1 },
  { id: 102, name: '테스트 학회 B', discount_rate: 0.2 },
];

const mockProducts = [
    { id: 1, name: '테스트 상품 1', list_price: 25000 },
    { id: 2, name: '테스트 상품 2', list_price: 30000 },
];

describe('OrderManagementPage', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    const select = vi.fn().mockReturnThis();
    const order = vi.fn().mockReturnThis();
    const range = vi.fn().mockResolvedValue({ data: mockOrders, error: null, count: mockOrders.length });
    const eq = vi.fn().mockReturnThis();
    const gte = vi.fn().mockReturnThis();
    const lte = vi.fn().mockReturnThis();
    const or = vi.fn().mockReturnThis();

    supabase.from.mockImplementation((tableName) => {
        switch (tableName) {
            case 'orders':
                return { select, order, range, eq, gte, lte, or };
            case 'events':
                return { select: vi.fn().mockResolvedValue({ data: mockEvents, error: null }) };
            case 'products':
                return { select: vi.fn().mockResolvedValue({ data: mockProducts, error: null }) };
            default:
                return { select, order, range, eq, gte, lte, or };
        }
    });
  });

  it('should render the component and display initial orders', async () => {
    renderWithProviders(<OrderManagementPage />);

    // Check for title
    expect(screen.getByText('주문 관리')).toBeInTheDocument();

    // Wait for the orders to be loaded and displayed
    await waitFor(() => {
      expect(screen.getByText('홍길동')).toBeInTheDocument();
      expect(screen.getByText('김철수')).toBeInTheDocument();
    });

    // Check if the correct number of rows are rendered
    const rows = screen.getAllByRole('row');
    // Including header row, so +1
    expect(rows.length).toBe(mockOrders.length + 1);
  });

});
