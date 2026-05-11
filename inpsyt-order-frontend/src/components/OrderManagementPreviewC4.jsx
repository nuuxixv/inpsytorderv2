import React, { useMemo, useState } from 'react';
import { Box, Typography, Button, InputBase, Checkbox, Menu, MenuItem, Divider, Collapse, useTheme } from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  Tune as TuneIcon,
  KeyboardArrowDown as ArrowDownIcon,
} from '@mui/icons-material';
import PreviewShell from './preview/PreviewShell';
import { STATUS_TO_KOREAN } from '../constants/orderStatus';

/**
 * DEV-ONLY — Design variant C-4 "Editorial Mono".
 * Hybrid: C-3 (Warm Print) layout & rhythm + C-2 (Editorial Minimal) palette.
 * Substack-layout aesthetic, Linear-palette discipline.
 */

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

const numText = {
  fontFamily: FONT,
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum" 1',
};

// ── Subcomponents ───────────────────────────────────────────────

const PageHeader = ({ theme }) => (
  <Box sx={{ mb: 5 }}>
    <Typography
      component="h1"
      sx={{
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: 40,
        letterSpacing: '-0.02em',
        color: theme.gray[900],
        lineHeight: 1.1,
        mb: 1.25,
      }}
    >
      주문 관리
    </Typography>
    <Box sx={{ height: '2px', width: 40, bgcolor: theme.gray[900], borderRadius: 1 }} />
  </Box>
);

const HeaderActions = ({ theme, onExcelClick, excelAnchor, onExcelClose }) => (
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
        color: theme.gray[700],
        border: `1px solid ${theme.gray[300]}`,
        textTransform: 'none',
        letterSpacing: '-0.005em',
        '&:hover': { bgcolor: theme.gray[50], borderColor: theme.gray[400], color: theme.gray[900] },
      }}
    >
      주문 내역 다운로드
    </Button>
    <Menu
      anchorEl={excelAnchor}
      open={Boolean(excelAnchor)}
      onClose={onExcelClose}
      PaperProps={{
        sx: {
          bgcolor: '#FFFFFF',
          border: `1px solid ${theme.gray[200]}`,
          boxShadow: 'none',
          borderRadius: '10px',
          mt: 0.5,
          '& .MuiMenuItem-root': {
            fontFamily: FONT,
            fontSize: 14,
            color: theme.gray[900],
            '&:hover': { bgcolor: theme.gray[50] },
          },
        },
      }}
    >
      <MenuItem onClick={onExcelClose}>도서 출고 전용</MenuItem>
      <MenuItem onClick={onExcelClose}>검사 출고 전용</MenuItem>
      <Divider sx={{ borderColor: theme.gray[200], my: 0.5 }} />
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
        bgcolor: theme.gray[900],
        color: '#FFFFFF',
        textTransform: 'none',
        letterSpacing: '-0.005em',
        boxShadow: 'none',
        '&:hover': { bgcolor: theme.gray[800], boxShadow: 'none' },
      }}
    >
      주문서 추가하기
    </Button>
  </Box>
);

// ── Filter primitives (tablet-touch-friendly) ──────────────────

const PresetPill = ({ theme, active, children, onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      cursor: 'pointer',
      userSelect: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      height: 36,
      px: 1.75,
      borderRadius: '8px',
      border: `1px solid ${active ? theme.gray[900] : theme.gray[200]}`,
      bgcolor: active ? theme.gray[900] : '#FFFFFF',
      color: active ? '#FFFFFF' : theme.gray[700],
      fontFamily: FONT,
      fontSize: 14,
      fontWeight: active ? 600 : 500,
      letterSpacing: '-0.005em',
      transition: 'all 0.15s ease',
      whiteSpace: 'nowrap',
      '&:hover': active
        ? { bgcolor: theme.gray[800], borderColor: theme.gray[800] }
        : { borderColor: theme.gray[400], color: theme.gray[900] },
    }}
  >
    {children}
  </Box>
);

const MonoTextField = ({ theme, value, onChange, placeholder, width }) => (
  <Box
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      height: 40,
      px: 1.5,
      width,
      minWidth: width,
      borderRadius: '8px',
      bgcolor: '#FFFFFF',
      border: `1px solid ${theme.gray[200]}`,
      transition: 'border-color 0.15s ease',
      '&:focus-within': { borderColor: theme.gray[900] },
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
        color: theme.gray[900],
        '& input::placeholder': { color: theme.gray[500], opacity: 1 },
      }}
    />
  </Box>
);

const CategoryPill = ({ theme, active, children, onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      cursor: 'pointer',
      userSelect: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      height: 32,
      px: 1.5,
      borderRadius: '999px',
      border: `1px solid ${active ? theme.gray[900] : theme.gray[200]}`,
      bgcolor: active ? theme.gray[900] : '#FFFFFF',
      color: active ? '#FFFFFF' : theme.gray[700],
      fontFamily: FONT,
      fontSize: 13,
      fontWeight: active ? 600 : 500,
      letterSpacing: 0,
      transition: 'all 0.15s ease',
      whiteSpace: 'nowrap',
      '&:hover': active
        ? { bgcolor: theme.gray[800], borderColor: theme.gray[800] }
        : { borderColor: theme.gray[400], color: theme.gray[900] },
    }}
  >
    {children}
  </Box>
);

const EventPill = ({ theme, active, children, onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      cursor: 'pointer',
      userSelect: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      maxWidth: 320,
      height: 36,
      px: 1.75,
      borderRadius: '8px',
      border: `1px solid ${active ? theme.gray[900] : theme.gray[200]}`,
      bgcolor: active ? theme.gray[900] : '#FFFFFF',
      color: active ? '#FFFFFF' : theme.gray[700],
      fontFamily: FONT,
      fontSize: 14,
      fontWeight: active ? 600 : 500,
      letterSpacing: '-0.005em',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      transition: 'all 0.15s ease',
      '&:hover': active
        ? { bgcolor: theme.gray[800], borderColor: theme.gray[800] }
        : { borderColor: theme.gray[400], color: theme.gray[900] },
    }}
  >
    {children}
  </Box>
);

// Segmented date-preset control — connected buttons, single-select.
const DatePresetSegment = ({ theme, value, onChange }) => (
  <Box
    sx={{
      display: 'inline-flex',
      alignItems: 'stretch',
      height: 40,
      borderRadius: '8px',
      border: `1px solid ${theme.gray[200]}`,
      overflow: 'hidden',
      bgcolor: '#FFFFFF',
    }}
  >
    {DATE_PRESETS.map(({ label, days }, i) => {
      const active = value === days;
      return (
        <Box
          key={label}
          onClick={() => onChange(days)}
          sx={{
            cursor: 'pointer',
            userSelect: 'none',
            px: 1.75,
            display: 'inline-flex',
            alignItems: 'center',
            fontFamily: FONT,
            fontSize: 14,
            fontWeight: active ? 600 : 500,
            letterSpacing: '-0.005em',
            color: active ? '#FFFFFF' : theme.gray[700],
            bgcolor: active ? theme.gray[900] : 'transparent',
            borderLeft: i === 0 ? 'none' : `1px solid ${active ? theme.gray[900] : theme.gray[200]}`,
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
            '&:hover': active ? { bgcolor: theme.gray[800] } : { bgcolor: theme.gray[50], color: theme.gray[900] },
          }}
        >
          {label}
        </Box>
      );
    })}
  </Box>
);

// Search input with leading icon — fills available space.
const SearchField = ({ theme, value, onChange, placeholder }) => (
  <Box
    sx={{
      flex: 1,
      minWidth: 220,
      display: 'flex',
      alignItems: 'center',
      height: 40,
      px: 1.5,
      borderRadius: '8px',
      bgcolor: '#FFFFFF',
      border: `1px solid ${theme.gray[200]}`,
      transition: 'border-color 0.15s ease',
      '&:focus-within': { borderColor: theme.gray[900] },
    }}
  >
    <SearchIcon sx={{ fontSize: 18, color: theme.gray[500], mr: 1, flexShrink: 0 }} />
    <InputBase
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      sx={{
        flex: 1,
        fontFamily: FONT,
        fontSize: 14,
        color: theme.gray[900],
        '& input::placeholder': { color: theme.gray[500], opacity: 1 },
      }}
    />
  </Box>
);

// "상세 필터" toggle — shows count badge if any filters active.
const ExpandToggle = ({ theme, expanded, activeCount, onClick }) => (
  <Box
    component="button"
    onClick={onClick}
    sx={{
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.75,
      height: 40,
      px: 1.75,
      borderRadius: '8px',
      border: `1px solid ${activeCount > 0 ? theme.gray[900] : theme.gray[200]}`,
      bgcolor: expanded ? theme.gray[50] : '#FFFFFF',
      color: theme.gray[900],
      fontFamily: FONT,
      fontSize: 14,
      fontWeight: 600,
      letterSpacing: '-0.005em',
      whiteSpace: 'nowrap',
      transition: 'all 0.15s ease',
      '&:hover': { bgcolor: theme.gray[50], borderColor: theme.gray[400] },
    }}
  >
    <TuneIcon sx={{ fontSize: 18 }} />
    상세 필터
    {activeCount > 0 && (
      <Box
        sx={{
          minWidth: 20,
          height: 20,
          px: 0.75,
          borderRadius: '10px',
          bgcolor: theme.gray[900],
          color: '#FFFFFF',
          fontSize: 11,
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {activeCount}
      </Box>
    )}
    <ArrowDownIcon
      sx={{
        fontSize: 16,
        color: theme.gray[500],
        transform: expanded ? 'rotate(180deg)' : 'none',
        transition: 'transform 0.2s ease',
      }}
    />
  </Box>
);

// Dismissible chip for currently-active filters.
const ActiveChip = ({ theme, children, onClear }) => (
  <Box
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.5,
      height: 30,
      pl: 1.25,
      pr: 0.5,
      borderRadius: '8px',
      bgcolor: theme.gray[100],
      color: theme.gray[900],
      fontFamily: FONT,
      fontSize: 13,
      fontWeight: 500,
      letterSpacing: '-0.005em',
      maxWidth: 280,
    }}
  >
    <Box
      component="span"
      sx={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </Box>
    <Box
      onClick={onClear}
      sx={{
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        borderRadius: '6px',
        color: theme.gray[600],
        flexShrink: 0,
        '&:hover': { bgcolor: theme.gray[200], color: theme.gray[900] },
      }}
    >
      <CloseIcon sx={{ fontSize: 14 }} />
    </Box>
  </Box>
);

// Label column for the expanded panel rows.
const PanelLabel = ({ theme, children }) => (
  <Typography
    sx={{
      fontFamily: FONT,
      fontSize: 13,
      fontWeight: 600,
      color: theme.gray[600],
      letterSpacing: '0.01em',
      pt: 1,
      minWidth: 88,
      flexShrink: 0,
    }}
  >
    {children}
  </Typography>
);

const Filters = ({
  theme,
  datePreset, setDatePreset,
  selectedEvents, toggleEvent,
  selectedStatuses, toggleStatus,
  searchTerm, setSearchTerm,
  productSearchTerm, setProductSearchTerm,
  productCategory, setProductCategory,
  startDate, setStartDate,
  endDate, setEndDate,
  expanded, onToggleExpanded,
  onReset,
}) => {
  // Count distinct filter groups in effect (date preset is "always on" so not counted).
  const activeCount =
    selectedEvents.length +
    selectedStatuses.length +
    (productCategory ? 1 : 0) +
    (searchTerm ? 1 : 0) +
    (productSearchTerm ? 1 : 0);

  const hasActiveChips = activeCount > 0;

  return (
    <Box
      sx={{
        bgcolor: '#FFFFFF',
        border: `1px solid ${theme.gray[200]}`,
        borderRadius: '12px',
        px: 2,
        py: 1.75,
        mb: 3,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      {/* ── Zone 1 — 빠른 필터 (항상 노출) ─────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
        <DatePresetSegment theme={theme} value={datePreset} onChange={setDatePreset} />
        <SearchField
          theme={theme}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="고객명 검색"
        />
        <ExpandToggle
          theme={theme}
          expanded={expanded}
          activeCount={activeCount}
          onClick={onToggleExpanded}
        />
      </Box>

      {/* ── Zone 2 — 활성 필터 칩 (조건부) ─────────────── */}
      {hasActiveChips && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            flexWrap: 'wrap',
            pt: 1.5,
            borderTop: `1px dashed ${theme.gray[200]}`,
          }}
        >
          <Typography
            sx={{
              fontFamily: FONT,
              fontSize: 12.5,
              fontWeight: 600,
              color: theme.gray[500],
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              mr: 0.5,
            }}
          >
            필터
          </Typography>
          {selectedStatuses.map((key) => (
            <ActiveChip key={`s-${key}`} theme={theme} onClear={() => toggleStatus(key)}>
              상태 · {STATUS_TO_KOREAN[key]}
            </ActiveChip>
          ))}
          {selectedEvents.map((id) => {
            const ev = MOCK_EVENTS.find((e) => e.id === id);
            return (
              <ActiveChip key={`e-${id}`} theme={theme} onClear={() => toggleEvent(id)}>
                학회 · {ev?.name ?? id}
              </ActiveChip>
            );
          })}
          {productCategory && (
            <ActiveChip theme={theme} onClear={() => setProductCategory('')}>
              카테고리 · {productCategory}
            </ActiveChip>
          )}
          {searchTerm && (
            <ActiveChip theme={theme} onClear={() => setSearchTerm('')}>
              고객명 · {searchTerm}
            </ActiveChip>
          )}
          {productSearchTerm && (
            <ActiveChip theme={theme} onClear={() => setProductSearchTerm('')}>
              상품명 · {productSearchTerm}
            </ActiveChip>
          )}
          <Box sx={{ flex: 1 }} />
          <Box
            component="button"
            onClick={onReset}
            sx={{
              cursor: 'pointer',
              bgcolor: 'transparent',
              border: 'none',
              color: theme.gray[600],
              fontFamily: FONT,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
              textDecorationColor: theme.gray[300],
              p: 0.5,
              '&:hover': { color: theme.gray[900], textDecorationColor: theme.gray[900] },
            }}
          >
            모두 초기화
          </Box>
        </Box>
      )}

      {/* ── Zone 3 — 상세 필터 (펼침) ─────────────── */}
      <Collapse in={expanded} timeout={200} unmountOnExit>
        <Box
          sx={{
            pt: 2,
            mt: 0.5,
            borderTop: `1px solid ${theme.gray[100]}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 2.25,
          }}
        >
          {/* 날짜 범위 */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <PanelLabel theme={theme}>날짜 범위</PanelLabel>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <MonoTextField
                theme={theme}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="시작일"
                width={148}
              />
              <Typography sx={{ color: theme.gray[400], fontFamily: FONT, fontSize: 14 }}>~</Typography>
              <MonoTextField
                theme={theme}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="종료일"
                width={148}
              />
            </Box>
          </Box>

          {/* 학회 */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <PanelLabel theme={theme}>학회</PanelLabel>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.875 }}>
              {MOCK_EVENTS.map((ev) => (
                <EventPill
                  key={ev.id}
                  theme={theme}
                  active={selectedEvents.includes(ev.id)}
                  onClick={() => toggleEvent(ev.id)}
                >
                  {ev.name}
                </EventPill>
              ))}
            </Box>
          </Box>

          {/* 결제 상태 */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <PanelLabel theme={theme}>결제 상태</PanelLabel>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.875 }}>
              {Object.entries(STATUS_TO_KOREAN).map(([key, value]) => (
                <PresetPill
                  key={key}
                  theme={theme}
                  active={selectedStatuses.includes(key)}
                  onClick={() => toggleStatus(key)}
                >
                  {value}
                </PresetPill>
              ))}
            </Box>
          </Box>

          {/* 상품 카테고리 */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <PanelLabel theme={theme}>상품 카테고리</PanelLabel>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.875 }}>
              <CategoryPill
                theme={theme}
                active={productCategory === ''}
                onClick={() => setProductCategory('')}
              >
                전체
              </CategoryPill>
              {PRODUCT_CATEGORIES.map((cat) => (
                <CategoryPill
                  key={cat}
                  theme={theme}
                  active={productCategory === cat}
                  onClick={() => setProductCategory((prev) => (prev === cat ? '' : cat))}
                >
                  {cat}
                </CategoryPill>
              ))}
            </Box>
          </Box>

          {/* 상품명 검색 (고급) */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <PanelLabel theme={theme}>상품명</PanelLabel>
            <MonoTextField
              theme={theme}
              value={productSearchTerm}
              onChange={(e) => setProductSearchTerm(e.target.value)}
              placeholder="특정 상품명으로 필터"
              width={280}
            />
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
};

const Toolbar = ({ theme, total, selectedCount, onClearSelection }) => {
  if (selectedCount > 0) {
    return (
      <Box
        sx={{
          bgcolor: theme.gray[50],
          border: `1px solid ${theme.gray[200]}`,
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
            color: theme.gray[900],
            fontWeight: 600,
            letterSpacing: '-0.005em',
          }}
        >
          <Box component="span" sx={{ ...numText }}>{selectedCount}</Box>건 선택됨
          <Box component="span" sx={{ mx: 1.25, color: theme.gray[400], fontWeight: 400 }}>—</Box>
          <Box component="span" sx={{ fontWeight: 500, fontStyle: 'italic', color: theme.gray[700] }}>
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
              color: theme.gray[900],
              px: 1.5,
              py: 0.75,
              borderRadius: '6px',
              border: `1px solid ${theme.gray[300]}`,
              bgcolor: '#FFFFFF',
              '&:hover': { bgcolor: theme.gray[50], borderColor: theme.gray[400] },
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
            color: theme.gray[600],
            '&:hover': { color: theme.gray[900] },
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
          color: theme.gray[900],
          fontWeight: 500,
          letterSpacing: '-0.005em',
        }}
      >
        주문 내역
        <Box component="span" sx={{ mx: 1, color: theme.gray[500], fontWeight: 400 }}>—</Box>
        <Box component="span" sx={{ ...numText, color: theme.gray[600] }}>총 {total}건</Box>
      </Typography>
    </Box>
  );
};

// Editorial Minimal status color map: only essential signals get color.
// 결제대기=warning, 결제완료=success, 처리완료=gray[900], 주문취소=gray[400], 결제취소=error.
const getStatusDotColor = (theme, status) => {
  switch (status) {
    case 'pending':   return theme.palette.warning.main;
    case 'paid':      return theme.palette.success.main;
    case 'completed': return theme.gray[900];
    case 'cancelled': return theme.gray[400];
    case 'refunded':  return theme.palette.error.main;
    default:          return theme.gray[400];
  }
};

const StatusDot = ({ theme, status }) => {
  const color = getStatusDotColor(theme, status);
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      <Box
        sx={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          bgcolor: color,
          flexShrink: 0,
        }}
      />
      <Typography
        sx={{
          fontFamily: FONT,
          fontSize: 13,
          fontWeight: 500,
          color: theme.gray[700],
          letterSpacing: '-0.005em',
        }}
      >
        {STATUS_TO_KOREAN[status]}
      </Typography>
    </Box>
  );
};

const OrderRow = ({ theme, order, event, selected, onSelectToggle, index }) => {
  // Soft zebra alternating rows — white / gray-tinted
  const bg = index % 2 === 0 ? '#FFFFFF' : theme.gray[50];
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '40px 110px minmax(160px, 1.3fr) minmax(180px, 1.5fr) 130px 130px 110px',
        alignItems: 'center',
        gap: 2,
        px: 2.5,
        minHeight: 64,
        bgcolor: selected ? theme.gray[100] : bg,
        borderTop: `1px solid ${theme.gray[100]}`,
        cursor: 'pointer',
        transition: 'background-color 0.2s ease, border-radius 0.2s ease',
        '&:hover': {
          bgcolor: selected ? theme.gray[100] : theme.gray[50],
          borderRadius: '6px',
        },
      }}
    >
      <Checkbox
        checked={selected}
        size="small"
        onChange={onSelectToggle}
        onClick={(e) => e.stopPropagation()}
        sx={{
          p: 0,
          color: theme.gray[400],
          '&.Mui-checked': { color: theme.gray[900] },
        }}
      />
      <Typography
        sx={{
          ...numText,
          fontFamily: FONT,
          fontSize: 13,
          fontWeight: 500,
          color: theme.gray[500],
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
            fontFamily: FONT,
            fontSize: 12.5,
            color: theme.gray[500],
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
          color: theme.gray[600],
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
          color: theme.gray[900],
          textAlign: 'right',
          letterSpacing: '-0.01em',
        }}
      >
        {order.final_payment.toLocaleString()}
        <Box component="span" sx={{ fontSize: 12, color: theme.gray[500], ml: 0.5, fontWeight: 400 }}>원</Box>
      </Typography>
      <Typography
        sx={{
          ...numText,
          fontFamily: FONT,
          fontSize: 12.5,
          color: theme.gray[500],
          letterSpacing: 0,
        }}
      >
        {order.created_at.slice(5, 10).replace('-', '월 ')}일{' '}
        <Box component="span" sx={{ color: theme.gray[400] }}>
          {order.created_at.slice(11, 16)}
        </Box>
      </Typography>
      <Box onClick={(e) => e.stopPropagation()}>
        <StatusDot theme={theme} status={order.status} />
      </Box>
    </Box>
  );
};

const OrdersList = ({ theme, orders, selectedIds, toggleOne, allSelected, someSelected, toggleAll }) => {
  const sectionLabel = {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: 500,
    color: theme.gray[500],
    letterSpacing: '0.06em',
  };
  return (
    <Box
      sx={{
        bgcolor: '#FFFFFF',
        border: `1px solid ${theme.gray[200]}`,
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
          bgcolor: theme.gray[50],
          borderBottom: `1px solid ${theme.gray[200]}`,
        }}
      >
        <Checkbox
          checked={allSelected}
          indeterminate={someSelected}
          onChange={toggleAll}
          size="small"
          sx={{
            p: 0,
            color: theme.gray[400],
            '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: theme.gray[900] },
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
          theme={theme}
          order={order}
          event={MOCK_EVENTS.find(e => e.id === order.event_id)}
          selected={selectedIds.includes(order.id)}
          onSelectToggle={() => toggleOne(order.id)}
          index={index}
        />
      ))}
    </Box>
  );
};

const Pager = ({ theme, page, setPage, total }) => {
  const pageCount = 5;
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 5, px: 0.5 }}>
      <Typography
        sx={{
          fontFamily: FONT,
          fontSize: 13,
          color: theme.gray[500],
          fontStyle: 'italic',
          letterSpacing: 0,
        }}
      >
        <Box component="span" sx={{ ...numText }}>1–10</Box>
        {' of '}
        <Box component="span" sx={{ ...numText }}>{total}</Box>
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Typography sx={{ fontFamily: FONT, color: theme.gray[500], fontSize: 14, fontStyle: 'italic' }}>—</Typography>
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
                  border: active ? `1px solid ${theme.gray[900]}` : '1px solid transparent',
                  bgcolor: active ? theme.gray[100] : 'transparent',
                  color: active ? theme.gray[900] : theme.gray[500],
                  fontFamily: FONT,
                  fontSize: 14,
                  fontWeight: active ? 600 : 500,
                  fontStyle: 'italic',
                  letterSpacing: 0,
                  ...numText,
                  transition: 'all 0.2s ease',
                  '&:hover': { color: theme.gray[900] },
                }}
              >
                {n}
              </Box>
              {idx < pageCount - 1 && (
                <Typography sx={{ fontFamily: FONT, color: theme.gray[400], fontSize: 13 }}>·</Typography>
              )}
            </React.Fragment>
          );
        })}
        <Typography sx={{ fontFamily: FONT, color: theme.gray[500], fontSize: 14, fontStyle: 'italic' }}>—</Typography>
      </Box>
    </Box>
  );
};

// ── Main component ─────────────────────────────────────────────

const OrderManagementPreviewC4 = () => {
  const theme = useTheme();
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState(['pending', 'paid']);
  const [searchTerm, setSearchTerm] = useState('');
  const [datePreset, setDatePreset] = useState(7);
  const [productCategory, setProductCategory] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [excelAnchor, setExcelAnchor] = useState(null);
  const [page, setPage] = useState(1);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [startDate, setStartDate] = useState('2026-04-13');
  const [endDate, setEndDate] = useState('2026-04-20');

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
    <PreviewShell activePath="/admin/orders" maxWidth={1400}>
      <Box sx={{ fontFamily: FONT, color: theme.gray[900] }}>
        {/* Header row: title block + actions */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 3, flexWrap: 'wrap', mb: 3 }}>
          <PageHeader theme={theme} />
          <Box sx={{ pt: 1.5 }}>
            <HeaderActions
              theme={theme}
              onExcelClick={(e) => setExcelAnchor(e.currentTarget)}
              excelAnchor={excelAnchor}
              onExcelClose={() => setExcelAnchor(null)}
            />
          </Box>
        </Box>

        <Filters
          theme={theme}
          datePreset={datePreset} setDatePreset={setDatePreset}
          selectedEvents={selectedEvents} toggleEvent={toggleEvent}
          selectedStatuses={selectedStatuses} toggleStatus={toggleStatus}
          searchTerm={searchTerm} setSearchTerm={setSearchTerm}
          productSearchTerm={productSearchTerm} setProductSearchTerm={setProductSearchTerm}
          productCategory={productCategory} setProductCategory={setProductCategory}
          startDate={startDate} setStartDate={setStartDate}
          endDate={endDate} setEndDate={setEndDate}
          expanded={filtersExpanded}
          onToggleExpanded={() => setFiltersExpanded((v) => !v)}
          onReset={clearAllFilters}
        />

        <Toolbar
          theme={theme}
          total={totalCount}
          selectedCount={selectedOrderIds.length}
          onClearSelection={() => setSelectedOrderIds([])}
        />

        <OrdersList
          theme={theme}
          orders={MOCK_ORDERS}
          selectedIds={selectedOrderIds}
          toggleOne={toggleSelectOne}
          allSelected={allSelected}
          someSelected={someSelected}
          toggleAll={toggleSelectAll}
        />

        <Pager theme={theme} page={page} setPage={setPage} total={totalCount} />
      </Box>
    </PreviewShell>
  );
};

export default OrderManagementPreviewC4;
