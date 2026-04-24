import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { STATUS_TO_KOREAN } from '../../constants/orderStatus';

/**
 * 주문 상태 칩. theme.status 단일 소스 사용.
 * 페이지에서 하드코딩된 hex/alpha 조합을 대체한다.
 */
const StatusChip = ({ status, size = 'md', sx }) => {
  const theme = useTheme();
  const color = theme.status[status] || theme.gray[500];
  const label = STATUS_TO_KOREAN[status] || status;

  const sizeStyles = size === 'sm'
    ? { px: 0.75, py: 0.25, fontSize: '0.6875rem', dotSize: 5 }
    : { px: 1, py: 0.5, fontSize: '0.75rem', dotSize: 6 };

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.625,
        px: sizeStyles.px,
        py: sizeStyles.py,
        borderRadius: `${theme.radii.sm}px`,
        bgcolor: alpha(color, 0.1),
        border: `1px solid ${alpha(color, 0.2)}`,
        ...sx,
      }}
    >
      <Box
        sx={{
          width: sizeStyles.dotSize, height: sizeStyles.dotSize,
          borderRadius: '50%', bgcolor: color,
        }}
      />
      <Typography
        sx={{
          fontSize: sizeStyles.fontSize,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          color,
          lineHeight: 1,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
};

export default StatusChip;
