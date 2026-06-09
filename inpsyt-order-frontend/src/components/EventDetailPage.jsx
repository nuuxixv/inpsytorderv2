import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, IconButton, CircularProgress, Dialog, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ArrowBack as ArrowBackIcon,
  EventNote as EventNoteIcon,
  PlaceOutlined as PlaceIcon,
  PersonOutline as PersonIcon,
  StickyNote2Outlined as NoteIcon,
  PaymentsOutlined as CostIcon,
  Edit as EditIcon,
  ReceiptLong as ReceiptLongIcon,
  Description as DescriptionIcon,
  Check as CheckIcon,
  Receipt as ReceiptIcon,
  Psychology as TestIcon,
  MenuBook as BookIcon,
  Assignment as ReportIcon,
  LocalOffer as LocalOfferIcon,
  EditNote as EditNoteIcon,
  EditOutlined as PrepEditIcon,
  Close as CloseIcon,
  LockOutlined as LockIcon,
  Inventory2Outlined as PrepIcon,
} from '@mui/icons-material';
import { supabase } from '../supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { getEventStatusKST } from '../utils/date';
import { numberToKoreanCurrency } from '../utils/koreanCurrency';
import { computeRevenueByCategory } from '../utils/revenueByCategory';
import {
  getEventBySlug, updateEventProgress, updateEventPrepNote, getOrdersForEventRevenue,
} from '../api/events';
import { PageHeader, SectionCard, StatCard, StatusBadge, EmptyState } from './ui';
import FieldReportSection from './FieldReportSection';
import PaymentReceiptModal from './PaymentReceiptModal';

// Toast UI 에디터/뷰어 = 무거운 의존성 → 지연 로드(초기/공개 번들 0 영향)
const PrepNoteEditor = lazy(() => import('./PrepNoteEditor'));
const PrepNoteViewer = lazy(() => import('./PrepNoteViewer'));

// ─── 헬퍼 ──────────────────────────────────────────────────────
const dot = (iso) => (iso ? iso.replaceAll('-', '.') : '');
const won = (n) => (n || 0).toLocaleString();

// 요일 — KST 고정 자정 파싱(off-by-one 방지)
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
const weekday = (iso) => (iso ? WEEKDAY_KO[new Date(`${iso}T00:00:00+09:00`).getDay()] : '');
const dotDay = (iso) => (iso ? `${dot(iso)}(${weekday(iso)})` : '');
// 단일일: 2026.06.07(토) / 기간: 2026.06.07(토) ~ 06.09(월) (같은 연도면 종료부 YYYY 생략)
const formatRange = (start, end) => {
  if (!start) return '';
  if (!end || end === start) return dotDay(start);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const endStr = sameYear ? `${dot(end).slice(5)}(${weekday(end)})` : dotDay(end);
  return `${dotDay(start)} ~ ${endStr}`;
};

// 시간상태 배지 — EventManagementPage 정합(getEventStatusKST → StatusBadge 토큰)
const STATUS_COLOR_TO_BADGE = { info: 'pending', success: 'paid', default: 'completed' };
const EventStateBadge = ({ start, end }) => {
  const st = getEventStatusKST(start, end);
  return <StatusBadge value={STATUS_COLOR_TO_BADGE[st.color] || 'pending'} label={st.label} size="md" />;
};

// 할인율 칩(>0%) — discount_rate(0~1) → %. EventManagementPage DiscountChip 정합.
const DiscountChip = ({ rate }) => {
  const theme = useTheme();
  const percent = Math.round((rate ?? 0) * 100);
  if (!percent || percent <= 0) return null;
  return (
    <Box
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.375,
        px: 0.75, py: 0.25,
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

// 참석자 칩 — L2 전체 펼침. "나" 우선·accent. master 보조 라벨. 삭제 uuid = "(삭제)".
const AttendeePillRow = ({ ids = [], staffMap, myId }) => {
  const theme = useTheme();
  if (!ids.length) {
    return <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>;
  }
  const ordered = [...ids].sort((a, b) => (a === myId ? -1 : b === myId ? 1 : 0));
  return (
    <Box sx={{ display: 'flex', gap: 0.625, flexWrap: 'wrap' }}>
      {ordered.map((id, i) => {
        const accent = id === myId;
        const name = staffMap[id]?.name || '(삭제)';
        const isMaster = staffMap[id]?.role === 'master';
        return (
          <Box
            key={`${id}-${i}`}
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.5,
              px: 1, py: 0.375,
              borderRadius: `${theme.radii.sm}px`,
              bgcolor: accent ? alpha(theme.palette.primary.main, 0.08) : theme.gray[100],
              border: `1px solid ${accent ? alpha(theme.palette.primary.main, 0.24) : theme.gray[200]}`,
            }}
          >
            <Typography
              variant="caption"
              sx={{ fontWeight: 600, color: accent ? 'primary.main' : 'text.secondary', lineHeight: 1.3 }}
            >
              {accent ? `나 (${name})` : name}
            </Typography>
            {isMaster && (
              <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 500, lineHeight: 1.3 }}>
                · 마스터
              </Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

// 개요 카드 한 줄(라벨 + 값)
const OverviewRow = ({ icon, label, children, alignTop }) => (
  <Box sx={{ display: 'flex', alignItems: alignTop ? 'flex-start' : 'center', gap: 1.5, py: 0.25 }}>
    <Box
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.75,
        width: 88, flexShrink: 0,
        mt: alignTop ? 0.25 : 0,
      }}
    >
      {icon}
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
        {label}
      </Typography>
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
  </Box>
);

const ROW_ICON_SX = { fontSize: 16, color: 'text.disabled', flexShrink: 0 };

// 진행상태 토글 칩(기안/신청/지결) — 독립 토글. events:edit자만.
const ProgressChip = ({ label, done, canEdit, onToggle }) => {
  const theme = useTheme();
  return (
    <Box
      role={canEdit ? 'button' : undefined}
      tabIndex={canEdit ? 0 : undefined}
      onClick={canEdit ? onToggle : undefined}
      onKeyDown={canEdit ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } } : undefined}
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.75,
        px: 1.5, minHeight: 44,
        borderRadius: `${theme.radii.md}px`,
        cursor: canEdit ? 'pointer' : 'default',
        bgcolor: done ? alpha(theme.palette.primary.main, 0.1) : theme.gray[50],
        border: `1px solid ${done ? alpha(theme.palette.primary.main, 0.3) : theme.gray[200]}`,
        transition: `all 0.15s ${theme.easing.toss}`,
        '&:hover': canEdit
          ? { bgcolor: done ? alpha(theme.palette.primary.main, 0.16) : theme.gray[100], borderColor: done ? alpha(theme.palette.primary.main, 0.4) : theme.gray[300] }
          : {},
        '&:focus-visible': { outline: 'none', boxShadow: theme.customShadows.focus },
      }}
    >
      <Box
        sx={{
          width: 18, height: 18, flexShrink: 0,
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: done ? 'primary.main' : 'transparent',
          border: done ? 'none' : `1.5px solid ${theme.gray[300]}`,
        }}
      >
        {done && <CheckIcon sx={{ fontSize: 12, color: 'primary.contrastText' }} />}
      </Box>
      <Typography
        variant="body2"
        sx={{ fontWeight: done ? 700 : 600, color: done ? 'primary.main' : 'text.secondary' }}
      >
        {label}
      </Typography>
    </Box>
  );
};

// 에디터/뷰어 로딩 폴백
const EditorFallback = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress size={24} /></Box>
);

// ─── 메인 ──────────────────────────────────────────────────────
const EventDetailPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { slug } = useParams();
  const { user, profile, hasPermission } = useAuth();
  const { addNotification } = useNotification();

  const canEdit = hasPermission('events:edit');
  const myId = user?.id || null;

  const [event, setEvent] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // 진행상태(낙관적 로컬 + DB 반영)
  const [progress, setProgress] = useState({ draft: false, application: false, paymentResolution: false });

  // 매출
  const [orders, setOrders] = useState([]);

  // 준비 노트
  const [editingNote, setEditingNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const getNoteHtmlRef = React.useRef(() => '');

  // 라이트박스
  const [lightboxSrc, setLightboxSrc] = useState(null);

  // 학회 정보 수정 — A10 목록(다이얼로그 포함)으로 이동
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const staffMap = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s])), [staff]);

  const loadEvent = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const [ev, staffRes] = await Promise.all([
        getEventBySlug(slug),
        supabase
          .from('user_profiles')
          .select('id, name, role, position')
          .in('role', ['master', 'onsite'])
          .order('name', { ascending: true }),
      ]);
      if (!ev) { setNotFound(true); setEvent(null); return; }
      setEvent(ev);
      setProgress({
        draft: !!ev.draft_done,
        application: !!ev.application_done,
        paymentResolution: !!ev.payment_resolution_done,
      });
      if (!staffRes.error && staffRes.data) setStaff(staffRes.data);

      // 매출 주문 — paid 필터는 util이 수행
      try {
        const ords = await getOrdersForEventRevenue(ev.id);
        setOrders(ords);
      } catch { setOrders([]); }
    } catch (e) {
      console.error(e);
      addNotification('학회 정보를 불러오지 못했습니다.', 'error');
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [slug, addNotification]);

  useEffect(() => { loadEvent(); }, [loadEvent]);

  // 권한 가드
  if (user && !hasPermission('events:view')) {
    return <Box sx={{ p: 3 }}><Typography>학회 상세 접근 권한이 없습니다.</Typography></Box>;
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;
  }

  if (notFound || !event) {
    return (
      <Box>
        <Box sx={{ mb: 1 }}>
          <Button
            size="small" variant="text"
            startIcon={<ArrowBackIcon sx={{ fontSize: 18 }} />}
            onClick={() => navigate('/admin/events')}
            sx={{ minHeight: 36, color: 'text.secondary', ml: -1 }}
          >
            학회 목록
          </Button>
        </Box>
        <SectionCard padding={20}>
          <EmptyState
            icon={EventNoteIcon}
            title="학회를 찾을 수 없어요"
            description="주소가 바뀌었거나 삭제된 학회일 수 있어요"
            action={{ label: '학회 목록으로', onClick: () => navigate('/admin/events') }}
          />
        </SectionCard>
      </Box>
    );
  }

  const handleToggleProgress = async (key, column) => {
    if (!canEdit) return;
    const next = !progress[key];
    setProgress((p) => ({ ...p, [key]: next })); // 낙관적
    try {
      await updateEventProgress(event.id, { [column]: next });
    } catch {
      setProgress((p) => ({ ...p, [key]: !next })); // 롤백
      addNotification('진행 상태 저장에 실패했습니다.', 'error');
    }
  };

  const handleSaveNote = async () => {
    if (!canEdit) return;
    setSavingNote(true);
    try {
      const html = getNoteHtmlRef.current();
      await updateEventPrepNote(event.id, html);
      setEvent((e) => ({ ...e, prep_note: html }));
      setEditingNote(false);
      addNotification('준비 노트를 저장했습니다.', 'success');
    } catch {
      addNotification('준비 노트 저장에 실패했습니다.', 'error');
    }
    setSavingNote(false);
  };

  const handleExportDeposit = async () => {
    setExporting(true);
    try {
      const data = await getOrdersForEventRevenue(event.id);
      const { exportDepositResolution } = await import('../utils/depositResolution');
      await exportDepositResolution({
        event,
        orders: data,
        authorName: profile?.name || '',
        department: profile?.department || '',
      });
      addNotification('입금결의서를 내보냈습니다.', 'success');
    } catch (e) {
      console.error(e);
      addNotification(`입금결의서 내보내기 실패: ${e.message}`, 'error');
    }
    setExporting(false);
  };

  const revenue = computeRevenueByCategory(orders);
  const hasRevenue = revenue.total > 0;
  const titleName = event.host_society || event.name;

  const headerAction = (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      {canEdit && (
        <Button
          size="small" variant="outlined"
          startIcon={<EditIcon sx={{ fontSize: 16 }} />}
          onClick={() => navigate('/admin/events')}
          sx={{ minHeight: 36 }}
        >
          학회 정보 수정
        </Button>
      )}
      <Button
        size="small" variant="outlined"
        startIcon={<DescriptionIcon sx={{ fontSize: 16 }} />}
        onClick={handleExportDeposit}
        disabled={exporting}
        sx={{ minHeight: 36 }}
      >
        {exporting ? '생성중...' : '입금결의서'}
      </Button>
      <Button
        size="small" variant="outlined"
        startIcon={<ReceiptLongIcon sx={{ fontSize: 16 }} />}
        onClick={() => setReceiptOpen(true)}
        sx={{ minHeight: 36 }}
      >
        지불증
      </Button>
    </Box>
  );

  return (
    <Box>
      {/* 뒤로(학회 목록) */}
      <Box sx={{ mb: 1 }}>
        <Button
          size="small" variant="text"
          startIcon={<ArrowBackIcon sx={{ fontSize: 18 }} />}
          onClick={() => navigate('/admin/events')}
          sx={{ minHeight: 36, color: 'text.secondary', ml: -1 }}
        >
          학회 목록
        </Button>
      </Box>

      <PageHeader
        title={titleName}
        subtitle={
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>{event.event_season}</Box>
            {event.event_season && <Box component="span" sx={{ color: 'text.disabled' }}>·</Box>}
            <Box component="span" sx={{ fontFeatureSettings: '"tnum" 1' }}>
              {formatRange(event.start_date, event.end_date)}
            </Box>
          </Box>
        }
        icon={EventNoteIcon}
        action={headerAction}
      />
      {/* 상태배지 + 할인율 — 헤더 직하 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3, mt: -1 }}>
        <EventStateBadge start={event.start_date} end={event.end_date} />
        <DiscountChip rate={event.discount_rate} />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* ─── 개요 ─── */}
        <SectionCard title="개요" icon={EventNoteIcon}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <OverviewRow icon={<PlaceIcon sx={ROW_ICON_SX} />} label="장소">
              <Typography variant="body2" sx={{ color: event.venue ? 'text.primary' : 'text.disabled', fontWeight: 500 }}>
                {event.venue || '—'}
              </Typography>
            </OverviewRow>
            <OverviewRow icon={<EventNoteIcon sx={ROW_ICON_SX} />} label="날짜">
              <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500, fontFeatureSettings: '"tnum" 1' }}>
                {formatRange(event.start_date, event.end_date) || '—'}
              </Typography>
            </OverviewRow>
            <OverviewRow icon={<PersonIcon sx={ROW_ICON_SX} />} label="참석자" alignTop>
              <AttendeePillRow ids={event.attendee_ids || []} staffMap={staffMap} myId={myId} />
            </OverviewRow>
            <OverviewRow icon={<CostIcon sx={ROW_ICON_SX} />} label="비용">
              <Box>
                <Typography variant="body2" sx={{ color: event.marketing_cost ? 'text.primary' : 'text.disabled', fontWeight: 600, fontFeatureSettings: '"tnum" 1' }}>
                  {event.marketing_cost ? `${won(event.marketing_cost)}원` : '—'}
                </Typography>
                {event.marketing_cost > 0 && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    {numberToKoreanCurrency(event.marketing_cost)}원
                  </Typography>
                )}
              </Box>
            </OverviewRow>
            <OverviewRow icon={<NoteIcon sx={ROW_ICON_SX} />} label="비고" alignTop>
              <Typography variant="body2" sx={{ color: event.note ? 'text.primary' : 'text.disabled', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {event.note || '—'}
              </Typography>
            </OverviewRow>
          </Box>
        </SectionCard>

        {/* ─── 진행 상태 ─── */}
        <SectionCard title="진행 상태" icon={EditNoteIcon} subtitle={canEdit ? '칩을 눌러 완료 여부를 표시하세요 (독립 항목)' : undefined}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <ProgressChip label="기안" done={progress.draft} canEdit={canEdit} onToggle={() => handleToggleProgress('draft', 'draft_done')} />
            <ProgressChip label="신청" done={progress.application} canEdit={canEdit} onToggle={() => handleToggleProgress('application', 'application_done')} />
            <ProgressChip label="지결" done={progress.paymentResolution} canEdit={canEdit} onToggle={() => handleToggleProgress('paymentResolution', 'payment_resolution_done')} />
          </Box>
        </SectionCard>

        {/* ─── 준비 노트 (통합 에디터) ─── */}
        <SectionCard
          title="준비 노트"
          icon={PrepIcon}
          subtitle="준비물 체크리스트 · 학회 자료(이미지) · 학회 정보를 한 곳에"
          action={
            canEdit && !editingNote ? (
              <Button
                size="small" variant="outlined"
                startIcon={<PrepEditIcon sx={{ fontSize: 16 }} />}
                onClick={() => setEditingNote(true)}
                sx={{ minHeight: 36 }}
              >
                편집
              </Button>
            ) : undefined
          }
        >
          {editingNote ? (
            <Box>
              <Suspense fallback={<EditorFallback />}>
                <PrepNoteEditor
                  eventId={event.id}
                  initialValue={event.prep_note || ''}
                  onReady={(getHtml) => { getNoteHtmlRef.current = getHtml; }}
                  onImageError={(msg) => addNotification(msg, 'warning')}
                />
              </Suspense>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 2 }}>
                <Button size="small" onClick={() => setEditingNote(false)} disabled={savingNote}>취소</Button>
                <Button size="small" variant="contained" onClick={handleSaveNote} disabled={savingNote}>
                  {savingNote ? '저장중...' : '저장'}
                </Button>
              </Box>
            </Box>
          ) : event.prep_note ? (
            <Suspense fallback={<EditorFallback />}>
              <PrepNoteViewer content={event.prep_note} onImageClick={(src) => setLightboxSrc(src)} />
            </Suspense>
          ) : (
            <EmptyState
              icon={PrepIcon}
              title="준비 노트가 비어 있어요"
              description="준비물 체크리스트, 프로그램·부스 배치도 이미지, 설치·철거 안내 등을 한 곳에 정리하세요"
              action={canEdit ? { label: '작성하기', onClick: () => setEditingNote(true), startIcon: <PrepEditIcon sx={{ fontSize: 16 }} /> } : undefined}
            />
          )}
        </SectionCard>

        {/* ─── 현장 보고 ─── */}
        <SectionCard title="현장 보고" icon={ReportIcon}>
          <FieldReportSection
            eventId={event.id}
            eventName={event.name}
            revenueData={{
              testRevenue: revenue.test,
              bookRevenue: revenue.book,
              totalRevenue: revenue.total,
              testShipping: revenue.testShipping,
              bookShipping: revenue.bookShipping,
            }}
            canEdit={canEdit}
          />
        </SectionCard>

        {/* ─── 매출 요약 (지결 완료 시에만) ─── */}
        <SectionCard
          title="매출 요약"
          icon={ReceiptIcon}
          subtitle={progress.paymentResolution ? '결제 완료 주문 기준 · 배송비 포함' : undefined}
        >
          {!progress.paymentResolution ? (
            <Box
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                px: 2, py: 2,
                borderRadius: `${theme.radii.md}px`,
                bgcolor: theme.gray[50],
                border: `1px solid ${theme.gray[200]}`,
              }}
            >
              <LockIcon sx={{ fontSize: 20, color: 'text.disabled', flexShrink: 0 }} />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  지결 완료 후 매출이 표시됩니다
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
                  진행 상태에서 ‘지결’을 완료로 표시하면 이 학회의 검사·도서 매출이 집계됩니다
                </Typography>
              </Box>
            </Box>
          ) : hasRevenue ? (
            <Box>
              <Box sx={{ mb: 3, pb: 3, borderBottom: `1px solid ${theme.gray[100]}` }}>
                <StatCard
                  variant="hero"
                  label="총 매출액"
                  value={won(revenue.total)}
                  unit="원"
                  icon={ReceiptIcon}
                  color={theme.accent.revenue}
                />
              </Box>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 3 } }}>
                <StatCard
                  label={`검사 판매 (배송비 ${won(revenue.testShipping)}원 포함)`}
                  value={won(revenue.test)}
                  unit="원"
                  icon={TestIcon}
                  color={theme.accent.tests}
                />
                <StatCard
                  label={`도서 판매 (배송비 ${won(revenue.bookShipping)}원 포함)`}
                  value={won(revenue.book)}
                  unit="원"
                  icon={BookIcon}
                  color={theme.accent.books}
                />
              </Box>
            </Box>
          ) : (
            <EmptyState
              icon={ReceiptIcon}
              title="아직 매출이 없어요"
              description="결제 완료된 주문이 생기면 여기에 검사·도서 매출이 표시됩니다"
            />
          )}
        </SectionCard>
      </Box>

      {/* 지불증 모달 */}
      <PaymentReceiptModal
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        event={event}
        staff={staff}
      />

      {/* 이미지 라이트박스 */}
      <Dialog
        open={Boolean(lightboxSrc)}
        onClose={() => setLightboxSrc(null)}
        maxWidth={false}
        slotProps={{ paper: { sx: { bgcolor: 'transparent', boxShadow: 'none', m: 2 } } }}
      >
        <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <IconButton
            onClick={() => setLightboxSrc(null)}
            aria-label="닫기"
            sx={{ position: 'absolute', top: 8, right: 8, color: '#fff', bgcolor: alpha('#000', 0.4), '&:hover': { bgcolor: alpha('#000', 0.6) } }}
          >
            <CloseIcon />
          </IconButton>
          {lightboxSrc && (
            <Box
              component="img"
              src={lightboxSrc}
              alt="학회 자료 확대"
              onClick={() => setLightboxSrc(null)}
              sx={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 1, cursor: 'zoom-out', display: 'block' }}
            />
          )}
        </Box>
      </Dialog>
    </Box>
  );
};

export default EventDetailPage;
