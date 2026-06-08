import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Menu, ListItemIcon, ListItemText, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, useTheme, useMediaQuery,
  InputAdornment, Autocomplete, Checkbox,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  EventNote as EventNoteIcon,
  FilterList as FilterListIcon,
  Add as AddIcon,
  Edit as EditIcon,
  OpenInNew as OpenInNewIcon,
  ContentCopy as ContentCopyIcon,
  QrCode2 as QrCode2Icon,
  Close as CloseIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  PlaceOutlined as PlaceIcon,
  PersonOutline as PersonIcon,
  LocalOffer as LocalOfferIcon,
  StarBorder as StarBorderIcon,
} from '@mui/icons-material';
import { PageHeader, SectionCard, StatusBadge, EmptyState } from './ui';
import PreviewShell from './preview/PreviewShell';

/**
 * DEV-ONLY keystone: /preview/event-hub.
 * A10 학회 통합 목록 뷰(Event Hub List) L1 시안 — EventManagementPage 를 대체.
 * 정적 Preview (mock 데이터, 실 도메인 미연결). 눈으로 확인용.
 *
 * 사양: design-system/specs/A10_EventHubList.md
 *  - §2 L1 6컬럼(번호·학회명·행사명·날짜·장소·참석자)
 *  - §4 참석자(uuid[] 참조, 칩 3+외 N명, 후보=onsite+master)
 *  - §5 종료=음영 / Upcoming=좌 brand 보더+틴트(내 참석 다음 1건)
 *  - §6 필터(올해/상반기/하반기 + 학회명 + 참석자·"나")
 *  - §7 모바일 카드(비고·비용 줄 없음)
 *  - §8-1 기존기능 보존(할인율 칩·상태배지·URL/QR/복사/열기→⋯·배송예정일→다이얼로그)
 *
 * 실 도메인 로직은 EventManagementPage.jsx 참고 (코드 카피 X, 구조만 차용).
 */

// ─── Mock: 로그인 사용자(나) ───────────────────────────────────
// 시안 시연용. 실서비스는 AuthContext user.id / role 사용.
const ME = { id: 'u-me', name: '김현장', role: 'onsite' };

// ─── Mock: 참석자 후보(user_profiles, onsite + master) ──────────
const STAFF = [
  { id: 'u-me',   name: '김현장', role: 'onsite' },
  { id: 'u-002',  name: '이부스', role: 'onsite' },
  { id: 'u-003',  name: '박운영', role: 'onsite' },
  { id: 'u-004',  name: '정마스터', role: 'master' },
  { id: 'u-005',  name: '최현장', role: 'onsite' },
];
const STAFF_MAP = Object.fromEntries(STAFF.map((s) => [s.id, s]));

// ─── Mock: 학회 목록 (날짜 오름차순으로 둠 — 실서비스 정렬 기본 ASC) ──
// today 기준 = 2026-06-08 (MEMORY currentDate). 시간상태 자동 파생 가정.
const TODAY = '2026-06-08';

const MOCK_EVENTS = [
  {
    id: 'ev-2026-summer-kyc',
    hostSociety: '한국청소년상담학회',
    season: '세미나',
    name: '2026 한국청소년상담학회 세미나',
    startDate: '2026-07-04',
    endDate: '2026-07-05',
    venue: '서울 코엑스 그랜드볼룸',
    attendeeIds: ['u-me', 'u-002'],
    discountPercent: 10,
    urlSlug: 'kyc-2026-summer',
    estimatedDeliveryDate: '',
    note: '',
    cost: 0,
  },
  {
    id: 'ev-2026-fall-kpsy',
    hostSociety: '한국심리학회',
    season: '추계학술대회',
    name: '2026 한국심리학회 추계학술대회',
    startDate: '2026-09-13',
    endDate: '2026-09-15',
    venue: '부산 BEXCO 제1전시장',
    attendeeIds: ['u-002', 'u-004'],
    discountPercent: 15,
    urlSlug: 'kpsy-2026-fall',
    estimatedDeliveryDate: '2026-09-30',
    note: '부스 위치 A-12. 도서 위주 진열.',
    cost: 1200000,
  },
  {
    id: 'ev-2026-edu-kca',
    hostSociety: '한국상담학회',
    season: '보수교육',
    name: '2026 한국상담학회 보수교육',
    startDate: '2026-11-08',
    endDate: '2026-11-08',
    venue: '코엑스 컨퍼런스룸 401',
    attendeeIds: ['u-me', 'u-003', 'u-004', 'u-005'],
    discountPercent: 0,
    urlSlug: 'kca-2026-edu',
    estimatedDeliveryDate: '',
    note: '',
    cost: 350000,
  },
  {
    id: 'ev-2026-spring-kcp',
    hostSociety: '한국임상심리학회',
    season: '춘계학술대회',
    name: '2026 한국임상심리학회 춘계학술대회',
    startDate: '2026-05-08',
    endDate: '2026-05-10',
    venue: '대전 컨벤션센터',
    attendeeIds: ['u-003'],
    discountPercent: 20,
    urlSlug: 'kcp-2026-spring',
    estimatedDeliveryDate: '2026-05-25',
    note: '',
    cost: 980000,
  },
  {
    id: 'ev-2026-edu-kpsy',
    hostSociety: '한국심리학회',
    season: '연수강좌',
    name: '2026 한국심리학회 연수강좌',
    startDate: '2026-03-21',
    endDate: '2026-03-21',
    venue: '온라인 (Zoom)',
    attendeeIds: [],
    discountPercent: 0,
    urlSlug: 'kpsy-2026-training',
    estimatedDeliveryDate: '',
    note: '',
    cost: 0,
  },
];

const HOST_SOCIETIES = [
  '한국심리학회',
  '한국임상심리학회',
  '한국상담심리학회',
  '한국청소년상담학회',
  '한국상담학회',
];

const YEAR = 2026;
const EVENT_SEASONS = ['춘계학술대회', '추계학술대회', '연수강좌', '보수교육', '세미나', '기타'];

// ─── 헬퍼 ──────────────────────────────────────────────────────

const dot = (iso) => (iso ? iso.replaceAll('-', '.') : '');

// 시간상태 자동 파생 (getEventStatusKST 시뮬레이션) → StatusBadge value 매핑
//  예정 → pending(주) · 진행중 → paid(녹) · 종료 → completed(보)
const getTimeState = (start, end) => {
  if (!start || !end) return 'upcoming';
  if (end < TODAY) return 'ended';
  if (start > TODAY) return 'upcoming';
  return 'active';
};
const STATE_TO_STATUS = { active: 'paid', upcoming: 'pending', ended: 'completed' };
const STATE_TO_LABEL = { active: '진행 중', upcoming: '예정', ended: '종료' };

const EventStateBadge = ({ start, end }) => {
  const st = getTimeState(start, end);
  return <StatusBadge value={STATE_TO_STATUS[st]} label={STATE_TO_LABEL[st]} size="sm" />;
};

// 할인율 칩 (>0%만, 행사명 옆) — §8-1 가시성 보존. 채움형 X, 의미 토큰(revenue) soft.
const DiscountChip = ({ percent }) => {
  const theme = useTheme();
  if (!percent || percent <= 0) return null;
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.375,
        px: 0.75,
        py: 0.25,
        borderRadius: `${theme.radii.sm}px`,
        bgcolor: alpha(theme.accent.revenue, 0.1),
        border: `1px solid ${alpha(theme.accent.revenue, 0.2)}`,
        flexShrink: 0,
      }}
    >
      <LocalOfferIcon sx={{ fontSize: 11, color: theme.accent.revenue }} />
      <Typography
        variant="caption"
        sx={{ fontWeight: 700, color: theme.accent.revenue, lineHeight: 1, fontFeatureSettings: '"tnum" 1' }}
      >
        {percent}%
      </Typography>
    </Box>
  );
};

// 참석자 칩 압축 — §4: 3명까지 이름 칩 / 4명+ "{첫1명} 외 N명" / 미입력 "—"
// 삭제된 uuid는 STAFF_MAP join 실패 → "(삭제)" 표시.
const AttendeeCell = ({ ids = [] }) => {
  const theme = useTheme();
  if (!ids.length) {
    return <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>;
  }
  const names = ids.map((id) => STAFF_MAP[id]?.name || '(삭제)');
  const mine = ids.includes(ME.id);

  const Pill = ({ label, accent }) => (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 0.75,
        py: 0.25,
        borderRadius: `${theme.radii.sm}px`,
        bgcolor: accent ? alpha(theme.palette.primary.main, 0.08) : theme.gray[100],
        border: `1px solid ${accent ? alpha(theme.palette.primary.main, 0.24) : theme.gray[200]}`,
      }}
    >
      <Typography
        variant="caption"
        sx={{ fontWeight: 600, color: accent ? 'primary.main' : 'text.secondary', lineHeight: 1.3 }}
      >
        {label}
      </Typography>
    </Box>
  );

  if (names.length <= 3) {
    return (
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {names.map((nm, i) => (
          <Pill key={`${nm}-${i}`} label={nm} accent={mine && ids[i] === ME.id} />
        ))}
      </Box>
    );
  }
  // 4명+ : 첫 1명 + 외 N명. 내가 포함이면 "나"를 첫 칩으로 우선 노출.
  const firstName = mine ? ME.name : names[0];
  return (
    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
      <Pill label={firstName} accent={mine} />
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
        외 {names.length - 1}명
      </Typography>
    </Box>
  );
};

// ─── ⋯ 행 액션 메뉴 ────────────────────────────────────────────
// §8-1: 수정 · 주문URL(열기/복사/QR) · 삭제(master, 주문 FK 가드)
const RowActionMenu = ({ anchorEl, onClose, onEdit, onOpenUrl, onCopyUrl, onShowQr, onDelete, canEdit, isMaster }) => {
  const theme = useTheme();
  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ paper: { sx: { minWidth: 200, borderRadius: `${theme.radii.md}px`, boxShadow: theme.customShadows.md } } }}
    >
      {canEdit && (
        <MenuItem onClick={onEdit} sx={{ minHeight: 44 }}>
          <ListItemIcon><EditIcon sx={{ fontSize: 18 }} /></ListItemIcon>
          <ListItemText primary="수정" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
        </MenuItem>
      )}
      <MenuItem onClick={onOpenUrl} sx={{ minHeight: 44 }}>
        <ListItemIcon><OpenInNewIcon sx={{ fontSize: 18 }} /></ListItemIcon>
        <ListItemText primary="주문 페이지 열기" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
      </MenuItem>
      <MenuItem onClick={onCopyUrl} sx={{ minHeight: 44 }}>
        <ListItemIcon><ContentCopyIcon sx={{ fontSize: 18 }} /></ListItemIcon>
        <ListItemText primary="주문 URL 복사" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
      </MenuItem>
      <MenuItem onClick={onShowQr} sx={{ minHeight: 44 }}>
        <ListItemIcon><QrCode2Icon sx={{ fontSize: 18 }} /></ListItemIcon>
        <ListItemText primary="QR 코드" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
      </MenuItem>
      {isMaster && (
        <>
          <Divider sx={{ my: 0.5 }} />
          <MenuItem onClick={onDelete} sx={{ minHeight: 44, color: 'error.main' }}>
            <ListItemIcon><DeleteIcon sx={{ fontSize: 18, color: theme.palette.error.main }} /></ListItemIcon>
            <ListItemText primary="삭제" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
          </MenuItem>
        </>
      )}
    </Menu>
  );
};

// ─── 데스크톱 표 행 ─────────────────────────────────────────────
const EventRow = ({ index, event, isUpcoming, onOpenMenu, onRowClick }) => {
  const theme = useTheme();
  const st = getTimeState(event.startDate, event.endDate);
  const ended = st === 'ended';

  return (
    <TableRow
      hover
      onClick={() => onRowClick(event)}
      sx={{
        cursor: 'pointer',
        // 종료 → 음영(위계 다운), Upcoming → 좌 brand 보더 + 약한 틴트
        bgcolor: isUpcoming
          ? alpha(theme.palette.primary.main, 0.04)
          : ended
          ? theme.gray[50]
          : 'transparent',
        boxShadow: isUpcoming ? `inset 3px 0 0 ${theme.palette.primary.main}` : 'none',
        '& td': ended ? { color: 'text.secondary' } : undefined,
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) },
        transition: `background-color 0.15s ${theme.easing.toss}`,
      }}
    >
      {/* 1. 번호 */}
      <TableCell sx={{ width: 56, color: 'text.disabled', fontFeatureSettings: '"tnum" 1' }}>
        <Typography variant="body2" sx={{ color: 'text.disabled', fontWeight: 500 }}>{index}</Typography>
      </TableCell>

      {/* 2. 학회명 + 상태배지 (행사명과 한 묶음의 스캔축) */}
      <TableCell sx={{ minWidth: 160 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isUpcoming && (
            <Tooltip title="내 참석 다음 학회" arrow placement="top">
              <StarBorderIcon sx={{ fontSize: 16, color: 'primary.main', flexShrink: 0 }} />
            </Tooltip>
          )}
          <Typography variant="body2" sx={{ fontWeight: 700, color: ended ? 'text.secondary' : 'text.primary' }}>
            {event.hostSociety}
          </Typography>
        </Box>
        <Box sx={{ mt: 0.5 }}>
          <EventStateBadge start={event.startDate} end={event.endDate} />
        </Box>
      </TableCell>

      {/* 3. 행사명 + 할인율 칩(>0%) */}
      <TableCell sx={{ minWidth: 180 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>{event.season}</Typography>
          <DiscountChip percent={event.discountPercent} />
        </Box>
      </TableCell>

      {/* 4. 날짜 (start ~ end) */}
      <TableCell sx={{ minWidth: 120 }}>
        <Typography variant="body2" sx={{ fontWeight: 500, fontFeatureSettings: '"tnum" 1' }}>
          {dot(event.startDate)}
        </Typography>
        {event.endDate && event.endDate !== event.startDate && (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1' }}>
            ~ {dot(event.endDate)}
          </Typography>
        )}
      </TableCell>

      {/* 5. 장소 */}
      <TableCell sx={{ minWidth: 140 }}>
        {event.venue ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <PlaceIcon sx={{ fontSize: 15, color: 'text.disabled', flexShrink: 0 }} />
            <Typography variant="body2" sx={{ color: ended ? 'text.secondary' : 'text.primary' }}>
              {event.venue}
            </Typography>
          </Box>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>
        )}
      </TableCell>

      {/* 6. 참석자 (칩 압축) */}
      <TableCell sx={{ minWidth: 150 }}>
        <AttendeeCell ids={event.attendeeIds} />
      </TableCell>

      {/* ⋯ 액션 */}
      <TableCell align="right" sx={{ width: 56 }}>
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onOpenMenu(e.currentTarget, event); }}
          sx={{ color: 'text.secondary', '&:hover': { bgcolor: theme.gray[100], color: 'text.primary' } }}
          aria-label="행 메뉴 열기"
        >
          <MoreVertIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </TableCell>
    </TableRow>
  );
};

// ─── 모바일 카드 ───────────────────────────────────────────────
// §7: 상단 학회명+행사명 / 중단 날짜·장소·참석자. 비고·비용 줄 없음.
const EventMobileCard = ({ event, isUpcoming, onOpenMenu, onRowClick }) => {
  const theme = useTheme();
  const st = getTimeState(event.startDate, event.endDate);
  const ended = st === 'ended';

  return (
    <Box
      onClick={() => onRowClick(event)}
      sx={{
        bgcolor: ended ? theme.gray[50] : 'background.paper',
        border: `1px solid ${isUpcoming ? alpha(theme.palette.primary.main, 0.3) : theme.gray[200]}`,
        borderLeft: isUpcoming ? `3px solid ${theme.palette.primary.main}` : `1px solid ${theme.gray[200]}`,
        borderRadius: `${theme.radii.lg}px`,
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        cursor: 'pointer',
        transition: `all 0.2s ${theme.easing.toss}`,
        '&:hover': { borderColor: theme.gray[300] },
      }}
    >
      {/* 상단: 상태 + 할인 + ⋯ */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <EventStateBadge start={event.startDate} end={event.endDate} />
        <DiscountChip percent={event.discountPercent} />
        <Box sx={{ ml: 'auto' }}>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); onOpenMenu(e.currentTarget, event); }}
            sx={{ color: 'text.secondary' }}
            aria-label="행 메뉴 열기"
          >
            <MoreVertIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>
      </Box>

      {/* 학회명 + 행사명 */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          {isUpcoming && <StarBorderIcon sx={{ fontSize: 16, color: 'primary.main' }} />}
          <Typography variant="subtitle1" sx={{ color: ended ? 'text.secondary' : 'text.primary', lineHeight: 1.3 }}>
            {event.hostSociety}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
          {event.season}
        </Typography>
      </Box>

      {/* 날짜 · 장소 · 참석자 */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <EventNoteIcon sx={{ fontSize: 15, color: 'text.disabled', flexShrink: 0 }} />
          <Typography variant="body2" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1' }}>
            {dot(event.startDate)}
            {event.endDate && event.endDate !== event.startDate ? ` ~ ${dot(event.endDate)}` : ''}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <PlaceIcon sx={{ fontSize: 15, color: 'text.disabled', flexShrink: 0 }} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {event.venue || '—'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
          <PersonIcon sx={{ fontSize: 15, color: 'text.disabled', flexShrink: 0, mt: 0.25 }} />
          <AttendeeCell ids={event.attendeeIds} />
        </Box>
      </Box>
    </Box>
  );
};

// ─── 학회 추가/수정 다이얼로그 ─────────────────────────────────
// 기존 전체 필드 + 신규 4(장소·참석자 멀티선택·비고·비용)
const EventDialog = ({ open, onClose, editing, isMaster, onSubmit, onDelete }) => {
  const theme = useTheme();
  const [eventYear, setEventYear] = useState(YEAR);
  const [eventSeason, setEventSeason] = useState('');
  const [hostSociety, setHostSociety] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [discount, setDiscount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState('');
  // 신규 4
  const [venue, setVenue] = useState('');
  const [attendees, setAttendees] = useState([]); // STAFF 객체 배열
  const [note, setNote] = useState('');
  const [cost, setCost] = useState('');

  const reset = () => {
    setEventYear(YEAR); setEventSeason(''); setHostSociety('');
    setName(''); setSlug(''); setDiscount('');
    setStartDate(''); setEndDate(''); setEstimatedDeliveryDate('');
    setVenue(''); setAttendees([]); setNote(''); setCost('');
  };
  const handleClose = () => { reset(); onClose(); };

  const sectionLabel = (txt) => (
    <Typography
      variant="caption"
      sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: '0.03em', textTransform: 'uppercase' }}
    >
      {txt}
    </Typography>
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      scroll="paper"
      PaperProps={{ sx: { borderRadius: `${theme.radii.lg}px`, maxWidth: 560, width: '100%' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25, pb: 1.5 }}>
        <Box
          sx={{
            width: 36, height: 36, borderRadius: `${theme.radii.sm}px`,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {editing ? <EditIcon sx={{ fontSize: 20, color: 'primary.main' }} /> : <AddIcon sx={{ fontSize: 20, color: 'primary.main' }} />}
        </Box>
        <Typography variant="h4" sx={{ letterSpacing: '-0.02em' }}>
          {editing ? '학회 수정' : '새 학회 추가'}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pb: 2 }}>
        {/* Step 1 — 행사명 형식 카드 (기존 보존) */}
        <Box
          sx={{
            mt: 1, p: 2, borderRadius: `${theme.radii.md}px`,
            bgcolor: alpha(theme.palette.primary.main, 0.04),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
            display: 'flex', flexDirection: 'column', gap: 1.5,
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
            ✦ 행사명 형식
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ flex: '1 1 100px', minWidth: 100 }}>
              <InputLabel shrink>연도</InputLabel>
              <Select label="연도" value={eventYear} onChange={(e) => setEventYear(e.target.value)} displayEmpty>
                {[YEAR - 1, YEAR, YEAR + 1].map((y) => <MenuItem key={y} value={y}>{y}년</MenuItem>)}
              </Select>
            </FormControl>
            <Autocomplete
              freeSolo
              size="small"
              sx={{ flex: '1 1 160px', minWidth: 160 }}
              options={EVENT_SEASONS}
              value={eventSeason}
              onInputChange={(_, v) => setEventSeason(v)}
              renderInput={(params) => (
                <TextField {...params} label="행사 구분" placeholder="선택 또는 직접 입력" InputLabelProps={{ shrink: true }} />
              )}
            />
          </Box>
          <FormControl size="small" fullWidth>
            <InputLabel shrink>주최 학회</InputLabel>
            <Select label="주최 학회" value={hostSociety} onChange={(e) => setHostSociety(e.target.value)} displayEmpty>
              <MenuItem value=""><em>학회 선택</em></MenuItem>
              {HOST_SOCIETIES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Step 2 — 자동 생성 + 기본 정보 (기존 보존) */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sectionLabel('기본 정보')}
          <TextField
            label="행사명" size="small" fullWidth value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예) 2026 한국심리학회 추계학술대회"
            InputLabelProps={{ shrink: true }}
            helperText="위 정보로 자동 완성되며, 직접 입력·수정할 수 있습니다."
          />
          <TextField
            label="주문 URL" size="small" fullWidth value={slug}
            onChange={(e) => setSlug(e.target.value)} placeholder="kpsy-2026-fall"
            InputProps={{ startAdornment: <InputAdornment position="start"><Typography variant="body2" sx={{ color: 'text.disabled' }}>/order?events=</Typography></InputAdornment> }}
            InputLabelProps={{ shrink: true }}
            helperText="주문 페이지 주소. 영문 소문자·숫자·하이픈만 가능"
          />
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              label="할인율 (%)" size="small" type="number" fullWidth value={discount}
              onChange={(e) => setDiscount(e.target.value)} placeholder="0"
              InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
              InputLabelProps={{ shrink: true }} helperText="예: 15 = 15% 할인"
            />
            <TextField
              label="배송 예정일" size="small" type="date" fullWidth value={estimatedDeliveryDate}
              onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
              InputLabelProps={{ shrink: true }} helperText="고객 조회 페이지에 표시"
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              label="시작일" size="small" type="date" fullWidth value={startDate}
              onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="종료일" size="small" type="date" fullWidth value={endDate}
              onChange={(e) => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }}
            />
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Step 3 — 운영 정보 (신규 4) */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sectionLabel('운영 정보')}
          <TextField
            label="장소" size="small" fullWidth value={venue}
            onChange={(e) => setVenue(e.target.value)} placeholder="예) 서울 코엑스 그랜드볼룸"
            InputProps={{ startAdornment: <InputAdornment position="start"><PlaceIcon sx={{ fontSize: 18, color: 'text.disabled' }} /></InputAdornment> }}
            InputLabelProps={{ shrink: true }}
          />
          {/* 참석자 멀티선택 — 후보 = onsite + master (user_profiles) */}
          <Autocomplete
            multiple
            size="small"
            disableCloseOnSelect
            options={STAFF}
            value={attendees}
            onChange={(_, v) => setAttendees(v)}
            getOptionLabel={(o) => o.name}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderOption={(props, option, { selected }) => (
              <li {...props} key={option.id}>
                <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
                <ListItemText
                  primary={option.name}
                  secondary={option.role === 'master' ? '마스터' : '현장 마케팅'}
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </li>
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={option.id}
                  label={option.name}
                  size="small"
                  variant="outlined"
                  sx={{ borderColor: theme.gray[300] }}
                />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="참석자"
                placeholder={attendees.length ? '' : '현장 담당자 선택'}
                InputLabelProps={{ shrink: true }}
                helperText="현장 마케팅 · 마스터 중 선택"
              />
            )}
          />
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              label="비용 (원)" size="small" type="number" fullWidth value={cost}
              onChange={(e) => setCost(e.target.value)} placeholder="0"
              InputProps={{ endAdornment: <InputAdornment position="end">원</InputAdornment> }}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
          <TextField
            label="비고" size="small" fullWidth multiline minRows={2} value={note}
            onChange={(e) => setNote(e.target.value)} placeholder="부스 위치, 진열 메모 등"
            InputLabelProps={{ shrink: true }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        {editing && isMaster && (
          <Button onClick={onDelete} color="error" startIcon={<DeleteIcon sx={{ fontSize: 18 }} />} sx={{ mr: 'auto', minHeight: 40 }}>
            삭제
          </Button>
        )}
        <Button onClick={handleClose} sx={{ minHeight: 40, color: 'text.secondary' }}>취소</Button>
        <Button variant="contained" onClick={() => { onSubmit(name || hostSociety || '새 학회'); reset(); }} sx={{ minHeight: 40 }}>
          저장
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── QR 다이얼로그 (기존 패턴 차용) ────────────────────────────
const QrDialog = ({ open, event, onClose, onCopy }) => {
  const theme = useTheme();
  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx: { borderRadius: `${theme.radii.lg}px`, maxWidth: 420, width: '100%' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25, pb: 1.5 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: `${theme.radii.sm}px`, bgcolor: alpha(theme.palette.primary.main, 0.1), border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <QrCode2Icon sx={{ fontSize: 20, color: 'primary.main' }} />
        </Box>
        <Typography variant="h4" sx={{ letterSpacing: '-0.02em' }}>QR 코드</Typography>
      </DialogTitle>
      <DialogContent sx={{ pb: 2 }}>
        {event && (
          <>
            <Typography variant="body1" sx={{ fontWeight: 700, mb: 1.5, letterSpacing: '-0.015em' }}>
              {event.name}
            </Typography>
            <Box sx={{ width: '100%', aspectRatio: '1 / 1', maxWidth: 280, mx: 'auto', borderRadius: `${theme.radii.md}px`, border: `1px solid ${theme.gray[200]}`, bgcolor: theme.gray[50], display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 1 }}>
              <QrCode2Icon sx={{ fontSize: 64, color: theme.gray[400] }} />
              <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>QR 미리보기</Typography>
            </Box>
            <Box sx={{ mt: 1.5, p: 1, borderRadius: `${theme.radii.sm}px`, bgcolor: theme.gray[50], border: `1px solid ${theme.gray[100]}`, textAlign: 'center' }}>
              <Typography variant="caption" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: 'text.secondary' }}>
                /order?events={event.urlSlug}
              </Typography>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button variant="outlined" onClick={onCopy} startIcon={<ContentCopyIcon sx={{ fontSize: 16 }} />} sx={{ minHeight: 40 }}>URL 복사</Button>
        <Button variant="contained" startIcon={<DownloadIcon sx={{ fontSize: 16 }} />} sx={{ minHeight: 40 }}>SVG 다운로드</Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── 메인 ──────────────────────────────────────────────────────
const EventHubListPreview = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // 권한 시뮬레이션 토글 (시안 시연 — 실서비스는 AuthContext)
  const isMaster = ME.role === 'master' || false; // ME=onsite → master 아님
  const canEdit = true; // events:edit (onsite/master 보유 가정)

  const [dateFilter, setDateFilter] = useState('year'); // year | h1 | h2 (기본=올해)
  const [societyFilter, setSocietyFilter] = useState('all');
  const [attendeeFilter, setAttendeeFilter] = useState('all'); // 'all' | 'me' | staffId
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuEvent, setMenuEvent] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrEvent, setQrEvent] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  const toast = (message) => setSnackbar({ open: true, message });

  // 정렬 ASC + 필터
  const sorted = useMemo(
    () => [...MOCK_EVENTS].sort((a, b) => (a.startDate < b.startDate ? -1 : 1)),
    []
  );

  const filtered = useMemo(() => {
    return sorted.filter((ev) => {
      // 날짜 단축 (모두 2026 mock → year=전체, 상/하반기 월 기준)
      if (dateFilter === 'h1' && Number(ev.startDate.slice(5, 7)) > 6) return false;
      if (dateFilter === 'h2' && Number(ev.startDate.slice(5, 7)) <= 6) return false;
      if (societyFilter !== 'all' && ev.hostSociety !== societyFilter) return false;
      if (attendeeFilter === 'me' && !ev.attendeeIds.includes(ME.id)) return false;
      if (attendeeFilter !== 'all' && attendeeFilter !== 'me' && !ev.attendeeIds.includes(attendeeFilter)) return false;
      return true;
    });
  }, [sorted, dateFilter, societyFilter, attendeeFilter]);

  // Upcoming 하이라이트 대상: 내 참석 미래 가장 가까운 1건 (master=전체 미래 1건, 내 참석 0건이면 전체 폴백)
  const upcomingId = useMemo(() => {
    const future = sorted.filter((e) => e.startDate > TODAY);
    if (!future.length) return null;
    if (isMaster) return future[0].id;
    const mine = future.find((e) => e.attendeeIds.includes(ME.id));
    return (mine || future[0]).id; // 폴백
  }, [sorted, isMaster]);

  const distinctSocieties = useMemo(() => [...new Set(MOCK_EVENTS.map((e) => e.hostSociety))], []);

  const activeFilterCount =
    (dateFilter !== 'year' ? 1 : 0) + (societyFilter !== 'all' ? 1 : 0) + (attendeeFilter !== 'all' ? 1 : 0);

  const openMenu = (anchor, event) => { setMenuAnchor(anchor); setMenuEvent(event); };
  const closeMenu = () => { setMenuAnchor(null); };

  const handleRowClick = (event) => toast(`${event.name} → 학회 상세(L2) 진입 (mock)`);
  const handleEdit = () => { closeMenu(); setEditingEvent(menuEvent); setDialogOpen(true); };
  const handleOpenUrl = () => { closeMenu(); toast(`주문 페이지 새 창 · ${menuEvent?.urlSlug} (mock)`); };
  const handleCopyUrl = () => { closeMenu(); toast(`URL 복사됨 · /order?events=${menuEvent?.urlSlug}`); };
  const handleShowQr = () => { closeMenu(); setQrEvent(menuEvent); setQrOpen(true); };
  const handleDelete = () => { closeMenu(); toast(`${menuEvent?.name} 삭제 (연결 주문 가드 후, mock)`); };

  const DATE_TOGGLES = [
    { key: 'year', label: `올해(${YEAR})` },
    { key: 'h1', label: '상반기' },
    { key: 'h2', label: '하반기' },
  ];

  const headerAction = (
    <Box sx={{ display: 'flex', gap: 1 }}>
      {canEdit && (
        <Button size="small" variant="outlined" startIcon={<SettingsIcon sx={{ fontSize: 16 }} />} onClick={() => toast('학회 목록 관리 (mock)')} sx={{ minHeight: 36 }}>
          학회 목록 관리
        </Button>
      )}
      {canEdit && (
        <Button size="small" variant="contained" startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={() => { setEditingEvent(null); setDialogOpen(true); }} sx={{ minHeight: 36 }}>
          학회 추가
        </Button>
      )}
    </Box>
  );

  return (
    <PreviewShell activePath="/admin/events">
      <PageHeader
        title="학회"
        subtitle={`${YEAR}년 학회 ${filtered.length}건 · 운영 대상 한눈에`}
        icon={EventNoteIcon}
        action={headerAction}
      />

      {/* ─── 필터바 ─── */}
      <SectionCard sx={{ mb: 3 }} padding={20}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <FilterListIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>필터</Typography>
          {activeFilterCount > 0 && (
            <Chip label={activeFilterCount} size="small" sx={{ height: 18, fontWeight: 700, bgcolor: 'primary.main', color: 'primary.contrastText', '& .MuiChip-label': { ...theme.typography.caption } }} />
          )}
        </Box>

        {/* Row 1 — 날짜 단축 토글 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, mr: 0.5 }}>기간</Typography>
          {DATE_TOGGLES.map(({ key, label }) => (
            <Chip
              key={key}
              label={label}
              size="small"
              variant={dateFilter === key ? 'filled' : 'outlined'}
              color={dateFilter === key ? 'primary' : 'default'}
              onClick={() => setDateFilter(key)}
              sx={{ paddingX: 1.5, fontWeight: dateFilter === key ? 700 : 500, cursor: 'pointer' }}
            />
          ))}
        </Box>

        {/* Row 2 — 학회명 드롭다운 + 참석자 드롭다운("나" 빠른칩) */}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>학회명</InputLabel>
            <Select value={societyFilter} label="학회명" onChange={(e) => setSocietyFilter(e.target.value)}>
              <MenuItem value="all">전체 학회</MenuItem>
              {distinctSocieties.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>참석자</InputLabel>
            <Select value={attendeeFilter === 'me' ? 'all' : attendeeFilter} label="참석자" onChange={(e) => setAttendeeFilter(e.target.value)}>
              <MenuItem value="all">전체 참석자</MenuItem>
              {STAFF.map((s) => (
                <MenuItem key={s.id} value={s.id}>{s.name}{s.role === 'master' ? ' (마스터)' : ''}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* "나" 빠른필터 칩 */}
          <Chip
            label="나"
            size="small"
            icon={<PersonIcon sx={{ fontSize: 14 }} />}
            variant={attendeeFilter === 'me' ? 'filled' : 'outlined'}
            color={attendeeFilter === 'me' ? 'primary' : 'default'}
            onClick={() => setAttendeeFilter(attendeeFilter === 'me' ? 'all' : 'me')}
            sx={{ fontWeight: attendeeFilter === 'me' ? 700 : 500, cursor: 'pointer' }}
          />
        </Box>
      </SectionCard>

      {/* ─── 목록 ─── */}
      {filtered.length === 0 ? (
        <SectionCard padding={20}>
          <EmptyState
            icon={EventNoteIcon}
            title="해당 조건의 학회가 없어요"
            description="필터를 해제하거나 새 학회를 추가하세요"
            action={canEdit ? { label: '필터 해제', onClick: () => { setDateFilter('year'); setSocietyFilter('all'); setAttendeeFilter('all'); } } : undefined}
          />
        </SectionCard>
      ) : isMobile ? (
        // ─── 모바일: 카드 ───
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {filtered.map((event) => (
            <EventMobileCard
              key={event.id}
              event={event}
              isUpcoming={event.id === upcomingId}
              onOpenMenu={openMenu}
              onRowClick={handleRowClick}
            />
          ))}
        </Box>
      ) : (
        // ─── 데스크톱/태블릿: 표 ───
        <SectionCard padding={0}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>학회명</TableCell>
                  <TableCell>행사명</TableCell>
                  <TableCell>날짜</TableCell>
                  <TableCell>장소</TableCell>
                  <TableCell>참석자</TableCell>
                  <TableCell align="right" sx={{ width: 56 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((event, i) => (
                  <EventRow
                    key={event.id}
                    index={i + 1}
                    event={event}
                    isUpcoming={event.id === upcomingId}
                    onOpenMenu={openMenu}
                    onRowClick={handleRowClick}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </SectionCard>
      )}

      {/* ─── ⋯ 메뉴 ─── */}
      <RowActionMenu
        anchorEl={menuAnchor}
        onClose={closeMenu}
        onEdit={handleEdit}
        onOpenUrl={handleOpenUrl}
        onCopyUrl={handleCopyUrl}
        onShowQr={handleShowQr}
        onDelete={handleDelete}
        canEdit={canEdit}
        isMaster={isMaster}
      />

      {/* ─── 다이얼로그 ─── */}
      <EventDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editing={Boolean(editingEvent)}
        isMaster={isMaster}
        onSubmit={(name) => { setDialogOpen(false); toast(`${name} 저장됨 (mock)`); }}
        onDelete={() => { setDialogOpen(false); toast('삭제 (연결 주문 가드 후, mock)'); }}
      />
      <QrDialog
        open={qrOpen}
        event={qrEvent}
        onClose={() => setQrOpen(false)}
        onCopy={() => toast(`URL 복사됨 · /order?events=${qrEvent?.urlSlug}`)}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message={snackbar.message}
        action={<IconButton size="small" color="inherit" onClick={() => setSnackbar({ open: false, message: '' })}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>}
      />
    </PreviewShell>
  );
};

export default EventHubListPreview;
