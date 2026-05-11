import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';

/**
 * 대시보드/어드민 전반에서 사용하는 섹션 카드.
 * - Toss 스타일: border 기반, 기본 그림자 없음, hover시 미세 elevation
 * - 헤더 슬롯(title/subtitle/action) + body
 */
const SectionCard = ({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  padding = 24,
  interactive = false,
  onClick,
  sx,
}) => {
  const theme = useTheme();
  const hasHeader = Boolean(title || subtitle || action || Icon);

  return (
    <Box
      onClick={onClick}
      sx={{
        bgcolor: 'background.paper',
        border: `1px solid ${theme.gray[200]}`,
        borderRadius: `${theme.radii.lg}px`,
        overflow: 'hidden',
        transition: `all 0.2s ${theme.easing.toss}`,
        cursor: interactive || onClick ? 'pointer' : 'default',
        ...(interactive || onClick ? {
          '&:hover': {
            borderColor: theme.gray[300],
            boxShadow: theme.customShadows.sm,
            transform: 'translateY(-1px)',
          },
        } : {}),
        ...sx,
      }}
    >
      {hasHeader && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: `${padding}px`,
            pt: `${padding}px`,
            pb: children ? 2 : `${padding}px`,
          }}
        >
          {Icon && (
            <Box
              sx={{
                width: 32, height: 32, borderRadius: `${theme.radii.sm}px`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: theme.gray[50],
              }}
            >
              <Icon sx={{ fontSize: 18, color: theme.gray[700] }} />
            </Box>
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {title && (
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 700,
                  color: 'text.primary',
                  letterSpacing: '-0.015em',
                  lineHeight: 1.3,
                }}
              >
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
          {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
        </Box>
      )}
      {children && (
        <Box
          sx={{
            px: `${padding}px`,
            pb: `${padding}px`,
            pt: hasHeader ? 0 : `${padding}px`,
          }}
        >
          {children}
        </Box>
      )}
    </Box>
  );
};

export default SectionCard;
