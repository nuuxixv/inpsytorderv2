import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
  Alert,
  Divider,
  Button,
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { getFulfillmentOrders, groupLinkedOrders } from '../api/orders';
import { getEvents } from '../api/events';
import { supabase } from '../supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';

// 주문 유형 판별
const classifyOrder = (orderItems) => {
  const cats = new Set((orderItems || []).map(i => i.products?.category));
  if (cats.has('도서') && cats.has('검사')) return 'mixed';
  if (cats.has('도서')) return 'book';
  if (cats.has('검사')) return 'test';
  return 'other';
};

// 뷰 모드별 주문 표시 여부
const isOrderVisible = (orderType, viewMode) => {
  if (viewMode === 'all') return true;
  if (viewMode === 'book') return orderType === 'book' || orderType === 'mixed';
  if (viewMode === 'test') return orderType === 'test' || orderType === 'mixed';
  return true;
};

// 주문 유형 배지 설정
const orderTypeBadge = {
  book:  { label: '도서전용', color: '#3B82F6' },
  test:  { label: '검사전용', color: '#6366F1' },
  mixed: { label: '혼합',     color: '#8B5CF6' },
  other: { label: '기타',     color: '#9CA3AF' },
};

// 상태 한글 매핑
const statusLabel = {
  pending:   '결제대기',
  paid:      '결제완료',
  completed: '처리완료',
  cancelled: '주문취소',
  refunded:  '결제취소',
};

// ─── 주문 카드 (좌측 목록) ───────────────────────────────────────────────────
const OrderCard = ({ order, isSelected, onClick }) => {
  const displayItems = order.mergedItems || order.order_items;
  const orderType = classifyOrder(displayItems);
  const badge = orderTypeBadge[orderType];
  const itemCount = (displayItems || []).length;
  const eventName = order.events?.name || '-';
  const isLinked = order.linkedChildren && order.linkedChildren.length > 0;

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 1,
        borderRadius: '12px',
        borderColor: isSelected ? 'primary.main' : 'divider',
        borderWidth: isSelected ? 2 : 1,
        boxShadow: isSelected ? '0 0 0 2px rgba(43,57,143,0.12)' : 'none',
        transition: 'all 0.15s ease',
      }}
    >
      <CardActionArea onClick={onClick} sx={{ borderRadius: '12px' }}>
        <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
            <Chip
              label={badge.label}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.625rem',
                fontWeight: 700,
                borderRadius: '6px',
                bgcolor: badge.color,
                color: '#fff',
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
            {isLinked && (
              <Chip
                label={`연계 ${order.linkedChildren.length + 1}건`}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  borderRadius: '6px',
                  bgcolor: '#F59E0B',
                  color: '#fff',
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            )}
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.3 }}>
            {order.customer_name}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
            {eventName} · {itemCount}개 상품
          </Typography>
          <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: 'primary.main', mt: 0.5 }}>
            {(order.mergedTotal ?? order.final_payment ?? 0).toLocaleString()}원
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

// ─── 주문 상세 (우측 패널) ──────────────────────────────────────────────────
const OrderDetail = ({ order, viewMode, onShip, canShip }) => {
  if (!order) {
    return (
      <Box sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'text.disabled',
        gap: 1,
      }}>
        <LocalShippingIcon sx={{ fontSize: 48, opacity: 0.3 }} />
        <Typography variant="body2">주문을 선택하면 상세 정보가 표시됩니다</Typography>
      </Box>
    );
  }

  const address = order.shipping_address;
  const addressText = address
    ? [
        address.address || address.roadAddress || address.jibunAddress || '',
        address.detailAddress || address.detail || '',
      ].filter(Boolean).join(' ') || '-'
    : '-';

  return (
    <Box sx={{ height: '100%', overflow: 'auto' }}>
      {/* 주문자 정보 */}
      <Card sx={{ borderRadius: '12px', boxShadow: 'none', border: '1px solid', borderColor: 'divider', mb: 2 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>
              {order.customer_name}
            </Typography>
            <Chip
              label={statusLabel[order.status] || order.status}
              size="small"
              color={order.status === 'paid' ? 'success' : 'default'}
              sx={{ fontWeight: 600, fontSize: '0.75rem' }}
            />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>연락처</Typography>
                <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{order.phone_number || '-'}</Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>결제금액</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: 'primary.main' }}>
                  {(order.mergedTotal ?? order.final_payment ?? 0).toLocaleString()}원
                </Typography>
              </Box>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>이메일</Typography>
              <Typography sx={{ fontWeight: 500, fontSize: '0.8125rem' }}>{order.email || '-'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>배송지</Typography>
              <Typography sx={{ fontWeight: 500, fontSize: '0.8125rem' }}>{addressText}</Typography>
            </Box>
            {order.customer_request && (
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>요청사항</Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>{order.customer_request}</Typography>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* 상품 목록 */}
      <Card sx={{ borderRadius: '12px', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', mb: 1.5 }}>상품 목록</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', px: 1, width: 28 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', px: 1 }}>상품명</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', px: 1, width: 52 }}>분류</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', px: 1, width: 64 }}>단가</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', px: 1, width: 40 }}>수량</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', px: 1, width: 72 }}>합계</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(order.mergedItems || order.order_items || []).map((item, idx) => {
                const category = item.products?.category;
                const productName = item.products?.name || '-';
                const isGreyed =
                  viewMode === 'book' ? category === '검사' :
                  viewMode === 'test' ? category === '도서' :
                  false;
                const subtotal = (item.price_at_purchase || 0) * (item.quantity || 0);

                return (
                  <TableRow
                    key={item.product_id || idx}
                    sx={{
                      opacity: isGreyed ? 0.35 : 1,
                      bgcolor: isGreyed ? 'grey.50' : 'inherit',
                      transition: 'opacity 0.2s',
                    }}
                  >
                    <TableCell sx={{ px: 1, py: 0.75, fontSize: '0.75rem', color: 'text.secondary' }}>{idx + 1}</TableCell>
                    <TableCell sx={{ px: 1, py: 0.75, fontSize: '0.8125rem', fontWeight: isGreyed ? 400 : 500 }}>
                      {productName}
                    </TableCell>
                    <TableCell align="center" sx={{ px: 1, py: 0.75 }}>
                      {category && (
                        <Chip
                          label={category}
                          size="small"
                          sx={{
                            height: 16,
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            borderRadius: '4px',
                            bgcolor: category === '검사' ? '#6366F1' : category === '도서' ? '#3B82F6' : '#9CA3AF',
                            color: '#fff',
                            '& .MuiChip-label': { px: 0.5 },
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ px: 1, py: 0.75, fontSize: '0.75rem' }}>
                      {(item.price_at_purchase || 0).toLocaleString()}
                    </TableCell>
                    <TableCell align="right" sx={{ px: 1, py: 0.75, fontSize: '0.875rem', fontWeight: 600 }}>
                      {item.quantity || 0}
                    </TableCell>
                    <TableCell align="right" sx={{ px: 1, py: 0.75, fontSize: '0.8125rem', fontWeight: 600 }}>
                      {subtotal.toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* 합계 */}
          <Divider sx={{ my: 1.5 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              {order.delivery_fee > 0 && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  배송비 {order.delivery_fee.toLocaleString()}원 포함
                </Typography>
              )}
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'primary.main' }}>
                합계 {(order.mergedTotal ?? order.final_payment ?? 0).toLocaleString()}원
              </Typography>
            </Box>
            {canShip && order.status === 'paid' && (
              <Button
                variant="contained"
                color="success"
                size="small"
                startIcon={<CheckCircleIcon />}
                onClick={() => onShip(order.id)}
                sx={{ borderRadius: '10px', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                출고 처리
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────
const FulfillmentPage = () => {
  const { hasPermission } = useAuth();
  const { addNotification } = useNotification();
  const [orders, setOrders] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [viewMode, setViewMode] = useState('all');
  const [filterEvent, setFilterEvent] = useState('');
  const [filterStatus] = useState('paid');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFulfillmentOrders({
        eventId: filterEvent || undefined,
        statuses: ['paid'],
      });
      setOrders(groupLinkedOrders(data || []));
      setSelectedOrder(null);
    } catch (err) {
      setError(err.message || '주문을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [filterEvent]);

  const handleShip = useCallback(async (orderId) => {
    const order = orders.find(o => o.id === orderId);
    const name = order?.customer_name || `#${orderId}`;
    try {
      const { error } = await supabase.from('orders').update({ status: 'completed' }).eq('id', orderId);
      if (error) throw error;
      addNotification(`${name}님의 주문이 출고 처리되었습니다.`, 'success');
      loadOrders();
    } catch (err) {
      addNotification(`출고 처리 실패: ${err.message}`, 'error');
    }
  }, [orders, addNotification, loadOrders]);

  useEffect(() => {
    getEvents().then(setEvents).catch(() => {});
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // 뷰 모드에 따라 주문 목록 필터링 (자식 주문은 부모에 병합되어 표시하지 않음)
  const filteredOrders = orders.filter(order => {
    if (order.parent_order_id) return false; // child orders hidden; merged into parent
    const orderType = classifyOrder(order.mergedItems || order.order_items);
    return isOrderVisible(orderType, viewMode);
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 상단 필터바 */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        mb: 2,
        flexWrap: 'wrap',
      }}>
        <LocalShippingIcon sx={{ color: 'primary.main', fontSize: '1.4rem' }} />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>출고 현황</Typography>

        {/* 학회 필터 */}
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>학회</InputLabel>
          <Select
            value={filterEvent}
            label="학회"
            onChange={e => setFilterEvent(e.target.value)}
          >
            <MenuItem value="">전체 학회</MenuItem>
            {events.map(ev => (
              <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 뷰 모드 토글 */}
        <Box sx={{ ml: 'auto' }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, val) => { if (val) setViewMode(val); }}
            size="small"
          >
            <ToggleButton value="all" sx={{ px: 2, fontWeight: 600, fontSize: '0.8rem' }}>전체</ToggleButton>
            <ToggleButton value="book" sx={{ px: 2, fontWeight: 600, fontSize: '0.8rem', color: '#3B82F6' }}>도서 뷰</ToggleButton>
            <ToggleButton value="test" sx={{ px: 2, fontWeight: 600, fontSize: '0.8rem', color: '#6366F1' }}>검사 뷰</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* 메인 패널 */}
      <Box sx={{ display: 'flex', gap: 2, flexGrow: 1, minHeight: 0 }}>
        {/* 좌측: 주문 목록 */}
        <Box sx={{
          width: { xs: '100%', md: 340 },
          flexShrink: 0,
          overflow: 'auto',
          display: { xs: selectedOrder ? 'none' : 'block', md: 'block' },
        }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
              <CircularProgress size={32} />
            </Box>
          ) : filteredOrders.length === 0 ? (
            <Box sx={{ textAlign: 'center', pt: 6, color: 'text.disabled' }}>
              <LocalShippingIcon sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
              <Typography variant="body2">해당 조건의 주문이 없습니다</Typography>
            </Box>
          ) : (
            <>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                {filteredOrders.length}건
              </Typography>
              {filteredOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  isSelected={selectedOrder?.id === order.id}
                  onClick={() => setSelectedOrder(order)}
                />
              ))}
            </>
          )}
        </Box>

        {/* 우측: 주문 상세 */}
        <Box sx={{
          flexGrow: 1,
          minWidth: 0,
          overflow: 'auto',
          display: { xs: selectedOrder ? 'block' : 'none', md: 'block' },
        }}>
          <OrderDetail
            order={selectedOrder}
            viewMode={viewMode}
            onShip={handleShip}
            canShip={hasPermission('orders:edit')}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default FulfillmentPage;
