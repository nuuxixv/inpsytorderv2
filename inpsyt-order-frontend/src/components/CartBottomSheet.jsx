import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Divider,
  SwipeableDrawer,
  Button,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Delete as DeleteIcon,
  ShoppingCartOutlined as ShoppingCartIcon,
} from '@mui/icons-material';
import { EmptyState } from './ui';

const CartBottomSheet = ({ open, onClose, onOpen, cart, onCartChange, settings, discountRate = 0, isOnsitePurchase = false, onProceed }) => {
  const theme = useTheme();
  const { free_shipping_threshold = 30000, shipping_cost = 3000 } = settings || {};
  const validItems = cart.filter(item => item.id);

  const handleQuantityChange = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      onCartChange(cart.filter(p => p.id !== productId));
    } else {
      onCartChange(
        cart.map(p => (p.id === productId ? { ...p, quantity: newQuantity } : p))
      );
    }
  };

  const handleRemove = (productId) => {
    onCartChange(cart.filter(p => p.id !== productId));
  };

  const getItemPrice = (item) => {
    if (item.is_discountable && discountRate > 0) {
      return Math.round(item.list_price * (1 - discountRate));
    }
    return item.list_price;
  };

  const totalPrice = validItems.reduce((sum, item) => {
    return sum + getItemPrice(item) * item.quantity;
  }, 0);

  // 무료배송 기준은 정가(할인 전) 기준
  const totalOriginalPrice = validItems.reduce((sum, item) => sum + item.list_price * item.quantity, 0);
  // 정가 대비 할인 금액 (CostSummary와 동일 표기)
  const totalDiscount = totalOriginalPrice - totalPrice;

  // 확정 영역용 — 총 건수 / 배송비 부과 여부 / 무료배송까지 남은 금액
  const totalQty = validItems.reduce((sum, item) => sum + item.quantity, 0);
  const hasFee = !isOnsitePurchase && totalOriginalPrice < free_shipping_threshold;
  const remainingForFree = Math.max(0, free_shipping_threshold - totalOriginalPrice);

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      onOpen={onOpen}
      disableSwipeToOpen
      PaperProps={{
        sx: {
          borderRadius: `${theme.radii.lg}px ${theme.radii.lg}px 0 0`,
          maxHeight: '75vh',
          pb: 'env(safe-area-inset-bottom)',
          left: 'max(0px, calc((100vw - 600px) / 2))',
          right: 'max(0px, calc((100vw - 600px) / 2))',
        },
      }}
    >
      {/* Drag handle */}
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5, pb: 0.5 }}>
        <Box sx={{ width: 40, height: 4, bgcolor: 'grey.300', borderRadius: `${theme.radii.pill}px` }} />
      </Box>

      {/* Header */}
      <Box sx={{ px: 2.5, pb: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          장바구니{' '}
          <Typography component="span" variant="inherit" color="primary.main">
            {validItems.length}
          </Typography>
        </Typography>
        <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Divider />

      {/* Cart items — minHeight:0 필수: 없으면 항목 많을 때 스크롤이 안 잡혀
          하단 총액/버튼이 75vh 밖으로 밀림(OrderDetailModal과 동류 결함 예방) */}
      <Box sx={{ overflowY: 'auto', flex: 1, minHeight: 0, px: 2.5, py: 1.5 }}>
        {validItems.length === 0 ? (
          <EmptyState icon={ShoppingCartIcon} title="장바구니가 비어있습니다" />
        ) : (
          validItems.map((item, index) => {
            const unitPrice = getItemPrice(item);
            const itemTotal = unitPrice * item.quantity;

            return (
              <Box key={item.id}>
                <Box sx={{ py: 2 }}>
                  {/* Top row: name + remove */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, flex: 1, pr: 1, lineHeight: 1.4 }}
                    >
                      {item.name}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => handleRemove(item.id)}
                      sx={{ color: 'text.disabled', mt: -0.5, '&:hover': { color: 'error.main' } }}
                    >
                      <CloseIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>

                  {/* Bottom row: quantity stepper + price */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {/* Quantity stepper */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: `${theme.radii.sm}px`,
                        overflow: 'hidden',
                      }}
                    >
                      <IconButton
                        size="small"
                        onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                        sx={{ borderRadius: 0, width: 36, height: 36, color: 'text.secondary' }}
                      >
                        {item.quantity === 1 ? (
                          <DeleteIcon sx={{ fontSize: 16 }} />
                        ) : (
                          <RemoveIcon sx={{ fontSize: 16 }} />
                        )}
                      </IconButton>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          minWidth: 32,
                          textAlign: 'center',
                        }}
                      >
                        {item.quantity}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                        sx={{ borderRadius: 0, width: 36, height: 36, color: 'text.secondary' }}
                      >
                        <AddIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>

                    {/* Price */}
                    <Typography variant="subtitle2">
                      {itemTotal.toLocaleString()}원
                    </Typography>
                  </Box>
                </Box>
                {index < validItems.length - 1 && <Divider />}
              </Box>
            );
          })
        )}
      </Box>

      {/* Footer */}
      {validItems.length > 0 && (
        <Box
          sx={{
            px: 2.5,
            py: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'grey.50',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              총 상품 금액
            </Typography>
            <Typography variant="subtitle2">
              {totalOriginalPrice.toLocaleString()}원
            </Typography>
          </Box>
          {totalDiscount > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography variant="caption" color="error.main">
                할인 금액
              </Typography>
              <Typography variant="subtitle2" color="error.main">
                -{totalDiscount.toLocaleString()}원
              </Typography>
            </Box>
          )}
          {!isOnsitePurchase && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                배송비
              </Typography>
              <Typography variant="subtitle2">
                {totalOriginalPrice >= free_shipping_threshold ? '무료' : `${shipping_cost.toLocaleString()}원`}
              </Typography>
            </Box>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              총 금액
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main' }}>
              {(isOnsitePurchase
                ? totalPrice
                : totalPrice + (totalOriginalPrice >= free_shipping_threshold ? 0 : shipping_cost)
              ).toLocaleString()}원
            </Typography>
          </Box>

          {/* 확정 영역 — 0→1 진행 전 장바구니 확인 + 무료배송 업셀 (건우님 2026-06-01) */}
          {onProceed && (
            <Box sx={{ mt: 2.5 }}>
              <Typography variant="body2" sx={{ textAlign: 'center', mb: 1.5, color: 'text.secondary' }}>
                총 {totalQty}건 구매
                {hasFee && (
                  <>
                    {' · '}
                    <Box component="span" sx={{ color: 'primary.main', fontWeight: 700 }}>
                      {remainingForFree.toLocaleString()}원
                    </Box>
                    {' 더 구매하시면 무료배송이에요'}
                  </>
                )}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {hasFee ? (
                  <>
                    <Button fullWidth size="large" variant="outlined" onClick={onProceed}>
                      그래도 주문하기
                    </Button>
                    <Button fullWidth size="large" variant="contained" onClick={onClose}>
                      상품 추가하기
                    </Button>
                  </>
                ) : (
                  <>
                    <Button fullWidth size="large" variant="contained" onClick={onProceed}>
                      주문하기
                    </Button>
                    <Button fullWidth size="large" variant="outlined" onClick={onClose}>
                      상품 추가하기
                    </Button>
                  </>
                )}
              </Box>
            </Box>
          )}
        </Box>
      )}
    </SwipeableDrawer>
  );
};

export default CartBottomSheet;
