import React from 'react';
import { Box, Typography } from '@mui/material';
import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';

// 임시저장 완료 인라인 표시 — 토스트 아님(놓침 방지). "임시저장됨 HH:MM".
// savedLabel 없으면 렌더 안 함. 룰 E: 조용한 상태 표시(장식 아님).
const DraftSavedHint = ({ savedLabel, sx }) => {
  if (!savedLabel) return null;
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'text.disabled', ...sx }}>
      <CloudDoneOutlinedIcon sx={{ fontSize: 14 }} />
      <Typography variant="caption" sx={{ color: 'inherit', fontFeatureSettings: '"tnum" 1' }}>
        임시저장됨 {savedLabel}
      </Typography>
    </Box>
  );
};

export default DraftSavedHint;
