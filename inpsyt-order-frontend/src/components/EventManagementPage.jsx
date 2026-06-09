import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Autocomplete,
  Chip,
  Checkbox,
  IconButton,
  alpha,
  useTheme,
  useMediaQuery,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  InputAdornment,
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  EventNote as EventNoteIcon,
  ContentCopy as CopyIcon,
  OpenInNew as OpenInNewIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  QrCode2 as QrCode2Icon,
  Download as DownloadIcon,
  FilterList as FilterListIcon,
  MoreVert as MoreVertIcon,
  PlaceOutlined as PlaceIcon,
  PersonOutline as PersonIcon,
  LocalOffer as LocalOfferIcon,
  StarBorder as StarBorderIcon,
  ReceiptLong as ReceiptLongIcon,
} from '@mui/icons-material';
import QRCode from 'qrcode';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { getTodayKST, getEventStatusKST } from '../utils/date';
import { numberToKoreanCurrency } from '../utils/koreanCurrency';
import TableSkeleton from './TableSkeleton';
import SocietyManagementDialog from './SocietyManagementDialog';
import PaymentReceiptModal from './PaymentReceiptModal';
import { PageHeader, SectionCard, StatusBadge, EmptyState } from './ui';

const dot = (iso) => (iso ? iso.replaceAll('-', '.') : '');

// getEventStatusKST color('info'/'success'/'default') → StatusBadge 토큰.
// 예정→pending(주) · 진행중→paid(녹) · 종료→completed(보).
const STATUS_COLOR_TO_BADGE = { info: 'pending', success: 'paid', default: 'completed' };

const EventStateBadge = ({ startDate, endDate }) => {
  const st = getEventStatusKST(startDate, endDate);
  return <StatusBadge value={STATUS_COLOR_TO_BADGE[st.color] || 'pending'} label={st.label} size="sm" />;
};

// 할인율 칩(>0%만) — §8-1 가시성 보존. accent.revenue soft + LocalOffer.
const DiscountChip = ({ rate }) => {
  const theme = useTheme();
  const percent = Math.round((rate ?? 0) * 100);
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

// 참석자 칩 압축 — §4: ≤3명 이름 칩 / 4명+ "{첫1명} 외 N명" / 미입력 "—".
// attendee_ids(uuid[]) → staffMap join. 누락 uuid = "(삭제)". 내가 포함이면 "나" 우선.
const AttendeeCell = ({ ids = [], staffMap, myId }) => {
  const theme = useTheme();
  if (!ids || !ids.length) {
    return <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>;
  }
  const mine = myId && ids.includes(myId);

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

  if (ids.length <= 3) {
    // 내가 포함이면 "나"를 첫 칸으로 우선.
    const ordered = mine ? [myId, ...ids.filter((id) => id !== myId)] : ids;
    return (
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {ordered.map((id, i) => (
          <Pill
            key={`${id}-${i}`}
            label={id === myId ? '나' : staffMap[id]?.name || '(삭제)'}
            accent={id === myId}
          />
        ))}
      </Box>
    );
  }
  // 4명+ : 첫 1명 + 외 N명. 내가 포함이면 "나"를 첫 칩으로.
  const firstLabel = mine ? '나' : staffMap[ids[0]]?.name || '(삭제)';
  return (
    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
      <Pill label={firstLabel} accent={mine} />
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
        외 {ids.length - 1}명
      </Typography>
    </Box>
  );
};

const EventManagementPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, hasPermission } = useAuth();
  const { addNotification } = useNotification();

  const isMaster = hasPermission('master');
  const canEdit = hasPermission('events:edit');
  const myId = user?.id || null;

  const [events, setEvents] = useState([]);
  const [staff, setStaff] = useState([]); // 참석자 후보 (user_profiles, role IN onsite/master)
  const [availableSocieties, setAvailableSocieties] = useState([]);
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [societyModalOpen, setSocietyModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrDialogEvent, setQrDialogEvent] = useState(null);
  const [qrSvg, setQrSvg] = useState('');

  // 행 ⋯ 메뉴
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuEvent, setMenuEvent] = useState(null);

  // 지불증(수당 영수증) 모달
  const [receiptEvent, setReceiptEvent] = useState(null);

  // 필터
  const [dateFilter, setDateFilter] = useState('year'); // 'year'(기본) | 'h1' | 'h2'
  const [societyFilter, setSocietyFilter] = useState('all');
  const [attendeeFilter, setAttendeeFilter] = useState('all'); // 'all' | 'me' | userId

  const staffMap = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s])), [staff]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const [eventsRes, societiesRes, staffRes] = await Promise.all([
        supabase
          .from('events')
          .select('id, name, discount_rate, order_url_slug, start_date, end_date, estimated_delivery_date, event_year, host_society, event_season, status, venue, attendee_ids, note, marketing_cost')
          .order('start_date', { ascending: true }),
        supabase.from('societies').select('id, name, slug_prefix').order('name', { ascending: true }),
        supabase
          .from('user_profiles')
          .select('id, name, role, position')
          .in('role', ['master', 'onsite'])
          .order('name', { ascending: true }),
      ]);

      if (eventsRes.error) {
        console.error('Error fetching events:', eventsRes.error);
        addNotification('학회 정보를 불러오는 데 실패했습니다.', 'error');
      } else {
        setEvents(eventsRes.data || []);
      }
      if (!societiesRes.error && societiesRes.data) setAvailableSocieties(societiesRes.data);
      if (!staffRes.error && staffRes.data) setStaff(staffRes.data);
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    fetchEvents();
    const channel = supabase
      .channel('events_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => fetchEvents())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEvents]);

  const handleOpen = (event = null) => {
    setIsEditing(!!event);
    setCurrentEvent(
      event || {
        name: '', discount_rate: 0, order_url_slug: '', start_date: '', end_date: '',
        estimated_delivery_date: '', event_year: new Date().getFullYear(), host_society: '',
        event_season: '', venue: '', attendee_ids: [], note: '', marketing_cost: null,
      }
    );
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setCurrentEvent(null);
  };

  const handleChange = (name, value) => {
    setCurrentEvent((prev) => {
      let newState = { ...prev, [name]: value };

      if (name === 'name' && !isEditing && !newState.order_url_slug) {
        newState.order_url_slug = value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      }
      if (name === 'name') newState._nameTouched = true;

      if (['event_year', 'host_society', 'event_season'].includes(name)) {
        const newYear = name === 'event_year' ? value : prev.event_year;
        const newSociety = name === 'host_society' ? value : prev.host_society;
        const newSeason = name === 'event_season' ? value : prev.event_season;

        if (newYear && newSociety && newSeason) {
          if (!prev._nameTouched) newState.name = `${newYear} ${newSociety} ${newSeason}`;

          if (!isEditing) {
            const societyObj = availableSocieties.find((s) => s.name === newSociety);
            if (societyObj) {
              const seasonMap = {
                '춘계학술대회': 'spring', '추계학술대회': 'fall', '연수강좌': 'training',
                '보수교육': 'edu', '세미나': 'seminar', '기타': 'etc',
              };
              const sPrefix = societyObj.slug_prefix || 'event';
              const seasonEng = seasonMap[newSeason] || 'etc';
              const randomToken = Math.random().toString(36).slice(2, 6);
              newState.order_url_slug = `${sPrefix}-${newYear}-${seasonEng}-${randomToken}`;
            }
          }
        }
      }
      return newState;
    });
  };

  const handleSave = async () => {
    if (!canEdit) {
      addNotification('학회 정보를 편집할 권한이 없습니다.', 'error');
      return;
    }
    if (!currentEvent) return;

    if (!currentEvent.name || !currentEvent.order_url_slug) {
      addNotification('학회명과 고유 주소는 필수입니다.', 'error');
      return;
    }

    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(currentEvent.order_url_slug)) {
      addNotification('고유 주소는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.', 'error');
      return;
    }

    const { data: existingEvent, error: fetchError } = await supabase
      .from('events')
      .select('id')
      .eq('order_url_slug', currentEvent.order_url_slug)
      .not('id', 'eq', currentEvent.id || -1)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      addNotification(`중복 검사 실패: ${fetchError.message}`, 'error');
      return;
    }
    if (existingEvent) {
      addNotification('이미 사용중인 고유 주소입니다.', 'error');
      return;
    }

    const { id, _nameTouched, ...upsertData } = currentEvent;
    // 정합: 빈 배열/빈 비용 정규화 (uuid[]·integer 컬럼).
    upsertData.attendee_ids = Array.isArray(upsertData.attendee_ids) ? upsertData.attendee_ids : [];
    upsertData.marketing_cost =
      upsertData.marketing_cost === '' || upsertData.marketing_cost == null
        ? null
        : Number(upsertData.marketing_cost);

    const query = isEditing
      ? supabase.from('events').update(upsertData).eq('id', id)
      : supabase.from('events').insert([upsertData]);

    const { error } = await query;
    if (error) {
      addNotification(`저장 실패: ${error.message}`, 'error');
    } else {
      addNotification('성공적으로 저장되었습니다.', 'success');
      fetchEvents();
      handleClose();
    }
  };

  const handleDeleteClick = async () => {
    if (!currentEvent?.id) return;
    const { count, error } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', currentEvent.id);
    if (error) {
      addNotification(`확인 실패: ${error.message}`, 'error');
      return;
    }
    if (count > 0) {
      addNotification(`이 행사에 연결된 주문 ${count}건이 있어 삭제할 수 없습니다.`, 'warning');
      return;
    }
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    const { error } = await supabase.from('events').delete().eq('id', currentEvent.id);
    if (error) {
      addNotification(`삭제 실패: ${error.message}`, 'error');
    } else {
      addNotification('행사가 삭제되었습니다.', 'success');
      setDeleteConfirmOpen(false);
      handleClose();
      fetchEvents();
    }
  };

  const handleCopyUrl = (slug) => {
    const url = `${window.location.origin}/order?events=${slug}`;
    navigator.clipboard.writeText(url);
    addNotification('주문 URL이 클립보드에 복사되었습니다.', 'success');
  };

  const handleOpenQrDialog = async (event) => {
    const url = `${window.location.origin}/order?events=${event.order_url_slug}`;
    try {
      const svgStr = await QRCode.toString(url, {
        type: 'svg',
        color: { dark: '#252525', light: '#FFFFFF' },
        margin: 1,
        width: 300,
      });
      setQrSvg(svgStr);
      setQrDialogEvent(event);
      setQrDialogOpen(true);
    } catch (err) {
      console.error('QR generation error:', err);
      addNotification('QR 코드 생성에 실패했습니다.', 'error');
    }
  };

  const handleDownloadQrSvg = () => {
    if (!qrSvg || !qrDialogEvent) return;
    const blob = new Blob([qrSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${qrDialogEvent.order_url_slug}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addNotification('QR 코드가 다운로드되었습니다.', 'success');
  };

  // ⋯ 메뉴
  const openMenu = (anchor, event) => { setMenuAnchor(anchor); setMenuEvent(event); };
  const closeMenu = () => setMenuAnchor(null);
  const handleMenuEdit = () => { closeMenu(); handleOpen(menuEvent); };
  const handleMenuOpenUrl = () => {
    closeMenu();
    window.open(`${window.location.origin}/order?events=${menuEvent.order_url_slug}`, '_blank');
  };
  const handleMenuCopyUrl = () => { closeMenu(); handleCopyUrl(menuEvent.order_url_slug); };
  const handleMenuShowQr = () => { const ev = menuEvent; closeMenu(); handleOpenQrDialog(ev); };
  const handleMenuReceipt = () => { const ev = menuEvent; closeMenu(); setReceiptEvent(ev); };
  const handleMenuDelete = async () => {
    setCurrentEvent(menuEvent);
    closeMenu();
    if (!menuEvent?.id) return;
    const { count, error } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', menuEvent.id);
    if (error) {
      addNotification(`확인 실패: ${error.message}`, 'error');
      return;
    }
    if (count > 0) {
      addNotification(`이 행사에 연결된 주문 ${count}건이 있어 삭제할 수 없습니다.`, 'warning');
      return;
    }
    setDeleteConfirmOpen(true);
  };

  // 행 본문 클릭 → L2 학회 통합 상세(/admin/events/:slug)
  const handleRowClick = (event) => {
    if (!event.order_url_slug) {
      addNotification('이 학회는 고유 주소가 없어 상세로 이동할 수 없습니다.', 'warning');
      return;
    }
    navigate(`/admin/events/${event.order_url_slug}`);
  };

  if (!user || !hasPermission('events:view')) {
    return <Box sx={{ p: 3 }}><Typography>학회 관리 페이지 접근 권한이 없습니다.</Typography></Box>;
  }

  const today = getTodayKST();

  // 정렬 ASC + 필터
  const filteredEvents = events.filter((event) => {
    const month = event.start_date ? Number(event.start_date.slice(5, 7)) : null;
    if (dateFilter === 'year' && event.event_year && event.event_year !== new Date().getFullYear()) return false;
    if (dateFilter === 'h1' && (!month || month > 6)) return false;
    if (dateFilter === 'h2' && (!month || month <= 6)) return false;
    if (societyFilter !== 'all' && event.host_society !== societyFilter) return false;
    if (attendeeFilter === 'me') {
      if (!myId || !(event.attendee_ids || []).includes(myId)) return false;
    } else if (attendeeFilter !== 'all') {
      if (!(event.attendee_ids || []).includes(attendeeFilter)) return false;
    }
    return true;
  });

  // Upcoming 하이라이트: 내가 attendee_ids 포함된 미래 가장 가까운 1건.
  // master = 전체 미래 1건 · 내 참석 0건이면 전체 다음 1건 폴백.
  const futureEvents = events.filter((e) => e.start_date && e.start_date > today);
  let upcomingId = null;
  if (futureEvents.length) {
    if (isMaster) {
      upcomingId = futureEvents[0].id;
    } else {
      const mine = myId ? futureEvents.find((e) => (e.attendee_ids || []).includes(myId)) : null;
      upcomingId = (mine || futureEvents[0]).id;
    }
  }

  const distinctSocieties = [...new Set(events.map((e) => e.host_society).filter(Boolean))];

  const activeFilterCount =
    (dateFilter !== 'year' ? 1 : 0) + (societyFilter !== 'all' ? 1 : 0) + (attendeeFilter !== 'all' ? 1 : 0);

  const headerAction = (
    <Box sx={{ display: 'flex', gap: 1 }}>
      {canEdit && (
        <Button variant="outlined" startIcon={<SettingsIcon />} onClick={() => setSocietyModalOpen(true)}>
          학회 목록 관리
        </Button>
      )}
      {canEdit && (
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          학회 추가
        </Button>
      )}
    </Box>
  );

  const DATE_TOGGLES = [
    { key: 'year', label: `올해(${new Date().getFullYear()})` },
    { key: 'h1', label: '상반기' },
    { key: 'h2', label: '하반기' },
  ];

  const resetFilters = () => { setDateFilter('year'); setSocietyFilter('all'); setAttendeeFilter('all'); };

  // 다이얼로그: attendee_ids(uuid[]) ↔ 후보 객체 배열 매핑
  const selectedAttendees = (currentEvent?.attendee_ids || [])
    .map((id) => staffMap[id])
    .filter(Boolean);

  const costNum = currentEvent?.marketing_cost ? Number(currentEvent.marketing_cost) : 0;

  return (
    <Box>
      <PageHeader
        title="학회"
        subtitle={`${new Date().getFullYear()}년 학회 ${filteredEvents.length}건 · 운영 대상 한눈에`}
        icon={EventNoteIcon}
        action={headerAction}
      />

      {/* 필터바 */}
      <SectionCard sx={{ mb: 2 }} padding={20}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <FilterListIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>필터</Typography>
          {activeFilterCount > 0 && (
            <Chip
              label={activeFilterCount}
              size="small"
              sx={{ height: 18, fontWeight: 700, bgcolor: 'primary.main', color: 'primary.contrastText', '& .MuiChip-label': { ...theme.typography.caption } }}
            />
          )}
        </Box>

        {/* Row 1 — 기간 토글 */}
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

        {/* Row 2 — 학회명 + 참석자 + "나" 칩 */}
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
            <Select
              value={attendeeFilter === 'me' ? 'all' : attendeeFilter}
              label="참석자"
              onChange={(e) => setAttendeeFilter(e.target.value)}
            >
              <MenuItem value="all">전체 참석자</MenuItem>
              {staff.map((s) => (
                <MenuItem key={s.id} value={s.id}>{s.name}{s.role === 'master' ? ' (마스터)' : ''}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* "나" 빠른필터 칩 — attendeeFilter 단일 상태 토글 */}
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

      {/* 목록 */}
      {loading ? (
        <SectionCard padding={0}>
          <TableContainer>
            <Table>
              <TableBody>
                <TableSkeleton rows={5} columns={7} />
              </TableBody>
            </Table>
          </TableContainer>
        </SectionCard>
      ) : filteredEvents.length === 0 ? (
        <SectionCard padding={20}>
          <EmptyState
            icon={EventNoteIcon}
            title="해당 조건의 학회가 없어요"
            description="필터를 해제하거나 새 학회를 추가하세요"
            action={
              activeFilterCount > 0
                ? { label: '필터 해제', onClick: resetFilters }
                : canEdit
                ? { label: '학회 추가', startIcon: <AddIcon />, onClick: () => handleOpen() }
                : undefined
            }
          />
        </SectionCard>
      ) : isMobile ? (
        // ─── 모바일 카드 ───
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {filteredEvents.map((event) => {
            const st = getEventStatusKST(event.start_date, event.end_date);
            const ended = st.label === '종료';
            const isUpcoming = event.id === upcomingId;
            return (
              <Box
                key={event.id}
                onClick={() => handleRowClick(event)}
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <EventStateBadge startDate={event.start_date} endDate={event.end_date} />
                  <DiscountChip rate={event.discount_rate} />
                  <Box sx={{ ml: 'auto' }}>
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); openMenu(e.currentTarget, event); }}
                      sx={{ color: 'text.secondary' }}
                      aria-label="행 메뉴 열기"
                    >
                      <MoreVertIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                  </Box>
                </Box>

                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    {isUpcoming && <StarBorderIcon sx={{ fontSize: 16, color: 'primary.main' }} />}
                    <Typography variant="subtitle1" sx={{ color: ended ? 'text.secondary' : 'text.primary', lineHeight: 1.3 }}>
                      {event.host_society || event.name}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
                    {event.event_season}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <EventNoteIcon sx={{ fontSize: 15, color: 'text.disabled', flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1' }}>
                      {dot(event.start_date)}
                      {event.end_date && event.end_date !== event.start_date ? ` ~ ${dot(event.end_date)}` : ''}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <PlaceIcon sx={{ fontSize: 15, color: 'text.disabled', flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>{event.venue || '—'}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
                    <PersonIcon sx={{ fontSize: 15, color: 'text.disabled', flexShrink: 0, mt: 0.25 }} />
                    <AttendeeCell ids={event.attendee_ids} staffMap={staffMap} myId={myId} />
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      ) : (
        // ─── 데스크톱/태블릿 표 ───
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
                {filteredEvents.map((event, i) => {
                  const st = getEventStatusKST(event.start_date, event.end_date);
                  const ended = st.label === '종료';
                  const isUpcoming = event.id === upcomingId;
                  return (
                    <TableRow
                      key={event.id}
                      hover
                      onClick={() => handleRowClick(event)}
                      sx={{
                        cursor: 'pointer',
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
                      <TableCell sx={{ width: 56 }}>
                        <Typography variant="body2" sx={{ color: 'text.disabled', fontWeight: 500, fontFeatureSettings: '"tnum" 1' }}>
                          {i + 1}
                        </Typography>
                      </TableCell>

                      <TableCell sx={{ minWidth: 160 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {isUpcoming && (
                            <Tooltip title="내 참석 다음 학회" arrow placement="top">
                              <StarBorderIcon sx={{ fontSize: 16, color: 'primary.main', flexShrink: 0 }} />
                            </Tooltip>
                          )}
                          <Typography variant="body2" sx={{ fontWeight: 700, color: ended ? 'text.secondary' : 'text.primary' }}>
                            {event.host_society || event.name}
                          </Typography>
                        </Box>
                        <Box sx={{ mt: 0.5 }}>
                          <EventStateBadge startDate={event.start_date} endDate={event.end_date} />
                        </Box>
                      </TableCell>

                      <TableCell sx={{ minWidth: 180 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>{event.event_season}</Typography>
                          <DiscountChip rate={event.discount_rate} />
                        </Box>
                      </TableCell>

                      <TableCell sx={{ minWidth: 120 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500, fontFeatureSettings: '"tnum" 1' }}>
                          {dot(event.start_date)}
                        </Typography>
                        {event.end_date && event.end_date !== event.start_date && (
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1' }}>
                            ~ {dot(event.end_date)}
                          </Typography>
                        )}
                      </TableCell>

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

                      <TableCell sx={{ minWidth: 150 }}>
                        <AttendeeCell ids={event.attendee_ids} staffMap={staffMap} myId={myId} />
                      </TableCell>

                      <TableCell align="right" sx={{ width: 56 }}>
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); openMenu(e.currentTarget, event); }}
                          sx={{ color: 'text.secondary', '&:hover': { bgcolor: theme.gray[100], color: 'text.primary' } }}
                          aria-label="행 메뉴 열기"
                        >
                          <MoreVertIcon sx={{ fontSize: 20 }} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </SectionCard>
      )}

      {/* ⋯ 행 액션 메뉴 */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 200, borderRadius: `${theme.radii.md}px`, boxShadow: theme.customShadows.md } } }}
      >
        {canEdit && (
          <MenuItem onClick={handleMenuEdit} sx={{ minHeight: 44 }}>
            <ListItemIcon><EditIcon sx={{ fontSize: 18 }} /></ListItemIcon>
            <ListItemText primary="수정" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
          </MenuItem>
        )}
        <MenuItem onClick={handleMenuOpenUrl} sx={{ minHeight: 44 }}>
          <ListItemIcon><OpenInNewIcon sx={{ fontSize: 18 }} /></ListItemIcon>
          <ListItemText primary="주문 페이지 열기" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
        </MenuItem>
        <MenuItem onClick={handleMenuCopyUrl} sx={{ minHeight: 44 }}>
          <ListItemIcon><CopyIcon sx={{ fontSize: 18 }} /></ListItemIcon>
          <ListItemText primary="주문 URL 복사" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
        </MenuItem>
        <MenuItem onClick={handleMenuShowQr} sx={{ minHeight: 44 }}>
          <ListItemIcon><QrCode2Icon sx={{ fontSize: 18 }} /></ListItemIcon>
          <ListItemText primary="QR 코드" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
        </MenuItem>
        <MenuItem onClick={handleMenuReceipt} sx={{ minHeight: 44 }}>
          <ListItemIcon><ReceiptLongIcon sx={{ fontSize: 18 }} /></ListItemIcon>
          <ListItemText primary="지불증 내보내기" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
        </MenuItem>
        {/* MUI Menu는 Fragment 자식 불가 → 두 조건부 자식으로 분리 */}
        {isMaster && <Divider sx={{ my: 0.5 }} />}
        {isMaster && (
          <MenuItem onClick={handleMenuDelete} sx={{ minHeight: 44, color: 'error.main' }}>
            <ListItemIcon><DeleteIcon sx={{ fontSize: 18, color: theme.palette.error.main }} /></ListItemIcon>
            <ListItemText primary="삭제" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
          </MenuItem>
        )}
      </Menu>

      {/* 지불증(수당 영수증) 모달 — A10b */}
      <PaymentReceiptModal
        open={Boolean(receiptEvent)}
        onClose={() => setReceiptEvent(null)}
        event={receiptEvent}
        staff={staff}
      />

      {/* 추가/수정 다이얼로그 */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ p: 3, pb: 0 }}>{isEditing ? '학회 수정' : '새 학회 추가'}</DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            {/* Step 1 — 행사명 형식 카드 */}
            <Box
              sx={{
                p: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.04),
                borderRadius: `${theme.radii.md}px`,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                ✦ 행사명 형식
              </Typography>

              <TextField
                select
                fullWidth
                label="연도"
                name="event_year"
                value={currentEvent?.event_year || ''}
                onChange={(e) => handleChange(e.target.name, e.target.value)}
                disabled={!canEdit}
                InputLabelProps={{ shrink: true }}
              >
                <MenuItem value=""><em>연도 선택</em></MenuItem>
                {[...Array(5)].map((_, i) => {
                  const year = new Date().getFullYear() - 1 + i;
                  return <MenuItem key={year} value={year}>{year}년</MenuItem>;
                })}
              </TextField>

              <Autocomplete
                freeSolo
                options={['춘계학술대회', '추계학술대회', '연수강좌', '보수교육', '세미나', '기타']}
                inputValue={currentEvent?.event_season || ''}
                onInputChange={(e, newInputValue) => handleChange('event_season', newInputValue)}
                disabled={!canEdit}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="행사 구분"
                    placeholder="목록에서 선택하거나 직접 입력"
                    InputLabelProps={{ shrink: true }}
                  />
                )}
              />

              <TextField
                select
                fullWidth
                label="주최 학회"
                name="host_society"
                value={currentEvent?.host_society || ''}
                onChange={(e) => handleChange('host_society', e.target.value)}
                disabled={!canEdit}
                InputLabelProps={{ shrink: true }}
                helperText="학회 목록 관리에서 추가한 학회 중 선택"
              >
                <MenuItem value=""><em>학회 선택</em></MenuItem>
                {availableSocieties.map((s) => (
                  <MenuItem key={s.id} value={s.name}>{s.name}</MenuItem>
                ))}
              </TextField>
            </Box>

            <Divider />

            {/* Step 2 — 기본 정보 */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                name="name"
                label="행사명"
                fullWidth
                value={currentEvent?.name || ''}
                onChange={(e) => handleChange(e.target.name, e.target.value)}
                disabled={!canEdit}
                InputLabelProps={{ shrink: true }}
                helperText="위 정보로 자동 완성되며, 직접 입력·수정할 수 있습니다."
              />
              <TextField
                name="order_url_slug"
                label="주문 URL"
                type="text"
                fullWidth
                value={currentEvent?.order_url_slug || ''}
                onChange={(e) => handleChange(e.target.name, e.target.value)}
                InputLabelProps={{ shrink: true }}
                helperText="주문 페이지 주소로 사용됩니다. 영문, 숫자, 하이픈만 가능"
              />

              <TextField
                name="discount_rate"
                label="할인율 (%)"
                type="number"
                fullWidth
                value={currentEvent?.discount_rate ? Math.round(currentEvent.discount_rate * 100) : 0}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  handleChange('discount_rate', val / 100);
                }}
                inputProps={{ step: '1', min: '0', max: '100' }}
                InputLabelProps={{ shrink: true }}
                helperText="예: 15 = 15% 할인"
                disabled={!canEdit}
              />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  name="start_date"
                  label="시작일"
                  type="date"
                  fullWidth
                  value={currentEvent?.start_date || ''}
                  onChange={(e) => handleChange(e.target.name, e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  disabled={!canEdit}
                />
                <TextField
                  name="end_date"
                  label="종료일"
                  type="date"
                  fullWidth
                  value={currentEvent?.end_date || ''}
                  onChange={(e) => handleChange(e.target.name, e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  disabled={!canEdit}
                />
              </Box>

              <TextField
                name="estimated_delivery_date"
                label="배송 예정일"
                type="date"
                fullWidth
                value={currentEvent?.estimated_delivery_date || ''}
                onChange={(e) => handleChange(e.target.name, e.target.value)}
                InputLabelProps={{ shrink: true }}
                helperText="입력 시 고객 주문 조회 페이지에 도착 예정일이 표시됩니다."
                disabled={!canEdit}
              />
            </Box>

            <Divider />

            {/* Step 3 — 운영 정보 (신규 4: 장소·참석자·비용·비고) */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                운영 정보
              </Typography>

              <TextField
                name="venue"
                label="장소"
                fullWidth
                value={currentEvent?.venue || ''}
                onChange={(e) => handleChange(e.target.name, e.target.value)}
                disabled={!canEdit}
                placeholder="예) 서울 코엑스 그랜드볼룸"
                InputProps={{ startAdornment: <InputAdornment position="start"><PlaceIcon sx={{ fontSize: 18, color: 'text.disabled' }} /></InputAdornment> }}
                InputLabelProps={{ shrink: true }}
              />

              {/* 참석자 멀티선택 — 후보 = user_profiles role IN (master, onsite) */}
              <Autocomplete
                multiple
                disableCloseOnSelect
                options={staff}
                value={selectedAttendees}
                onChange={(_, v) => handleChange('attendee_ids', v.map((o) => o.id))}
                getOptionLabel={(o) => o.name}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                disabled={!canEdit}
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
                    placeholder={selectedAttendees.length ? '' : '현장 담당자 선택'}
                    InputLabelProps={{ shrink: true }}
                    helperText="현장 마케팅 · 마스터 중 선택"
                  />
                )}
              />

              <Box>
                <TextField
                  name="marketing_cost"
                  label="비용 (원)"
                  fullWidth
                  value={costNum ? costNum.toLocaleString('ko-KR') : ''}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^0-9]/g, '');
                    handleChange('marketing_cost', digits === '' ? null : Number(digits));
                  }}
                  disabled={!canEdit}
                  placeholder="0"
                  inputProps={{ inputMode: 'numeric' }}
                  InputProps={{ endAdornment: <InputAdornment position="end">원</InputAdornment> }}
                  InputLabelProps={{ shrink: true }}
                />
                {costNum > 0 && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, ml: 1.75, display: 'block' }}>
                    {numberToKoreanCurrency(costNum)}원
                  </Typography>
                )}
              </Box>

              <TextField
                name="note"
                label="비고"
                fullWidth
                multiline
                minRows={2}
                value={currentEvent?.note || ''}
                onChange={(e) => handleChange(e.target.name, e.target.value)}
                disabled={!canEdit}
                placeholder="부스 위치, 진열 메모 등"
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          {isEditing && isMaster && (
            <Button onClick={handleDeleteClick} color="error" startIcon={<DeleteIcon />} sx={{ mr: 'auto' }}>
              삭제
            </Button>
          )}
          <Button onClick={handleClose}>취소</Button>
          {canEdit && (
            <Button onClick={handleSave} variant="contained">저장</Button>
          )}
        </DialogActions>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>행사 삭제</DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{currentEvent?.name}</strong> 행사를 삭제합니다.
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
            이 작업은 되돌릴 수 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)}>취소</Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error">삭제</Button>
        </DialogActions>
      </Dialog>

      <SocietyManagementDialog
        open={societyModalOpen}
        onClose={() => setSocietyModalOpen(false)}
        onUpdated={fetchEvents}
      />

      {/* QR 다이얼로그 */}
      <Dialog open={qrDialogOpen} onClose={() => setQrDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>QR 코드</DialogTitle>
        <DialogContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              mb: 2,
              '& svg': { maxWidth: '100%', height: 'auto' },
            }}
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          {qrDialogEvent && (
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{qrDialogEvent.name}</Typography>
              <Typography
                variant="body2"
                sx={{ color: 'text.secondary', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', mt: 0.5 }}
              >
                {`${window.location.origin}/order?events=${qrDialogEvent.order_url_slug}`}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleDownloadQrSvg}>SVG 다운로드</Button>
          <Button onClick={() => setQrDialogOpen(false)}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EventManagementPage;
