import React from 'react';
import { Box, Button, IconButton, Typography, Badge, LinearProgress } from '@mui/material';
import {
  ShoppingCart as CartIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import CircularProgress from '@mui/material/CircularProgress';

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
  const totalQuantity = cart.filter(item => item.id).reduce((sum, item) => sum + item.quantity, 0);
  const hasItems = totalQuantity > 0;

  const getNextLabel = () => {
    switch (activeStep) {
      case 0:
        return '다음';
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
      {/* Shipping info bar - only on step 0, hidden in on-site mode */}
      {!isOnsitePurchase && activeStep === 0 && hasItems && totalPrice < freeShippingThreshold && (
        <Box sx={{ maxWidth: 600, mx: 'auto', mb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              무료배송까지 {(freeShippingThreshold - totalPrice).toLocaleString()}원 남았습니다!
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min((totalPrice / freeShippingThreshold) * 100, 100)}
            sx={{
              height: 4,
              borderRadius: 2,
              bgcolor: '#E5E8EB',
              '& .MuiLinearProgress-bar': { borderRadius: 2 },
            }}
          />
        </Box>
      )}
      {!isOnsitePurchase && activeStep === 0 && hasItems && totalPrice >= freeShippingThreshold && (
        <Box sx={{ maxWidth: 600, mx: 'auto', mb: 1 }}>
          <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 700 }}>
            🎉 무료배송 조건을 충족했습니다!
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
              borderRadius: 2,
              transition: 'background-color 0.15s ease',
              '&:active': hasItems ? { bgcolor: 'grey.100' } : {},
              minWidth: 56,
            }}
          >
            <Badge
              badgeContent={totalQuantity}
              color="primary"
              sx={{
                '& .MuiBadge-badge': {
                  fontWeight: 700,
                  fontSize: '0.7rem',
                },
              }}
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
          >
            <ArrowBackIcon />
          </IconButton>
        )}

        {/* Right side: CTA button */}
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
            minHeight: 52,
            borderRadius: '14px',
            fontSize: '1.0625rem',
            fontWeight: 700,
            boxShadow: 'none',
            '&:disabled': {
              bgcolor: '#E5E8EB',
              color: '#B0B8C1',
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
