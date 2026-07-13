import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, CircularProgress, Chip, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { supabase } from '../supabaseClient';
import { STATUS_COLORS, STATUS_TO_KOREAN } from '../constants/orderStatus';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { InfoRow, PriceBlock } from './ui';

// 사양 시트: design-system/specs/A2_OrderStatusPage.md
// (= C3_OrderStatusPage.md 와 동일 화면. M3-11 시안 정합본.)

const fmt = (dateStr) => format(new Date(dateStr), 'M.d(E)', { locale: ko });

const getStatusAt = (history, status) => {
  if (!Array.isArray(history)) return null;
  const entries = history.filter(h => h.status === status);
  return entries.length ? entries[entries.length - 1].changed_at : null;
};

// 사양 §상단 상태 배너 — STATUS_COLORS 5종 보존. 현장구매(is_on_site_sale)는 edd 비표시(핵심 발견 #2).
const getBannerConfig = (order) => {
  const edd = !order.is_on_site_sale ? order.events?.estimated_delivery_date : null;
  const completedAt = getStatusAt(order.status_history, 'completed');

  switch (order.status) {
    case 'pending':
      return {
        icon: '⏳',
        label: STATUS_TO_KOREAN.pending,
        color: STATUS_COLORS.pending,
        subMessage: order.is_on_site_sale
          ? ['담당자를 통해 결제해 주세요.']
          : edd
            ? [`지금 결제 시 ${fmt(edd)} 도착`, '담당자를 통해 결제해 주세요.']
            : ['담당자를 통해 결제해 주세요.'],
      };
    case 'paid':
      return {
        icon: '📦',
        label: STATUS_TO_KOREAN.paid,
        color: STATUS_COLORS.paid,
        subMessage: order.is_on_site_sale
          ? '결제 완료 · 현장 수령 주문입니다'
          : edd ? `${fmt(edd)} 도착 예정` : '출고 준비 중입니다.',
      };
    case 'completed':
      return {
        icon: '🎉',
        label: STATUS_TO_KOREAN.completed,
        color: STATUS_COLORS.completed,
        subMessage: order.is_on_site_sale
          ? '현장 수령 완료'
          : completedAt ? `${fmt(completedAt)} 배송 출발` : '배송 출발',
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
      return {
        icon: '📋',
        label: order.status,
        color: null, // theme.gray[500] fallback — 렌더 시점에 결정
        subMessage: '',
      };
  }
};

const OrderStatusPage = () => {
  const theme = useTheme();
  const white = theme.palette.common.white;
  const { token } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const { data, error: rpcError } = await supabase
          .rpc('get_order_by_token', { p_token: token });

        if (rpcError) throw rpcError;
        if (!data) throw new Error('not found');

        // 새 shape: 토큰 주인 본인 주문 1건만 반환. 합배송이어도 형제 상세는 응답에 없음
        // (is_grouped / is_representative / representative_name 만 부가).
        setOrder(data);
      } catch {
        setError('주문을 찾을 수 없습니다.');
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchOrder();
  }, [token]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100dvh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !order) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100dvh', gap: 2, p: 4, textAlign: 'center' }}>
        {/* 사양 §빈 상태 — 미존재 이모지 3rem. 단일 시각 자리이므로 fontSize 유지(흡수표상 토큰 외 값 1건). */}
        <Typography sx={{ fontSize: '3rem' }} aria-hidden="true">❓</Typography>
        <Typography variant="h6">주문을 찾을 수 없습니다</Typography>
        <Typography variant="body2" color="text.secondary">
          링크가 올바른지 확인하거나 담당자에게 문의해주세요.
        </Typography>
      </Box>
    );
  }

  // 합배송이어도 본인 주문 1건만 표시. 상태 배너는 본인 order.status 기준.
  const banner = getBannerConfig(order);
  const bannerColor = banner.color || theme.gray[500];
  const isCancelled = ['cancelled', 'refunded'].includes(order.status);

  // 합배송 안내 문구 1줄 — 형제 정보는 표시하지 않고 대표자명만 노출.
  const isGrouped = order.is_grouped === true;
  const isRepresentative = order.is_representative === true;
  const hasAddress = Boolean(order.shipping_address?.address);
  let groupNotice = null;
  if (isGrouped) {
    if (isRepresentative) {
      groupNotice = hasAddress
        ? '주문하신 다른 분과 함께 회원님 주소로 배송됩니다.'
        : '주문하신 다른 분과 함께 처리됩니다.';
    } else if (order.representative_name) {
      groupNotice = `${order.representative_name} 님의 주소로 함께 보내드립니다.`;
    }
  }

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', minHeight: '100dvh', bgcolor: 'background.paper' }}>

      {/* 상태 배너 — bgcolor는 STATUS_COLORS 보존(사양 핵심 발견 #1). 흰 글씨 토큰화. */}
      <Box sx={{ bgcolor: bannerColor, px: 3, pt: 4, pb: 3.5, textAlign: 'center' }}>
        {/* 이모지는 장식 — aria-hidden. fontSize 2.5rem은 배너 단일 자리 시각 강조(흡수표상 토큰 외 값 1건). */}
        <Typography sx={{ fontSize: '2.5rem', mb: 1, lineHeight: 1 }} aria-hidden="true">{banner.icon}</Typography>
        <Typography variant="h6" sx={{ color: white, mb: 0.5 }}>
          {banner.label}
        </Typography>
        <Box sx={{ mb: 1.5 }}>
          {(Array.isArray(banner.subMessage) ? banner.subMessage : [banner.subMessage]).map((line, i) => (
            <Typography key={i} variant="body2" sx={{ color: alpha(white, 0.9) }}>
              {line}
            </Typography>
          ))}
        </Box>
        <Typography variant="caption" sx={{ color: alpha(white, 0.65) }}>
          {format(new Date(order.created_at), 'yyyy년 M월 d일 HH:mm 접수', { locale: ko })}
          {order.events?.name && ` · ${order.events.name}`}
        </Typography>
      </Box>

      <Box sx={{ px: 3, pt: 3 }}>
        {isCancelled ? (
          <>
            {/* 취소 분기 — 결제 요약·주문자 정보·요청사항 카드 숨김. 본인 주문 상품만. */}
            <SectionTitle>취소된 주문 상품</SectionTitle>
            <ItemsCard items={order.order_items} cancelled />
          </>
        ) : (
          <>
            {/* 본인 주문 — 합배송이어도 동일. 형제 정보는 표시하지 않음. */}
            <SectionTitle>주문 상품</SectionTitle>
            <ItemsCard items={order.order_items} />

            <Box sx={{ bgcolor: 'background.paper', border: `1px solid ${theme.palette.divider}`, borderRadius: `${theme.radii.md}px`, p: 2, mb: 3 }}>
              <PriceBlock
                rows={[
                  { label: '배송비', value: (order.delivery_fee ?? 0) === 0 ? '무료' : order.delivery_fee },
                ]}
                totalLabel="최종 결제금액"
                totalValue={order.final_payment}
                totalColor={bannerColor}
              />
            </Box>

            <SectionTitle>주문자 정보</SectionTitle>
            <Box sx={{ bgcolor: 'background.paper', border: `1px solid ${theme.palette.divider}`, borderRadius: `${theme.radii.md}px`, p: 2, mb: 3 }}>
              <InfoRow label="이름" value={order.customer_name} labelWidth={80} />
              <InfoRow label="연락처" value={order.phone_number} labelWidth={80} />
              {order.inpsyt_id && (
                <InfoRow label="인싸이트 ID" value={order.inpsyt_id} labelWidth={80} />
              )}
              {order.shipping_address?.address ? (
                <InfoRow
                  label="배송지"
                  value={`${order.shipping_address.address} ${order.shipping_address.detail || ''}`.trim()}
                  labelWidth={80}
                  multiline
                />
              ) : (
                <InfoRow label="배송" value="현장 수령" labelWidth={80} />
              )}
              {groupNotice && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  {groupNotice}
                </Typography>
              )}
            </Box>

            {order.customer_request && (
              <Box sx={{ bgcolor: 'background.paper', border: `1px solid ${theme.palette.divider}`, borderRadius: `${theme.radii.md}px`, p: 2, mb: 3 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>요청사항</Typography>
                <Typography variant="body2">{order.customer_request}</Typography>
              </Box>
            )}
          </>
        )}

        {/* 문의 푸터 */}
        <Box sx={{ textAlign: 'center', pb: 5 }}>
          <Typography variant="caption" color="text.disabled">
            문의사항이 있으신가요?{' '}
            <a href="mailto:inpsytorder@inpsyt.co.kr" style={{ color: 'inherit' }}>
              inpsytorder@inpsyt.co.kr
            </a>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

// SectionTitle — 시안 답습. overline variant(02 §타이포 — uppercase 0.6875rem 700 0.08em).
const SectionTitle = ({ children }) => (
  <Typography variant="overline" sx={{ color: 'text.secondary', display: 'block', mb: 1.25 }}>
    {children}
  </Typography>
);

// ItemsCard — 카테고리 색 칩 추가 금지(사양 핵심 발견 #4). 카테고리는 텍스트 캡션만.
const ItemsCard = ({ items, cancelled = false, chip }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: `${theme.radii.md}px`,
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
            borderRadius: `${theme.radii.xs}px`,
          }}
        />
      )}
      {items?.map((item, idx) => (
        <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={
                cancelled
                  ? { color: 'text.disabled', textDecoration: 'line-through', lineHeight: 1.4 }
                  : { lineHeight: 1.4 }
              }
            >
              {item.product_name || item.products?.name || '상품'}
            </Typography>
            {/* 카테고리 텍스트 캡션만 — 색 칩 사용 금지(사양 §발견 #4). */}
            <Typography
              variant="caption"
              color={cancelled ? 'text.disabled' : 'text.secondary'}
              sx={{ display: 'block', mt: 0.25 }}
            >
              {item.category || item.products?.category} · {item.quantity}개
            </Typography>
          </Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: cancelled ? 400 : 600,
              whiteSpace: 'nowrap',
              fontFeatureSettings: '"tnum" 1',
              ...(cancelled && { color: 'text.disabled', textDecoration: 'line-through' }),
            }}
          >
            {(item.price_at_purchase * item.quantity).toLocaleString()}원
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

export default OrderStatusPage;
