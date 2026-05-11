import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';

/**
 * 어드민 페이지 최상단 헤더.
 * - 좌측: 아이콘 + 타이틀 + 서브텍스트
 * - 우측: 액션 슬롯 (새로고침/내보내기 등)
 */
const PageHeader = ({ title, subtitle, icon: Icon, action, sx }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'space-between',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: 2,
        mb: 3,
        ...sx,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
        {Icon && (
          <Box
            sx={{
              width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: `${theme.radii.md}px`,
              bgcolor: theme.gray[50],
              border: `1px solid ${theme.gray[200]}`,
            }}
          >
            <Icon sx={{ fontSize: 20, color: 'primary.main' }} />
          </Box>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              letterSpacing: '-0.025em',
              color: 'text.primary',
              lineHeight: 1.2,
            }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', mt: 0.5 }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
      {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
    </Box>
  );
};

export default PageHeader;
