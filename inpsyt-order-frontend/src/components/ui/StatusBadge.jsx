import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { STATUS_TO_KOREAN } from '../../constants/orderStatus';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../constants/categoryColors';

/**
 * StatusBadge — 주문 상태 / 카테고리를 의미 단위 칩으로 표시한다.
 *
 * 합성 컴포넌트 6종 중 1번. 시안마다 흩어져 있던 칩 패턴
 * (StatusChip, FulfillmentPreview의 CATEGORY_CHIP, ProductRow의 카테고리 칩 등)을
 * 하나의 의미 단위로 모은다.
 *
 * 두 가지 의미를 한 컴포넌트가 다루되, design-system 02 §색 / 08 D17에 따라
 * 형태로 구분한다:
 *   - kind="status"   → 주문 상태. theme.status 단일 소스. soft(채움) 형태. dot 동반.
 *   - kind="category" → 상품 종류(도서/검사). CATEGORY_COLORS 토큰. outlined 형태.
 * category-test(#6366F1)와 status-completed가 헥사가 같아도 형태가 달라 운영자가
 * 헷갈리지 않는다.
 *
 * @param {'status'|'category'} [kind='status']
 * @param {string} value - status: 'paid'|'pending'|'completed'|'cancelled'|'refunded'
 *                         category: 'book'|'test'
 * @param {string} [label] - 라벨 직접 지정(미지정 시 value에서 자동 매핑)
 * @param {'sm'|'md'} [size='md']
 * @param {boolean} [dot] - status일 때 좌측 점 표시 여부(기본 true), category는 점 없음
 * @param {object} [sx]
 */
const StatusBadge = ({ kind = 'status', value, label, size = 'md', dot, sx }) => {
  const theme = useTheme();

  const isCategory = kind === 'category';
  const color = isCategory
    ? (CATEGORY_COLORS[value] || theme.gray[600])
    : (theme.status[value] || theme.gray[500]);
  const resolvedLabel =
    label ||
    (isCategory ? CATEGORY_LABELS[value] : STATUS_TO_KOREAN[value]) ||
    value;
  const showDot = isCategory ? false : (dot ?? true);

  const dim = size === 'sm'
    ? { px: 0.75, py: 0.25, dotSize: 5, variant: 'caption' }
    : { px: 1, py: 0.5, dotSize: 6, variant: 'caption' };

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.625,
        px: dim.px,
        py: dim.py,
        borderRadius: `${theme.radii.sm}px`,
        // status: 채움(soft) / category: outlined(투명 배경 + 테두리)
        bgcolor: isCategory ? 'transparent' : alpha(color, 0.1),
        border: `1px solid ${alpha(color, isCategory ? 0.35 : 0.2)}`,
        ...sx,
      }}
    >
      {showDot && (
        <Box
          sx={{
            width: dim.dotSize,
            height: dim.dotSize,
            borderRadius: '50%',
            bgcolor: color,
            flexShrink: 0,
          }}
        />
      )}
      <Typography
        variant={dim.variant}
        sx={{ fontWeight: 600, color, lineHeight: 1 }}
      >
        {resolvedLabel}
      </Typography>
    </Box>
  );
};

export default StatusBadge;
