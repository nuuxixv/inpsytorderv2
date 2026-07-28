import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense, lazy } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Button, IconButton, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, useTheme,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
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
  Delete as DeleteIcon,
  ReceiptLong as ReceiptLongIcon,
  Description as DescriptionIcon,
  Check as CheckIcon,
  Receipt as ReceiptIcon,
  Psychology as TestIcon,
  MenuBook as BookIcon,
  Build as ToolIcon,
  Assignment as ReportIcon,
  LocalOffer as LocalOfferIcon,
  EditNote as EditNoteIcon,
  EditOutlined as PrepEditIcon,
  Close as CloseIcon,
  LockOutlined as LockIcon,
  Inventory2Outlined as PrepIcon,
  VisibilityOutlined as ViewsIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { supabase } from '../supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { getEventStatusKST } from '../utils/date';
import { numberToKoreanCurrency } from '../utils/koreanCurrency';
import { computeRevenueByCategory } from '../utils/revenueByCategory';
import { CATEGORY_COLORS } from '../constants/categoryColors';
import {
  getEventBySlug, updateEventProgress, updateEventPrepNote, getOrdersForEventRevenue,
  recordEventView, getEventViewers,
} from '../api/events';
import { fetchProductCountByCategory } from '../api/products';
import { applyAutofill, normalizeEventPayload, isRequiredComplete } from '../utils/eventForm';
import { useSlugCheck } from '../hooks/useSlugCheck';
import { encodeForStorage } from '../utils/prepNoteImages';
import { PageHeader, SectionCard, StatCard, StatusBadge, EmptyState, DraftBanner, DraftSavedHint } from './ui';
import { useFormDraft } from '../hooks/useFormDraft';
import FieldReportSection from './FieldReportSection';
import PaymentReceiptModal from './PaymentReceiptModal';
import EventAutofillFields from './EventAutofillFields';
import EventRequiredFields from './EventRequiredFields';
import EventOptionalFields from './EventOptionalFields';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile, hasPermission } = useAuth();
  const { addNotification } = useNotification();

  const canEdit = hasPermission('events:edit');
  const isMaster = hasPermission('master');
  const myId = user?.id || null;

  const [event, setEvent] = useState(null);
  const [staff, setStaff] = useState([]);
  const [societies, setSocieties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // 진행상태(낙관적 로컬 + DB 반영)
  const [progress, setProgress] = useState({ draft: false, application: false, paymentResolution: false });

  // 매출
  const [orders, setOrders] = useState([]);

  // 준비 노트
  const [editingNote, setEditingNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const getNoteHtmlRef = React.useRef(() => null); // 에디터 lazy 로드 전 = null(저장 가드)
  // 준비 노트 임시저장 — 키 = prepNote:{userId}:{eventId} (게시판 bulletin draft와 type 구분).
  // 에디터 진입 시점 주입값(prep_note 또는 이어쓰기한 draft). 에디터는 마운트 1회 생성 →
  // seed 교체 시 editorKey 증가로 강제 재마운트(빈↔빈 등 동일 내용 재마운트도 보장).
  const [noteSeed, setNoteSeed] = useState('');
  const [editorKey, setEditorKey] = useState(0);
  const noteDraft = useFormDraft('prepNote', event?.id, { enabled: canEdit && !!event?.id });

  // 라이트박스
  const [lightboxSrc, setLightboxSrc] = useState(null);

  // 학회 정보 수정 — 개요 SectionCard "읽기 요약 ↔ 편집 폼" 모드 스왑(2026-07-28, 모달 폐기)
  const [editingOverview, setEditingOverview] = useState(false);
  const [overviewForm, setOverviewForm] = useState(null);
  const [savingOverview, setSavingOverview] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [categoryCounts, setCategoryCounts] = useState(null); // 판매 대분류 실 집계 미리보기
  const overviewRef = useRef(null);
  const editParamHandledRef = useRef(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // 개요 편집 폼 slug 검사 — 자기 자신(event.id) 제외.
  const slugState = useSlugCheck(overviewForm?.order_url_slug || '', { excludeId: event?.id });

  // 열람 이력 — master만. null = 미조회/미적용 환경(섹션 숨김)
  const [views, setViews] = useState(null);
  const recordedIdRef = React.useRef(null);

  const staffMap = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s])), [staff]);

  const loadEvent = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const [ev, staffRes, societiesRes] = await Promise.all([
        getEventBySlug(slug),
        supabase
          .from('user_profiles')
          .select('id, name, role, position, department')
          .in('role', ['master', 'onsite'])
          .order('name', { ascending: true }),
        supabase.from('societies').select('id, name, slug_prefix').order('name', { ascending: true }),
      ]);
      if (!ev) { setNotFound(true); setEvent(null); return; }
      setEvent(ev);
      setProgress({
        draft: !!ev.draft_done,
        application: !!ev.application_done,
        paymentResolution: !!ev.payment_resolution_done,
      });
      if (!staffRes.error && staffRes.data) setStaff(staffRes.data);
      if (!societiesRes.error && societiesRes.data) setSocieties(societiesRes.data);

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

  // 열람 기록(진입 1회) + master 열람 이력 조회 — 테이블/RPC 미적용 환경이면 조용히 스킵
  const eventId = event?.id || null;
  useEffect(() => {
    if (!eventId || recordedIdRef.current === eventId) return;
    recordedIdRef.current = eventId;
    (async () => {
      try { await recordEventView(eventId); } catch { /* 미적용 환경 — 페이지 차단 금지 */ }
      if (!isMaster) return;
      try { setViews(await getEventViewers(eventId)); } catch { setViews(null); }
    })();
  }, [eventId, isMaster]);

  // L1 ⋯메뉴 "수정" 경유(?edit=1) — 진입 시 개요 편집 모드 자동 진입 + 스크롤, 이후 param 제거(새로고침 재진입 방지)
  useEffect(() => {
    if (editParamHandledRef.current || !event || !canEdit) return;
    if (searchParams.get('edit') !== '1') return;
    editParamHandledRef.current = true;
    setOverviewForm({ ...event });
    setEditingOverview(true);
    const next = new URLSearchParams(searchParams);
    next.delete('edit');
    setSearchParams(next, { replace: true });
    setTimeout(() => overviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }, [event, canEdit, searchParams, setSearchParams]);

  // 판매 대분류 미리보기 카운트 — 편집 모드 진입 시 1회(실 집계만).
  useEffect(() => {
    if (!editingOverview || categoryCounts) return undefined;
    let cancelled = false;
    fetchProductCountByCategory()
      .then((c) => { if (!cancelled) setCategoryCounts(c); })
      .catch(() => { if (!cancelled) setCategoryCounts({}); });
    return () => { cancelled = true; };
  }, [editingOverview, categoryCounts]);

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

  // ─── 개요 인라인 편집 ───────────────────────────────────
  const startEditOverview = () => {
    setOverviewForm({ ...event });
    setEditingOverview(true);
  };
  const cancelEditOverview = () => {
    setEditingOverview(false);
    setOverviewForm(null);
  };
  // 편집은 isEditing:true — slug 자동 재생성 차단(수동 편집 보존).
  const handleOverviewChange = (name, value) => {
    setOverviewForm((prev) => applyAutofill(prev, name, value, { societies, isEditing: true }));
  };
  const handleSocietyAdded = (newSociety) => {
    const nextSocieties = [...societies, newSociety].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    setSocieties(nextSocieties);
    setOverviewForm((prev) => applyAutofill(prev, 'host_society', newSociety.name, { societies: nextSocieties, isEditing: true }));
  };

  const canSaveOverview = isRequiredComplete(overviewForm) && slugState.isAvailable && !savingOverview;
  let saveDisableReason = '';
  if (editingOverview && !canSaveOverview && !savingOverview) {
    if (!overviewForm?.name) saveDisableReason = '행사명을 입력하세요.';
    else if (!overviewForm?.order_url_slug) saveDisableReason = '주문 URL을 입력하세요.';
    else if (slugState.formatBad) saveDisableReason = '주문 URL 형식을 확인하세요.';
    else if (slugState.reserved) saveDisableReason = "'new'는 사용할 수 없는 주소입니다.";
    else if (!overviewForm?.start_date || !overviewForm?.end_date) saveDisableReason = '행사 기간을 선택하세요.';
    else if (!overviewForm?.estimated_delivery_date) saveDisableReason = '배송 예정일을 선택하세요.';
    else if (slugState.isBusy) saveDisableReason = '주문 URL 중복 확인 중입니다.';
    else if (slugState.taken) saveDisableReason = '이미 사용중인 주문 URL입니다.';
    else if (slugState.error) saveDisableReason = '주문 URL 중복 검사에 실패했습니다. 다시 시도하세요.';
  }

  const handleSaveOverview = async () => {
    if (!canSaveOverview) return;
    setSavingOverview(true);
    const payload = normalizeEventPayload(overviewForm);
    const { error } = await supabase.from('events').update(payload).eq('id', event.id);
    if (error) {
      addNotification(`저장 실패: ${error.message}`, 'error');
      setSavingOverview(false);
      return;
    }
    addNotification('학회 정보를 저장했습니다.', 'success');
    const newSlug = overviewForm.order_url_slug;
    setEditingOverview(false);
    setOverviewForm(null);
    setSavingOverview(false);
    // slug 변경 시 새 주소로 이동(구 slug 재조회 시 미발견 방지), 아니면 재조회
    if (newSlug && newSlug !== slug) {
      navigate(`/admin/events/${newSlug}`, { replace: true });
    } else {
      loadEvent();
    }
  };

  // 삭제 — master 전부 / onsite 본인 생성만. 연결 주문 0건일 때만.
  const canDelete = isMaster || (canEdit && !!event.created_by && event.created_by === myId);
  const handleDeleteClick = async () => {
    const { count, error } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event.id);
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
    const { error } = await supabase.from('events').delete().eq('id', event.id);
    if (error) {
      addNotification(`삭제 실패: ${error.message}`, 'error');
      return;
    }
    addNotification('행사가 삭제되었습니다.', 'success');
    setDeleteConfirmOpen(false);
    navigate('/admin/events', { replace: true });
  };

  // 준비 노트 편집 진입 — draft 유무는 배너로 분기. 에디터는 현재 저장본(prep_note)으로 시작.
  const handleEditNote = () => {
    setNoteSeed(event.prep_note || '');
    setEditorKey((k) => k + 1);
    setEditingNote(true);
  };
  // 이어쓰기: draft 본문을 에디터 seed로 주입(에디터 재마운트). 배너만 닫음(draft는 보존).
  const handleResumeNote = () => {
    setNoteSeed(noteDraft.draft || '');
    setEditorKey((k) => k + 1);
    noteDraft.dismiss();
  };
  // 새로쓰기: draft 삭제 후 현재 저장본으로 에디터 재마운트.
  const handleDiscardNote = () => {
    noteDraft.clearDraft();
    setNoteSeed(event.prep_note || '');
    setEditorKey((k) => k + 1);
  };

  const handleSaveNote = async () => {
    if (!canEdit) return;
    const raw = getNoteHtmlRef.current();
    if (raw === null) return; // 에디터 준비 전(lazy 로드·이미지 재서명 중) — 본문 유실 방지
    setSavingNote(true);
    try {
      const html = encodeForStorage(raw); // 서명 URL → 경로 플레이스홀더(만료 무관 저장형)
      await updateEventPrepNote(event.id, html);
      setEvent((e) => ({ ...e, prep_note: html }));
      setEditingNote(false);
      noteDraft.clearDraft(); // 저장 성공 → 임시저장 즉시 소거(유령 복구 방지)
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
      {canEdit && !editingOverview && (
        <Button
          size="small" variant="outlined"
          startIcon={<EditIcon sx={{ fontSize: 16 }} />}
          onClick={startEditOverview}
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
        {/* ─── 개요 (읽기 요약 ↔ 편집 폼 모드 스왑) ─── */}
        <Box ref={overviewRef}>
          <SectionCard title="개요" icon={EventNoteIcon}>
            {editingOverview && overviewForm ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <EventAutofillFields
                  form={overviewForm}
                  onChange={handleOverviewChange}
                  societies={societies}
                  onSocietyAdded={handleSocietyAdded}
                />
                <EventRequiredFields
                  form={overviewForm}
                  onChange={handleOverviewChange}
                  slugState={slugState}
                  originalSlug={event.order_url_slug}
                />
                <EventOptionalFields
                  form={overviewForm}
                  onChange={handleOverviewChange}
                  staff={staff}
                  categoryCounts={categoryCounts}
                />

                {/* 편집 푸터 — [삭제(mr:auto)] [취소] [저장] */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {saveDisableReason && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'right' }}>
                      {saveDisableReason}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Box sx={{ mr: 'auto' }}>
                      {canDelete && (
                        <Button onClick={handleDeleteClick} color="error" startIcon={<DeleteIcon />} disabled={savingOverview}>
                          삭제
                        </Button>
                      )}
                    </Box>
                    <Button onClick={cancelEditOverview} disabled={savingOverview}>취소</Button>
                    <Button variant="contained" onClick={handleSaveOverview} disabled={!canSaveOverview}>
                      {savingOverview ? '저장중...' : '저장'}
                    </Button>
                  </Box>
                </Box>
              </Box>
            ) : (
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
            )}
          </SectionCard>
        </Box>

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
                onClick={handleEditNote}
                sx={{ minHeight: 36 }}
              >
                편집
              </Button>
            ) : undefined
          }
        >
          {editingNote ? (
            <Box>
              {noteDraft.hasDraft && (
                <DraftBanner
                  savedLabel={noteDraft.savedLabel}
                  onResume={handleResumeNote}
                  onDiscard={handleDiscardNote}
                />
              )}
              <Suspense fallback={<EditorFallback />}>
                <PrepNoteEditor
                  key={editorKey}
                  eventId={event.id}
                  initialValue={noteSeed}
                  onReady={(getHtml) => { getNoteHtmlRef.current = getHtml; }}
                  onChange={(html) => noteDraft.saveDraft(html)}
                  onImageError={(msg) => addNotification(msg, 'warning')}
                />
              </Suspense>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 2, flexWrap: 'wrap' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Markdown 탭에서 ## 제목 · - [ ] 체크리스트를 바로 입력할 수 있어요
                </Typography>
                <DraftSavedHint savedLabel={noteDraft.savedLabel} sx={{ ml: { sm: 'auto' } }} />
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
              action={canEdit ? { label: '작성하기', onClick: handleEditNote, startIcon: <PrepEditIcon sx={{ fontSize: 16 }} /> } : undefined}
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
              toolRevenue: revenue.tool,
              totalRevenue: revenue.total,
              testShipping: revenue.testShipping,
              bookShipping: revenue.bookShipping,
              toolShipping: revenue.toolShipping,
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
              {/* 검사/도서/도구 3버킷(도구 독립, 2026-06-24). 0원 버킷 숨김 → 1~3열 동적 분할. */}
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 3 } }}>
                {[
                  { key: 'test', label: '검사 판매', revenue: revenue.test, shipping: revenue.testShipping, icon: TestIcon, color: theme.accent.tests },
                  { key: 'book', label: '도서 판매', revenue: revenue.book, shipping: revenue.bookShipping, icon: BookIcon, color: theme.accent.books },
                  { key: 'tool', label: '도구 판매', revenue: revenue.tool, shipping: revenue.toolShipping, icon: ToolIcon, color: CATEGORY_COLORS.tool },
                ]
                  .filter(b => b.revenue > 0)
                  .map(b => (
                    <Box key={b.key} sx={{ flex: 1, minWidth: 0 }}>
                      <StatCard
                        label={`${b.label} (배송비 ${won(b.shipping)}원 포함)`}
                        value={won(b.revenue)}
                        unit="원"
                        icon={b.icon}
                        color={b.color}
                      />
                    </Box>
                  ))}
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

        {/* ─── 열람 이력 (master만 · 게시판 읽음 현황 패턴) ─── */}
        {isMaster && Array.isArray(views) && views.length > 0 && (
          <SectionCard title="열람 이력" icon={ViewsIcon} subtitle="이 학회 상세를 연 직원 · 마스터에게만 보여요">
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>이름</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>최초 열람</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>최근 열람</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>횟수</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {views.map((v) => (
                    <TableRow key={v.user_id}>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                          {v.name || '(삭제)'}
                          {v.position && (
                            <Typography component="span" variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, ml: 0.5 }}>
                              {v.position}
                            </Typography>
                          )}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1' }}>
                          {v.first_viewed_at ? format(new Date(v.first_viewed_at), 'MM.dd HH:mm') : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1' }}>
                          {v.last_viewed_at ? format(new Date(v.last_viewed_at), 'MM.dd HH:mm') : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontFeatureSettings: '"tnum" 1' }}>
                          {v.view_count || 0}회
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </SectionCard>
        )}
      </Box>

      {/* 삭제 확인 다이얼로그 — 개요 편집 푸터 삭제 버튼 경유(주문 0건 확인 후) */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>행사 삭제</DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{event.name}</strong> 행사를 삭제합니다.
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
