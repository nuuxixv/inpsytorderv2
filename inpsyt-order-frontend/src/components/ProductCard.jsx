import React from 'react';
import { Box, Typography, Card, CardContent, Button, IconButton, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Add as AddIcon, Remove as RemoveIcon, Delete as DeleteIcon, Star as StarIcon } from '@mui/icons-material';

// 사양 §Step 0 — 상품 카드.
// - 카테고리 / 인기 / 신규 배지 (조건부)
// - 할인 시 원가 line-through + % 빨강 텍스트(칩 아님, /preview 목업 정합)
// - 카트 없으면 '담기' outlined, 있으면 수량 스테퍼
const ProductCard = ({ product, discountRate = 0, cartQuantity = 0, onAdd, onIncrement, onDecrement }) => {
  const theme = useTheme();
  const isInCart = cartQuantity > 0;
  const isDiscounted = product.is_discountable && discountRate > 0;
  const discountedPrice = isDiscounted
    ? Math.round(product.list_price * (1 - discountRate))
    : product.list_price;
  // 도구는 검사 하위로 본다 — 배지·필터 모두 '검사'로 표기
  const displayCategory = product.category === '도구' ? '검사' : product.category;

  return (
    <Card
      sx={{
        border: '1.5px solid',
        borderColor: isInCart ? 'primary.main' : 'divider',
        boxShadow: 'none',
        transition: `border-color 0.2s ${theme.easing.toss}`,
        cursor: !isInCart ? 'pointer' : 'default',
        '&:active': !isInCart ? { transform: 'scale(0.97)' } : {},
        overflow: 'visible',
        height: '100%',
        width: '100%',
      }}
      onClick={!isInCart ? onAdd : undefined}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Category / popular / new badges — 소프트 틴트(목업 정합). 솔리드 칩 폐기 */}
        <Box sx={{ display: 'flex', gap: 0.5, mb: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
          {displayCategory && (
            <Box
              sx={{
                height: 18,
                px: 0.75,
                borderRadius: '4px',
                bgcolor: displayCategory === '검사' ? alpha(theme.palette.info.main, 0.14) : theme.gray[200],
                color: displayCategory === '검사' ? 'info.dark' : 'text.secondary',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1 }}>
                {displayCategory}
              </Typography>
            </Box>
          )}
          {product.is_popular && (
            <Box
              sx={{
                height: 18,
                px: 0.75,
                borderRadius: '4px',
                bgcolor: alpha(theme.accent.attention, 0.14),
                color: theme.accent.attention,
                display: 'flex',
                alignItems: 'center',
                gap: 0.25,
              }}
            >
              <StarIcon sx={{ fontSize: 11 }} />
              <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1, color: 'inherit' }}>
                인기
              </Typography>
            </Box>
          )}
          {product.is_new && (
            <Box
              sx={{
                height: 18,
                px: 0.75,
                borderRadius: '4px',
                bgcolor: alpha(theme.palette.error.main, 0.12),
                color: 'error.main',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1 }}>
                NEW
              </Typography>
            </Box>
          )}
        </Box>

        {/* Product name — 02 §타이포 약속 2: 13px 인라인 → body2(14)로 흡수 */}
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, mb: 1.5, lineHeight: 1.3 }}
        >
          {product.name}
        </Typography>

        {/* Price section */}
        <Box sx={{ mb: 1.5, mt: 'auto' }}>
          {isDiscounted && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
              <Typography
                variant="caption"
                sx={{
                  textDecoration: 'line-through',
                  color: 'text.disabled',
                }}
              >
                {product.list_price.toLocaleString()}원
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'error.main', fontWeight: 700 }}
              >
                {`${(discountRate * 100).toFixed(0)}%`}
              </Typography>
            </Box>
          )}
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 800,
              color: isDiscounted ? 'primary.main' : 'text.primary',
              lineHeight: 1.2,
            }}
          >
            {discountedPrice.toLocaleString()}원
          </Typography>
        </Box>

        {/* Action: Add button or Quantity stepper */}
        {!isInCart ? (
          <Button
            variant="outlined"
            fullWidth
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            sx={{
              height: 40,
              fontWeight: 700,
              '&:active': { transform: 'scale(0.97)' },
            }}
          >
            담기
          </Button>
        ) : (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              bgcolor: 'primary.main',
              borderRadius: `${theme.radii.sm}px`,
              height: 40,
              px: 0.5,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <IconButton
              size="small"
              onClick={onDecrement}
              sx={{
                color: 'common.white',
                width: 32,
                height: 32,
                minWidth: 32,
                minHeight: 32,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
              }}
              aria-label="수량 감소"
            >
              {cartQuantity === 1 ? (
                <DeleteIcon sx={{ fontSize: 18 }} />
              ) : (
                <RemoveIcon sx={{ fontSize: 18 }} />
              )}
            </IconButton>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                color: 'common.white',
                minWidth: 28,
                textAlign: 'center',
              }}
            >
              {cartQuantity}
            </Typography>
            <IconButton
              size="small"
              onClick={onIncrement}
              sx={{
                color: 'common.white',
                width: 32,
                height: 32,
                minWidth: 32,
                minHeight: 32,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
              }}
              aria-label="수량 증가"
            >
              <AddIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductCard;
