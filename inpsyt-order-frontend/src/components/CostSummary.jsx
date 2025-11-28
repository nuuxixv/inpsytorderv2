import React from 'react';
import {
  Box,
  Typography,
  Card,
  Divider,
  LinearProgress
} from '@mui/material';

const SHIPPING_FEE = 3000;
const FREE_SHIPPING_THRESHOLD = 30000;

const CostSummary = ({ cart, discountRate = 0 }) => {
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
    const shippingCost = totalOriginalPrice >= FREE_SHIPPING_THRESHOLD || totalOriginalPrice === 0 ? 0 : SHIPPING_FEE;
    const finalCost = totalDiscountedPrice + shippingCost;
    const freeShippingProgress = Math.min((totalOriginalPrice / FREE_SHIPPING_THRESHOLD) * 100, 100);

    return { totalOriginalPrice, totalDiscountAmount, shippingCost, finalCost, freeShippingProgress };
  };

  const { totalOriginalPrice, totalDiscountAmount, shippingCost, finalCost, freeShippingProgress } = calculateCosts();
  const remainingForFreeShipping = FREE_SHIPPING_THRESHOLD - totalOriginalPrice;

  return (
    <Card sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>결제 정보</Typography>
      
      <Box sx={{ my: 3, p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
            {totalOriginalPrice < FREE_SHIPPING_THRESHOLD 
              ? `무료배송까지 ${remainingForFreeShipping.toLocaleString()}원 남았습니다!`
              : '🎉 무료배송 혜택이 적용되었습니다!'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {Math.round(freeShippingProgress)}%
          </Typography>
        </Box>
        <LinearProgress 
          variant="determinate" 
          value={freeShippingProgress} 
          sx={{ 
            height: 8, 
            borderRadius: 5, 
            bgcolor: 'grey.200',
            '& .MuiLinearProgress-bar': {
              borderRadius: 5,
              backgroundImage: 'linear-gradient(90deg, #2B398F 0%, #6C5CE7 100%)'
            }
          }} 
        />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', color: 'text.secondary' }}>
          <Typography variant="body1">총 상품 금액</Typography>
          <Typography variant="body1">{totalOriginalPrice.toLocaleString()}원</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', color: 'error.main' }}>
          <Typography variant="body1">총 할인 금액</Typography>
          <Typography variant="body1">-{totalDiscountAmount.toLocaleString()}원</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', color: 'text.secondary' }}>
          <Typography variant="body1">배송비</Typography>
          <Typography variant="body1">{shippingCost > 0 ? `${shippingCost.toLocaleString()}원` : '무료'}</Typography>
        </Box>
      </Box>
      
      <Divider sx={{ my: 3, borderStyle: 'dashed' }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>최종 결제 금액</Typography>
        <Typography variant="h4" color="primary" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          {finalCost.toLocaleString()}원
        </Typography>
      </Box>
    </Card>
  );
};

export default CostSummary;