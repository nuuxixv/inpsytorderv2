import React, { useMemo, useState } from 'react';
import { Box, Typography, Button, InputBase, Checkbox, Menu, MenuItem, Divider } from '@mui/material';
import PreviewShell from './preview/PreviewShell';
import { STATUS_TO_KOREAN } from '../constants/orderStatus';

/**
 * DEV-ONLY — Design variant C-3 "Warm Print".
 * References: Substack reader, Things 3, Readwise Reader, Kinfolk Magazine.
 * Feel: reading a well-designed newsletter on a warm afternoon.
 */

// ── Warm palette (local, strict) ────────────────────────────────
const WARM = {
  bg: '#FAF7F2',
  paper: '#FFFBF5',
  border: '#EDE4D3',
  ink: '#2E2A26',
  inkMuted: '#6B645B',
  inkSubtle: '#948A7D',
  accent: '#B85C38',
  accentSoft: '#E8C9B8',
  success: '#3D5A4C',
  warning: '#C89F5E',
  error: '#A84F3D',
  successSoft: '#E5EEE9',
  warningSoft: '#F5EBDA',
  errorSoft: '#F2DFD9',
};

const FONT = '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif';

// ── Mock data (verbatim from OrderManagementPreview.jsx) ────────
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

const STATUS_TONES = {
  pending:   { bg: WARM.warningSoft, fg: WARM.warning },
  paid:      { bg: WARM.successSoft, fg: WARM.success },
  completed: { bg: WARM.accentSoft,  fg: WARM.accent },
  cancelled: { bg: WARM.errorSoft,   fg: WARM.error },
  refunded:  { bg: WARM.errorSoft,   fg: WARM.error },
};

// ── Typography helpers ──────────────────────────────────────────
const sectionLabel = {
  fontFamily: FONT,
  fontSize: 12,
  fontWeight: 500,
  color: WARM.inkSubtle,
  letterSpacing: '0.06em',
};

const bodyText = {
  fontFamily: FONT,
  fontSize: 15,
  fontWeight: 400,
  color: WARM.ink,
  lineHeight: 1.6,
};

const numText = {
  fontFamily: FONT,
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum" 1',
};

// ── Subcomponents ───────────────────────────────────────────────

const PageHeader = ({ total, today }) => (
  <Box sx={{ mb: 5 }}>
    <Typography
      component="h1"
      sx={{
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: 40,
        letterSpacing: '-0.02em',
        color: WARM.ink,
        lineHeight: 1.1,
        mb: 1.25,
      }}
    >
      주문 관리
    </Typography>
    <Box sx={{ height: '2px', width: 40, bgcolor: WARM.accent, mb: 2, borderRadius: 1 }} />
    <Typography sx={{ ...bodyText, color: WARM.inkMuted, fontSize: 14.5 }}>
      <Box component="span" sx={{ ...numText }}>총 {total}건</Box>
      <Box component="span" sx={{ mx: 1, color: WARM.inkSubtle }}>—</Box>
      오늘 접수 <Box component="span" sx={{ ...numText }}>{today}</Box>건
    </Typography>
  </Box>
);

const HeaderActions = ({ onExcelClick, excelAnchor, onExcelClose }) => (
  <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}>
    <Button
      disableRipple
      onClick={onExcelClick}
      sx={{
        fontFamily: FONT,
        fontWeight: 600,
        fontSize: 14,
        px: 2,
        height: 40,
        borderRadius: '8px',
        bgcolor: 'transparent',
        color: WARM.accent,
        border: `1px solid ${WARM.accent}4D`,
        textTransform: 'none',
        letterSpacing: '-0.005em',
        '&:hover': { bgcolor: `${WARM.accent}0F`, borderColor: `${WARM.accent}80` },
      }}
    >
      엑셀 내보내기
    </Button>
    <Menu
      anchorEl={excelAnchor}
      open={Boolean(excelAnchor)}
      onClose={onExcelClose}
      PaperProps={{
        sx: {
          bgcolor: WARM.paper,
          border: `1px solid ${WARM.border}`,
          boxShadow: 'none',
          borderRadius: '10px',
          mt: 0.5,
          '& .MuiMenuItem-root': {
            fontFamily: FONT,
            fontSize: 14,
            color: WARM.ink,
            '&:hover': { bgcolor: `${WARM.accent}0A` },
          },
        },
      }}
    >
      <MenuItem onClick={onExcelClose}>도서 출고 전용</MenuItem>
      <MenuItem onClick={onExcelClose}>검사 출고 전용</MenuItem>
      <Divider sx={{ borderColor: WARM.border, my: 0.5 }} />
      <MenuItem onClick={onExcelClose}>전체 통합 (백업용)</MenuItem>
    </Menu>
    <Button
      disableRipple
      sx={{
        fontFamily: FONT,
        fontWeight: 600,
        fontSize: 14,
        px: 2.25,
        height: 40,
        borderRadius: '8px',
        bgcolor: WARM.accent,
        color: '#FFFBF5',
        textTransform: 'none',
        letterSpacing: '-0.005em',
        boxShadow: 'none',
        '&:hover': { bgcolor: '#A14E2E', boxShadow: 'none' },
      }}
    >
      신규 주문
    </Button>
  </Box>
);

const PresetPill = ({ active, children, onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      cursor: 'pointer',
      userSelect: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      height: 32,
      px: 1.75,
      borderRadius: '8px',
      border: `1px solid ${active ? WARM.accent : WARM.border}`,
      bgcolor: active ? WARM.accentSoft : 'transparent',
      color: active ? WARM.accent : WARM.inkMuted,
      fontFamily: FONT,
      fontSize: 13,
      fontWeight: active ? 600 : 500,
      letterSpacing: '-0.005em',
      transition: 'all 0.2s ease',
      '&:hover': { borderColor: WARM.accent, color: WARM.accent },
    }}
  >
    {children}
  </Box>
);

const WarmTextField = ({ value, onChange, placeholder, width }) => (
  <Box
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      height: 38,
      px: 1.75,
      width,
      minWidth: width,
      borderRadius: '8px',
      bgcolor: WARM.bg,
      border: `1px solid ${WARM.border}`,
      transition: 'border-color 0.2s ease',
      '&:focus-within': { borderColor: WARM.accent },
    }}
  >
    <InputBase
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      sx={{
        flex: 1,
        fontFamily: FONT,
        fontSize: 14,
        color: WARM.ink,
        '& input::placeholder': { color: WARM.inkSubtle, opacity: 1 },
      }}
    />
  </Box>
);

const CategoryPill = ({ active, children, onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      cursor: 'pointer',
      userSelect: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      height: 30,
      px: 1.5,
      borderRadius: '999px',
      border: `1px solid ${active ? WARM.accent : WARM.border}`,
      bgcolor: active ? WARM.accentSoft : 'transparent',
      color: active ? WARM.accent : WARM.inkMuted,
      fontFamily: FONT,
      fontSize: 12.5,
      fontWeight: active ? 600 : 500,
      letterSpacing: 0,
      transition: 'all 0.2s ease',
      '&:hover': { color: WARM.accent, borderColor: WARM.accent },
    }}
  >
    {children}
  </Box>
);

const Filters = ({
  datePreset, setDatePreset,
  selectedEvents, toggleEvent,
  selectedStatuses, toggleStatus,
  searchTerm, setSearchTerm,
  productSearchTerm, setProductSearchTerm,
  productCategory, setProductCategory,
  onReset,
}) => (
  <Box
    sx={{
      bgcolor: WARM.paper,
      border: `1px solid ${WARM.border}`,
      borderRadius: '12px',
      p: '28px',
      mb: 5,
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
      <Typography sx={sectionLabel}>필터 및 검색</Typography>
      <Box
        onClick={onReset}
        sx={{
          cursor: 'pointer',
          fontFamily: FONT,
          fontSize: 12.5,
          fontStyle: 'italic',
          color: WARM.inkMuted,
          letterSpacing: 0,
          '&:hover': { color: WARM.accent },
        }}
      >
        — 처음으로 돌아가기 —
      </Box>
    </Box>

    {/* 기간 */}
    <Box sx={{ mb: 3 }}>
      <Typography sx={{ ...sectionLabel, mb: 1.25 }}>기간</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
        {DATE_PRESETS.map(({ label, days }) => (
          <PresetPill key={label} active={datePreset === days} onClick={() => setDatePreset(days)}>
            {label}
          </PresetPill>
        ))}
        <Box sx={{ ...sectionLabel, mx: 1.5 }}>—</Box>
        <WarmTextField value="2026-04-13" onChange={() => {}} placeholder="시작" width={130} />
        <Typography sx={{ color: WARM.inkSubtle, px: 0.5, fontFamily: FONT }}>~</Typography>
        <WarmTextField value="2026-04-20" onChange={() => {}} placeholder="종료" width={130} />
      </Box>
    </Box>

    {/* 학회 */}
    <Box sx={{ mb: 3 }}>
      <Typography sx={{ ...sectionLabel, mb: 1.25 }}>학회</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {MOCK_EVENTS.map(ev => {
          const active = selectedEvents.includes(ev.id);
          return (
            <Box
              key={ev.id}
              onClick={() => toggleEvent(ev.id)}
              sx={{
                cursor: 'pointer',
                userSelect: 'none',
                px: 1.75,
                py: 0.875,
                borderRadius: '8px',
                border: `1px solid ${active ? WARM.accent : WARM.border}`,
                bgcolor: active ? WARM.accentSoft : 'transparent',
                color: active ? WARM.accent : WARM.inkMuted,
                fontFamily: FONT,
                fontSize: 13.5,
                fontWeight: active ? 600 : 500,
                letterSpacing: '-0.005em',
                transition: 'all 0.2s ease',
                '&:hover': { borderColor: WARM.accent, color: WARM.accent },
              }}
            >
              {ev.name}
            </Box>
          );
        })}
      </Box>
    </Box>

    {/* 상태 */}
    <Box sx={{ mb: 3 }}>
      <Typography sx={{ ...sectionLabel, mb: 1.25 }}>주문 상태</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {Object.entries(STATUS_TO_KOREAN).map(([key, value]) => {
          const active = selectedStatuses.includes(key);
          return (
            <PresetPill key={key} active={active} onClick={() => toggleStatus(key)}>
              {value}
            </PresetPill>
          );
        })}
      </Box>
    </Box>

    {/* 검색 + 카테고리 */}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
      <Box>
        <Typography sx={{ ...sectionLabel, mb: 1.25 }}>고객명</Typography>
        <WarmTextField
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="고객명으로 찾기"
          width="100%"
        />
      </Box>
      <Box>
        <Typography sx={{ ...sectionLabel, mb: 1.25 }}>상품</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <WarmTextField
            value={productSearchTerm}
            onChange={(e) => setProductSearchTerm(e.target.value)}
            placeholder="상품명으로 찾기"
            width="100%"
          />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            <CategoryPill active={productCategory === ''} onClick={() => setProductCategory('')}>전체</CategoryPill>
            {PRODUCT_CATEGORIES.map(cat => (
              <CategoryPill
                key={cat}
                active={productCategory === cat}
                onClick={() => setProductCategory(prev => prev === cat ? '' : cat)}
              >
                {cat} 구매
              </CategoryPill>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  </Box>
);

const Toolbar = ({ total, selectedCount, onClearSelection }) => {
  if (selectedCount > 0) {
    return (
      <Box
        sx={{
          bgcolor: WARM.accentSoft,
          border: `1px solid ${WARM.accent}40`,
          borderRadius: '12px',
          px: 3,
          py: 2,
          mb: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Typography
          sx={{
            fontFamily: FONT,
            fontSize: 14.5,
            color: WARM.accent,
            fontWeight: 600,
            letterSpacing: '-0.005em',
          }}
        >
          <Box component="span" sx={{ ...numText }}>{selectedCount}</Box>건 선택됨
          <Box component="span" sx={{ mx: 1.25, color: `${WARM.accent}99`, fontWeight: 400 }}>—</Box>
          <Box component="span" sx={{ fontWeight: 500, fontStyle: 'italic' }}>
            상태 변경 · 삭제 · 취소 선택
          </Box>
        </Typography>
        <Box sx={{ flex: 1 }} />
        {['상태 변경', '삭제'].map((lbl) => (
          <Box
            key={lbl}
            sx={{
              cursor: 'pointer',
              fontFamily: FONT,
              fontSize: 13,
              fontWeight: 600,
              color: WARM.accent,
              px: 1.5,
              py: 0.75,
              borderRadius: '6px',
              border: `1px solid ${WARM.accent}40`,
              bgcolor: WARM.paper,
              '&:hover': { bgcolor: '#FFF7EC' },
            }}
          >
            {lbl}
          </Box>
        ))}
        <Box
          onClick={onClearSelection}
          sx={{
            cursor: 'pointer',
            fontFamily: FONT,
            fontSize: 13,
            fontStyle: 'italic',
            color: WARM.inkMuted,
            '&:hover': { color: WARM.accent },
          }}
        >
          선택 해제
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        mb: 2,
        px: 0.5,
      }}
    >
      <Typography
        sx={{
          fontFamily: FONT,
          fontSize: 15,
          color: WARM.ink,
          fontWeight: 500,
          letterSpacing: '-0.005em',
        }}
      >
        주문 내역
        <Box component="span" sx={{ mx: 1, color: WARM.inkSubtle, fontWeight: 400 }}>—</Box>
        <Box component="span" sx={{ ...numText, color: WARM.inkMuted }}>총 {total}건</Box>
      </Typography>
      <Typography sx={{ ...sectionLabel, fontStyle: 'italic' }}>최신순으로 정리했습니다</Typography>
    </Box>
  );
};

const StatusTag = ({ status }) => {
  const tone = STATUS_TONES[status] || STATUS_TONES.pending;
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 24,
        px: 1.25,
        borderRadius: '6px',
        bgcolor: tone.bg,
        color: tone.fg,
        border: `1px solid ${tone.fg}33`,
        fontFamily: FONT,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '-0.005em',
      }}
    >
      {STATUS_TO_KOREAN[status]}
    </Box>
  );
};

const OrderRow = ({ order, event, selected, onSelectToggle, index }) => {
  const bg = index % 2 === 0 ? WARM.paper : WARM.bg;
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '40px 110px minmax(160px, 1.3fr) minmax(180px, 1.5fr) 130px 130px 110px',
        alignItems: 'center',
        gap: 2,
        px: 2.5,
        minHeight: 64,
        bgcolor: selected ? WARM.accentSoft : bg,
        borderTop: `1px solid ${WARM.border}`,
        cursor: 'pointer',
        transition: 'background-color 0.2s ease, border-radius 0.2s ease',
        '&:hover': {
          bgcolor: selected ? WARM.accentSoft : `${WARM.accentSoft}80`,
          borderRadius: '6px',
        },
      }}
    >
      <Box onClick={(e) => { e.stopPropagation(); onSelectToggle(); }} sx={{ display: 'flex', alignItems: 'center' }}>
        <Checkbox
          checked={selected}
          size="small"
          sx={{
            p: 0,
            color: WARM.inkSubtle,
            '&.Mui-checked': { color: WARM.accent },
          }}
        />
      </Box>
      <Typography
        sx={{
          ...numText,
          fontFamily: FONT,
          fontSize: 13,
          fontWeight: 500,
          color: WARM.inkSubtle,
          letterSpacing: 0,
        }}
      >
        #{order.id}
      </Typography>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontFamily: FONT,
            fontSize: 15,
            fontWeight: 600,
            color: WARM.ink,
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
            fontFamily: FONT,
            fontSize: 12.5,
            color: WARM.inkSubtle,
            mt: 0.25,
            fontStyle: 'italic',
          }}
        >
          상품 {order.item_count}개
        </Typography>
      </Box>
      <Typography
        sx={{
          fontFamily: FONT,
          fontSize: 13.5,
          color: WARM.inkMuted,
          lineHeight: 1.5,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          letterSpacing: 0,
        }}
      >
        {event?.name || 'N/A'}
      </Typography>
      <Typography
        sx={{
          ...numText,
          fontFamily: FONT,
          fontSize: 15,
          fontWeight: 600,
          color: WARM.ink,
          textAlign: 'right',
          letterSpacing: '-0.01em',
        }}
      >
        {order.final_payment.toLocaleString()}
        <Box component="span" sx={{ fontSize: 12, color: WARM.inkSubtle, ml: 0.5, fontWeight: 400 }}>원</Box>
      </Typography>
      <Typography
        sx={{
          ...numText,
          fontFamily: FONT,
          fontSize: 12.5,
          color: WARM.inkSubtle,
          letterSpacing: 0,
        }}
      >
        {order.created_at.slice(5, 10).replace('-', '월 ')}일
        <Box component="span" sx={{ mx: 0.75, color: WARM.border }}>·</Box>
        {order.created_at.slice(11, 16)}
      </Typography>
      <Box onClick={(e) => e.stopPropagation()}>
        <StatusTag status={order.status} />
      </Box>
    </Box>
  );
};

const OrdersList = ({ orders, selectedIds, toggleOne, allSelected, someSelected, toggleAll }) => (
  <Box
    sx={{
      bgcolor: WARM.paper,
      border: `1px solid ${WARM.border}`,
      borderRadius: '12px',
      overflow: 'hidden',
    }}
  >
    {/* Header row */}
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '40px 110px minmax(160px, 1.3fr) minmax(180px, 1.5fr) 130px 130px 110px',
        alignItems: 'center',
        gap: 2,
        px: 2.5,
        py: 1.75,
        bgcolor: WARM.bg,
        borderBottom: `1px solid ${WARM.border}`,
      }}
    >
      <Checkbox
        checked={allSelected}
        indeterminate={someSelected}
        onChange={toggleAll}
        size="small"
        sx={{
          p: 0,
          color: WARM.inkSubtle,
          '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: WARM.accent },
        }}
      />
      <Typography sx={sectionLabel}>주문번호</Typography>
      <Typography sx={sectionLabel}>고객</Typography>
      <Typography sx={sectionLabel}>학회</Typography>
      <Typography sx={{ ...sectionLabel, textAlign: 'right' }}>결제 금액</Typography>
      <Typography sx={sectionLabel}>접수 시각</Typography>
      <Typography sx={sectionLabel}>상태</Typography>
    </Box>
    {orders.map((order, index) => (
      <OrderRow
        key={order.id}
        order={order}
        event={MOCK_EVENTS.find(e => e.id === order.event_id)}
        selected={selectedIds.includes(order.id)}
        onSelectToggle={() => toggleOne(order.id)}
        index={index}
      />
    ))}
  </Box>
);

const Pager = ({ page, setPage, total }) => {
  const pageCount = 5;
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 5, px: 0.5 }}>
      <Typography
        sx={{
          fontFamily: FONT,
          fontSize: 13,
          color: WARM.inkSubtle,
          fontStyle: 'italic',
          letterSpacing: 0,
        }}
      >
        <Box component="span" sx={{ ...numText }}>1–10</Box>
        {' of '}
        <Box component="span" sx={{ ...numText }}>{total}</Box>
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Typography sx={{ fontFamily: FONT, color: WARM.inkSubtle, fontSize: 14, fontStyle: 'italic' }}>—</Typography>
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((n, idx) => {
          const active = page === n;
          return (
            <React.Fragment key={n}>
              <Box
                onClick={() => setPage(n)}
                sx={{
                  cursor: 'pointer',
                  userSelect: 'none',
                  minWidth: 28,
                  height: 28,
                  px: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  border: active ? `1px solid ${WARM.accent}` : '1px solid transparent',
                  bgcolor: active ? WARM.accentSoft : 'transparent',
                  color: active ? WARM.accent : WARM.inkMuted,
                  fontFamily: FONT,
                  fontSize: 14,
                  fontWeight: 500,
                  fontStyle: 'italic',
                  letterSpacing: 0,
                  ...numText,
                  transition: 'all 0.2s ease',
                  '&:hover': { color: WARM.accent },
                }}
              >
                {n}
              </Box>
              {idx < pageCount - 1 && (
                <Typography sx={{ fontFamily: FONT, color: WARM.inkSubtle, fontSize: 13 }}>·</Typography>
              )}
            </React.Fragment>
          );
        })}
        <Typography sx={{ fontFamily: FONT, color: WARM.inkSubtle, fontSize: 14, fontStyle: 'italic' }}>—</Typography>
      </Box>
    </Box>
  );
};

// ── Main component ─────────────────────────────────────────────

const OrderManagementPreviewC3 = () => {
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState(['pending', 'paid']);
  const [searchTerm, setSearchTerm] = useState('');
  const [datePreset, setDatePreset] = useState(7);
  const [productCategory, setProductCategory] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [excelAnchor, setExcelAnchor] = useState(null);
  const [page, setPage] = useState(1);

  const toggleEvent = (id) =>
    setSelectedEvents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleStatus = (key) =>
    setSelectedStatuses(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]);
  const clearAllFilters = () => {
    setSelectedEvents([]); setSelectedStatuses([]); setSearchTerm('');
    setProductSearchTerm(''); setProductCategory(''); setDatePreset(7);
  };

  const allSelected = selectedOrderIds.length === MOCK_ORDERS.length;
  const someSelected = selectedOrderIds.length > 0 && !allSelected;
  const toggleSelectAll = () => setSelectedOrderIds(allSelected ? [] : MOCK_ORDERS.map(o => o.id));
  const toggleSelectOne = (id) =>
    setSelectedOrderIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const totalCount = useMemo(() => MOCK_ORDERS.length, []);

  return (
    <PreviewShell activePath="/admin/orders" maxWidth={1200}>
      {/* Full-bleed warm bg override */}
      <Box
        sx={{
          bgcolor: WARM.bg,
          mx: { xs: -2, md: -3 },
          my: -6,
          px: { xs: 3, md: 6 },
          py: 6,
          minHeight: 'calc(100vh - 64px)',
          fontFamily: FONT,
          color: WARM.ink,
        }}
      >
        <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
          {/* Header row: title block + actions */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 3, flexWrap: 'wrap' }}>
            <PageHeader total={totalCount} today={8} />
            <Box sx={{ pt: 1.5 }}>
              <HeaderActions
                onExcelClick={(e) => setExcelAnchor(e.currentTarget)}
                excelAnchor={excelAnchor}
                onExcelClose={() => setExcelAnchor(null)}
              />
            </Box>
          </Box>

          <Filters
            datePreset={datePreset} setDatePreset={setDatePreset}
            selectedEvents={selectedEvents} toggleEvent={toggleEvent}
            selectedStatuses={selectedStatuses} toggleStatus={toggleStatus}
            searchTerm={searchTerm} setSearchTerm={setSearchTerm}
            productSearchTerm={productSearchTerm} setProductSearchTerm={setProductSearchTerm}
            productCategory={productCategory} setProductCategory={setProductCategory}
            onReset={clearAllFilters}
          />

          <Toolbar
            total={totalCount}
            selectedCount={selectedOrderIds.length}
            onClearSelection={() => setSelectedOrderIds([])}
          />

          <OrdersList
            orders={MOCK_ORDERS}
            selectedIds={selectedOrderIds}
            toggleOne={toggleSelectOne}
            allSelected={allSelected}
            someSelected={someSelected}
            toggleAll={toggleSelectAll}
          />

          <Pager page={page} setPage={setPage} total={totalCount} />

          {/* Colophon — subtle editorial footer */}
          <Box sx={{ mt: 6, pt: 3, borderTop: `1px solid ${WARM.border}`, textAlign: 'center' }}>
            <Typography
              sx={{
                fontFamily: FONT,
                fontSize: 12,
                color: WARM.inkSubtle,
                fontStyle: 'italic',
                letterSpacing: '0.03em',
              }}
            >
              — 인싸이트 현장주문 · 주문 관리 —
            </Typography>
          </Box>
        </Box>
      </Box>
    </PreviewShell>
  );
};

export default OrderManagementPreviewC3;
