import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Chip,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import { Search as SearchIcon, Star as StarIcon, FiberNew as NewIcon } from '@mui/icons-material';
import { fetchProducts } from '../api/products';
import { useNotification } from '../hooks/useNotification';
import ProductCard from './ProductCard';

const ProductSelectionStep = ({ cart, onCartChange, discountRate = 0, eventTags = [], eventName = '' }) => {
  const { addNotification } = useNotification();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('popular'); // 'all' or 'popular'
  const [selectedCategory, setSelectedCategory] = useState('all'); // 'all' or specific category name

  const loadProducts = useCallback(async (search = '', mode = 'popular', category = 'all') => {
    setLoading(true);
    try {
      const params = {
        searchTerm: search,
        // '전체' 모드가 아닐 때만 학회 태그 필터 적용
        tags: (mode !== 'all' && eventTags?.length > 0) ? eventTags : undefined,
        isNewOnly: mode === 'new',
        category: category !== 'all' ? category : undefined,
        productsPerPage: 100,
      };
      const { data } = await fetchProducts(params);
      setProducts(data || []);
    } catch (error) {
      addNotification(`상품 검색에 실패했습니다: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [eventTags, addNotification]);

  // Load products on mount
  useEffect(() => {
    loadProducts('', 'popular', 'all');
  }, [loadProducts]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts(searchTerm, viewMode, selectedCategory);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, viewMode, selectedCategory, loadProducts]);

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

  // Extract unique categories from loaded products, ensuring '도서' and '검사' are always present
  const knownCategories = ['검사', '도서'];
  const extractedCategories = products.map(p => p.category).filter(Boolean);
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
        {/* View Mode (Popular vs All) */}
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
      ) : products.length === 0 ? (
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
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              discountRate={discountRate}
              cartQuantity={getCartQuantity(product.id)}
              onAdd={() => handleAddProduct(product)}
              onIncrement={() => handleIncrement(product.id)}
              onDecrement={() => handleDecrement(product.id)}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default ProductSelectionStep;
