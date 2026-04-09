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
  Tooltip,
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { getFulfillmentOrders, groupLinkedOrders } from '../api/orders';
import { getEvents } from '../api/events';
import { supabase } from '../supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';

// '도구' 카테고리를 '검사'로 정규화
const normalizeCategory = (cat) => {
  if (!cat) return cat;
  if (cat === '도구') return '검사';
  return cat;
};

// 주문 유형 판별
const classifyOrder = (orderItems) => {
  const cats = new Set((orderItems || []).map(i => normalizeCategory(i.products?.category)));
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

// 클립보드 복사 훅
const useCopyToClipboard = (addNotification) => useCallback(async (text, successMessage = '복사되었습니다.') => {
  if (!text || text === '-') return;

  try {
    await navigator.clipboard.writeText(text);
    addNotification(successMessage, 'info');
  } catch {
    addNotification('복사에 실패했습니다.', 'error');
  }
}, [addNotification]);

// 복사 가능한 텍스트 컴포넌트
const CopyableText = ({ value, sx = {}, onCopy, tooltip = '클릭하여 복사' }) => {
  if (!value || value === '-') {
    return <Typography sx={{ fontSize: '0.8125rem', color: 'text.disabled', ...sx }}>-</Typography>;
  }
  return (
    <Tooltip title={tooltip} placement="top" arrow>
      <Typography
        sx={{
          fontSize: '0.8125rem',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          borderRadius: 1,
          px: 0.5,
          mx: -0.5,
          transition: 'background 0.15s',
          '&:hover': { bgcolor: 'action.hover' },
          '&:active': { bgcolor: 'action.selected' },
          ...sx,
        }}
        onClick={() => {
          if (onCopy) onCopy(value);
        }}
        data-copy={value}
      >
        {value}
        <ContentCopyIcon sx={{ fontSize: '0.7rem', color: 'text.disabled', flexShrink: 0 }} />
      </Typography>
    </Tooltip>
  );
};

// ─── 주문 카드 (좌측 목록) ───────────────────────────────────────────────────
const OrderCard = ({ order, isSelected, onClick }) => {
  const displayItems = order.mergedItems || order.order_items;
  const orderType = classifyOrder(displayItems);
  const badge = orderTypeBadge[orderType];
  const itemCount = (displayItems || []).length;
  const eventName = order.events?.name || '-';
  const isLinked = order.linkedChildren && order.linkedChildren.length > 0;
  const isCompleted = order.status === 'completed';

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
        opacity: isCompleted ? 0.7 : 1,
      }}
    >
      <CardActionArea onClick={onClick} sx={{ borderRadius: '12px' }}>
        <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, flexWrap: 'wrap' }}>
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
            {isCompleted && (
              <Chip
                label="출고처리"
                size="small"
                icon={<CheckCircleIcon sx={{ fontSize: '0.7rem !important', color: '#fff !important' }} />}
                sx={{
                  height: 18,
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  borderRadius: '6px',
                  bgcolor: '#10B981',
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
const OrderDetail = ({ order, viewMode, onShip, canShip, addNotification }) => {
  const copyToClipboard = useCopyToClipboard(addNotification);

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
  const roadAddress = address
    ? address.address || address.roadAddress || address.jibunAddress || '-'
    : '-';
  const detailAddress = address
    ? address.detailAddress || address.detail || '-'
    : '-';
  const addressParts = address
    ? [
        address.postcode ? `[${address.postcode}]` : '',
        roadAddress !== '-' ? roadAddress : '',
        detailAddress !== '-' ? detailAddress : '',
      ].filter(Boolean).join(' ') || '-'
    : '-';

  return (
    <Box sx={{ height: '100%', overflow: 'auto' }}>
      {/* 주문자 정보 */}
      <Card sx={{ borderRadius: '12px', boxShadow: 'none', border: '1px solid', borderColor: 'divider', mb: 2 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <CopyableText
              value={order.customer_name}
              sx={{ fontWeight: 700, fontSize: '1rem' }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={statusLabel[order.status] || order.status}
                size="small"
                color={order.status === 'paid' ? 'success' : order.status === 'completed' ? 'default' : 'default'}
                sx={{ fontWeight: 600, fontSize: '0.75rem' }}
              />
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
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>연락처</Typography>
                <CopyableText value={order.phone_number || '-'} sx={{ fontWeight: 600 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>결제금액</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: 'primary.main' }}>
                  {(order.mergedTotal ?? order.final_payment ?? 0).toLocaleString()}원
                </Typography>
              </Box>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>배송지</Typography>
              {addressParts === '-' ? (
                <Typography sx={{ fontSize: '0.8125rem', color: 'text.disabled' }}>-</Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    우편번호는 제외됩니다.
                  </Typography>
                  <CopyableText
                    value={roadAddress}
                    sx={{ fontWeight: 500 }}
                    tooltip="도로명주소만 복사"
                    onCopy={(value) => copyToClipboard(value, '도로명주소를 복사했습니다.')}
                  />
                  <CopyableText
                    value={detailAddress}
                    sx={{ fontWeight: 500 }}
                    tooltip="상세주소만 복사"
                    onCopy={(value) => copyToClipboard(value, '상세주소를 복사했습니다.')}
                  />
                </Box>
              )}
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>요청사항</Typography>
              <CopyableText
                value={order.customer_request || '-'}
                sx={{ color: order.customer_request ? 'text.primary' : 'text.disabled' }}
                onCopy={(value) => copyToClipboard(value, '요청사항을 복사했습니다.')}
              />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>관리자 메모</Typography>
              <CopyableText
                value={order.admin_memo || '-'}
                sx={{ color: order.admin_memo ? 'text.primary' : 'text.disabled' }}
                onCopy={(value) => copyToClipboard(value, '관리자 메모를 복사했습니다.')}
              />
            </Box>
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
                const rawCategory = item.products?.category;
                const category = normalizeCategory(rawCategory);
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
                          label={rawCategory}
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadOrders = useCallback(async (preserveSelectedId) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFulfillmentOrders({
        eventId: filterEvent || undefined,
        statuses: ['paid', 'completed'],
      });
      const grouped = groupLinkedOrders(data || []);
      setOrders(grouped);
      // 선택된 주문 유지: 새로운 데이터에서 동일 ID를 찾아 업데이트
      if (preserveSelectedId) {
        const updated = grouped.find(o => o.id === preserveSelectedId);
        setSelectedOrder(updated || null);
      } else {
        setSelectedOrder(null);
      }
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
      loadOrders(orderId); // 선택 유지
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

  const filteredOrders = orders.filter(order => {
    if (order.parent_order_id) return false;
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
                {filteredOrders.filter(o => o.status === 'paid').length}건 대기 · {filteredOrders.filter(o => o.status === 'completed').length}건 출고완료
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
            addNotification={addNotification}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default FulfillmentPage;
