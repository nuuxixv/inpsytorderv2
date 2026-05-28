import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { InboxOutlined as InboxIcon } from '@mui/icons-material';

/**
 * EmptyState — 빈 상태(아이콘 + 제목 + 부제 + 다음 행동).
 *
 * 합성 컴포넌트 6종 중 5번. design-system 01 원칙 4(다음 행동) 정합 —
 * "비었습니다"로 끝내지 않고 사용자가 무엇을 하면 되는지 액션을 동반한다.
 *
 * 기존 components/EmptyState.jsx(토큰 미정합, h6/raw 사이즈)를 대체하는 정합 버전.
 * 실 페이지(5곳)는 점진 마이그레이션 대상(03 문서 참조).
 *
 * design-system 02 §타이포: 제목 title-card(subtitle1), 부제 small(body2). 인라인 사이즈 없음.
 *
 * @param {React.ElementType} [icon=InboxIcon] - MUI 아이콘 컴포넌트
 * @param {React.ReactNode} title - 빈 상태 제목(예: '출고 대기 주문이 없습니다')
 * @param {React.ReactNode} [description] - 보조 안내(예: '필터를 조정해 주세요')
 * @param {{label: string, onClick: () => void, startIcon?: React.ReactNode}} [action]
 *        다음 행동 버튼
 * @param {object} [sx]
 */
const EmptyState = ({
  icon: Icon = InboxIcon,
  title,
  description,
  action,
  sx,
}) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      py: 6, // 48px (space-3xl)
      px: 2,
      ...sx,
    }}
  >
    {Icon && (
      <Box sx={{ mb: 2, color: 'grey.300', lineHeight: 0 }}>
        <Icon sx={{ fontSize: 48 }} />
      </Box>
    )}
    <Typography variant="subtitle1" sx={{ color: 'text.primary', mb: 0.5 }}>
      {title}
    </Typography>
    {description && (
      <Typography
        variant="body2"
        sx={{ color: 'text.secondary', maxWidth: 360, mb: action ? 2.5 : 0 }}
      >
        {description}
      </Typography>
    )}
    {action && (
      <Button
        variant="outlined"
        onClick={action.onClick}
        startIcon={action.startIcon}
        sx={{ mt: description ? 0 : 2.5 }}
      >
        {action.label}
      </Button>
    )}
  </Box>
);

export default EmptyState;
