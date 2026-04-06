import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, CircularProgress } from '@mui/material';
import { supabase } from '../supabaseClient';
import { STATUS_COLORS } from '../constants/orderStatus';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const fmt = (dateStr) => format(new Date(dateStr), 'M.d(E)', { locale: ko });

// status_history 배열에서 특정 상태의 가장 최근 시각 반환
const getStatusAt = (history, status) => {
  if (!Array.isArray(history)) return null;
  const entries = history.filter(h => h.status === status);
  return entries.length ? entries[entries.length - 1].changed_at : null;
};

// 상태별 배너 설정
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
          ? `지금 결제 시 ${fmt(edd)} 도착`
          : '담당자에게 카드를 건네어 결제를 완료해주세요.',
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

const OrderStatusPage = () => {
  const { token } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const { data, error: queryError } = await supabase
          .from('orders')
          .select(`
            id, customer_name, phone_number, shipping_address,
            final_payment, delivery_fee, status, created_at,
            customer_request, is_on_site_sale, status_history,
            events(name, estimated_delivery_date),
            order_items(quantity, price_at_purchase,
              products(name, category)
            )
          `)
          .eq('access_token', token)
          .single();

        if (queryError) throw queryError;
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

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', minHeight: '100dvh', bgcolor: 'background.default' }}>

      {/* 상태 배너 */}
      <Box sx={{ bgcolor: banner.color, px: 3, pt: 4, pb: 3.5, textAlign: 'center' }}>
        <Typography sx={{ fontSize: '2.5rem', mb: 1, lineHeight: 1 }}>{banner.icon}</Typography>
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 800, mb: 0.5 }}>
          {banner.label}
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', mb: 1.5, fontWeight: 500 }}>
          {banner.subMessage}
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
          {format(new Date(order.created_at), 'yyyy년 M월 d일 HH:mm 접수', { locale: ko })}
          {order.events?.name && ` · ${order.events.name}`}
        </Typography>
      </Box>

      <Box sx={{ px: 3, pt: 3 }}>
        {isCancelled ? (
          <>
            <SectionTitle>취소된 주문 상품</SectionTitle>
            <Box sx={{ bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: '12px', p: 2, mb: 4, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {order.order_items?.map((item, idx) => (
                <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1, mr: 2 }}>
                    <Typography variant="body2" sx={{ color: 'text.disabled', textDecoration: 'line-through' }}>
                      {item.products?.name}
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      {item.products?.category} · {item.quantity}개
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.disabled', whiteSpace: 'nowrap', textDecoration: 'line-through' }}>
                    {(item.price_at_purchase * item.quantity).toLocaleString()}원
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        ) : (
          <>
            {/* 주문 상품 */}
            <SectionTitle>주문 상품</SectionTitle>
            <Box sx={{ bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: '12px', p: 2, mb: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {order.order_items?.map((item, idx) => (
                <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1, mr: 2 }}>
                    <Typography variant="body2" sx={{ lineHeight: 1.4 }}>{item.products?.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.products?.category} · {item.quantity}개
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {(item.price_at_purchase * item.quantity).toLocaleString()}원
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* 결제 요약 */}
            <Box sx={{ bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: '12px', p: 2, mb: 3 }}>
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

export default OrderStatusPage;
