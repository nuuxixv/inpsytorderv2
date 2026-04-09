import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, CircularProgress, Chip } from '@mui/material';
import { supabase } from '../supabaseClient';
import { STATUS_COLORS } from '../constants/orderStatus';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const fmt = (dateStr) => format(new Date(dateStr), 'M.d(E)', { locale: ko });

const getStatusAt = (history, status) => {
  if (!Array.isArray(history)) return null;
  const entries = history.filter(h => h.status === status);
  return entries.length ? entries[entries.length - 1].changed_at : null;
};

const getBannerConfig = (order) => {
  const edd = !order.is_on_site_sale ? order.events?.estimated_delivery_date : null;
  const completedAt = getStatusAt(order.status_history, 'completed');

  switch (order.status) {
    case 'pending':
      return {
        icon: '⏳',
        label: '결제대기',
        color: STATUS_COLORS.pending,
        subMessage: edd
          ? [`지금 결제 시 ${fmt(edd)} 도착`, '담당자를 통해 결제해 주세요.']
          : ['담당자를 통해 결제해 주세요.'],
      };
    case 'paid':
      return {
        icon: '📦',
        label: '결제완료',
        color: STATUS_COLORS.paid,
        subMessage: edd ? `${fmt(edd)} 도착 예정` : '출고 준비 중입니다.',
      };
    case 'completed':
      return {
        icon: '🎉',
        label: '처리완료',
        color: STATUS_COLORS.completed,
        subMessage: completedAt ? `${fmt(completedAt)} 배송 출발` : '배송 출발',
      };
    case 'cancelled':
      return {
        icon: '❌',
        label: '주문취소',
        color: STATUS_COLORS.cancelled,
        subMessage: '결제 전 취소된 주문건입니다.',
      };
    case 'refunded':
      return {
        icon: '↩️',
        label: '결제취소',
        color: STATUS_COLORS.refunded,
        subMessage: '결제 취소된 주문건입니다.',
      };
    default:
      return {
        icon: '📋',
        label: order.status,
        color: '#8B95A1',
        subMessage: '',
      };
  }
};

const ORDER_ITEM_SELECT = `quantity, price_at_purchase, products(name, category)`;

const OrderStatusPage = () => {
  const { token } = useParams();
  const [order, setOrder] = useState(null);
  const [linkedOrder, setLinkedOrder] = useState(null); // parent 또는 child
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const { data, error: rpcError } = await supabase
          .rpc('get_order_by_token', { p_token: token });

        if (rpcError) throw rpcError;
        if (!data) throw new Error('not found');

        setOrder(data);

        // 연계 주문 처리
        if (data.parent_order) {
          setLinkedOrder({ role: 'parent', ...data.parent_order });
        } else if (data.child_orders?.length > 0) {
          setLinkedOrder({ role: 'child', ...data.child_orders[0] });
        }
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
        <Typography sx={{ fontSize: '3rem' }}>❓</Typography>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>주문을 찾을 수 없습니다</Typography>
        <Typography variant="body2" color="text.secondary">
          링크가 올바른지 확인하거나 담당자에게 문의해주세요.
        </Typography>
      </Box>
    );
  }

  const banner = getBannerConfig(order);
  const isCancelled = ['cancelled', 'refunded'].includes(order.status);

  // 연계 주문 구성: 현재 주문이 child면 parent가 1차, 현재가 2차
  // 현재 주문이 parent면 현재가 1차, child가 2차
  const isChild = !!order.parent_order_id;
  const firstOrder = isChild ? linkedOrder : order;
  const secondOrder = isChild ? order : linkedOrder;
  const hasLinked = !!linkedOrder;

  // 합산 결제금액 (연계 주문이 있을 때)
  const totalFinalPayment = hasLinked
    ? (order.final_payment ?? 0) + (linkedOrder.final_payment ?? 0)
    : order.final_payment;

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', minHeight: '100dvh', bgcolor: 'background.paper' }}>

      {/* 상태 배너 */}
      <Box sx={{ bgcolor: banner.color, px: 3, pt: 4, pb: 3.5, textAlign: 'center' }}>
        <Typography sx={{ fontSize: '2.5rem', mb: 1, lineHeight: 1 }}>{banner.icon}</Typography>
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 800, mb: 0.5 }}>
          {banner.label}
        </Typography>
        <Box sx={{ mb: 1.5 }}>
          {(Array.isArray(banner.subMessage) ? banner.subMessage : [banner.subMessage]).map((line, i) => (
            <Typography key={i} variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
              {line}
            </Typography>
          ))}
        </Box>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
          {format(new Date(order.created_at), 'yyyy년 M월 d일 HH:mm 접수', { locale: ko })}
          {order.events?.name && ` · ${order.events.name}`}
        </Typography>
      </Box>

      <Box sx={{ px: 3, pt: 3 }}>
        {isCancelled ? (
          <>
            <SectionTitle>취소된 주문 상품</SectionTitle>
            <ItemsCard items={order.order_items} cancelled />
          </>
        ) : (
          <>
            {/* 주문 상품 */}
            {hasLinked ? (
              <>
                <SectionTitle>1차 주문 상품</SectionTitle>
                <ItemsCard items={firstOrder?.order_items} />
                <SectionTitle>2차 주문 상품</SectionTitle>
                <ItemsCard items={secondOrder?.order_items} chip="추가 주문" />
              </>
            ) : (
              <>
                <SectionTitle>주문 상품</SectionTitle>
                <ItemsCard items={order.order_items} />
              </>
            )}

            {/* 결제 요약 */}
            <Box sx={{ bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: '12px', p: 2, mb: 3 }}>
              {hasLinked ? (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                    <Typography variant="body2" color="text.secondary">1차 결제금액</Typography>
                    <Typography variant="body2">
                      {(firstOrder?.final_payment ?? 0).toLocaleString()}원
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                    <Typography variant="body2" color="text.secondary">2차 결제금액</Typography>
                    <Typography variant="body2">
                      {(secondOrder?.final_payment ?? 0).toLocaleString()}원
                    </Typography>
                  </Box>
                  <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1, display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>합산 결제금액</Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: banner.color }}>
                      {totalFinalPayment.toLocaleString()}원
                    </Typography>
                  </Box>
                </>
              ) : (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                    <Typography variant="body2" color="text.secondary">배송비</Typography>
                    <Typography variant="body2">
                      {(order.delivery_fee ?? 0) === 0 ? '무료' : `${order.delivery_fee.toLocaleString()}원`}
                    </Typography>
                  </Box>
                  <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1, display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>최종 결제금액</Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: banner.color }}>
                      {order.final_payment?.toLocaleString()}원
                    </Typography>
                  </Box>
                </>
              )}
            </Box>

            {/* 주문자 정보 */}
            <SectionTitle>주문자 정보</SectionTitle>
            <Box sx={{ bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: '12px', p: 2, mb: 3, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {[
                { label: '이름', value: order.customer_name },
                { label: '연락처', value: order.phone_number },
                ...(order.shipping_address?.address
                  ? [{ label: '배송지', value: `${order.shipping_address.address} ${order.shipping_address.detail || ''}`.trim() }]
                  : [{ label: '배송', value: '현장 수령' }]
                ),
              ].map(({ label, value }) => (
                <Box key={label} sx={{ display: 'flex', gap: 2 }}>
                  <Typography variant="body2" sx={{ minWidth: 56, color: 'text.disabled', flexShrink: 0 }}>{label}</Typography>
                  <Typography variant="body2">{value}</Typography>
                </Box>
              ))}
            </Box>

            {/* 요청사항 */}
            {order.customer_request && (
              <Box sx={{ bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: '12px', p: 2, mb: 3 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25, fontWeight: 600 }}>요청사항</Typography>
                <Typography variant="body2">{order.customer_request}</Typography>
              </Box>
            )}
          </>
        )}

        {/* 문의 */}
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

const SectionTitle = ({ children }) => (
  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
    {children}
  </Typography>
);

const ItemsCard = ({ items, cancelled = false, chip }) => (
  <Box sx={{ bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: '12px', p: 2, mb: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
    {chip && (
      <Chip label={chip} size="small" sx={{ alignSelf: 'flex-start', mb: 0.5, bgcolor: 'primary.main', color: '#fff', fontWeight: 700, fontSize: '0.68rem', height: 20, borderRadius: '6px' }} />
    )}
    {items?.map((item, idx) => (
      <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1, mr: 2 }}>
          <Typography variant="body2" sx={cancelled ? { color: 'text.disabled', textDecoration: 'line-through' } : { lineHeight: 1.4 }}>
            {item.products?.name}
          </Typography>
          <Typography variant="caption" color={cancelled ? 'text.disabled' : 'text.secondary'}>
            {item.products?.category} · {item.quantity}개
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ fontWeight: cancelled ? 400 : 600, whiteSpace: 'nowrap', ...(cancelled && { color: 'text.disabled', textDecoration: 'line-through' }) }}>
          {(item.price_at_purchase * item.quantity).toLocaleString()}원
        </Typography>
      </Box>
    ))}
  </Box>
);

export default OrderStatusPage;
