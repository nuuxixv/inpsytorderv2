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
  Snackbar,
} from '@mui/material';

import OrderStepIndicator from './OrderStepIndicator';
import FloatingBottomBar from './FloatingBottomBar';
import ProductSelectionStep from './ProductSelectionStep';
import CustomerInfoStep from './CustomerInfoStep';
import OrderReviewStep from './OrderReviewStep';
import CartBottomSheet from './CartBottomSheet';

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

  // Settings state
  const [settings, setSettings] = useState({
    free_shipping_threshold: 30000,
    shipping_cost: 3000,
  });

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
  const [submittedOrderId, setSubmittedOrderId] = useState(null);
  const [eventInfo, setEventInfo] = useState(null);
  const [accessError, setAccessError] = useState(null); // 'no_slug' | 'expired' | 'not_found'

  // Computed values
  const discountRate = eventInfo ? eventInfo.discount_rate : 0;
  const validCartItems = cart.filter(item => item.id);
  const hasCartItems = validCartItems.length > 0;

  // 무료배송 기준은 정가(할인 전) 기준
  const totalOriginalPrice = useMemo(() => {
    return validCartItems.reduce((sum, item) => sum + (item.list_price || 0) * item.quantity, 0);
  }, [validCartItems]);

  const isCustomerInfoValid = customerInfo.name && customerInfo.email && customerInfo.phone;
  const hasOnlineCode = validCartItems.some(item => item.category === '온라인코드' || (item.name && item.name.includes('온라인')));
  const isSubmittable = isCustomerInfoValid && hasCartItems;

  // Fetch event data and settings
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setAccessError(null);

        // Fetch settings first
        try {
          const { data: settingsData, error: settingsError } = await supabase
            .from('site_settings')
            .select('*')
            .single();
          if (!settingsError && settingsData) {
            setSettings(settingsData);
          }
        } catch (sErr) {
          console.error('Failed to fetch settings, using defaults:', sErr);
        }

        // 슬러그 없이 접근 → 즉시 차단
        if (!eventSlug) {
          setAccessError('no_slug');
          setEventInfo(null);
          return;
        }

        const today = new Date().toISOString().split('T')[0];

        // 슬러그로 이벤트 조회 (날짜 유효성 포함)
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select('id, name, discount_rate, tags, start_date, end_date, estimated_delivery_date')
          .eq('order_url_slug', eventSlug)
          .single();

        if (eventError || !eventData) {
          setAccessError('not_found');
          setEventInfo(null);
        } else if (eventData.end_date < today || eventData.start_date > today) {
          setAccessError('expired');
          setEventInfo(null);
        } else {
          setEventInfo(eventData);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [eventSlug]);



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

      setSubmittedOrderId(data?.order?.access_token || null);
      setShowSuccessDialog(true);
    } catch (error) {
      setError(`주문 처리 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseSuccessDialog = () => {
    setShowSuccessDialog(false);
    setSubmittedOrderId(null);
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
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100dvh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // 접근 차단 화면: 슬러그 없음 / 만료 / 존재하지 않음
  if (accessError) {
    const messages = {
      no_slug: {
        emoji: '🔗',
        title: '직접 접속이 불가합니다',
        desc: '현재 진행 중인 학회 링크로만 주문하실 수 있습니다.\n담당자에게 문의하여 올바른 링크로 접속해주세요.',
        showLookup: false,
      },
      expired: {
        emoji: '📅',
        title: '종료된 학회입니다',
        desc: '해당 학회의 주문 기간이 종료되었습니다.\n진행 중인 학회 링크를 담당자에게 문의해주세요.',
        showLookup: true,
      },
      not_found: {
        emoji: '❓',
        title: '존재하지 않는 링크입니다',
        desc: '올바르지 않은 학회 주소입니다.\n담당자에게 정확한 링크를 요청해주세요.',
        showLookup: false,
      },
    };
    const { emoji, title, desc, showLookup } = messages[accessError] || messages.not_found;
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100dvh', p: 4, textAlign: 'center', gap: 2 }}>
        <Typography sx={{ fontSize: '4rem' }}>{emoji}</Typography>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>{title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line', lineHeight: 1.8 }}>
          {desc}
        </Typography>
        {showLookup && (
          <Button
            variant="outlined"
            size="large"
            onClick={() => navigate(eventSlug ? `/order/lookup?events=${eventSlug}` : '/order/lookup')}
            sx={{ mt: 2, borderRadius: '12px', minHeight: 48, minWidth: 200 }}
          >
            주문내역 조회하기
          </Button>
        )}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: activeStep === 0 ? 'background.paper' : '#F8F9FA',
        maxWidth: 600,
        mx: 'auto',
        transition: 'background-color 0.3s ease',
      }}
    >
      {/* Header Branding */}
      <Box sx={{ pt: 3, pb: 1, px: 2, display: 'flex', alignItems: 'center' }}>
        {/* 좌측 여백 (우측 버튼 너비와 균형) */}
        <Box sx={{ flex: 1 }} />
        {/* 브랜드 텍스트 - 트리플탭 영역 */}
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
          sx={{ userSelect: 'none' }}
        >
          <Typography variant="subtitle2" sx={{ color: isOnsitePurchase ? 'warning.main' : 'primary.main', fontWeight: 800, letterSpacing: 1 }}>
            인싸이트 / 학지사{isOnsitePurchase ? ' · 현장구매' : ''}
          </Typography>
        </Box>
        {/* 우측: 주문 조회 버튼 */}
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            size="small"
            variant="text"
            onClick={() => navigate(eventSlug ? `/order/lookup?events=${eventSlug}` : '/order/lookup')}
            sx={{ fontSize: '0.72rem', color: 'text.secondary', minWidth: 'auto', px: 1 }}
          >
            주문 조회
          </Button>
        </Box>
      </Box>

      {/* Step indicator - Hide only in Step 0 (Lounge mode) */}
      {activeStep > 0 && <OrderStepIndicator activeStep={activeStep} />}

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
            settings={settings}
            discountRate={discountRate}
            onGoToStep={handleGoToStep}
            isOnsitePurchase={isOnsitePurchase}
            estimatedDeliveryDate={eventInfo?.estimated_delivery_date}
          />
        )}
      </Box>

      {/* Floating bottom bar */}
      <FloatingBottomBar
        activeStep={activeStep}
        cart={cart}
        totalPrice={totalOriginalPrice}
        freeShippingThreshold={settings.free_shipping_threshold}
        isOnsitePurchase={isOnsitePurchase}
        onNext={handleNext}
        onBack={handleBack}
        onSubmit={handleSubmitOrder}
        onCartClick={() => setCartSheetOpen(true)}
        isSubmitting={isSubmitting}
        isSubmittable={isSubmittable}
      />

      <CartBottomSheet
        open={cartSheetOpen}
        onClose={() => setCartSheetOpen(false)}
        onOpen={() => setCartSheetOpen(true)}
        cart={cart}
        onCartChange={setCart}
        discountRate={discountRate}
        isOnsitePurchase={isOnsitePurchase}
        settings={settings}
      />

      {/* Success dialog */}
      <Dialog
        open={showSuccessDialog}
        onClose={(event, reason) => {
          // Allow closing on backdrop click or escape key for better UX
          if (reason === 'backdropClick' || reason === 'escapeKeyDown' || !reason) {
            handleCloseSuccessDialog();
          }
        }}
        PaperProps={{ sx: { borderRadius: '16px', mx: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, textAlign: 'center', pt: 4, pb: 1 }}>
          주문이 접수되었습니다 ✓
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ textAlign: 'center', color: 'text.secondary', lineHeight: 1.8 }}>
            주문이 성공적으로 접수되었습니다.
            <br />
            담당자에게 카드를 건네어 결제를 완료해주세요.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, flexDirection: 'column', gap: 1 }}>
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={handleCloseSuccessDialog}
            sx={{ borderRadius: '12px', minHeight: 48 }}
          >
            확인했습니다
          </Button>
          {submittedOrderId && (
            <Button
              variant="text"
              size="small"
              fullWidth
              onClick={() => {
                handleCloseSuccessDialog();
                navigate(`/order/status/${submittedOrderId}`);
              }}
              sx={{ borderRadius: '12px', color: 'text.secondary', fontSize: '0.8125rem' }}
            >
              주문내역 확인하기
            </Button>
          )}
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
