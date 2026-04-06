import React from 'react';
import { Box, Typography, Card, CardContent, Button, Divider } from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import CostSummary from './CostSummary';

const InfoRow = ({ label, value }) => (
  <Box sx={{ display: 'flex', py: 0.75 }}>
    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 72, flexShrink: 0 }}>
      {label}
    </Typography>
    <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-all' }}>
      {value || '-'}
    </Typography>
  </Box>
);

const OrderReviewStep = ({ cart, customerInfo, settings, discountRate = 0, onGoToStep, isOnsitePurchase = false, estimatedDeliveryDate }) => {
  const validItems = cart.filter(item => item.id);

  const getItemPrice = (item) => {
    if (item.is_discountable && discountRate > 0) {
      return Math.round(item.list_price * (1 - discountRate));
    }
    return item.list_price;
  };

  const fullAddress = [customerInfo.postcode, customerInfo.address, customerInfo.detailAddress]
    .filter(Boolean)
    .join(' ');

  return (
    <Box sx={{ px: 2, pb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 3, pt: 2 }}>
        <Typography variant="h3" sx={{ fontWeight: 800, mb: 0.5 }}>
          주문 내용을 확인해주세요
        </Typography>
        <Typography variant="body2" color="text.secondary">
          모든 정보가 올바른지 확인 후 제출해주세요
        </Typography>
      </Box>

      {/* Order items card */}
      <Card sx={{ mb: 2, borderRadius: '16px', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              주문 상품 · {validItems.length}건
            </Typography>
            <Button
              size="small"
              startIcon={<EditIcon sx={{ fontSize: 14 }} />}
              onClick={() => onGoToStep(0)}
              sx={{ fontSize: '0.75rem', color: 'text.secondary' }}
            >
              수정
            </Button>
          </Box>

          {validItems.map((item, index) => {
            const unitPrice = getItemPrice(item);
            const itemTotal = unitPrice * item.quantity;

            return (
              <Box key={item.id}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    py: 1.5,
                  }}
                >
                  <Box sx={{ flex: 1, pr: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.25, lineHeight: 1.4 }}>
                      {item.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {unitPrice.toLocaleString()}원 x {item.quantity}개
                    </Typography>
                  </Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {itemTotal.toLocaleString()}원
                  </Typography>
                </Box>
                {index < validItems.length - 1 && <Divider />}
              </Box>
            );
          })}
        </CardContent>
      </Card>

      {/* Customer info card */}
      <Card sx={{ mb: 2, borderRadius: '16px', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              주문자 정보
            </Typography>
            <Button
              size="small"
              startIcon={<EditIcon sx={{ fontSize: 14 }} />}
              onClick={() => onGoToStep(1)}
              sx={{ fontSize: '0.75rem', color: 'text.secondary' }}
            >
              수정
            </Button>
          </Box>

          <InfoRow label="성함" value={customerInfo.name} />
          <InfoRow label="연락처" value={customerInfo.phone} />
          <InfoRow label="이메일" value={customerInfo.email} />
          {fullAddress && <InfoRow label="배송지" value={fullAddress} />}
          {customerInfo.inpsytId && <InfoRow label="인싸이트 ID" value={customerInfo.inpsytId} />}
          {customerInfo.request && <InfoRow label="요청사항" value={customerInfo.request} />}
        </CardContent>
      </Card>

      {/* Cost summary */}
      <Card sx={{ borderRadius: '16px', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <CostSummary cart={cart} settings={settings} discountRate={discountRate} embedded isOnsitePurchase={isOnsitePurchase} />
        </CardContent>
      </Card>

      {/* 배송 예정일 안내 */}
      {!isOnsitePurchase && estimatedDeliveryDate && (
        <Box sx={{ mt: 2, bgcolor: 'rgba(43, 57, 143, 0.06)', border: '1px solid rgba(43, 57, 143, 0.18)', borderRadius: '12px', p: 2, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600 }}>
            🚚 지금 주문하면 {format(new Date(estimatedDeliveryDate), 'M월 d일 (E)', { locale: ko })}까지 90% 도착
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default OrderReviewStep;
