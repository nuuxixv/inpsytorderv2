import React from 'react';
import { Box, Typography, Button, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import HistoryEduOutlinedIcon from '@mui/icons-material/HistoryEduOutlined';

// 작성 폼 임시저장 복구 배너 — 다이얼로그 아닌 인라인(흐름 안 끊음).
// useFormDraft와 짝. 유효 draft 있을 때만 호출부가 렌더.
// 룰 E: 장식 아님 — primary soft 박스 + 아이콘 + 두 액션(이어쓰기/새로쓰기)만.
const DraftBanner = ({ savedLabel, onResume, onDiscard, sx }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1.25,
        mb: 2,
        borderRadius: `${theme.radii.md}px`,
        bgcolor: alpha(theme.palette.primary.main, 0.06),
        border: `1px solid ${alpha(theme.palette.primary.main, 0.24)}`,
        flexWrap: 'wrap',
        ...sx,
      }}
    >
      <HistoryEduOutlinedIcon sx={{ fontSize: 20, color: 'primary.main', flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 160 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
          작성 중이던 내용이 있어요
        </Typography>
        {savedLabel && (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1' }}>
            마지막 임시저장 {savedLabel}
          </Typography>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 0.75, ml: 'auto' }}>
        <Button size="small" onClick={onDiscard} sx={{ color: 'text.secondary' }}>새로쓰기</Button>
        <Button size="small" variant="contained" onClick={onResume}>이어쓰기</Button>
      </Box>
    </Box>
  );
};

export default DraftBanner;
