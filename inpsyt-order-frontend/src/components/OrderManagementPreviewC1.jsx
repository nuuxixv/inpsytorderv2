import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Button, InputBase, Select, MenuItem, FormControl,
  Checkbox, useTheme,
} from '@mui/material';
import {
  Search as SearchIcon,
  KeyboardArrowDown as ArrowDownIcon,
} from '@mui/icons-material';
import PreviewShell from './preview/PreviewShell';
import { STATUS_TO_KOREAN } from '../constants/orderStatus';

/**
 * DEV-ONLY: /preview/orders-c1
 * Design variant C-1 — "Quiet Luxury"
 * Inspired by: NYT digital edition, Bloomberg Terminal, FT.com.
 * Rules: serif hero, hairline rules, no shadows, no filled chips,
 * tabular numerics, editorial restraint.
 */

// ─── Mock data (verbatim from OrderManagementPreview.jsx) ────────
const MOCK_EVENTS = [
  { id: 'e1', name: '2026년 한국심리학회 연차학술대회' },
  { id: 'e2', name: '2026 한국임상심리학회 봄학술대회' },
  { id: 'e3', name: '2026 한국상담심리학회 연차대회' },
];

const MOCK_ORDERS = [
  { id: 20264107, customer_name: '김현수', event_id: 'e1', final_payment: 245000, status: 'paid',      created_at: '2026-04-20T10:24:00', item_count: 3 },
  { id: 20264106, customer_name: '이정민', event_id: 'e1', final_payment: 89000,  status: 'pending',   created_at: '2026-04-20T10:18:00', item_count: 1 },
  { id: 20264105, customer_name: '박지훈', event_id: 'e2', final_payment: 412000, status: 'completed', created_at: '2026-04-20T09:55:00', item_count: 5 },
  { id: 20264104, customer_name: '최서연', event_id: 'e1', final_payment: 178000, status: 'completed', created_at: '2026-04-20T09:42:00', item_count: 2 },
  { id: 20264103, customer_name: '정다은', event_id: 'e3', final_payment: 64000,  status: 'refunded',  created_at: '2026-04-20T09:30:00', item_count: 1 },
  { id: 20264102, customer_name: '강민호', event_id: 'e1', final_payment: 356000, status: 'paid',      created_at: '2026-04-20T09:15:00', item_count: 4 },
  { id: 20264101, customer_name: '윤지우', event_id: 'e2', final_payment: 128000, status: 'completed', created_at: '2026-04-20T09:02:00', item_count: 2 },
  { id: 20264100, customer_name: '임소영', event_id: 'e1', final_payment: 95000,  status: 'cancelled', created_at: '2026-04-20T08:48:00', item_count: 1 },
  { id: 20264099, customer_name: '한지훈', event_id: 'e3', final_payment: 289000, status: 'paid',      created_at: '2026-04-19T17:12:00', item_count: 3 },
  { id: 20264098, customer_name: '조혜린', event_id: 'e1', final_payment: 156000, status: 'completed', created_at: '2026-04-19T16:44:00', item_count: 2 },
];

const DATE_PRESETS = [
  { label: '오늘', days: 0 },
  { label: '최근 2일', days: 2 },
  { label: '최근 7일', days: 7 },
  { label: '최근 30일', days: 30 },
];

// ─── Design tokens ───────────────────────────────────────────────
const SERIF = '"IBM Plex Serif", "Noto Serif KR", Georgia, serif';

const LABEL_SX = {
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const GRID_COLS = '28px 110px minmax(160px, 1.3fr) minmax(180px, 1.6fr) 90px 140px 130px 140px';

// ─── Helpers ─────────────────────────────────────────────────────
const STATUS_TONE = {
  pending:   'warning',
  paid:      'success',
  completed: 'success',
  cancelled: 'error',
  refunded:  'error',
};

const formatLongKoreanDate = (iso) => {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return { date: `${y}년 ${m}월 ${day}일`, time: `${hh}:${mm}` };
};

// ─── Sub-components ──────────────────────────────────────────────

const PageHeader = () => {
  const theme = useTheme();
  return (
    <Box sx={{ pt: 6, pb: 4 }}>
      <Typography sx={{ ...LABEL_SX, color: theme.gray[600], mb: 1.5 }}>
        Administration · 주문 관리
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 4 }}>
        <Box>
          <Typography
            component="h1"
            sx={{
              fontFamily: SERIF,
              fontWeight: 500,
              fontSize: { xs: '32px', md: '42px' },
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              color: theme.gray[900],
              m: 0,
            }}
          >
            주문 관리
          </Typography>
          <Typography
            sx={{
              mt: 1.5,
              fontFamily: SERIF,
              fontStyle: 'italic',
              fontSize: '16px',
              color: theme.gray[600],
              letterSpacing: '-0.005em',
            }}
          >
            2026년 4월 21일 오전 · 총 {MOCK_ORDERS.length}건의 주문이 접수되었습니다.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
          <Button
            disableRipple
            sx={{
              minHeight: 0,
              p: 0,
              color: theme.gray[900],
              fontSize: '13px',
              fontWeight: 500,
              letterSpacing: '-0.005em',
              textTransform: 'none',
              borderRadius: 0,
              '&:hover': { backgroundColor: 'transparent', color: theme.palette.primary.main },
            }}
            endIcon={<ArrowDownIcon sx={{ fontSize: 14 }} />}
          >
            엑셀
          </Button>
          <Button
            variant="contained"
            disableRipple
            disableElevation
            sx={{
              backgroundColor: theme.palette.primary.main,
              color: '#fff',
              borderRadius: '2px',
              px: 2.5,
              py: 1,
              minHeight: 0,
              boxShadow: 'none',
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              '&:hover': { backgroundColor: theme.palette.primary.dark, boxShadow: 'none' },
            }}
          >
            신규 주문
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

const HairlineRule = ({ thick }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        borderTop: `${thick ? 2 : 1}px solid ${thick ? theme.gray[900] : theme.gray[200]}`,
      }}
    />
  );
};

const Filters = ({
  datePreset, setDatePreset,
  selectedEvent, setSelectedEvent,
  selectedStatus, setSelectedStatus,
  searchTerm, setSearchTerm,
}) => {
  const theme = useTheme();
  return (
    <Box sx={{ py: 3 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'auto 1fr auto auto auto' },
          alignItems: 'center',
          columnGap: 4,
          rowGap: 2,
        }}
      >
        {/* Date preset pills — text only with underline */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ ...LABEL_SX, color: theme.gray[600], mr: 1.5 }}>Filed</Typography>
          <Box sx={{ display: 'flex', gap: 2.5 }}>
            {DATE_PRESETS.map(({ label, days }) => {
              const active = datePreset === days;
              return (
                <Box
                  key={label}
                  onClick={() => setDatePreset(days)}
                  sx={{
                    cursor: 'pointer',
                    pb: 0.25,
                    fontSize: '13px',
                    fontWeight: active ? 600 : 400,
                    color: active ? theme.gray[900] : theme.gray[700],
                    letterSpacing: '-0.005em',
                    borderBottom: active
                      ? `2px solid ${theme.gray[900]}`
                      : '2px solid transparent',
                    transition: `all 0.15s ${theme.easing.toss}`,
                    '&:hover': { color: theme.gray[900] },
                    userSelect: 'none',
                  }}
                >
                  {label}
                </Box>
              );
            })}
          </Box>
        </Box>

        <Box /> {/* spacer on md+ */}

        {/* Event select */}
        <InlineSelect
          label="Section"
          value={selectedEvent}
          onChange={setSelectedEvent}
          width={200}
          options={[
            { value: '', label: '전체 학회' },
            ...MOCK_EVENTS.map((e) => ({ value: e.id, label: e.name })),
          ]}
        />

        {/* Status select */}
        <InlineSelect
          label="Status"
          value={selectedStatus}
          onChange={setSelectedStatus}
          width={150}
          options={[
            { value: '', label: '전체 상태' },
            ...Object.entries(STATUS_TO_KOREAN).map(([k, v]) => ({ value: k, label: v })),
          ]}
        />

        {/* Search input */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 220 }}>
          <Typography sx={{ ...LABEL_SX, color: theme.gray[600] }}>Search</Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              borderBottom: `1px solid ${theme.gray[300]}`,
              flex: 1,
              transition: `border-color 0.15s ${theme.easing.toss}`,
              '&:focus-within': { borderBottomColor: theme.gray[900] },
            }}
          >
            <SearchIcon sx={{ fontSize: 14, color: theme.gray[600], mr: 0.75 }} />
            <InputBase
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="고객명"
              sx={{
                flex: 1,
                fontSize: '13px',
                color: theme.gray[900],
                '& input': { p: 0, py: 0.75 },
                '& input::placeholder': { color: theme.gray[500], opacity: 1, fontStyle: 'italic' },
              }}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

const InlineSelect = ({ label, value, onChange, options, width = 160 }) => {
  const theme = useTheme();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
      <Typography sx={{ ...LABEL_SX, color: theme.gray[600] }}>{label}</Typography>
      <FormControl variant="standard" sx={{ minWidth: width }}>
        <Select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disableUnderline
          IconComponent={ArrowDownIcon}
          sx={{
            fontSize: '13px',
            color: theme.gray[900],
            letterSpacing: '-0.005em',
            borderBottom: `1px solid ${theme.gray[300]}`,
            pb: 0.25,
            transition: `border-color 0.15s ${theme.easing.toss}`,
            '&:hover': { borderBottomColor: theme.gray[900] },
            '& .MuiSelect-select': { py: 0.5, pr: 3, backgroundColor: 'transparent' },
            '& .MuiSvgIcon-root': { color: theme.gray[700], fontSize: 16 },
            '&.Mui-focused': { borderBottomColor: theme.gray[900] },
          }}
          MenuProps={{
            PaperProps: {
              sx: {
                mt: 1,
                borderRadius: '2px',
                border: `1px solid ${theme.gray[200]}`,
                boxShadow: 'none',
              },
            },
          }}
        >
          {options.map((opt) => (
            <MenuItem
              key={opt.value}
              value={opt.value}
              sx={{ fontSize: '13px', letterSpacing: '-0.005em' }}
            >
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};

const Toolbar = ({ selectedCount, totalCount, onClearSelection }) => {
  const theme = useTheme();
  const hasSelection = selectedCount > 0;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 1.5,
      }}
    >
      <Typography sx={{ ...LABEL_SX, color: theme.gray[600] }}>
        {hasSelection ? `${selectedCount} selected` : `${totalCount} entries`}
      </Typography>
      {hasSelection ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            fontSize: '13px',
            color: theme.gray[900],
            letterSpacing: '-0.005em',
          }}
        >
          <Box component="span" sx={{ fontWeight: 600 }}>
            {selectedCount}건 선택됨
          </Box>
          <Separator />
          <ToolbarLink>상태 변경</ToolbarLink>
          <Separator />
          <ToolbarLink>삭제</ToolbarLink>
          <Separator />
          <ToolbarLink onClick={onClearSelection}>취소</ToolbarLink>
        </Box>
      ) : (
        <Typography
          sx={{
            fontSize: '12px',
            fontStyle: 'italic',
            color: theme.gray[600],
            fontFamily: SERIF,
          }}
        >
          최신순 정렬
        </Typography>
      )}
    </Box>
  );
};

const Separator = () => {
  const theme = useTheme();
  return (
    <Box component="span" sx={{ mx: 1.5, color: theme.gray[400], fontSize: '13px' }}>
      —
    </Box>
  );
};

const ToolbarLink = ({ children, onClick }) => {
  const theme = useTheme();
  return (
    <Box
      component="span"
      onClick={onClick}
      sx={{
        cursor: 'pointer',
        color: theme.gray[900],
        fontWeight: 500,
        '&:hover': { color: theme.palette.primary.main, textDecoration: 'underline', textUnderlineOffset: '3px' },
      }}
    >
      {children}
    </Box>
  );
};

const TableHeader = ({ allSelected, someSelected, onToggleAll }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: GRID_COLS,
        alignItems: 'center',
        columnGap: 2,
        py: 1.25,
        borderBottom: `1px solid ${theme.gray[900]}`,
      }}
    >
      <Box>
        <Checkbox
          checked={allSelected}
          indeterminate={someSelected}
          onChange={onToggleAll}
          size="small"
          disableRipple
          sx={{
            p: 0,
            color: theme.gray[500],
            '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: theme.gray[900] },
          }}
        />
      </Box>
      {['No.', 'Subject', 'Section', 'Items', 'Amount', 'Status', 'Filed'].map((label, i) => (
        <Typography
          key={label}
          sx={{
            ...LABEL_SX,
            color: theme.gray[600],
            textAlign: i === 4 ? 'right' : 'left',
          }}
        >
          {label}
        </Typography>
      ))}
    </Box>
  );
};

const StatusDot = ({ status }) => {
  const theme = useTheme();
  const tone = STATUS_TONE[status] || 'warning';
  const color =
    tone === 'success' ? theme.status.paid :
    tone === 'error'   ? theme.status.cancelled :
                         theme.status.pending;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box
        sx={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
      <Typography sx={{ fontSize: '13px', color: theme.gray[700], letterSpacing: '-0.005em' }}>
        {STATUS_TO_KOREAN[status]}
      </Typography>
    </Box>
  );
};

const OrderRow = ({ order, event, selected, onSelectToggle }) => {
  const theme = useTheme();
  const { date, time } = formatLongKoreanDate(order.created_at);
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: GRID_COLS,
        alignItems: 'center',
        columnGap: 2,
        minHeight: 56,
        py: 1.25,
        borderBottom: `1px solid ${theme.gray[200]}`,
        backgroundColor: selected ? theme.gray[50] : 'transparent',
        transition: `background-color 0.15s ${theme.easing.toss}`,
        '&:hover': { backgroundColor: theme.gray[50] },
      }}
    >
      <Box onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={selected}
          onChange={onSelectToggle}
          size="small"
          disableRipple
          sx={{
            p: 0,
            color: theme.gray[400],
            '&.Mui-checked': { color: theme.gray[900] },
          }}
        />
      </Box>

      <Typography
        sx={{
          ...LABEL_SX,
          color: theme.gray[600],
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.04em',
        }}
      >
        #{order.id}
      </Typography>

      <Typography
        sx={{
          fontFamily: SERIF,
          fontWeight: 500,
          fontSize: '16px',
          color: theme.gray[900],
          letterSpacing: '-0.01em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {order.customer_name}
      </Typography>

      <Typography
        sx={{
          fontFamily: SERIF,
          fontSize: '14px',
          color: theme.gray[700],
          letterSpacing: '-0.005em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {event?.name || '—'}
      </Typography>

      <Typography
        sx={{
          fontSize: '13px',
          color: theme.gray[700],
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {order.item_count}점
      </Typography>

      <Typography
        sx={{
          fontSize: '14px',
          fontWeight: 500,
          color: theme.gray[900],
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.005em',
        }}
      >
        ₩{order.final_payment.toLocaleString()}
      </Typography>

      <StatusDot status={order.status} />

      <Box>
        <Typography
          sx={{
            fontSize: '13px',
            color: theme.gray[700],
            letterSpacing: '-0.005em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {date}
        </Typography>
        <Typography
          sx={{
            fontSize: '11px',
            color: theme.gray[500],
            fontVariantNumeric: 'tabular-nums',
            mt: 0.25,
          }}
        >
          {time}
        </Typography>
      </Box>
    </Box>
  );
};

const OrdersList = ({ orders, selectedIds, onToggleAll, onToggleOne }) => {
  const allSelected = selectedIds.length === orders.length && orders.length > 0;
  const someSelected = selectedIds.length > 0 && !allSelected;
  return (
    <Box>
      <TableHeader
        allSelected={allSelected}
        someSelected={someSelected}
        onToggleAll={() => {
          if (allSelected) onToggleAll([]);
          else onToggleAll(orders.map((o) => o.id));
        }}
      />
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
  );
};

const Pagination = ({ page, setPage, totalPages = 5 }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        pt: 4,
        pb: 2,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 2,
        fontFamily: SERIF,
        fontStyle: 'italic',
        fontSize: '15px',
        color: theme.gray[700],
      }}
    >
      <Box
        component="span"
        onClick={() => page > 1 && setPage(page - 1)}
        sx={{
          cursor: page > 1 ? 'pointer' : 'default',
          color: page > 1 ? theme.gray[900] : theme.gray[400],
          '&:hover': { color: page > 1 ? theme.palette.primary.main : theme.gray[400] },
        }}
      >
        Previous
      </Box>
      <Box component="span" sx={{ color: theme.gray[400] }}>·</Box>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n, idx) => (
        <React.Fragment key={n}>
          <Box
            component="span"
            onClick={() => setPage(n)}
            sx={{
              cursor: 'pointer',
              fontStyle: 'normal',
              fontFamily: SERIF,
              fontSize: '15px',
              fontVariantNumeric: 'tabular-nums',
              color: page === n ? theme.gray[900] : theme.gray[700],
              fontWeight: page === n ? 500 : 400,
              borderBottom: page === n ? `1px solid ${theme.gray[900]}` : '1px solid transparent',
              pb: 0.25,
              transition: `all 0.15s ${theme.easing.toss}`,
              '&:hover': { color: theme.gray[900] },
            }}
          >
            {n}
          </Box>
          {idx < totalPages - 1 && null}
        </React.Fragment>
      ))}
      <Box component="span" sx={{ color: theme.gray[400] }}>·</Box>
      <Box
        component="span"
        onClick={() => page < totalPages && setPage(page + 1)}
        sx={{
          cursor: page < totalPages ? 'pointer' : 'default',
          color: page < totalPages ? theme.gray[900] : theme.gray[400],
          '&:hover': { color: page < totalPages ? theme.palette.primary.main : theme.gray[400] },
        }}
      >
        Next
      </Box>
    </Box>
  );
};

// ─── Main ────────────────────────────────────────────────────────

const OrderManagementPreviewC1 = () => {
  const theme = useTheme();
  const [datePreset, setDatePreset] = useState(7);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [page, setPage] = useState(1);

  const filteredOrders = useMemo(() => {
    return MOCK_ORDERS.filter((o) => {
      if (selectedEvent && o.event_id !== selectedEvent) return false;
      if (selectedStatus && o.status !== selectedStatus) return false;
      if (searchTerm && !o.customer_name.includes(searchTerm)) return false;
      return true;
    });
  }, [selectedEvent, selectedStatus, searchTerm]);

  const toggleOne = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <PreviewShell activePath="/admin/orders" maxWidth={1200}>
      <Box
        sx={{
          backgroundColor: '#FFFFFF',
          px: { xs: 3, md: 5 },
          pb: 5,
          minHeight: '100%',
        }}
      >
        <PageHeader />
        <HairlineRule thick />
        <Filters
          datePreset={datePreset}
          setDatePreset={setDatePreset}
          selectedEvent={selectedEvent}
          setSelectedEvent={setSelectedEvent}
          selectedStatus={selectedStatus}
          setSelectedStatus={setSelectedStatus}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />
        <HairlineRule />
        <Toolbar
          selectedCount={selectedIds.length}
          totalCount={filteredOrders.length}
          onClearSelection={() => setSelectedIds([])}
        />
        <OrdersList
          orders={filteredOrders}
          selectedIds={selectedIds}
          onToggleAll={setSelectedIds}
          onToggleOne={toggleOne}
        />
        <Pagination page={page} setPage={setPage} totalPages={5} />
        <Box sx={{ pt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ ...LABEL_SX, color: theme.gray[600], fontVariantNumeric: 'tabular-nums' }}>
            1 – {filteredOrders.length} / {MOCK_ORDERS.length} entries
          </Typography>
          <Typography
            sx={{
              fontFamily: SERIF,
              fontStyle: 'italic',
              fontSize: '12px',
              color: theme.gray[600],
            }}
          >
            인싸이트 현장주문 · Edition C-1
          </Typography>
        </Box>
      </Box>
    </PreviewShell>
  );
};

export default OrderManagementPreviewC1;
