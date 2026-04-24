import React from 'react';
import { Box, Typography, Skeleton, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ArrowUpward as UpIcon, ArrowDownward as DownIcon, Remove as FlatIcon } from '@mui/icons-material';

/**
 * 숫자 KPI 카드. 히어로/서브 2가지 variant.
 * - hero: 큰 숫자, 트렌드 뱃지
 * - sub: 레이블 + 중간 크기 숫자, 좌측 아이콘 배지
 *
 * Toss 느낌 핵심:
 *  - tabular-nums (theme CssBaseline에서 전역 적용됨)
 *  - 부정적 letter-spacing
 *  - 숫자는 800 weight, 레이블은 600
 */
const TrendPill = ({ value }) => {
  const theme = useTheme();
  if (value === undefined || value === null) return null;
  const isUp = value > 0;
  const isDown = value < 0;
  const color = isUp ? theme.accent.revenue : isDown ? theme.accent.danger : theme.gray[500];
  const Icon = isUp ? UpIcon : isDown ? DownIcon : FlatIcon;
  return (
    <Box
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.25,
        px: 0.75, py: 0.25,
        borderRadius: `${theme.radii.sm}px`,
        bgcolor: alpha(color, 0.1),
        color,
      }}
    >
      <Icon sx={{ fontSize: 12 }} />
      <Typography
        sx={{
          fontSize: '0.6875rem', fontWeight: 800,
          letterSpacing: '-0.01em', lineHeight: 1,
        }}
      >
        {Math.abs(value)}%
      </Typography>
    </Box>
  );
};

const StatCard = ({
  variant = 'sub',
  label,
  value,
  unit,
  icon: Icon,
  color,
  trend,
  loading = false,
  sx,
}) => {
  const theme = useTheme();
  const accentColor = color || theme.palette.primary.main;

  if (loading) {
    return (
      <Box sx={{ flex: 1, minWidth: 0, ...sx }}>
        <Skeleton variant="text" width="50%" height={18} />
        <Skeleton variant="text" width="80%" height={variant === 'hero' ? 44 : 32} sx={{ mt: 0.5 }} />
      </Box>
    );
  }

  if (variant === 'hero') {
    return (
      <Box sx={{ flex: 1, minWidth: 0, ...sx }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          {Icon && <Icon sx={{ fontSize: 16, color: 'text.secondary' }} />}
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontWeight: 700,
              letterSpacing: '-0.005em',
              textTransform: 'none',
            }}
          >
            {label}
          </Typography>
          <TrendPill value={trend} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
          <Typography
            component="span"
            sx={{
              fontSize: { xs: '1.75rem', md: '2.125rem' },
              fontWeight: 800,
              letterSpacing: '-0.035em',
              color: 'text.primary',
              lineHeight: 1.1,
              fontFeatureSettings: '"tnum" 1',
            }}
          >
            {value}
          </Typography>
          {unit && (
            <Typography
              component="span"
              sx={{
                fontSize: '1rem',
                fontWeight: 700,
                color: 'text.secondary',
                letterSpacing: '-0.02em',
              }}
            >
              {unit}
            </Typography>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1.5, ...sx }}>
      {Icon && (
        <Box
          sx={{
            width: 40, height: 40, flexShrink: 0,
            borderRadius: `${theme.radii.md}px`,
            bgcolor: alpha(accentColor, 0.1),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon sx={{ fontSize: 20, color: accentColor }} />
        </Box>
      )}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: '-0.005em' }}
          >
            {label}
          </Typography>
          <TrendPill value={trend} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.375, mt: 0.25 }}>
          <Typography
            component="span"
            sx={{
              fontSize: '1.375rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: 'text.primary',
              lineHeight: 1.1,
              fontFeatureSettings: '"tnum" 1',
              wordBreak: 'keep-all',
            }}
          >
            {value}
          </Typography>
          {unit && (
            <Typography
              component="span"
              sx={{ fontSize: '0.8125rem', fontWeight: 700, color: 'text.secondary' }}
            >
              {unit}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default StatCard;
