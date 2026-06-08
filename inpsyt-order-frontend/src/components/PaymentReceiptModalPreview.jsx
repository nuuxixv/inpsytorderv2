import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Button, IconButton, Divider, useTheme, useMediaQuery,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Menu, MenuItem, ListItemIcon, ListItemText, ListSubheader,
  Select, FormControl, InputLabel, TextField, Tooltip, Popover, Checkbox,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ReceiptLong as ReceiptLongIcon,
  Close as CloseIcon,
  Download as DownloadIcon,
  Add as AddIcon,
  PersonAddAlt as PersonAddIcon,
  DeleteOutline as DeleteOutlineIcon,
  MoreVert as MoreVertIcon,
  EventNote as EventNoteIcon,
  CalendarMonth as CalendarMonthIcon,
  WbSunny as WbSunnyIcon,
  Flight as FlightIcon,
  WarningAmberRounded as WarningIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  CheckCircleRounded as CheckCircleIcon,
} from '@mui/icons-material';
import { PageHeader, SectionCard, EmptyState } from './ui';
import PreviewShell from './preview/PreviewShell';
import { numberToKoreanCurrency } from '../utils/koreanCurrency';

/**
 * DEV-ONLY keystone: /preview/payment-receipt.
 * A10b 지불증(수당 영수증) 생성 모달 시안 — 모달 열린 상태로 렌더(눈 확인용).
 *
 * 사양: design-system/specs/A10_PaymentReceiptModal.md
 *  - §2 수당규정(반일40k·종일70k·출장20k·범위 내 평일수) + 같은날짜 중복지급 금지
 *  - §3 입력단위 = 「날짜/항목 블록」 (엑셀 양식 블록과 1:1)
 *  - §4 모달구조(블록 리스트 + 인원 + 하단 총합+한글)
 *  - §5 직급(차장>과장>대리>사원 고정 드롭다운, 정렬축)
 *
 * 축 전환(2026-06-08): 기존 "멤버 카드 중심" → "날짜/항목 블록 중심".
 *  - 양식(주말근무 블록 + 출장비 블록)과 1:1 매핑되어 export 동적행 생성과 직결.
 *  - 주말출근비 블록: 날짜 다중선택(여러 날) + 시간대(반일/종일) 공통 + 인원 리스트(각자 단가×날짜수).
 *  - 출장비 블록: 날짜 범위선택(시작~종료) → 평일수 자동(범위 내 월~금) + 인원 리스트(각자 20,000×평일수).
 *  - 한 인원이 여러 블록 등장 가능. 같은 인원·같은 날짜가 주말+출장 양쪽이면 중복 경고(§2).
 *
 * datepicker: @mui/x-date-pickers 미설치 → date-fns 기반 자체 경량 캘린더 팝오버로 구현(시안).
 *  실서비스에서 라이브러리 도입 여부는 frontend-engineer 판단(후속).
 * 실 export 로직은 utils/depositResolution.js 패턴 확장(allowanceRules.js 신규). 시안은 미연결.
 */

// ─── 수당 규정 (고정 단가) — §2 ────────────────────────────────
const HALF_RATE = 40000; // 반일
const FULL_RATE = 70000; // 종일
const TRIP_RATE = 20000; // 출장 평일 1일당

// ─── 주말출근 시간대 규정(고정) — slot 단위 선택 ─────────────────
const WEEKEND_SLOTS = [
  { id: 'am0913', label: '09:00~13:00', start: '09:00', end: '13:00', meal: false, rate: HALF_RATE, category: 'half' },
  { id: 'am0914', label: '09:00~14:00', start: '09:00', end: '14:00', meal: true, rate: HALF_RATE, category: 'half' },
  { id: 'am1014', label: '10:00~14:00', start: '10:00', end: '14:00', meal: false, rate: HALF_RATE, category: 'half' },
  { id: 'am1015', label: '10:00~15:00', start: '10:00', end: '15:00', meal: true, rate: HALF_RATE, category: 'half' },
  { id: 'pm1317', label: '13:00~17:00', start: '13:00', end: '17:00', meal: false, rate: HALF_RATE, category: 'half' },
  { id: 'full0917', label: '09:00~17:00', start: '09:00', end: '17:00', meal: null, rate: FULL_RATE, category: 'full' },
  { id: 'full1018', label: '10:00~18:00', start: '10:00', end: '18:00', meal: null, rate: FULL_RATE, category: 'full' },
];
const DEFAULT_WEEKEND_SLOT_ID = 'full0917';
const getWeekendSlot = (slotId) =>
  WEEKEND_SLOTS.find((s) => s.id === slotId) || WEEKEND_SLOTS.find((s) => s.id === DEFAULT_WEEKEND_SLOT_ID);

// ─── 직급 (차장>과장>대리>사원 고정) — §5 ──────────────────────
const POSITIONS = ['차장', '과장', '대리', '사원'];
const POSITION_RANK = Object.fromEntries(POSITIONS.map((p, i) => [p, i]));

// ─── Mock: 로그인 관리자(영수인) ───────────────────────────────
const ME = { id: 'u-me', name: '김현장', position: '대리' };

// ─── Mock: 학회(읽기) ──────────────────────────────────────────
// 부산 지방 학회 가정 → 출장 발생. 10/15(목)~10/16(금) 출장(평일2) + 10/17(토)·10/18(일) 주말근무.
const MOCK_EVENT = {
  name: '2026 한국심리학회 추계학술대회',
  venue: '부산 BEXCO 제1전시장',
  startDate: '2026-10-15',
  endDate: '2026-10-18',
};

// ─── Mock: 참석자 후보(attendee_ids → user_profiles join, 직급 자동) ──
// 정렬: 직급순(차장>과장>대리>사원) → 이름순. 멀티선택으로 블록에 투입.
const ATTENDEE_POOL = [
  { id: 'u-001', name: '박차장', position: '차장' },
  { id: 'u-004', name: '정마스터', position: '과장' },
  { id: 'u-me', name: '김현장', position: '대리' },
  { id: 'u-002', name: '이부스', position: '사원' },
  { id: 'u-003', name: '최접수', position: '사원' },
];

// ─── 날짜 유틸 (date-fns 미사용 — 순수 JS, 시안 경량화) ──────────
const WDAY = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (iso) => new Date(iso + 'T00:00:00');
const dow = (iso) => WDAY[parseISO(iso).getDay()];
const dot = (iso) => iso.slice(5).replace('-', '.'); // 10-18 → 10.18
const isWeekend = (iso) => [0, 6].includes(parseISO(iso).getDay());
const won = (n) => `${n.toLocaleString()}원`;
const dayDiff = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000); // b−a (일수)
const isWeekday = (iso) => ![0, 6].includes(parseISO(iso).getDay()); // 월~금

const sortMembers = (arr) =>
  [...arr].sort((a, b) => {
    const r = (POSITION_RANK[a.position] ?? 99) - (POSITION_RANK[b.position] ?? 99);
    return r !== 0 ? r : a.name.localeCompare(b.name, 'ko');
  });

// ─── Mock 초기 블록 (주말근무 1개 + 출장 1개, 각 인원 2~3명) ─────
let _bid = 0;
const nextBlockId = () => `blk-${++_bid}`;
const INITIAL_BLOCKS = [
  {
    id: nextBlockId(),
    type: 'weekend',
    slotId: 'full0917', // WEEKEND_SLOTS 규정 (블록 공통)
    dates: ['2026-10-17', '2026-10-18'], // 토·일 다중선택
    members: [
      { id: 'u-004', name: '정마스터', position: '과장', adhoc: false },
      { id: 'u-me', name: '김현장', position: '대리', adhoc: false },
      { id: 'u-002', name: '이부스', position: '사원', adhoc: false },
    ],
  },
  {
    id: nextBlockId(),
    type: 'trip',
    start: '2026-10-15', // 범위 시작 (목)
    end: '2026-10-16',   // 범위 종료 (금) → 평일 2일(목·금) = 40,000
    members: [
      { id: 'u-004', name: '정마스터', position: '과장', adhoc: false },
      { id: 'u-me', name: '김현장', position: '대리', adhoc: false },
    ],
  },
];

// ─── 블록 금액 계산 ────────────────────────────────────────────
const weekendUnit = (block) => getWeekendSlot(block.slotId).rate;
// 출장 평일 날짜 배열: 범위 [start..end] 포함, 월~금만(토·일 제외).
const tripWeekdayDates = (block) => {
  const out = [];
  if (!block.start || !block.end) return out;
  const n = dayDiff(block.start, block.end);
  for (let i = 0; i <= n; i++) {
    const d = parseISO(block.start);
    d.setDate(d.getDate() + i);
    const iso = toISO(d);
    if (isWeekday(iso)) out.push(iso);
  }
  return out;
};
const tripWeekdays = (block) => tripWeekdayDates(block).length;
const perMemberAmount = (block) =>
  block.type === 'weekend'
    ? weekendUnit(block) * (block.dates?.length || 0)
    : TRIP_RATE * tripWeekdays(block);
const blockTotal = (block) => perMemberAmount(block) * (block.members?.length || 0);

// 블록이 차지하는 날짜 집합 (중복 검증용). 출장 = 평일만(토·일은 출장 점유 아님).
const blockDateSet = (block) =>
  block.type === 'weekend' ? new Set(block.dates || []) : new Set(tripWeekdayDates(block));

// ─── 중복 검증: 같은 인원이 같은 날짜에 주말+출장 양쪽 ───────────
// 반환: Map<memberId, Set<isoDate>> (충돌 날짜)
const computeConflicts = (blocks) => {
  // memberId → { weekend:Set, trip:Set }
  const byMember = new Map();
  blocks.forEach((b) => {
    const dates = blockDateSet(b);
    (b.members || []).forEach((m) => {
      if (!byMember.has(m.id)) byMember.set(m.id, { weekend: new Set(), trip: new Set() });
      const slot = byMember.get(m.id);
      const target = b.type === 'weekend' ? slot.weekend : slot.trip;
      dates.forEach((d) => target.add(d));
    });
  });
  const conflicts = new Map();
  byMember.forEach((slot, mid) => {
    const overlap = [...slot.weekend].filter((d) => slot.trip.has(d));
    if (overlap.length) conflicts.set(mid, new Set(overlap));
  });
  return conflicts;
};

// ════════════════════════════════════════════════════════════════
// 경량 캘린더 팝오버 (다중선택 / 범위선택)
// ════════════════════════════════════════════════════════════════
const CalendarPopover = ({ anchorEl, open, onClose, mode, value, onChange, monthBase }) => {
  const theme = useTheme();
  // monthBase: 표시 기준 달 ISO. 내부 상태로 월 이동.
  const [cursor, setCursor] = useState(() => {
    const base = monthBase ? parseISO(monthBase) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // 범위 모드 상태: 첫 클릭=시작, 둘째 클릭=종료
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
    if (mode === 'multi') {
      const next = new Set(value || []);
      if (next.has(iso)) next.delete(iso); else next.add(iso);
      onChange([...next].sort());
    } else {
      // range
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
        {/* 월 네비 */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <IconButton size="small" onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="이전 달" sx={{ width: 36, height: 36 }}>
            <ChevronLeftIcon sx={{ fontSize: 20 }} />
          </IconButton>
          <Typography variant="subtitle2" sx={{ fontFeatureSettings: '"tnum" 1' }}>{year}년 {month + 1}월</Typography>
          <IconButton size="small" onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="다음 달" sx={{ width: 36, height: 36 }}>
            <ChevronRightIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>
        {/* 요일 헤더 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.5 }}>
          {WDAY.map((w, i) => (
            <Typography key={w} variant="caption" align="center" sx={{ fontWeight: 700, color: i === 0 || i === 6 ? theme.palette.error.main : 'text.disabled', py: 0.5 }}>
              {w}
            </Typography>
          ))}
        </Box>
        {/* 날짜 그리드 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.25 }}>
          {cells.map((iso, idx) => {
            if (!iso) return <Box key={`e${idx}`} sx={{ height: 36 }} />;
            const day = parseISO(iso).getDate();
            const weekend = isWeekend(iso);
            const selectedMulti = selectedSet?.has(iso);
            const inRange = isInRange(iso);
            const isEndpoint = mode === 'range' && (iso === rStart || iso === rEnd || iso === rangeStart);
            const active = selectedMulti || inRange || isEndpoint;
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

// ════════════════════════════════════════════════════════════════
// 인원 추가 메뉴 (참석자 멀티선택 + 참관 직원 인라인)
// ════════════════════════════════════════════════════════════════
const AddMemberMenu = ({ anchorEl, open, onClose, existingIds, onAddAttendees, onAddObserver }) => {
  const theme = useTheme();
  const [picked, setPicked] = useState(new Set());
  const [obsName, setObsName] = useState('');
  const [obsPosition, setObsPosition] = useState('사원');

  const candidates = useMemo(
    () => sortMembers(ATTENDEE_POOL.filter((p) => !existingIds.has(p.id))),
    [existingIds],
  );

  const toggle = (id) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const close = () => { setPicked(new Set()); setObsName(''); setObsPosition('사원'); onClose(); };

  const confirmAttendees = () => {
    const chosen = candidates.filter((c) => picked.has(c.id));
    if (chosen.length) onAddAttendees(chosen);
    close();
  };
  const confirmObserver = () => {
    if (obsName.trim()) onAddObserver(obsName.trim(), obsPosition);
    close();
  };

  return (
    <Popover
      anchorEl={anchorEl}
      open={open}
      onClose={close}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{ paper: { sx: { width: 320, borderRadius: `${theme.radii.md}px`, mt: 0.5 } } }}
    >
      <Box sx={{ p: 1.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', px: 0.5 }}>참석자</Typography>
        {candidates.length === 0 ? (
          <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', px: 0.5, py: 1 }}>
            추가할 참석자가 없습니다. 아래에서 참관 직원을 추가하세요.
          </Typography>
        ) : (
          <Box sx={{ mt: 0.5, mb: 1 }}>
            {candidates.map((c) => {
              const checked = picked.has(c.id);
              return (
                <Box
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    px: 0.5, minHeight: 44, borderRadius: `${theme.radii.sm}px`, cursor: 'pointer',
                    '&:hover': { bgcolor: theme.gray[50] },
                  }}
                >
                  <Checkbox checked={checked} size="small" sx={{ p: 0.5 }} tabIndex={-1} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.name}</Typography>
                  <Box sx={{ px: 0.75, py: 0.125, borderRadius: `${theme.radii.sm}px`, bgcolor: theme.gray[100] }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>{c.position}</Typography>
                  </Box>
                </Box>
              );
            })}
            <Button
              fullWidth size="small" variant="contained" disabled={picked.size === 0}
              onClick={confirmAttendees} sx={{ mt: 0.5, minHeight: 40 }}
            >
              {picked.size > 0 ? `${picked.size}명 추가` : '참석자 선택'}
            </Button>
          </Box>
        )}

        <Divider sx={{ my: 1 }} />

        <Typography variant="caption" sx={{ fontWeight: 700, color: theme.accent.attention, px: 0.5 }}>
          참관 직원 (저장 안 됨 · 1회성)
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mt: 1, px: 0.5 }}>
          <TextField
            size="small" placeholder="이름" value={obsName}
            onChange={(e) => setObsName(e.target.value)}
            sx={{ flex: 1, '& .MuiInputBase-root': { minHeight: 44 } }}
            onKeyDown={(e) => { if (e.key === 'Enter') confirmObserver(); }}
          />
          <FormControl size="small" sx={{ flex: '0 0 84px' }}>
            <Select value={obsPosition} onChange={(e) => setObsPosition(e.target.value)} sx={{ minHeight: 44 }}>
              {POSITIONS.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
        <Button
          fullWidth size="small" variant="outlined" disabled={!obsName.trim()}
          startIcon={<PersonAddIcon sx={{ fontSize: 16 }} />}
          onClick={confirmObserver} sx={{ mt: 1, minHeight: 40 }}
        >
          참관 직원 추가
        </Button>
      </Box>
    </Popover>
  );
};

// ════════════════════════════════════════════════════════════════
// 인원 행 (블록 내부 1명)
// ════════════════════════════════════════════════════════════════
const MemberRow = ({ member, amount, conflictDates, onRemove }) => {
  const theme = useTheme();
  const hasConflict = conflictDates && conflictDates.size > 0;
  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        px: 1.25, py: 0.875,
        borderRadius: `${theme.radii.sm}px`,
        bgcolor: hasConflict ? alpha(theme.palette.error.main, 0.05) : 'transparent',
        border: hasConflict ? `1px solid ${alpha(theme.palette.error.main, 0.3)}` : '1px solid transparent',
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>{member.name}</Typography>
      <Box sx={{ px: 0.625, py: 0.125, borderRadius: `${theme.radii.sm}px`, bgcolor: theme.gray[100] }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>{member.position}</Typography>
      </Box>
      {member.adhoc && (
        <Box sx={{ px: 0.625, py: 0.125, borderRadius: `${theme.radii.sm}px`, bgcolor: alpha(theme.accent.attention, 0.12), border: `1px solid ${alpha(theme.accent.attention, 0.28)}` }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: theme.accent.attention }}>참관</Typography>
        </Box>
      )}
      {hasConflict && (
        <Tooltip title={`${[...conflictDates].map(dot).join(', ')} — 같은 날짜에 주말근무·출장 중복 지급 (한쪽을 빼주세요)`} arrow>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, color: theme.palette.error.main }}>
            <WarningIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption" sx={{ fontWeight: 700 }}>날짜 중복</Typography>
          </Box>
        </Tooltip>
      )}
      <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, fontFeatureSettings: '"tnum" 1', color: 'text.primary' }}>
          {won(amount)}
        </Typography>
        <IconButton size="small" onClick={onRemove} aria-label={`${member.name} 제거`} sx={{ width: 32, height: 32, color: 'text.disabled', '&:hover': { color: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.06) } }}>
          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
    </Box>
  );
};

// ════════════════════════════════════════════════════════════════
// 항목 블록 카드 (주말근무 / 출장)
// ════════════════════════════════════════════════════════════════
const BlockCard = ({ block, conflicts, onUpdate, onRemove }) => {
  const theme = useTheme();
  const isWeekendBlk = block.type === 'weekend';
  const accent = isWeekendBlk ? theme.palette.error.main : theme.palette.info.main;
  const Icon = isWeekendBlk ? WbSunnyIcon : FlightIcon;

  const [calAnchor, setCalAnchor] = useState(null);
  const [addAnchor, setAddAnchor] = useState(null);

  const unit = isWeekendBlk ? weekendUnit(block) : TRIP_RATE;
  const weekdays = isWeekendBlk ? 0 : tripWeekdays(block);
  const per = perMemberAmount(block);
  const total = blockTotal(block);
  const slot = isWeekendBlk ? getWeekendSlot(block.slotId) : null;
  const existingIds = useMemo(() => new Set((block.members || []).map((m) => m.id)), [block.members]);

  // 라벨
  const dateLabel = isWeekendBlk
    ? (block.dates?.length
        ? block.dates.map((d) => `${dot(d)}(${dow(d)})`).join(', ')
        : '날짜 선택 필요')
    : (block.start && block.end
        ? `${dot(block.start)}(${dow(block.start)})~${dot(block.end)}(${dow(block.end)})`
        : '기간 선택 필요');

  // 인원별 충돌 날짜
  const memberConflict = (mid) => {
    const c = conflicts.get(mid);
    if (!c) return null;
    const set = blockDateSet(block);
    const overlap = new Set([...c].filter((d) => set.has(d)));
    return overlap.size ? overlap : null;
  };

  return (
    <Box sx={{ border: `1px solid ${theme.gray[200]}`, borderRadius: `${theme.radii.lg}px`, bgcolor: 'background.paper', overflow: 'hidden' }}>
      {/* 블록 헤더 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, borderBottom: `1px solid ${theme.gray[100]}`, bgcolor: alpha(accent, 0.04) }}>
        <Box sx={{ width: 30, height: 30, borderRadius: `${theme.radii.sm}px`, bgcolor: alpha(accent, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon sx={{ fontSize: 18, color: accent }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ color: 'text.primary', lineHeight: 1.3 }}>
            {isWeekendBlk ? '주말출근비' : '출장비'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {isWeekendBlk
              ? `${slot.category === 'full' ? '종일' : '반일'} ${won(unit)} × ${block.dates?.length || 0}일`
              : `${won(TRIP_RATE)} × ${weekdays}일`}
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="subtitle2" sx={{ fontFeatureSettings: '"tnum" 1', color: total > 0 ? 'text.primary' : 'text.disabled' }}>
            {won(total)}
          </Typography>
          <Tooltip title="블록 삭제" arrow>
            <IconButton size="small" onClick={onRemove} aria-label="블록 삭제" sx={{ width: 34, height: 34, color: 'text.disabled', '&:hover': { color: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.06) } }}>
              <DeleteOutlineIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box sx={{ px: 2, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {/* 날짜 + (주말: 시간대) 컨트롤 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined" size="small"
            startIcon={<CalendarMonthIcon sx={{ fontSize: 18 }} />}
            onClick={(e) => setCalAnchor(e.currentTarget)}
            sx={{ minHeight: 44, borderColor: theme.gray[300], color: 'text.primary', flexShrink: 0 }}
          >
            {isWeekendBlk ? '근무일 선택' : '출장 기간'}
          </Button>
          <Typography variant="body2" sx={{ fontWeight: 600, color: block.dates?.length || (block.start && block.end) ? 'text.primary' : 'text.disabled', fontFeatureSettings: '"tnum" 1' }}>
            {dateLabel}
          </Typography>
          <CalendarPopover
            anchorEl={calAnchor}
            open={Boolean(calAnchor)}
            onClose={() => setCalAnchor(null)}
            mode={isWeekendBlk ? 'multi' : 'range'}
            monthBase={isWeekendBlk ? (block.dates?.[0] || MOCK_EVENT.startDate) : (block.start || MOCK_EVENT.startDate)}
            value={isWeekendBlk ? block.dates : { start: block.start, end: block.end }}
            onChange={(v) =>
              isWeekendBlk
                ? onUpdate({ ...block, dates: v })
                : onUpdate({ ...block, start: v.start, end: v.end })
            }
          />
        </Box>

        {/* 주말 블록: 시간대 규정 드롭다운 (반일 5 / 종일 2) */}
        {isWeekendBlk && (
          <FormControl size="small" sx={{ maxWidth: 360 }}>
            <InputLabel id={`slot-${block.id}`}>근무 시간대</InputLabel>
            <Select
              labelId={`slot-${block.id}`}
              label="근무 시간대"
              value={slot.id}
              onChange={(e) => onUpdate({ ...block, slotId: e.target.value })}
              sx={{ minHeight: 48, '& .MuiSelect-select': { display: 'flex', alignItems: 'center', gap: 0.75 } }}
              renderValue={(id) => {
                const s = getWeekendSlot(id);
                return (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Typography component="span" variant="body2" sx={{ fontWeight: 600, fontFeatureSettings: '"tnum" 1' }}>{s.label}</Typography>
                    <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
                      {s.category === 'full' ? '종일' : '반일'} {s.rate.toLocaleString()}
                    </Typography>
                  </Box>
                );
              }}
            >
              <ListSubheader sx={{ lineHeight: 2.2, fontWeight: 700, color: theme.palette.error.main }}>반일 · 40,000</ListSubheader>
              {WEEKEND_SLOTS.filter((s) => s.category === 'half').map((s) => (
                <MenuItem key={s.id} value={s.id} sx={{ minHeight: 44, gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontFeatureSettings: '"tnum" 1' }}>{s.label}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled', ml: 'auto' }}>{s.meal ? '식사 O' : '식사 X'}</Typography>
                </MenuItem>
              ))}
              <ListSubheader sx={{ lineHeight: 2.2, fontWeight: 700, color: theme.palette.primary.main }}>종일 · 70,000</ListSubheader>
              {WEEKEND_SLOTS.filter((s) => s.category === 'full').map((s) => (
                <MenuItem key={s.id} value={s.id} sx={{ minHeight: 44, gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontFeatureSettings: '"tnum" 1' }}>{s.label}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled', ml: 'auto' }}>식사 자유</Typography>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Divider sx={{ borderColor: theme.gray[100] }} />

        {/* 인원 리스트 */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
            인원 {block.members?.length || 0}명 · 1인 {won(per)}
          </Typography>
        </Box>

        {(block.members?.length || 0) === 0 ? (
          <Typography variant="caption" sx={{ color: 'text.disabled', py: 1, textAlign: 'center' }}>
            인원을 추가하세요. 각자 {won(per)}이 지급됩니다.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            {sortMembers(block.members).map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                amount={per}
                conflictDates={memberConflict(m.id)}
                onRemove={() => onUpdate({ ...block, members: block.members.filter((x) => x.id !== m.id) })}
              />
            ))}
          </Box>
        )}

        {/* 인원 추가 */}
        <Button
          fullWidth variant="text" size="small"
          startIcon={<PersonAddIcon sx={{ fontSize: 18 }} />}
          onClick={(e) => setAddAnchor(e.currentTarget)}
          sx={{ minHeight: 44, color: 'primary.main', justifyContent: 'center', border: `1px dashed ${theme.gray[300]}`, borderRadius: `${theme.radii.md}px` }}
        >
          인원 추가
        </Button>
        <AddMemberMenu
          anchorEl={addAnchor}
          open={Boolean(addAnchor)}
          onClose={() => setAddAnchor(null)}
          existingIds={existingIds}
          onAddAttendees={(arr) => onUpdate({ ...block, members: [...block.members, ...arr.map((a) => ({ ...a, adhoc: false }))] })}
          onAddObserver={(name, position) => onUpdate({ ...block, members: [...block.members, { id: `adhoc-${Date.now()}`, name, position, adhoc: true }] })}
        />
      </Box>
    </Box>
  );
};

// ════════════════════════════════════════════════════════════════
// 지불증 모달 본체
// ════════════════════════════════════════════════════════════════
const PaymentReceiptModal = ({ open, onClose, onToast }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [blocks, setBlocks] = useState(INITIAL_BLOCKS);
  const [addBlockAnchor, setAddBlockAnchor] = useState(null);

  const conflicts = useMemo(() => computeConflicts(blocks), [blocks]);
  const conflictCount = conflicts.size;

  const grandTotal = useMemo(() => blocks.reduce((s, b) => s + blockTotal(b), 0), [blocks]);
  const koreanTotal = numberToKoreanCurrency(grandTotal);

  // 지급 인원 수 = 유니크 멤버(금액>0인 블록에 속한)
  const paidMemberCount = useMemo(() => {
    const ids = new Set();
    blocks.forEach((b) => { if (perMemberAmount(b) > 0) (b.members || []).forEach((m) => ids.add(m.id)); });
    return ids.size;
  }, [blocks]);

  const updateBlock = (id, next) => setBlocks((prev) => prev.map((b) => (b.id === id ? next : b)));
  const removeBlock = (id) => setBlocks((prev) => prev.filter((b) => b.id !== id));
  const addBlock = (type) => {
    const base = type === 'weekend'
      ? { id: nextBlockId(), type: 'weekend', slotId: DEFAULT_WEEKEND_SLOT_ID, dates: [], members: [] }
      : { id: nextBlockId(), type: 'trip', start: null, end: null, members: [] };
    setBlocks((prev) => [...prev, base]);
    setAddBlockAnchor(null);
    onToast(`${type === 'weekend' ? '주말출근비' : '출장비'} 블록 추가 (mock)`);
  };

  const empty = blocks.length === 0;
  const noMembers = !empty && blocks.every((b) => (b.members?.length || 0) === 0);
  const allZero = !empty && grandTotal === 0;
  const downloadDisabled = empty || allZero || conflictCount > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      scroll="paper"
      PaperProps={{ sx: { borderRadius: isMobile ? 0 : `${theme.radii.lg}px`, maxWidth: 640, width: '100%' } }}
    >
      {/* 헤더 */}
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25, pb: 1.5 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: `${theme.radii.sm}px`, bgcolor: alpha(theme.palette.primary.main, 0.1), border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ReceiptLongIcon sx={{ fontSize: 20, color: 'primary.main' }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="div" variant="h4" sx={{ letterSpacing: '-0.02em' }}>지불증 내보내기</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>참석 직원 수당(주말출근·출장비) 영수증</Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="닫기" sx={{ width: 40, height: 40, color: 'text.secondary' }}>
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ bgcolor: theme.gray[50] }}>
        {/* 상단: 학회(읽기) */}
        <Box sx={{ mt: 0.5, mb: 2, p: 2, borderRadius: `${theme.radii.md}px`, bgcolor: 'background.paper', border: `1px solid ${theme.gray[200]}` }}>
          <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>{MOCK_EVENT.name}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
            <EventNoteIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1' }}>
              {dot(MOCK_EVENT.startDate)} ~ {dot(MOCK_EVENT.endDate)} · {MOCK_EVENT.venue}
            </Typography>
          </Box>
        </Box>

        {/* 중복 경고 배너 (전역) */}
        {conflictCount > 0 && (
          <Box sx={{ mb: 2, p: 1.5, borderRadius: `${theme.radii.md}px`, bgcolor: alpha(theme.palette.error.main, 0.06), border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <WarningIcon sx={{ fontSize: 18, color: 'error.main', mt: 0.125 }} />
            <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600, lineHeight: 1.5 }}>
              같은 날짜에 주말출근비·출장비가 중복 지급된 인원이 {conflictCount}명 있습니다.
              같은 날짜에는 한쪽만 지급할 수 있어요(중복 인원은 빨간 표시). 해결 전에는 다운로드할 수 없습니다.
            </Typography>
          </Box>
        )}

        {/* 블록 리스트 */}
        {empty ? (
          <Box sx={{ bgcolor: 'background.paper', border: `1px solid ${theme.gray[200]}`, borderRadius: `${theme.radii.lg}px` }}>
            <EmptyState
              icon={ReceiptLongIcon}
              title="항목이 없습니다"
              description="주말출근비 또는 출장비 항목을 추가해 지불증을 작성하세요."
              action={{ label: '항목 추가', onClick: (e) => setAddBlockAnchor(e.currentTarget), startIcon: <AddIcon sx={{ fontSize: 18 }} /> }}
            />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {blocks.map((b) => (
              <BlockCard
                key={b.id}
                block={b}
                conflicts={conflicts}
                onUpdate={(next) => updateBlock(b.id, next)}
                onRemove={() => removeBlock(b.id)}
              />
            ))}
          </Box>
        )}

        {/* 항목 추가 */}
        <Button
          fullWidth variant="outlined"
          startIcon={<AddIcon sx={{ fontSize: 18 }} />}
          onClick={(e) => setAddBlockAnchor(e.currentTarget)}
          sx={{
            mt: 1.5, minHeight: 48, borderStyle: 'dashed', borderColor: theme.gray[300],
            color: 'text.secondary', bgcolor: 'background.paper',
            '&:hover': { borderColor: 'primary.main', color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.03) },
          }}
        >
          항목 추가
        </Button>
        <Menu anchorEl={addBlockAnchor} open={Boolean(addBlockAnchor)} onClose={() => setAddBlockAnchor(null)}>
          <MenuItem onClick={() => addBlock('weekend')} sx={{ minHeight: 48, gap: 1 }}>
            <ListItemIcon><WbSunnyIcon sx={{ fontSize: 20, color: theme.palette.error.main }} /></ListItemIcon>
            <ListItemText primary="주말출근비" secondary="여러 날 선택 · 시간대 규정" primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }} secondaryTypographyProps={{ variant: 'caption' }} />
          </MenuItem>
          <MenuItem onClick={() => addBlock('trip')} sx={{ minHeight: 48, gap: 1 }}>
            <ListItemIcon><FlightIcon sx={{ fontSize: 20, color: theme.palette.info.main }} /></ListItemIcon>
            <ListItemText primary="출장비" secondary="기간 선택 · 20,000원/평일" primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }} secondaryTypographyProps={{ variant: 'caption' }} />
          </MenuItem>
        </Menu>
      </DialogContent>

      {/* 하단: 총합 미리보기 + 다운로드 */}
      <DialogActions sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 1.5, px: 3, py: 2.5 }}>
        <Box sx={{ p: 2, borderRadius: `${theme.radii.md}px`, bgcolor: allZero || empty ? theme.gray[50] : alpha(theme.palette.primary.main, 0.04), border: `1px solid ${allZero || empty ? theme.gray[200] : alpha(theme.palette.primary.main, 0.16)}` }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2 }}>
            <Typography variant="subtitle1" sx={{ color: 'text.primary' }}>
              총 지급액
              {!empty && (
                <Typography component="span" variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, ml: 0.75 }}>
                  지급 인원 {paidMemberCount}명
                </Typography>
              )}
            </Typography>
            <Typography variant="h4" sx={{ color: allZero || empty ? 'text.disabled' : 'primary.main', fontFeatureSettings: '"tnum" 1', letterSpacing: '-0.02em' }}>
              {won(grandTotal)}
            </Typography>
          </Box>
          {!allZero && !empty && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.25 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                금 {koreanTotal}원정
              </Typography>
            </Box>
          )}
          {(empty || noMembers || allZero) && (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
              {empty
                ? '항목을 추가하면 지급액이 계산됩니다.'
                : noMembers
                  ? '각 항목에 인원을 추가하세요.'
                  : '날짜·기간을 선택하면 지급액이 계산됩니다.'}
            </Typography>
          )}
        </Box>

        {/* 영수인(읽기) + 다운로드 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            영수인 <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>{ME.name} {ME.position}</Box>
          </Typography>
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
            <Button onClick={onClose} sx={{ minHeight: 48, color: 'text.secondary' }}>취소</Button>
            <Tooltip title={conflictCount > 0 ? '날짜 중복을 먼저 해결하세요' : ''} arrow disableHoverListener={conflictCount === 0}>
              <span>
                <Button
                  variant="contained"
                  startIcon={<DownloadIcon sx={{ fontSize: 18 }} />}
                  disabled={downloadDisabled}
                  onClick={() => onToast(`지불증 다운로드 · ${won(grandTotal)} (mock)`)}
                  sx={{ minHeight: 48 }}
                >
                  지불증 다운로드
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

// ─── Preview 래퍼 (모달 열린 상태로 렌더 + 진입 행) ─────────────
const PaymentReceiptModalPreview = () => {
  const theme = useTheme();
  const [open, setOpen] = useState(true);
  const [toast, setToast] = useState('');
  const [rowMenuAnchor, setRowMenuAnchor] = useState(null);

  const showToast = (msg) => { setToast(msg); };

  return (
    <PreviewShell activePath="/admin/events">
      <PageHeader
        title="지불증 모달 시안"
        subtitle="A10b · 학회 행 ⋯메뉴 → 지불증 내보내기 → 날짜/항목 블록 입력 → 다운로드"
        icon={ReceiptLongIcon}
      />

      {/* 진입 맥락 재현: 학회 1행 + ⋯ 메뉴 (실서비스는 A10 목록 행에서 진입) */}
      <SectionCard padding={20} sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>{MOCK_EVENT.name}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {dot(MOCK_EVENT.startDate)} ~ {dot(MOCK_EVENT.endDate)} · {MOCK_EVENT.venue}
            </Typography>
          </Box>
          <IconButton onClick={(e) => setRowMenuAnchor(e.currentTarget)} aria-label="행 메뉴" sx={{ color: 'text.secondary', '&:hover': { bgcolor: theme.gray[100] } }}>
            <MoreVertIcon sx={{ fontSize: 20 }} />
          </IconButton>
          <Menu anchorEl={rowMenuAnchor} open={Boolean(rowMenuAnchor)} onClose={() => setRowMenuAnchor(null)}>
            <MenuItem onClick={() => { setRowMenuAnchor(null); setOpen(true); }} sx={{ minHeight: 44 }}>
              <ListItemIcon><ReceiptLongIcon sx={{ fontSize: 18 }} /></ListItemIcon>
              <ListItemText primary="지불증 내보내기" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
            </MenuItem>
          </Menu>
        </Box>
        {!open && (
          <Button variant="outlined" startIcon={<ReceiptLongIcon sx={{ fontSize: 18 }} />} onClick={() => setOpen(true)} sx={{ mt: 2 }}>
            모달 다시 열기
          </Button>
        )}
      </SectionCard>

      <PaymentReceiptModal open={open} onClose={() => setOpen(false)} onToast={showToast} />

      {/* 간이 토스트 (Snackbar 대용 — 시연용) */}
      {toast && (
        <Box
          onClick={() => setToast('')}
          sx={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: 0.75,
            bgcolor: theme.gray[900], color: '#fff', px: 2, py: 1.25,
            borderRadius: `${theme.radii.md}px`, boxShadow: theme.customShadows.lg,
            fontSize: '0.875rem', fontWeight: 500, zIndex: 2000, cursor: 'pointer',
          }}
        >
          <CheckCircleIcon sx={{ fontSize: 18 }} />
          {toast}
        </Box>
      )}
    </PreviewShell>
  );
};

export default PaymentReceiptModalPreview;
