import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import OrderForm from './OrderForm';
import ProductSelector from './ProductSelector';
import CostSummary from './CostSummary';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const eventSlug = searchParams.get('events');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({ name: '', email: '', phone: '', postcode: '', address: '', detailAddress: '', inpsytId: '', request: '' });
  const [cart, setCart] = useState([]); // Initialize with empty array
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [eventInfo, setEventInfo] = useState(null); // Added state for event info
  const [showEventSelectionDialog, setShowEventSelectionDialog] = useState(false); // State for event selection dialog
  const [allEvents, setAllEvents] = useState([]); // State to store all events
  const [selectedEventIdFromDialog, setSelectedEventIdFromDialog] = useState(''); // State for selected event in dialog

  useEffect(() => {
    const fetchEventData = async () => {
      try {
        setLoading(true);
        // Fetch all events for the dialog, filtering by current date
        const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
        const { data: allEventsData, error: allEventsError } = await supabase
          .from('events')
          .select('id, name, discount_rate, order_url_slug')
          .lte('start_date', today) // start_date <= today
          .gte('end_date', today)   // end_date >= today
          .order('name', { ascending: true });
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
    fetchEventData();
  }, [eventSlug]);

  const handleEventSelectFromDialog = () => {
    const selectedEvent = allEvents.find(event => event.id === selectedEventIdFromDialog);
    if (selectedEvent) {
      navigate(`/order?events=${selectedEvent.order_url_slug}`);
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

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('create-order', {
        body: {
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
          cart: cart.filter(item => item.id).map(item => ({ product_id: item.id, quantity: item.quantity })),
          event_id: eventInfo.id,
        },
      });

      if (invokeError) throw invokeError;
      if (data.error) throw new Error(data.error);

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
    <Container maxWidth="md">
      <Box sx={{ textAlign: 'center', mb: 5 }}>
        <Box 
          sx={{ 
            position: 'relative',
            borderRadius: 4,
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
            mb: 4
          }}
        >
          <img 
            src="https://raw.githubusercontent.com/nuuxixv/inpsytmm/7a7cdd43a42a0e309f1337a1860c351192f1e06d/%EC%A3%BC%EB%AC%B8%EC%84%9C%20%EB%B0%B0%EB%84%88_%EA%B3%B5%ED%86%B5.jpg" 
            alt="배너 이미지" 
            style={{ width: '100%', display: 'block' }} 
          />
          <Box 
            sx={{ 
              position: 'absolute', 
              bottom: 0, 
              left: 0, 
              right: 0, 
              background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)',
              p: 4,
              pt: 8,
              textAlign: 'left'
            }}
          >
            <Typography variant="h4" component="h1" sx={{ color: 'white', fontWeight: 800, textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
              도서 및 검사 주문서
            </Typography>
            {eventInfo && (
              <Typography variant="h6" component="h2" sx={{ color: 'rgba(255,255,255,0.9)', mt: 1, fontWeight: 500 }}>
                {eventInfo.name}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={40} thickness={4} />
        </Box>
      )}
      
      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            mb: 3, 
            borderRadius: 2,
            boxShadow: '0 4px 12px rgba(255, 118, 117, 0.2)' 
          }}
        >
          {error}
        </Alert>
      )}

      {!loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <OrderForm customerInfo={customerInfo} setCustomerInfo={setCustomerInfo} />
          <ProductSelector selectedProducts={cart} onProductChange={setCart} discountRate={eventInfo ? eventInfo.discount_rate : 0} eventTags={eventInfo ? eventInfo.tags : []} />
          <CostSummary cart={cart} discountRate={eventInfo ? eventInfo.discount_rate : 0} />
          
          <Button 
            variant="contained" 
            color="primary" 
            size="large"
            fullWidth
            onClick={handleSubmitOrder}
            disabled={!isSubmittable || isSubmitting}
            sx={{ 
              mt: 2, 
              mb: 8, 
              py: 2, 
              fontSize: '1.2rem',
              fontWeight: 700,
              borderRadius: 3,
              boxShadow: '0 8px 24px rgba(43, 57, 143, 0.3)',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 12px 32px rgba(43, 57, 143, 0.4)',
              },
              '&:disabled': {
                bgcolor: 'action.disabledBackground',
                color: 'action.disabled',
                boxShadow: 'none'
              }
            }}
          >
            {isSubmitting ? <CircularProgress size={28} color="inherit" /> : (isSubmittable ? '주문 제출하기' : '주문 정보를 입력해주세요')}
          </Button>
        </Box>
      )}
      
      <Dialog open={showSuccessDialog} onClose={handleCloseDialog}>
          <DialogTitle>주문 완료</DialogTitle>
          <DialogContent>
              <DialogContentText>
                  주문이 성공적으로 접수되었습니다. 곧 결제 도와드리겠습니다.
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
              MenuProps={{ disablePortal: true }}
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
