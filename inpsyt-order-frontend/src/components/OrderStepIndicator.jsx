import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';

const steps = [
  { label: '상품 선택' },
  { label: '주문자 정보' },
  { label: '주문 확인' },
];

// 사양 §전 단계 공통 — 스텝 인디케이터.
// Step 0에서는 부모(OrderPage)가 렌더링 자체를 막는다(activeStep > 0).
const OrderStepIndicator = ({ activeStep }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
        px: 3,
        py: 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        minHeight: 56,
      }}
    >
      {steps.map((step, index) => {
        const isCompleted = index < activeStep;
        const isActive = index === activeStep;

        return (
          <React.Fragment key={step.label}>
            {/* Step dot + label */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
              }}
            >
              {/* Circle */}
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: isCompleted || isActive ? 'primary.main' : theme.gray[200],
                  color: isCompleted || isActive ? 'common.white' : 'text.disabled',
                  transition: `all 0.3s ${theme.easing.toss}`,
                }}
              >
                {isCompleted ? (
                  <CheckIcon sx={{ fontSize: 14 }} />
                ) : (
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'inherit', lineHeight: 1 }}>
                    {index + 1}
                  </Typography>
                )}
              </Box>

              {/* Label */}
              <Typography
                variant="caption"
                sx={{
                  fontWeight: isActive ? 700 : 500,
                  color: isActive
                    ? 'primary.main'
                    : isCompleted
                    ? 'text.primary'
                    : 'text.disabled',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                }}
              >
                {step.label}
              </Typography>
            </Box>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <Box
                sx={{
                  width: 32,
                  height: 2,
                  mx: 1,
                  borderRadius: 1,
                  bgcolor: index < activeStep ? 'primary.main' : theme.gray[200],
                  transition: 'background-color 0.3s ease',
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
};

export default OrderStepIndicator;
