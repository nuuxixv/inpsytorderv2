import React from 'react';
import {
  Box, Typography, TextField, Chip, Autocomplete, Checkbox, ListItemText, InputAdornment, useTheme,
} from '@mui/material';
import { PlaceOutlined as PlaceIcon } from '@mui/icons-material';
import { numberToKoreanCurrency } from '../utils/koreanCurrency';
import { VISIBLE_CATEGORY_OPTIONS, rateToPercent, percentToRate } from '../utils/eventForm';

/**
 * 행사 선택 6필드(판매대분류·할인율·장소·참가비용·참석자·비고) — 생성 페이지·L2 편집 공용.
 *
 * props:
 *  - form, onChange(name, value)
 *  - staff: [{ id, name, department, ... }] 참석자 후보(master/onsite)
 *  - categoryCounts: { 검사: N, 도서: M, 도구: K } | null (실 집계 미리보기)
 */
const EventOptionalFields = ({ form, onChange, staff = [], categoryCounts }) => {
  const theme = useTheme();
  const cats = form?.visible_categories || [];
  const costNum = form?.marketing_cost ? Number(form.marketing_cost) : 0;
  const staffById = Object.fromEntries(staff.map((s) => [s.id, s]));
  const selectedAttendees = (form?.attendee_ids || []).map((id) => staffById[id]).filter(Boolean);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                    onChange('visible_categories', selected ? cats.filter((c) => c !== cat) : [...cats, cat])}
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
          value={rateToPercent(form?.discount_rate)}
          onChange={(e) => onChange('discount_rate', percentToRate(e.target.value))}
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
          value={form?.venue || ''}
          onChange={(e) => onChange('venue', e.target.value)}
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
              onChange('marketing_cost', digits === '' ? null : Number(digits));
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
        onChange={(_, v) => onChange('attendee_ids', v.map((o) => o.id))}
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
        value={form?.note || ''}
        onChange={(e) => onChange('note', e.target.value)}
        placeholder="부스 위치, 진열 메모 등"
        InputLabelProps={{ shrink: true }}
      />
    </Box>
  );
};

export default EventOptionalFields;
