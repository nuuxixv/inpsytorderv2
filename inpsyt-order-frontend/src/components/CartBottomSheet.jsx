import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Divider,
  SwipeableDrawer,
  Button,
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

const CartBottomSheet = ({ open, onClose, onOpen, cart, onCartChange, settings, discountRate = 0, isOnsitePurchase = false }) => {
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

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      onOpen={onOpen}
      disableSwipeToOpen
      PaperProps={{
        sx: {
          borderRadius: '16px 16px 0 0',
          maxHeight: '75vh',
          pb: 'env(safe-area-inset-bottom)',
        },
      }}
    >
      {/* Drag handle */}
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5, pb: 0.5 }}>
        <Box sx={{ width: 40, height: 4, bgcolor: 'grey.300', borderRadius: 2 }} />
      </Box>

      {/* Header */}
      <Box sx={{ px: 2.5, pb: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          장바구니{' '}
          <Typography component="span" color="primary.main" sx={{ fontWeight: 800, fontSize: 'inherit' }}>
            {validItems.length}
          </Typography>
        </Typography>
        <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Divider />

      {/* Cart items */}
      <Box sx={{ overflowY: 'auto', flex: 1, px: 2.5, py: 1.5 }}>
        {validItems.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="body1" color="text.secondary">
              장바구니가 비어있습니다
            </Typography>
          </Box>
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
                        borderRadius: '10px',
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
                        variant="body2"
                        sx={{
                          fontWeight: 700,
                          minWidth: 32,
                          textAlign: 'center',
                          fontSize: '0.875rem',
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
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
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
            bgcolor: '#F8F9FA',
          }}
        >
          {!isOnsitePurchase && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                배송비
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {totalOriginalPrice >= free_shipping_threshold ? '무료' : `${shipping_cost.toLocaleString()}원`}
              </Typography>
            </Box>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
              총 금액
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main' }}>
              {(isOnsitePurchase
                ? totalPrice
                : totalPrice + (totalOriginalPrice >= free_shipping_threshold ? 0 : shipping_cost)
              ).toLocaleString()}원
            </Typography>
          </Box>
        </Box>
      )}
    </SwipeableDrawer>
  );
};

export default CartBottomSheet;
