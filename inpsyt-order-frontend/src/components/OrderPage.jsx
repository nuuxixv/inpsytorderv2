import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import OrderForm from './OrderForm';
import ProductSelector from './ProductSelector';
import CostSummary from './CostSummary';
import { useSearchParams } from 'react-router-dom';
import {
  Container,
  Typography,
  Button,
  Box,
  CircularProgress,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Select,
  MenuItem,
  InputLabel,
  FormControl
} from '@mui/material';

const SHIPPING_FEE = 3000;
const FREE_SHIPPING_THRESHOLD = 30000;

const OrderPage = () => {
  const [searchParams] = useSearchParams();
  const eventSlug = searchParams.get('events');

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({ name: '', email: '', phone: '', postcode: '', address: '', detailAddress: '', inpsytId: '', request: '' });
  const [cart, setCart] = useState([{ id: null, name: '', quantity: 1, list_price: 0, is_discountable: true }]);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [eventInfo, setEventInfo] = useState(null); // Added state for event info
  const [showEventSelectionDialog, setShowEventSelectionDialog] = useState(false); // State for event selection dialog
  const [allEvents, setAllEvents] = useState([]); // State to store all events
  const [selectedEventIdFromDialog, setSelectedEventIdFromDialog] = useState(''); // State for selected event in dialog

  useEffect(() => {
    const fetchProductsAndEvent = async () => {
      try {
        setLoading(true);
        // Fetch products
        const { data: productsData, error: productsError } = await supabase.from('products').select('*').order('name', { ascending: true });
        if (productsError) throw productsError;
        setProducts(productsData);

        // Fetch all events for the dialog
        const { data: allEventsData, error: allEventsError } = await supabase.from('events').select('id, name, discount_rate, order_url_slug').order('name', { ascending: true });
        if (allEventsError) throw allEventsError;
        setAllEvents(allEventsData);

        // Fetch event info if slug exists
        if (eventSlug) {
          const { data: eventData, error: eventError } = await supabase
            .from('events')
            .select('id, name, discount_rate')
            .eq('order_url_slug', eventSlug)
            .single();

          if (eventError || !eventData) {
            console.error('Error fetching event or event not found:', eventError);
            setError('유효하지 않은 학회 주소입니다. 학회를 선택해주세요.');
            setShowEventSelectionDialog(true); // Show dialog if slug is invalid or not found
            setEventInfo(null); // Ensure eventInfo is null on error
          } else {
            setEventInfo(eventData);
          }
        } else {
          // If no event slug, show the dialog to select an event
          setShowEventSelectionDialog(true);
          setEventInfo(null); // No event slug, no event info initially
        }
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProductsAndEvent();
  }, [eventSlug]);

  const handleEventSelectFromDialog = () => {
    const selectedEvent = allEvents.find(event => event.id === selectedEventIdFromDialog);
    if (selectedEvent) {
      setEventInfo(selectedEvent);
      setShowEventSelectionDialog(false);
      setError(null); // Clear any previous error
    } else {
      setError('학회를 선택해주세요.');
    }
  };

  const handleSubmitOrder = async () => {
    if (!eventInfo) {
      setError('주문할 학회를 선택해주세요.');
      setShowEventSelectionDialog(true);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const discountRate = eventInfo.discount_rate; // Use event-specific discount rate

    let totalOriginalPrice = 0;
    let totalDiscountedPrice = 0;
    cart.forEach(item => {
      if (item && item.id) {
        const quantity = item.quantity || 0;
        const originalPrice = item.list_price || 0;
        totalOriginalPrice += originalPrice * quantity;
        const discountedPrice = item.is_discountable ? Math.round(originalPrice * (1 - discountRate)) : originalPrice;
        totalDiscountedPrice += discountedPrice * quantity;
      }
    });
    const totalDiscountAmount = totalOriginalPrice - totalDiscountedPrice;
    const shippingCost = totalOriginalPrice >= FREE_SHIPPING_THRESHOLD || totalOriginalPrice === 0 ? 0 : SHIPPING_FEE;
    const finalCost = totalDiscountedPrice + shippingCost;

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
      is_email_sent: false,
      event_id: eventInfo.id, // Save event_id
    };

    try {
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItemsData = cart
        .filter(item => item.id)
        .map(item => ({
          order_id: newOrder.id,
          product_id: item.id,
          quantity: item.quantity,
          price_at_purchase: item.is_discountable ? Math.round(item.list_price * (1 - discountRate)) : item.list_price,
        }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItemsData);

      if (itemsError) throw itemsError;

      setShowSuccessDialog(true);

    } catch (error) {
      setError(`주문 처리 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleCloseDialog = () => {
      setShowSuccessDialog(false);
      setCustomerInfo({ name: '', email: '', phone: '', postcode: '', address: '', detailAddress: '', inpsytId: '', request: '' });
      setCart([{ id: null, name: '', quantity: 1, list_price: 0, is_discountable: true }]);
  }

  const isSubmittable = customerInfo.name && customerInfo.email && customerInfo.phone && cart.some(item => item.id);

  return (
    <Container maxWidth="sm">
      <Box sx={{ textAlign: 'center', my: 3 }}>
        <img src="https://raw.githubusercontent.com/nuuxixv/inpsytmm/7a7cdd43a42a0e309f1337a1860c351192f1e06d/%EC%A3%BC%EB%AC%B8%EC%84%9C%20%EB%B0%B0%EB%84%88_%EA%B3%B5%ED%86%B5.jpg" alt="배너 이미지" style={{ maxWidth: '100%', borderRadius: '8px' }} />
        <Typography variant="h4" component="h1" sx={{ mt: 2 }}>
          도서 및 검사 주문서
        </Typography>
        {eventInfo && (
          <Typography variant="h6" component="h2" color="primary" sx={{ mt: 1 }}>
            [{eventInfo.name}] 학회 전용 주문서
          </Typography>
        )}
      </Box>

      {loading && <Box sx={{display: 'flex', justifyContent: 'center'}}><CircularProgress /></Box>}
      {error && <Alert severity="error" sx={{mb: 2}}>{error}</Alert>}

      {!loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <OrderForm customerInfo={customerInfo} setCustomerInfo={setCustomerInfo} />
          <ProductSelector products={products} cart={cart} setCart={setCart} />
          <CostSummary cart={cart} discountRate={eventInfo ? eventInfo.discount_rate : 0} />
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

      {/* Event Selection Dialog */}
      <Dialog open={showEventSelectionDialog} onClose={() => {}} disableEscapeKeyDown>
        <DialogTitle>학회 선택</DialogTitle>
        <DialogContent>
          <DialogContentText>
            주문할 학회를 선택해주세요.
          </DialogContentText>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel id="event-select-label">학회</InputLabel>
            <Select
              labelId="event-select-label"
              value={selectedEventIdFromDialog}
              label="학회"
              onChange={(e) => setSelectedEventIdFromDialog(e.target.value)}
            >
              {allEvents.map((event) => (
                <MenuItem key={event.id} value={event.id}>
                  {event.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEventSelectFromDialog} disabled={!selectedEventIdFromDialog}>선택</Button>
        </DialogActions>
      </Dialog>

    </Container>
  );
}

export default OrderPage;
