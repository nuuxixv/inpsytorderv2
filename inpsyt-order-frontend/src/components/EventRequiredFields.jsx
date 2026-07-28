import React from 'react';
import { Box, TextField, Typography } from '@mui/material';
import { DateField } from './ui';

/**
 * 행사 필수 4필드(행사명·주문URL·행사기간·배송예정일) — 생성 페이지·L2 편집 공용. 2×2 배치.
 *
 * props:
 *  - form, onChange(name, value)
 *  - slugState: useSlugCheck 반환값(형식·중복 상태 메시지)
 *  - originalSlug: 편집 시 원본 slug. 지정 + 변경 감지 시 비차단 경고 캡션 노출(생성은 미전달).
 */
const EventRequiredFields = ({ form, onChange, slugState, originalSlug }) => {
  const showSlugError = slugState.formatBad || slugState.reserved || slugState.taken || slugState.error;
  const slugChanged = originalSlug != null && (form?.order_url_slug || '') !== originalSlug;

  return (
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
        value={form?.name || ''}
        onChange={(e) => onChange('name', e.target.value)}
        error={!form?.name}
        helperText="위 정보로 자동 완성되며, 직접 입력·수정할 수 있습니다."
        InputLabelProps={{ shrink: true }}
      />

      <Box>
        <TextField
          label="주문 URL *"
          fullWidth
          value={form?.order_url_slug || ''}
          onChange={(e) => onChange('order_url_slug', e.target.value)}
          error={showSlugError}
          InputLabelProps={{ shrink: true }}
        />
        <Typography variant="caption" sx={{ color: slugState.displayMsg.color, mt: 0.5, ml: 1.75, display: 'block' }}>
          {slugState.displayMsg.text}
        </Typography>
        {slugChanged && (
          <Typography variant="caption" sx={{ color: 'warning.dark', mt: 0.5, ml: 1.75, display: 'block' }}>
            주소를 바꾸면 배포된 QR·복사한 링크·즐겨찾기·자동이동(/go) 설정이 더 이상 열리지 않습니다.
          </Typography>
        )}
      </Box>

      <DateField
        mode="range"
        label="행사 기간 *"
        value={{ start: form?.start_date || '', end: form?.end_date || '' }}
        onChange={({ start, end }) => {
          onChange('start_date', start || '');
          onChange('end_date', end || '');
        }}
        helperText="달력에서 시작일·종료일을 차례로 선택하세요. 이 기간에만 주문 페이지가 열립니다."
      />

      <DateField
        clickToOpen
        label="배송 예정일 *"
        value={form?.estimated_delivery_date || ''}
        onChange={(iso) => onChange('estimated_delivery_date', iso || '')}
        helperText="학회 종료 후 발송 예정일입니다. 고객 주문 조회에 표시됩니다."
      />
    </Box>
  );
};

export default EventRequiredFields;
