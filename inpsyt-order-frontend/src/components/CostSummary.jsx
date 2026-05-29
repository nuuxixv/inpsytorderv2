import React from 'react';
import {
  Box,
  Typography,
  Card,
  Divider,
  LinearProgress,
  useTheme,
} from '@mui/material';

const CostSummary = ({ cart, settings, discountRate = 0, embedded = false, compact = false, isOnsitePurchase = false }) => {
  const theme = useTheme();
  const { free_shipping_threshold = 30000, shipping_cost = 3000 } = settings || {};
  const calculateCosts = () => {
    let totalOriginalPrice = 0;
    let totalDiscountedPrice = 0;

    cart.forEach(item => {
      if (item && item.id) {
        const quantity = item.quantity || 0;
        const originalPrice = item.list_price || 0;

        totalOriginalPrice += originalPrice * quantity;

        if (item.is_discountable) {
          totalDiscountedPrice += Math.round((originalPrice * (1 - discountRate))) * quantity;
        } else {
          totalDiscountedPrice += originalPrice * quantity;
        }
      }
    });

    const totalDiscountAmount = totalOriginalPrice - totalDiscountedPrice;
    const shippingCost = isOnsitePurchase ? 0 : (totalOriginalPrice >= free_shipping_threshold || totalOriginalPrice === 0 ? 0 : shipping_cost);
    const finalCost = totalDiscountedPrice + shippingCost;
    const freeShippingProgress = Math.min((totalOriginalPrice / free_shipping_threshold) * 100, 100);

    return { totalOriginalPrice, totalDiscountAmount, shippingCost, finalCost, freeShippingProgress };
  };

  const { totalOriginalPrice, totalDiscountAmount, shippingCost, finalCost, freeShippingProgress } = calculateCosts();
  const remainingForFreeShipping = free_shipping_threshold - totalOriginalPrice;

  // Compact mode: only show final price (for FloatingBottomBar)
  if (compact) {
    return (
      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
        {finalCost.toLocaleString()}원
      </Typography>
    );
  }

  const content = (
    <>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2.5 }}>결제 정보</Typography>

      {/* Free shipping progress - hide in on-site mode. 사양 §Step 2 결제 정보 무료배송 진행바. */}
      {!isOnsitePurchase && (
        <Box sx={{ mb: 3, p: 2, bgcolor: theme.gray[100], borderRadius: `${theme.radii.md}px` }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
              {totalOriginalPrice < free_shipping_threshold
                ? `무료배송까지 ${remainingForFreeShipping.toLocaleString()}원 남았습니다!`
                : '무료배송 혜택이 적용되었습니다!'}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={freeShippingProgress}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: theme.gray[200],
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
                // 사양에서는 brand 그라데이션 (단색 brand-700 단순화 검토 권장). 현재 사양 그대로 유지.
                backgroundImage: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
              },
            }}
          />
        </Box>
      )}

      {/* Cost breakdown */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">총 상품 금액</Typography>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>{totalOriginalPrice.toLocaleString()}원</Typography>
        </Box>
        {totalDiscountAmount > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="error.main">할인 금액</Typography>
            <Typography variant="body2" color="error.main" sx={{ fontWeight: 600 }}>
              -{totalDiscountAmount.toLocaleString()}원
            </Typography>
          </Box>
        )}
        {!isOnsitePurchase && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">배송비</Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {shippingCost > 0 ? `${shippingCost.toLocaleString()}원` : '무료'}
            </Typography>
          </Box>
        )}
      </Box>

      <Divider sx={{ my: 2.5, borderStyle: 'dashed' }} />

      {/* Final amount — 사양 §Step 2 결제 정보 최종 행. 02 §타이포 약속 4 number 토큰 위계. */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-end', sm: 'center' } }}>
        <Typography variant="h6" sx={{ color: 'text.primary' }}>최종 결제 금액</Typography>
        <Typography variant="h3" color="primary" sx={{ fontWeight: 800 }}>
          {finalCost.toLocaleString()}원
        </Typography>
      </Box>
    </>
  );

  // Embedded mode: no Card wrapper (used inside OrderReviewStep)
  if (embedded) {
    return content;
  }

  // Standalone mode: with Card wrapper. 라운드/보더는 글로벌 MuiCard에 위임.
  return (
    <Card sx={{ p: { xs: 2.5, sm: 3 } }}>
      {content}
    </Card>
  );
};

export default CostSummary;
