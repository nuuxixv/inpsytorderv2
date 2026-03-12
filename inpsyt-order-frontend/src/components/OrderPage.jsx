import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
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
  FormControl,
  Snackbar,
} from '@mui/material';

import OrderStepIndicator from './OrderStepIndicator';
import FloatingBottomBar from './FloatingBottomBar';
import ProductSelectionStep from './ProductSelectionStep';
import CustomerInfoStep from './CustomerInfoStep';
import OrderReviewStep from './OrderReviewStep';
import CartBottomSheet from './CartBottomSheet';

const SHIPPING_FEE = 3000;
const FREE_SHIPPING_THRESHOLD = 30000;

const OrderPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const eventSlug = searchParams.get('events');

  // Step state
  const [activeStep, setActiveStep] = useState(0);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  const [isOnsitePurchase, setIsOnsitePurchase] = useState(false);
  const [onsiteSnackbar, setOnsiteSnackbar] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef(null);

  // Data state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    name: '', email: '', phone: '', postcode: '',
    address: '', detailAddress: '', inpsytId: '', request: '',
  });
  const [cart, setCart] = useState([]);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [eventInfo, setEventInfo] = useState(null);
  const [showEventSelectionDialog, setShowEventSelectionDialog] = useState(false);
  const [allEvents, setAllEvents] = useState([]);
  const [selectedEventIdFromDialog, setSelectedEventIdFromDialog] = useState('');

  // Computed values
  const discountRate = eventInfo ? eventInfo.discount_rate : 0;
  const validCartItems = cart.filter(item => item.id);
  const hasCartItems = validCartItems.length > 0;

  const totalPrice = useMemo(() => {
    return validCartItems.reduce((sum, item) => {
      const price = item.is_discountable
        ? Math.round(item.list_price * (1 - discountRate))
        : item.list_price;
      return sum + price * item.quantity;
    }, 0);
  }, [validCartItems, discountRate]);

  const isCustomerInfoValid = customerInfo.name && customerInfo.email && customerInfo.phone;
  const hasOnlineCode = validCartItems.some(item => item.category === '온라인코드' || (item.name && item.name.includes('온라인')));
  const isSubmittable = isCustomerInfoValid && hasCartItems;

  // Fetch event data
  useEffect(() => {
    const fetchEventData = async () => {
      try {
        setLoading(true);
        const today = new Date().toISOString().split('T')[0];
        const { data: allEventsData, error: allEventsError } = await supabase
          .from('events')
          .select('id, name, discount_rate, order_url_slug, tags')
          .lte('start_date', today)
          .gte('end_date', today)
          .order('name', { ascending: true });
        if (allEventsError) throw allEventsError;
        setAllEvents(allEventsData);

        if (eventSlug) {
          const { data: eventData, error: eventError } = await supabase
            .from('events')
            .select('id, name, discount_rate, tags')
            .eq('order_url_slug', eventSlug)
            .single();

          if (eventError || !eventData) {
            setError('유효하지 않은 학회 주소입니다. 학회를 선택해주세요.');
            setShowEventSelectionDialog(true);
            setEventInfo(null);
          } else {
            setEventInfo(eventData);
          }
        } else {
          setShowEventSelectionDialog(true);
          setEventInfo(null);
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
      setError(null);
    } else {
      setError('학회를 선택해주세요.');
    }
  };

  const handleNext = () => {
    if (activeStep === 0) {
      if (!hasCartItems) {
        setError('상품을 1개 이상 담아주세요.');
        return;
      }
      setError(null);
      setActiveStep(1);
      window.scrollTo(0, 0);
    } else if (activeStep === 1) {
      if (!isCustomerInfoValid) {
        setError('필수 정보(성함, 연락처, 이메일)를 입력해주세요.');
        return;
      }
      setError(null);
      setActiveStep(2);
      window.scrollTo(0, 0);
    }
  };

  const handleBack = () => {
    setError(null);
    setActiveStep(prev => Math.max(prev - 1, 0));
    window.scrollTo(0, 0);
  };

  const handleGoToStep = (step) => {
    setError(null);
    setActiveStep(step);
    window.scrollTo(0, 0);
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
          customer_request: isOnsitePurchase
            ? `[현장구매] ${customerInfo.request || ''}`.trim()
            : customerInfo.request,
          cart: validCartItems.map(item => ({ product_id: item.id, quantity: item.quantity })),
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

  const handleCloseSuccessDialog = () => {
    setShowSuccessDialog(false);
    setCustomerInfo({
      name: '', email: '', phone: '', postcode: '',
      address: '', detailAddress: '', inpsytId: '', request: '',
    });
    setCart([]);
    setActiveStep(0);
  };

  // Loading state
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress size={40} thickness={4} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        maxWidth: 600,
        mx: 'auto',
      }}
    >
      {/* Header Branding - triple tap to toggle on-site purchase */}
      <Box
        onClick={() => {
          tapCountRef.current += 1;
          if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
          tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 600);
          if (tapCountRef.current >= 3) {
            tapCountRef.current = 0;
            if (activeStep < 2) {
              setIsOnsitePurchase(prev => !prev);
              setOnsiteSnackbar(true);
            }
          }
        }}
        sx={{ pt: 3, pb: 1, px: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none' }}
      >
        <Typography variant="subtitle2" sx={{ color: isOnsitePurchase ? 'warning.main' : 'primary.main', fontWeight: 800, letterSpacing: 1 }}>
          인싸이트 / 학지사{isOnsitePurchase ? ' · 현장구매' : ''}
        </Typography>
      </Box>

      {/* Step indicator */}
      <OrderStepIndicator activeStep={activeStep} />

      {/* Error display */}
      {error && (
        <Alert
          severity="error"
          onClose={() => setError(null)}
          sx={{ mx: 2, mt: 2, borderRadius: '12px' }}
        >
          {error}
        </Alert>
      )}

      {/* Step content */}
      <Box sx={{ flex: 1, overflowY: 'auto', pb: '100px' }}>
        {activeStep === 0 && (
          <ProductSelectionStep
            cart={cart}
            onCartChange={setCart}
            discountRate={discountRate}
            eventTags={eventInfo?.tags || []}
            eventName={eventInfo?.name || ''}
          />
        )}

        {activeStep === 1 && (
          <CustomerInfoStep
            customerInfo={customerInfo}
            setCustomerInfo={setCustomerInfo}
            hasOnlineCode={hasOnlineCode}
            isOnsitePurchase={isOnsitePurchase}
          />
        )}

        {activeStep === 2 && (
          <OrderReviewStep
            cart={cart}
            customerInfo={customerInfo}
            discountRate={discountRate}
            onGoToStep={handleGoToStep}
            isOnsitePurchase={isOnsitePurchase}
          />
        )}
      </Box>

      {/* Floating bottom bar */}
      <FloatingBottomBar
        activeStep={activeStep}
        cart={cart}
        totalPrice={totalPrice}
        freeShippingThreshold={FREE_SHIPPING_THRESHOLD}
        isOnsitePurchase={isOnsitePurchase}
        onNext={handleNext}
        onBack={handleBack}
        onSubmit={handleSubmitOrder}
        onCartClick={() => setCartSheetOpen(true)}
        isSubmitting={isSubmitting}
        isSubmittable={isSubmittable}
      />

      {/* Cart bottom sheet */}
      <CartBottomSheet
        open={cartSheetOpen}
        onClose={() => setCartSheetOpen(false)}
        onOpen={() => setCartSheetOpen(true)}
        cart={cart}
        onCartChange={setCart}
        discountRate={discountRate}
        isOnsitePurchase={isOnsitePurchase}
      />

      {/* Success dialog */}
      <Dialog
        open={showSuccessDialog}
        onClose={handleCloseSuccessDialog}
        PaperProps={{ sx: { borderRadius: '16px', mx: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, textAlign: 'center', pt: 4, pb: 1 }}>
          주문이 완료되었습니다
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ textAlign: 'center', color: 'text.secondary' }}>
            주문이 성공적으로 접수되었습니다.
            <br />
            곧 결제 안내를 드리겠습니다.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'center' }}>
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={handleCloseSuccessDialog}
            sx={{ borderRadius: '12px', minHeight: 48 }}
          >
            확인
          </Button>
        </DialogActions>
      </Dialog>

      {/* Event selection dialog */}
      <Dialog
        open={showEventSelectionDialog}
        onClose={() => {}}
        disableEscapeKeyDown
        PaperProps={{ sx: { borderRadius: '16px', mx: 2, minWidth: 320 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pt: 3 }}>학회 선택</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2, color: 'text.secondary' }}>
            주문할 학회를 선택해주세요.
          </DialogContentText>
          <FormControl fullWidth>
            <InputLabel id="event-select-label">학회</InputLabel>
            <Select
              labelId="event-select-label"
              value={selectedEventIdFromDialog}
              label="학회"
              onChange={(e) => setSelectedEventIdFromDialog(e.target.value)}
              MenuProps={{ disablePortal: true }}
              sx={{ borderRadius: '12px' }}
            >
              {allEvents.map((event) => (
                <MenuItem key={event.id} value={event.id}>
                  {event.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            variant="contained"
            fullWidth
            onClick={handleEventSelectFromDialog}
            disabled={!selectedEventIdFromDialog}
            sx={{ borderRadius: '12px', minHeight: 48 }}
          >
            선택
          </Button>
        </DialogActions>
      </Dialog>

      {/* On-site purchase snackbar */}
      <Snackbar
        open={onsiteSnackbar}
        autoHideDuration={2000}
        onClose={() => setOnsiteSnackbar(false)}
        message={isOnsitePurchase ? '🏪 현장구매 모드가 활성화되었습니다' : '📦 일반 배송 모드로 전환되었습니다'}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      />
    </Box>
  );
};

export default OrderPage;
