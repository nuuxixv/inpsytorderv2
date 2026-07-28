import React, { useState } from 'react';
import {
  Box, TextField, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from '@mui/material';
import { supabase } from '../supabaseClient';
import { useNotification } from '../hooks/useNotification';
import { SEASON_OPTIONS } from '../utils/eventForm';

// 드롭다운 맨 아래 "생성 항목" 센티널 — 실제 값으로 저장되지 않음.
const CUSTOM_SEASON = '__custom__';
const ADD_SOCIETY = '__add_society__';

/**
 * 행사 자동조립 3필드(연도·주최학회·행사구분) — 생성 페이지·L2 편집 공용.
 * 주최학회·행사구분 모두 드롭다운 강제(자유 입력 금지) + 메뉴 내 생성 항목.
 *
 * props:
 *  - form, onChange(name, value)
 *  - societies: [{ id, name, slug_prefix }]
 *  - onSocietyAdded(newSociety): 부모가 societies 갱신 + fresh 목록으로 applyAutofill(원자 처리, stale-closure 방지)
 *  - disabled
 */
const EventAutofillFields = ({ form, onChange, societies = [], onSocietyAdded, disabled = false }) => {
  const { addNotification } = useNotification();

  // 편집 진입 시 event_season이 목록 외 커스텀 값이면 '직접 입력' 모드로 시작.
  const [seasonCustom, setSeasonCustom] = useState(
    () => Boolean(form?.event_season && !SEASON_OPTIONS.includes(form.event_season)),
  );
  const [societyDialogOpen, setSocietyDialogOpen] = useState(false);
  const [newSocietyName, setNewSocietyName] = useState('');
  const [newSocietySlug, setNewSocietySlug] = useState('');
  const [addingSociety, setAddingSociety] = useState(false);

  // 행사 구분 드롭다운 — 목록 6종 + "직접 입력". 직접 입력값의 season_eng는 etc.
  const seasonSelectValue = seasonCustom ? CUSTOM_SEASON : (form?.event_season || '');
  const handleSeasonSelect = (e) => {
    const v = e.target.value;
    if (v === CUSTOM_SEASON) {
      setSeasonCustom(true);
      onChange('event_season', '');
    } else {
      setSeasonCustom(false);
      onChange('event_season', v);
    }
  };

  // 주최 학회 드롭다운 — 목록 + "+ 새 학회 추가"(선택 시 인라인 다이얼로그).
  const handleSocietySelect = (e) => {
    const v = e.target.value;
    if (v === ADD_SOCIETY) { setSocietyDialogOpen(true); return; }
    onChange('host_society', v);
  };

  const closeSocietyDialog = () => {
    setSocietyDialogOpen(false);
    setNewSocietyName('');
    setNewSocietySlug('');
  };

  // 인라인 학회 추가 — SocietyManagementDialog.handleAdd와 동일 검증. 추가만(삭제·정리 없음).
  const handleAddSociety = async () => {
    if (!newSocietyName.trim() || !newSocietySlug.trim()) {
      addNotification('학회명과 URL 태그를 모두 입력해주세요.', 'error');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(newSocietySlug)) {
      addNotification('URL 태그는 영문 소문자, 숫자, 하이픈만 가능합니다.', 'error');
      return;
    }
    setAddingSociety(true);
    const { data, error } = await supabase
      .from('societies')
      .insert([{ name: newSocietyName.trim(), slug_prefix: newSocietySlug.trim() }])
      .select('id, name, slug_prefix')
      .single();
    setAddingSociety(false);
    if (error) {
      addNotification(`학회 추가 실패: ${error.message}`, 'error');
      return;
    }
    // 부모가 setSocieties + applyAutofill(fresh 목록)을 원자 처리 — slug 즉시 조립 보장.
    onSocietyAdded?.(data);
    addNotification('학회가 추가되었습니다.', 'success');
    closeSocietyDialog();
  };

  return (
    <>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: 2,
        }}
      >
        <TextField
          select
          fullWidth
          label="연도"
          value={form?.event_year || ''}
          onChange={(e) => onChange('event_year', e.target.value)}
          disabled={disabled}
          InputLabelProps={{ shrink: true }}
        >
          <MenuItem value=""><em>연도 선택</em></MenuItem>
          {[...Array(5)].map((_, i) => {
            const year = new Date().getFullYear() - 1 + i;
            return <MenuItem key={year} value={year}>{year}년</MenuItem>;
          })}
        </TextField>

        <TextField
          select
          fullWidth
          label="주최 학회"
          value={form?.host_society || ''}
          onChange={handleSocietySelect}
          disabled={disabled}
          InputLabelProps={{ shrink: true }}
          helperText="목록에 없으면 아래 '새 학회 추가'로 만들 수 있습니다."
        >
          <MenuItem value=""><em>학회 선택</em></MenuItem>
          {societies.map((s) => (
            <MenuItem key={s.id} value={s.name}>{s.name}</MenuItem>
          ))}
          <MenuItem value={ADD_SOCIETY} sx={{ color: 'primary.main', fontWeight: 600 }}>
            + 새 학회 추가
          </MenuItem>
        </TextField>

        <TextField
          select
          fullWidth
          label="행사 구분"
          value={seasonSelectValue}
          onChange={handleSeasonSelect}
          disabled={disabled}
          InputLabelProps={{ shrink: true }}
        >
          <MenuItem value=""><em>행사 구분 선택</em></MenuItem>
          {SEASON_OPTIONS.map((s) => (
            <MenuItem key={s} value={s}>{s}</MenuItem>
          ))}
          <MenuItem value={CUSTOM_SEASON} sx={{ color: 'primary.main', fontWeight: 600 }}>
            직접 입력
          </MenuItem>
        </TextField>
      </Box>

      {seasonCustom && (
        <TextField
          fullWidth
          label="행사 구분 직접 입력"
          value={form?.event_season || ''}
          onChange={(e) => onChange('event_season', e.target.value)}
          placeholder="예) 워크숍"
          InputLabelProps={{ shrink: true }}
          sx={{ mt: 2 }}
        />
      )}

      {/* 주최 학회 인라인 추가 — 학회명 + URL 태그(SocietyManagementDialog와 동일 검증). 추가만. */}
      <Dialog open={societyDialogOpen} onClose={closeSocietyDialog} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>새 학회 추가</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="학회명"
              placeholder="예: 대한치매학회"
              value={newSocietyName}
              onChange={(e) => setNewSocietyName(e.target.value)}
              fullWidth
              autoFocus
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="URL 태그"
              placeholder="예: kdementia"
              value={newSocietySlug}
              onChange={(e) => setNewSocietySlug(e.target.value)}
              fullWidth
              helperText="주문서 주소 생성에 사용됩니다. 영문 소문자, 숫자, 하이픈만 가능"
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={closeSocietyDialog} disabled={addingSociety}>취소</Button>
          <Button variant="contained" onClick={handleAddSociety} disabled={addingSociety}>추가</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default EventAutofillFields;
