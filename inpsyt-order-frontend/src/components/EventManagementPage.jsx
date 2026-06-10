import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
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
  Chip,
  IconButton,
  alpha,
  useTheme,
  useMediaQuery,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
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
import TableSkeleton from './TableSkeleton';
import SocietyManagementDialog from './SocietyManagementDialog';
import PaymentReceiptModal from './PaymentReceiptModal';
import EventFormDialog from './EventFormDialog';
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
  // 삭제 노출: master 전부 / onsite(events:edit)는 본인 생성만. created_by null(기존 행) = master만.
  const canDeleteEvent = (ev) => isMaster || (canEdit && !!ev?.created_by && ev.created_by === myId);

  const [events, setEvents] = useState([]);
  const [staff, setStaff] = useState([]); // 참석자 후보 (user_profiles, role IN onsite/master)
  const [availableSocieties, setAvailableSocieties] = useState([]);
  const [loading, setLoading] = useState(false);

  // 추가/수정 다이얼로그 — EventFormDialog(공용 추출, L2와 공유)
  const [formOpen, setFormOpen] = useState(false);
  const [formEvent, setFormEvent] = useState(null); // null = 신규
  const [societyModalOpen, setSocietyModalOpen] = useState(false);
  // ⋯ 메뉴 경유 삭제 확인 (다이얼로그 내부 삭제는 EventFormDialog가 자체 처리)
  const [deleteTarget, setDeleteTarget] = useState(null);
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
          .select('id, name, discount_rate, order_url_slug, start_date, end_date, estimated_delivery_date, event_year, host_society, event_season, status, venue, attendee_ids, note, marketing_cost, created_by')
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
    setFormEvent(event);
    setFormOpen(true);
  };

  const handleClose = () => {
    setFormOpen(false);
    setFormEvent(null);
  };

  const handleDeleteConfirm = async () => {
    const { error } = await supabase.from('events').delete().eq('id', deleteTarget.id);
    if (error) {
      addNotification(`삭제 실패: ${error.message}`, 'error');
    } else {
      addNotification('행사가 삭제되었습니다.', 'success');
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
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
    const ev = menuEvent;
    closeMenu();
    if (!ev?.id) return;
    const { count, error } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', ev.id);
    if (error) {
      addNotification(`확인 실패: ${error.message}`, 'error');
      return;
    }
    if (count > 0) {
      addNotification(`이 행사에 연결된 주문 ${count}건이 있어 삭제할 수 없습니다.`, 'warning');
      return;
    }
    setDeleteTarget(ev);
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
        {canDeleteEvent(menuEvent) && <Divider sx={{ my: 0.5 }} />}
        {canDeleteEvent(menuEvent) && (
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

      {/* 추가/수정 다이얼로그 — 공용 EventFormDialog (L2 학회 상세와 공유) */}
      <EventFormDialog
        open={formOpen}
        onClose={handleClose}
        event={formEvent}
        societies={availableSocieties}
        staff={staff}
        canEdit={canEdit}
        canDelete={canDeleteEvent(formEvent)}
        onSaved={fetchEvents}
        onDeleted={fetchEvents}
      />

      {/* ⋯ 메뉴 경유 삭제 확인 다이얼로그 */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>행사 삭제</DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{deleteTarget?.name}</strong> 행사를 삭제합니다.
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
