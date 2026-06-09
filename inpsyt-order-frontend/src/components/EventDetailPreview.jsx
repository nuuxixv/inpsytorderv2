import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Button, Chip, IconButton,
  TextField, Snackbar, useTheme,
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
  Add as AddIcon,
  Close as CloseIcon,
  LocalOffer as LocalOfferIcon,
  EditNote as EditNoteIcon,
  ImageOutlined as ImageIcon,
  Inventory2Outlined as PrepIcon,
  CollectionsOutlined as MaterialsIcon,
  LockOutlined as LockIcon,
} from '@mui/icons-material';
import { PageHeader, SectionCard, StatCard, StatusBadge, EmptyState } from './ui';
import { computeRevenueByCategory } from '../utils/revenueByCategory';
import PreviewShell from './preview/PreviewShell';

/**
 * DEV-ONLY keystone: /preview/event-detail.
 * L2 학회 통합 상세(EventDetailPage) 1차 시안 — "한 학회의 모든 것이 한 페이지에".
 * 정적 Preview (mock 데이터, 실 도메인 미연결). 눈으로 확인용.
 *
 * 사양: design-system/specs/L2_EventDetail.md
 *  - PageHeader(학회명+행사명 · 날짜(요일) · 상태배지 · 뒤로 / 우상단 수정·입금결의서·지불증)
 *  - 개요 카드(A10 §7-1 6필드: 장소·날짜(요일)·참석자 전체 펼침·비용·비고)
 *  - 진행상태 3칩(기안/신청/지결 — 독립 토글, events 3 boolean)
 *  - 준비물 체크리스트(events.prep_items jsonb — 체크박스·품목·수량·추가/삭제)
 *  - 학회 자료(2차 이미지 업로드 자리 — 1차 점선 플레이스홀더)
 *  - 현장 보고(FieldReportSection 임베드 — 1차 plain text, 2차 리치 에디터 자리만)
 *  - 매출 요약(지결 완료 시에만 노출 · computeRevenueByCategory, paid만 — 대시보드 hero 축약판)
 *  - 섹션 순서: 개요 → 진행상태 → 준비물 → 학회자료 → 현장보고 → 매출(정산 결과는 흐름의 끝)
 *
 * 톤·헬퍼·STAFF·AttendeeCell·DiscountChip = EventHubListPreview.jsx 정합.
 * 실 도메인 로직은 EventManagementPage.jsx / DashboardPage.jsx(FieldReportSection) 참고(코드 카피 X, 구조만 차용).
 */

// ─── Mock: 로그인 사용자(나) — EventHubListPreview 정합 ──────────
const ME = { id: 'u-me', name: '김현장', role: 'master' }; // 시연: master(진행상태 토글·삭제 노출)

// ─── Mock: 참석자 후보(user_profiles, onsite + master) ──────────
const STAFF = [
  { id: 'u-me',   name: '김현장', role: 'master' },
  { id: 'u-002',  name: '이부스', role: 'onsite' },
  { id: 'u-003',  name: '박운영', role: 'onsite' },
  { id: 'u-004',  name: '정마스터', role: 'master' },
  { id: 'u-005',  name: '최현장', role: 'onsite' },
];
const STAFF_MAP = Object.fromEntries(STAFF.map((s) => [s.id, s]));

const TODAY = '2026-06-08'; // MEMORY currentDate

// ─── Mock 학회(events 1행) — A10 톤 정합 ───────────────────────
// 채택 시안: 진행중·매출 있음·보고 2건 (메인 시연용)
const MOCK_EVENT = {
  id: 'ev-2026-fall-kpsy',
  hostSociety: '한국심리학회',
  season: '추계학술대회',
  name: '2026 한국심리학회 추계학술대회',
  startDate: '2026-06-07',
  endDate: '2026-06-09',
  venue: '부산 BEXCO 제1전시장',
  attendeeIds: ['u-me', 'u-002', 'u-004'],
  discountPercent: 15,
  urlSlug: 'kpsy-2026-fall',
  estimatedDeliveryDate: '2026-09-30',
  note: '부스 위치 A-12. 도서 위주 진열. 검사 샘플 2종 배치.',
  cost: 1200000,
  // 진행상태 3 boolean (독립 토글)
  draftDone: true,
  applicationDone: true,
  // 채택안 = 지결 완료 → 매출 요약 노출 시연. (지결 칩을 끄면 매출이 안내로 전환됨)
  paymentResolutionDone: true,
  // 준비물 체크리스트 (events.prep_items jsonb — [{id,label,qty,done}])
  prepItems: [
    { id: 'p1', label: 'MMPI-2 검사 샘플', qty: 2, done: true },
    { id: 'p2', label: '발달심리 신간 도서', qty: 10, done: true },
    { id: 'p3', label: '부스 배너·거치대', qty: 1, done: false },
    { id: 'p4', label: '카드 단말기', qty: 2, done: false },
    { id: 'p5', label: '명함·브로슈어', qty: 200, done: false },
  ],
};

// ─── Mock 미래 학회(매출 0·보고 0 빈상태 시연) ─────────────────
const MOCK_EVENT_FUTURE = {
  id: 'ev-2026-summer-kyc',
  hostSociety: '한국청소년상담학회',
  season: '세미나',
  name: '2026 한국청소년상담학회 세미나',
  startDate: '2026-07-04',
  endDate: '2026-07-05',
  venue: '서울 코엑스 그랜드볼룸',
  attendeeIds: ['u-me'],
  discountPercent: 10,
  urlSlug: 'kyc-2026-summer',
  estimatedDeliveryDate: '',
  note: '',
  cost: 0,
  draftDone: false,
  applicationDone: false,
  // 미래 학회 = 지결 미완 → 매출 숨김+안내 시연. 준비물도 빈 상태 시연.
  paymentResolutionDone: false,
  prepItems: [],
};

// ─── Mock orders (이 학회 주문 — computeRevenueByCategory 입력 형태) ──
// status·delivery_fee·order_items[{category, price_at_purchase, quantity}] 구조 정합.
const MOCK_ORDERS = [
  { status: 'paid', delivery_fee: 3000, order_items: [
    { category: '검사', price_at_purchase: 88000, quantity: 2 },
    { category: '검사도구', price_at_purchase: 35000, quantity: 1 },
  ]},
  { status: 'completed', delivery_fee: 3000, order_items: [
    { category: '검사', price_at_purchase: 120000, quantity: 1 },
  ]},
  { status: 'paid', delivery_fee: 6000, order_items: [
    { category: '도서', price_at_purchase: 18000, quantity: 3 },
    { category: '도서', price_at_purchase: 25000, quantity: 2 },
  ]},
  { status: 'paid', delivery_fee: 3000, order_items: [
    { category: '검사', price_at_purchase: 88000, quantity: 1 },
    { category: '도서', price_at_purchase: 22000, quantity: 1 }, // 혼합 → 배송비 검사로
  ]},
  // 아래 2건은 결제완료 아님 → 매출 제외 (paid만 합산 검증용)
  { status: 'pending', delivery_fee: 3000, order_items: [
    { category: '검사', price_at_purchase: 88000, quantity: 1 },
  ]},
  { status: 'cancelled', delivery_fee: 0, order_items: [
    { category: '도서', price_at_purchase: 18000, quantity: 1 },
  ]},
];

// ─── Mock 현장 보고(field_reports — plain text content) ─────────
const MOCK_REPORTS = [
  {
    id: 'fr-1',
    day_number: 1,
    author_name: '김현장',
    content:
      '한국심리학회 추계학술대회 현장마케팅 1일차 보고드립니다.\n\n0. 판매\n검사 판매: 326,000원 (배송비 6,000원 포함)\n도서 판매: 110,000원 (배송비 6,000원 포함)\n합계: 436,000원\n\n1. 도서 관련\n발달심리 신간 문의 다수. 오후에 진열 보강함.\n\n2. 검사 관련\nMMPI-2 샘플 관심 높음. 검사도구 1세트 추가 요청 있었음.\n\n이상 1일차 현장마케팅 마무리하겠습니다.',
  },
  {
    id: 'fr-2',
    day_number: 2,
    author_name: '정마스터',
    content:
      '2일차 보고드립니다.\n\n0. 판매\n오전 한산, 오후 점심 직후 집중. 부스 위치 A-12 노출 양호.\n\n1. 특이사항\n인접 부스 학지사와 진열 경계 조정 완료.',
  },
];

// ─── 헬퍼 (EventHubListPreview 정합) ───────────────────────────
const dot = (iso) => (iso ? iso.replaceAll('-', '.') : '');
const won = (n) => (n || 0).toLocaleString();

// 요일 (getDay 기반 — mock도 실제 요일로 계산). KST 고정 자정 파싱(off-by-one 방지).
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
const weekday = (iso) => (iso ? WEEKDAY_KO[new Date(`${iso}T00:00:00+09:00`).getDay()] : '');
// 단일일: 2026.06.07(토) / 기간: 2026.06.07(토) ~ 06.09(월)
//  - 기간 종료부는 같은 연도면 월·일만(YYYY 생략) — 헤더·개요 공통.
const dotDay = (iso) => (iso ? `${dot(iso)}(${weekday(iso)})` : '');
const formatRange = (start, end) => {
  if (!start) return '';
  if (!end || end === start) return dotDay(start);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const endStr = sameYear ? `${dot(end).slice(5)}(${weekday(end)})` : dotDay(end);
  return `${dotDay(start)} ~ ${endStr}`;
};

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
  return <StatusBadge value={STATE_TO_STATUS[st]} label={STATE_TO_LABEL[st]} size="md" />;
};

// 할인율 칩 (>0%, EventHubListPreview DiscountChip 정합)
const DiscountChip = ({ percent }) => {
  const theme = useTheme();
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

// 참석자 칩 — L2는 전체 펼침(A10 §7-1). 압축 없음. "나" 우선·accent.
const AttendeePillRow = ({ ids = [] }) => {
  const theme = useTheme();
  if (!ids.length) {
    return <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>;
  }
  // "나" 포함 시 첫 칸 우선
  const ordered = [...ids].sort((a, b) => (a === ME.id ? -1 : b === ME.id ? 1 : 0));
  return (
    <Box sx={{ display: 'flex', gap: 0.625, flexWrap: 'wrap' }}>
      {ordered.map((id, i) => {
        const accent = id === ME.id;
        const name = STAFF_MAP[id]?.name || '(삭제)';
        const isMaster = STAFF_MAP[id]?.role === 'master';
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

// ─── 개요 카드 한 줄(라벨 + 값) ─────────────────────────────────
// icon = 이미 인스턴스화된 아이콘 엘리먼트(<PlaceIcon ... />). 컴포넌트 destructure 대신 element 전달.
const OverviewRow = ({ icon, label, children, alignTop }) => {
  return (
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
};

const ROW_ICON_SX = { fontSize: 16, color: 'text.disabled', flexShrink: 0 };

// ─── 진행상태 토글 칩(기안/신청/지결) ───────────────────────────
// events 3 boolean(draft_done/application_done/payment_resolution_done) 독립 토글.
// 완료=채워진 brand 칩(체크) / 미완=빈 중립 칩. events:edit자만 토글.
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
        px: 1.5, minHeight: 44, // 터치 hit-area
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

// ─── 준비물 체크리스트 섹션 (events.prep_items jsonb) ───────────
// 학회에 가져갈 상품/물품. 행 = [체크박스 · 품목명 · 수량] + 항목 추가/삭제.
// 완료 체크 = 취소선 + 연한 처리. events:edit자만 편집. 빈상태 = "준비물을 추가하세요".
const PrepChecklistRow = ({ item, canEdit, onToggle, onRemove }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        minHeight: 44,
        px: 1, py: 0.5,
        borderRadius: `${theme.radii.sm}px`,
        transition: `background-color 0.15s ${theme.easing.toss}`,
        '&:hover': canEdit ? { bgcolor: theme.gray[50] } : {},
      }}
    >
      {/* 체크박스 (44px hit-area) */}
      <Box
        role={canEdit ? 'checkbox' : undefined}
        aria-checked={item.done}
        tabIndex={canEdit ? 0 : undefined}
        onClick={canEdit ? onToggle : undefined}
        onKeyDown={canEdit ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } } : undefined}
        sx={{
          width: 44, height: 44, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: canEdit ? 'pointer' : 'default',
          borderRadius: `${theme.radii.sm}px`,
          '&:focus-visible': { outline: 'none', boxShadow: theme.customShadows.focus },
        }}
      >
        <Box
          sx={{
            width: 20, height: 20,
            borderRadius: `${theme.radii.xs}px`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: item.done ? 'primary.main' : 'transparent',
            border: item.done ? 'none' : `1.5px solid ${theme.gray[300]}`,
            transition: `all 0.15s ${theme.easing.toss}`,
          }}
        >
          {item.done && <CheckIcon sx={{ fontSize: 14, color: 'primary.contrastText' }} />}
        </Box>
      </Box>

      {/* 품목명 — 완료 시 취소선·연한 처리 */}
      <Typography
        variant="body2"
        sx={{
          flex: 1, minWidth: 0,
          fontWeight: 500,
          color: item.done ? 'text.disabled' : 'text.primary',
          textDecoration: item.done ? 'line-through' : 'none',
        }}
      >
        {item.label}
      </Typography>

      {/* 수량 */}
      <Typography
        variant="body2"
        sx={{
          flexShrink: 0,
          color: item.done ? 'text.disabled' : 'text.secondary',
          fontWeight: 600,
          fontFeatureSettings: '"tnum" 1',
          textDecoration: item.done ? 'line-through' : 'none',
        }}
      >
        {won(item.qty)}개
      </Typography>

      {/* 삭제 */}
      {canEdit && (
        <IconButton size="small" onClick={onRemove} aria-label={`${item.label} 삭제`} sx={{ flexShrink: 0, color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      )}
    </Box>
  );
};

const PrepChecklistSection = ({ items, canEdit, onToast }) => {
  const theme = useTheme();
  const [rows, setRows] = useState(items);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newQty, setNewQty] = useState('1');

  // showFuture 전환 시 동기화
  React.useEffect(() => { setRows(items); setAdding(false); setNewLabel(''); setNewQty('1'); }, [items]);

  const doneCount = rows.filter((r) => r.done).length;

  const toggle = (id) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, done: !r.done } : r)));
  const remove = (id) => setRows((rs) => rs.filter((r) => r.id !== id));
  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    const qty = Math.max(1, parseInt(newQty, 10) || 1);
    setRows((rs) => [...rs, { id: `p-${Date.now()}`, label, qty, done: false }]);
    setNewLabel(''); setNewQty('1'); setAdding(false);
    onToast('준비물 추가됨 (mock)');
  };

  return (
    <Box>
      {rows.length === 0 && !adding ? (
        <EmptyState
          icon={PrepIcon}
          title="준비물을 추가하세요"
          description="학회에 가져갈 상품·물품을 체크리스트로 관리합니다"
          action={canEdit ? { label: '항목 추가', onClick: () => setAdding(true), startIcon: <AddIcon sx={{ fontSize: 16 }} /> } : undefined}
        />
      ) : (
        <Box>
          {/* 진행 카운트 (가짜 통계 아님 — 실 데이터 파생) */}
          {rows.length > 0 && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 1, fontFeatureSettings: '"tnum" 1' }}>
              {doneCount} / {rows.length} 준비 완료
            </Typography>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            {rows.map((item) => (
              <PrepChecklistRow
                key={item.id}
                item={item}
                canEdit={canEdit}
                onToggle={() => toggle(item.id)}
                onRemove={() => remove(item.id)}
              />
            ))}
          </Box>

          {/* 인라인 추가 폼 */}
          {adding ? (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mt: 1.5, p: 1.5, bgcolor: theme.gray[50], borderRadius: `${theme.radii.md}px`, border: `1px solid ${theme.gray[200]}` }}>
              <TextField
                size="small" autoFocus placeholder="품목명 (예: 부스 배너)"
                value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
                sx={{ flex: 1 }}
              />
              <TextField
                size="small" type="number" placeholder="수량"
                value={newQty} onChange={(e) => setNewQty(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
                inputProps={{ min: 1, 'aria-label': '수량' }}
                sx={{ width: 96 }}
              />
              <Button size="small" variant="contained" onClick={add} sx={{ flexShrink: 0 }}>추가</Button>
              <Button size="small" onClick={() => { setAdding(false); setNewLabel(''); setNewQty('1'); }} sx={{ flexShrink: 0, color: 'text.secondary' }}>취소</Button>
            </Box>
          ) : (
            canEdit && (
              <Button
                size="small" variant="text" startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                onClick={() => setAdding(true)}
                sx={{ mt: 1, color: 'primary.main' }}
              >
                항목 추가
              </Button>
            )
          )}
        </Box>
      )}
    </Box>
  );
};

// ─── 학회 자료 섹션 (2차 이미지 업로드 자리 — 1차는 플레이스홀더만) ──
// 프로그램 일정표·부스 배치도 등 이미지. 현장보고 2차 안내와 동일 톤(점선 박스).
// 현장보고와 별개 섹션.
const MaterialsSectionPreview = () => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center',
        py: 5, px: 2,
        borderRadius: `${theme.radii.md}px`,
        bgcolor: theme.gray[50],
        border: `1px dashed ${theme.gray[300]}`,
      }}
    >
      <MaterialsIcon sx={{ fontSize: 40, color: theme.gray[400], mb: 1.5 }} />
      <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 0.5 }}>
        학회 자료 (2차 예정)
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.disabled', maxWidth: 320 }}>
        프로그램 일정표 · 부스 배치도 등을 이미지로 업로드하고, 클릭하면 확대해 보는 기능이 2차에 추가됩니다.
      </Typography>
    </Box>
  );
};

// ─── 현장 보고 섹션(임베드 — 1차 plain text) ────────────────────
// 실: DashboardPage FieldReportSection(:263) — CRUD 전체. 1차 시안은 read + 작성/수정 자리.
// 2차: 리치 에디터 + 이미지 업로드 (플레이스홀더 명시).
const FieldReportSectionPreview = ({ reports, eventName, onToast }) => {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  const handleNew = () => {
    setEditContent(
      `${eventName} 현장마케팅 보고드립니다.\n\n0. 판매\n검사 판매: 원\n도서 판매: 원\n합계: 원\n\n1. 도서 관련\n\n2. 검사 관련\n\n이상 현장마케팅 마무리하겠습니다.`
    );
    setIsEditing(true);
  };

  return (
    <Box>
      {/* 2차 에디터 예정 안내 — 1차는 자리만 명시(룰 E: 가짜 기능 아님, 명시적 주석) */}
      <Box
        sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          mb: 2, px: 1.5, py: 1,
          borderRadius: `${theme.radii.sm}px`,
          bgcolor: theme.gray[50],
          border: `1px dashed ${theme.gray[300]}`,
        }}
      >
        <ImageIcon sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0 }} />
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          2차: 리치 텍스트 에디터 · 이미지 업로드 예정 (현재는 일반 텍스트)
        </Typography>
      </Box>

      {!isEditing && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button size="small" variant="outlined" startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={handleNew}>
            보고서 작성
          </Button>
        </Box>
      )}

      {isEditing && (
        <Box sx={{ mb: 2, p: 2, bgcolor: theme.gray[50], borderRadius: `${theme.radii.md}px`, border: `1px solid ${theme.gray[200]}` }}>
          <TextField
            fullWidth multiline minRows={5} maxRows={15}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            sx={{ mb: 1.5 }}
          />
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button size="small" onClick={() => setIsEditing(false)}>취소</Button>
            <Button size="small" variant="contained" onClick={() => { setIsEditing(false); onToast('보고서 저장됨 (mock)'); }}>저장</Button>
          </Box>
        </Box>
      )}

      {reports.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
          생성된 보고서가 없습니다
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {reports.map((report) => (
            <Box
              key={report.id}
              sx={{ p: 2, bgcolor: theme.gray[50], borderRadius: `${theme.radii.md}px`, border: `1px solid ${theme.gray[200]}` }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip label={`${report.day_number || 1}일차`} size="small" sx={{ fontWeight: 700 }} />
                  {report.author_name && (
                    <Typography variant="caption" color="text.secondary">{report.author_name}</Typography>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton size="small" onClick={() => onToast('보고서 수정 (mock)')} aria-label="편집">
                    <EditIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  <IconButton size="small" onClick={() => onToast('보고서 삭제 (mock)')} aria-label="삭제">
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              </Box>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {report.content}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

// ─── 메인 ──────────────────────────────────────────────────────
const EventDetailPreview = () => {
  const theme = useTheme();

  // 시안 시연용: 토글로 채택안 ↔ 미래 학회(빈상태) 전환
  const [showFuture, setShowFuture] = useState(false);
  const baseEvent = showFuture ? MOCK_EVENT_FUTURE : MOCK_EVENT;
  const reports = showFuture ? [] : MOCK_REPORTS;

  // 권한 (실서비스 AuthContext) — events:edit 보유 시 토글·작성 가능.
  // (master 삭제 가드 등 추가 권한은 A10 다이얼로그·결의서 흐름에 귀속 — L2 1차 미노출)
  const canEdit = true;

  // 진행상태 로컬 상태(토글 시연)
  const [progress, setProgress] = useState({
    draft: baseEvent.draftDone,
    application: baseEvent.applicationDone,
    paymentResolution: baseEvent.paymentResolutionDone,
  });
  // showFuture 전환 시 진행상태 동기화
  React.useEffect(() => {
    setProgress({
      draft: baseEvent.draftDone,
      application: baseEvent.applicationDone,
      paymentResolution: baseEvent.paymentResolutionDone,
    });
  }, [baseEvent]);

  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const toast = (message) => setSnackbar({ open: true, message });

  // 매출 — computeRevenueByCategory (paid/completed만, 배송비 할당)
  const revenue = useMemo(
    () => computeRevenueByCategory(showFuture ? [] : MOCK_ORDERS),
    [showFuture]
  );
  const hasRevenue = revenue.total > 0;

  const event = baseEvent;

  // PageHeader 우상단 액션 — 수정 · 입금결의서 · 지불증
  const headerAction = (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      {canEdit && (
        <Button size="small" variant="outlined" startIcon={<EditIcon sx={{ fontSize: 16 }} />} onClick={() => toast('학회 정보 수정 (A10 다이얼로그, mock)')} sx={{ minHeight: 36 }}>
          학회 정보 수정
        </Button>
      )}
      <Button size="small" variant="outlined" startIcon={<DescriptionIcon sx={{ fontSize: 16 }} />} onClick={() => toast('입금결의서 내보내기 (mock)')} sx={{ minHeight: 36 }}>
        입금결의서
      </Button>
      <Button size="small" variant="outlined" startIcon={<ReceiptLongIcon sx={{ fontSize: 16 }} />} onClick={() => toast('지불증 내보내기 (PaymentReceiptModal, mock)')} sx={{ minHeight: 36 }}>
        지불증
      </Button>
    </Box>
  );

  return (
    <PreviewShell activePath="/admin/events">
      {/* 시연 전용 토글 — 채택안 ↔ 미래 학회(빈상태). 실서비스 없음. */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
        <Button size="small" variant="text" onClick={() => setShowFuture((v) => !v)} sx={{ minHeight: 32, color: 'text.disabled' }}>
          {showFuture ? '← 진행중 학회 보기' : '미래 학회(빈상태) 보기 →'}
        </Button>
      </Box>

      {/* ─── PageHeader: 학회명+행사명 · 날짜 · 상태배지 · 뒤로 / 우상단 액션 ─── */}
      <Box sx={{ mb: 1 }}>
        <Button
          size="small"
          variant="text"
          startIcon={<ArrowBackIcon sx={{ fontSize: 18 }} />}
          onClick={() => toast('학회 목록(L1)으로 (mock)')}
          sx={{ minHeight: 36, color: 'text.secondary', ml: -1 }}
        >
          학회 목록
        </Button>
      </Box>
      <PageHeader
        title={event.hostSociety}
        subtitle={
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>{event.season}</Box>
            <Box component="span" sx={{ color: 'text.disabled' }}>·</Box>
            <Box component="span" sx={{ fontFeatureSettings: '"tnum" 1' }}>
              {formatRange(event.startDate, event.endDate)}
            </Box>
          </Box>
        }
        icon={EventNoteIcon}
        action={headerAction}
      />
      {/* 상태배지 + 할인율 — 헤더 직하 (PageHeader subtitle은 텍스트만 받으므로 분리 배치) */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3, mt: -1 }}>
        <EventStateBadge start={event.startDate} end={event.endDate} />
        <DiscountChip percent={event.discountPercent} />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* ─── 1. 개요 카드 (A10 §7-1 6필드) ─── */}
        <SectionCard title="개요" icon={EventNoteIcon}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <OverviewRow icon={<PlaceIcon sx={ROW_ICON_SX} />} label="장소">
              <Typography variant="body2" sx={{ color: event.venue ? 'text.primary' : 'text.disabled', fontWeight: 500 }}>
                {event.venue || '—'}
              </Typography>
            </OverviewRow>
            <OverviewRow icon={<EventNoteIcon sx={ROW_ICON_SX} />} label="날짜">
              <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500, fontFeatureSettings: '"tnum" 1' }}>
                {formatRange(event.startDate, event.endDate)}
              </Typography>
            </OverviewRow>
            <OverviewRow icon={<PersonIcon sx={ROW_ICON_SX} />} label="참석자" alignTop>
              <AttendeePillRow ids={event.attendeeIds} />
            </OverviewRow>
            <OverviewRow icon={<CostIcon sx={ROW_ICON_SX} />} label="비용">
              <Typography variant="body2" sx={{ color: event.cost ? 'text.primary' : 'text.disabled', fontWeight: 600, fontFeatureSettings: '"tnum" 1' }}>
                {event.cost ? `${won(event.cost)}원` : '—'}
              </Typography>
            </OverviewRow>
            <OverviewRow icon={<NoteIcon sx={ROW_ICON_SX} />} label="비고" alignTop>
              <Typography variant="body2" sx={{ color: event.note ? 'text.primary' : 'text.disabled', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {event.note || '—'}
              </Typography>
            </OverviewRow>
          </Box>
        </SectionCard>

        {/* ─── 2. 진행상태 3칩 (기안/신청/지결 독립 토글) ─── */}
        <SectionCard title="진행 상태" icon={EditNoteIcon} subtitle={canEdit ? '칩을 눌러 완료 여부를 표시하세요 (독립 항목)' : undefined}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <ProgressChip label="기안" done={progress.draft} canEdit={canEdit} onToggle={() => setProgress((p) => ({ ...p, draft: !p.draft }))} />
            <ProgressChip label="신청" done={progress.application} canEdit={canEdit} onToggle={() => setProgress((p) => ({ ...p, application: !p.application }))} />
            <ProgressChip label="지결" done={progress.paymentResolution} canEdit={canEdit} onToggle={() => setProgress((p) => ({ ...p, paymentResolution: !p.paymentResolution }))} />
          </Box>
        </SectionCard>

        {/* ─── 3. 준비물 체크리스트 (events.prep_items jsonb) ─── */}
        <SectionCard title="준비물" icon={PrepIcon} subtitle="학회에 가져갈 상품·물품 체크리스트">
          <PrepChecklistSection items={event.prepItems || []} canEdit={canEdit} onToast={toast} />
        </SectionCard>

        {/* ─── 4. 학회 자료 (2차 이미지 업로드 자리) ─── */}
        <SectionCard title="학회 자료" icon={MaterialsIcon} subtitle="프로그램 일정표 · 부스 배치도 등">
          <MaterialsSectionPreview />
        </SectionCard>

        {/* ─── 5. 현장 보고 섹션 (FieldReportSection 임베드 — 1차 plain text) ─── */}
        <SectionCard title="현장 보고" icon={ReportIcon}>
          <FieldReportSectionPreview reports={reports} eventName={event.name} onToast={toast} />
        </SectionCard>

        {/* ─── 6. 매출 요약 (지결 완료 시에만 노출, paid만) ─── */}
        {/* 정산 결과는 흐름의 끝. 지결(payment_resolution_done) 완료 전엔 카드 숨김 + 안내. */}
        <SectionCard title="매출 요약" icon={ReceiptIcon} subtitle={progress.paymentResolution ? '결제 완료 주문 기준 · 배송비 포함' : undefined}>
          {!progress.paymentResolution ? (
            // 지결 미완료 — 매출 숨김 + 가벼운 안내(점선·과장 없음, 중립 박스)
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

export default EventDetailPreview;
