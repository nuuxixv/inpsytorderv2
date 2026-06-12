import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ContentCopy as ContentCopyIcon } from '@mui/icons-material';

/**
 * InfoRow — "라벨 + 값" 한 줄. 인라인 복사 옵션.
 *
 * 합성 컴포넌트 6종 중 2번. 시안마다 따로 정의돼 있던
 * 라벨+값 패턴(FulfillmentPreview의 DataLine, CustomerOrderStatusPreview의 InfoRow 등)을
 * 하나로 모은다. 출고·주문상태 화면에서 연락처/ID/주소/요청/메모가 모두 이 한 줄로 표시된다.
 *
 * onCopy 지정 시 값 텍스트 직후에 16px 복사 아이콘이 상시 노출되고(태블릿 — hover-reveal 금지),
 * 값+아이콘 전체가 단일 클릭 타깃이 된다. hover 시 알파 배경 하이라이트 + 아이콘 primary.
 *
 * design-system 02 §타이포: 라벨은 caption, 값은 body2(small) 토큰. 인라인 사이즈 없음.
 *
 * @param {React.ReactNode} label
 * @param {React.ReactNode} value
 * @param {() => void} [onCopy] - 지정 시 값 직후 인라인 복사 아이콘 노출, 값 전체 클릭 복사
 * @param {boolean} [mono=false] - 값을 tabular-nums 정렬로(연락처·ID·금액)
 * @param {boolean} [muted=false] - 값을 보조색으로(빈 값 '-' 등)
 * @param {boolean} [multiline=false] - 값이 여러 줄일 때 라벨을 상단 정렬(주소·요청·메모)
 * @param {number|string} [labelWidth=64] - 라벨 고정 폭(px)
 * @param {object} [sx]
 */
const InfoRow = ({
  label,
  value,
  onCopy,
  mono = false,
  muted = false,
  multiline = false,
  labelWidth = 64,
  sx,
}) => {
  const theme = useTheme();

  const valueSx = {
    fontWeight: 500,
    color: muted ? 'text.secondary' : 'text.primary',
    fontFeatureSettings: mono ? '"tnum" 1' : undefined,
    wordBreak: 'break-all',
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: multiline ? 'flex-start' : 'center',
        gap: 1,
        py: 0.5,
        minHeight: onCopy ? 40 : 28,
        ...sx,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          flex: `0 0 ${typeof labelWidth === 'number' ? `${labelWidth}px` : labelWidth}`,
          fontWeight: 600,
          color: 'text.secondary',
          pt: multiline ? '2px' : 0,
        }}
      >
        {label}
      </Typography>
      {onCopy ? (
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box
            onClick={onCopy}
            role="button"
            aria-label="복사"
            sx={{
              display: 'inline-flex',
              alignItems: multiline ? 'flex-start' : 'center',
              gap: 0.75,
              maxWidth: '100%',
              mx: -0.75,
              px: 0.75,
              py: 0.25,
              borderRadius: `${theme.radii.sm}px`,
              cursor: 'copy',
              transition: `all 0.15s ${theme.easing.toss}`,
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.06),
                '& .InfoRow-copyIcon': { color: theme.palette.primary.main },
              },
            }}
          >
            <Typography variant="body2" component="div" sx={valueSx}>
              {value}
            </Typography>
            <ContentCopyIcon
              className="InfoRow-copyIcon"
              sx={{
                fontSize: 16,
                flexShrink: 0,
                color: theme.gray[400],
                mt: multiline ? '3px' : 0,
                transition: `color 0.15s ${theme.easing.toss}`,
              }}
            />
          </Box>
        </Box>
      ) : (
        <Typography variant="body2" component="div" sx={{ flex: 1, ...valueSx }}>
          {value}
        </Typography>
      )}
    </Box>
  );
};

export default InfoRow;
