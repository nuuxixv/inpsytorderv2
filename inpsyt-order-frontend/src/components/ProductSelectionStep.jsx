import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  useTheme,
} from '@mui/material';
import { Star as StarIcon, FiberNew as NewIcon } from '@mui/icons-material';
import { fetchAllProducts } from '../api/products';
import { fetchTestGroups } from '../api/testGroups';
import { useNotification } from '../hooks/useNotification';
import { matchesSearch } from '../utils/search';
import { normalizeCategory, buildGroupMetaMap, groupTestProducts } from '../utils/testGroupDisplay';
import ProductCard from './ProductCard';
import TestGroupCard from './TestGroupCard';
import ProductSearchBar from './ProductSearchBar';

const PAGE_SIZE = 40;

const ProductSelectionStep = ({ cart, onCartChange, discountRate = 0, eventTags = [], eventName = '', visibleCategories = null }) => {
  const theme = useTheme();
  const { addNotification } = useNotification();
  const [allProducts, setAllProducts] = useState([]);
  const [testGroupMaster, setTestGroupMaster] = useState([]); // test_groups 마스터(약어·검사명·정렬)
  const [loading, setLoading] = useState(true);
  // 검색어는 debounce된 값만 상위에 둔다. 입력(IME 조합)은 ProductSearchBar 내부 로컬 state가
  // 흡수하므로, 매 키입력에 이 컴포넌트(검사군 트리)가 리렌더되지 않는다 — 타이핑 렉 격리.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewMode, setViewMode] = useState('popular'); // 'all' | 'popular' | 'new'
  const [selectedCategory, setSelectedCategory] = useState('all');
  // 검사군 펼침 상태: undefined=사용자 미조작 / true·false=사용자 조작. 검색 자동펼침은 초기 상태로만.
  const [expandedGroups, setExpandedGroups] = useState({});

  const [page, setPage] = useState(1);
  const observer = useRef();

  // 1회 로드 — 학회 현장 모바일에서도 수백 개 정도면 충분히 감당 가능
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // 검사군 마스터는 graceful(테이블 미존재 시 [] 반환) — 실패해도 진열은 평면 폴백.
        const [products, groups] = await Promise.all([fetchAllProducts(), fetchTestGroups()]);
        if (!cancelled) {
          setAllProducts(products || []);
          setTestGroupMaster(groups || []);
        }
      } catch (error) {
        if (!cancelled) addNotification(`상품 목록을 불러오지 못했습니다: ${error.message}`, 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [addNotification]);

  // 노출 필터(고객 진열): is_active===false 제외. 신규 필드 없는 환경에선 전부 통과(graceful).
  // 행사 판매 대분류 화이트리스트 — NULL/빈 배열이면 미적용(전체 노출, 기존 동작 보존).
  // 매칭은 원본 product.category(검사/도서/도구) 기준 — 도구→검사 정규화는 칩 표시 전용.
  const baseProducts = useMemo(() => {
    let list = allProducts.filter(p => p.is_active !== false);
    if (visibleCategories?.length) {
      list = list.filter(p => visibleCategories.includes(p.category));
    }
    return list;
  }, [allProducts, visibleCategories]);

  // 단일 대분류 행사 — 대분류 칩 숨기고 소분류(sub_category) 칩으로 탐색
  const isSingleCategory = visibleCategories?.length === 1;

  // 검사군 마스터 맵 — is_active=false 검사군은 제외(고객 미노출).
  const groupMetaById = useMemo(() => buildGroupMetaMap(testGroupMaster), [testGroupMaster]);

  // 검사군 그룹핑(클라 useMemo). graceful — utils/testGroupDisplay 참조.
  const testGroups = useMemo(
    () => groupTestProducts(baseProducts, groupMetaById, testGroupMaster.length > 0),
    [baseProducts, groupMetaById, testGroupMaster.length]
  );

  // 그룹에 속한 product id 집합 — 평면 진열에서 제외하기 위함.
  const groupedProductIds = useMemo(() => {
    const set = new Set();
    for (const g of testGroups) for (const p of g.options) set.add(p.id);
    return set;
  }, [testGroups]);

  // 평면 상품(도서 등 + 미분류 검사) — 그룹에 안 들어간 상품.
  const flatProducts = useMemo(
    () => baseProducts.filter(p => !groupedProductIds.has(p.id)),
    [baseProducts, groupedProductIds]
  );

  const hasSearch = Boolean(debouncedSearch.trim());

  // 검사군 카테고리 표시 여부 — '전체' 또는 '검사' 선택 시(단일 대분류 행사는 소분류 기준 별도 처리)
  const showTestGroups = useMemo(() => {
    if (isSingleCategory) return testGroups.length > 0; // 소분류 필터는 평면 대상, 검사군은 검사 대분류라 여기선 전량
    if (selectedCategory === 'all') return true;
    return selectedCategory === '검사';
  }, [isSingleCategory, selectedCategory, testGroups.length]);

  // 검사군 필터·검색 — 검사군 단위(검사명·약어·옵션명 매칭). 매칭 시 자동 펼침.
  const filteredGroups = useMemo(() => {
    if (!showTestGroups) return [];
    let groups = testGroups;

    // 학회 태그 — '전체' 모드가 아닐 때만(검색 중엔 무시)
    if (!hasSearch && viewMode !== 'all' && eventTags?.length > 0) {
      groups = groups.filter(g => g.options.some(p => Array.isArray(p.tags) && p.tags.some(t => eventTags.includes(t))));
    }

    // 뷰 모드(검색 중엔 무시) — 그룹 내 하나라도 매칭이면 노출
    if (!hasSearch) {
      if (viewMode === 'popular') groups = groups.filter(g => g.options.some(p => p.is_popular));
      else if (viewMode === 'new') groups = groups.filter(g => g.options.some(p => p.is_new));
    }

    // 검색 = 검사군 단위, 대상은 상품명 원본(name) 하나. 원본 상품명에 검사명·약어·말머리·옵션이
    // 모두 포함돼 있어(예 `K·BASC-3 한국판 정서-행동 평가시스템 부모보고형-청소년용_검사지/온라인코드(20)`)
    // name 단일 매칭으로 정확도 유지 + 단순화. 옵션 하나라도 매칭이면 그 검사군 노출(옵션 낱개 안 쏟음).
    if (hasSearch) {
      groups = groups.filter(g => g.options.some(p => matchesSearch(p.name, debouncedSearch)));
    }

    return groups;
  }, [showTestGroups, testGroups, hasSearch, viewMode, eventTags, debouncedSearch]);

  // 검색 매칭된 검사군 id 집합 — 자동 펼침 판정용
  const searchMatchedGroupIds = useMemo(() => {
    if (!hasSearch) return new Set();
    return new Set(filteredGroups.map(g => g.id));
  }, [hasSearch, filteredGroups]);

  // 평면 필터·검색·정렬(기존 로직 그대로)
  const filteredProducts = useMemo(() => {
    let list = flatProducts;

    if (!hasSearch && viewMode !== 'all' && eventTags?.length > 0) {
      list = list.filter(p => Array.isArray(p.tags) && p.tags.some(t => eventTags.includes(t)));
    }

    // 카테고리
    if (selectedCategory !== 'all') {
      if (isSingleCategory) {
        list = list.filter(p => (p.sub_category || '기타') === selectedCategory);
      } else {
        list = list.filter(p => normalizeCategory(p.category) === selectedCategory);
      }
    }

    if (!hasSearch) {
      if (viewMode === 'popular') list = list.filter(p => p.is_popular);
      else if (viewMode === 'new') list = list.filter(p => p.is_new);
    }

    if (hasSearch) {
      list = list.filter(p => matchesSearch(p.name, debouncedSearch));
    }

    return [...list].sort((a, b) => {
      const popDiff = (b.is_popular ? 1 : 0) - (a.is_popular ? 1 : 0);
      if (popDiff !== 0) return popDiff;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [flatProducts, debouncedSearch, viewMode, selectedCategory, eventTags, isSingleCategory, hasSearch]);

  // 필터 변경 시 페이지 리셋
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, viewMode, selectedCategory]);

  // 검색어 변경 시 사용자 펼침 조작 초기화 — 새 검색 결과는 매칭 검사군을 자동 펼침(초기 상태).
  // 이후 사용자는 개별 카드를 자유롭게 접고 펼 수 있음(아래 expanded 판정 참조).
  useEffect(() => {
    setExpandedGroups({});
  }, [debouncedSearch]);

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

  const getCartQuantity = useCallback((productId) => {
    const item = cart.find(p => p.id === productId);
    return item ? item.quantity : 0;
  }, [cart]);

  const handleAddProduct = useCallback((product) => {
    if (!cart.some(p => p.id === product.id)) {
      onCartChange([...cart, { ...product, quantity: 1 }]);
    } else {
      addNotification('이미 추가된 상품입니다.', 'info');
    }
  }, [cart, onCartChange, addNotification]);

  const handleIncrement = useCallback((productId) => {
    onCartChange(
      cart.map(p => (p.id === productId ? { ...p, quantity: p.quantity + 1 } : p))
    );
  }, [cart, onCartChange]);

  const handleDecrement = useCallback((productId) => {
    const item = cart.find(p => p.id === productId);
    if (item && item.quantity <= 1) {
      onCartChange(cart.filter(p => p.id !== productId));
    } else {
      onCartChange(
        cart.map(p => (p.id === productId ? { ...p, quantity: p.quantity - 1 } : p))
      );
    }
  }, [cart, onCartChange]);

  // currentExpanded = 현재 화면에 펼쳐진 상태(자동펼침 포함). 그 반대로 토글해
  // 자동 펼침된 검사군도 사용자가 곧바로 접을 수 있게 한다(문제 3).
  const toggleGroup = useCallback((groupId, currentExpanded) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !currentExpanded }));
  }, []);

  let categories;
  if (isSingleCategory) {
    // 단일 대분류 행사 — 소분류(sub_category) 칩. 미지정 상품은 '기타'로 묶음.
    const hasUncategorized = baseProducts.some(p => !p.sub_category);
    const subs = [...new Set(baseProducts.map(p => p.sub_category).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
    categories = hasUncategorized ? [...subs, '기타'] : subs;
  } else {
    const knownCategories = ['검사', '도서'];
    const extractedCategories = baseProducts
      .map(p => normalizeCategory(p.category))
      .filter(Boolean);
    categories = [...new Set([...knownCategories, ...extractedCategories])];
  }

  const viewModes = [
    { key: 'all', label: '전체' },
    { key: 'popular', label: '인기', icon: <StarIcon sx={{ fontSize: 14 }} /> },
    { key: 'new', label: '신규출시', icon: <NewIcon sx={{ fontSize: 14 }} /> },
  ];

  const categoryFilters = [
    { key: 'all', label: '전체' },
    ...categories.map(cat => ({ key: cat, label: cat })),
  ];
  const showCategoryChips = isSingleCategory ? categories.length >= 2 : true;

  const isEmpty = filteredGroups.length === 0 && displayedProducts.length === 0;

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

      {/* Search bar — 입력 격리(로컬 state + 내부 debounce). 매 키입력에 트리 리렌더 안 됨. */}
      <ProductSearchBar onSearch={setDebouncedSearch} />

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
                borderRadius: `${theme.radii.sm}px`,
                transition: `all 0.15s ${theme.easing.toss}`,
                '&:active': { transform: 'scale(0.95)' },
              }}
            />
          ))}
        </Box>

        {/* Categories */}
        {showCategoryChips && (
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
                borderRadius: `${theme.radii.sm}px`,
                transition: `all 0.15s ${theme.easing.toss}`,
                '&:active': { transform: 'scale(0.95)' },
              }}
            />
          ))}
        </Box>
        )}
      </Box>

      {/* Product list */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={32} thickness={4} />
        </Box>
      ) : isEmpty ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 0.5 }}>
            검색 결과가 없습니다
          </Typography>
          <Typography variant="body2" color="text.disabled">
            다른 검색어를 시도해보세요
          </Typography>
        </Box>
      ) : (
        <>
          {/* 검사군 리스트 — 풀폭 1열 */}
          {filteredGroups.length > 0 && (
            <Box sx={{ mb: displayedProducts.length > 0 ? 3 : 0 }}>
              {filteredGroups.map((group) => {
                // 사용자가 이 카드를 조작했으면(값 정의됨) 그 값 우선.
                // 미조작이면 검색 매칭 검사군을 자동 펼침(초기 상태), 평상시엔 접힘.
                const isExpanded = expandedGroups[group.id] !== undefined
                  ? expandedGroups[group.id]
                  : searchMatchedGroupIds.has(group.id);
                return (
                  <TestGroupCard
                    key={group.id}
                    group={group}
                    discountRate={discountRate}
                    expanded={isExpanded}
                    onToggle={toggleGroup}
                    getCartQuantity={getCartQuantity}
                    onAdd={handleAddProduct}
                    onIncrement={handleIncrement}
                    onDecrement={handleDecrement}
                  />
                );
              })}
            </Box>
          )}

          {/* 평면 상품 그리드 — 도서 등 + 미분류(graceful) */}
          {displayedProducts.length > 0 && (
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
                      hideCategoryBadge={isSingleCategory}
                      onAdd={() => handleAddProduct(product)}
                      onIncrement={() => handleIncrement(product.id)}
                      onDecrement={() => handleDecrement(product.id)}
                    />
                  </Box>
                );
              })}
            </Box>
          )}
        </>
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
