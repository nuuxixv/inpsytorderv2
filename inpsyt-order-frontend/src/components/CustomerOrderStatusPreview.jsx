import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Chip, Stack, FormControlLabel, Switch, ToggleButton, ToggleButtonGroup, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { STATUS_COLORS, STATUS_TO_KOREAN } from '../constants/orderStatus';
import { InfoRow, PriceBlock } from './ui';

/**
 * DEV-ONLY: /preview/order-status
 * 고객 주문 상태 시안 — 모바일 393px 최적화, 어드민 셸 없이 직접 렌더.
 * 사양 시트: design-system/specs/A2_OrderStatusPage.md
 *
 * 인라인 mock 데이터, API 호출 0, Supabase 호출 0.
 * 변형 토글: 상태 5종 × 현장구매 on/off × 연계 주문 on/off
 */

// ─── Mock data ───────────────────────────────────────────────
const MOCK_EVENT = {
  name: '한국심리학회 2026 추계학술대회',
  estimated_delivery_date: '2026-09-23',
};

const MOCK_ORDER_BASE = {
  id: 12453,
  access_token: 'b7a3-mock-token-001',
  customer_name: '김건우',
  phone_number: '010-1234-5678',
  inpsyt_id: 'gwkim_inpsyt',
  shipping_address: {
    postcode: '04524',
    address: '서울특별시 중구 명동길 26',
    detail: '인싸이트빌딩 5층',
  },
  customer_request: '학회장에 도착 후 부스 운영자에게 연락 부탁드립니다.',
  delivery_fee: 0,
  final_payment: 89250,
  created_at: '2026-09-21T14:32:00+09:00',
  events: MOCK_EVENT,
  status_history: [
    { status: 'pending', changed_at: '2026-09-21T14:32:00+09:00' },
    { status: 'paid', changed_at: '2026-09-21T14:45:00+09:00' },
  ],
  parent_order_id: null,
  parent_order: null,
  child_orders: null,
  order_items: [
    { product_name: 'K-WAIS-IV 지능검사 프로토콜', category: '검사', quantity: 1, price_at_purchase: 38250 },
    { product_name: 'MMPI-2 전산채점 사용권', category: '검사', quantity: 1, price_at_purchase: 25500 },
    { product_name: '심리평가의 임상적 활용', category: '도서', quantity: 1, price_at_purchase: 25500 },
  ],
};

const MOCK_LINKED_SECOND = {
  id: 12471,
  final_payment: 32300,
  delivery_fee: 0,
  status: 'paid',
  order_items: [
    { product_name: 'DSM-5-TR 진단 및 통계편람', category: '도서', quantity: 1, price_at_purchase: 32300 },
  ],
};

// ─── Helpers ────────────────────────────────────────────────
const fmtEdd = (dateStr) => format(new Date(dateStr), 'M.d(E)', { locale: ko });
const fmtReceived = (dateStr) =>
  format(new Date(dateStr), 'yyyy년 M월 d일 HH:mm 접수', { locale: ko });

const getStatusAt = (history, status) => {
  if (!Array.isArray(history)) return null;
  const entries = history.filter((h) => h.status === status);
  return entries.length ? entries[entries.length - 1].changed_at : null;
};

const getBannerConfig = (order, theme) => {
  const edd = !order.is_on_site_sale ? order.events?.estimated_delivery_date : null;
  const completedAt = getStatusAt(order.status_history, 'completed');

  switch (order.status) {
    case 'pending':
      return {
        icon: '⏳',
        label: STATUS_TO_KOREAN.pending,
        color: STATUS_COLORS.pending,
        subMessage: edd
          ? [`지금 결제 시 ${fmtEdd(edd)} 도착`, '담당자를 통해 결제해 주세요.']
          : ['담당자를 통해 결제해 주세요.'],
      };
    case 'paid':
      return {
        icon: '📦',
        label: STATUS_TO_KOREAN.paid,
        color: STATUS_COLORS.paid,
        subMessage: edd ? `${fmtEdd(edd)} 도착 예정` : '출고 준비 중입니다.',
      };
    case 'completed':
      return {
        icon: '🎉',
        label: STATUS_TO_KOREAN.completed,
        color: STATUS_COLORS.completed,
        subMessage: completedAt ? `${fmtEdd(completedAt)} 배송 출발` : '배송 출발',
      };
    case 'cancelled':
      return {
        icon: '❌',
        label: STATUS_TO_KOREAN.cancelled,
        color: STATUS_COLORS.cancelled,
        subMessage: '결제 전 취소된 주문건입니다.',
      };
    case 'refunded':
      return {
        icon: '↩️',
        label: STATUS_TO_KOREAN.refunded,
        color: STATUS_COLORS.refunded,
        subMessage: '결제 취소된 주문건입니다.',
      };
    default:
      return { icon: '📋', label: order.status, color: theme.gray[500], subMessage: '' };
  }
};

// ─── Section title ──────────────────────────────────────────
const SectionTitle = ({ children }) => (
  <Typography
    variant="overline"
    sx={{ color: 'text.secondary', display: 'block', mb: 1.25 }}
  >
    {children}
  </Typography>
);

// ─── Items card ─────────────────────────────────────────────
const ItemsCard = ({ items, cancelled = false, chip }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: '12px',
        p: 2,
        mb: 3,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      {chip && (
        <Chip
          label={chip}
          size="small"
          sx={{
            alignSelf: 'flex-start',
            mb: 0.5,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            borderRadius: '6px',
          }}
        />
      )}
      {(!items || items.length === 0) && (
        <Typography variant="body2" color="text.disabled">
          표시할 상품이 없습니다.
        </Typography>
      )}
      {items?.map((item, idx) => (
        <Box
          key={idx}
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 2,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={
                cancelled
                  ? {
                      color: 'text.disabled',
                      textDecoration: 'line-through',
                      lineHeight: 1.4,
                    }
                  : { lineHeight: 1.4 }
              }
            >
              {item.product_name}
            </Typography>
            {/* 카테고리 텍스트 캡션만 — 색 칩 사용 금지 (사양 핵심 발견 #4) */}
            <Typography
              variant="caption"
              color={cancelled ? 'text.disabled' : 'text.secondary'}
              sx={{ display: 'block', mt: 0.25 }}
            >
              {item.category} · {item.quantity}개
            </Typography>
          </Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: cancelled ? 400 : 600,
              whiteSpace: 'nowrap',
              ...(cancelled && {
                color: 'text.disabled',
                textDecoration: 'line-through',
              }),
            }}
          >
            {(item.price_at_purchase * item.quantity).toLocaleString()}원
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

// ─── Dev variant toolbar (sticky) ───────────────────────────
const VariantToolbar = ({ status, setStatus, isOnSite, setIsOnSite, hasLinked, setHasLinked }) => {
  const theme = useTheme();
  const white = theme.palette.common.white;
  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        bgcolor: alpha(theme.palette.grey[900], 0.92),
        color: white,
        px: 2,
        py: 1.25,
        borderBottom: `1px solid ${alpha(white, 0.12)}`,
      }}
    >
      <Typography
        variant="caption"
        sx={{ color: alpha(white, 0.65), display: 'block', mb: 0.5 }}
      >
        DEV 변형 토글 (실 화면에는 없음)
      </Typography>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={status}
        onChange={(_, v) => v && setStatus(v)}
        sx={{
          flexWrap: 'wrap',
          gap: 0.5,
          mb: 1,
          '& .MuiToggleButton-root': {
            color: alpha(white, 0.8),
            border: `1px solid ${alpha(white, 0.25)}`,
            borderRadius: '8px !important',
            minHeight: 32,
            px: 1.25,
          },
          '& .MuiToggleButton-root.Mui-selected': {
            bgcolor: STATUS_COLORS[status] || theme.palette.primary.main,
            color: white,
            border: '1px solid transparent',
          },
        }}
      >
        {['pending', 'paid', 'completed', 'cancelled', 'refunded'].map((s) => (
          <ToggleButton key={s} value={s}>
            <Typography variant="caption" sx={{ color: 'inherit' }}>
              {STATUS_TO_KOREAN[s]}
            </Typography>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={isOnSite}
              onChange={(e) => setIsOnSite(e.target.checked)}
            />
          }
          label={
            <Typography variant="caption" sx={{ color: 'inherit' }}>
              현장구매
            </Typography>
          }
          sx={{ m: 0, color: white }}
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={hasLinked}
              onChange={(e) => setHasLinked(e.target.checked)}
            />
          }
          label={
            <Typography variant="caption" sx={{ color: 'inherit' }}>
              연계 주문(2차)
            </Typography>
          }
          sx={{ m: 0, color: white }}
        />
      </Stack>
    </Box>
  );
};

// ─── Status banner ──────────────────────────────────────────
const StatusBanner = ({ banner, receivedAt, eventName }) => {
  const theme = useTheme();
  const white = theme.palette.common.white;
  return (
  <Box sx={{ bgcolor: banner.color, px: 3, pt: 4, pb: 3.5, textAlign: 'center' }}>
    {/* status 배너 이모지 — 장식 아이콘(aria-hidden). 텍스트 토큰 아님 */}
    <Typography
      sx={{ fontSize: '2.5rem', mb: 1, lineHeight: 1 }}
      aria-hidden="true"
    >
      {banner.icon}
    </Typography>
    <Typography variant="h6" sx={{ color: white, mb: 0.5 }}>
      {banner.label}
    </Typography>
    <Box sx={{ mb: 1.5 }}>
      {(Array.isArray(banner.subMessage)
        ? banner.subMessage
        : [banner.subMessage]
      ).map((line, i) => (
        <Typography
          key={i}
          variant="body2"
          sx={{ color: alpha(white, 0.9) }}
        >
          {line}
        </Typography>
      ))}
    </Box>
    <Typography variant="caption" sx={{ color: alpha(white, 0.65) }}>
      {receivedAt}
      {eventName && ` · ${eventName}`}
    </Typography>
  </Box>
  );
};

// ─── Main ───────────────────────────────────────────────────
const CustomerOrderStatusPreview = () => {
  const theme = useTheme();
  const [status, setStatus] = useState('paid');
  const [isOnSite, setIsOnSite] = useState(false);
  const [hasLinked, setHasLinked] = useState(false);

  // Mock order with current variant flags applied
  const order = useMemo(() => {
    // 현장구매면 배송지 객체를 비워서 "현장 수령" 분기로 떨어지게 한다.
    // 또한 customer_request에 [현장구매] prefix를 박는다 (OrderPage.jsx:182 실제 동작과 동일).
    return {
      ...MOCK_ORDER_BASE,
      status,
      is_on_site_sale: isOnSite,
      shipping_address: isOnSite ? {} : MOCK_ORDER_BASE.shipping_address,
      customer_request: isOnSite
        ? `[현장구매] ${MOCK_ORDER_BASE.customer_request}`
        : MOCK_ORDER_BASE.customer_request,
    };
  }, [status, isOnSite]);

  const linkedOrder = hasLinked ? MOCK_LINKED_SECOND : null;
  const banner = getBannerConfig(order, theme);
  const isCancelled = ['cancelled', 'refunded'].includes(order.status);

  // 연계 주문 1차/2차 정렬 — mock은 현재 주문이 parent(1차), linked가 child(2차)
  const firstOrder = order;
  const secondOrder = linkedOrder;

  const totalFinalPayment = linkedOrder
    ? (order.final_payment ?? 0) + (linkedOrder.final_payment ?? 0)
    : order.final_payment;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: theme.palette.grey[100],
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <Box
        sx={{
          maxWidth: 480,
          width: '100%',
          bgcolor: 'background.paper',
          minHeight: '100dvh',
          position: 'relative',
        }}
      >
        <VariantToolbar
          status={status}
          setStatus={setStatus}
          isOnSite={isOnSite}
          setIsOnSite={setIsOnSite}
          hasLinked={hasLinked}
          setHasLinked={setHasLinked}
        />

        <StatusBanner
          banner={banner}
          receivedAt={fmtReceived(order.created_at)}
          eventName={order.events?.name}
        />

        <Box sx={{ px: 3, pt: 3 }}>
          {isCancelled ? (
            <>
              <SectionTitle>취소된 주문 상품</SectionTitle>
              <ItemsCard items={order.order_items} cancelled />
              {/* 사양 line 52: 취소 분기에서 결제 요약·주문자 정보·요청사항 카드는 모두 숨김 */}
            </>
          ) : (
            <>
              {/* 주문 상품 */}
              {linkedOrder ? (
                <>
                  <SectionTitle>1차 주문 상품</SectionTitle>
                  <ItemsCard items={firstOrder?.order_items} />
                  <SectionTitle>2차 주문 상품</SectionTitle>
                  <ItemsCard
                    items={secondOrder?.order_items}
                    chip="추가 주문"
                  />
                </>
              ) : (
                <>
                  <SectionTitle>주문 상품</SectionTitle>
                  <ItemsCard items={order.order_items} />
                </>
              )}

              {/* 결제 요약 — PriceBlock(가격 위계). 사양 핵심 발견 #1: 합계 색은 상태 배너 색을 따라감 */}
              <Box
                sx={{
                  bgcolor: 'background.paper',
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: '12px',
                  p: 2,
                  mb: 3,
                }}
              >
                {linkedOrder ? (
                  /* 사양 line 86: 연계 분기에는 배송비 행이 없음 */
                  <PriceBlock
                    rows={[
                      { label: '1차 결제금액', value: firstOrder?.final_payment ?? 0 },
                      { label: '2차 결제금액', value: secondOrder?.final_payment ?? 0 },
                    ]}
                    totalLabel="합산 결제금액"
                    totalValue={totalFinalPayment}
                    totalColor={banner.color}
                  />
                ) : (
                  /* 현장구매여도 배송비 행은 유지 — 실 페이지가 그렇게 동작함 (delivery_fee가 0이면 "무료") */
                  <PriceBlock
                    rows={[
                      {
                        label: '배송비',
                        value: (order.delivery_fee ?? 0) === 0 ? '무료' : order.delivery_fee,
                      },
                    ]}
                    totalLabel="최종 결제금액"
                    totalValue={order.final_payment}
                    totalColor={banner.color}
                  />
                )}
              </Box>

              {/* 주문자 정보 */}
              <SectionTitle>주문자 정보</SectionTitle>
              <Box
                sx={{
                  bgcolor: 'background.paper',
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: '12px',
                  p: 2,
                  mb: 3,
                }}
              >
                <InfoRow label="이름" value={order.customer_name} labelWidth={80} />
                <InfoRow label="연락처" value={order.phone_number} labelWidth={80} />
                {order.inpsyt_id && (
                  <InfoRow label="인싸이트 ID" value={order.inpsyt_id} labelWidth={80} />
                )}
                {/* 사양 line 98-100: 배송지 분기 — address 있으면 "배송지" + "address detail" 한 줄
                    없으면 "배송: 현장 수령". 우편번호는 표시 안 함(line 101). */}
                {order.shipping_address?.address ? (
                  <InfoRow
                    label="배송지"
                    value={`${order.shipping_address.address} ${
                      order.shipping_address.detail || ''
                    }`.trim()}
                    labelWidth={80}
                    multiline
                  />
                ) : (
                  <InfoRow label="배송" value="현장 수령" labelWidth={80} />
                )}
              </Box>

              {/* 요청사항 — customer_request 있을 때만 */}
              {order.customer_request && (
                <Box
                  sx={{
                    bgcolor: 'background.paper',
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: '12px',
                    p: 2,
                    mb: 3,
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mb: 0.5 }}
                  >
                    요청사항
                  </Typography>
                  <Typography variant="body2">
                    {order.customer_request}
                  </Typography>
                </Box>
              )}
            </>
          )}

          {/* 문의 푸터 */}
          <Box sx={{ textAlign: 'center', pb: 5 }}>
            <Typography variant="caption" color="text.disabled">
              문의사항이 있으신가요?{' '}
              <a
                href="mailto:inpsytorder@inpsyt.co.kr"
                style={{ color: 'inherit' }}
              >
                inpsytorder@inpsyt.co.kr
              </a>
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default CustomerOrderStatusPreview;
