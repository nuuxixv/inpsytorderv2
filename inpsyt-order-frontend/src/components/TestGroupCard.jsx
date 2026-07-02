import React from 'react';
import {
  Box, Typography, Card, CardContent, Collapse, Divider, Button, IconButton, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Add as AddIcon, Remove as RemoveIcon, Delete as DeleteIcon, Star as StarIcon,
  ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { BadgeBox } from './ProductCard';

// 옵션 행 우측 액션 — 담기 outlined / 수량 스테퍼(primary bg).
// ProductCard 스테퍼와 시각 동일(더 좁은 폭). e.stopPropagation으로 행 클릭과 분리.
const OptionAction = ({ theme, quantity, onAdd, onIncrement, onDecrement }) => {
  if (quantity <= 0) {
    return (
      <Button
        variant="outlined"
        size="small"
        onClick={(e) => { e.stopPropagation(); onAdd(); }}
        sx={{ height: 40, minWidth: 64, fontWeight: 700, '&:active': { transform: 'scale(0.97)' } }}
      >
        담기
      </Button>
    );
  }
  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        bgcolor: 'primary.main', borderRadius: `${theme.radii.sm}px`, height: 40, px: 0.5,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <IconButton
        size="small"
        onClick={onDecrement}
        sx={{
          color: 'common.white', width: 32, height: 32, minWidth: 32, minHeight: 32,
          '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
        }}
        aria-label="수량 감소"
      >
        {quantity === 1 ? <DeleteIcon sx={{ fontSize: 18 }} /> : <RemoveIcon sx={{ fontSize: 18 }} />}
      </IconButton>
      <Typography variant="body2" sx={{ fontWeight: 700, color: 'common.white', minWidth: 28, textAlign: 'center' }}>
        {quantity}
      </Typography>
      <IconButton
        size="small"
        onClick={onIncrement}
        sx={{
          color: 'common.white', width: 32, height: 32, minWidth: 32, minHeight: 32,
          '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
        }}
        aria-label="수량 증가"
      >
        <AddIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Box>
  );
};

// 가격 표기 — ProductCard 할인 로직과 동일 규칙. size='opt'(펼친 행) / 'single'(옵션1개 카드).
const OptionPrice = ({ product, discountRate, variant = 'opt' }) => {
  const isDiscounted = product.is_discountable && discountRate > 0;
  const discountedPrice = isDiscounted
    ? Math.round(product.list_price * (1 - discountRate))
    : product.list_price;
  const finalVariant = variant === 'single' ? 'subtitle1' : 'subtitle1';
  const finalSize = variant === 'single' ? '1.125rem' : undefined;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mt: 0.75 }}>
      {isDiscounted && (
        <>
          <Typography variant="caption" sx={{ textDecoration: 'line-through', color: 'text.disabled' }}>
            {product.list_price.toLocaleString()}원
          </Typography>
          <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 700 }}>
            {`${(discountRate * 100).toFixed(0)}%`}
          </Typography>
        </>
      )}
      <Typography
        variant={finalVariant}
        sx={{
          fontWeight: 800,
          fontSize: finalSize,
          color: isDiscounted ? 'primary.main' : 'text.primary',
          lineHeight: 1.2,
        }}
      >
        {discountedPrice.toLocaleString()}원
      </Typography>
    </Box>
  );
};

// 옵션 말머리 라벨 — 소프트 회색 틴트(gray[100]) 인라인 라벨. is_common이면 "공용".
// 대괄호 금지·별색 금지(사양 §발견 12). 말머리 없으면 미렌더.
const OptionLabel = ({ product, theme }) => {
  const text = product.is_common ? '공용' : product.option_label;
  if (!text) return null;
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block', mb: 0.5, px: 0.75, py: '2px',
        bgcolor: theme.gray[100], color: 'text.secondary',
        borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, lineHeight: 1.4,
      }}
    >
      {text}
    </Box>
  );
};

// 옵션 세로 리스트 행 — 좌: 말머리·형태명·가격 / 우: 액션. 행 자체 클릭 무반응.
const OptionRow = ({ product, discountRate, theme, quantity, onAdd, onIncrement, onDecrement }) => (
  <Box sx={{ px: 2, py: 1.75, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <OptionLabel product={product} theme={theme} />
      <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.35, color: 'text.primary' }}>
        {product.option_name || product.name}
      </Typography>
      <OptionPrice product={product} discountRate={discountRate} />
    </Box>
    <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
      <OptionAction
        theme={theme}
        quantity={quantity}
        onAdd={onAdd}
        onIncrement={onIncrement}
        onDecrement={onDecrement}
      />
    </Box>
  </Box>
);

// 검사군 카드(C1 §검사군 카드) — test_group_id 2뎁스 진열.
// group = { id, abbr, name, options: [product...] } (옵션은 is_active=true·sort_order 정렬 완료 상태).
// 3상태: 접힘 / 펼침(옵션 세로 리스트) / 옵션1개(펼침 없이 즉시 담기).
const TestGroupCard = ({
  group, discountRate = 0, expanded = false, onToggle,
  getCartQuantity, onAdd, onIncrement, onDecrement,
}) => {
  const theme = useTheme();
  const { abbr, name, options } = group;
  const isSingle = options.length === 1;

  const cartCount = options.reduce((n, p) => n + (getCartQuantity(p.id) > 0 ? 1 : 0), 0);
  const hasCart = cartCount > 0;
  const hasPopular = options.some(p => p.is_popular);
  const hasNew = options.some(p => p.is_new);

  const badges = (
    <Box sx={{ display: 'flex', gap: 0.5, mb: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
      <BadgeBox bg={alpha(theme.palette.info.main, 0.14)} color={theme.palette.info.dark}>
        <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1, color: 'inherit' }}>검사</Typography>
      </BadgeBox>
      {hasPopular && (
        <BadgeBox bg={alpha(theme.accent.attention, 0.14)} color={theme.accent.attention}>
          <StarIcon sx={{ fontSize: 11 }} />
          <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1, color: 'inherit' }}>인기</Typography>
        </BadgeBox>
      )}
      {hasNew && (
        <BadgeBox bg={alpha(theme.palette.error.main, 0.12)} color={theme.palette.error.main}>
          <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1, color: 'inherit' }}>NEW</Typography>
        </BadgeBox>
      )}
      {hasCart && (
        <BadgeBox bg={alpha(theme.palette.primary.main, 0.10)} color={theme.palette.primary.main}>
          <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1, color: 'inherit' }}>{`담음 ${cartCount}`}</Typography>
        </BadgeBox>
      )}
    </Box>
  );

  const headBody = (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      {badges}
      {abbr && (
        <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, color: 'text.secondary', mb: 0.25 }}>
          {abbr}
        </Typography>
      )}
      <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
        {name}
      </Typography>
      {isSingle ? (
        <OptionPrice product={options[0]} discountRate={discountRate} variant="single" />
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {`옵션 ${options.length}개`}
        </Typography>
      )}
    </Box>
  );

  // 옵션 1개 — 펼침 신호 없이 카드 우측 담기/스테퍼 즉시 노출.
  if (isSingle) {
    const single = options[0];
    return (
      <Card
        sx={{
          border: '1.5px solid',
          borderColor: hasCart ? 'primary.main' : 'divider',
          boxShadow: 'none',
          transition: `border-color 0.2s ${theme.easing.toss}`,
          mb: 1.5,
        }}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {headBody}
          <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <OptionAction
              theme={theme}
              quantity={getCartQuantity(single.id)}
              onAdd={() => onAdd(single)}
              onIncrement={() => onIncrement(single.id)}
              onDecrement={() => onDecrement(single.id)}
            />
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        border: '1.5px solid',
        borderColor: hasCart ? 'primary.main' : 'divider',
        boxShadow: 'none',
        transition: `border-color 0.2s ${theme.easing.toss}`,
        mb: 1.5,
        overflow: 'hidden',
      }}
    >
      <CardContent
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); }
        }}
        sx={{
          p: 2, '&:last-child': { pb: 2 },
          display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer',
          '&:focus-visible': { outline: 'none', boxShadow: theme.customShadows.focus },
        }}
      >
        {headBody}
        <Box sx={{ flexShrink: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled' }}>
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </Box>
      </CardContent>

      <Collapse in={expanded} timeout={200} easing={theme.easing.toss} unmountOnExit>
        <Divider />
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: 320, overflowY: 'auto' }}>
          {options.map((opt, i) => (
            <Box key={opt.id}>
              {i > 0 && <Divider sx={{ borderColor: theme.gray[100] }} />}
              <OptionRow
                product={opt}
                discountRate={discountRate}
                theme={theme}
                quantity={getCartQuantity(opt.id)}
                onAdd={() => onAdd(opt)}
                onIncrement={() => onIncrement(opt.id)}
                onDecrement={() => onDecrement(opt.id)}
              />
            </Box>
          ))}
        </Box>
      </Collapse>
    </Card>
  );
};

export default TestGroupCard;
