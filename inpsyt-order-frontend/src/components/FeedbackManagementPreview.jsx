import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, IconButton, Snackbar, useTheme,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  RateReview as RateReviewIcon,
  Close as CloseIcon,
  BugReport as BugIcon,
  Lightbulb as LightbulbIcon,
  Tune as TuneIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { PageHeader, SectionCard, StatCard, ActionSlot, EmptyState, InfoRow } from './ui';
import PreviewShell from './preview/PreviewShell';

/**
 * DEV-ONLY keystone: /preview/feedback.
 * 어드민 피드백 관리 디자인 시안 — 실 FeedbackManagementPage.jsx 사양 1:1 반영.
 * 사양 시트: design-system/specs/A7_FeedbackManagementPage.md
 *
 * 핵심 발견 반영(사양 시트 §핵심 발견):
 *  1. 상태 6종이 상수에 박힘 — 라벨·색·정렬 상수
 *  2. 제출 내용(content)은 readOnly. 시안에서도 readOnly 표시
 *  3. 권한 체크 없음(hasPermission 호출 0) — 라우팅 가드 의존
 *  4. 제출자 3단계 fallback (_userName || user_name || user_email || '-')
 *  5. 위젯·제출 측 사양 시트 없음 — 본 시안은 "관리" 화면만
 *  6. feedback:view 매트릭스 vs RLS master-only 불일치
 */

// 사양 §상태 필터 칩 line 33-39: 6상태 + 색 매핑
const STATUS_META = {
  received:     { label: '접수',      color: 'default' },
  acknowledged: { label: '작업예정',  color: 'info' },
  in_progress:  { label: '작업중',    color: 'primary' },
  completed:    { label: '작업완료',  color: 'success' },
  deferred:     { label: '보류',      color: 'warning' },
  cancelled:    { label: '접수취소',  color: 'error' },
};
const ALL_STATUSES = ['received', 'acknowledged', 'in_progress', 'completed', 'deferred', 'cancelled'];

const TYPE_META = {
  bug:        { label: '버그',     icon: BugIcon },
  ux:         { label: 'UX 개선',  icon: TuneIcon },
  suggestion: { label: '제안',     icon: LightbulbIcon },
};
const ALL_TYPES = ['bug', 'ux', 'suggestion'];

const MOCK_FEEDBACK = [
  { id: 'f-001', user_id: 'u-003', user_name: '박지훈', user_email: 'parkjh@inpsyt.co.kr', location: '/admin/orders',      type: 'bug',        content: '주문 일괄 상태 변경 후 페이지가 새로고침되지 않음',          status: 'received',    admin_note: '',                                      created_at: '2026-05-28T08:14:00' },
  { id: 'f-002', user_id: 'u-004', user_name: '최서연', user_email: 'choisy@inpsyt.co.kr', location: '/admin/fulfillment', type: 'ux',         content: '출고 그룹 카드에서 도로명·상세주소를 한 번에 복사하는 버튼이 필요합니다.', status: 'in_progress', admin_note: '다음 패치에 반영 예정. UI 검토 중.',     created_at: '2026-05-27T17:42:00' },
  { id: 'f-003', user_id: 'u-006', user_name: '강민호', user_email: 'kangmh@inpsyt.co.kr', location: '/admin/fulfillment', type: 'bug',        content: '엑셀 다운로드 시 일부 행의 상품명이 잘림',                       status: 'completed',   admin_note: '컬럼 폭 자동 조정 적용 (v2.4.1).',       created_at: '2026-05-25T11:20:00' },
  { id: 'f-004', user_id: 'u-008', user_name: '한지훈', user_email: 'hanjh@inpsyt.co.kr',  location: '/admin/products',    type: 'suggestion', content: '재고 임계치 알림이 있으면 좋겠습니다.',                          status: 'deferred',    admin_note: '재고 모듈은 다음 분기에 검토.',          created_at: '2026-05-22T14:30:00' },
  { id: 'f-005', user_id: 'u-005', user_name: '정다은', user_email: 'jeongde@inpsyt.co.kr', location: '/admin/dashboard',  type: 'ux',         content: '대시보드 상단 KPI 카드 4개가 모바일에서 너무 작아요.',           status: 'acknowledged',admin_note: '',                                      created_at: '2026-05-20T09:00:00' },
  { id: 'f-006', user_id: 'u-003', user_name: '박지훈', user_email: 'parkjh@inpsyt.co.kr', location: '/admin/orders',      type: 'bug',        content: '카테고리 필터 토글 후 검색어가 초기화됨',                        status: 'cancelled',   admin_note: '재현 불가. 추가 정보 받으면 재오픈.',    created_at: '2026-05-18T16:45:00' },
  { id: 'f-007', user_id: 'u-007', user_name: '윤지우', user_email: 'yoonjw@inpsyt.co.kr', location: '/admin/fulfillment', type: 'suggestion', content: '복사 단축 버튼에 단축키(F1~F4)를 할당해 주세요.',                status: 'received',    admin_note: '',                                      created_at: '2026-05-15T10:00:00' },
  { id: 'f-008', user_id: 'u-004', user_name: '최서연', user_email: 'choisy@inpsyt.co.kr', location: '/admin/events',      type: 'ux',         content: '학회 편집 시 미리보기가 있었으면 좋겠어요.',                     status: 'in_progress', admin_note: '디자인 시안 작업 중.',                   created_at: '2026-05-12T13:15:00' },
  { id: 'f-009', user_id: 'u-006', user_name: '강민호', user_email: 'kangmh@inpsyt.co.kr', location: '/admin/orders',      type: 'bug',        content: '검색 결과 페이징 이동 시 선택 상태가 풀림',                      status: 'completed',   admin_note: '선택 상태 보존 적용.',                   created_at: '2026-05-10T11:30:00' },
  { id: 'f-010', user_id: null,    user_name: null,     user_email: 'unknown@inpsyt.co.kr', location: '/order',            type: 'suggestion', content: '고객 페이지에서 학회별 할인 코드를 보여주면 좋겠습니다.',         status: 'acknowledged',admin_note: '',                                      created_at: '2026-05-08T08:14:00' },
];

// 사양 §제출자 3단계 fallback
const resolveSubmitter = (fb) => fb.user_name || fb.user_email || '-';

const formatDateTime = (iso) => {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const truncate = (text, n) => (text.length > n ? `${text.slice(0, n)}…` : text);

// ─── 상태 칩 ───────────────────────────────────────────────────

const StatusChipFB = ({ status }) => {
  const theme = useTheme();
  const meta = STATUS_META[status];
  if (!meta) return null;
  const palette = (() => {
    if (meta.color === 'info')    return theme.palette.info.main;
    if (meta.color === 'primary') return theme.palette.primary.main;
    if (meta.color === 'success') return theme.palette.success.main;
    if (meta.color === 'warning') return theme.palette.warning.main;
    if (meta.color === 'error')   return theme.palette.error.main;
    return theme.gray[600];
  })();
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.5,
        borderRadius: `${theme.radii.sm}px`,
        bgcolor: alpha(palette, 0.1),
        border: `1px solid ${alpha(palette, 0.2)}`,
      }}
    >
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: palette }} />
      <Typography variant="caption" sx={{ color: palette, fontWeight: 700, lineHeight: 1 }}>
        {meta.label}
      </Typography>
    </Box>
  );
};

const TypeChipFB = ({ type }) => {
  const meta = TYPE_META[type];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <Chip
      icon={<Icon sx={{ fontSize: 14 }} />}
      label={meta.label}
      size="small"
      variant="outlined"
      sx={{ fontWeight: 600 }}
    />
  );
};

// ─── 상세 모달 ─────────────────────────────────────────────────

const FeedbackDetailDialog = ({ open, feedback, onClose, onSave }) => {
  const theme = useTheme();
  const [editStatus, setEditStatus] = useState(feedback?.status || 'received');
  const [editAdminNote, setEditAdminNote] = useState(feedback?.admin_note || '');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (feedback) {
      setEditStatus(feedback.status);
      setEditAdminNote(feedback.admin_note || '');
    }
  }, [feedback]);

  if (!feedback) return null;

  const handleSubmit = () => {
    setSaving(true);
    setTimeout(() => {
      onSave({ status: editStatus, admin_note: editAdminNote });
      setSaving(false);
      onClose();
    }, 400);
  };

  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx: { borderRadius: `${theme.radii.lg}px`, maxWidth: 560, width: '100%' } }}>
      <DialogTitle sx={{ pb: 1.5 }}>
        <Typography variant="h4" sx={{ letterSpacing: '-0.02em' }}>피드백 상세</Typography>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1.5 }}>
        {/* 메타 정보 — InfoRow 4행 (사양 §상세 모달) */}
        <Box>
          <InfoRow label="제출자" value={resolveSubmitter(feedback)} />
          <InfoRow label="위치" value={feedback.location || '-'} mono />
          <InfoRow
            label="유형"
            value={<TypeChipFB type={feedback.type} />}
          />
          <InfoRow
            label="생성일"
            value={`${formatDateTime(feedback.created_at)}:00`}
            mono
          />
        </Box>

        {/* 사양 §발견 2: 제출 내용 readOnly */}
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}>
            내용 (수정 불가)
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            value={feedback.content}
            InputProps={{ readOnly: true }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: theme.gray[50],
              },
            }}
          />
        </Box>

        {/* 상태 변경 */}
        <FormControl size="small" fullWidth>
          <InputLabel>상태</InputLabel>
          <Select value={editStatus} label="상태" onChange={(e) => setEditStatus(e.target.value)}>
            {ALL_STATUSES.map(s => (
              <MenuItem key={s} value={s}>{STATUS_META[s].label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 관리자 메모 */}
        <TextField
          fullWidth
          multiline
          rows={3}
          label="관리자 메모"
          placeholder="내부 메모를 남겨주세요."
          value={editAdminNote}
          onChange={(e) => setEditAdminNote(e.target.value)}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ minHeight: 40, color: 'text.secondary' }}>취소</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={saving}
          sx={{ minHeight: 40 }}
        >
          {saving ? '저장 중...' : '저장'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── 메인 ──────────────────────────────────────────────────────

const FeedbackManagementPreview = () => {
  const theme = useTheme();
  const [statusFilter, setStatusFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  // 상태별 카운트 (StatCard 6장)
  const counts = useMemo(() => {
    const result = {};
    ALL_STATUSES.forEach(s => {
      result[s] = MOCK_FEEDBACK.filter(f => f.status === s).length;
    });
    result.total = MOCK_FEEDBACK.length;
    return result;
  }, []);

  // 사양 §필터: 상태(서버측) AND 유형(클라이언트측)
  const filteredFeedback = useMemo(() => {
    let list = MOCK_FEEDBACK;
    if (statusFilter) list = list.filter(f => f.status === statusFilter);
    if (typeFilter) list = list.filter(f => f.type === typeFilter);
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      list = list.filter(
        f =>
          f.content.toLowerCase().includes(s) ||
          (f.user_name || '').toLowerCase().includes(s) ||
          (f.location || '').toLowerCase().includes(s),
      );
    }
    // created_at desc
    return [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [statusFilter, typeFilter, searchTerm]);

  const toast = (msg) => setSnackbar({ open: true, message: msg });

  // StatCard에 색 매핑
  const statusColor = (s) => {
    const meta = STATUS_META[s];
    if (meta?.color === 'info')    return theme.palette.info.main;
    if (meta?.color === 'primary') return theme.palette.primary.main;
    if (meta?.color === 'success') return theme.palette.success.main;
    if (meta?.color === 'warning') return theme.palette.warning.main;
    if (meta?.color === 'error')   return theme.palette.error.main;
    return theme.gray[600];
  };

  return (
    <PreviewShell activePath="/admin/feedback">
      <PageHeader
        title="피드백 관리"
        subtitle={`총 ${counts.total}건 · 접수 ${counts.received} · 작업중 ${counts.in_progress} · 완료 ${counts.completed}`}
        icon={RateReviewIcon}
      />

      {/* 상태별 StatCard 6장 — 클릭 시 statusFilter 토글 */}
      <SectionCard sx={{ mb: 3 }} padding={20}>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          {ALL_STATUSES.map(s => {
            const active = statusFilter === s;
            const color = statusColor(s);
            return (
              <Box
                key={s}
                onClick={() => setStatusFilter(prev => prev === s ? null : s)}
                sx={{
                  flex: '1 1 140px',
                  minWidth: 130,
                  cursor: 'pointer',
                  p: 1.25,
                  borderRadius: `${theme.radii.md}px`,
                  border: `1px solid ${active ? color : theme.gray[200]}`,
                  bgcolor: active ? alpha(color, 0.04) : 'background.paper',
                  transition: `all 0.15s ${theme.easing.toss}`,
                  '&:hover': { borderColor: alpha(color, 0.5) },
                }}
              >
                <StatCard label={STATUS_META[s].label} value={counts[s]} unit="건" color={color} />
              </Box>
            );
          })}
        </Box>
      </SectionCard>

      {/* 필터 — 유형(클라이언트) + 검색 */}
      <SectionCard sx={{ mb: 3 }} padding={20}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            <Chip
              label="전체 유형"
              size="small"
              variant={typeFilter === null ? 'filled' : 'outlined'}
              color={typeFilter === null ? 'secondary' : 'default'}
              onClick={() => setTypeFilter(null)}
              sx={{ fontWeight: typeFilter === null ? 700 : 500, cursor: 'pointer' }}
            />
            {ALL_TYPES.map(t => {
              const meta = TYPE_META[t];
              const Icon = meta.icon;
              const active = typeFilter === t;
              return (
                <Chip
                  key={t}
                  icon={<Icon sx={{ fontSize: 14 }} />}
                  label={meta.label}
                  size="small"
                  variant={active ? 'filled' : 'outlined'}
                  color={active ? 'secondary' : 'default'}
                  onClick={() => setTypeFilter(prev => prev === t ? null : t)}
                  sx={{ fontWeight: active ? 700 : 500, cursor: 'pointer' }}
                />
              );
            })}
          </Box>
          <TextField
            size="small"
            placeholder="내용·제출자·위치 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ fontSize: 18, color: 'text.disabled', mr: 0.75 }} />,
            }}
            sx={{ flex: '1 1 240px', minWidth: 240 }}
          />
          {(statusFilter || typeFilter) && (
            <Button
              size="small"
              variant="text"
              onClick={() => { setStatusFilter(null); setTypeFilter(null); }}
              sx={{ color: 'text.secondary' }}
            >
              필터 초기화
            </Button>
          )}
          <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto' }}>
            {filteredFeedback.length}건 표시
          </Typography>
        </Box>
      </SectionCard>

      {/* 피드백 표 */}
      <SectionCard padding={0}>
        {filteredFeedback.length === 0 ? (
          <EmptyState
            icon={RateReviewIcon}
            title="피드백이 없습니다."
            description="필터를 조정해 보세요."
          />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 140 }}>생성일</TableCell>
                  <TableCell sx={{ minWidth: 100 }}>제출자</TableCell>
                  <TableCell sx={{ minWidth: 140 }}>위치</TableCell>
                  <TableCell sx={{ minWidth: 100 }}>유형</TableCell>
                  <TableCell>내용</TableCell>
                  <TableCell sx={{ minWidth: 100 }}>상태</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredFeedback.map(fb => (
                  <TableRow
                    key={fb.id}
                    hover
                    onClick={() => setSelectedFeedback(fb)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1', whiteSpace: 'nowrap' }}>
                        {formatDateTime(fb.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: 'text.primary' }}>
                        {resolveSubmitter(fb)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        }}
                      >
                        {fb.location || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <TypeChipFB type={fb.type} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: 'text.primary' }}>
                        {truncate(fb.content, 50)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <StatusChipFB status={fb.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </SectionCard>

      <FeedbackDetailDialog
        open={Boolean(selectedFeedback)}
        feedback={selectedFeedback}
        onClose={() => setSelectedFeedback(null)}
        onSave={({ status, admin_note }) => {
          toast(`#${selectedFeedback?.id} → ${STATUS_META[status].label}${admin_note ? ' / 메모 저장' : ''} (mock)`);
        }}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message={snackbar.message}
        action={
          <IconButton size="small" color="inherit" onClick={() => setSnackbar({ open: false, message: '' })}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        }
      />
    </PreviewShell>
  );
};

export default FeedbackManagementPreview;
