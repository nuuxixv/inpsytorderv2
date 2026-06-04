import React from 'react';
import { Box, Typography, Chip, alpha, useTheme } from '@mui/material';
import { Shield as ShieldIcon } from '@mui/icons-material';

// 역할 슬러그 4종 + fallback (A7 사양 §핵심 발견 1)
// master/onsite/fulfillment_book/fulfillment_test 만 한글 라벨·전용 색.
// 그 외 슬러그(역할 템플릿에서 신규 생성한 것)는 outlined fallback.
const ROLE_CHIP_META = {
  master:           { label: '마스터',      colorKey: 'warning',   icon: ShieldIcon },
  onsite:           { label: '현장 마케팅', colorKey: 'info',      icon: null },
  fulfillment_book: { label: '출고 (도서)', colorKey: 'secondary', icon: null },
  fulfillment_test: { label: '출고 (검사)', colorKey: 'success',   icon: null },
};

const RoleChip = ({ role }) => {
  const theme = useTheme();
  const meta = ROLE_CHIP_META[role];
  if (!meta) {
    return (
      <Chip
        label={role || '알 수 없음'}
        size="small"
        variant="outlined"
        sx={{ fontWeight: 600, color: 'text.secondary' }}
      />
    );
  }
  const palette = theme.palette[meta.colorKey]?.main || theme.gray[600];
  const Icon = meta.icon;
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
        color: palette,
      }}
    >
      {Icon && <Icon sx={{ fontSize: 14 }} />}
      <Typography variant="caption" sx={{ fontWeight: 700, color: palette, lineHeight: 1 }}>
        {meta.label}
      </Typography>
    </Box>
  );
};

export default RoleChip;
