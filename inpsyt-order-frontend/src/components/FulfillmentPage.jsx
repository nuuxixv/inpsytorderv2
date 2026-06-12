import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
  Alert,
  Button,
  Tooltip,
  IconButton,
  Checkbox,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FilterListIcon from '@mui/icons-material/FilterList';
import PersonIcon from '@mui/icons-material/Person';
import PhoneIcon from '@mui/icons-material/Phone';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { getFulfillmentOrders, groupLinkedOrders } from '../api/orders';
import { getEvents } from '../api/events';
import { supabase } from '../supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { PageHeader, SectionCard, StatusBadge, InfoRow, ActionSlot, EmptyState } from './ui';
import { CATEGORY_COLORS, CATEGORY_KEY_BY_LABEL } from '../constants/categoryColors';

// '도구' 카테고리를 '검사'로 정규화 (운영 모델: 도구는 검사와 함께 출고)
const normalizeCategory = (cat) => {
  if (!cat) return cat;
  if (cat === '도구') return '검사';
  return cat;
};

// 한글 라벨 → 영문 키. '도구'는 normalize 단계에서 '검사'로 흡수되므로 test로 매핑.
const categoryKey = (rawCategory) => {
  const norm = normalizeCategory(rawCategory);
  if (norm === '도서') return 'book';
  if (norm === '검사') return 'test';
  return CATEGORY_KEY_BY_LABEL[norm] || 'tool';
};

// 주문 유형 판별
const classifyOrder = (orderItems) => {
  const cats = new Set((orderItems || []).map(i => normalizeCategory(i.category || i.products?.category)));
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

// ─── 단축 복사 버튼 (사양 line 75: 5종 복사) ──────────────────────────────────
const CopyIconButton = ({ tooltip, icon, onClick }) => {
  const theme = useTheme();
  return (
    <Tooltip title={tooltip} placement="top" arrow>
      <IconButton
        size="small"
        onClick={onClick}
        sx={{
          width: 44,
          height: 44,
          borderRadius: `${theme.radii.sm}px`,
          color: theme.gray[600],
          border: `1px solid ${theme.gray[200]}`,
          bgcolor: 'background.paper',
          cursor: 'copy',
          transition: `all 0.15s ${theme.easing.toss}`,
          '&:hover': {
            bgcolor: alpha(theme.palette.primary.main, 0.06),
            borderColor: alpha(theme.palette.primary.main, 0.3),
            color: theme.palette.primary.main,
          },
        }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
};

// ─── 그룹 카드 (시안 FulfillmentGroupCard 정합) ──────────────────────────────
const FulfillmentGroupCard = ({
  order,
  eventName,
  viewMode,
  selected,
  onSelectToggle,
  onCopy,
  onShip,
  canShip,
}) => {
  const theme = useTheme();

  const displayItems = order.mergedItems || order.order_items || [];
  const itemCount = displayItems.length;
  const isLinked = order.linkedChildren && order.linkedChildren.length > 0;
  const linkedCount = isLinked ? order.linkedChildren.length + 1 : 0;
  const isCompleted = order.status === 'completed';
  const mergedTotal = order.mergedTotal ?? order.final_payment ?? 0;

  const address = order.shipping_address;
  const roadAddress = address
    ? address.address || address.roadAddress || address.jibunAddress || ''
    : '';
  const detailAddress = address
    ? address.detailAddress || address.detail || ''
    : '';
  const postcode = address?.postcode || '';

  const requestNote = order.customer_request?.trim();
  const adminMemo = order.admin_memo?.trim();

  return (
    <SectionCard
      padding={0}
      sx={{
        mb: 2,
        position: 'relative',
        opacity: isCompleted ? 0.7 : 1,
      }}
    >
      {/* 그룹 헤더 */}
      <Box
        sx={{
          px: 3,
          py: 2,
          borderBottom: `1px solid ${theme.gray[100]}`,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        {canShip && (
          <Box
            onClick={(e) => { e.stopPropagation(); onSelectToggle(); }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              ml: -1,
              cursor: 'pointer',
            }}
          >
            <Checkbox checked={selected} size="small" sx={{ p: 0 }} />
          </Box>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, gap: 0.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography variant="subtitle1" sx={{ color: 'text.primary' }}>
              {order.customer_name}
            </Typography>
            <StatusBadge value={order.status} size="sm" />
            {isLinked && (
              <Chip
                label={`연계 ${linkedCount}건`}
                size="small"
                sx={{
                  bgcolor: alpha(theme.palette.warning.main, 0.1),
                  color: theme.palette.warning.dark,
                  border: `1px solid ${alpha(theme.palette.warning.main, 0.25)}`,
                }}
              />
            )}
            {isCompleted && (
              <Chip
                icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                label="출고처리 완료"
                size="small"
                sx={{
                  bgcolor: alpha(theme.status.paid, 0.1),
                  color: theme.status.paid,
                  border: `1px solid ${alpha(theme.status.paid, 0.25)}`,
                  '& .MuiChip-icon': { color: theme.status.paid, ml: 0.5 },
                }}
              />
            )}
            <Typography
              variant="subtitle1"
              sx={{
                color: 'text.primary',
                fontFeatureSettings: '"tnum" 1',
                ml: 'auto',
              }}
            >
              {mergedTotal.toLocaleString()}원
            </Typography>
          </Box>
          {eventName && (
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                letterSpacing: '-0.005em',
              }}
            >
              {eventName} · {itemCount}개 상품
            </Typography>
          )}
        </Box>
      </Box>

      {/* 데이터 라인 — 사양 line 36-50 정합 */}
      {/* 주소 도로명·상세·우편번호 3줄 분리 표시 (사양 핵심 발견 #1) */}
      <Box sx={{ px: 3, py: 1.5, borderBottom: `1px solid ${theme.gray[100]}` }}>
        <InfoRow
          label="연락처"
          value={order.phone_number || '-'}
          onCopy={order.phone_number ? () => onCopy('연락처', order.phone_number) : undefined}
          muted={!order.phone_number}
          mono
        />
        {order.inpsyt_id && (
          <InfoRow
            label="ID"
            value={order.inpsyt_id}
            onCopy={() => onCopy('인싸이트 ID', order.inpsyt_id)}
            mono
          />
        )}
        <InfoRow
          label="도로명"
          value={
            roadAddress ? (
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap' }}>
                {postcode && (
                  <Box
                    component="span"
                    sx={(t) => ({
                      ...t.typography.caption,
                      color: t.palette.text.secondary,
                      fontFeatureSettings: '"tnum" 1',
                    })}
                  >
                    [{postcode}]
                  </Box>
                )}
                <Box component="span">{roadAddress}</Box>
              </Box>
            ) : '-'
          }
          onCopy={roadAddress ? () => onCopy('도로명주소', roadAddress) : undefined}
          muted={!roadAddress}
          multiline
        />
        <InfoRow
          label="상세"
          value={detailAddress || '-'}
          onCopy={detailAddress ? () => onCopy('상세주소', detailAddress) : undefined}
          muted={!detailAddress}
          multiline
        />
        <InfoRow
          label="요청"
          value={requestNote || '-'}
          onCopy={requestNote ? () => onCopy('요청사항', requestNote) : undefined}
          muted={!requestNote}
          multiline
        />
        <InfoRow
          label="메모"
          value={adminMemo || '-'}
          onCopy={adminMemo ? () => onCopy('관리자 메모', adminMemo) : undefined}
          muted={!adminMemo}
          multiline
        />
      </Box>

      {/* 액션 행 (단축 복사 + 출고 처리) */}
      <ActionSlot
        sx={{
          px: 3,
          py: 1.25,
          bgcolor: theme.gray[50],
          borderBottom: `1px solid ${theme.gray[100]}`,
        }}
        leading={
          <>
            <Typography variant="subtitle2" sx={{ color: 'text.secondary', mr: 0.5 }}>
              단축 복사
            </Typography>
            <CopyIconButton
              tooltip={`이름 복사 — ${order.customer_name}`}
              icon={<PersonIcon sx={{ fontSize: 18 }} />}
              onClick={() => onCopy('이름', order.customer_name)}
            />
            {order.phone_number && (
              <CopyIconButton
                tooltip={`연락처 복사 — ${order.phone_number}`}
                icon={<PhoneIcon sx={{ fontSize: 18 }} />}
                onClick={() => onCopy('연락처', order.phone_number)}
              />
            )}
            {order.inpsyt_id && (
              <CopyIconButton
                tooltip={`인싸이트 ID 복사 — ${order.inpsyt_id}`}
                icon={<BadgeOutlinedIcon sx={{ fontSize: 18 }} />}
                onClick={() => onCopy('인싸이트 ID', order.inpsyt_id)}
              />
            )}
            {roadAddress && (
              <CopyIconButton
                tooltip={`도로명주소 복사 (우편번호 제외) — ${roadAddress}`}
                icon={<LocationOnIcon sx={{ fontSize: 18 }} />}
                onClick={() => onCopy('도로명주소', roadAddress)}
              />
            )}
          </>
        }
      >
        {canShip && order.status === 'paid' && (
          <Button
            size="small"
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
            onClick={() => onShip(order.id)}
          >
            출고 처리
          </Button>
        )}
      </ActionSlot>

      {/* 상품 목록 — 사양 핵심 발견 #2: 분류 칩 필수 */}
      <Box>
        {displayItems.map((item, idx) => {
          const rawCategory = item.category || item.products?.category;
          const catKey = categoryKey(rawCategory);
          const catColor = CATEGORY_COLORS[catKey] || theme.gray[500];
          const productName = item.product_name || item.products?.name || '-';
          // 뷰 모드별 그레이드 (사양 line 61)
          const normalized = normalizeCategory(rawCategory);
          const isGreyed =
            viewMode === 'book' ? normalized === '검사' :
            viewMode === 'test' ? normalized === '도서' :
            false;
          const subtotal = (item.price_at_purchase || 0) * (item.quantity || 0);
          const isLast = idx === displayItems.length - 1;

          return (
            <Box
              key={`${order.id}-${item.product_id || idx}`}
              sx={{
                display: 'grid',
                gridTemplateColumns: 'minmax(160px, 2.5fr) 64px minmax(80px, 1fr) 48px minmax(80px, 1fr)',
                alignItems: 'center',
                gap: 2,
                px: 3,
                py: 1.5,
                minHeight: 56,
                borderBottom: isLast ? 'none' : `1px solid ${theme.gray[50]}`,
                opacity: isGreyed ? 0.35 : 1,
                bgcolor: isGreyed ? theme.gray[50] : 'inherit',
                transition: `all 0.15s ${theme.easing.toss}`,
                '&:hover': isGreyed ? {} : { bgcolor: theme.gray[50] },
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{
                  color: 'text.primary',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {productName}
              </Typography>
              <Box>
                {rawCategory && (
                  <StatusBadge
                    kind="category"
                    value={catKey}
                    label={rawCategory}
                    size="sm"
                    sx={{ borderColor: alpha(catColor, 0.35), color: catColor }}
                  />
                )}
              </Box>
              <Typography
                variant="body2"
                sx={{
                  textAlign: 'right',
                  color: 'text.secondary',
                  fontFeatureSettings: '"tnum" 1',
                }}
              >
                {(item.price_at_purchase || 0).toLocaleString()}원
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  textAlign: 'right',
                  color: 'text.secondary',
                  fontFeatureSettings: '"tnum" 1',
                }}
              >
                ×{item.quantity || 0}
              </Typography>
              <Typography
                variant="subtitle2"
                sx={{
                  textAlign: 'right',
                  color: 'text.primary',
                  fontFeatureSettings: '"tnum" 1',
                }}
              >
                {subtotal.toLocaleString()}원
              </Typography>
            </Box>
          );
        })}
      </Box>

      {/* 합계 영역 (배송비 + 합계) — 사양 line 62 */}
      {order.delivery_fee > 0 && (
        <Box
          sx={{
            px: 3,
            py: 1.25,
            borderTop: `1px solid ${theme.gray[100]}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 2,
          }}
        >
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            배송비 {order.delivery_fee.toLocaleString()}원 포함
          </Typography>
        </Box>
      )}
    </SectionCard>
  );
};

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────
const FulfillmentPage = () => {
  const { hasPermission } = useAuth();
  const { addNotification } = useNotification();
  const [orders, setOrders] = useState([]);
  const [events, setEvents] = useState([]);
  const [viewMode, setViewMode] = useState('all');
  const [filterEvent, setFilterEvent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  const canShip = hasPermission('orders:edit');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFulfillmentOrders({
        eventId: filterEvent || undefined,
        statuses: ['paid', 'completed'],
      });
      const grouped = groupLinkedOrders(data || []);
      setOrders(grouped);
    } catch (err) {
      setError(err.message || '주문을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [filterEvent]);

  const handleCopy = useCallback(async (label, value) => {
    if (!value || value === '-') return;
    try {
      await navigator.clipboard.writeText(value);
      addNotification(`${label}을(를) 복사했습니다.`, 'info');
    } catch {
      addNotification('복사에 실패했습니다.', 'error');
    }
  }, [addNotification]);

  const handleShip = useCallback(async (orderId) => {
    const order = orders.find(o => o.id === orderId);
    const name = order?.customer_name || `#${orderId}`;
    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'completed' })
        .eq('id', orderId);
      if (updateError) throw updateError;
      addNotification(`${name}님의 주문이 출고 처리되었습니다.`, 'success');
      loadOrders();
    } catch (err) {
      addNotification(`출고 처리 실패: ${err.message}`, 'error');
    }
  }, [orders, addNotification, loadOrders]);

  const handleBulkShip = useCallback(async () => {
    if (selectedIds.length === 0) return;
    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'completed' })
        .in('id', selectedIds);
      if (updateError) throw updateError;
      addNotification(`${selectedIds.length}개 주문이 일괄 출고 처리되었습니다.`, 'success');
      setSelectedIds([]);
      loadOrders();
    } catch (err) {
      addNotification(`일괄 출고 처리 실패: ${err.message}`, 'error');
    }
  }, [selectedIds, addNotification, loadOrders]);

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  useEffect(() => {
    getEvents().then(setEvents).catch(() => {});
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filteredOrders = useMemo(() => orders.filter(order => {
    if (order.parent_order_id) return false;
    const orderType = classifyOrder(order.mergedItems || order.order_items);
    return isOrderVisible(orderType, viewMode);
  }), [orders, viewMode]);

  const pendingCount = filteredOrders.filter(o => o.status === 'paid').length;
  const completedCount = filteredOrders.filter(o => o.status === 'completed').length;
  const totalCount = filteredOrders.length;

  // 선택된 ID 중 실제로 paid 상태인 건만 일괄 처리 대상
  const selectablePaidIds = filteredOrders.filter(o => o.status === 'paid').map(o => o.id);
  const eligibleSelectedIds = selectedIds.filter(id => selectablePaidIds.includes(id));

  const headerAction = (
    <Box sx={{ display: 'flex', gap: 1 }}>
      {canShip && (
        <Button
          size="small"
          variant="contained"
          startIcon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
          disabled={eligibleSelectedIds.length === 0}
          onClick={handleBulkShip}
        >
          출고 완료 처리
          {eligibleSelectedIds.length > 0 && ` (${eligibleSelectedIds.length})`}
        </Button>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="출고 현황"
        subtitle={loading ? '' : `총 ${totalCount}건 · 대기 ${pendingCount}건 · 완료 ${completedCount}건`}
        icon={LocalShippingIcon}
        action={headerAction}
      />

      {/* 필터 영역 */}
      <SectionCard sx={{ mb: 3 }} padding={20}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <FilterListIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>
            필터
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 200, flex: '0 1 240px' }}>
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

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              뷰 모드
            </Typography>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, val) => { if (val) setViewMode(val); }}
              size="small"
            >
              <ToggleButton value="all" sx={{ px: 2 }}>전체</ToggleButton>
              <ToggleButton
                value="book"
                sx={{
                  px: 2,
                  color: CATEGORY_COLORS.book,
                  '&.Mui-selected': { color: CATEGORY_COLORS.book },
                }}
              >
                도서 뷰
              </ToggleButton>
              <ToggleButton
                value="test"
                sx={{
                  px: 2,
                  color: CATEGORY_COLORS.test,
                  '&.Mui-selected': { color: CATEGORY_COLORS.test },
                }}
              >
                검사 뷰
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>
      </SectionCard>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* 그룹 카드 리스트 */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={32} />
        </Box>
      ) : filteredOrders.length === 0 ? (
        <SectionCard padding={0}>
          <EmptyState
            icon={LocalShippingIcon}
            title="해당 조건의 주문이 없습니다"
            description="학회 필터 또는 뷰 모드를 변경해 보세요"
          />
        </SectionCard>
      ) : (
        <Box>
          {filteredOrders.map(order => (
            <FulfillmentGroupCard
              key={order.id}
              order={order}
              eventName={order.events?.name}
              viewMode={viewMode}
              selected={selectedIds.includes(order.id)}
              onSelectToggle={() => toggleSelect(order.id)}
              onCopy={handleCopy}
              onShip={handleShip}
              canShip={canShip}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default FulfillmentPage;
