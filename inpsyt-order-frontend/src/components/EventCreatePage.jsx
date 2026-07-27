import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, TextField, Autocomplete, Chip, Checkbox, MenuItem,
  InputAdornment, ListItemText, Collapse, IconButton, useTheme,
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
const dot = (iso) => (iso ? iso.replaceAll('-', '.') : '');

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
          .select('id, name, role, position')
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

  // attendee_ids(uuid[]) ↔ 후보 객체 매핑
  const staffById = Object.fromEntries(staff.map((s) => [s.id, s]));
  const selectedAttendees = (form.attendee_ids || []).map((id) => staffById[id]).filter(Boolean);
  const costNum = form.marketing_cost ? Number(form.marketing_cost) : 0;
  const cats = form.visible_categories || [];

  // 선택 영역 접힘 헤더 — 현재 값 요약(항목명만 X, 실제 값). 할인율 0% 실수 방지.
  const optionalSummary = [
    `할인율 ${rateToPercent(form.discount_rate)}%`,
    form.estimated_delivery_date ? `배송예정 ${dot(form.estimated_delivery_date)}` : '배송예정일 미정',
    cats.length ? `판매분류 ${cats.join('·')}` : '판매분류 전체',
    form.venue ? `장소 ${form.venue}` : '장소 미입력',
    `참석자 ${(form.attendee_ids || []).length}명`,
    costNum > 0 ? `비용 ${costNum.toLocaleString('ko-KR')}원` : '비용 미입력',
    form.note ? '비고 있음' : '비고 없음',
  ].join(' · ');

  const societiesEmpty = !loading && societies.length === 0;

  return (
    <Box>
      <PageHeader
        title="새 행사 만들기"
        icon={EventNoteIcon}
        action={
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            필수 3개만 채우면 완료
          </Typography>
        }
      />

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        아래 3가지를 고르면 행사명과 주문 URL이 자동으로 채워집니다.
      </Typography>

      {/* ① 자동 조립 영역 — 연도 / 행사 구분 / 주최 학회 */}
      <SectionCard title="행사명 자동 완성" subtitle="연도 · 행사 구분 · 주최 학회" sx={{ mb: 2 }}>
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

          <Autocomplete
            freeSolo
            options={SEASON_OPTIONS}
            inputValue={form.event_season || ''}
            onInputChange={(e, newInputValue) => handleChange('event_season', newInputValue)}
            disabled={loading}
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
            value={form.host_society || ''}
            onChange={(e) => handleChange('host_society', e.target.value)}
            disabled={loading}
            InputLabelProps={{ shrink: true }}
            helperText="학회 목록 관리에서 추가한 학회 중 선택"
          >
            <MenuItem value=""><em>학회 선택</em></MenuItem>
            {societies.map((s) => (
              <MenuItem key={s.id} value={s.name}>{s.name}</MenuItem>
            ))}
          </TextField>
        </Box>

        {societiesEmpty && (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1.5 }}>
            등록된 학회가 없습니다. 학회 관리의 “학회 목록 관리”에서 먼저 추가하거나, 행사명을 직접 입력해 진행할 수 있습니다.
          </Typography>
        )}
      </SectionCard>

      {/* ② 필수 영역 — 행사명 / 주문 URL / 행사 기간 */}
      <SectionCard
        title="필수 정보"
        subtitle="이 3가지만 채우면 만들 수 있어요"
        sx={{ mb: 2, borderColor: theme.gray[300] }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="행사명 *"
            fullWidth
            value={form.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            error={!form.name}
            helperText="위 정보로 자동 완성되며, 직접 입력·수정할 수 있습니다."
            InputLabelProps={{ shrink: true }}
          />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 2,
            }}
          >
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
          </Box>
        </Box>
      </SectionCard>

      {/* ③ 선택 영역 — 기본 접힘, 현재 값 요약 노출 */}
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
              선택 항목 7개
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

            <DateField
              label="배송 예정일"
              value={form.estimated_delivery_date || ''}
              onChange={(iso) => handleChange('estimated_delivery_date', iso || '')}
              helperText="입력 시 고객 주문 조회 페이지에 도착 예정일이 표시됩니다."
            />

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
              label="장소"
              fullWidth
              value={form.venue || ''}
              onChange={(e) => handleChange('venue', e.target.value)}
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
                label="비용 (원)"
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
    </Box>
  );
};

export default EventCreatePage;
