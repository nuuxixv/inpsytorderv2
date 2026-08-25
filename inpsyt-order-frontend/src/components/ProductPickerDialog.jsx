import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Button,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ProductSelectionStep from './ProductSelectionStep';
import { getDiscountedUnit } from '../utils/pricing';

// 어드민 주문 상세의 "상품 추가" — 고객 프론트 ProductSelectionStep(검사군 트리·검색·인기)을 그대로 재사용.
// 담기 임시 카트는 이 다이얼로그 로컬 state. 확정 시 onConfirm(cart)로 상위에 넘겨 편집 버퍼에 병합한다.
const ProductPickerDialog = ({
  open,
  onClose,
  onConfirm,
  discountRate = 0,
  eventTags = [],
  eventName = '',
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [cart, setCart] = useState([]);

  // 열릴 때마다 임시 카트 초기화 — 매 추가 세션은 빈 카트에서 시작.
  useEffect(() => {
    if (open) setCart([]);
  }, [open]);

  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + getDiscountedUnit(item, discountRate) * item.quantity, 0);

  const handleConfirm = () => {
    onConfirm(cart);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      fullScreen={isMobile}
      PaperProps={{ sx: { height: isMobile ? '100%' : '85vh' } }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Typography variant="h5">상품 추가</Typography>
        <IconButton size="small" onClick={onClose} aria-label="닫기"><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <ProductSelectionStep
            cart={cart}
            onCartChange={setCart}
            discountRate={discountRate}
            eventTags={eventTags}
            eventName={eventName}
            visibleCategories={null}
          />
        </Box>
      </DialogContent>

      <Box
        sx={{
          px: 3,
          py: 2,
          borderTop: `1px solid ${theme.gray[200]}`,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 0, fontFeatureSettings: '"tnum" 1' }}>
          담은 상품 <Box component="span" sx={{ color: 'text.primary', fontWeight: 700 }}>{totalQty}개</Box>
          {' · 합계 '}
          <Box component="span" sx={{ color: 'primary.main', fontWeight: 700 }}>{totalPrice.toLocaleString()}원</Box>
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          <Button onClick={onClose} variant="outlined">취소</Button>
          <Button onClick={handleConfirm} variant="contained" disabled={cart.length === 0}>
            추가하기
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
};

export default ProductPickerDialog;
