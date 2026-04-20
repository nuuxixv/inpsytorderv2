import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  Chip,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import { Search as SearchIcon, Star as StarIcon, FiberNew as NewIcon } from '@mui/icons-material';
import { fetchAllProducts } from '../api/products';
import { useNotification } from '../hooks/useNotification';
import { matchesSearch } from '../utils/search';
import ProductCard from './ProductCard';

const PAGE_SIZE = 40;

const ProductSelectionStep = ({ cart, onCartChange, discountRate = 0, eventTags = [], eventName = '' }) => {
  const { addNotification } = useNotification();
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('popular'); // 'all' | 'popular' | 'new'
  const [selectedCategory, setSelectedCategory] = useState('all');

  const [page, setPage] = useState(1);
  const observer = useRef();

  // 1회 로드 — 학회 현장 모바일에서도 수백 개 정도면 충분히 감당 가능
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchAllProducts();
        if (!cancelled) setAllProducts(data || []);
      } catch (error) {
        if (!cancelled) addNotification(`상품 목록을 불러오지 못했습니다: ${error.message}`, 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [addNotification]);

  // 필터·검색·정렬 모두 클라이언트에서 처리
  const filteredProducts = useMemo(() => {
    let list = allProducts;
    const hasSearch = Boolean(searchTerm.trim());

    // 학회 태그 — '전체' 모드가 아닐 때만
    if (!hasSearch && viewMode !== 'all' && eventTags?.length > 0) {
      list = list.filter(p => Array.isArray(p.tags) && p.tags.some(t => eventTags.includes(t)));
    }

    // 카테고리
    if (selectedCategory !== 'all') {
      list = list.filter(p => p.category === selectedCategory);
    }

    // 모드 (검색 중에는 무시)
    if (!hasSearch) {
      if (viewMode === 'popular') list = list.filter(p => p.is_popular);
      else if (viewMode === 'new') list = list.filter(p => p.is_new);
    }

    // 검색
    if (hasSearch) {
      list = list.filter(p => matchesSearch(p.name, searchTerm));
    }

    // 정렬: 인기 우선, 이름순
    return [...list].sort((a, b) => {
      const popDiff = (b.is_popular ? 1 : 0) - (a.is_popular ? 1 : 0);
      if (popDiff !== 0) return popDiff;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [allProducts, searchTerm, viewMode, selectedCategory, eventTags]);

  // 필터 변경 시 페이지 리셋
  useEffect(() => {
    setPage(1);
  }, [searchTerm, viewMode, selectedCategory]);

  const displayedProducts = useMemo(
    () => filteredProducts.slice(0, page * PAGE_SIZE),
    [filteredProducts, page]
  );
  const hasMore = displayedProducts.length < filteredProducts.length;

  const lastProductElementRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prev => prev + 1);
      }
    });

    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  const getCartQuantity = (productId) => {
    const item = cart.find(p => p.id === productId);
    return item ? item.quantity : 0;
  };

  const handleAddProduct = (product) => {
    if (!cart.some(p => p.id === product.id)) {
      onCartChange([...cart, { ...product, quantity: 1 }]);
    } else {
      addNotification('이미 추가된 상품입니다.', 'info');
    }
  };

  const handleIncrement = (productId) => {
    onCartChange(
      cart.map(p => (p.id === productId ? { ...p, quantity: p.quantity + 1 } : p))
    );
  };

  const handleDecrement = (productId) => {
    const item = cart.find(p => p.id === productId);
    if (item && item.quantity <= 1) {
      onCartChange(cart.filter(p => p.id !== productId));
    } else {
      onCartChange(
        cart.map(p => (p.id === productId ? { ...p, quantity: p.quantity - 1 } : p))
      );
    }
  };

  const knownCategories = ['검사', '도서'];
  const extractedCategories = allProducts.map(p => p.category).filter(Boolean);
  const categories = [...new Set([...knownCategories, ...extractedCategories])];

  const viewModes = [
    { key: 'all', label: '전체' },
    { key: 'popular', label: '인기', icon: <StarIcon sx={{ fontSize: 14 }} /> },
    { key: 'new', label: '신규출시', icon: <NewIcon sx={{ fontSize: 14 }} /> },
  ];

  const categoryFilters = [
    { key: 'all', label: '전체' },
    ...categories.map(cat => ({ key: cat, label: cat })),
  ];

  return (
    <Box sx={{ px: 2, pb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 2.5, pt: 2, textAlign: 'center' }}>
        <Typography variant="h3" sx={{ fontWeight: 800, mb: 0.5 }}>
          상품을 선택해주세요
        </Typography>
        {eventName && (
          <Typography variant="body2" color="text.secondary">
            {eventName}
            {discountRate > 0 && ` · ${(discountRate * 100).toFixed(0)}% 할인 적용`}
          </Typography>
        )}
      </Box>

      {/* Search bar */}
      <TextField
        fullWidth
        placeholder="상품명으로 검색 (띄어쓰기로 여러 키워드)"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: 'text.disabled' }} />
            </InputAdornment>
          ),
        }}
        sx={{
          mb: 2,
          '& .MuiOutlinedInput-root': {
            borderRadius: '14px',
            bgcolor: '#F2F4F6',
            height: 48,
            '& fieldset': { borderColor: 'transparent' },
            '&:hover fieldset': { borderColor: 'transparent' },
            '&.Mui-focused fieldset': { borderColor: 'primary.main' },
          },
        }}
      />

      {/* Filters */}
      <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {/* View Mode */}
        <Box
          sx={{
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
                transition: 'all 0.15s ease',
                '&:active': { transform: 'scale(0.95)' },
              }}
            />
          ))}
        </Box>

        {/* Categories */}
        <Box
          sx={{
            display: 'flex',
            gap: 0.75,
            overflowX: 'auto',
            pb: 1,
            '&::-webkit-scrollbar': { display: 'none' },
            scrollbarWidth: 'none',
          }}
        >
          {categoryFilters.map((filter) => (
            <Chip
              key={filter.key}
              label={filter.label}
              variant={selectedCategory === filter.key ? 'filled' : 'outlined'}
              color={selectedCategory === filter.key ? 'secondary' : 'default'}
              onClick={() => setSelectedCategory(filter.key)}
              sx={{
                flexShrink: 0,
                fontWeight: selectedCategory === filter.key ? 700 : 500,
                borderRadius: '10px',
                transition: 'all 0.15s ease',
                '&:active': { transform: 'scale(0.95)' },
              }}
            />
          ))}
        </Box>
      </Box>

      {/* Product grid */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={32} thickness={4} />
        </Box>
      ) : displayedProducts.length === 0 ? (
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
          {displayedProducts.map((product, index) => {
            const isLast = displayedProducts.length === index + 1;
            return (
              <Box key={product.id} ref={isLast ? lastProductElementRef : null} sx={{ display: 'flex' }}>
                <ProductCard
                  product={product}
                  discountRate={discountRate}
                  cartQuantity={getCartQuantity(product.id)}
                  onAdd={() => handleAddProduct(product)}
                  onIncrement={() => handleIncrement(product.id)}
                  onDecrement={() => handleDecrement(product.id)}
                />
              </Box>
            );
          })}
        </Box>
      )}

      {hasMore && !loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} thickness={4} />
        </Box>
      )}
    </Box>
  );
};

export default ProductSelectionStep;
