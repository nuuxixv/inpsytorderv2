import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Button, TextField, Select, MenuItem, FormControl,
  Checkbox, OutlinedInput, ListItemText, Menu, Divider, useTheme,
} from '@mui/material';
import {
  KeyboardArrowDown as ArrowDownIcon,
  KeyboardArrowUp as ArrowUpIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import PreviewShell from './preview/PreviewShell';
import { STATUS_TO_KOREAN } from '../constants/orderStatus';

/**
 * DEV-ONLY keystone: /preview/orders (variant C-2).
 * Editorial Minimal — Linear / Notion / Vercel inspired.
 * Whitespace as content. Monochrome except for 6px status dots.
 */

// ─── MOCK DATA (copied verbatim from OrderManagementPreview.jsx) ────────────
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

const TOTAL_PAGES = 8;

// ─── PAGE HEADER ────────────────────────────────────────────────────────────
const PageHeader = ({ onExcelClick, excelAnchor, onExcelClose }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 4,
        pt: 6,
        pb: 7,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: theme.gray[500],
            mb: 2,
          }}
        >
          Orders
        </Typography>
        <Typography
          component="h1"
          sx={{
            fontSize: '36px',
            fontWeight: 600,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            color: theme.gray[900],
          }}
        >
          주문 관리
        </Typography>
        <Typography
          sx={{
            mt: 1.5,
            fontSize: '13px',
            fontWeight: 400,
            color: theme.gray[500],
            fontFeatureSettings: '"tnum" 1',
          }}
        >
          총 {MOCK_ORDERS.length}건 · 오늘 접수 8건
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        <Button
          disableRipple
          onClick={onExcelClick}
          endIcon={<ArrowDownIcon sx={{ fontSize: 14 }} />}
          sx={{
            minHeight: 36,
            height: 36,
            px: 1,
            bgcolor: 'transparent',
            color: theme.gray[700],
            fontSize: '13px',
            fontWeight: 500,
            border: 'none',
            borderRadius: '6px',
            '&:hover': { bgcolor: theme.gray[50], color: theme.gray[900] },
          }}
        >
          엑셀
        </Button>
        <Menu
          anchorEl={excelAnchor}
          open={Boolean(excelAnchor)}
          onClose={onExcelClose}
          PaperProps={{
            elevation: 0,
            sx: {
              mt: 0.5,
              border: `1px solid ${theme.gray[200]}`,
              borderRadius: '6px',
              boxShadow: 'none',
              minWidth: 200,
            },
          }}
        >
          <MenuItem onClick={onExcelClose} sx={{ fontSize: '13px', color: theme.gray[800] }}>도서 출고 전용</MenuItem>
          <MenuItem onClick={onExcelClose} sx={{ fontSize: '13px', color: theme.gray[800] }}>검사 출고 전용</MenuItem>
          <Divider sx={{ my: 0.5 }} />
          <MenuItem onClick={onExcelClose} sx={{ fontSize: '13px', color: theme.gray[800] }}>전체 통합 (백업용)</MenuItem>
        </Menu>

        <Button
          disableRipple
          sx={{
            minHeight: 36,
            height: 36,
            px: 2,
            bgcolor: theme.gray[900],
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 500,
            letterSpacing: '-0.005em',
            borderRadius: '6px',
            boxShadow: 'none',
            '&:hover': { bgcolor: theme.gray[800], boxShadow: 'none' },
          }}
        >
          신규 주문
        </Button>
      </Box>
    </Box>
  );
};

// ─── FILTER SUMMARY (collapsed by default) ──────────────────────────────────
const FilterSummary = ({
  activeFilters,
  onClearOne,
  onClearAll,
  expanded,
  onToggle,
  selectedEvents,
  onEventsChange,
  selectedStatuses,
  onStatusesChange,
  searchTerm,
  onSearchTermChange,
}) => {
  const theme = useTheme();
  return (
    <Box sx={{ pb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Button
          disableRipple
          onClick={onToggle}
          endIcon={expanded ? <ArrowUpIcon sx={{ fontSize: 14 }} /> : <ArrowDownIcon sx={{ fontSize: 14 }} />}
          sx={{
            minHeight: 28,
            height: 28,
            px: 0,
            bgcolor: 'transparent',
            color: theme.gray[700],
            fontSize: '13px',
            fontWeight: 500,
            '&:hover': { bgcolor: 'transparent', color: theme.gray[900] },
          }}
        >
          필터
          {activeFilters.length > 0 && (
            <Box
              component="span"
              sx={{
                ml: 0.75,
                fontSize: '12px',
                color: theme.gray[500],
                fontFeatureSettings: '"tnum" 1',
              }}
            >
              {activeFilters.length}
            </Box>
          )}
        </Button>

        {activeFilters.map((f) => (
          <Box
            key={f.key}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.25,
              height: 24,
              border: `1px solid ${theme.gray[300]}`,
              borderRadius: '4px',
              bgcolor: 'transparent',
              fontSize: '12px',
              color: theme.gray[700],
            }}
          >
            <Box component="span" sx={{ color: theme.gray[500] }}>{f.label}:</Box>
            <Box component="span">{f.value}</Box>
            <Box
              component="button"
              onClick={() => onClearOne(f.key)}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 14,
                height: 14,
                p: 0,
                ml: 0.25,
                border: 'none',
                bgcolor: 'transparent',
                color: theme.gray[500],
                cursor: 'pointer',
                '&:hover': { color: theme.gray[900] },
              }}
            >
              <CloseIcon sx={{ fontSize: 12 }} />
            </Box>
          </Box>
        ))}

        {activeFilters.length > 0 && (
          <Button
            disableRipple
            onClick={onClearAll}
            sx={{
              minHeight: 24,
              height: 24,
              px: 0,
              ml: 'auto',
              bgcolor: 'transparent',
              color: theme.gray[500],
              fontSize: '12px',
              fontWeight: 400,
              '&:hover': { bgcolor: 'transparent', color: theme.gray[900] },
            }}
          >
            모두 해제
          </Button>
        )}
      </Box>

      {expanded && (
        <Box
          sx={{
            mt: 3,
            display: 'flex',
            gap: 2,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <Select
              multiple
              displayEmpty
              value={selectedEvents}
              input={<OutlinedInput />}
              onChange={(e) => onEventsChange(e.target.value)}
              renderValue={(sel) =>
                sel.length === 0
                  ? '학회 — 전체'
                  : sel.length === 1
                    ? `학회 — ${MOCK_EVENTS.find((e) => e.id === sel[0])?.name}`
                    : `학회 — ${sel.length}개`
              }
              sx={{
                fontSize: '13px',
                bgcolor: 'transparent',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.gray[200] },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: theme.gray[300] },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: theme.gray[900], borderWidth: 1 },
                '& .MuiSelect-select': { py: 1 },
              }}
            >
              {MOCK_EVENTS.map((ev) => (
                <MenuItem key={ev.id} value={ev.id} sx={{ fontSize: '13px' }}>
                  <Checkbox checked={selectedEvents.includes(ev.id)} size="small" sx={{ p: 0.5 }} />
                  <ListItemText primary={ev.name} primaryTypographyProps={{ fontSize: '13px' }} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <Select
              multiple
              displayEmpty
              value={selectedStatuses}
              input={<OutlinedInput />}
              onChange={(e) => onStatusesChange(e.target.value)}
              renderValue={(sel) =>
                sel.length === 0
                  ? '상태 — 전체'
                  : `상태 — ${sel.map((s) => STATUS_TO_KOREAN[s]).join(', ')}`
              }
              sx={{
                fontSize: '13px',
                bgcolor: 'transparent',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.gray[200] },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: theme.gray[300] },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: theme.gray[900], borderWidth: 1 },
                '& .MuiSelect-select': { py: 1 },
              }}
            >
              {Object.entries(STATUS_TO_KOREAN).map(([key, value]) => (
                <MenuItem key={key} value={key} sx={{ fontSize: '13px' }}>
                  <Checkbox checked={selectedStatuses.includes(key)} size="small" sx={{ p: 0.5 }} />
                  <ListItemText primary={value} primaryTypographyProps={{ fontSize: '13px' }} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            placeholder="고객명"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            sx={{
              minWidth: 200,
              '& .MuiOutlinedInput-root': {
                bgcolor: 'transparent',
                fontSize: '13px',
                minHeight: 36,
                '& fieldset': { borderColor: theme.gray[200] },
                '&:hover fieldset': { borderColor: theme.gray[300] },
                '&.Mui-focused fieldset': { borderColor: theme.gray[900], borderWidth: 1 },
              },
            }}
          />
        </Box>
      )}
    </Box>
  );
};

// ─── BULK TOOLBAR ───────────────────────────────────────────────────────────
const BulkToolbar = ({ count, onClear }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        px: 3,
        py: 1.75,
        borderTop: `1px solid ${theme.gray[100]}`,
        borderBottom: `1px solid ${theme.gray[100]}`,
        bgcolor: theme.gray[50],
      }}
    >
      <Typography
        sx={{
          fontSize: '13px',
          fontWeight: 500,
          color: theme.gray[900],
          fontFeatureSettings: '"tnum" 1',
        }}
      >
        {count} selected
      </Typography>
      <Typography sx={{ fontSize: '13px', color: theme.gray[400] }}>—</Typography>
      {['상태 변경', '삭제'].map((label) => (
        <Button
          key={label}
          disableRipple
          sx={{
            minHeight: 24,
            height: 24,
            px: 0,
            bgcolor: 'transparent',
            color: theme.gray[700],
            fontSize: '13px',
            fontWeight: 500,
            '&:hover': { bgcolor: 'transparent', color: theme.gray[900] },
          }}
        >
          {label}
        </Button>
      ))}
      <Button
        disableRipple
        onClick={onClear}
        sx={{
          minHeight: 24,
          height: 24,
          px: 0,
          ml: 'auto',
          bgcolor: 'transparent',
          color: theme.gray[500],
          fontSize: '13px',
          fontWeight: 400,
          '&:hover': { bgcolor: 'transparent', color: theme.gray[900] },
        }}
      >
        취소
      </Button>
    </Box>
  );
};

// ─── LIST HEADER ────────────────────────────────────────────────────────────
const GRID_COLUMNS = '36px 110px minmax(140px, 1.1fr) minmax(180px, 1.6fr) 140px 140px 120px';

const ListHeader = ({ allSelected, someSelected, onToggleAll }) => {
  const theme = useTheme();
  const cell = {
    fontSize: '11px',
    fontWeight: 500,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: theme.gray[500],
  };
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: GRID_COLUMNS,
        alignItems: 'center',
        gap: 2,
        px: 3,
        py: 2,
        borderBottom: `1px solid ${theme.gray[200]}`,
      }}
    >
      <Checkbox
        checked={allSelected}
        indeterminate={someSelected}
        onChange={onToggleAll}
        size="small"
        sx={{ p: 0, color: theme.gray[400], '&.Mui-checked': { color: theme.gray[900] }, '&.MuiCheckbox-indeterminate': { color: theme.gray[900] } }}
      />
      <Typography sx={cell}>Order</Typography>
      <Typography sx={cell}>Customer</Typography>
      <Typography sx={cell}>Event</Typography>
      <Typography sx={{ ...cell, textAlign: 'right' }}>Amount</Typography>
      <Typography sx={cell}>Placed</Typography>
      <Typography sx={cell}>Status</Typography>
    </Box>
  );
};

// ─── ORDER ROW ──────────────────────────────────────────────────────────────
const OrderRow = ({ order, event, selected, onSelectToggle }) => {
  const theme = useTheme();
  const statusColor = theme.status[order.status] || theme.gray[400];
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: GRID_COLUMNS,
        alignItems: 'center',
        gap: 2,
        px: 3,
        py: 2.5,
        cursor: 'pointer',
        borderBottom: `1px solid ${theme.gray[100]}`,
        bgcolor: selected ? theme.gray[100] : 'transparent',
        transition: 'background-color 0.12s ease',
        '&:hover': { bgcolor: selected ? theme.gray[100] : theme.gray[50] },
      }}
    >
      <Box onClick={(e) => { e.stopPropagation(); onSelectToggle(); }}>
        <Checkbox
          checked={selected}
          size="small"
          sx={{
            p: 0,
            color: theme.gray[400],
            '&.Mui-checked': { color: theme.gray[900] },
          }}
        />
      </Box>
      <Typography
        sx={{
          fontSize: '13px',
          fontWeight: 400,
          color: theme.gray[500],
          fontFeatureSettings: '"tnum" 1',
        }}
      >
        {order.id}
      </Typography>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: '14px',
            fontWeight: 500,
            color: theme.gray[900],
            letterSpacing: '-0.005em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {order.customer_name}
        </Typography>
        <Typography
          sx={{
            mt: 0.25,
            fontSize: '12px',
            fontWeight: 400,
            color: theme.gray[500],
            fontFeatureSettings: '"tnum" 1',
          }}
        >
          상품 {order.item_count}개
        </Typography>
      </Box>
      <Typography
        sx={{
          fontSize: '13px',
          fontWeight: 400,
          color: theme.gray[600],
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {event?.name || '—'}
      </Typography>
      <Typography
        sx={{
          fontSize: '14px',
          fontWeight: 500,
          color: theme.gray[900],
          textAlign: 'right',
          fontFeatureSettings: '"tnum" 1',
          letterSpacing: '-0.01em',
        }}
      >
        {order.final_payment.toLocaleString()}
        <Box component="span" sx={{ ml: 0.5, fontSize: '12px', fontWeight: 400, color: theme.gray[500] }}>
          KRW
        </Box>
      </Typography>
      <Typography
        sx={{
          fontSize: '12px',
          fontWeight: 400,
          color: theme.gray[500],
          fontFeatureSettings: '"tnum" 1',
        }}
      >
        {order.created_at.slice(5, 16).replace('T', ' ')}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: statusColor,
            flexShrink: 0,
          }}
        />
        <Typography sx={{ fontSize: '13px', fontWeight: 400, color: theme.gray[700] }}>
          {STATUS_TO_KOREAN[order.status]}
        </Typography>
      </Box>
    </Box>
  );
};

// ─── ORDERS LIST ────────────────────────────────────────────────────────────
const OrdersList = ({ orders, selectedIds, onToggleOne, onToggleAll, allSelected, someSelected }) => (
  <Box>
    <ListHeader allSelected={allSelected} someSelected={someSelected} onToggleAll={onToggleAll} />
    <Box>
      {orders.map((order) => (
        <OrderRow
          key={order.id}
          order={order}
          event={MOCK_EVENTS.find((e) => e.id === order.event_id)}
          selected={selectedIds.includes(order.id)}
          onSelectToggle={() => onToggleOne(order.id)}
        />
      ))}
    </Box>
  </Box>
);

// ─── PAGINATION ─────────────────────────────────────────────────────────────
const PaginationRow = ({ page, total, onChange }) => {
  const theme = useTheme();
  const chevronBtn = (disabled, onClick, children) => (
    <Box
      component="button"
      disabled={disabled}
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 24,
        p: 0,
        border: 'none',
        bgcolor: 'transparent',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? theme.gray[300] : theme.gray[600],
        '&:hover': { color: disabled ? theme.gray[300] : theme.gray[900] },
      }}
    >
      {children}
    </Box>
  );
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 1.5,
        pt: 6,
        pb: 8,
      }}
    >
      {chevronBtn(page === 1, () => onChange(Math.max(1, page - 1)), <ChevronLeftIcon sx={{ fontSize: 16 }} />)}
      <Typography
        sx={{
          fontSize: '13px',
          color: theme.gray[600],
          fontFeatureSettings: '"tnum" 1',
          minWidth: 40,
          textAlign: 'center',
        }}
      >
        <Box component="span" sx={{ color: theme.gray[900], fontWeight: 500 }}>{page}</Box>
        <Box component="span" sx={{ mx: 0.75, color: theme.gray[400] }}>/</Box>
        <Box component="span">{total}</Box>
      </Typography>
      {chevronBtn(page === total, () => onChange(Math.min(total, page + 1)), <ChevronRightIcon sx={{ fontSize: 16 }} />)}
    </Box>
  );
};

// ─── MAIN ───────────────────────────────────────────────────────────────────
const OrderManagementPreviewC2 = () => {
  const theme = useTheme();
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState(['pending', 'paid']);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [excelAnchor, setExcelAnchor] = useState(null);
  const [page, setPage] = useState(1);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const activeFilters = useMemo(() => {
    const list = [];
    if (selectedEvents.length > 0) {
      list.push({
        key: 'events',
        label: '이벤트',
        value: selectedEvents.length === 1
          ? MOCK_EVENTS.find((e) => e.id === selectedEvents[0])?.name
          : `${selectedEvents.length}개`,
      });
    }
    if (selectedStatuses.length > 0) {
      list.push({
        key: 'statuses',
        label: '상태',
        value: selectedStatuses.map((s) => STATUS_TO_KOREAN[s]).join(', '),
      });
    }
    if (searchTerm) list.push({ key: 'search', label: '고객명', value: searchTerm });
    return list;
  }, [selectedEvents, selectedStatuses, searchTerm]);

  const clearFilter = (key) => {
    if (key === 'events') setSelectedEvents([]);
    if (key === 'statuses') setSelectedStatuses([]);
    if (key === 'search') setSearchTerm('');
  };
  const clearAllFilters = () => {
    setSelectedEvents([]);
    setSelectedStatuses([]);
    setSearchTerm('');
  };

  const allSelected = selectedOrderIds.length === MOCK_ORDERS.length;
  const someSelected = selectedOrderIds.length > 0 && !allSelected;
  const toggleSelectAll = () =>
    setSelectedOrderIds(allSelected ? [] : MOCK_ORDERS.map((o) => o.id));
  const toggleSelectOne = (id) =>
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  return (
    <PreviewShell activePath="/admin/orders" maxWidth={1200}>
      <Box sx={{ bgcolor: '#ffffff', px: { xs: 3, md: 5 } }}>
        <PageHeader
          excelAnchor={excelAnchor}
          onExcelClick={(e) => setExcelAnchor(e.currentTarget)}
          onExcelClose={() => setExcelAnchor(null)}
        />

        <FilterSummary
          activeFilters={activeFilters}
          onClearOne={clearFilter}
          onClearAll={clearAllFilters}
          expanded={filtersExpanded}
          onToggle={() => setFiltersExpanded((v) => !v)}
          selectedEvents={selectedEvents}
          onEventsChange={setSelectedEvents}
          selectedStatuses={selectedStatuses}
          onStatusesChange={setSelectedStatuses}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
        />

        {/* Row count meta — natural flush left */}
        <Box sx={{ pb: 2 }}>
          <Typography
            sx={{
              fontSize: '12px',
              fontWeight: 400,
              color: theme.gray[500],
              fontFeatureSettings: '"tnum" 1',
            }}
          >
            <Box component="span" sx={{ color: theme.gray[900], fontWeight: 500 }}>
              {MOCK_ORDERS.length}
            </Box>
            {' rows · 최신순'}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ bgcolor: '#ffffff' }}>
        {selectedOrderIds.length > 0 && (
          <BulkToolbar
            count={selectedOrderIds.length}
            onClear={() => setSelectedOrderIds([])}
          />
        )}

        <OrdersList
          orders={MOCK_ORDERS}
          selectedIds={selectedOrderIds}
          onToggleOne={toggleSelectOne}
          onToggleAll={toggleSelectAll}
          allSelected={allSelected}
          someSelected={someSelected}
        />

        <PaginationRow page={page} total={TOTAL_PAGES} onChange={setPage} />
      </Box>
    </PreviewShell>
  );
};

export default OrderManagementPreviewC2;
