import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, Checkbox, OutlinedInput, ListItemText, Pagination, Menu, Divider,
  IconButton, Tooltip, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ShoppingCart as CartIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  RestartAlt as RestartAltIcon,
  KeyboardArrowDown as ArrowDownIcon,
  Add as AddIcon,
  FileDownload as DownloadIcon,
  Close as CloseIcon,
  ChevronRight as ChevronRightIcon,
  Event as EventIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { PageHeader, SectionCard, StatusChip } from './ui';
import PreviewShell from './preview/PreviewShell';
import { STATUS_TO_KOREAN } from '../constants/orderStatus';

/**
 * DEV-ONLY keystone: /preview/orders.
 * 주문관리 디자인 시안 — 실제 로직/API는 OrderManagementPage.jsx 참고.
 */

const MOCK_EVENTS = [
  { id: 'e1', name: '2026년 한국심리학회 연차학술대회' },
  { id: 'e2', name: '2026 한국임상심리학회 봄학술대회' },
  { id: 'e3', name: '2026 한국상담심리학회 연차대회' },
];

const MOCK_ORDERS = [
  { id: 20264107, customer_name: '김현수', event_id: 'e1', final_payment: 245000, status: 'paid', created_at: '2026-04-20T10:24:00', item_count: 3 },
  { id: 20264106, customer_name: '이정민', event_id: 'e1', final_payment: 89000, status: 'pending', created_at: '2026-04-20T10:18:00', item_count: 1 },
  { id: 20264105, customer_name: '박지훈', event_id: 'e2', final_payment: 412000, status: 'completed', created_at: '2026-04-20T09:55:00', item_count: 5 },
  { id: 20264104, customer_name: '최서연', event_id: 'e1', final_payment: 178000, status: 'completed', created_at: '2026-04-20T09:42:00', item_count: 2 },
  { id: 20264103, customer_name: '정다은', event_id: 'e3', final_payment: 64000, status: 'refunded', created_at: '2026-04-20T09:30:00', item_count: 1 },
  { id: 20264102, customer_name: '강민호', event_id: 'e1', final_payment: 356000, status: 'paid', created_at: '2026-04-20T09:15:00', item_count: 4 },
  { id: 20264101, customer_name: '윤지우', event_id: 'e2', final_payment: 128000, status: 'completed', created_at: '2026-04-20T09:02:00', item_count: 2 },
  { id: 20264100, customer_name: '임소영', event_id: 'e1', final_payment: 95000, status: 'cancelled', created_at: '2026-04-20T08:48:00', item_count: 1 },
  { id: 20264099, customer_name: '한지훈', event_id: 'e3', final_payment: 289000, status: 'paid', created_at: '2026-04-19T17:12:00', item_count: 3 },
  { id: 20264098, customer_name: '조혜린', event_id: 'e1', final_payment: 156000, status: 'completed', created_at: '2026-04-19T16:44:00', item_count: 2 },
];

const DATE_PRESETS = [
  { label: '오늘', days: 0 },
  { label: '최근 2일', days: 2 },
  { label: '최근 7일', days: 7 },
  { label: '최근 30일', days: 30 },
];

const PRODUCT_CATEGORIES = ['검사', '도서', '도구'];

// ─────────────────────────────────────────────────────────────

const FilterSummary = ({ activeFilters, onClearOne, onClearAll }) => {
  const theme = useTheme();
  if (activeFilters.length === 0) return null;
  return (
    <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px dashed ${theme.gray[200]}`, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 700 }}>활성 필터</Typography>
      {activeFilters.map((f) => (
        <Chip
          key={f.key}
          label={`${f.label}: ${f.value}`}
          size="small"
          onDelete={() => onClearOne(f.key)}
          deleteIcon={<CloseIcon sx={{ fontSize: 14 }} />}
          sx={{
            fontWeight: 600,
            fontSize: '0.75rem',
            bgcolor: alpha(theme.palette.primary.main, 0.08),
            color: theme.palette.primary.main,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            '& .MuiChip-deleteIcon': { color: theme.palette.primary.main, '&:hover': { color: theme.palette.primary.dark } },
          }}
        />
      ))}
      <Button size="small" onClick={onClearAll} sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 700, ml: 'auto' }}>
        전체 해제
      </Button>
    </Box>
  );
};

const OrderRow = ({ order, event, selected, onSelectToggle, onRowClick }) => {
  const theme = useTheme();
  return (
    <Box
      onClick={onRowClick}
      sx={{
        display: 'grid',
        gridTemplateColumns: '44px minmax(120px, 1fr) minmax(100px, 1fr) minmax(140px, 1.5fr) 120px 140px 100px',
        alignItems: 'center',
        gap: 2,
        px: 2,
        py: 1.75,
        cursor: 'pointer',
        borderBottom: `1px solid ${theme.gray[100]}`,
        bgcolor: selected ? alpha(theme.palette.primary.main, 0.04) : 'transparent',
        transition: `background-color 0.15s ${theme.easing.toss}`,
        '&:hover': { bgcolor: selected ? alpha(theme.palette.primary.main, 0.06) : theme.gray[50] },
      }}
    >
      <Box onClick={(e) => { e.stopPropagation(); onSelectToggle(); }}>
        <Checkbox checked={selected} size="small" sx={{ p: 0 }} />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.8125rem', color: 'text.disabled', fontWeight: 700, letterSpacing: '-0.01em', fontFeatureSettings: '"tnum" 1' }}>
          #{order.id}
        </Typography>
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, letterSpacing: '-0.015em', color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {order.customer_name}
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', mt: 0.25 }}>
          상품 {order.item_count}개
        </Typography>
      </Box>
      <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {event?.name || 'N/A'}
      </Typography>
      <Typography sx={{ fontSize: '0.9375rem', fontWeight: 800, textAlign: 'right', letterSpacing: '-0.025em', color: 'text.primary', fontFeatureSettings: '"tnum" 1' }}>
        {order.final_payment.toLocaleString()}원
      </Typography>
      <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', fontFeatureSettings: '"tnum" 1' }}>
        {order.created_at.slice(5, 16).replace('T', ' ')}
      </Typography>
      <Box onClick={(e) => e.stopPropagation()}>
        <StatusChip status={order.status} size="sm" />
      </Box>
    </Box>
  );
};

// ─────────────────────────────────────────────────────────────

const OrderManagementPreview = () => {
  const theme = useTheme();
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState(['pending', 'paid']);
  const [searchTerm, setSearchTerm] = useState('');
  const [datePreset, setDatePreset] = useState(7);
  const [productCategory, setProductCategory] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [excelAnchor, setExcelAnchor] = useState(null);
  const [page, setPage] = useState(1);

  const activeFilters = useMemo(() => {
    const list = [];
    if (selectedEvents.length > 0) {
      list.push({ key: 'events', label: '학회', value: selectedEvents.length === 1 ? MOCK_EVENTS.find(e => e.id === selectedEvents[0])?.name : `${selectedEvents.length}개` });
    }
    if (selectedStatuses.length > 0) {
      list.push({ key: 'statuses', label: '상태', value: selectedStatuses.map(s => STATUS_TO_KOREAN[s]).join(', ') });
    }
    if (searchTerm) list.push({ key: 'search', label: '고객명', value: searchTerm });
    if (productSearchTerm) list.push({ key: 'productSearch', label: '상품명', value: productSearchTerm });
    if (productCategory) list.push({ key: 'productCategory', label: '카테고리', value: productCategory });
    return list;
  }, [selectedEvents, selectedStatuses, searchTerm, productSearchTerm, productCategory]);

  const clearFilter = (key) => {
    if (key === 'events') setSelectedEvents([]);
    if (key === 'statuses') setSelectedStatuses([]);
    if (key === 'search') setSearchTerm('');
    if (key === 'productSearch') setProductSearchTerm('');
    if (key === 'productCategory') setProductCategory('');
  };
  const clearAllFilters = () => {
    setSelectedEvents([]); setSelectedStatuses([]); setSearchTerm('');
    setProductSearchTerm(''); setProductCategory('');
  };

  const allSelected = selectedOrderIds.length === MOCK_ORDERS.length;
  const someSelected = selectedOrderIds.length > 0 && !allSelected;
  const toggleSelectAll = () => setSelectedOrderIds(allSelected ? [] : MOCK_ORDERS.map(o => o.id));
  const toggleSelectOne = (id) => setSelectedOrderIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <PreviewShell activePath="/admin/orders" maxWidth={1320}>
      <PageHeader
        title="주문 관리"
        subtitle={`총 ${MOCK_ORDERS.length}건 · 오늘 접수 8건`}
        icon={CartIcon}
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
              endIcon={<ArrowDownIcon sx={{ fontSize: 16 }} />}
              onClick={(e) => setExcelAnchor(e.currentTarget)}
            >
              엑셀
            </Button>
            <Menu anchorEl={excelAnchor} open={Boolean(excelAnchor)} onClose={() => setExcelAnchor(null)}>
              <MenuItem onClick={() => setExcelAnchor(null)}>📘 도서 출고 전용</MenuItem>
              <MenuItem onClick={() => setExcelAnchor(null)}>📄 검사 출고 전용</MenuItem>
              <Divider />
              <MenuItem onClick={() => setExcelAnchor(null)}>전체 통합 (백업용)</MenuItem>
            </Menu>
            <Button size="small" variant="contained" startIcon={<AddIcon sx={{ fontSize: 16 }} />}>
              신규 주문
            </Button>
          </Box>
        }
      />

      {/* ─── 필터 영역 ─── */}
      <SectionCard sx={{ mb: 3 }} padding={20}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <FilterListIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 800, color: 'text.primary', letterSpacing: '-0.01em' }}>
            필터
          </Typography>
          {activeFilters.length > 0 && (
            <Chip
              label={activeFilters.length}
              size="small"
              sx={{ height: 18, fontSize: '0.6875rem', fontWeight: 800, bgcolor: theme.palette.primary.main, color: '#fff' }}
            />
          )}
        </Box>

        {/* Row 1: 날짜 프리셋 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 0.5 }}>
            <CalendarIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 700 }}>기간</Typography>
          </Box>
          {DATE_PRESETS.map(({ label, days }) => (
            <Chip
              key={label}
              label={label}
              size="small"
              variant={datePreset === days ? 'filled' : 'outlined'}
              color={datePreset === days ? 'primary' : 'default'}
              onClick={() => setDatePreset(days)}
              sx={{ fontWeight: datePreset === days ? 700 : 500, cursor: 'pointer' }}
            />
          ))}
          <Box sx={{ display: 'flex', gap: 1, ml: 1 }}>
            <TextField size="small" type="date" defaultValue="2026-04-13" sx={{ width: 150 }} />
            <Typography sx={{ alignSelf: 'center', color: 'text.disabled' }}>~</Typography>
            <TextField size="small" type="date" defaultValue="2026-04-20" sx={{ width: 150 }} />
          </Box>
        </Box>

        {/* Row 2: 학회 / 상태 / 고객 검색 */}
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 200, flex: '1 1 200px' }}>
            <InputLabel>학회</InputLabel>
            <Select
              multiple
              value={selectedEvents}
              label="학회"
              input={<OutlinedInput label="학회" />}
              onChange={(e) => setSelectedEvents(e.target.value)}
              renderValue={(sel) => sel.length === 0 ? '전체' : sel.length === 1 ? MOCK_EVENTS.find(e => e.id === sel[0])?.name : `${sel.length}개 선택`}
            >
              {MOCK_EVENTS.map(ev => (
                <MenuItem key={ev.id} value={ev.id}>
                  <Checkbox checked={selectedEvents.includes(ev.id)} size="small" />
                  <ListItemText primary={ev.name} primaryTypographyProps={{ variant: 'body2' }} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180, flex: '1 1 180px' }}>
            <InputLabel>주문 상태</InputLabel>
            <Select
              multiple
              value={selectedStatuses}
              label="주문 상태"
              input={<OutlinedInput label="주문 상태" />}
              onChange={(e) => setSelectedStatuses(e.target.value)}
              renderValue={(sel) => sel.length === 0 ? '전체' : sel.map(s => STATUS_TO_KOREAN[s]).join(', ')}
            >
              {Object.entries(STATUS_TO_KOREAN).map(([key, value]) => (
                <MenuItem key={key} value={key}>
                  <Checkbox checked={selectedStatuses.includes(key)} size="small" />
                  <ListItemText primary={value} primaryTypographyProps={{ variant: 'body2' }} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            placeholder="고객명 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{ startAdornment: <SearchIcon sx={{ fontSize: 18, color: 'text.disabled', mr: 0.75 }} /> }}
            sx={{ flex: '1 1 180px', minWidth: 180 }}
          />
        </Box>

        {/* Row 3: 상품명 / 카테고리 */}
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mt: 1.5 }}>
          <TextField
            size="small"
            placeholder="상품명 검색"
            value={productSearchTerm}
            onChange={(e) => setProductSearchTerm(e.target.value)}
            InputProps={{ startAdornment: <SearchIcon sx={{ fontSize: 18, color: 'text.disabled', mr: 0.75 }} /> }}
            sx={{ flex: '1 1 200px', minWidth: 200 }}
          />
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            <Chip
              label="전체"
              size="small"
              variant={productCategory === '' ? 'filled' : 'outlined'}
              color={productCategory === '' ? 'secondary' : 'default'}
              onClick={() => setProductCategory('')}
              sx={{ fontWeight: productCategory === '' ? 700 : 500 }}
            />
            {PRODUCT_CATEGORIES.map(cat => (
              <Chip
                key={cat}
                label={`${cat} 구매`}
                size="small"
                variant={productCategory === cat ? 'filled' : 'outlined'}
                color={productCategory === cat ? 'secondary' : 'default'}
                onClick={() => setProductCategory(prev => prev === cat ? '' : cat)}
                sx={{ fontWeight: productCategory === cat ? 700 : 500 }}
              />
            ))}
          </Box>
          <Box sx={{ ml: 'auto' }}>
            <Button
              size="small"
              variant="text"
              startIcon={<RestartAltIcon sx={{ fontSize: 16 }} />}
              onClick={clearAllFilters}
              sx={{ color: 'text.secondary' }}
            >
              초기화
            </Button>
          </Box>
        </Box>

        <FilterSummary activeFilters={activeFilters} onClearOne={clearFilter} onClearAll={clearAllFilters} />
      </SectionCard>

      {/* ─── 테이블 영역 ─── */}
      <SectionCard padding={0}>
        {/* Toolbar */}
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 2, borderBottom: `1px solid ${theme.gray[100]}`, minHeight: 56 }}>
          <Checkbox
            size="small"
            checked={allSelected}
            indeterminate={someSelected}
            onChange={toggleSelectAll}
            sx={{ p: 0 }}
          />
          {selectedOrderIds.length > 0 ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 800, color: theme.palette.primary.main, letterSpacing: '-0.01em' }}>
                {selectedOrderIds.length}개 선택됨
              </Typography>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>상태 변경</InputLabel>
                <Select value={bulkStatus} label="상태 변경" onChange={(e) => setBulkStatus(e.target.value)}>
                  {Object.entries(STATUS_TO_KOREAN).map(([key, value]) => (
                    <MenuItem key={key} value={key}>{value}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button size="small" variant="contained" disabled={!bulkStatus}>
                일괄 적용
              </Button>
              <Button size="small" variant="text" onClick={() => setSelectedOrderIds([])} sx={{ color: 'text.secondary' }}>
                선택 해제
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                <Box component="span" sx={{ fontWeight: 800, color: 'text.primary', fontFeatureSettings: '"tnum" 1' }}>{MOCK_ORDERS.length}</Box>건의 주문
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled' }}>
                · 최신순
              </Typography>
            </Box>
          )}
        </Box>

        {/* Table header */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: '44px minmax(120px, 1fr) minmax(100px, 1fr) minmax(140px, 1.5fr) 120px 140px 100px',
          alignItems: 'center',
          gap: 2,
          px: 2,
          py: 1,
          borderBottom: `1px solid ${theme.gray[200]}`,
          bgcolor: theme.gray[50],
          '& > *': { fontSize: '0.6875rem', fontWeight: 700, color: 'text.secondary', letterSpacing: '0.03em', textTransform: 'uppercase' },
        }}>
          <span />
          <span>주문번호</span>
          <span>고객명</span>
          <span>학회</span>
          <span style={{ textAlign: 'right' }}>결제금액</span>
          <span>주문일시</span>
          <span>상태</span>
        </Box>

        {/* Rows */}
        <Box>
          {MOCK_ORDERS.map(order => (
            <OrderRow
              key={order.id}
              order={order}
              event={MOCK_EVENTS.find(e => e.id === order.event_id)}
              selected={selectedOrderIds.includes(order.id)}
              onSelectToggle={() => toggleSelectOne(order.id)}
              onRowClick={() => {}}
            />
          ))}
        </Box>

        {/* Pagination */}
        <Box sx={{ px: 2, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${theme.gray[100]}` }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled' }}>
            1-10 / 총 {MOCK_ORDERS.length}건
          </Typography>
          <Pagination
            count={5}
            page={page}
            onChange={(_, v) => setPage(v)}
            color="primary"
            size="small"
            shape="rounded"
          />
        </Box>
      </SectionCard>
    </PreviewShell>
  );
};

export default OrderManagementPreview;
