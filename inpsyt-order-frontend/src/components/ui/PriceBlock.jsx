import React from 'react';
import { Box, Typography, Divider } from '@mui/material';

const fmt = (v) => (typeof v === 'number' ? `${v.toLocaleString()}원` : v);

/**
 * PriceBlock — 가격을 읽는 자리. 정가·할인·배송비 등 보조 행 + 합계 행.
 *
 * 합성 컴포넌트 6종 중 3번. design-system 01 원칙 1(가격 신뢰)의 핵심.
 * 본인 돈 쓰는 사용자는 가격을 두 번 본다 — 합계 숫자는 본문보다 한 단계 또렷한
 * number 토큰(02 §타이포 약속 4) 위계로 보여준다.
 *
 * "값을 읽는 자리"이므로 숫자는 항상 tabular-nums.
 *
 * @param {Array<{label: React.ReactNode, value: number|string, muted?: boolean}>} [rows]
 *        합계 위에 쌓이는 보조 금액 행(배송비, 1차/2차 결제금액 등)
 * @param {React.ReactNode} totalLabel - 합계 라벨(예: '최종 결제금액', '합계')
 * @param {number|string} totalValue - 합계 금액(숫자면 자동 '원' 포맷)
 * @param {string} [totalColor] - 합계 값 색(상태 배너 색 등). 미지정 시 text.primary
 * @param {boolean} [divider=true] - 보조 행과 합계 사이 구분선
 * @param {object} [sx]
 */
const PriceBlock = ({
  rows = [],
  totalLabel,
  totalValue,
  totalColor,
  divider = true,
  sx,
}) => {
  return (
    <Box sx={{ ...sx }}>
      {rows.map((row, idx) => (
        <Box
          key={idx}
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 2,
            mb: 0.75,
          }}
        >
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {row.label}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: row.muted ? 'text.secondary' : 'text.primary',
              fontFeatureSettings: '"tnum" 1',
              whiteSpace: 'nowrap',
            }}
          >
            {fmt(row.value)}
          </Typography>
        </Box>
      ))}

      {(totalLabel || totalValue != null) && (
        <>
          {divider && rows.length > 0 && <Divider sx={{ my: 1 }} />}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 2,
            }}
          >
            {/* 합계 라벨: title-card 위계 (subtitle1 = 16/700) */}
            <Typography variant="subtitle1" sx={{ color: 'text.primary' }}>
              {totalLabel}
            </Typography>
            {/* 합계 값: number 토큰 위계 — 본문보다 한 단계 또렷 */}
            <Typography
              variant="subtitle1"
              sx={{
                color: totalColor || 'text.primary',
                fontFeatureSettings: '"tnum" 1',
                whiteSpace: 'nowrap',
              }}
            >
              {fmt(totalValue)}
            </Typography>
          </Box>
        </>
      )}
    </Box>
  );
};

export default PriceBlock;
