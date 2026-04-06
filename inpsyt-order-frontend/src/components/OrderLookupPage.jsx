import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Typography, TextField, Button, Card, CardContent,
  Chip, CircularProgress, Alert, IconButton,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import { supabase } from '../supabaseClient';
import { STATUS_TO_KOREAN, STATUS_COLORS } from '../constants/orderStatus';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const OrderLookupPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const eventSlug = searchParams.get('events');

  const [eventInfo, setEventInfo] = useState(null); // slug에서 resolve된 이벤트
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [orders, setOrders] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // slug가 있으면 이벤트 정보 조회 (이름 표시 + event_id 필터용)
  useEffect(() => {
    if (!eventSlug) return;
    supabase
      .from('events')
      .select('id, name')
      .eq('order_url_slug', eventSlug)
      .single()
      .then(({ data }) => { if (data) setEventInfo(data); });
  }, [eventSlug]);

  const formatPhone = (value) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  };

  const handleSearch = async () => {
    if (!name.trim() || !phone.trim()) {
      setError('이름과 연락처를 모두 입력해주세요.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select(`
          id, access_token, created_at, status, final_payment,
          events(name),
          order_items(quantity, products(name))
        `)
        .eq('customer_name', name.trim())
        .eq('phone_number', phone.trim())
        .order('created_at', { ascending: false });

      // 특정 학회 컨텍스트가 있으면 해당 이벤트만 필터
      if (eventInfo?.id) {
        query = query.eq('event_id', eventInfo.id);
      }

      const { data, error: queryError } = await query;
      if (queryError) throw queryError;
      setOrders(data || []);
    } catch {
      setError('조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const totalItems = (order) =>
    order.order_items?.reduce((sum, i) => sum + i.quantity, 0) || 0;

  return (
    <Box
      sx={{
        maxWidth: 480,
        mx: 'auto',
        minHeight: '100dvh',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <Box sx={{ px: 2, pt: 3, pb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton onClick={() => navigate(-1)} sx={{ color: 'text.secondary', p: '10px' }}>
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>주문내역 조회</Typography>
          {eventInfo && (
            <Typography variant="caption" color="text.secondary">{eventInfo.name}</Typography>
          )}
        </Box>
      </Box>

      <Box sx={{ px: 3, py: 1, flex: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.7 }}>
          {eventInfo
            ? `${eventInfo.name} 주문 시 입력하신 이름과 연락처로 조회합니다.`
            : '주문 시 입력하신 이름과 연락처로 조회합니다.'}
        </Typography>

        {/* 입력 폼 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
          <TextField
            label="이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            fullWidth
            autoComplete="name"
          />
          <TextField
            label="연락처"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            onKeyDown={handleKeyDown}
            fullWidth
            placeholder="010-1234-5678"
            inputProps={{ maxLength: 13 }}
          />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>{error}</Alert>
        )}

        <Button
          variant="contained"
          fullWidth
          size="large"
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
          onClick={handleSearch}
          disabled={loading}
          sx={{ borderRadius: '12px', minHeight: 48, mb: 3 }}
        >
          조회하기
        </Button>

        {/* 결과 */}
        {orders !== null && (
          orders.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5 }}>
              <Typography sx={{ fontSize: '2.5rem', mb: 1 }}>🔍</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                일치하는 주문을 찾을 수 없습니다
              </Typography>
              <Typography variant="caption" color="text.secondary">
                이름과 연락처를 다시 확인해주세요.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                {orders.length}건의 주문을 찾았습니다
              </Typography>
              {orders.map((order) => {
                const statusColor = STATUS_COLORS[order.status] || '#8B95A1';
                const statusLabel = STATUS_TO_KOREAN[order.status] || order.status;
                return (
                  <Card
                    key={order.id}
                    onClick={() => navigate(`/order/status/${order.access_token}`)}
                    sx={{
                      borderRadius: '12px',
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: 'divider',
                      boxShadow: 'none',
                      '&:hover': { boxShadow: 3, borderColor: 'primary.main' },
                      transition: 'all 0.15s',
                    }}
                  >
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.75 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {order.events?.name || '학회'}
                        </Typography>
                        <Chip
                          label={statusLabel}
                          size="small"
                          sx={{
                            bgcolor: statusColor + '22',
                            color: statusColor,
                            fontWeight: 700,
                            fontSize: '0.68rem',
                            height: 20,
                          }}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                          {format(new Date(order.created_at), 'yyyy.MM.dd HH:mm', { locale: ko })}
                          {' · '}
                          상품 {totalItems(order)}개
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main' }}>
                          {order.final_payment?.toLocaleString()}원
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          )
        )}
      </Box>
    </Box>
  );
};

export default OrderLookupPage;
