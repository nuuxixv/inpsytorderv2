import React from 'react';
import { Box, Typography } from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';

const steps = [
  { label: '상품 선택' },
  { label: '주문자 정보' },
  { label: '주문 확인' },
];

const OrderStepIndicator = ({ activeStep }) => {
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
                  bgcolor: isCompleted
                    ? 'primary.main'
                    : isActive
                    ? 'primary.main'
                    : 'grey.200',
                  color: isCompleted || isActive ? 'white' : 'text.disabled',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  transition: 'all 0.3s cubic-bezier(0.33, 1, 0.68, 1)',
                }}
              >
                {isCompleted ? (
                  <CheckIcon sx={{ fontSize: 14 }} />
                ) : (
                  index + 1
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
                  fontSize: '0.8125rem',
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
                  bgcolor: index < activeStep ? 'primary.main' : 'grey.200',
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
