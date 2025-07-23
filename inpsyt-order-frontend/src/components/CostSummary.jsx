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
    <Card>
      <Typography variant="h5" gutterBottom>결제 정보</Typography>
      
      <Box sx={{ my: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {totalOriginalPrice < FREE_SHIPPING_THRESHOLD 
            ? `무료배송까지 ${remainingForFreeShipping.toLocaleString()}원 남았습니다!`
            : '무료배송 혜택이 적용되었습니다!'}
        </Typography>
        <LinearProgress variant="determinate" value={freeShippingProgress} sx={{ height: 8, borderRadius: 5, mt: 1 }} />
      </Box>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, color: 'text.secondary' }}>
        <Typography variant="body2">총 상품 금액</Typography>
        <Typography variant="body2">{totalOriginalPrice.toLocaleString()}원</Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, color: 'error.main' }}>
        <Typography variant="body2" color="inherit">총 할인 금액</Typography>
        <Typography variant="body2" color="inherit">-{totalDiscountAmount.toLocaleString()}원</Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, color: 'text.secondary' }}>
        <Typography variant="body2">배송비</Typography>
        <Typography variant="body2">{shippingCost > 0 ? `${shippingCost.toLocaleString()}원` : '무료'}</Typography>
      </Box>
      
      <Divider sx={{ my: 2 }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>최종 결제 금액</Typography>
        <Typography variant="h5" color="primary" sx={{ fontWeight: 'bold' }}>
          {finalCost.toLocaleString()}원
        </Typography>
      </Box>
    </Card>
  );
};

export default CostSummary;