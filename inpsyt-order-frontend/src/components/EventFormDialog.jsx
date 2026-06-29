import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, TextField, Dialog, DialogActions, DialogContent, DialogTitle,
  Autocomplete, Chip, Checkbox, MenuItem, InputAdornment, ListItemText, Divider,
  alpha, useTheme,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  PlaceOutlined as PlaceIcon,
} from '@mui/icons-material';
import { supabase } from '../supabaseClient';
import { useNotification } from '../hooks/useNotification';
import { numberToKoreanCurrency } from '../utils/koreanCurrency';
import { fetchProductCountByCategory } from '../api/products';
import { DateField } from './ui';

/**
 * 학회 추가/수정 다이얼로그 — EventManagementPage 로컬 다이얼로그에서 추출(2026-06-10).
 * EventManagementPage(L1 목록)·EventDetailPage(L2 상세 인라인 수정) 공용.
 *
 * props:
 *  - open, onClose
 *  - event: 수정 대상 events 행(null = 신규)
 *  - societies: [{ id, name, slug_prefix }] (주최 학회 후보)
 *  - staff: [{ id, name, role, position }] (참석자 후보 — master/onsite)
 *  - canEdit: events:edit (false = 읽기 전용 폼)
 *  - canDelete: 이 행 삭제 가능 여부 (master 전부 / onsite 본인 생성)
 *  - onSaved(upsertData): 저장 성공 후 (L1 재조회 / L2 slug 변경 추적)
 *  - onDeleted(): 삭제 성공 후 (L1 재조회 / L2 목록 이동)
 */

// 판매 대분류 — 고정 3종(products.category 도메인과 동일). 소분류는 여기서 선택하지 않음.
const VISIBLE_CATEGORY_OPTIONS = ['검사', '도서', '도구'];

const SEASON_OPTIONS = ['춘계학술대회', '추계학술대회', '연수강좌', '보수교육', '세미나', '기타'];
const SEASON_SLUG_MAP = {
  '춘계학술대회': 'spring', '추계학술대회': 'fall', '연수강좌': 'training',
  '보수교육': 'edu', '세미나': 'seminar', '기타': 'etc',
};

// 이 다이얼로그가 관리하는 컬럼만 upsert (L2의 prep_note·진행상태 등 동시 편집 컬럼 오염 방지)
const FORM_FIELDS = [
  'name', 'discount_rate', 'order_url_slug', 'start_date', 'end_date', 'estimated_delivery_date',
  'event_year', 'host_society', 'event_season', 'venue', 'attendee_ids', 'note', 'marketing_cost',
  'visible_categories',
];
const DATE_FIELDS = ['start_date', 'end_date', 'estimated_delivery_date'];

const emptyEvent = () => ({
  name: '', discount_rate: 0, order_url_slug: '', start_date: '', end_date: '',
  estimated_delivery_date: '', event_year: new Date().getFullYear(), host_society: '',
  event_season: '', venue: '', attendee_ids: [], note: '', marketing_cost: null,
  visible_categories: [],
});

const EventFormDialog = ({
  open, onClose, event = null, societies = [], staff = [],
  canEdit = false, canDelete = false, onSaved, onDeleted,
}) => {
  const theme = useTheme();
  const { addNotification } = useNotification();

  const isEditing = !!event?.id;
  const [form, setForm] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [categoryCounts, setCategoryCounts] = useState(null); // { 검사: N, 도서: M, 도구: K }

  useEffect(() => {
    if (open) setForm(event ? { ...event } : emptyEvent());
  }, [open, event]);

  // 판매 대분류 미리보기용 — 대분류별 상품 수 1회 집계(실 카운트만, 가짜 통계 금지)
  useEffect(() => {
    if (!open || categoryCounts) return;
    let cancelled = false;
    fetchProductCountByCategory()
      .then((counts) => { if (!cancelled) setCategoryCounts(counts); })
      .catch(() => { if (!cancelled) setCategoryCounts({}); });
    return () => { cancelled = true; };
  }, [open, categoryCounts]);

  const handleChange = (name, value) => {
    setForm((prev) => {
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
            const societyObj = societies.find((s) => s.name === newSociety);
            if (societyObj) {
              const sPrefix = societyObj.slug_prefix || 'event';
              const seasonEng = SEASON_SLUG_MAP[newSeason] || 'etc';
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
    if (!form) return;

    if (!form.name || !form.order_url_slug) {
      addNotification('학회명과 고유 주소는 필수입니다.', 'error');
      return;
    }

    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(form.order_url_slug)) {
      addNotification('고유 주소는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.', 'error');
      return;
    }

    const { data: existingEvent, error: fetchError } = await supabase
      .from('events')
      .select('id')
      .eq('order_url_slug', form.order_url_slug)
      .not('id', 'eq', form.id || -1)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      addNotification(`중복 검사 실패: ${fetchError.message}`, 'error');
      return;
    }
    if (existingEvent) {
      addNotification('이미 사용중인 고유 주소입니다.', 'error');
      return;
    }

    // created_by는 소유권 컬럼 — 클라이언트가 덮어쓰지 않음 (insert 시 DB default).
    const upsertData = Object.fromEntries(FORM_FIELDS.map((k) => [k, form[k]]));
    // 정합: 빈 배열/빈 비용/빈 날짜 정규화 (uuid[]·integer·date 컬럼).
    upsertData.attendee_ids = Array.isArray(upsertData.attendee_ids) ? upsertData.attendee_ids : [];
    // 빈 배열 = 전체 노출(NULL과 동일 의미, 마이그레이션 §의미 규칙). 빈 배열 그대로 저장.
    upsertData.visible_categories = Array.isArray(upsertData.visible_categories)
      ? upsertData.visible_categories
      : [];
    upsertData.marketing_cost =
      upsertData.marketing_cost === '' || upsertData.marketing_cost == null
        ? null
        : Number(upsertData.marketing_cost);
    DATE_FIELDS.forEach((k) => { if (!upsertData[k]) upsertData[k] = null; });

    const query = isEditing
      ? supabase.from('events').update(upsertData).eq('id', form.id)
      : supabase.from('events').insert([upsertData]);

    const { error } = await query;
    if (error) {
      addNotification(`저장 실패: ${error.message}`, 'error');
    } else {
      addNotification('성공적으로 저장되었습니다.', 'success');
      onSaved?.(upsertData);
      onClose();
    }
  };

  const handleDeleteClick = async () => {
    if (!form?.id) return;
    const { count, error } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', form.id);
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
    const { error } = await supabase.from('events').delete().eq('id', form.id);
    if (error) {
      addNotification(`삭제 실패: ${error.message}`, 'error');
    } else {
      addNotification('행사가 삭제되었습니다.', 'success');
      setDeleteConfirmOpen(false);
      onClose();
      onDeleted?.();
    }
  };

  // attendee_ids(uuid[]) ↔ 후보 객체 배열 매핑
  const staffById = Object.fromEntries(staff.map((s) => [s.id, s]));
  const selectedAttendees = (form?.attendee_ids || []).map((id) => staffById[id]).filter(Boolean);
  const costNum = form?.marketing_cost ? Number(form.marketing_cost) : 0;

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
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
                value={form?.event_year || ''}
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
                options={SEASON_OPTIONS}
                inputValue={form?.event_season || ''}
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
                value={form?.host_society || ''}
                onChange={(e) => handleChange('host_society', e.target.value)}
                disabled={!canEdit}
                InputLabelProps={{ shrink: true }}
                helperText="학회 목록 관리에서 추가한 학회 중 선택"
              >
                <MenuItem value=""><em>학회 선택</em></MenuItem>
                {societies.map((s) => (
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
                value={form?.name || ''}
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
                value={form?.order_url_slug || ''}
                onChange={(e) => handleChange(e.target.name, e.target.value)}
                InputLabelProps={{ shrink: true }}
                helperText="주문 페이지 주소로 사용됩니다. 영문, 숫자, 하이픈만 가능"
              />

              <TextField
                name="discount_rate"
                label="할인율 (%)"
                type="number"
                fullWidth
                value={form?.discount_rate ? Math.round(form.discount_rate * 100) : 0}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  handleChange('discount_rate', val / 100);
                }}
                inputProps={{ step: '1', min: '0', max: '100' }}
                InputLabelProps={{ shrink: true }}
                helperText="예: 15 = 15% 할인"
                disabled={!canEdit}
              />

              <DateField
                mode="range"
                label="행사 기간"
                value={{ start: form?.start_date || '', end: form?.end_date || '' }}
                onChange={({ start, end }) => {
                  handleChange('start_date', start || '');
                  handleChange('end_date', end || '');
                }}
                helperText="달력에서 시작일·종료일을 차례로 선택하세요."
                disabled={!canEdit}
              />

              <DateField
                label="배송 예정일"
                value={form?.estimated_delivery_date || ''}
                onChange={(iso) => handleChange('estimated_delivery_date', iso || '')}
                helperText="입력 시 고객 주문 조회 페이지에 도착 예정일이 표시됩니다."
                disabled={!canEdit}
              />

              {/* 판매 대분류 — 고객 주문서 노출 필터(검사/도서/도구 다중 토글) */}
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 1 }}>
                  판매 대분류
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  {VISIBLE_CATEGORY_OPTIONS.map((cat) => {
                    const selected = (form?.visible_categories || []).includes(cat);
                    return (
                      <Chip
                        key={cat}
                        label={cat}
                        variant={selected ? 'filled' : 'outlined'}
                        color={selected ? 'primary' : 'default'}
                        onClick={canEdit ? () => {
                          const cur = form?.visible_categories || [];
                          handleChange('visible_categories',
                            selected ? cur.filter((c) => c !== cat) : [...cur, cat]);
                        } : undefined}
                        sx={{ fontWeight: selected ? 700 : 500, borderRadius: `${theme.radii.sm}px` }}
                      />
                    );
                  })}
                </Box>
                {(form?.visible_categories || []).length === 0 ? (
                  <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
                    선택하지 않으면 전체 상품이 노출됩니다.
                  </Typography>
                ) : (
                  <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
                    선택한 대분류 상품만 이 행사의 주문서에 노출됩니다.
                    {categoryCounts && (() => {
                      const parts = (form?.visible_categories || [])
                        .map((c) => `${c} ${categoryCounts[c] ?? 0}개`);
                      const total = (form?.visible_categories || [])
                        .reduce((sum, c) => sum + (categoryCounts[c] ?? 0), 0);
                      return ` 노출 대상: ${parts.join(' · ')} (총 ${total}개)`;
                    })()}
                  </Typography>
                )}
              </Box>
            </Box>

            <Divider />

            {/* Step 3 — 운영 정보 (장소·참석자·비용·비고) */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                운영 정보
              </Typography>

              <TextField
                name="venue"
                label="장소"
                fullWidth
                value={form?.venue || ''}
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
                value={form?.note || ''}
                onChange={(e) => handleChange(e.target.name, e.target.value)}
                disabled={!canEdit}
                placeholder="부스 위치, 진열 메모 등"
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          {isEditing && canDelete && (
            <Button onClick={handleDeleteClick} color="error" startIcon={<DeleteIcon />} sx={{ mr: 'auto' }}>
              삭제
            </Button>
          )}
          <Button onClick={onClose}>취소</Button>
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
            <strong>{form?.name}</strong> 행사를 삭제합니다.
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
    </>
  );
};

export default EventFormDialog;
