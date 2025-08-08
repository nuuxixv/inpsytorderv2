// supabase/functions/send-order-email/mock_supabase_js.ts

// This is a mock implementation of createClient for testing purposes.
export function createClient(supabaseUrl: string, supabaseKey: string, options?: any) {
  console.log("Mock createClient called with:", supabaseUrl, supabaseKey, options);
  // Return a mock Supabase client object that mimics the real one's behavior
  return {
    from: (tableName: string) => ({
      select: (columns?: string) => ({
        eq: (column: string, value: any) => {
          // This is where you'd define your mock data and logic for different queries
          if (tableName === "orders" && column === "id" && value === 1) {
            return {
              data: {
                id: 1,
                customer_name: "테스트 고객",
                email: "test@example.com",
                created_at: new Date().toISOString(),
                total_cost: 10000,
                final_payment: 10000,
                phone_number: "010-1234-5678",
                inpsyt_id: "INPSYT001",
                shipping_address: { postcode: "12345", address: "서울시 강남구", detail: "테스트동 123호" },
                customer_request: "문 앞에 놓아주세요",
              },
              error: null,
              single: () => ({
                data: {
                  id: 1,
                  customer_name: "테스트 고객",
                  email: "test@example.com",
                  created_at: new Date().toISOString(),
                  total_cost: 10000,
                  final_payment: 10000,
                  phone_number: "010-1234-5678",
                  inpsyt_id: "INPSYT001",
                  shipping_address: { postcode: "12345", address: "서울시 강남구", detail: "테스트동 123호" },
                  customer_request: "문 앞에 놓아주세요",
                },
                error: null,
              }),
            };
          } else if (tableName === "order_items" && column === "order_id" && value === 1) {
            return {
              data: [
                {
                  id: 101,
                  order_id: 1,
                  product_id: 1,
                  quantity: 2,
                  price_at_purchase: 5000,
                  products: { name: "테스트 상품 A" },
                },
                {
                  id: 102,
                  order_id: 1,
                  product_id: 2,
                  quantity: 1,
                  price_at_purchase: 2000,
                  products: { name: "테스트 상품 B" },
                },
              ],
              error: null,
            };
          } else if (tableName === "orders" && column === "id" && value === 999) {
            return { data: null, error: null, single: () => ({ data: null, error: null }) };
          } else if (tableName === "orders" && column === "id" && value === 1 && columns === "*") {
            // For Supabase error test
            return { data: null, error: { message: "DB connection error" }, single: () => ({ data: null, error: { message: "DB connection error" } }) };
          }
          return { data: null, error: new Error("Mock error: Query not handled") };
        },
      }),
    }),
  };
}