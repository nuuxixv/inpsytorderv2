import React, { useState } from 'react';
import {
  Box, Button, IconButton, InputAdornment, Popover, TextField, Typography, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  CalendarMonth as CalendarMonthIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Close as ClearIcon,
} from '@mui/icons-material';

/**
 * 공용 경량 캘린더 — PaymentReceiptModal 로컬 구현에서 추출(2026-06-10).
 * @mui/x-date-pickers 미도입 방침 유지(순수 JS, 신규 라이브러리 0).
 *
 * CalendarPopover mode:
 *  - 'single': 날짜 1개 선택 → onChange(iso) 후 즉시 닫힘
 *  - 'multi' : 여러 날 토글, value = iso[] (지불증 주말출근비)
 *  - 'range' : 시작→종료 2클릭, value = { start, end } (지불증 출장비)
 */

const WDAY = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (iso) => new Date(`${iso}T00:00:00`);
const isWeekend = (iso) => [0, 6].includes(parseISO(iso).getDay());

export const CalendarPopover = ({ anchorEl, open, onClose, mode, value, onChange, monthBase }) => {
  const theme = useTheme();
  const [cursor, setCursor] = useState(() => {
    const base = monthBase ? parseISO(monthBase) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const [rangeStart, setRangeStart] = useState(null);

  const selectedSet = mode === 'multi' ? new Set(value || []) : null;
  const rStart = mode === 'range' ? (value?.start || null) : null;
  const rEnd = mode === 'range' ? (value?.end || null) : null;

  const isInRange = (iso) => {
    if (mode !== 'range') return false;
    const s = rangeStart || rStart;
    const e = rangeStart ? null : rEnd;
    if (s && e) return parseISO(iso) >= parseISO(s) && parseISO(iso) <= parseISO(e);
    return iso === s;
  };

  const handleDay = (iso) => {
    if (mode === 'single') {
      onChange(iso);
      onClose();
    } else if (mode === 'multi') {
      const next = new Set(value || []);
      if (next.has(iso)) next.delete(iso); else next.add(iso);
      onChange([...next].sort());
    } else {
      if (!rangeStart) {
        setRangeStart(iso);
        onChange({ start: iso, end: iso });
      } else {
        const s = parseISO(rangeStart) <= parseISO(iso) ? rangeStart : iso;
        const e = parseISO(rangeStart) <= parseISO(iso) ? iso : rangeStart;
        onChange({ start: s, end: e });
        setRangeStart(null);
        onClose();
      }
    }
  };

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toISO(new Date(year, month, d)));

  return (
    <Popover
      anchorEl={anchorEl}
      open={open}
      onClose={() => { setRangeStart(null); onClose(); }}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{ paper: { sx: { p: 1.5, borderRadius: `${theme.radii.md}px`, mt: 0.5 } } }}
    >
      <Box sx={{ width: 280 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <IconButton size="small" onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="이전 달" sx={{ width: 36, height: 36 }}>
            <ChevronLeftIcon sx={{ fontSize: 20 }} />
          </IconButton>
          <Typography variant="subtitle2" sx={{ fontFeatureSettings: '"tnum" 1' }}>{year}년 {month + 1}월</Typography>
          <IconButton size="small" onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="다음 달" sx={{ width: 36, height: 36 }}>
            <ChevronRightIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.5 }}>
          {WDAY.map((w, i) => (
            <Typography key={w} variant="caption" align="center" sx={{ fontWeight: 700, color: i === 0 || i === 6 ? theme.palette.error.main : 'text.disabled', py: 0.5 }}>
              {w}
            </Typography>
          ))}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.25 }}>
          {cells.map((iso, idx) => {
            if (!iso) return <Box key={`e${idx}`} sx={{ height: 36 }} />;
            const day = parseISO(iso).getDate();
            const weekend = isWeekend(iso);
            const selectedMulti = selectedSet?.has(iso);
            const selectedSingle = mode === 'single' && iso === value;
            const inRange = isInRange(iso);
            const isEndpoint = mode === 'range' && (iso === rStart || iso === rEnd || iso === rangeStart);
            const active = selectedMulti || selectedSingle || inRange || isEndpoint;
            return (
              <Box
                key={iso}
                role="button"
                tabIndex={0}
                aria-pressed={active}
                onClick={() => handleDay(iso)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleDay(iso); } }}
                sx={{
                  height: 36,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: `${theme.radii.sm}px`,
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  fontWeight: active ? 700 : 500,
                  fontFeatureSettings: '"tnum" 1',
                  color: active ? '#fff' : (weekend ? theme.palette.error.main : 'text.primary'),
                  bgcolor: active ? theme.palette.primary.main : (inRange ? alpha(theme.palette.primary.main, 0.1) : 'transparent'),
                  '&:hover': { bgcolor: active ? theme.palette.primary.dark : theme.gray[100] },
                  '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 1 },
                }}
              >
                {day}
              </Box>
            );
          })}
        </Box>
        {mode === 'multi' && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
            <Button size="small" onClick={() => { setRangeStart(null); onClose(); }} sx={{ minHeight: 40 }}>완료</Button>
          </Box>
        )}
        {mode === 'range' && (
          <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 1, textAlign: 'center' }}>
            {rangeStart ? '종료일을 선택하세요' : '시작일 → 종료일 순으로 선택'}
          </Typography>
        )}
      </Box>
    </Popover>
  );
};

/**
 * DateField — 단일 날짜 입력 필드 (TextField type="date" 대체).
 * 표시 "YYYY.MM.DD(요일)" · 클릭 → CalendarPopover(single) · 클리어 가능.
 *
 * props:
 *  - label, value(ISO 'YYYY-MM-DD' | ''), onChange(iso | null)
 *  - disabled, clearable(기본 true), helperText, placeholder, fullWidth(기본 true), sx, size
 */
const formatKoDate = (iso) => (iso ? `${iso.replaceAll('-', '.')}(${WDAY[parseISO(iso).getDay()]})` : '');

const DateField = ({
  label, value, onChange,
  disabled = false, clearable = true, helperText, placeholder = '날짜 선택', fullWidth = true, sx, size,
}) => {
  const [anchor, setAnchor] = useState(null);

  const openCalendar = (e) => {
    if (!disabled) setAnchor(e.currentTarget);
  };

  return (
    <>
      <TextField
        label={label}
        value={formatKoDate(value)}
        placeholder={placeholder}
        fullWidth={fullWidth}
        sx={sx}
        size={size}
        disabled={disabled}
        helperText={helperText}
        onClick={openCalendar}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCalendar(e); } }}
        InputLabelProps={{ shrink: true }}
        InputProps={{
          readOnly: true,
          endAdornment: (
            <InputAdornment position="end">
              {clearable && value && !disabled && (
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); onChange(null); }}
                  aria-label={`${label || '날짜'} 지우기`}
                  sx={{ width: 28, height: 28, mr: 0.25 }}
                >
                  <ClearIcon sx={{ fontSize: 16 }} />
                </IconButton>
              )}
              <CalendarMonthIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
            </InputAdornment>
          ),
          sx: {
            cursor: disabled ? 'default' : 'pointer',
            '& input': { cursor: 'inherit', caretColor: 'transparent', fontFeatureSettings: '"tnum" 1' },
          },
        }}
      />
      {anchor && (
        <CalendarPopover
          anchorEl={anchor}
          open
          onClose={() => setAnchor(null)}
          mode="single"
          value={value || null}
          monthBase={value || null}
          onChange={(iso) => onChange(iso)}
        />
      )}
    </>
  );
};

export default DateField;
