import React from 'react';
import { Box, Button, IconButton, Typography, Badge, LinearProgress, useTheme } from '@mui/material';
import {
  ShoppingCart as CartIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import CircularProgress from '@mui/material/CircularProgress';

// 사양 §전 단계 공통 — 플로팅 하단 바.
// - position fixed, 600px max 가운데 정렬
// - Step 0: 좌측 장바구니 아이콘+무료배송 진행, Step 1·2: 좌측 뒤로가기
// - 우측 CTA: '배송지 입력하기'(현장구매 시 '주문서 작성하기') / '다음' / '주문 제출하기'
const FloatingBottomBar = ({
  activeStep,
  cart,
  totalPrice = 0,
  freeShippingThreshold = 30000,
  isOnsitePurchase = false,
  onNext,
  onBack,
  onSubmit,
  onCartClick,
  isSubmitting,
  isSubmittable,
}) => {
  const theme = useTheme();
  const totalQuantity = cart.filter(item => item.id).reduce((sum, item) => sum + item.quantity, 0);
  const hasItems = totalQuantity > 0;

  const getNextLabel = () => {
    switch (activeStep) {
      case 0:
        return isOnsitePurchase ? '주문서 작성하기' : '배송지 입력하기';
      case 1:
        return '다음';
      case 2:
        return '주문 제출하기';
      default:
        return '다음';
    }
  };

  const getNextDisabled = () => {
    switch (activeStep) {
      case 0:
        return !hasItems;
      case 1:
        return !isSubmittable;
      case 2:
        return !isSubmittable || isSubmitting;
      default:
        return false;
    }
  };

  const handleNextClick = () => {
    if (activeStep === 2) {
      onSubmit();
    } else {
      onNext();
    }
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        // 바 배경은 화면 꽉 차게(양옆 틈 제거), 내부 콘텐츠는 maxWidth 600 중앙 유지
        left: 0,
        right: 0,
        zIndex: 1200,
        bgcolor: 'background.paper',
        borderTop: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
        px: 2,
        pt: 1.5,
        pb: 'max(12px, env(safe-area-inset-bottom))',
      }}
    >
      {/* Shipping info bar - only on step 0, hidden in on-site mode. 사양 §Step 0 무료배송 안내. */}
      {!isOnsitePurchase && activeStep === 0 && hasItems && totalPrice < freeShippingThreshold && (
        <Box sx={{ maxWidth: 600, mx: 'auto', mb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              무료배송까지 {(freeShippingThreshold - totalPrice).toLocaleString()}원 남았어요.
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min((totalPrice / freeShippingThreshold) * 100, 100)}
            sx={{
              height: 4,
              borderRadius: 2,
              bgcolor: theme.gray[200],
              '& .MuiLinearProgress-bar': { borderRadius: 2 },
            }}
          />
        </Box>
      )}
      {!isOnsitePurchase && activeStep === 0 && hasItems && totalPrice >= freeShippingThreshold && (
        <Box sx={{ maxWidth: 600, mx: 'auto', mb: 1 }}>
          <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700 }}>
            배송비가 무료로 적용됐어요!
          </Typography>
        </Box>
      )}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          maxWidth: 600,
          mx: 'auto',
        }}
      >
        {/* Left side */}
        {activeStep === 0 ? (
          <Box
            onClick={hasItems ? onCartClick : undefined}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              cursor: hasItems ? 'pointer' : 'default',
              py: 1,
              px: 1.5,
              borderRadius: `${theme.radii.sm}px`,
              transition: `background-color 0.15s ${theme.easing.toss}`,
              '&:active': hasItems ? { bgcolor: theme.gray[100] } : {},
              minWidth: 56,
            }}
          >
            <Badge
              badgeContent={totalQuantity}
              color="primary"
              sx={{ '& .MuiBadge-badge': { fontWeight: 700 } }}
            >
              <CartIcon sx={{ color: hasItems ? 'primary.main' : 'text.disabled', fontSize: 26 }} />
            </Badge>
          </Box>
        ) : (
          <IconButton
            onClick={onBack}
            sx={{
              color: 'text.secondary',
              width: 48,
              height: 48,
            }}
            aria-label="이전 단계"
          >
            <ArrowBackIcon />
          </IconButton>
        )}

        {/* Right side: CTA button — 라운드·폰트는 글로벌 MuiButton sizeLarge 토큰에 위임 */}
        <Button
          variant="contained"
          size="large"
          fullWidth
          onClick={handleNextClick}
          disabled={getNextDisabled()}
          endIcon={
            isSubmitting ? (
              <CircularProgress size={20} color="inherit" />
            ) : activeStep < 2 ? (
              <ArrowForwardIcon />
            ) : null
          }
          sx={{
            '&.Mui-disabled': {
              bgcolor: theme.gray[200],
              color: theme.gray[400],
            },
          }}
        >
          {isSubmitting ? '주문 처리 중...' : getNextLabel()}
        </Button>
      </Box>
    </Box>
  );
};

export default FloatingBottomBar;
