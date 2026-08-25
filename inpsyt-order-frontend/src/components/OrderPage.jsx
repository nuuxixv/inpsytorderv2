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
  useTheme,
} from '@mui/material';

import OrderStepIndicator from './OrderStepIndicator';
import FloatingBottomBar from './FloatingBottomBar';
import ProductSelectionStep from './ProductSelectionStep';
import CustomerInfoStep from './CustomerInfoStep';
import OrderReviewStep from './OrderReviewStep';
import CartBottomSheet from './CartBottomSheet';
import { getTodayKST } from '../utils/date';
import { SHIPPING_DEFAULTS, shippingBasisAmount } from '../constants/shipping';
import { getDiscountedUnit } from '../utils/pricing';
import { hasOnlineCode } from '../utils/onlineCode';
import { isValidMobile } from '../utils/formatPhone';
import { loadOrderDraft, saveOrderDraft, clearOrderDraft, DEFAULT_CUSTOMER_INFO } from '../utils/orderDraft';

const OrderPage = () => {
  const theme = useTheme();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const eventSlug = searchParams.get('events');

  // 마운트 시 sessionStorage에서 진행 내용 복원(같은 탭·같은 행사 slug 한정, utils/orderDraft).
  // cart 스냅샷은 그대로 복원한다 — 제출 시 서버(create-order)가 product_id로 금액을 재계산하므로
  // 표시 스냅샷이 최신 상품과 달라도 실제 결제 금액에는 영향이 없다(재결합 fetch 생략).
  const [draft] = useState(() => loadOrderDraft(eventSlug));

  // Step state
  const [activeStep, setActiveStep] = useState(() => draft?.activeStep ?? 0);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  const [isOnsitePurchase, setIsOnsitePurchase] = useState(false);
  const [onsiteSnackbar, setOnsiteSnackbar] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef(null);

  // Settings state
  const [settings, setSettings] = useState({
    free_shipping_threshold: SHIPPING_DEFAULTS.FREE_SHIPPING_THRESHOLD,
    shipping_cost: SHIPPING_DEFAULTS.SHIPPING_COST,
  });

  // Data state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerInfo, setCustomerInfo] = useState(() => draft?.customerInfo ?? DEFAULT_CUSTOMER_INFO);
  const [cart, setCart] = useState(() => draft?.cart ?? []);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [inpsytConfirmOpen, setInpsytConfirmOpen] = useState(false);
  const [eventInfo, setEventInfo] = useState(null);
  const [accessError, setAccessError] = useState(null); // 'no_slug' | 'expired' | 'not_found'

  // Computed values
  const discountRate = eventInfo ? eventInfo.discount_rate : 0;
  const validCartItems = cart.filter(item => item.id);
  const hasCartItems = validCartItems.length > 0;

  const totalOriginalPrice = useMemo(() => {
    return validCartItems.reduce((sum, item) => sum + (item.list_price || 0) * item.quantity, 0);
  }, [validCartItems]);

  // 무료배송 진행바(FloatingBottomBar) 판정 기준 — 설정 기반(정가/할인가), 기본 정가. 3경로 공유 함수 경유.
  const shippingBasisTotal = useMemo(() => {
    const discountedTotal = validCartItems.reduce((sum, item) => sum + getDiscountedUnit(item, discountRate) * item.quantity, 0);
    return shippingBasisAmount({
      basis: settings.free_shipping_basis,
      originalTotal: totalOriginalPrice,
      discountedTotal,
    });
  }, [validCartItems, discountRate, totalOriginalPrice, settings.free_shipping_basis]);

  const isCustomerInfoValid = customerInfo.name && customerInfo.phone
    && (isOnsitePurchase || (customerInfo.address && customerInfo.detailAddress));
  const cartHasOnlineCode = hasOnlineCode(validCartItems);
  const isSubmittable = isCustomerInfoValid && hasCartItems;
  // 인싸이트 ID 소프트 필수 판정 — 단일 지점. 온라인코드 상품인데 ID 공란이면 제출 전 확인 스텝만 띄운다
  // (하드블록 아님, 부스 결제 차단 금지). 하드블록으로 뒤집으려면 isSubmittable에 `&& !needsInpsytIdConfirm`만 추가.
  const needsInpsytIdConfirm = cartHasOnlineCode && !customerInfo.inpsytId.trim();

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

        const today = getTodayKST();

        // 슬러그로 이벤트 조회 (날짜 유효성 포함)
        // visible_categories 컬럼/GRANT 미적용 환경(마이그레이션 전)에서는 select가 실패하므로
        // 해당 컬럼을 뺀 레거시 select로 재조회 → 전체 노출(기존 동작)로 graceful fallback.
        let { data: eventData, error: eventError } = await supabase
          .from('events')
          .select('id, name, discount_rate, tags, host_society, start_date, end_date, estimated_delivery_date, visible_categories')
          .eq('order_url_slug', eventSlug)
          .single();

        if (eventError) {
          const fallback = await supabase
            .from('events')
            .select('id, name, discount_rate, tags, host_society, start_date, end_date, estimated_delivery_date')
            .eq('order_url_slug', eventSlug)
            .single();
          eventData = fallback.data;
          eventError = fallback.error;
        }

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

  // 진행 내용 자동 저장 — 새로고침·탭 퇴출 대비. slug별 분리(같은 탭 한정).
  useEffect(() => {
    saveOrderDraft(eventSlug, { cart, customerInfo, activeStep });
  }, [eventSlug, cart, customerInfo, activeStep]);



  const handleNext = () => {
    if (activeStep === 0) {
      if (!hasCartItems) {
        setError('상품을 1개 이상 담아주세요.');
        return;
      }
      setError(null);
      // 0→1 진행 전 장바구니 확인 시트(무료배송 업셀 + 배송비 인지). 실제 진행은 시트의 onProceed
      setCartSheetOpen(true);
    } else if (activeStep === 1) {
      if (!isCustomerInfoValid) {
        setError(isOnsitePurchase
          ? '필수 정보(성함, 연락처)를 입력해주세요.'
          : '필수 정보(성함, 연락처, 배송지)를 입력해주세요.');
        return;
      }
      // 연락처 하드 차단 — 단일 지점. 미완성·지역번호 번호로 제출되면 접수 확인 알림톡이 유실된다.
      if (!isValidMobile(customerInfo.phone)) {
        setError('휴대폰 번호를 확인해주세요. 접수 확인 알림톡이 이 번호로 발송됩니다.');
        return;
      }
      setError(null);
      setActiveStep(2);
      window.scrollTo(0, 0);
    }
  };

  // 장바구니 확인 시트의 '주문하기/그래도 주문하기' → 배송지 입력(step1)으로 진행
  const handleProceedToInfo = () => {
    setCartSheetOpen(false);
    setError(null);
    setActiveStep(1);
    window.scrollTo(0, 0);
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

  // 제출 버튼 진입점 — 소프트 필수 확인 스텝을 여기서만 가로챈다(판정은 needsInpsytIdConfirm 단일 지점).
  const handleSubmitClick = () => {
    if (needsInpsytIdConfirm) {
      setInpsytConfirmOpen(true);
      return;
    }
    handleSubmitOrder();
  };

  const handleConfirmWithoutInpsytId = () => {
    setInpsytConfirmOpen(false);
    handleSubmitOrder();
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
          phone_number: customerInfo.phone,
          shipping_address: {
            postcode: customerInfo.postcode,
            address: customerInfo.address,
            detail: customerInfo.detailAddress,
          },
          inpsyt_id: customerInfo.inpsytId,
          is_on_site_sale: isOnsitePurchase,
          customer_request: isOnsitePurchase
            ? `[현장구매] ${customerInfo.request || ''}`.trim()
            : customerInfo.request,
          cart: validCartItems.map(item => ({ product_id: item.id, quantity: item.quantity })),
          event_id: eventInfo.id,
        },
      });

      if (invokeError) {
        const body = await invokeError.context?.json?.().catch(() => null);
        throw new Error(body?.error || invokeError.message);
      }
      if (data.error) throw new Error(data.error);

      // 제출 성공 — 임시 보존분 제거(다음 진입은 빈 상태로 시작).
      clearOrderDraft(eventSlug);

      const token = data.order?.access_token;
      if (token) {
        navigate(`/order/status/${token}`);
      } else {
        setShowSuccessDialog(true);
      }
    } catch (error) {
      setError(`주문 처리 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseSuccessDialog = () => {
    setShowSuccessDialog(false);
    setCustomerInfo(DEFAULT_CUSTOMER_INFO);
    setCart([]);
    setActiveStep(0);
    clearOrderDraft(eventSlug);
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
        title: '링크를 확인해 주세요',
        desc: '학회 전용 링크로만 주문할 수 있어요.\n담당자에게 올바른 링크를 받아 다시 접속해 주세요.',
      },
      expired: {
        emoji: '📅',
        title: '주문이 가능한 날짜가 아니예요.',
        desc: '주문 내역은 받아보신 알림톡에서 확인할 수 있어요.',
      },
      not_found: {
        emoji: '❓',
        title: '찾을 수 없는 링크예요',
        desc: '학회 전용 링크로만 주문할 수 있어요.\n담당자에게 올바른 링크를 받아 다시 접속해 주세요.',
      },
    };
    const { emoji, title, desc } = messages[accessError] || messages.not_found;
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100dvh', p: 4, textAlign: 'center', gap: 2 }}>
        <Typography sx={{ fontSize: '4rem' }}>{emoji}</Typography>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>{title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line', lineHeight: 1.8 }}>
          {desc}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        // 600px 컬럼 바깥은 음영(회색 backdrop). 모바일앱을 PC 가운데 둔 프레임 느낌.
        bgcolor: theme.gray[100],
        transition: 'background-color 0.3s ease',
      }}
    >
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          maxWidth: 600,
          mx: 'auto',
          // 콘텐츠 컬럼 표면 — Step 0·1 흰색 / Step 2 회색
          bgcolor: activeStep < 2 ? 'background.paper' : theme.gray[50],
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
            인싸이트 · 학지사 상품 주문하기{isOnsitePurchase ? ' · 현장구매' : ''}
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
      </Box>

      {/* Step indicator - 3단계 전체 표시 (Step 0 포함, 2026-06-01 건우님) */}
      <OrderStepIndicator activeStep={activeStep} />

      {/* Error display — 사양 §전 단계 공통 에러 알림 */}
      {error && (
        <Alert
          severity="error"
          onClose={() => setError(null)}
          sx={{ mx: 2, mt: 2, borderRadius: `${theme.radii.md}px` }}
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
            eventTags={[...new Set([...(eventInfo?.tags || []), eventInfo?.host_society].filter(Boolean))]}
            eventName={eventInfo?.name || ''}
            visibleCategories={eventInfo?.visible_categories}
          />
        )}

        {activeStep === 1 && (
          <CustomerInfoStep
            customerInfo={customerInfo}
            setCustomerInfo={setCustomerInfo}
            hasOnlineCode={cartHasOnlineCode}
            isOnsitePurchase={isOnsitePurchase}
            eventName={eventInfo?.name || ''}
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
            eventName={eventInfo?.name || ''}
          />
        )}
      </Box>
      </Box>

      {/* Floating bottom bar */}
      <FloatingBottomBar
        activeStep={activeStep}
        cart={cart}
        totalPrice={shippingBasisTotal}
        freeShippingThreshold={settings.free_shipping_threshold}
        isOnsitePurchase={isOnsitePurchase}
        onNext={handleNext}
        onBack={handleBack}
        onSubmit={handleSubmitClick}
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
        onProceed={handleProceedToInfo}
      />

      {/* Success dialog — 사양 §성공 다이얼로그. 실 플로우에선 access_token 있을 때 navigate가 우선, 이 다이얼로그는 fallback. */}
      <Dialog
        open={showSuccessDialog}
        onClose={(event, reason) => {
          // Allow closing on backdrop click or escape key for better UX
          if (reason === 'backdropClick' || reason === 'escapeKeyDown' || !reason) {
            handleCloseSuccessDialog();
          }
        }}
        PaperProps={{ sx: { mx: 2 } }}
      >
        <DialogTitle sx={{ textAlign: 'center', pt: 4, pb: 1 }}>
          주문이 접수됐어요
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ textAlign: 'center', color: 'text.secondary', lineHeight: 1.8 }}>
            담당자를 통해 결제를 진행해 주세요.
            <br />
            결제가 완료되면 카카오 알림톡으로 주문 내역을 보내드려요.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={handleCloseSuccessDialog}
          >
            닫기
          </Button>
        </DialogActions>
      </Dialog>


      {/* 인싸이트 ID 소프트 필수 확인 — 공란이어도 제출은 허용(하드블록 아님). 부스 결제 차단 방지. */}
      <Dialog
        open={inpsytConfirmOpen}
        onClose={() => setInpsytConfirmOpen(false)}
        PaperProps={{ sx: { mx: 2 } }}
      >
        <DialogTitle sx={{ textAlign: 'center', pt: 4, pb: 1 }}>
          인싸이트 ID를 안 넣으셨어요
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ textAlign: 'center', color: 'text.secondary', lineHeight: 1.8 }}>
            인싸이트 ID 없이 진행하면 온라인코드 전달이 늦어질 수 있어요. 계속할까요?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, flexDirection: 'column', gap: 1 }}>
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={() => { setInpsytConfirmOpen(false); handleGoToStep(1); }}
          >
            ID 입력하기
          </Button>
          <Button
            variant="text"
            size="large"
            fullWidth
            color="inherit"
            onClick={handleConfirmWithoutInpsytId}
          >
            이대로 계속
          </Button>
        </DialogActions>
      </Dialog>

      {/* On-site purchase snackbar */}
      <Snackbar
        open={onsiteSnackbar}
        autoHideDuration={2000}
        onClose={() => setOnsiteSnackbar(false)}
        message={isOnsitePurchase ? '🏪 현장구매 모드로 전환됐어요' : '📦 일반 배송 모드로 전환됐어요'}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      />
    </Box>
  );
};

export default OrderPage;
