import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Chip,
  useTheme,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Assignment as ReportIcon,
} from '@mui/icons-material';
import { supabase } from '../supabaseClient';
import { useFormDraft } from '../hooks/useFormDraft';
import { DraftBanner, DraftSavedHint } from './ui';

/**
 * 현장 보고서 섹션 — CRUD 전체 보존.
 * 대시보드(DashboardPage Row4)와 L2 학회 상세(EventDetailPage)에서 공용.
 * DashboardPage에서 추출(2026-06-08) — 양쪽 import, 회귀 없도록 동일 동작 유지.
 *
 * 1차 plain text. 2차 리치 텍스트·이미지는 통합 준비 노트(prep_note) 쪽에서 다룸.
 *
 * props:
 *  - eventId: string | null  (null/'all' → 빈 안내)
 *  - eventName: string       (보고서 템플릿 머리말)
 *  - revenueData: { testRevenue, bookRevenue, totalRevenue, testShipping, bookShipping }
 *      (템플릿 자동 채움 — 없으면 0)
 *  - canEdit: boolean        (작성·수정·삭제 노출. 기본 true — 대시보드 정합)
 */
const FieldReportSection = ({ eventId, eventName, revenueData, canEdit = true }) => {
  const theme = useTheme();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editDayNumber, setEditDayNumber] = useState(1);
  const [editAuthor, setEditAuthor] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // 임시저장 — 신규 작성(editingId 없음)만 대상. 키 = fieldReport:{userId}:{eventId}.
  // 기존 보고서 수정분은 DB에 원본이 있어 제외(유령 복구 방지).
  const isNewDraft = !editingId;
  const validEventId = eventId && eventId !== 'all' ? eventId : null;
  const { draft, hasDraft, savedLabel, saveDraft, clearDraft } = useFormDraft(
    'fieldReport',
    validEventId,
    { enabled: canEdit && !!validEventId },
  );
  // 신규 작성 중 입력 변경 → 자동저장(빈 폼은 저장 안 함).
  useEffect(() => {
    if (!isEditing || !isNewDraft) return;
    if (!editContent.trim() && !editAuthor.trim()) return;
    saveDraft({ content: editContent, dayNumber: editDayNumber, author: editAuthor });
  }, [isEditing, isNewDraft, editContent, editDayNumber, editAuthor, saveDraft]);

  const fetchReports = useCallback(async () => {
    if (!eventId || eventId === 'all') {
      setReports([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('field_reports')
        .select('*')
        .eq('event_id', eventId)
        .order('day_number', { ascending: true })
        .order('created_at', { ascending: false });
      if (!error) setReports(data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [eventId]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const handleSave = async () => {
    if (!editContent.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await supabase.from('field_reports').update({
          content: editContent,
          day_number: editDayNumber,
          author_name: editAuthor,
          updated_at: new Date().toISOString(),
        }).eq('id', editingId);
      } else {
        await supabase.from('field_reports').insert({
          event_id: eventId,
          content: editContent,
          day_number: editDayNumber,
          author_name: editAuthor,
        });
        clearDraft(); // 신규 작성 저장 성공 → 임시저장 즉시 소거(유령 복구 방지)
      }
      setIsEditing(false); setEditingId(null); fetchReports();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleEdit = (report) => {
    setEditingId(report.id);
    setEditContent(report.content);
    setEditDayNumber(report.day_number || 1);
    setEditAuthor(report.author_name || '');
    setIsEditing(true);
  };

  const handleDelete = (id) => { setDeleteTarget(id); };

  const handleDeleteConfirm = async () => {
    await supabase.from('field_reports').delete().eq('id', deleteTarget);
    setDeleteTarget(null);
    fetchReports();
  };

  const handleNew = () => {
    setEditingId(null);
    const testRev = (revenueData?.testRevenue || 0).toLocaleString();
    const bookRev = (revenueData?.bookRevenue || 0).toLocaleString();
    const totalRev = (revenueData?.totalRevenue || 0).toLocaleString();
    const testShip = (revenueData?.testShipping || 0).toLocaleString();
    const bookShip = (revenueData?.bookShipping || 0).toLocaleString();
    setEditContent(
      `${eventName || '전체'} 현장마케팅 보고드립니다.\n\n0. 판매\n검사 판매: ${testRev}원 (배송비 ${testShip}원 포함)\n도서 판매: ${bookRev}원 (배송비 ${bookShip}원 포함)\n합계: ${totalRev}원\n\n1. 도서 관련\n\n2. 검사 관련\n\n이상 현장마케팅 마무리하겠습니다.`
    );
    setEditDayNumber(1);
    setEditAuthor('');
    setIsEditing(true);
  };

  // 복구 배너 — 이어쓰기: draft 주입 후 편집영역 열기 / 새로쓰기: draft 삭제(배너만 사라짐)
  const handleResumeDraft = () => {
    setEditingId(null);
    setEditContent(draft?.content || '');
    setEditDayNumber(draft?.dayNumber || 1);
    setEditAuthor(draft?.author || '');
    setIsEditing(true);
  };

  // 행사 미선택 빈 상태 — 시안 안내문 패턴
  if (!eventId || eventId === 'all') {
    return (
      <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
        <ReportIcon sx={{ fontSize: 40, color: theme.gray[300], mb: 1 }} />
        <Typography variant="body2">특정 행사를 선택하면 보고서를 작성할 수 있습니다</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {!isEditing && canEdit && hasDraft && (
        <DraftBanner
          savedLabel={savedLabel}
          onResume={handleResumeDraft}
          onDiscard={clearDraft}
        />
      )}

      {!isEditing && canEdit && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            size="small"
            startIcon={<AddIcon sx={{ fontSize: 16 }} />}
            onClick={handleNew}
            variant="outlined"
          >
            보고서 작성
          </Button>
        </Box>
      )}

      {isEditing && (
        <Box
          sx={{
            mb: 2, p: 2,
            bgcolor: theme.gray[50],
            borderRadius: `${theme.radii.md}px`,
            border: `1px solid ${theme.gray[200]}`,
          }}
        >
          <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
            <FormControl size="small" sx={{ width: 100 }}>
              <InputLabel>일차</InputLabel>
              <Select value={editDayNumber} label="일차" onChange={e => setEditDayNumber(e.target.value)}>
                {[1, 2, 3, 4, 5].map(d => <MenuItem key={d} value={d}>{d}일차</MenuItem>)}
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="작성자"
              value={editAuthor}
              onChange={e => setEditAuthor(e.target.value)}
              sx={{ width: 140 }}
            />
          </Box>
          <TextField
            fullWidth multiline minRows={5} maxRows={15}
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            sx={{ mb: 1.5 }}
          />
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
            {isNewDraft && <DraftSavedHint savedLabel={savedLabel} sx={{ mr: 'auto' }} />}
            <Button size="small" onClick={() => setIsEditing(false)}>취소</Button>
            <Button
              size="small"
              variant="contained"
              onClick={handleSave}
              disabled={saving || !editContent.trim()}
            >
              {saving ? '저장중...' : '저장'}
            </Button>
          </Box>
        </Box>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={20} />
        </Box>
      ) : reports.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
          생성된 보고서가 없습니다
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {reports.map((report) => (
            <Box
              key={report.id}
              sx={{
                p: 2,
                bgcolor: theme.gray[50],
                borderRadius: `${theme.radii.md}px`,
                border: `1px solid ${theme.gray[200]}`,
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip label={`${report.day_number || 1}일차`} size="small" sx={{ fontWeight: 700 }} />
                  {report.author_name && (
                    <Typography variant="caption" color="text.secondary">
                      {report.author_name}
                    </Typography>
                  )}
                </Box>
                {canEdit && (
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton size="small" onClick={() => handleEdit(report)} aria-label="편집">
                      <EditIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(report.id)} aria-label="삭제">
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                )}
              </Box>
              <Typography
                variant="body2"
                sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
              >
                {report.content}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs">
        <DialogTitle>보고서 삭제</DialogTitle>
        <DialogContent>
          <Typography variant="body2">이 보고서를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteTarget(null)}>취소</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">삭제</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FieldReportSection;
