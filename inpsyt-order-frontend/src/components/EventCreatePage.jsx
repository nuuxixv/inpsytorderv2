import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, TextField, Autocomplete, Chip, Checkbox, MenuItem,
  InputAdornment, ListItemText, Collapse, IconButton, Link, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, useTheme,
} from '@mui/material';
import {
  PlaceOutlined as PlaceIcon,
  EventNote as EventNoteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useNotification } from '../hooks/useNotification';
import { getSocieties } from '../api/events';
import { fetchProductCountByCategory } from '../api/products';
import { numberToKoreanCurrency } from '../utils/koreanCurrency';
import {
  VISIBLE_CATEGORY_OPTIONS, SEASON_OPTIONS, emptyEvent,
  applyAutofill, normalizeEventPayload, isValidSlug, isRequiredComplete,
  rateToPercent, percentToRate,
} from '../utils/eventForm';
import { PageHeader, SectionCard, DateField } from './ui';

// '/admin/events/new' 는 이 생성 페이지 라우트 — slug로 쓰면 L2 상세 접근 불가.
const RESERVED_SLUGS = ['new'];
// 드롭다운 메뉴 맨 아래 "생성 항목" 센티널 — 실제 값으로 저장되지 않음.
const CUSTOM_SEASON = '__custom__';
const ADD_SOCIETY = '__add_society__';

const EventCreatePage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { addNotification } = useNotification();

  const [form, setForm] = useState(emptyEvent);
  const [societies, setSocieties] = useState([]);
  const [staff, setStaff] = useState([]);
  const [categoryCounts, setCategoryCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [optionalOpen, setOptionalOpen] = useState(false);
  // { status: 'idle'|'checking'|'available'|'taken'|'error', message? }
  const [slugCheck, setSlugCheck] = useState({ status: 'idle' });

  // 점진 노출 래치 — 한 번 열리면 값이 지워져도 다시 닫지 않는다.
  const [showRequired, setShowRequired] = useState(false); // 1→2단계
  const [showOptional, setShowOptional] = useState(false); // 2→3단계

  // 행사 구분 "직접 입력" 모드 · 주최 학회 인라인 추가 다이얼로그
  const [seasonCustom, setSeasonCustom] = useState(false);
  const [societyDialogOpen, setSocietyDialogOpen] = useState(false);
  const [newSocietyName, setNewSocietyName] = useState('');
  const [newSocietySlug, setNewSocietySlug] = useState('');
  const [addingSociety, setAddingSociety] = useState(false);

  const handleChange = (name, value) => {
    setForm((prev) => applyAutofill(prev, name, value, { societies, isEditing: false }));
  };

  // 진입 1회 로드 — 주최 학회·참석자 후보·판매 대분류 카운트. 실패해도 생성은 진행.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [soc, staffRes] = await Promise.all([
        getSocieties().catch(() => []),
        supabase
          .from('user_profiles')
          .select('id, name, role, position, department')
          .in('role', ['master', 'onsite'])
          .order('name', { ascending: true }),
      ]);
      if (cancelled) return;
      setSocieties(soc || []);
      if (!staffRes.error) setStaff(staffRes.data || []);
      setLoading(false);
    })();
    fetchProductCountByCategory()
      .then((c) => { if (!cancelled) setCategoryCounts(c); })
      .catch(() => { if (!cancelled) setCategoryCounts({}); });
    return () => { cancelled = true; };
  }, []);

  // 주문 URL 중복 즉시 검사 — debounce 400ms. 형식/예약 slug는 조회 생략.
  useEffect(() => {
    const slug = form.order_url_slug;
    if (!slug || !isValidSlug(slug) || RESERVED_SLUGS.includes(slug)) {
      setSlugCheck({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setSlugCheck({ status: 'checking' });
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id')
        .eq('order_url_slug', slug)
        .maybeSingle();
      if (cancelled) return;
      if (error) setSlugCheck({ status: 'error', message: error.message });
      else setSlugCheck({ status: data ? 'taken' : 'available' });
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [form.order_url_slug]);

  // 1→2단계: 자동조립 3필드가 모두 채워지면 필수 영역 노출(래치).
  const autofillComplete = Boolean(form.event_year && form.host_society && form.event_season);
  useEffect(() => { if (autofillComplete) setShowRequired(true); }, [autofillComplete]);

  const slug = form.order_url_slug;
  const slugFormatBad = Boolean(slug && !isValidSlug(slug));
  const slugReserved = Boolean(slug && isValidSlug(slug) && RESERVED_SLUGS.includes(slug));

  let slugMsg;
  if (slugFormatBad) slugMsg = { text: '고유 주소는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.', color: 'error.main' };
  else if (slugReserved) slugMsg = { text: "'new'는 사용할 수 없는 예약 주소입니다. 다른 주소를 사용하세요.", color: 'error.main' };
  else if (slugCheck.status === 'checking') slugMsg = { text: '확인 중...', color: 'text.secondary' };
  else if (slugCheck.status === 'available') slugMsg = { text: '사용 가능한 주소입니다', color: 'success.main' };
  else if (slugCheck.status === 'taken') slugMsg = { text: '이미 사용중인 고유 주소입니다', color: 'error.main' };
  else if (slugCheck.status === 'error') slugMsg = { text: `중복 검사 실패: ${slugCheck.message}`, color: 'error.main' };
  else slugMsg = { text: '주문 페이지 주소로 사용됩니다. 영문, 숫자, 하이픈만 가능', color: 'text.secondary' };

  const slugError = slugFormatBad || slugReserved || slugCheck.status === 'taken' || slugCheck.status === 'error';

  const requiredOk = isRequiredComplete(form);
  // 2→3단계: 필수 4개가 모두 유효하면 선택 항목 블록 노출(래치).
  useEffect(() => { if (requiredOk) setShowOptional(true); }, [requiredOk]);

  const slugAvailable =
    Boolean(slug) && isValidSlug(slug) && !RESERVED_SLUGS.includes(slug) && slugCheck.status === 'available';
  const canSubmit = requiredOk && slugAvailable && !saving;

  let disableReason = '';
  if (!canSubmit && !saving) {
    if (!form.name) disableReason = '행사명을 입력하세요.';
    else if (!slug) disableReason = '주문 URL을 입력하세요.';
    else if (slugFormatBad) disableReason = '주문 URL 형식을 확인하세요.';
    else if (slugReserved) disableReason = "'new'는 사용할 수 없는 주소입니다.";
    else if (!form.start_date || !form.end_date) disableReason = '행사 기간을 선택하세요.';
    else if (!form.estimated_delivery_date) disableReason = '배송 예정일을 선택하세요.';
    else if (slugCheck.status === 'checking') disableReason = '주문 URL 중복 확인 중입니다.';
    else if (slugCheck.status === 'taken') disableReason = '이미 사용중인 주문 URL입니다.';
    else if (slugCheck.status === 'error') disableReason = '주문 URL 중복 검사에 실패했습니다. 다시 시도하세요.';
  }

  const handleSave = async () => {
    if (!canSubmit) return;
    setSaving(true);
    const payload = normalizeEventPayload(form);
    const { error } = await supabase.from('events').insert([payload]);
    if (error) {
      addNotification(`저장 실패: ${error.message}`, 'error');
      setSaving(false);
    } else {
      addNotification('행사가 만들어졌습니다.', 'success');
      navigate(`/admin/events/${form.order_url_slug}`);
    }
  };

  const handleCancel = () => navigate('/admin/events');

  // 행사 구분 드롭다운 — 목록 6종 + "직접 입력". 직접 입력값의 season_eng는 etc.
  const seasonSelectValue = seasonCustom ? CUSTOM_SEASON : (form.event_season || '');
  const handleSeasonSelect = (e) => {
    const v = e.target.value;
    if (v === CUSTOM_SEASON) {
      setSeasonCustom(true);
      handleChange('event_season', '');
    } else {
      setSeasonCustom(false);
      handleChange('event_season', v);
    }
  };

  // 주최 학회 드롭다운 — 목록 + "+ 새 학회 추가"(선택 시 인라인 다이얼로그).
  const handleSocietySelect = (e) => {
    const v = e.target.value;
    if (v === ADD_SOCIETY) { setSocietyDialogOpen(true); return; }
    handleChange('host_society', v);
  };

  const closeSocietyDialog = () => {
    setSocietyDialogOpen(false);
    setNewSocietyName('');
    setNewSocietySlug('');
  };

  // 인라인 학회 추가 — SocietyManagementDialog.handleAdd와 동일 검증. 추가 후 목록 갱신·자동 선택.
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
    // 새 목록으로 자동조립 slug가 즉시 생성되도록 fresh 목록을 명시 전달.
    const nextSocieties = [...societies, data].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    setSocieties(nextSocieties);
    setForm((prev) => applyAutofill(prev, 'host_society', data.name, { societies: nextSocieties, isEditing: false }));
    addNotification('학회가 추가되었습니다.', 'success');
    closeSocietyDialog();
  };

  // attendee_ids(uuid[]) ↔ 후보 객체 매핑
  const staffById = Object.fromEntries(staff.map((s) => [s.id, s]));
  const selectedAttendees = (form.attendee_ids || []).map((id) => staffById[id]).filter(Boolean);
  const costNum = form.marketing_cost ? Number(form.marketing_cost) : 0;
  const cats = form.visible_categories || [];

  // 선택 영역 접힘 헤더 — 현재 값 요약(항목명만 X, 실제 값). 할인율 0% 실수 방지.
  const optionalSummary = [
    cats.length ? `판매분류 ${cats.join('·')}` : '판매분류 전체',
    `할인율 ${rateToPercent(form.discount_rate)}%`,
    form.venue ? `장소 ${form.venue}` : '장소 미입력',
    costNum > 0 ? `참가비용 ${costNum.toLocaleString('ko-KR')}원` : '참가비용 미입력',
    `참석자 ${(form.attendee_ids || []).length}명`,
    form.note ? '비고 있음' : '비고 없음',
  ].join(' · ');

  return (
    <Box>
      <PageHeader
        title="새 행사 만들기"
        icon={EventNoteIcon}
        action={
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            필수 4개만 채우면 완료
          </Typography>
        }
      />

      {/* 블록 1 — 「행사 정보」: 자동조립 3필드 + 필수 4필드 통합, 점진 노출 */}
      <SectionCard title="행사 정보" sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          아래 3가지를 고르면 행사명이 자동으로 만들어집니다.
        </Typography>

        {/* 1단계 — 연도 · 주최 학회 · 행사 구분 (항상 표시) */}
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
            value={form.event_year || ''}
            onChange={(e) => handleChange('event_year', e.target.value)}
            disabled={loading}
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
            value={form.host_society || ''}
            onChange={handleSocietySelect}
            disabled={loading}
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
            disabled={loading}
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
            value={form.event_season || ''}
            onChange={(e) => handleChange('event_season', e.target.value)}
            placeholder="예) 워크숍"
            InputLabelProps={{ shrink: true }}
            sx={{ mt: 2 }}
          />
        )}

        {!showRequired && (
          <Box sx={{ mt: 2 }}>
            <Link
              component="button"
              type="button"
              variant="body2"
              onClick={() => setShowRequired(true)}
              sx={{ color: 'primary.main' }}
            >
              행사명을 직접 입력할래요
            </Link>
          </Box>
        )}

        {showRequired && <Divider sx={{ my: 3 }} />}

        {/* 2단계 — 필수 4필드 2×2 (행사명·주문URL / 행사기간·배송예정일) */}
        <Box aria-live="polite">
          {showRequired && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: 2,
                alignItems: 'start',
              }}
            >
              <TextField
                label="행사명 *"
                fullWidth
                value={form.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                error={!form.name}
                helperText="위 정보로 자동 완성되며, 직접 입력·수정할 수 있습니다."
                InputLabelProps={{ shrink: true }}
              />

              <Box>
                <TextField
                  label="주문 URL *"
                  fullWidth
                  value={form.order_url_slug || ''}
                  onChange={(e) => handleChange('order_url_slug', e.target.value)}
                  error={slugError}
                  InputLabelProps={{ shrink: true }}
                />
                <Typography variant="caption" sx={{ color: slugMsg.color, mt: 0.5, ml: 1.75, display: 'block' }}>
                  {slugMsg.text}
                </Typography>
              </Box>

              <DateField
                mode="range"
                label="행사 기간 *"
                value={{ start: form.start_date || '', end: form.end_date || '' }}
                onChange={({ start, end }) => {
                  handleChange('start_date', start || '');
                  handleChange('end_date', end || '');
                }}
                helperText="달력에서 시작일·종료일을 차례로 선택하세요. 이 기간에만 주문 페이지가 열립니다."
              />

              <DateField
                label="배송 예정일 *"
                value={form.estimated_delivery_date || ''}
                onChange={(iso) => handleChange('estimated_delivery_date', iso || '')}
                helperText="학회 종료 후 발송 예정일입니다. 고객 주문 조회에 표시됩니다."
              />
            </Box>
          )}
        </Box>
      </SectionCard>

      {/* 블록 2 — 선택 항목 6개: 필수 4개 충족 후 노출, 접힘 헤더에 현재 값 요약 */}
      <Box aria-live="polite">
        {showOptional && (
          <SectionCard padding={0} sx={{ mb: 2 }}>
            <Box
              onClick={() => setOptionalOpen((v) => !v)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 2.5,
                cursor: 'pointer',
                '&:hover': { bgcolor: theme.gray[50] },
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ color: 'text.primary', lineHeight: 1.3 }}>
                  선택 항목 6개
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
                  {optionalSummary}
                </Typography>
              </Box>
              <IconButton size="small" aria-label={optionalOpen ? '선택 항목 접기' : '선택 항목 펼치기'}>
                {optionalOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>

            <Collapse in={optionalOpen} unmountOnExit>
              <Box sx={{ px: 2.5, pb: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  지금 비워둬도 됩니다. 만든 뒤 행사 상세에서 언제든 채울 수 있어요.
                </Typography>

                {/* 1행 — 판매 대분류 · 할인율 */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                    gap: 2,
                    alignItems: 'start',
                  }}
                >
                  {/* 판매 대분류 — 고객 주문서 노출 필터(검사/도서/도구 다중 토글) */}
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 1 }}>
                      판매 대분류
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                      {VISIBLE_CATEGORY_OPTIONS.map((cat) => {
                        const selected = cats.includes(cat);
                        return (
                          <Chip
                            key={cat}
                            label={cat}
                            variant={selected ? 'filled' : 'outlined'}
                            color={selected ? 'primary' : 'default'}
                            onClick={() =>
                              handleChange('visible_categories', selected ? cats.filter((c) => c !== cat) : [...cats, cat])}
                            sx={{ fontWeight: selected ? 700 : 500, borderRadius: `${theme.radii.sm}px` }}
                          />
                        );
                      })}
                    </Box>
                    {cats.length === 0 ? (
                      <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
                        선택하지 않으면 전체 상품이 노출됩니다.
                      </Typography>
                    ) : (
                      <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
                        선택한 대분류 상품만 이 행사의 주문서에 노출됩니다.
                        {categoryCounts && (() => {
                          const parts = cats.map((c) => `${c} ${categoryCounts[c] ?? 0}개`);
                          const total = cats.reduce((sum, c) => sum + (categoryCounts[c] ?? 0), 0);
                          return ` 노출 대상: ${parts.join(' · ')} (총 ${total}개)`;
                        })()}
                      </Typography>
                    )}
                  </Box>

                  <TextField
                    label="할인율 (%)"
                    type="number"
                    fullWidth
                    value={rateToPercent(form.discount_rate)}
                    onChange={(e) => handleChange('discount_rate', percentToRate(e.target.value))}
                    inputProps={{ step: '1', min: '0', max: '100' }}
                    InputLabelProps={{ shrink: true }}
                    helperText="예: 15 = 15% 할인"
                  />
                </Box>

                {/* 2행 — 장소 · 참가비용 */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                    gap: 2,
                    alignItems: 'start',
                  }}
                >
                  <TextField
                    label="장소"
                    fullWidth
                    value={form.venue || ''}
                    onChange={(e) => handleChange('venue', e.target.value)}
                    placeholder="예) 서울 코엑스 그랜드볼룸"
                    InputProps={{ startAdornment: <InputAdornment position="start"><PlaceIcon sx={{ fontSize: 18, color: 'text.disabled' }} /></InputAdornment> }}
                    InputLabelProps={{ shrink: true }}
                  />

                  <Box>
                    <TextField
                      label="참가비용 (원)"
                      fullWidth
                      value={costNum ? costNum.toLocaleString('ko-KR') : ''}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/[^0-9]/g, '');
                        handleChange('marketing_cost', digits === '' ? null : Number(digits));
                      }}
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
                </Box>

                {/* 3행 — 참석자 (전폭). 후보 = user_profiles role IN (master, onsite) */}
                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  options={staff}
                  value={selectedAttendees}
                  onChange={(_, v) => handleChange('attendee_ids', v.map((o) => o.id))}
                  getOptionLabel={(o) => o.name}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderOption={(props, option, { selected }) => (
                    <li {...props} key={option.id}>
                      <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
                      <ListItemText
                        primary={option.name}
                        secondary={option.department || ''}
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

                {/* 4행 — 비고 (전폭) */}
                <TextField
                  label="비고"
                  fullWidth
                  multiline
                  minRows={2}
                  value={form.note || ''}
                  onChange={(e) => handleChange('note', e.target.value)}
                  placeholder="부스 위치, 진열 메모 등"
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
            </Collapse>
          </SectionCard>
        )}
      </Box>

      {/* 하단 액션 */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
        {disableReason && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {disableReason}
          </Typography>
        )}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={handleCancel} disabled={saving}>취소</Button>
          <Button variant="contained" onClick={handleSave} disabled={!canSubmit}>
            행사 만들기
          </Button>
        </Box>
      </Box>

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
    </Box>
  );
};

export default EventCreatePage;
