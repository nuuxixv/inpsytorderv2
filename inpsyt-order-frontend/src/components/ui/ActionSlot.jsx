import React from 'react';
import { Box } from '@mui/material';

/**
 * ActionSlot — 카드·모달·툴바 하단의 액션 버튼 영역.
 *
 * 합성 컴포넌트 6종 중 4번. 시안마다 손으로 짜던
 * `<Box sx={{ display:'flex', gap:1, ml:'auto' }}>` 액션 묶음을 의미 단위로 모은다.
 * 버튼 배치 규칙을 컴포넌트가 강제한다:
 *   - 주 액션은 우측 끝(우→좌 우선순위)
 *   - 위험 액션(삭제 등)은 leading 슬롯으로 분리해 주 액션과 거리를 둔다
 *   - 버튼 사이 gap 8px(space-sm) 고정 — 02 §간격 4배수, 손가락 빗나감 방지
 *
 * @param {React.ReactNode} children - 우측 정렬 액션(주 + 보조). 우선순위 높은 게 우측 끝.
 * @param {React.ReactNode} [leading] - 좌측 정렬 슬롯(위험 액션, 보조 정보)
 * @param {'flex-start'|'center'|'space-between'} [justify='flex-end']
 * @param {boolean} [wrap=true] - 좁은 폭에서 줄바꿈 허용
 * @param {object} [sx]
 */
const ActionSlot = ({
  children,
  leading,
  justify = 'flex-end',
  wrap = true,
  sx,
}) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1, // 8px (space-sm)
      flexWrap: wrap ? 'wrap' : 'nowrap',
      justifyContent: leading ? 'space-between' : justify,
      ...sx,
    }}
  >
    {leading && (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {leading}
      </Box>
    )}
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        flexWrap: wrap ? 'wrap' : 'nowrap',
        ...(leading ? {} : { ml: justify === 'flex-end' ? 'auto' : 0 }),
      }}
    >
      {children}
    </Box>
  </Box>
);

export default ActionSlot;
