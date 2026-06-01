import React from 'react';
import { Box, Typography, Card, CardContent, Button, IconButton, Chip, useTheme } from '@mui/material';
import { Add as AddIcon, Remove as RemoveIcon, Delete as DeleteIcon } from '@mui/icons-material';

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
        {/* Category / popular / new badges */}
        <Box sx={{ display: 'flex', gap: 0.5, mb: 0.75, alignItems: 'center' }}>
          {(product.category === '검사' || product.category === '도서') && (
            <Chip
              label={product.category}
              size="small"
              sx={{
                height: 18,
                bgcolor: product.category === '검사' ? 'info.main' : theme.gray[400],
                color: 'common.white',
                '& .MuiChip-label': { px: 0.75, fontWeight: 700 },
              }}
            />
          )}
          {product.is_popular && (
            <Chip
              label="★"
              size="small"
              sx={{
                height: 18,
                bgcolor: theme.accent.attention,
                color: 'common.white',
                '& .MuiChip-label': { px: 0.75, fontWeight: 800 },
              }}
            />
          )}
          {product.is_new && (
            <Chip
              label="NEW"
              size="small"
              sx={{
                height: 18,
                bgcolor: 'error.main',
                color: 'common.white',
                '& .MuiChip-label': { px: 0.75, fontWeight: 800 },
              }}
            />
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
              borderColor: 'primary.main',
              color: 'primary.main',
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
