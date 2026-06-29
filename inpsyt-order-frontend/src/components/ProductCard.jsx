import React, { useState } from 'react';
import { Box, Typography, Card, CardContent, Button, IconButton, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Add as AddIcon, Remove as RemoveIcon, Delete as DeleteIcon, Star as StarIcon,
} from '@mui/icons-material';
import { getProductImageUrl } from '../api/productImages';

// 카드당 표출하는 강조 배지 상한(C1 §배지 가드레일). 카테고리 배지는 이 카운트에서 제외.
const MAX_EMPHASIS_BADGES = 2;

// 상품 이미지 슬롯(C1 §카드 이미지). 1:1 정방형.
// 이미지 없으면(또는 onError) 슬롯 자체 미렌더(null) — 플레이스홀더 폐기(건우님 2026-06-29).
// 한 행사 내 이미지 유무 혼재 없음(도구=전부 있음 / 검사·도서=전부 없음). 빈 박스 0.
const ProductImageSlot = ({ product, theme }) => {
  const [failed, setFailed] = useState(false);
  const url = getProductImageUrl(product.image_filename);
  if (!url || failed) return null;

  return (
    <Box
      sx={{
        width: '100%',
        aspectRatio: '1 / 1',
        borderRadius: `${theme.radii.sm}px`,
        overflow: 'hidden',
        mb: 1,
        bgcolor: theme.gray[50],
      }}
    >
      <Box
        component="img"
        src={url}
        alt={product.name}
        loading="lazy"
        onError={() => setFailed(true)}
        sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </Box>
  );
};

// 소프트 틴트 배지 박스(C1 §배지 패턴 — 솔리드 칩·그라데이션 금지, 높이 18·radius 4).
const BadgeBox = ({ bg, color, children }) => (
  <Box
    sx={{
      height: 18,
      px: 0.75,
      borderRadius: '4px',
      bgcolor: bg,
      color,
      display: 'flex',
      alignItems: 'center',
      gap: 0.25,
    }}
  >
    {children}
  </Box>
);

// 사양 §Step 0 — 상품 카드.
// - 카테고리 / 인기 / 신규 / 동적 배지 (조건부)
// - 할인 시 원가 line-through + % 빨강 텍스트(칩 아님, /preview 목업 정합)
// - 카트 없으면 '담기' outlined, 있으면 수량 스테퍼
const ProductCard = ({ product, discountRate = 0, cartQuantity = 0, badgeMetaByName = {}, hideCategoryBadge = false, onAdd, onIncrement, onDecrement }) => {
  const theme = useTheme();
  const isInCart = cartQuantity > 0;
  const isDiscounted = product.is_discountable && discountRate > 0;
  const discountedPrice = isDiscounted
    ? Math.round(product.list_price * (1 - discountRate))
    : product.list_price;
  // 도구는 검사 하위로 본다 — 배지·필터 모두 '검사'로 표기
  // 단일 대분류 행사(hideCategoryBadge)에서는 카드 상위 카테고리 칩 숨김(전부 같은 대분류라 무의미·혼란)
  const displayCategory = hideCategoryBadge
    ? null
    : (product.category === '도구' ? '검사' : product.category);

  // 강조 배지 후보 — 인기/신규(boolean) + 동적 배지(마스터 등록된 것만).
  // C1 가드레일: priority ASC 정렬 후 상위 2개만, 초과분은 조용히 컷(+N 표기 없음).
  // 미등록 배지명(마스터에 없음)은 고객 화면에서 미표시(깨진 라벨 노출 금지).
  // boolean 배지는 기존 시각 우선순위(인기→신규) 보존 위해 동적보다 항상 앞(음수 priority).
  const emphasisBadges = [];
  if (product.is_popular) {
    emphasisBadges.push({
      key: 'popular',
      priority: -2,
      label: '인기',
      icon: <StarIcon sx={{ fontSize: 11 }} />,
      bg: alpha(theme.accent.attention, 0.14),
      color: theme.accent.attention,
    });
  }
  if (product.is_new) {
    emphasisBadges.push({
      key: 'new',
      priority: -1,
      label: 'NEW',
      bg: alpha(theme.palette.error.main, 0.12),
      color: theme.palette.error.main,
    });
  }
  (product.badges || []).forEach((name) => {
    const meta = badgeMetaByName[name];
    if (!meta) return; // 미등록 배지 — 고객 화면 미표시
    emphasisBadges.push({
      key: `dyn-${name}`,
      priority: meta.priority,
      label: name,
      bg: alpha(meta.color, 0.13),
      color: meta.color,
    });
  });
  const visibleBadges = emphasisBadges
    .sort((a, b) => a.priority - b.priority)
    .slice(0, MAX_EMPHASIS_BADGES);

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
        {/* 이미지 슬롯(1:1) — image_filename 있으면 공개 URL, 없으면/onError면 슬롯 미렌더(null) */}
        <ProductImageSlot product={product} theme={theme} />

        {/* 배지 — 소프트 틴트(목업 정합). 카테고리(분류) + 강조 배지 최대 2개(C1 가드레일) */}
        <Box sx={{ display: 'flex', gap: 0.5, mb: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
          {displayCategory && (
            <BadgeBox
              bg={displayCategory === '검사' ? alpha(theme.palette.info.main, 0.14) : theme.gray[200]}
              color={displayCategory === '검사' ? theme.palette.info.dark : theme.palette.text.secondary}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1, color: 'inherit' }}>
                {displayCategory}
              </Typography>
            </BadgeBox>
          )}
          {visibleBadges.map((badge) => (
            <BadgeBox key={badge.key} bg={badge.bg} color={badge.color}>
              {badge.icon}
              <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1, color: 'inherit' }}>
                {badge.label}
              </Typography>
            </BadgeBox>
          ))}
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
