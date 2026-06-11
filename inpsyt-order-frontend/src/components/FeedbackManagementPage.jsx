import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, TextField, FormControl, InputLabel, Select,
  MenuItem, CircularProgress, alpha, useTheme,
} from '@mui/material';
import RateReviewIcon from '@mui/icons-material/RateReview';
import SearchIcon from '@mui/icons-material/Search';
import BugReportIcon from '@mui/icons-material/BugReport';
import TuneIcon from '@mui/icons-material/Tune';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getFeedback, updateFeedbackStatus } from '../api/feedback';
import { useNotification } from '../hooks/useNotification';
import TableSkeleton from './TableSkeleton';
import { PageHeader, SectionCard, StatCard, EmptyState, InfoRow } from './ui';

// 사양 §유형 필터 칩 line 24-29: 3종 매핑.
const TYPE_META = {
  bug:        { label: '버그',    icon: BugReportIcon },
  ux:         { label: 'UX 개선', icon: TuneIcon },
  suggestion: { label: '제안',    icon: LightbulbIcon },
};
const ALL_TYPES = ['bug', 'ux', 'suggestion'];

// 사양 §상태 필터 칩 line 33-39: 6상태 + 색 매핑. 코드 상단 상수 (사양 §핵심 발견 1).
const STATUS_META = {
  received:     { label: '접수',     colorKey: 'default' },
  acknowledged: { label: '작업예정', colorKey: 'info' },
  in_progress:  { label: '작업중',   colorKey: 'primary' },
  completed:    { label: '작업완료', colorKey: 'success' },
  deferred:     { label: '보류',     colorKey: 'warning' },
  cancelled:    { label: '접수취소', colorKey: 'error' },
};
const ALL_STATUSES = Object.keys(STATUS_META);

// 사양 §제출자 3단계 fallback.
const resolveSubmitter = (fb) =>
  fb._userName || fb.user_name || fb.user_email || '-';

const truncate = (text, maxLen = 50) => {
  if (!text) return '';
  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
};

// ─── 상태 칩 — 시안 StatusChipFB 답습 ────────────────────────────
const StatusChipFB = ({ status }) => {
  const theme = useTheme();
  const meta = STATUS_META[status];
  if (!meta) return null;
  const palette = (() => {
    if (meta.colorKey === 'info')    return theme.palette.info.main;
    if (meta.colorKey === 'primary') return theme.palette.primary.main;
    if (meta.colorKey === 'success') return theme.palette.success.main;
    if (meta.colorKey === 'warning') return theme.palette.warning.main;
    if (meta.colorKey === 'error')   return theme.palette.error.main;
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

// ─── 유형 칩 — 시안 TypeChipFB 답습 ──────────────────────────────
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

const FeedbackManagementPage = () => {
  const theme = useTheme();
  const { addNotification } = useNotification();

  const [feedbackList, setFeedbackList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Detail dialog state
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [editAdminNote, setEditAdminNote] = useState('');
  const [saving, setSaving] = useState(false);

  // 전체 피드백을 한 번만 조회. 상태·유형·검색 필터는 모두 클라이언트 처리
  // (소량 데이터 + StatCard 카운트가 항상 '전체 기준'이어야 함 — 2026-06-01 건우님).
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFeedback({});
      setFeedbackList(data);
    } catch (err) {
      addNotification(`피드백 조회 실패: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRowClick = (fb) => {
    setSelectedFeedback(fb);
    setEditStatus(fb.status);
    setEditAdminNote(fb.admin_note || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedFeedback) return;
    setSaving(true);
    try {
      await updateFeedbackStatus(selectedFeedback.id, editStatus, editAdminNote);
      addNotification('피드백이 업데이트되었습니다.', 'success');
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      addNotification(`업데이트 실패: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedFeedback(null);
  };

  // 상태·유형·검색 모두 클라이언트 필터(전체 로드 기준).
  const displayedFeedback = useMemo(() => {
    let list = feedbackList;
    if (statusFilter) list = list.filter((fb) => fb.status === statusFilter);
    if (typeFilter) list = list.filter((fb) => fb.type === typeFilter);
    if (searchTerm.trim()) {
      const s = searchTerm.trim().toLowerCase();
      list = list.filter((fb) =>
        (fb.content || '').toLowerCase().includes(s)
        || (resolveSubmitter(fb) || '').toLowerCase().includes(s)
        || (fb.location || '').toLowerCase().includes(s),
      );
    }
    return list;
  }, [feedbackList, statusFilter, typeFilter, searchTerm]);

  // 상태별 카운트 — StatCard 6장. 전체 로드 데이터 기준이라 상태 필터와 무관하게 항상 정확
  // (2026-06-01 건우님 — 필터 켜면 다른 상태가 0으로 보이던 문제 해소).
  const statusCounts = useMemo(() => {
    const result = {};
    ALL_STATUSES.forEach((s) => {
      result[s] = feedbackList.filter((fb) => fb.status === s).length;
    });
    return result;
  }, [feedbackList]);

  const totalShown = displayedFeedback.length;
  const totalLoaded = feedbackList.length;

  // 상태별 색 (StatCard color prop)
  const statusColor = (status) => {
    const meta = STATUS_META[status];
    if (!meta) return theme.gray[600];
    if (meta.colorKey === 'info')    return theme.palette.info.main;
    if (meta.colorKey === 'primary') return theme.palette.primary.main;
    if (meta.colorKey === 'success') return theme.palette.success.main;
    if (meta.colorKey === 'warning') return theme.palette.warning.main;
    if (meta.colorKey === 'error')   return theme.palette.error.main;
    return theme.gray[600];
  };

  // 헤더 subtitle — 진입 시 statusFilter=null이므로 전체 통계 압축본.
  const headerSubtitle = statusFilter
    ? `${STATUS_META[statusFilter]?.label || statusFilter} 필터 · ${totalShown}건 표시`
    : `총 ${totalLoaded}건 · 접수 ${statusCounts.received || 0} · 작업중 ${statusCounts.in_progress || 0} · 완료 ${statusCounts.completed || 0}`;

  return (
    <Box>
      <PageHeader
        title="피드백 관리"
        subtitle={headerSubtitle}
        icon={RateReviewIcon}
      />

      {/* 상태별 StatCard 6장 — 클릭 시 statusFilter 토글 (서버측 재조회) */}
      <SectionCard sx={{ mb: 3 }} padding={20}>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          {ALL_STATUSES.map((s) => {
            const active = statusFilter === s;
            const color = statusColor(s);
            return (
              <Box
                key={s}
                onClick={() => setStatusFilter((prev) => (prev === s ? null : s))}
                sx={{
                  flex: '1 1 140px',
                  minWidth: 130,
                  cursor: 'pointer',
                  p: 1.5,
                  borderRadius: `${theme.radii.md}px`,
                  border: `1px solid ${active ? alpha(color, 0.55) : theme.gray[200]}`,
                  bgcolor: active ? alpha(color, 0.04) : 'background.paper',
                  transition: `all 0.15s ${theme.easing.toss}`,
                  '&:hover': { borderColor: alpha(color, 0.5) },
                }}
              >
                <StatCard
                  label={STATUS_META[s].label}
                  value={statusCounts[s] || 0}
                  unit="건"
                  color={color}
                />
              </Box>
            );
          })}
        </Box>
      </SectionCard>

      {/* 필터 — 유형 칩 + 검색 + 초기화 */}
      <SectionCard sx={{ mb: 3 }} padding={20}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label="전체 유형"
              size="small"
              variant={typeFilter === null ? 'filled' : 'outlined'}
              color={typeFilter === null ? 'secondary' : 'default'}
              onClick={() => setTypeFilter(null)}
              sx={{ fontWeight: typeFilter === null ? 700 : 500, cursor: 'pointer' }}
            />
            {ALL_TYPES.map((t) => {
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
                  onClick={() => setTypeFilter((prev) => (prev === t ? null : t))}
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
          {(statusFilter || typeFilter || searchTerm.trim()) && (
            <Button
              size="small"
              variant="text"
              onClick={() => {
                setStatusFilter(null);
                setTypeFilter(null);
                setSearchTerm('');
              }}
              sx={{ color: 'text.secondary' }}
            >
              필터 초기화
            </Button>
          )}
          <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto' }}>
            {totalShown}건 표시
          </Typography>
        </Box>
      </SectionCard>

      {/* 피드백 표 */}
      <SectionCard padding={0}>
        {loading ? (
          <TableSkeleton columns={6} rows={5} />
        ) : displayedFeedback.length === 0 ? (
          <EmptyState
            icon={RateReviewIcon}
            title="피드백이 없습니다."
            description={(statusFilter || typeFilter || searchTerm.trim())
              ? '필터를 조정해 보세요.'
              : '아직 들어온 피드백이 없습니다.'}
          />
        ) : (
          <TableContainer>
            <Table>
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
                {displayedFeedback.map((fb) => (
                  <TableRow
                    key={fb.id}
                    hover
                    onClick={() => handleRowClick(fb)}
                    sx={{ cursor: 'pointer', '&:last-child td': { borderBottom: 0 } }}
                  >
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          fontFeatureSettings: '"tnum" 1',
                        }}
                      >
                        {format(new Date(fb.created_at), 'yyyy-MM-dd HH:mm', { locale: ko })}
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
                        sx={{ color: 'text.secondary' }}
                      >
                        {fb.location || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <TypeChipFB type={fb.type} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: 'text.primary' }}>
                        {truncate(fb.content)}
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

      {/* 상세 모달 — 사양 §상세 모달 (line 219-309) 1:1 답습 */}
      <Dialog
        open={dialogOpen}
        onClose={handleDialogClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: `${theme.radii.lg}px` } }}
      >
        <DialogTitle sx={{ pb: 1.5 }}>
          <Typography variant="h4" sx={{ letterSpacing: '-0.02em' }}>피드백 상세</Typography>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1.5 }}>
          {selectedFeedback && (
            <>
              {/* 메타 정보 — InfoRow 4행 */}
              <Box>
                <InfoRow label="제출자" value={resolveSubmitter(selectedFeedback)} />
                <InfoRow
                  label="위치"
                  value={selectedFeedback.location || '-'}
                  muted={!selectedFeedback.location}
                />
                <InfoRow
                  label="유형"
                  value={<TypeChipFB type={selectedFeedback.type} />}
                />
                <InfoRow
                  label="생성일"
                  value={format(new Date(selectedFeedback.created_at), 'yyyy-MM-dd HH:mm:ss', { locale: ko })}
                  mono
                />
              </Box>

              {/* 사양 §발견 2: content readOnly — 운영자가 원본 수정 못함 */}
              <Box>
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}
                >
                  내용 (수정 불가)
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  value={selectedFeedback.content}
                  InputProps={{ readOnly: true }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: theme.gray[50],
                    },
                  }}
                />
              </Box>

              {/* 상태 변경 */}
              <FormControl fullWidth size="small">
                <InputLabel>상태</InputLabel>
                <Select
                  value={editStatus}
                  label="상태"
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  {ALL_STATUSES.map((status) => (
                    <MenuItem key={status} value={status}>
                      {STATUS_META[status].label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* 관리자 메모 */}
              <TextField
                label="관리자 메모"
                multiline
                rows={3}
                fullWidth
                value={editAdminNote}
                onChange={(e) => setEditAdminNote(e.target.value)}
                placeholder="내부 메모를 남겨주세요."
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={handleDialogClose} disabled={saving} sx={{ color: 'text.secondary' }}>
            취소
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={14} /> : null}
          >
            {saving ? '저장 중...' : '저장'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FeedbackManagementPage;
