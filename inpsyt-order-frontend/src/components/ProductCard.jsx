import React from 'react';
import { Box, Typography, Card, CardContent, Button, IconButton, Chip } from '@mui/material';
import { Add as AddIcon, Remove as RemoveIcon, Delete as DeleteIcon } from '@mui/icons-material';

const ProductCard = ({ product, discountRate = 0, cartQuantity = 0, onAdd, onIncrement, onDecrement }) => {
  const isInCart = cartQuantity > 0;
  const isDiscounted = product.is_discountable && discountRate > 0;
  const discountedPrice = isDiscounted
    ? Math.round(product.list_price * (1 - discountRate))
    : product.list_price;

  return (
    <Card
      sx={{
        borderRadius: '16px',
        border: '1.5px solid',
        borderColor: isInCart ? 'primary.main' : 'divider',
        boxShadow: 'none',
        transition: 'border-color 0.2s cubic-bezier(0.33, 1, 0.68, 1)',
        cursor: !isInCart ? 'pointer' : 'default',
        '&:active': !isInCart ? { transform: 'scale(0.97)' } : {},
        overflow: 'visible',
      }}
      onClick={!isInCart ? onAdd : undefined}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Product name */}
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            mb: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: '2.6em',
            lineHeight: '1.3em',
            fontSize: '0.8125rem',
            color: 'text.primary',
          }}
        >
          {product.name}
        </Typography>

        {/* Price section */}
        <Box sx={{ mb: 1.5 }}>
          {isDiscounted && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
              <Typography
                variant="caption"
                sx={{
                  textDecoration: 'line-through',
                  color: 'text.disabled',
                  fontSize: '0.6875rem',
                }}
              >
                {product.list_price.toLocaleString()}원
              </Typography>
              <Chip
                label={`${(discountRate * 100).toFixed(0)}%`}
                size="small"
                color="error"
                sx={{
                  height: 18,
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            </Box>
          )}
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 800,
              color: isDiscounted ? 'primary.main' : 'text.primary',
              fontSize: '0.9375rem',
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
              borderRadius: '10px',
              height: 40,
              fontWeight: 700,
              fontSize: '0.8125rem',
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
              borderRadius: '10px',
              height: 40,
              px: 0.5,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <IconButton
              size="small"
              onClick={onDecrement}
              sx={{
                color: 'white',
                width: 32,
                height: 32,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
              }}
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
                color: 'white',
                minWidth: 28,
                textAlign: 'center',
                fontSize: '0.875rem',
              }}
            >
              {cartQuantity}
            </Typography>
            <IconButton
              size="small"
              onClick={onIncrement}
              sx={{
                color: 'white',
                width: 32,
                height: 32,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
              }}
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
