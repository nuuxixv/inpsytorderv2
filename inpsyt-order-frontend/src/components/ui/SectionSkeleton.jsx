import React from 'react';
import { Box, Skeleton } from '@mui/material';

/**
 * 섹션별 로딩 플레이스홀더. CircularProgress 풀페이지 대신 사용.
 */
export const StatRowSkeleton = ({ count = 4 }) => (
  <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
    {Array.from({ length: count }).map((_, i) => (
      <Box key={i} sx={{ flex: 1 }}>
        <Skeleton variant="text" width="55%" height={16} />
        <Skeleton variant="text" width="85%" height={36} sx={{ mt: 0.5 }} />
      </Box>
    ))}
  </Box>
);

export const ListSkeleton = ({ rows = 5, lineHeight = 44 }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton key={i} variant="rounded" height={lineHeight} />
    ))}
  </Box>
);

export const StatusBarSkeleton = () => (
  <Box>
    <Skeleton variant="text" width={120} height={20} />
    <Skeleton variant="rounded" height={28} sx={{ mt: 1 }} />
    <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} variant="rounded" width={64} height={20} />
      ))}
    </Box>
  </Box>
);

const SectionSkeleton = ({ variant = 'stats' }) => {
  if (variant === 'stats') return <StatRowSkeleton />;
  if (variant === 'list') return <ListSkeleton />;
  if (variant === 'status-bar') return <StatusBarSkeleton />;
  return <Skeleton variant="rounded" height={120} />;
};

export default SectionSkeleton;
