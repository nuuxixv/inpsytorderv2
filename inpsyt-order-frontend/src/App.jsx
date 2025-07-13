import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import OrderForm from './components/OrderForm';
import ProductSelector from './components/ProductSelector';
import CostSummary from './components/CostSummary';
import {
  Container,
  Typography,
  Button,
  Box,
  CssBaseline,
  CircularProgress,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#2B398F',
    },
    background: {
      default: '#f4f6f8',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Noto Sans KR", sans-serif',
    h4: { fontWeight: 700, fontSize: '1.8rem' },
    h5: { fontWeight: 600, fontSize: '1.4rem' },
  },
  components: {
    MuiCard: { styleOverrides: { root: { borderRadius: 16, boxShadow: 'none', padding: '24px' } } },
    MuiTextField: { defaultProps: { variant: 'filled', fullWidth: true } },
    MuiButton: { styleOverrides: { root: { borderRadius: 8, fontWeight: 600 } } },
  },
});

const DISCOUNT_RATE = 0.15;
const SHIPPING_FEE = 3000;
const FREE_SHIPPING_THRESHOLD = 30000;

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({ name: '', email: '', phone: '', postcode: '', address: '', detailAddress: '', inpsytId: '', request: '' });
  const [cart, setCart] = useState([{ id: null, name: '', quantity: 1, list_price: 0, is_discountable: true }]);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.from('products').select('*').order('name', { ascending: true });
        if (error) throw error;
        setProducts(data);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const handleSubmitOrder = async () => {
    setIsSubmitting(true);
    setError(null);

    // 1. 비용 계산
    let totalOriginalPrice = 0;
    let totalDiscountedPrice = 0;
    cart.forEach(item => {
      if (item && item.id) {
        const quantity = item.quantity || 0;
        const originalPrice = item.list_price || 0;
        totalOriginalPrice += originalPrice * quantity;
        const discountedPrice = item.is_discountable ? Math.round(originalPrice * (1 - DISCOUNT_RATE)) : originalPrice;
        totalDiscountedPrice += discountedPrice * quantity;
      }
    });
    const totalDiscountAmount = totalOriginalPrice - totalDiscountedPrice;
    const shippingCost = totalOriginalPrice >= FREE_SHIPPING_THRESHOLD || totalOriginalPrice === 0 ? 0 : SHIPPING_FEE;
    const finalCost = totalDiscountedPrice + shippingCost;

    // 2. orders 테이블에 저장할 데이터 준비
    const orderData = {
      customer_name: customerInfo.name,
      email: customerInfo.email,
      phone_number: customerInfo.phone,
      shipping_address: {
        postcode: customerInfo.postcode,
        address: customerInfo.address,
        detail: customerInfo.detailAddress,
      },
      inpsyt_id: customerInfo.inpsytId,
      customer_request: customerInfo.request,
      total_cost: totalOriginalPrice,
      discount_amount: totalDiscountAmount,
      delivery_fee: shippingCost,
      final_payment: finalCost,
      is_email_sent: false, // 초기값
    };

    try {
      // 3. orders 테이블에 데이터 삽입 및 id 반환
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) throw orderError;

      // 4. order_items 테이블에 저장할 데이터 준비
      const orderItemsData = cart
        .filter(item => item.id) // 유효한 상품만 필터링
        .map(item => ({
          order_id: newOrder.id,
          product_id: item.id,
          quantity: item.quantity,
          price_at_purchase: item.is_discountable ? Math.round(item.list_price * (1 - DISCOUNT_RATE)) : item.list_price,
        }));

      // 5. order_items 테이블에 데이터 삽입
      const { error: itemsError } = await supabase.from('order_items').insert(orderItemsData);

      if (itemsError) throw itemsError;

      // 6. 성공 처리
      setShowSuccessDialog(true);

    } catch (error) {
      setError(`주문 처리 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleCloseDialog = () => {
      setShowSuccessDialog(false);
      // 성공 후 폼 초기화
      setCustomerInfo({ name: '', email: '', phone: '', postcode: '', address: '', detailAddress: '', inpsytId: '', request: '' });
      setCart([{ id: null, name: '', quantity: 1, list_price: 0, is_discountable: true }]);
  }

  const isSubmittable = customerInfo.name && customerInfo.email && customerInfo.phone && cart.some(item => item.id);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="sm">
        <Box sx={{ textAlign: 'center', my: 3 }}>
          <img src="https://raw.githubusercontent.com/nuuxixv/inpsytmm/7a7cdd43a42a0e309f1337a1860c351192f1e06d/%EC%A3%BC%EB%AC%B8%EC%84%9C%20%EB%B0%B0%EB%84%88_%EA%B3%B5%ED%86%B5.jpg" alt="배너 이미지" style={{ maxWidth: '100%', borderRadius: '8px' }} />
          <Typography variant="h4" component="h1" sx={{ mt: 2 }}>
            도서 및 검사 주문서
          </Typography>
        </Box>

        {loading && <Box sx={{display: 'flex', justifyContent: 'center'}}><CircularProgress /></Box>}
        {error && <Alert severity="error" sx={{mb: 2}}>{error}</Alert>}

        {!loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <OrderForm customerInfo={customerInfo} setCustomerInfo={setCustomerInfo} />
            <ProductSelector products={products} cart={cart} setCart={setCart} />
            <CostSummary cart={cart} />
            <Button 
              variant="contained" 
              color="primary" 
              size="large"
              fullWidth
              onClick={handleSubmitOrder}
              disabled={!isSubmittable || isSubmitting}
              sx={{ mt: 2, mb: 4, py: 1.5, fontSize: '1.2rem' }}
            >
              {isSubmitting ? <CircularProgress size={28} color="inherit" /> : (isSubmittable ? '주문 제출하기' : '주문자 정보와 상품을 입력해주세요')}
            </Button>
          </Box>
        )}
        
        <Dialog open={showSuccessDialog} onClose={handleCloseDialog}>
            <DialogTitle>주문 완료</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    주문이 성공적으로 접수되었습니다. 주문 내역이 곧 이메일로 발송될 예정입니다.
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleCloseDialog}>확인</Button>
            </DialogActions>
        </Dialog>

      </Container>
    </ThemeProvider>
  );
}

export default App;
