import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Inbox as InboxIcon, SearchOff as SearchOffIcon } from '@mui/icons-material';

/**
 * 데이터가 없을 때 보여줄 Empty State 컴포넌트
 * @param {string} message - 표시할 메시지
 * @param {string} [subMessage] - 보조 메시지 (선택)
 * @param {React.ReactNode} [icon] - 표시할 아이콘 (기본값: InboxIcon)
 * @param {object} [action] - 액션 버튼 설정 { label: string, onClick: function }
 */
const EmptyState = ({ 
  message = "데이터가 없습니다.", 
  subMessage, 
  icon, 
  action 
}) => {
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        py: 8,
        px: 2,
        color: 'text.secondary',
        textAlign: 'center'
      }}
    >
      <Box sx={{ mb: 2, color: 'grey.300' }}>
        {icon || <InboxIcon sx={{ fontSize: 64 }} />}
      </Box>
      <Typography variant="h6" gutterBottom color="text.primary">
        {message}
      </Typography>
      {subMessage && (
        <Typography variant="body2" sx={{ mb: 3, maxWidth: 400 }}>
          {subMessage}
        </Typography>
      )}
      {action && (
        <Button variant="contained" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </Box>
  );
};

export default EmptyState;
