import React, { useState } from 'react';
import { Box, Typography, Card, CardContent, Button, Divider, Dialog, DialogTitle, DialogContent, DialogActions, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Edit as EditIcon, LocalShipping as ShippingIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import CostSummary from './CostSummary';
import { formatPhone } from '../utils/formatPhone';

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

// 약관 모달 섹션 — [필수] 라벨 + 내용(줄바꿈 보존)
const TermsSection = ({ title, children }) => (
  <Box sx={{ mb: 1.75 }}>
    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.25 }}>
      {title}
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
      {children}
    </Typography>
  </Box>
);

const OrderReviewStep = ({ cart, customerInfo, settings, discountRate = 0, onGoToStep, isOnsitePurchase = false, estimatedDeliveryDate, eventName = '' }) => {
  const theme = useTheme();
  const validItems = cart.filter(item => item.id);
  const [termsOpen, setTermsOpen] = useState(false);

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
      <Box sx={{ mb: 3, pt: 2, textAlign: 'center' }}>
        <Typography variant="h3" sx={{ fontWeight: 800, mb: 0.5 }}>
          주문 내용을 확인해주세요
        </Typography>
        {eventName && (
          <Typography variant="body2" color="text.secondary">
            {eventName}
            {discountRate > 0 && ` · ${(discountRate * 100).toFixed(0)}% 할인 적용`}
          </Typography>
        )}
      </Box>

      {/* Order items card */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              주문 상품 · {validItems.length}건
            </Typography>
            <Button
              size="small"
              startIcon={<EditIcon sx={{ fontSize: 14 }} />}
              onClick={() => onGoToStep(0)}
              sx={{ color: 'text.secondary' }}
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
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              주문자 정보
            </Typography>
            <Button
              size="small"
              startIcon={<EditIcon sx={{ fontSize: 14 }} />}
              onClick={() => onGoToStep(1)}
              sx={{ color: 'text.secondary' }}
            >
              수정
            </Button>
          </Box>

          <InfoRow label="성함" value={customerInfo.name} />
          <InfoRow label="연락처" value={formatPhone(customerInfo.phone)} />
          {fullAddress && <InfoRow label="배송지" value={fullAddress} />}
          {customerInfo.inpsytId && <InfoRow label="인싸이트 ID" value={customerInfo.inpsytId} />}
          {customerInfo.request && <InfoRow label="요청사항" value={customerInfo.request} />}
        </CardContent>
      </Card>

      {/* Cost summary */}
      <Card>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <CostSummary cart={cart} settings={settings} discountRate={discountRate} embedded isOnsitePurchase={isOnsitePurchase} />
        </CardContent>
      </Card>

      {/* 배송 예정일 안내 — 사양 §Step 2 배송 예정일 안내 */}
      {!isOnsitePurchase && estimatedDeliveryDate && (
        <Box
          sx={{
            mt: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.06),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
            borderRadius: `${theme.radii.md}px`,
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.75,
          }}
        >
          <ShippingIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600 }}>
            지금 주문하면 {format(new Date(estimatedDeliveryDate), 'M월 d일 (E)', { locale: ko })} 도착 예정이에요.
          </Typography>
        </Box>
      )}

      {/* 결제 동의 문구 — 위계 매우 낮게(그레이스케일). "자세히"만 언더라인 → 약관 모달 */}
      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          주문 내용을 확인했으며 결제에 동의합니다.{' '}
          <Box
            component="span"
            onClick={() => setTermsOpen(true)}
            sx={{ textDecoration: 'underline', cursor: 'pointer', color: 'text.secondary' }}
          >
            자세히
          </Box>
        </Typography>
      </Box>

      {/* 개인정보 제 3자 제공 동의 약관 */}
      <Dialog open={termsOpen} onClose={() => setTermsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>개인정보 제 3자 제공 동의</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            (주)인싸이트는 상품을 구매하고자 할 경우 거래 당사자간 원활한 의사소통 및 배송, 상담 등 거래 이행을 위하여 판매자에게 아래와 같이 개인정보를 제공하고 있습니다. 아래의 내용을 확인 후 동의하여 주시기 바랍니다.
          </Typography>
          <TermsSection title="[필수] 제공 받는 자">{'(주)학지사\n(주)인싸이트'}</TermsSection>
          <TermsSection title="[필수] 제공 목적">{'주문 상품의 제공, 계약 이행\n고객 상담 및 불만, 민원 사무 처리'}</TermsSection>
          <TermsSection title="[필수] 제공 항목">
            구매자 정보(이름, 휴대폰번호, 배송지 주소, 인싸이트 아이디, 상품 구매정보)
          </TermsSection>
          <TermsSection title="[필수] 보유 및 이용 기간">{'상품 구매/배송/반품 서비스 처리 완료 후 180일간 보관 후 파기\n단, 관계 법령에 따라 일정 기간 보관해야 하는 항목은 해당 기간 보관 후 파기합니다.'}</TermsSection>
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 2 }}>
            필수적인 개인정보 수집 및 이용에 동의하지 않을 권리가 있습니다. 다만, 동의하지 않을 경우 서비스 이용이 제한됩니다.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setTermsOpen(false)}>확인</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrderReviewStep;
