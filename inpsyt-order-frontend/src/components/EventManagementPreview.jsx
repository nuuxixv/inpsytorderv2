import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, useTheme,
  InputAdornment, Divider, Autocomplete,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  EventNote as EventNoteIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Add as AddIcon,
  Edit as EditIcon,
  OpenInNew as OpenInNewIcon,
  ContentCopy as ContentCopyIcon,
  QrCode2 as QrCode2Icon,
  Close as CloseIcon,
  Download as DownloadIcon,
  CalendarToday as CalendarTodayIcon,
  LocalOffer as LocalOfferIcon,
} from '@mui/icons-material';
import { PageHeader, SectionCard, StatusBadge, ActionSlot, EmptyState } from './ui';
import PreviewShell from './preview/PreviewShell';

/**
 * DEV-ONLY keystone: /preview/events.
 * 어드민 학회 관리 시안 — OrderManagementPreview / FulfillmentPreview / ProductManagementPreview 와 톤 일관.
 * 실 도메인 로직은 EventManagementPage.jsx 참고 (코드 카피 X, 구조만 차용).
 *
 * 사용자 시나리오: 학회 시즌 시작 트리거 / 마스터 권한 / 행사 카드 1장 = 한 학회 /
 * 학회 직전 3-4건만 만지고 끝 / 학회 시작 후엔 QR·URL 공유, 통계 확인 용도.
 */

// ─── Mock 데이터 ───────────────────────────────────────────────

const STATUS_TOGGLES = [
  { key: 'all',      label: '전체' },
  { key: 'upcoming', label: '예정' },
  { key: 'active',   label: '진행 중' },
  { key: 'ended',    label: '종료' },
];

const YEAR_OPTIONS = [2024, 2025, 2026];

// 사양 A5 Step 1 (line 84-87): 행사 구분 6종
const EVENT_SEASONS = [
  { value: '춘계학술대회', slug: 'spring' },
  { value: '추계학술대회', slug: 'fall' },
  { value: '연수강좌', slug: 'training' },
  { value: '보수교육', slug: 'edu' },
  { value: '세미나', slug: 'seminar' },
  { value: '기타', slug: 'etc' },
];

// 주최 학회 목록 (societies 테이블 모킹)
const HOST_SOCIETIES = [
  '한국심리학회',
  '한국임상심리학회',
  '한국상담심리학회',
  '한국청소년상담학회',
  '한국상담학회',
];

// 학회 6개 — 예정 2 / 진행중 1 / 종료 3
// stateKey: 카드 상태 매핑 (upcoming/active/ended) — StatusBadge value 'paid|pending|completed' 로 매핑
// estimatedDeliveryDate: 사양 A5 line 96 (배송 예정일)
const MOCK_EVENTS = [
  {
    id: 'ev-2026-fall-kpsy',
    name: '2026 한국심리학회 추계학술대회',
    hostSociety: '한국심리학회',
    season: '추계학술대회',
    startDate: '2026-09-13',
    endDate: '2026-09-15',
    estimatedDeliveryDate: '2026-09-30',
    discountPercent: 15,
    urlSlug: 'kpsy-2026-fall',
    stateKey: 'upcoming',
    year: 2026,
  },
  {
    id: 'ev-2026-summer-kyc',
    name: '2026 한국청소년상담학회 세미나',
    hostSociety: '한국청소년상담학회',
    season: '세미나',
    startDate: '2026-07-04',
    endDate: '2026-07-05',
    estimatedDeliveryDate: '',
    discountPercent: 10,
    urlSlug: 'kyc-2026-summer',
    stateKey: 'upcoming',
    year: 2026,
  },
  {
    id: 'ev-2026-spring-kcp',
    name: '2026 한국임상심리학회 춘계학술대회',
    hostSociety: '한국임상심리학회',
    season: '춘계학술대회',
    startDate: '2026-05-08',
    endDate: '2026-05-10',
    estimatedDeliveryDate: '2026-05-25',
    discountPercent: 20,
    urlSlug: 'kcp-2026-spring',
    stateKey: 'active',
    year: 2026,
  },
  {
    id: 'ev-2026-edu-kca',
    name: '2026 한국상담학회 보수교육',
    hostSociety: '한국상담학회',
    season: '보수교육',
    startDate: '2026-03-21',
    endDate: '2026-03-21',
    estimatedDeliveryDate: '',
    discountPercent: 0,
    urlSlug: 'kca-2026-edu',
    stateKey: 'ended',
    year: 2026,
  },
  {
    id: 'ev-2025-fall-kpsy',
    name: '2025 한국심리학회 추계학술대회',
    hostSociety: '한국심리학회',
    season: '추계학술대회',
    startDate: '2025-09-25',
    endDate: '2025-09-27',
    estimatedDeliveryDate: '2025-10-10',
    discountPercent: 15,
    urlSlug: 'kpsy-2025-fall',
    stateKey: 'ended',
    year: 2025,
  },
  {
    id: 'ev-2025-spring-kcp',
    name: '2025 한국임상심리학회 춘계학술대회',
    hostSociety: '한국임상심리학회',
    season: '춘계학술대회',
    startDate: '2025-05-09',
    endDate: '2025-05-11',
    estimatedDeliveryDate: '2025-05-25',
    discountPercent: 20,
    urlSlug: 'kcp-2025-spring',
    stateKey: 'ended',
    year: 2025,
  },
];

// stateKey → StatusBadge value 매핑
const STATE_TO_STATUS = {
  active:   'paid',
  upcoming: 'pending',
  ended:    'completed',
};

const STATE_TO_LABEL = {
  active:   '진행 중',
  upcoming: '예정',
  ended:    '종료',
};

// ─── 헬퍼 컴포넌트 ─────────────────────────────────────────────

const formatDateRange = (start, end) => {
  if (!start || !end) return '';
  const fmt = (iso) => iso.replaceAll('-', '.');
  return start === end ? fmt(start) : `${fmt(start)} ~ ${fmt(end)}`;
};

// 학회 상태(예정/진행중/종료)는 StatusBadge로 표시한다.
// stateKey → status 토큰(STATE_TO_STATUS) + 한글 라벨(STATE_TO_LABEL) 매핑.
const EventStateBadge = ({ stateKey }) => (
  <StatusBadge value={STATE_TO_STATUS[stateKey]} label={STATE_TO_LABEL[stateKey]} />
);

const CardIconButton = ({ tooltip, icon, onClick }) => {
  const theme = useTheme();
  return (
    <Tooltip title={tooltip} placement="top" arrow>
      <IconButton
        size="small"
        onClick={onClick}
        sx={{
          width: 44, height: 44,
          borderRadius: `${theme.radii.sm}px`,
          color: theme.gray[600],
          border: `1px solid ${theme.gray[200]}`,
          bgcolor: 'background.paper',
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

const EventCard = ({ event, onCopyUrl, onOpenUrl, onShowQr, onEdit }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: `1px solid ${theme.gray[200]}`,
        borderRadius: `${theme.radii.lg}px`,
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        transition: `all 0.2s ${theme.easing.toss}`,
        '&:hover': {
          borderColor: theme.gray[300],
          boxShadow: theme.customShadows.sm,
          transform: 'translateY(-1px)',
        },
      }}
    >
      {/* 상단: 상태 + 할인 배지 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <EventStateBadge stateKey={event.stateKey} />
        {/* 사양 A5 핵심 발견 #5: 할인율 UI 0~100% 표시 (DB 0~1 변환은 저장 시) */}
        {event.discountPercent > 0 && (
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 0.875,
              py: 0.375,
              borderRadius: `${theme.radii.sm}px`,
              bgcolor: alpha(theme.accent.revenue, 0.08),
              border: `1px solid ${alpha(theme.accent.revenue, 0.2)}`,
            }}
          >
            <LocalOfferIcon sx={{ fontSize: 12, color: theme.accent.revenue }} />
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: theme.accent.revenue,
                lineHeight: 1,
                fontFeatureSettings: '"tnum" 1',
              }}
            >
              {event.discountPercent}% 할인
            </Typography>
          </Box>
        )}
      </Box>

      {/* 학회명 */}
      <Typography
        variant="h4"
        sx={{
          letterSpacing: '-0.02em',
          color: 'text.primary',
          lineHeight: 1.35,
          minHeight: '3em',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {event.name}
      </Typography>

      {/* 주최 학회 칩 — 사양 A5 line 55 */}
      {event.hostSociety && (
        <Box>
          <Chip
            label={event.hostSociety}
            size="small"
            variant="outlined"
            sx={{
              height: 22,
              fontWeight: 600,
              borderColor: theme.gray[200],
              color: 'text.secondary',
              '& .MuiChip-label': { ...theme.typography.caption },
            }}
          />
        </Box>
      )}

      {/* 기간 + 배송 예정일 — 사양 A5 line 95-96 (별도 줄) */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
          <CalendarTodayIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              fontFeatureSettings: '"tnum" 1',
              fontWeight: 500,
            }}
          >
            {formatDateRange(event.startDate, event.endDate)}
          </Typography>
        </Box>
        {event.estimatedDeliveryDate && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: 'text.disabled',
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
                minWidth: 14 + 4,
              }}
            >
              배송
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontFeatureSettings: '"tnum" 1',
                fontWeight: 500,
              }}
            >
              {event.estimatedDeliveryDate.replaceAll('-', '.')} 예정
            </Typography>
          </Box>
        )}
      </Box>

      {/* URL slug */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 0.625,
          borderRadius: `${theme.radii.sm}px`,
          bgcolor: theme.gray[50],
          border: `1px solid ${theme.gray[100]}`,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: 'text.disabled',
            fontWeight: 500,
          }}
        >
          /order?events=
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: 'text.primary',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {event.urlSlug}
        </Typography>
      </Box>

      {/* 액션 4종 — 공유(열기·복사·QR)는 leading, 편집은 우측 끝 */}
      <ActionSlot
        wrap={false}
        sx={{ mt: 'auto', pt: 0.5 }}
        leading={
          <>
            <CardIconButton
              tooltip="구매 페이지 열기"
              icon={<OpenInNewIcon sx={{ fontSize: 18 }} />}
              onClick={onOpenUrl}
            />
            <CardIconButton
              tooltip="URL 복사"
              icon={<ContentCopyIcon sx={{ fontSize: 18 }} />}
              onClick={onCopyUrl}
            />
            <CardIconButton
              tooltip="QR 코드 보기"
              icon={<QrCode2Icon sx={{ fontSize: 18 }} />}
              onClick={onShowQr}
            />
          </>
        }
      >
        <CardIconButton
          tooltip="편집"
          icon={<EditIcon sx={{ fontSize: 18 }} />}
          onClick={onEdit}
        />
      </ActionSlot>
    </Box>
  );
};

// ─── 신규 학회 등록 모달 ────────────────────────────────────────

const NewEventDialog = ({ open, onClose, onSubmit }) => {
  const theme = useTheme();
  // Step 1 — 행사명 형식 블록 (사양 A5 line 83-87)
  const [eventYear, setEventYear] = useState('');
  const [eventSeason, setEventSeason] = useState('');
  const [hostSociety, setHostSociety] = useState('');
  // Step 2 — 자동 생성 + 추가 정보 (사양 A5 line 91-96)
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [discount, setDiscount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState('');

  // 자동 채우기 (사양 A5 line 103-109)
  // 세 필드 모두 채워지면 name/slug 제안
  React.useEffect(() => {
    if (!eventYear || !eventSeason || !hostSociety) return;
    const seasonMeta = EVENT_SEASONS.find(s => s.value === eventSeason);
    const proposedName = `${eventYear} ${hostSociety} ${eventSeason}`;
    const slugPrefix = hostSociety
      .replace(/한국/g, '')
      .replace(/학회/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 6) || 'event';
    const random4 = Math.random().toString(36).slice(2, 6);
    const proposedSlug = `${slugPrefix}-${eventYear}-${seasonMeta?.slug || 'etc'}-${random4}`;
    setName(proposedName);
    setSlug(proposedSlug);
  }, [eventYear, eventSeason, hostSociety]);

  const reset = () => {
    setEventYear(''); setEventSeason(''); setHostSociety('');
    setName(''); setSlug(''); setDiscount('');
    setStartDate(''); setEndDate(''); setEstimatedDeliveryDate('');
  };
  const handleClose = () => { reset(); onClose(); };
  const handleSubmit = () => { onSubmit(name || '새 학회'); reset(); };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: {
          borderRadius: `${theme.radii.lg}px`,
          maxWidth: 520,
          width: '100%',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25, pb: 1.5 }}>
        <Box
          sx={{
            width: 36, height: 36,
            borderRadius: `${theme.radii.sm}px`,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <AddIcon sx={{ fontSize: 20, color: theme.palette.primary.main }} />
        </Box>
        <Typography variant="h4" sx={{ letterSpacing: '-0.02em' }}>
          신규 학회 등록
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pb: 2 }}>
        {/* ─── Step 1 — 행사명 형식 블록 ─── */}
        {/* 사양 A5 핵심 발견 #2: "행사명 형식" 블록은 별도 카드, primary 옅은 배경 */}
        <Box
          sx={{
            mt: 1,
            p: 2,
            borderRadius: `${theme.radii.md}px`,
            bgcolor: alpha(theme.palette.primary.main, 0.04),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              color: theme.palette.primary.main,
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
          >
            ✦ 행사명 형식
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ flex: '1 1 100px', minWidth: 100 }}>
              <InputLabel shrink>연도</InputLabel>
              <Select
                label="연도"
                value={eventYear}
                onChange={(e) => setEventYear(e.target.value)}
                displayEmpty
              >
                <MenuItem value=""><em>선택</em></MenuItem>
                {YEAR_OPTIONS.map(y => <MenuItem key={y} value={y}>{y}년</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ flex: '1 1 140px', minWidth: 140 }}>
              <InputLabel shrink>행사 구분</InputLabel>
              <Select
                label="행사 구분"
                value={eventSeason}
                onChange={(e) => setEventSeason(e.target.value)}
                displayEmpty
              >
                <MenuItem value=""><em>선택</em></MenuItem>
                {EVENT_SEASONS.map(s => <MenuItem key={s.value} value={s.value}>{s.value}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
          <Autocomplete
            freeSolo
            size="small"
            options={HOST_SOCIETIES}
            value={hostSociety}
            onChange={(_, v) => setHostSociety(v || '')}
            onInputChange={(_, v) => setHostSociety(v)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="주최 학회"
                placeholder="예) 한국심리학회"
                InputLabelProps={{ shrink: true }}
              />
            )}
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* ─── Step 2 — 자동 생성 및 추가 정보 ─── */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              color: 'text.secondary',
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
          >
            자동 생성 및 추가 정보
          </Typography>
          <TextField
            label="행사명"
            size="small"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예) 2026 한국심리학회 추계학술대회"
            InputLabelProps={{ shrink: true }}
            helperText="위에서 입력한 정보로 자동 생성됩니다."
          />
          <TextField
            label="주문 URL"
            size="small"
            fullWidth
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="kpsy-2026-fall"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                    /order?events=
                  </Typography>
                </InputAdornment>
              ),
            }}
            InputLabelProps={{ shrink: true }}
            helperText="주문 페이지 주소로 사용됩니다. 영문, 숫자, 하이픈만 가능"
          />
          <TextField
            label="할인율 (%)"
            size="small"
            type="number"
            fullWidth
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            placeholder="0"
            InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
            InputLabelProps={{ shrink: true }}
            helperText="UI는 0~100 정수, 저장 시 0~1 소수로 변환 · 예: 15 = 15% 할인"
          />
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              label="시작일"
              size="small"
              type="date"
              fullWidth
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="종료일"
              size="small"
              type="date"
              fullWidth
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
          <TextField
            label="배송 예정일"
            size="small"
            type="date"
            fullWidth
            value={estimatedDeliveryDate}
            onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            helperText="입력 시 고객 주문 조회 페이지에 도착 예정일이 표시됩니다."
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={handleClose} sx={{ minHeight: 40, color: 'text.secondary' }}>
          취소
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          startIcon={<AddIcon sx={{ fontSize: 16 }} />}
          sx={{ minHeight: 40 }}
        >
          학회 등록
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── QR 코드 모달 ──────────────────────────────────────────────

const QrDialog = ({ open, event, onClose, onCopy }) => {
  const theme = useTheme();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          borderRadius: `${theme.radii.lg}px`,
          maxWidth: 420,
          width: '100%',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25, pb: 1.5 }}>
        <Box
          sx={{
            width: 36, height: 36,
            borderRadius: `${theme.radii.sm}px`,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <QrCode2Icon sx={{ fontSize: 20, color: theme.palette.primary.main }} />
        </Box>
        <Typography variant="h4" sx={{ letterSpacing: '-0.02em' }}>
          QR 코드
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pb: 2 }}>
        {event && (
          <>
            <Typography
              variant="body1"
              sx={{
                fontWeight: 700,
                color: 'text.primary',
                mb: 1.5,
                letterSpacing: '-0.015em',
              }}
            >
              {event.name}
            </Typography>
            <Box
              sx={{
                width: '100%',
                aspectRatio: '1 / 1',
                maxWidth: 280,
                mx: 'auto',
                borderRadius: `${theme.radii.md}px`,
                border: `1px solid ${theme.gray[200]}`,
                bgcolor: theme.gray[50],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 1,
              }}
            >
              <QrCode2Icon sx={{ fontSize: 64, color: theme.gray[400] }} />
              <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>
                QR 미리보기
              </Typography>
            </Box>
            <Box
              sx={{
                mt: 1.5,
                p: 1,
                borderRadius: `${theme.radii.sm}px`,
                bgcolor: theme.gray[50],
                border: `1px solid ${theme.gray[100]}`,
                textAlign: 'center',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  color: 'text.secondary',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                /order?events={event.urlSlug}
              </Typography>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          variant="outlined"
          onClick={onCopy}
          startIcon={<ContentCopyIcon sx={{ fontSize: 16 }} />}
          sx={{ minHeight: 40 }}
        >
          URL 복사
        </Button>
        <Button
          variant="contained"
          startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
          sx={{ minHeight: 40 }}
        >
          다운로드 PNG
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── 메인 ──────────────────────────────────────────────────────

const EventManagementPreview = () => {
  const theme = useTheme();
  const [statusFilter, setStatusFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrEvent, setQrEvent] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  const totalCount = MOCK_EVENTS.length;
  const activeCount = MOCK_EVENTS.filter(e => e.stateKey === 'active').length;
  const endedCount = MOCK_EVENTS.filter(e => e.stateKey === 'ended').length;
  const upcomingCount = MOCK_EVENTS.filter(e => e.stateKey === 'upcoming').length;

  const filteredEvents = useMemo(() => {
    return MOCK_EVENTS.filter(ev => {
      if (statusFilter !== 'all' && ev.stateKey !== statusFilter) return false;
      if (yearFilter !== 'all' && ev.year !== yearFilter) return false;
      if (searchTerm && !ev.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [statusFilter, yearFilter, searchTerm]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (statusFilter !== 'all') n += 1;
    if (yearFilter !== 'all') n += 1;
    if (searchTerm) n += 1;
    return n;
  }, [statusFilter, yearFilter, searchTerm]);

  const handleCopyUrl = (event) => {
    setSnackbar({ open: true, message: `URL이 복사되었습니다 · /order?events=${event.urlSlug}` });
  };
  const handleOpenUrl = (event) => {
    setSnackbar({ open: true, message: `구매 페이지를 새 창으로 엽니다 · ${event.urlSlug} (mock)` });
  };
  const handleShowQr = (event) => {
    setQrEvent(event);
    setQrDialogOpen(true);
  };
  const handleEdit = (event) => {
    setSnackbar({ open: true, message: `${event.name} 편집 모달 (mock)` });
  };
  const handleNewSubmit = (name) => {
    setNewDialogOpen(false);
    setSnackbar({ open: true, message: `${name} 등록됨 (mock)` });
  };
  const handleQrCopyUrl = () => {
    if (!qrEvent) return;
    setSnackbar({ open: true, message: `URL이 복사되었습니다 · /order?events=${qrEvent.urlSlug}` });
  };

  return (
    <PreviewShell activePath="/admin/events">
      <PageHeader
        title="학회 관리"
        subtitle={`총 ${totalCount}건 · 진행 중 ${activeCount} · 예정 ${upcomingCount} · 종료 ${endedCount}`}
        icon={EventNoteIcon}
        action={
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon sx={{ fontSize: 16 }} />}
            onClick={() => setNewDialogOpen(true)}
            sx={{ minHeight: 36 }}
          >
            신규 학회 등록
          </Button>
        }
      />

      {/* ─── 필터 영역 ─── */}
      <SectionCard sx={{ mb: 3 }} padding={20}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <FilterListIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>
            필터
          </Typography>
          {activeFilterCount > 0 && (
            <Chip
              label={activeFilterCount}
              size="small"
              sx={{
                height: 18,
                fontWeight: 700,
                bgcolor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
                '& .MuiChip-label': { ...theme.typography.caption },
              }}
            />
          )}
        </Box>

        {/* Row 1 — 상태 토글 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, mr: 0.5 }}>
            상태
          </Typography>
          {STATUS_TOGGLES.map(({ key, label }) => (
            <Chip
              key={key}
              label={label}
              size="small"
              variant={statusFilter === key ? 'filled' : 'outlined'}
              color={statusFilter === key ? 'primary' : 'default'}
              onClick={() => setStatusFilter(key)}
              sx={{ paddingX: 1.5, fontWeight: statusFilter === key ? 700 : 500, cursor: 'pointer' }}
            />
          ))}
        </Box>

        {/* Row 2 — 연도 셀렉트 + 검색 */}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>연도</InputLabel>
            <Select
              value={yearFilter}
              label="연도"
              onChange={(e) => setYearFilter(e.target.value)}
            >
              <MenuItem value="all">전체</MenuItem>
              {YEAR_OPTIONS.map(y => (
                <MenuItem key={y} value={y}>{y}년</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            placeholder="학회명 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ fontSize: 18, color: 'text.disabled', mr: 0.75 }} />,
            }}
            sx={{ flex: '1 1 240px', minWidth: 240 }}
          />
        </Box>
      </SectionCard>

      {/* ─── 학회 카드 그리드 ─── */}
      <SectionCard padding={20}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              <Box component="span" sx={{ fontWeight: 700, color: 'text.primary', fontFeatureSettings: '"tnum" 1' }}>
                {filteredEvents.length}
              </Box>
              개 학회
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              · 최근 등록순
            </Typography>
          </Box>
        </Box>

        {filteredEvents.length === 0 ? (
          <EmptyState
            icon={EventNoteIcon}
            title="조건에 맞는 학회가 없습니다"
            description="필터를 해제하거나 신규 학회를 등록하세요"
          />
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                lg: 'repeat(3, 1fr)',
              },
              gap: 2,
            }}
          >
            {filteredEvents.map(event => (
              <EventCard
                key={event.id}
                event={event}
                onCopyUrl={() => handleCopyUrl(event)}
                onOpenUrl={() => handleOpenUrl(event)}
                onShowQr={() => handleShowQr(event)}
                onEdit={() => handleEdit(event)}
              />
            ))}
          </Box>
        )}
      </SectionCard>

      {/* ─── 모달 ─── */}
      <NewEventDialog
        open={newDialogOpen}
        onClose={() => setNewDialogOpen(false)}
        onSubmit={handleNewSubmit}
      />
      <QrDialog
        open={qrDialogOpen}
        event={qrEvent}
        onClose={() => setQrDialogOpen(false)}
        onCopy={handleQrCopyUrl}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message={snackbar.message}
        action={
          <IconButton
            size="small"
            color="inherit"
            onClick={() => setSnackbar({ open: false, message: '' })}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        }
      />
    </PreviewShell>
  );
};

export default EventManagementPreview;
