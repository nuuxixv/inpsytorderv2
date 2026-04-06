import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Chip, CircularProgress, Divider,
  IconButton, Alert,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { supabase } from '../supabaseClient';
import { STATUS_TO_KOREAN, STATUS_COLORS } from '../constants/orderStatus';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const OrderStatusPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
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
            customer_request, is_on_site_sale,
            events(name),
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

  const statusColor = STATUS_COLORS[order.status] || '#8B95A1';
  const statusLabel = STATUS_TO_KOREAN[order.status] || order.status;
  const isPending = order.status === 'pending';

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', minHeight: '100dvh', bgcolor: 'background.paper' }}>
      {/* Header */}
      <Box sx={{ px: 2, pt: 3, pb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton onClick={() => navigate(-1)} size="small" sx={{ color: 'text.secondary' }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>주문 상세</Typography>
      </Box>

      <Box sx={{ px: 3 }}>
        {/* 상태 배너 */}
        <Box
          sx={{
            bgcolor: statusColor + '12',
            border: `1px solid ${statusColor}33`,
            borderRadius: '12px',
            p: 2.5,
            mb: 3,
            textAlign: 'center',
          }}
        >
          <Chip
            label={statusLabel}
            sx={{ bgcolor: statusColor, color: '#fff', fontWeight: 700, mb: 1 }}
          />
          <Typography variant="body2" color="text.secondary">
            {format(new Date(order.created_at), 'yyyy년 M월 d일 HH:mm 접수', { locale: ko })}
          </Typography>
          {order.events?.name && (
            <Typography variant="caption" color="text.secondary">
              {order.events.name}
            </Typography>
          )}
        </Box>

        {/* 결제 대기 안내 */}
        {isPending && (
          <Alert severity="info" sx={{ mb: 3, borderRadius: '12px' }}>
            담당자에게 카드를 건네어 결제를 완료해주세요.
          </Alert>
        )}

        {/* 주문자 정보 */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>주문자 정보</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 3 }}>
          {[
            { label: '이름', value: order.customer_name },
            { label: '연락처', value: order.phone_number },
            ...(order.shipping_address?.address
              ? [{ label: '배송지', value: `${order.shipping_address.address} ${order.shipping_address.detail || ''}`.trim() }]
              : [{ label: '배송', value: '현장 수령' }]
            ),
          ].map(({ label, value }) => (
            <Box key={label} sx={{ display: 'flex', gap: 2 }}>
              <Typography variant="body2" sx={{ minWidth: 52, color: 'text.disabled', flexShrink: 0 }}>{label}</Typography>
              <Typography variant="body2" color="text.primary">{value}</Typography>
            </Box>
          ))}
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* 주문 상품 */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>주문 상품</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
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

        <Divider sx={{ mb: 2 }} />

        {/* 결제 요약 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">배송비</Typography>
            <Typography variant="body2">
              {order.delivery_fee === 0 ? '무료' : `${order.delivery_fee?.toLocaleString()}원`}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>최종 결제금액</Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
              {order.final_payment?.toLocaleString()}원
            </Typography>
          </Box>
        </Box>

        {/* 요청사항 */}
        {order.customer_request && (
          <Box sx={{ bgcolor: 'grey.50', borderRadius: '8px', p: 2, mb: 3 }}>
            <Typography variant="caption" color="text.secondary">
              요청사항: {order.customer_request}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default OrderStatusPage;
