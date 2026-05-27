import React from 'react';
import { Box, Typography, IconButton, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ContentCopy as ContentCopyIcon } from '@mui/icons-material';

/**
 * InfoRow — "라벨 + 값" 한 줄. 우측 복사 버튼 옵션.
 *
 * 합성 컴포넌트 6종 중 2번. 시안마다 따로 정의돼 있던
 * 라벨+값 패턴(FulfillmentPreview의 DataLine, CustomerOrderStatusPreview의 InfoRow 등)을
 * 하나로 모은다. 출고·주문상태 화면에서 연락처/ID/주소/요청/메모가 모두 이 한 줄로 표시된다.
 *
 * design-system 02 §타이포: 라벨은 caption, 값은 body2(small) 토큰. 인라인 사이즈 없음.
 *
 * @param {React.ReactNode} label
 * @param {React.ReactNode} value
 * @param {() => void} [onCopy] - 지정 시 우측에 복사 버튼 노출
 * @param {boolean} [mono=false] - 값을 monospace + tabular-nums로(연락처·ID·금액)
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

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: multiline ? 'flex-start' : 'center',
        gap: 1,
        py: 0.5,
        minHeight: 28,
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
      <Typography
        variant="body2"
        component="div"
        sx={{
          flex: 1,
          fontWeight: 500,
          color: muted ? 'text.secondary' : 'text.primary',
          fontFamily: mono
            ? 'ui-monospace, SFMono-Regular, Menlo, monospace'
            : undefined,
          fontFeatureSettings: mono ? '"tnum" 1' : undefined,
          wordBreak: 'break-all',
        }}
      >
        {value}
      </Typography>
      {onCopy && (
        <IconButton
          size="small"
          onClick={onCopy}
          aria-label="복사"
          sx={{
            width: 44,
            height: 44,
            flexShrink: 0,
            color: theme.gray[400],
            cursor: 'copy',
            '&:hover': {
              color: theme.palette.primary.main,
              bgcolor: alpha(theme.palette.primary.main, 0.06),
            },
          }}
        >
          <ContentCopyIcon sx={{ fontSize: 16 }} />
        </IconButton>
      )}
    </Box>
  );
};

export default InfoRow;
