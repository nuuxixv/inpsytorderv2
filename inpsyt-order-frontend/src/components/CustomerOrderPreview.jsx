import React, { useMemo, useRef, useState } from 'react';
import {
  Box, Typography, Button, TextField, Chip, Alert, Card, CardContent, Divider,
  InputAdornment, IconButton, Stack, LinearProgress, Snackbar, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Search as SearchIcon,
  Star as StarIcon,
  FiberNew as NewIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Home as HomeIcon,
  Badge as BadgeIcon,
  Note as NoteIcon,
  Edit as EditIcon,
  ShoppingCart as CartIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Check as CheckIcon,
  LocalShipping as ShippingIcon,
} from '@mui/icons-material';
import { InfoRow, PriceBlock, ActionSlot } from './ui';

/**
 * DEV-ONLY: /preview/order
 * 고객 주문서 시안 — 모바일 393px 최적화, 어드민 셸 없이 직접 렌더.
 * 사양 시트: design-system/specs/C1_OrderPage.md
 *
 * 인라인 mock 데이터, API 호출 0, Supabase 호출 0.
 */

// ─── Mock data ───────────────────────────────────────────────
const MOCK_EVENT = {
  id: 'e-mock-001',
  name: '한국심리학회 2026 추계학술대회',
  discount_rate: 0.15,
  estimated_delivery_date: '2026-09-23',
  tags: ['심리학', '학회'],
  start_date: '2026-09-20',
  end_date: '2026-09-22',
};

const MOCK_PRODUCTS = [
  { id: 'p1', name: 'K-WAIS-IV 지능검사 프로토콜',     category: '검사', list_price: 45000, is_discountable: true,  is_popular: true,  is_new: false },
  { id: 'p2', name: 'MMPI-2 전산채점 사용권',         category: '검사', list_price: 30000, is_discountable: true,  is_popular: true,  is_new: false },
  { id: 'p3', name: 'PAI 성격평가질문지',              category: '검사', list_price: 25000, is_discountable: false, is_popular: false, is_new: true  },
  { id: 'p4', name: '심리평가의 임상적 활용',          category: '도서', list_price: 32000, is_discountable: true,  is_popular: true,  is_new: false },
  { id: 'p5', name: 'DSM-5-TR 진단 및 통계편람',       category: '도서', list_price: 65000, is_discountable: true,  is_popular: true,  is_new: false },
  { id: 'p6', name: '아동·청소년 심리치료',            category: '도서', list_price: 28000, is_discountable: true,  is_popular: false, is_new: false },
  { id: 'p7', name: 'MMPI-2 해석상담',                category: '도서', list_price: 35000, is_discountable: true,  is_popular: false, is_new: true  },
  { id: 'p8', name: '인지행동치료의 실제',             category: '도서', list_price: 27000, is_discountable: true,  is_popular: false, is_new: false },
];

const SETTINGS = { free_shipping_threshold: 30000, shipping_cost: 3000 };

// ─── Step indicator ──────────────────────────────────────────
const STEPS = [
  { label: '상품 선택' },
  { label: '주문자 정보' },
  { label: '주문 확인' },
];

const StepIndicator = ({ activeStep }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        bgcolor: 'background.paper',
        borderBottom: `1px solid ${theme.palette.divider}`,
        py: 1.5,
        minHeight: 56,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 1,
      }}
    >
      {STEPS.map((step, idx) => {
        const isDone = idx < activeStep;
        const isActive = idx === activeStep;
        const dotColor = isDone || isActive ? 'primary.main' : 'grey.200';
        const labelColor = isActive ? 'primary.main' : isDone ? 'text.primary' : 'text.disabled';
        const labelWeight = isActive ? 700 : 500;
        return (
          <React.Fragment key={step.label}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  bgcolor: dotColor,
                  color: isDone || isActive ? 'common.white' : 'text.disabled',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isDone ? (
                  <CheckIcon sx={{ fontSize: 14 }} />
                ) : (
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'inherit' }}>
                    {idx + 1}
                  </Typography>
                )}
              </Box>
              <Typography variant="caption" sx={{ fontWeight: labelWeight, color: labelColor }}>
                {step.label}
              </Typography>
            </Box>
            {idx < STEPS.length - 1 && (
              <Box
                sx={{
                  width: 32,
                  height: 2,
                  bgcolor: isDone ? 'primary.main' : 'grey.200',
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
};

// ─── Header (triple-tap onsite toggle) ───────────────────────
const Header = ({ isOnsitePurchase, eventName, onTripleTap }) => (
  <Box sx={{ pt: 3, pb: 1, px: 2, display: 'flex', alignItems: 'center' }}>
    <Box sx={{ flex: 1 }} />
    <Box onClick={onTripleTap} sx={{ userSelect: 'none', textAlign: 'center' }}>
      <Typography
        variant="subtitle2"
        sx={{
          color: isOnsitePurchase ? 'warning.main' : 'primary.main',
          fontWeight: 700,
          letterSpacing: 1,
        }}
      >
        인싸이트 · 학지사 상품 주문하기{isOnsitePurchase ? ' · 현장구매' : ''}
      </Typography>
      {eventName && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
          {eventName}
        </Typography>
      )}
    </Box>
    <Box sx={{ flex: 1 }} />
  </Box>
);

// ─── Product card ────────────────────────────────────────────
const ProductCard = ({ product, discountRate, cartQuantity, onAdd, onIncrement, onDecrement }) => {
  const theme = useTheme();
  const hasDiscount = product.is_discountable && discountRate > 0;
  const discountedPrice = hasDiscount
    ? Math.round(product.list_price * (1 - discountRate))
    : product.list_price;
  const inCart = cartQuantity > 0;

  const handleCardClick = () => {
    if (!inCart) onAdd();
  };

  return (
    <Box
      onClick={handleCardClick}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        p: 1.5,
        borderRadius: '12px',
        border: `1.5px solid ${inCart ? theme.palette.primary.main : theme.palette.divider}`,
        bgcolor: 'background.paper',
        cursor: inCart ? 'default' : 'pointer',
        transition: 'border-color 0.15s ease',
        height: '100%',
        minHeight: 156,
      }}
    >
      {/* Badges */}
      <Box sx={{ display: 'flex', gap: 0.5, mb: 0.75, flexWrap: 'wrap' }}>
        {product.category && (
          <Box
            sx={{
              height: 18,
              px: 0.75,
              borderRadius: '4px',
              bgcolor: product.category === '검사' ? alpha(theme.palette.info.main, 0.14) : theme.palette.grey[200],
              color: product.category === '검사' ? 'info.dark' : 'text.secondary',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1 }}>
              {product.category}
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
            <StarIcon sx={{ fontSize: 11, color: theme.accent.attention }} />
            <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1, color: 'inherit' }}>인기</Typography>
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
            <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1 }}>NEW</Typography>
          </Box>
        )}
      </Box>

      {/* Name */}
      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          mb: 1,
          flex: 1,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {product.name}
      </Typography>

      {/* Price */}
      <Box sx={{ mb: 1 }}>
        {hasDiscount && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography
              variant="caption"
              sx={{ color: 'text.disabled', textDecoration: 'line-through' }}
            >
              {product.list_price.toLocaleString()}원
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: 'error.main', fontWeight: 700 }}
            >
              {Math.round(discountRate * 100)}%
            </Typography>
          </Box>
        )}
        <Typography
          variant="subtitle1"
          sx={{
            color: hasDiscount ? 'primary.main' : 'text.primary',
            letterSpacing: '-0.01em',
          }}
        >
          {discountedPrice.toLocaleString()}원
        </Typography>
      </Box>

      {/* Action */}
      <Box sx={{ height: 40 }} onClick={(e) => e.stopPropagation()}>
        {inCart ? (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: '10px',
              bgcolor: 'primary.main',
              color: 'common.white',
              px: 1,
            }}
          >
            <IconButton
              onClick={onDecrement}
              sx={{ color: 'common.white', minWidth: 32, minHeight: 32, p: 0 }}
              aria-label="수량 감소"
            >
              <Typography variant="body1" sx={{ fontWeight: 700, color: 'inherit' }}>
                {cartQuantity <= 1 ? '×' : '−'}
              </Typography>
            </IconButton>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'inherit' }}>
              {cartQuantity}
            </Typography>
            <IconButton
              onClick={onIncrement}
              sx={{ color: 'common.white', minWidth: 32, minHeight: 32, p: 0 }}
              aria-label="수량 증가"
            >
              <Typography variant="body1" sx={{ fontWeight: 700, color: 'inherit' }}>＋</Typography>
            </IconButton>
          </Box>
        ) : (
          <Button
            fullWidth
            variant="outlined"
            onClick={onAdd}
            sx={{ height: '100%', borderRadius: '10px' }}
          >
            담기
          </Button>
        )}
      </Box>
    </Box>
  );
};

// ─── Step 0: Product selection ───────────────────────────────
const ProductSelectionStep = ({ cart, onCartChange, discountRate, eventName }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('popular');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = useMemo(() => {
    const set = new Set(['검사', '도서']);
    MOCK_PRODUCTS.forEach((p) => p.category && set.add(p.category));
    return ['all', ...set];
  }, []);

  const filtered = useMemo(() => {
    let list = MOCK_PRODUCTS;
    const hasSearch = Boolean(searchTerm.trim());
    if (selectedCategory !== 'all') list = list.filter((p) => p.category === selectedCategory);
    if (!hasSearch) {
      if (viewMode === 'popular') list = list.filter((p) => p.is_popular);
      else if (viewMode === 'new') list = list.filter((p) => p.is_new);
    } else {
      list = list.filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return [...list].sort((a, b) => {
      const popDiff = (b.is_popular ? 1 : 0) - (a.is_popular ? 1 : 0);
      if (popDiff !== 0) return popDiff;
      return a.name.localeCompare(b.name);
    });
  }, [searchTerm, viewMode, selectedCategory]);

  const getQty = (id) => cart.find((p) => p.id === id)?.quantity || 0;

  const handleAdd = (product) => {
    if (cart.some((p) => p.id === product.id)) return;
    onCartChange([...cart, { ...product, quantity: 1 }]);
  };

  const handleInc = (id) => {
    onCartChange(cart.map((p) => (p.id === id ? { ...p, quantity: p.quantity + 1 } : p)));
  };

  const handleDec = (id) => {
    const item = cart.find((p) => p.id === id);
    if (item && item.quantity <= 1) onCartChange(cart.filter((p) => p.id !== id));
    else onCartChange(cart.map((p) => (p.id === id ? { ...p, quantity: p.quantity - 1 } : p)));
  };

  const viewModes = [
    { key: 'all', label: '전체' },
    { key: 'popular', label: '인기', icon: <StarIcon sx={{ fontSize: 14 }} /> },
    { key: 'new', label: '신규출시', icon: <NewIcon sx={{ fontSize: 14 }} /> },
  ];

  return (
    <Box sx={{ px: 2, pb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 2.5, pt: 2, textAlign: 'center' }}>
        <Typography variant="h3" sx={{ mb: 0.5 }}>
          상품을 선택해주세요
        </Typography>
        {eventName && (
          <Typography variant="body2" color="text.secondary">
            {eventName}
            {discountRate > 0 && ` · ${Math.round(discountRate * 100)}% 할인 적용`}
          </Typography>
        )}
      </Box>

      {/* Search */}
      <TextField
        fullWidth
        placeholder="상품명으로 검색"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: 'text.disabled' }} />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
      />

      {/* View mode chips */}
      <Box
        sx={{
          mb: 1.5,
          display: 'flex',
          gap: 0.75,
          overflowX: 'auto',
          '&::-webkit-scrollbar': { display: 'none' },
          scrollbarWidth: 'none',
        }}
      >
        {viewModes.map((mode) => (
          <Chip
            key={mode.key}
            label={mode.label}
            icon={mode.icon || undefined}
            variant={viewMode === mode.key ? 'filled' : 'outlined'}
            color={viewMode === mode.key ? 'primary' : 'default'}
            onClick={() => setViewMode(mode.key)}
            sx={{
              flexShrink: 0,
              fontWeight: viewMode === mode.key ? 700 : 500,
              borderRadius: '10px',
            }}
          />
        ))}
      </Box>

      {/* Category chips */}
      <Box
        sx={{
          mb: 2,
          display: 'flex',
          gap: 0.75,
          overflowX: 'auto',
          pb: 1,
          '&::-webkit-scrollbar': { display: 'none' },
          scrollbarWidth: 'none',
        }}
      >
        {categories.map((cat) => (
          <Chip
            key={cat}
            label={cat === 'all' ? '전체' : cat}
            variant={selectedCategory === cat ? 'filled' : 'outlined'}
            color={selectedCategory === cat ? 'secondary' : 'default'}
            onClick={() => setSelectedCategory(cat)}
            sx={{
              flexShrink: 0,
              fontWeight: selectedCategory === cat ? 700 : 500,
              borderRadius: '10px',
            }}
          />
        ))}
      </Box>

      {/* Grid */}
      {filtered.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 0.5 }}>
            검색 결과가 없습니다
          </Typography>
          <Typography variant="body2" color="text.disabled">
            다른 검색어를 시도해보세요
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
            gap: 1.5,
          }}
        >
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              discountRate={discountRate}
              cartQuantity={getQty(product.id)}
              onAdd={() => handleAdd(product)}
              onIncrement={() => handleInc(product.id)}
              onDecrement={() => handleDec(product.id)}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

// ─── Step 1: Customer info ───────────────────────────────────
const inputSx = {
  '& .MuiOutlinedInput-root': {
    minHeight: 52,
  },
};

const CustomerInfoStep = ({ customerInfo, setCustomerInfo, hasOnlineCode, isOnsitePurchase }) => {
  const handlePhoneChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    let formatted = raw;
    if (raw.length > 3 && raw.length <= 7) formatted = `${raw.slice(0, 3)}-${raw.slice(3)}`;
    else if (raw.length > 7) formatted = `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
    setCustomerInfo((prev) => ({ ...prev, phone: formatted }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCustomerInfo((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <Box sx={{ px: 2, pb: 4 }}>
      <Box sx={{ mb: 3, pt: 2 }}>
        <Typography variant="h3" sx={{ mb: 0.5 }}>
          주문자 정보를 입력해주세요
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {isOnsitePurchase ? '주문자 확인을 위한 정보입니다' : '배송에 필요한 정보입니다'}
        </Typography>
      </Box>

      {/* Required */}
      <Typography
        variant="overline"
        sx={{ color: 'text.secondary', fontWeight: 700, mb: 1.5, display: 'block' }}
      >
        필수 정보
      </Typography>
      <Stack spacing={2} sx={{ mb: 3 }}>
        <TextField
          required
          fullWidth
          name="name"
          label="성함"
          value={customerInfo.name}
          onChange={handleChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PersonIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
          sx={inputSx}
        />
        <TextField
          required
          fullWidth
          name="phone"
          label="연락처"
          placeholder="010-1234-5678"
          value={customerInfo.phone}
          onChange={handlePhoneChange}
          inputProps={{ maxLength: 13 }}
          helperText="숫자만 입력해주세요."
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PhoneIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
          sx={inputSx}
        />
        {hasOnlineCode && (
          <TextField
            fullWidth
            name="inpsytId"
            label="인싸이트 ID (온라인코드 구매 시 필수)"
            value={customerInfo.inpsytId}
            onChange={handleChange}
            placeholder="인싸이트 홈페이지 ID를 입력해주세요"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <BadgeIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
            sx={inputSx}
          />
        )}
      </Stack>

      {/* Shipping — 현장구매 시 숨김 */}
      {!isOnsitePurchase && (
        <>
          <Divider sx={{ my: 3 }} />
          <Typography
            variant="overline"
            sx={{ color: 'text.secondary', fontWeight: 700, mb: 1.5, display: 'block' }}
          >
            배송지 정보
          </Typography>
          <Stack spacing={2} sx={{ mb: 3 }}>
            <TextField
              fullWidth
              name="address"
              label="주소 (도로명)"
              placeholder="우편번호 검색 시 자동 입력"
              value={customerInfo.address}
              onChange={handleChange}
              InputProps={{
                readOnly: true,
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <Button size="small" variant="outlined" sx={{ minWidth: 'auto', px: 1.5, py: 0.5 }}>
                      검색
                    </Button>
                  </InputAdornment>
                ),
              }}
              sx={inputSx}
            />
            <TextField
              fullWidth
              name="detailAddress"
              label="상세주소"
              value={customerInfo.detailAddress}
              onChange={handleChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <HomeIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={inputSx}
            />
            <TextField
              fullWidth
              name="postcode"
              label="우편번호"
              value={customerInfo.postcode}
              InputProps={{ readOnly: true }}
              sx={inputSx}
            />
          </Stack>
        </>
      )}

      {/* Optional */}
      <Divider sx={{ my: 3 }} />
      <Typography
        variant="overline"
        sx={{ color: 'text.secondary', fontWeight: 700, mb: 1.5, display: 'block' }}
      >
        선택사항
      </Typography>
      <TextField
        fullWidth
        multiline
        rows={3}
        name="request"
        label="요청하실 내용"
        value={customerInfo.request}
        onChange={handleChange}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
              <NoteIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
            </InputAdornment>
          ),
        }}
      />
    </Box>
  );
};

// ─── Step 2: Review ──────────────────────────────────────────
const OrderReviewStep = ({ cart, customerInfo, discountRate, isOnsitePurchase, onGoToStep }) => {
  const theme = useTheme();
  const validItems = cart.filter((i) => i.id);

  const getItemPrice = (item) =>
    item.is_discountable && discountRate > 0
      ? Math.round(item.list_price * (1 - discountRate))
      : item.list_price;

  const totalOriginalPrice = validItems.reduce((sum, i) => sum + i.list_price * i.quantity, 0);
  const totalDiscount = validItems.reduce(
    (sum, i) => sum + (getItemPrice(i) - i.list_price) * i.quantity * -1,
    0,
  );
  const itemTotal = totalOriginalPrice - totalDiscount;
  const shippingFee = isOnsitePurchase
    ? 0
    : totalOriginalPrice >= SETTINGS.free_shipping_threshold
    ? 0
    : SETTINGS.shipping_cost;
  const finalPayment = itemTotal + shippingFee;

  const remainingForFree = SETTINGS.free_shipping_threshold - totalOriginalPrice;
  const freeShippingProgress = Math.min((totalOriginalPrice / SETTINGS.free_shipping_threshold) * 100, 100);

  const fullAddress = [customerInfo.postcode, customerInfo.address, customerInfo.detailAddress]
    .filter(Boolean)
    .join(' ');

  return (
    <Box sx={{ px: 2, pb: 4 }}>
      <Box sx={{ mb: 3, pt: 2 }}>
        <Typography variant="h3" sx={{ mb: 0.5 }}>
          주문 내용을 확인해주세요
        </Typography>
        <Typography variant="body2" color="text.secondary">
          모든 정보가 올바른지 확인 후 제출해주세요
        </Typography>
      </Box>

      {/* Order items */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              주문 상품 · {validItems.length}건
            </Typography>
            <Button
              size="small"
              startIcon={<EditIcon sx={{ fontSize: 14 }} />}
              onClick={() => onGoToStep(0)}
              sx={{ color: 'text.secondary' }}
            >
              수정
            </Button>
          </Box>
          {validItems.map((item, idx) => {
            const unit = getItemPrice(item);
            const total = unit * item.quantity;
            return (
              <Box key={item.id}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', py: 1.5 }}>
                  <Box sx={{ flex: 1, pr: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.25, lineHeight: 1.4 }}>
                      {item.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {unit.toLocaleString()}원 x {item.quantity}개
                    </Typography>
                  </Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {total.toLocaleString()}원
                  </Typography>
                </Box>
                {idx < validItems.length - 1 && <Divider />}
              </Box>
            );
          })}
        </CardContent>
      </Card>

      {/* Customer info */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              주문자 정보
            </Typography>
            <Button
              size="small"
              startIcon={<EditIcon sx={{ fontSize: 14 }} />}
              onClick={() => onGoToStep(1)}
              sx={{ color: 'text.secondary' }}
            >
              수정
            </Button>
          </Box>
          <InfoRow label="성함" value={customerInfo.name} />
          <InfoRow label="연락처" value={customerInfo.phone} />
          {!isOnsitePurchase && fullAddress && <InfoRow label="배송지" value={fullAddress} />}
          {customerInfo.inpsytId && <InfoRow label="인싸이트 ID" value={customerInfo.inpsytId} />}
          {customerInfo.request && <InfoRow label="요청사항" value={customerInfo.request} />}
        </CardContent>
      </Card>

      {/* Cost summary */}
      <Card>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            결제 정보
          </Typography>
          {!isOnsitePurchase && (
            <Box
              sx={{
                bgcolor: theme.palette.grey[50],
                borderRadius: '12px',
                p: 1.5,
                mb: 2,
              }}
            >
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 0.75 }}>
                {shippingFee === 0
                  ? '무료배송 혜택이 적용되었습니다!'
                  : `무료배송까지 ${remainingForFree.toLocaleString()}원 남았습니다.`}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={freeShippingProgress}
                sx={{ height: 4, borderRadius: 2 }}
              />
            </Box>
          )}
          <PriceBlock
            rows={[
              { label: '총 상품 금액', value: totalOriginalPrice },
              ...(totalDiscount > 0
                ? [{ label: '할인 금액', value: `-${totalDiscount.toLocaleString()}원` }]
                : []),
              ...(!isOnsitePurchase
                ? [{
                    label: '배송비',
                    value: shippingFee === 0 ? '무료' : `${shippingFee.toLocaleString()}원`,
                    muted: shippingFee === 0,
                  }]
                : []),
            ]}
            totalLabel="최종 결제 금액"
            totalValue={finalPayment}
            totalColor={theme.palette.primary.main}
          />
        </CardContent>
      </Card>

      {/* Estimated delivery */}
      {!isOnsitePurchase && MOCK_EVENT.estimated_delivery_date && (
        <Box
          sx={{
            mt: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.06),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
            borderRadius: '12px',
            p: 2,
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.75,
          }}
        >
          <ShippingIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600 }}>
            지금 주문하면 9월 23일 (수) 도착 예정이에요.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

// ─── Floating bottom bar ─────────────────────────────────────
const FloatingBottomBar = ({
  activeStep, cart, totalOriginalPrice, isOnsitePurchase,
  onNext, onBack, onSubmit, onCartClick, isSubmittable,
}) => {
  const theme = useTheme();
  const remaining = SETTINGS.free_shipping_threshold - totalOriginalPrice;
  const reached = remaining <= 0;
  const progress = Math.min((totalOriginalPrice / SETTINGS.free_shipping_threshold) * 100, 100);

  const showFreeShippingHint = activeStep === 0 && !isOnsitePurchase && cart.length > 0;
  const ctaLabel = activeStep === 0 ? '주문서 작성하기' : activeStep === 1 ? '다음' : '주문 제출하기';
  const nextDisabled =
    (activeStep === 0 && cart.length === 0) ||
    (activeStep >= 1 && !isSubmittable);

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: `max(0px, calc((100vw - 600px) / 2))`,
        right: `max(0px, calc((100vw - 600px) / 2))`,
        zIndex: 1200,
        bgcolor: 'background.paper',
        borderTop: `1px solid ${theme.palette.divider}`,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
        pb: 'max(12px, env(safe-area-inset-bottom))',
        pt: 1.25,
        px: 2,
      }}
    >
      {showFreeShippingHint && (
        <Box sx={{ mb: 1.25 }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              color: reached ? 'primary.main' : 'text.secondary',
              display: 'block',
              mb: 0.5,
            }}
          >
            {reached
              ? '배송비가 무료로 적용됐어요!'
              : `무료배송까지 ${remaining.toLocaleString()}원 남았어요.`}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 4, borderRadius: 2 }}
          />
        </Box>
      )}
      {/* 좌측: 장바구니/뒤로 IconButton — 우측: CTA. ActionSlot 의미 단위 */}
      <ActionSlot
        wrap={false}
        leading={
          activeStep === 0 ? (
            <IconButton
              onClick={onCartClick}
              disabled={cart.length === 0}
              sx={{ minWidth: 48, minHeight: 52, color: cart.length > 0 ? 'primary.main' : 'text.disabled' }}
              aria-label="장바구니"
            >
              <Box sx={{ position: 'relative' }}>
                <CartIcon sx={{ fontSize: 26 }} />
                {cart.length > 0 && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -4,
                      right: -8,
                      minWidth: 18,
                      height: 18,
                      px: 0.5,
                      borderRadius: 9,
                      bgcolor: 'primary.main',
                      color: 'common.white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'inherit', lineHeight: 1 }}>
                      {cart.length}
                    </Typography>
                  </Box>
                )}
              </Box>
            </IconButton>
          ) : (
            <IconButton
              onClick={onBack}
              sx={{ minWidth: 48, minHeight: 52, color: 'text.secondary' }}
              aria-label="이전 단계"
            >
              <ArrowBackIcon />
            </IconButton>
          )
        }
        sx={{
          // CTA 버튼이 남은 공간을 모두 차지하도록 children 박스 flex 확장
          '& > :last-child': { flex: 1 },
        }}
      >
        <Button
          variant="contained"
          size="large"
          fullWidth
          disabled={nextDisabled}
          onClick={activeStep === 2 ? onSubmit : onNext}
          endIcon={activeStep < 2 ? <ArrowForwardIcon /> : null}
          sx={{ minHeight: 52 }}
        >
          {ctaLabel}
        </Button>
      </ActionSlot>
    </Box>
  );
};

// ─── Main ────────────────────────────────────────────────────
const CustomerOrderPreview = () => {
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);
  const [cart, setCart] = useState([]);
  const [customerInfo, setCustomerInfo] = useState({
    name: '', phone: '', postcode: '',
    address: '', detailAddress: '', inpsytId: '', request: '',
  });
  const [isOnsitePurchase, setIsOnsitePurchase] = useState(false);
  const [onsiteSnackbar, setOnsiteSnackbar] = useState(false);
  const [error, setError] = useState(null);

  const tapCountRef = useRef(0);
  const tapTimerRef = useRef(null);

  const validCartItems = cart.filter((i) => i.id);
  const hasCartItems = validCartItems.length > 0;
  const totalOriginalPrice = validCartItems.reduce(
    (sum, i) => sum + i.list_price * i.quantity,
    0,
  );
  const hasOnlineCode = validCartItems.some(
    (i) => i.category === '온라인코드' || (i.name && i.name.includes('온라인')),
  );
  const isCustomerInfoValid = customerInfo.name && customerInfo.phone;
  const isSubmittable = isCustomerInfoValid && hasCartItems;

  const handleTripleTap = () => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 600);
    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      if (activeStep < 2) {
        setIsOnsitePurchase((p) => !p);
        setOnsiteSnackbar(true);
      }
    }
  };

  const handleNext = () => {
    if (activeStep === 0) {
      if (!hasCartItems) {
        setError('상품을 1개 이상 담아주세요.');
        return;
      }
      setError(null);
      setActiveStep(1);
      window.scrollTo(0, 0);
    } else if (activeStep === 1) {
      if (!isCustomerInfoValid) {
        setError('필수 정보(성함, 연락처)를 입력해주세요.');
        return;
      }
      setError(null);
      setActiveStep(2);
      window.scrollTo(0, 0);
    }
  };

  const handleBack = () => {
    setError(null);
    setActiveStep((p) => Math.max(p - 1, 0));
    window.scrollTo(0, 0);
  };

  const handleGoToStep = (step) => {
    setError(null);
    setActiveStep(step);
    window.scrollTo(0, 0);
  };

  const handleSubmit = () => {
    // 시안 — 실제 제출 없음
    setError(null);
    alert('시안 화면 — 실제 제출은 일어나지 않습니다.');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: activeStep < 2 ? 'background.paper' : theme.gray[50],
        maxWidth: 600,
        mx: 'auto',
        transition: 'background-color 0.3s ease',
      }}
    >
      <Header
        isOnsitePurchase={isOnsitePurchase}
        eventName={MOCK_EVENT.name}
        onTripleTap={handleTripleTap}
      />

      {/* Step 0에서는 인디케이터 숨김 — 사양 line 39 */}
      {activeStep > 0 && <StepIndicator activeStep={activeStep} />}

      {error && (
        <Alert
          severity="error"
          onClose={() => setError(null)}
          sx={{ mx: 2, mt: 2, borderRadius: '12px' }}
        >
          {error}
        </Alert>
      )}

      <Box sx={{ flex: 1, overflowY: 'auto', pb: '120px' }}>
        {activeStep === 0 && (
          <ProductSelectionStep
            cart={cart}
            onCartChange={setCart}
            discountRate={MOCK_EVENT.discount_rate}
            eventName={MOCK_EVENT.name}
          />
        )}
        {activeStep === 1 && (
          <CustomerInfoStep
            customerInfo={customerInfo}
            setCustomerInfo={setCustomerInfo}
            hasOnlineCode={hasOnlineCode}
            isOnsitePurchase={isOnsitePurchase}
          />
        )}
        {activeStep === 2 && (
          <OrderReviewStep
            cart={cart}
            customerInfo={customerInfo}
            discountRate={MOCK_EVENT.discount_rate}
            isOnsitePurchase={isOnsitePurchase}
            onGoToStep={handleGoToStep}
          />
        )}
      </Box>

      <FloatingBottomBar
        activeStep={activeStep}
        cart={cart}
        totalOriginalPrice={totalOriginalPrice}
        isOnsitePurchase={isOnsitePurchase}
        onNext={handleNext}
        onBack={handleBack}
        onSubmit={handleSubmit}
        onCartClick={() => {}}
        isSubmittable={isSubmittable}
      />

      <Snackbar
        open={onsiteSnackbar}
        autoHideDuration={2000}
        onClose={() => setOnsiteSnackbar(false)}
        message={isOnsitePurchase ? '현장구매 모드로 전환됐어요' : '일반 배송 모드로 전환됐어요'}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      />
    </Box>
  );
};

export default CustomerOrderPreview;
