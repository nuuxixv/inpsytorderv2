import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Dialog,
  DialogActions, DialogContent, DialogTitle, FormControlLabel, Checkbox,
  FormControl, InputLabel, Select, MenuItem, Autocomplete, Chip,
  Pagination, IconButton, Tooltip, ToggleButton, ToggleButtonGroup,
  CircularProgress, LinearProgress, Switch, Collapse, Alert, alpha, useTheme,
} from '@mui/material';
import {
  Add as AddIcon, FileDownload as DownloadIcon, FileUpload as UploadIcon,
  Edit as EditIcon, Search as SearchIcon, Inventory as InventoryIcon,
  Inventory2 as Inventory2Icon, LocalOffer as TagIcon,
  TrendingUp as TrendingUpIcon, Delete as DeleteIcon,
  DeleteForever as DeleteForeverIcon, CheckBox as CheckBoxIcon,
  RestartAlt as RestartAltIcon, Tune as TuneIcon,
  Description as DescriptionIcon,
  MenuBook as MenuBookIcon,
  Science as ScienceIcon,
  Build as BuildIcon,
  Category as CategoryIcon,
  AccountTree as AccountTreeIcon,
  Sell as SellIcon,
  Check as CheckIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Image as ImageIcon,
  PhotoLibrary as PhotoLibraryIcon,
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { fetchAllProducts } from '../api/products';
import { getProductImageUrl, uploadProductImage } from '../api/productImages';
import {
  fetchSubcategories, fetchBadges,
  createSubcategory, updateSubcategory, deleteSubcategory,
  createBadge, updateBadge, deleteBadge,
  fetchMasterUsageCounts,
} from '../api/masters';
import { getSocieties } from '../api/events';
import { useNotification } from '../hooks/useNotification';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../supabaseClient';
import { matchesSearch } from '../utils/search';
import {
  CATEGORY_COLORS, CATEGORY_KEY_BY_LABEL,
  MASTER_COLOR_FALLBACK, MASTER_COLOR_PRESETS,
} from '../constants/categoryColors';
import { PageHeader, SectionCard, ActionSlot, EmptyState } from './ui';
import TableSkeleton from './TableSkeleton';

const categories = ['도서', '검사', '도구'];
const PARENT_CATEGORIES = ['검사', '도서', '도구'];
const DELETE_ALL_CONFIRM_TEXT = '삭제합니다';

// 카드 노출 정책: 고객 카드엔 priority 상위 2개만 노출(C1). 입력단(폼·엑셀)은 무제한.
const CARD_BADGE_LIMIT = 2;

// 이미지 파일명 안전 문자 — 영숫자·대시·언더스코어·점만. 한글·공백·특수문자는 Storage 키가 깨진다.
const SAFE_IMAGE_FILENAME = /^[A-Za-z0-9._-]+$/;

const createEmptyProduct = () => ({
  name: '',
  product_code: '',
  category: '',
  sub_category: '',
  list_price: 0,
  notes: '',
  is_discountable: false,
  is_popular: false,
  is_new: false,
  tags: [],
  badges: [],
});

const parseBool = (value) => {
  if (value === true || value === false) return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase();
    return ['TRUE', 'Y', 'YES', '1'].includes(normalized);
  }
  return false;
};

const getRowValue = (row, keys) => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key];
    }
  }
  return undefined;
};

const parsePrice = (value) => {
  if (typeof value === 'number') return Math.round(value);
  if (typeof value === 'string') {
    const normalized = value.replace(/[^\d.-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? Math.round(parsed) : 0;
  }
  return 0;
};

// 상품 표 썸네일(A6 §표 썸네일). 1:1 작은 정방형. 미등록·onError면 플레이스홀더.
// 대부분 미등록(NULL)이 정상.
const ProductThumb = ({ filename, name }) => {
  const [failed, setFailed] = useState(false);
  const url = getProductImageUrl(filename);
  const show = url && !failed;
  return (
    <Box
      sx={{
        width: 40,
        height: 40,
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'grey.100',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {show ? (
        <Box
          component="img"
          src={url}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <ImageIcon sx={{ fontSize: 18, color: 'grey.400' }} />
      )}
    </Box>
  );
};

// 동적 배지 소프트 틴트 칩(C1 §배지 패턴). 미등록·색없음은 회색 폴백.
const BadgeChip = ({ label, color }) => {
  const c = color || MASTER_COLOR_FALLBACK;
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        bgcolor: alpha(c, 0.12),
        color: c,
        border: `1px solid ${alpha(c, 0.3)}`,
        fontWeight: 600,
      }}
    />
  );
};

// 색 프리셋 선택 — 자유 hex 금지(AA 대비·토큰 정합). 견본 클릭으로만 선택.
const ColorPresetPicker = ({ value, onChange }) => (
  <Box>
    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75 }}>
      색
    </Typography>
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      {MASTER_COLOR_PRESETS.map((preset) => {
        const selected = value === preset.value;
        return (
          <Tooltip key={preset.value} title={preset.label} arrow>
            <Box
              onClick={() => onChange(preset.value)}
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                bgcolor: preset.value,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: selected ? '2px solid' : '2px solid transparent',
                borderColor: selected ? 'text.primary' : 'transparent',
                transition: 'transform 0.1s',
                '&:hover': { transform: 'scale(1.1)' },
              }}
            >
              {selected && <CheckIcon sx={{ fontSize: 18, color: '#fff' }} />}
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  </Box>
);

const TriStateToggle = ({ label, value, onChange }) => (
  <Box>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
      {label}
    </Typography>
    <ToggleButtonGroup
      value={value === null ? 'none' : value ? 'on' : 'off'}
      exclusive
      size="small"
      onChange={(_, nextValue) => {
        if (!nextValue) return;
        onChange(nextValue === 'none' ? null : nextValue === 'on');
      }}
    >
      <ToggleButton value="none" sx={{ px: 1.5, fontSize: '0.75rem' }}>변경 없음</ToggleButton>
      <ToggleButton value="on" sx={{ px: 1.5, fontSize: '0.75rem' }}>ON</ToggleButton>
      <ToggleButton value="off" sx={{ px: 1.5, fontSize: '0.75rem' }}>OFF</ToggleButton>
    </ToggleButtonGroup>
  </Box>
);

const ProductManagementPage = () => {
  const theme = useTheme();
  const { user, hasPermission } = useAuth();
  const { addNotification } = useNotification();
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  // 이미지 일괄 업로드(product-images 공개 버킷)
  const [imageUploadOpen, setImageUploadOpen] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState({ current: 0, total: 0, running: false });
  const [imageUploadResults, setImageUploadResults] = useState([]); // [{ name, ok, error }]

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, phase: 'idle' });
  const [uploadErrors, setUploadErrors] = useState([]);
  const [uploadLog, setUploadLog] = useState([]);
  const [uploadSuccessCount, setUploadSuccessCount] = useState(0);

  const [allProducts, setAllProducts] = useState([]);
  const [subcategories, setSubcategories] = useState([]); // 소분류 마스터(상품관리에서 관리)
  const [badgeMaster, setBadgeMaster] = useState([]);      // 배지 마스터(상품관리에서 관리)
  const [societies, setSocieties] = useState([]);          // 학회 목록(학회 관리 모달과 동일 소스)

  // ── 소분류·배지 마스터 CRUD (즉시 저장 — 상품관리 헤더에서 펼침/접이) ──
  const [masterPanelOpen, setMasterPanelOpen] = useState(false);
  const [masterUsage, setMasterUsage] = useState({ subCounts: {}, badgeCounts: {} });
  const [subDialog, setSubDialog] = useState(null);   // null | { id?, name, parent_category, color, sort_order, is_active }
  const [badgeDialog, setBadgeDialog] = useState(null); // null | { id?, name, color, priority, is_active }
  const [masterSaving, setMasterSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [productQuickFilter, setProductQuickFilter] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage, setProductsPerPage] = useState(50);
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(createEmptyProduct());
  const [categoryInvalid, setCategoryInvalid] = useState(false);
  const [customBadgeInput, setCustomBadgeInput] = useState(''); // 마스터 미등록 배지 직접 추가용

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkIsPopular, setBulkIsPopular] = useState(null);
  const [bulkIsNew, setBulkIsNew] = useState(null);
  const [bulkTags, setBulkTags] = useState([]);
  const [bulkTagsMode, setBulkTagsMode] = useState('append');
  const [bulkSaving, setBulkSaving] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllProducts();
      setAllProducts(data || []);
      setSelectedIds(new Set());
    } catch (error) {
      addNotification(`상품 목록을 불러오지 못했습니다: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // 소분류·배지 마스터 + 사용 카운트 로드. CRUD 후에도 재호출.
  // 마이그레이션 미적용 시 빈 배열 → 기존 자유입력 폴백.
  const loadMasters = useCallback(async () => {
    try {
      const [subs, bdgs, counts] = await Promise.all([
        fetchSubcategories(),
        fetchBadges(),
        fetchMasterUsageCounts(),
      ]);
      setSubcategories(subs);
      setBadgeMaster(bdgs);
      setMasterUsage(counts);
    } catch (error) {
      console.error('Error loading masters:', error);
    }
  }, []);

  useEffect(() => {
    loadMasters();
    getSocieties().then(setSocieties).catch(() => {});
  }, [loadMasters]);

  // 활성 소분류 이름 옵션(현재 폼 대분류에 소속된 것만). is_active=false는 신규 선택지에서 숨김.
  const subOptionsForCategory = useMemo(() => {
    const cat = currentProduct.category;
    return subcategories
      .filter((s) => s.is_active && (!cat || s.parent_category === cat))
      .map((s) => s.name);
  }, [subcategories, currentProduct.category]);

  // 활성 배지 이름 옵션.
  const badgeOptions = useMemo(
    () => badgeMaster.filter((b) => b.is_active).map((b) => b.name),
    [badgeMaster],
  );

  // 이름 → 색 룩업(미등록·색없음은 폴백 회색).
  const subColorByName = useMemo(() => {
    const m = {};
    subcategories.forEach((s) => { m[s.name] = s.color || MASTER_COLOR_FALLBACK; });
    return m;
  }, [subcategories]);
  const badgeColorByName = useMemo(() => {
    const m = {};
    badgeMaster.forEach((b) => { m[b.name] = b.color || MASTER_COLOR_FALLBACK; });
    return m;
  }, [badgeMaster]);
  const badgePriorityByName = useMemo(() => {
    const m = {};
    badgeMaster.forEach((b) => { m[b.name] = b.priority ?? 0; });
    return m;
  }, [badgeMaster]);

  // 검색어·카테고리·태그 변경 시 1페이지로 리셋
  useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedCategory, productQuickFilter, selectedTags]);

  // 카드용 집계 — 전체 상품 기준
  const totalProducts = allProducts.length;
  const totalDiscountableCount = useMemo(() => allProducts.filter(p => p.is_discountable).length, [allProducts]);
  const totalPopularCount = useMemo(() => allProducts.filter(p => p.is_popular).length, [allProducts]);
  const categoryCounts = useMemo(() => {
    const result = {};
    categories.forEach(cat => { result[cat] = allProducts.filter(p => p.category === cat).length; });
    return result;
  }, [allProducts]);
  // 태그 옵션 = 상품 태그(products.tags) ∪ 학회 목록(societies.name).
  // 학회 관리 탭에 등록한 학회명을 검색 편의로 태그 옵션에 항상 노출(건우님 피드백 #3).
  const availableTags = useMemo(() => {
    const fromProducts = allProducts.flatMap(p => p.tags || []);
    const fromSocieties = societies.map(s => s.name).filter(Boolean);
    return Array.from(new Set([...fromProducts, ...fromSocieties])).sort();
  }, [allProducts, societies]);

  // 필터: 검색 + 카테고리 + 빠른 필터
  const filteredProducts = useMemo(() => {
    let list = allProducts;
    if (searchTerm.trim()) list = list.filter(p => matchesSearch(p.name, searchTerm));
    if (selectedCategory) list = list.filter(p => p.category === selectedCategory);
    if (productQuickFilter === 'discountable') list = list.filter(p => p.is_discountable);
    if (productQuickFilter === 'popular') list = list.filter(p => p.is_popular);
    if (selectedTags.length > 0) list = list.filter(p => selectedTags.some(tag => p.tags?.includes(tag)));
    return [...list].sort((a, b) => {
      const popDiff = (b.is_popular ? 1 : 0) - (a.is_popular ? 1 : 0);
      if (popDiff !== 0) return popDiff;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [allProducts, searchTerm, selectedCategory, productQuickFilter, selectedTags]);

  const totalFiltered = filteredProducts.length;

  // 페이지 슬라이싱
  const displayedProducts = useMemo(() => {
    const start = (currentPage - 1) * productsPerPage;
    return filteredProducts.slice(start, start + productsPerPage);
  }, [filteredProducts, currentPage, productsPerPage]);

  const allPageSelected = displayedProducts.length > 0 && displayedProducts.every((product) => selectedIds.has(product.id));
  const somePageSelected = displayedProducts.some((product) => selectedIds.has(product.id));
  const selectedCount = selectedIds.size;
  const hasFilters = Boolean(searchTerm || selectedCategory || productQuickFilter || selectedTags.length > 0);

  const handleOpen = (product = null) => {
    setIsEditing(Boolean(product));
    setCurrentProduct(product ? { ...product } : createEmptyProduct());
    setCategoryInvalid(false);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setCurrentProduct(createEmptyProduct());
    setCategoryInvalid(false);
    setCustomBadgeInput('');
  };

  // 배지 칩 토글 — 무제한 선택(표출 정책은 카드에서 priority 상위 2개만, C1).
  const handleToggleBadge = (name) => {
    setCurrentProduct((prev) => {
      const current = prev.badges || [];
      return current.includes(name)
        ? { ...prev, badges: current.filter((b) => b !== name) }
        : { ...prev, badges: [...current, name] };
    });
  };

  // 마스터 미등록 배지 직접 추가(기존 freeSolo 기능 보존).
  const handleAddCustomBadge = () => {
    const v = customBadgeInput.trim();
    if (!v) return;
    setCurrentProduct((prev) => {
      const current = prev.badges || [];
      if (current.includes(v)) return prev;
      return { ...prev, badges: [...current, v] };
    });
    setCustomBadgeInput('');
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    if (name === 'category' && value) setCategoryInvalid(false);
    setCurrentProduct((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = async () => {
    if (!hasPermission('products:edit')) {
      addNotification('상품 수정 권한이 없습니다.', 'error');
      return;
    }

    if (!categories.includes(currentProduct.category)) {
      setCategoryInvalid(true);
      addNotification('카테고리를 검사/도서/도구 중에서 선택해 주세요.', 'warning');
      return;
    }

    try {
      const payload = { ...currentProduct, list_price: Math.round(Number(currentProduct.list_price) || 0) };
      // badges/image_filename 마이그레이션 미적용(컬럼 없음) 시 graceful — 빈값이면 payload에서 제외.
      // 값이 있는데 컬럼이 없으면 mutate 함수가 PGRST204 감지 후 해당 키 빼고 재시도.
      if (Array.isArray(payload.badges) && payload.badges.length === 0) delete payload.badges;
      if (payload.image_filename === '' || payload.image_filename == null) delete payload.image_filename;

      const mutate = async (data) => {
        const run = async (body) => {
          if (isEditing) {
            const { id, ...updates } = body;
            return supabase.from('products').update(updates).eq('id', id);
          }
          return supabase.from('products').insert([body]);
        };
        let { error } = await run(data);
        if (error && error.code === 'PGRST204' && ('badges' in data || 'image_filename' in data)) {
          const rest = { ...data };
          delete rest.badges;
          delete rest.image_filename;
          ({ error } = await run(rest));
        }
        if (error) throw error;
      };
      await mutate(payload);

      addNotification('상품이 저장되었습니다.', 'success');
      handleClose();
      fetchProducts();
    } catch (error) {
      addNotification(`상품 저장 실패: ${error.message}`, 'error');
    }
  };

  const handleToggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) displayedProducts.forEach((product) => next.delete(product.id));
      else displayedProducts.forEach((product) => next.add(product.id));
      return next;
    });
  };

  const handleToggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from('products').delete().in('id', ids);
      if (error) throw error;

      addNotification(`${ids.length}개 상품을 삭제했습니다.`, 'success');
      setSelectedIds(new Set());
      setDeleteDialogOpen(false);
      fetchProducts();
    } catch (error) {
      addNotification(`선택 삭제 실패: ${error.message}`, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    if (deleteAllConfirmText !== DELETE_ALL_CONFIRM_TEXT) {
      addNotification(`"${DELETE_ALL_CONFIRM_TEXT}"를 정확히 입력해 주세요.`, 'warning');
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase.from('products').delete().not('id', 'is', null);
      if (error) throw error;

      addNotification('전체 상품을 삭제했습니다.', 'success');
      setDeleteAllDialogOpen(false);
      setDeleteAllConfirmText('');
      setSelectedIds(new Set());
      fetchProducts();
    } catch (error) {
      addNotification(`전체 삭제 실패: ${error.message}`, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenBulkEdit = () => {
    setBulkIsPopular(null);
    setBulkIsNew(null);
    setBulkTags([]);
    setBulkTagsMode('append');
    setBulkEditOpen(true);
  };

  const handleBulkSave = async () => {
    if (bulkIsPopular === null && bulkIsNew === null && bulkTags.length === 0) {
      addNotification('변경할 항목이 없습니다.', 'warning');
      return;
    }

    setBulkSaving(true);
    try {
      const ids = Array.from(selectedIds);

      if (bulkTags.length > 0 && bulkTagsMode === 'append') {
        const { data: existingRows, error: fetchError } = await supabase
          .from('products')
          .select('id, tags')
          .in('id', ids);
        if (fetchError) throw fetchError;

        for (const row of existingRows || []) {
          const update = {};
          if (bulkIsPopular !== null) update.is_popular = bulkIsPopular;
          if (bulkIsNew !== null) update.is_new = bulkIsNew;
          update.tags = Array.from(new Set([...(row.tags || []), ...bulkTags]));

          const { error } = await supabase.from('products').update(update).eq('id', row.id);
          if (error) throw error;
        }
      } else {
        const update = {};
        if (bulkIsPopular !== null) update.is_popular = bulkIsPopular;
        if (bulkIsNew !== null) update.is_new = bulkIsNew;
        if (bulkTags.length > 0) update.tags = bulkTags;

        const { error } = await supabase.from('products').update(update).in('id', ids);
        if (error) throw error;
      }

      addNotification(`${ids.length}개 상품을 일괄 수정했습니다.`, 'success');
      setBulkEditOpen(false);
      setSelectedIds(new Set());
      fetchProducts();
    } catch (error) {
      addNotification(`일괄 수정 실패: ${error.message}`, 'error');
    } finally {
      setBulkSaving(false);
    }
  };

  const CHUNK_SIZE = 100;

  const handleFileUpload = async (event) => {
    if (!hasPermission('products:edit')) {
      addNotification('엑셀 업로드 권한이 없습니다.', 'error');
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset state
    setUploadErrors([]);
    setUploadLog([]);
    setUploadSuccessCount(0);
    setUploadDialogOpen(true);
    setUploadProgress({ current: 0, total: 0, phase: 'parsing' });

    try {
      // Phase 1: Parse Excel
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet);

      const allProducts = rows.map((row, idx) => ({
        _rowNum: idx + 2, // Excel row number (1-indexed header + 1)
        name: getRowValue(row, ['상품명', 'name']),
        product_code: getRowValue(row, ['상품코드', 'product_code']),
        category: String(getRowValue(row, ['카테고리', 'category']) || '').trim(),
        sub_category: getRowValue(row, ['하위카테고리', 'sub_category']) || null,
        image_filename: getRowValue(row, ['이미지', 'image_filename']) || null,
        list_price: parsePrice(getRowValue(row, ['가격', '정가', 'list_price'])),
        notes: getRowValue(row, ['비고', 'notes']) || null,
        is_discountable: parseBool(getRowValue(row, ['할인여부', 'is_discountable'])),
        is_popular: parseBool(getRowValue(row, ['인기상품', 'is_popular'])),
        is_new: parseBool(getRowValue(row, ['신상품여부', 'is_new'])),
        tags: getRowValue(row, ['태그', 'tags'])
          ? String(getRowValue(row, ['태그', 'tags'])).split(',').map((tag) => tag.trim()).filter(Boolean)
          : [],
        badges: getRowValue(row, ['배지', 'badges'])
          ? String(getRowValue(row, ['배지', 'badges'])).split(',').map((b) => b.trim()).filter(Boolean)
          : [],
      }));

      // Phase 2: Client-side validation
      const validationErrors = [];
      const badgeWarnings = []; // 배지 2개 초과 — 행 오류 아님, 경고 로그만(표출 정책)
      const seenCodes = new Map();
      const validProducts = [];

      for (const product of allProducts) {
        const rowNum = product._rowNum;
        if (!product.product_code) {
          validationErrors.push({ row: rowNum, product_code: '(빈값)', name: product.name || '-', error: '상품코드 필수' });
          continue;
        }
        if (!product.name) {
          validationErrors.push({ row: rowNum, product_code: product.product_code, name: '(빈값)', error: '상품명 필수' });
          continue;
        }
        if (!categories.includes(product.category)) {
          validationErrors.push({ row: rowNum, product_code: product.product_code, name: product.name, error: '카테고리는 검사/도서/도구만 허용' });
          continue;
        }
        if (seenCodes.has(product.product_code)) {
          validationErrors.push({ row: rowNum, product_code: product.product_code, name: product.name, error: `엑셀 내 중복 (${seenCodes.get(product.product_code)}행과 동일)` });
          continue;
        }
        seenCodes.set(product.product_code, rowNum);
        // 배지 무제한 받되, 2개 초과는 경고만(upsert는 통과 — 카드엔 상위 2개만 노출되는 표출 정책).
        if ((product.badges || []).length > CARD_BADGE_LIMIT) {
          badgeWarnings.push(`${rowNum}행 ${product.name}: 배지 ${product.badges.length}개 — 카드엔 상위 2개 노출`);
        }
        // Remove internal _rowNum before sending to server
        const { _rowNum, ...cleanProduct } = product;
        validProducts.push({ ...cleanProduct, _rowNum: rowNum });
      }

      if (validationErrors.length > 0) {
        setUploadErrors(prev => [...prev, ...validationErrors]);
        setUploadLog(prev => [...prev, `사전 검증: ${validationErrors.length}건 오류 발견`]);
      }
      if (badgeWarnings.length > 0) {
        setUploadLog(prev => [...prev, ...badgeWarnings]);
      }

      if (validProducts.length === 0) {
        setUploadProgress({ current: 0, total: 0, phase: 'error' });
        setUploadLog(prev => [...prev, '유효한 상품이 없습니다.']);
        return;
      }

      // Phase 3: Chunked upload
      const totalValid = validProducts.length;
      setUploadProgress({ current: 0, total: totalValid, phase: 'uploading' });

      const chunks = [];
      for (let i = 0; i < validProducts.length; i += CHUNK_SIZE) {
        chunks.push(validProducts.slice(i, i + CHUNK_SIZE));
      }

      let totalSuccess = 0;
      const serverErrors = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkStart = i * CHUNK_SIZE;
        // Strip _rowNum before sending. badges 빈 배열은 제외(미적용 환경 회귀 방지).
        const payload = chunk.map((p) => {
          const rest = { ...p };
          delete rest._rowNum;
          if (Array.isArray(rest.badges) && rest.badges.length === 0) delete rest.badges;
          if (rest.image_filename == null) delete rest.image_filename;
          return rest;
        });

        try {
          const { data, error } = await supabase.functions.invoke('upload-products-excel', {
            body: { products: payload },
          });

          if (error) {
            // Entire chunk failed
            chunk.forEach((p) => {
              serverErrors.push({ row: p._rowNum, product_code: p.product_code, name: p.name, error: error.message });
            });
            setUploadLog(prev => [...prev, `청크 ${i + 1}/${chunks.length} 실패: ${error.message}`]);
          } else if (data?.error_count > 0) {
            // Partial failure
            totalSuccess += data.success_count || 0;
            (data.errors || []).forEach((e) => {
              const originalProduct = chunk[e.row_index];
              serverErrors.push({
                row: originalProduct?._rowNum || chunkStart + e.row_index + 2,
                product_code: e.product_code,
                name: e.name,
                error: e.error,
              });
            });
            setUploadLog(prev => [...prev, `청크 ${i + 1}/${chunks.length}: ${data.success_count}건 성공, ${data.error_count}건 실패`]);
          } else {
            totalSuccess += data?.success_count || chunk.length;
            setUploadLog(prev => [...prev, `청크 ${i + 1}/${chunks.length} 완료 (${chunk.length}건)`]);
          }
        } catch (err) {
          chunk.forEach((p) => {
            serverErrors.push({ row: p._rowNum, product_code: p.product_code, name: p.name, error: err.message });
          });
          setUploadLog(prev => [...prev, `청크 ${i + 1}/${chunks.length} 오류: ${err.message}`]);
        }

        setUploadProgress({ current: Math.min((i + 1) * CHUNK_SIZE, totalValid), total: totalValid, phase: 'uploading' });
      }

      // Done
      setUploadSuccessCount(totalSuccess);
      if (serverErrors.length > 0) {
        setUploadErrors(prev => [...prev, ...serverErrors]);
      }
      setUploadProgress(prev => ({ ...prev, phase: 'done' }));
      fetchProducts();

    } catch (error) {
      setUploadProgress({ current: 0, total: 0, phase: 'error' });
      setUploadLog(prev => [...prev, `파싱 오류: ${error.message}`]);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 이미지 일괄 업로드 — 다중 파일을 product-images 공개 버킷에 파일명 그대로 올린다.
  // 와박팀 엑셀 "이미지" 열과 파일명이 일치하면 카드에 즉시 매칭된다.
  const handleImageUpload = async (event) => {
    if (!hasPermission('products:edit')) {
      addNotification('이미지 업로드 권한이 없습니다.', 'error');
      return;
    }
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setImageUploadResults([]);
    setImageUploadProgress({ current: 0, total: files.length, running: true });
    setImageUploadOpen(true);

    const results = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // 업로드 전 파일명 검증 — 한글·공백·특수문자면 Storage 키가 깨진다. 위반 파일은 시도 없이 실패 기록.
      if (!SAFE_IMAGE_FILENAME.test(file.name)) {
        results.push({ name: file.name, ok: false, error: '파일명에 한글·공백·특수문자 불가 — 영문/숫자 파일명 권장' });
      } else {
        const { error } = await uploadProductImage(file);
        results.push({ name: file.name, ok: !error, error: error?.message });
      }
      setImageUploadResults([...results]);
      setImageUploadProgress({ current: i + 1, total: files.length, running: true });
    }

    setImageUploadProgress((prev) => ({ ...prev, running: false }));
    const failCount = results.filter((r) => !r.ok).length;
    if (failCount === 0) {
      addNotification(`이미지 ${results.length}개 업로드 완료`, 'success');
    } else {
      addNotification(`이미지 업로드 완료 — 성공 ${results.length - failCount}, 실패 ${failCount}`, 'warning');
    }
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleDownloadTemplate = () => {
    const template = [{
      상품명: '예시 상품',
      상품코드: 'PROD001',
      카테고리: '도서',
      하위카테고리: '심리',
      가격: 15000,
      비고: '설명',
      할인여부: 'TRUE',
      인기상품: 'FALSE',
      신상품여부: 'TRUE',
      태그: '신경정신,치매',
      배지: '추천,한정',
      이미지: 'sample.webp',
    }];

    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '상품_업로드_양식');
    XLSX.writeFile(workbook, '상품_업로드_양식.xlsx');
    addNotification('업로드 양식을 다운로드했습니다.', 'success');
  };

  const handleDownloadExcel = async () => {
    try {
      const allProducts = await fetchAllProducts();
      const rows = allProducts.map((product) => ({
        상품명: product.name,
        상품코드: product.product_code,
        카테고리: product.category,
        하위카테고리: product.sub_category || '',
        가격: product.list_price,
        비고: product.notes || '',
        할인여부: product.is_discountable ? 'TRUE' : 'FALSE',
        인기상품: product.is_popular ? 'TRUE' : 'FALSE',
        신상품여부: product.is_new ? 'TRUE' : 'FALSE',
        태그: product.tags?.join(',') || '',
        배지: product.badges?.join(',') || '',
        이미지: product.image_filename || '',
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '상품_목록');
      XLSX.writeFile(workbook, '상품_목록.xlsx');
      addNotification('상품 목록을 다운로드했습니다.', 'success');
    } catch (error) {
      addNotification(`엑셀 다운로드 실패: ${error.message}`, 'error');
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setCurrentPage(1);
    setProductQuickFilter(null);
    setSelectedTags([]);
  };

  // ── 소분류 마스터 CRUD (즉시 DB 반영) ──
  const handleSaveSub = async () => {
    const d = subDialog;
    if (!d.name?.trim()) {
      addNotification('소분류 이름을 입력해 주세요.', 'warning');
      return;
    }
    if (!PARENT_CATEGORIES.includes(d.parent_category)) {
      addNotification('소속 대분류를 선택해 주세요.', 'warning');
      return;
    }
    const dup = subcategories.some(
      (s) => s.parent_category === d.parent_category && s.name.trim() === d.name.trim() && s.id !== d.id,
    );
    if (dup) {
      addNotification('같은 대분류에 동일한 이름의 소분류가 이미 있습니다.', 'warning');
      return;
    }
    setMasterSaving(true);
    try {
      const payload = {
        name: d.name.trim(),
        parent_category: d.parent_category,
        color: d.color,
        sort_order: Number(d.sort_order) || 0,
        is_active: d.is_active,
      };
      if (d.id) await updateSubcategory(d.id, payload);
      else await createSubcategory(payload);
      addNotification('소분류가 저장되었습니다.', 'success');
      setSubDialog(null);
      loadMasters();
    } catch (error) {
      addNotification(`소분류 저장 실패: ${error.message}`, 'error');
    } finally {
      setMasterSaving(false);
    }
  };

  const handleDeleteSub = async (sub) => {
    const count = masterUsage.subCounts[sub.name] || 0;
    if (count > 0) {
      addNotification(`이 소분류를 쓰는 상품 ${count}개가 있어 삭제할 수 없습니다.`, 'warning');
      return;
    }
    try {
      await deleteSubcategory(sub.id);
      addNotification('소분류를 삭제했습니다.', 'success');
      loadMasters();
    } catch (error) {
      addNotification(`소분류 삭제 실패: ${error.message}`, 'error');
    }
  };

  const handleToggleSubActive = async (sub) => {
    try {
      await updateSubcategory(sub.id, { is_active: !sub.is_active });
      loadMasters();
    } catch (error) {
      addNotification(`상태 변경 실패: ${error.message}`, 'error');
    }
  };

  // ── 배지 마스터 CRUD (즉시 DB 반영) ──
  const handleSaveBadge = async () => {
    const d = badgeDialog;
    if (!d.name?.trim()) {
      addNotification('배지 이름을 입력해 주세요.', 'warning');
      return;
    }
    const dup = badgeMaster.some((b) => b.name.trim() === d.name.trim() && b.id !== d.id);
    if (dup) {
      addNotification('동일한 이름의 배지가 이미 있습니다.', 'warning');
      return;
    }
    setMasterSaving(true);
    try {
      const payload = {
        name: d.name.trim(),
        color: d.color,
        priority: Number(d.priority) || 0,
        is_active: d.is_active,
      };
      if (d.id) await updateBadge(d.id, payload);
      else await createBadge(payload);
      addNotification('배지가 저장되었습니다.', 'success');
      setBadgeDialog(null);
      loadMasters();
    } catch (error) {
      addNotification(`배지 저장 실패: ${error.message}`, 'error');
    } finally {
      setMasterSaving(false);
    }
  };

  const handleDeleteBadge = async (badge) => {
    const count = masterUsage.badgeCounts[badge.name] || 0;
    if (count > 0) {
      addNotification(`이 배지를 쓰는 상품 ${count}개가 있어 삭제할 수 없습니다.`, 'warning');
      return;
    }
    try {
      await deleteBadge(badge.id);
      addNotification('배지를 삭제했습니다.', 'success');
      loadMasters();
    } catch (error) {
      addNotification(`배지 삭제 실패: ${error.message}`, 'error');
    }
  };

  const handleToggleBadgeActive = async (badge) => {
    try {
      await updateBadge(badge.id, { is_active: !badge.is_active });
      loadMasters();
    } catch (error) {
      addNotification(`상태 변경 실패: ${error.message}`, 'error');
    }
  };

  if (!user || !hasPermission('products:view')) {
    return <Box sx={{ p: 3 }}><Typography>상품 관리 페이지 접근 권한이 없습니다.</Typography></Box>;
  }

  // 빠른 필터 카드 — 시안 QuickFilterCard 패턴 (border 기반, 그라데이션 제거 — 02 §색 E항)
  const renderQuickFilterCard = (opts) => {
    const { label, value, Icon, baseColor, active, onClick } = opts;
    return (
      <Box
        key={label}
        onClick={onClick}
        sx={{
          flex: '1 1 140px',
          minWidth: 130,
          cursor: 'pointer',
          bgcolor: 'background.paper',
          border: `1px solid ${alpha(baseColor, active ? 0.55 : 0.18)}`,
          borderRadius: `${theme.radii.md}px`,
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          transition: `all 0.15s ${theme.easing.toss}`,
          minHeight: 64,
          '&:hover': {
            borderColor: alpha(baseColor, 0.4),
            bgcolor: alpha(baseColor, 0.04),
          },
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontWeight: 700,
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
              display: 'block',
            }}
          >
            {label}
          </Typography>
          <Typography
            variant="h3"
            sx={{
              color: active ? baseColor : 'text.primary',
              lineHeight: 1.1,
              fontFeatureSettings: '"tnum" 1',
            }}
          >
            {value}
          </Typography>
        </Box>
        <Icon sx={{ fontSize: 28, color: alpha(baseColor, active ? 0.7 : 0.4) }} />
      </Box>
    );
  };

  const headerAction = (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      <Tooltip title="엑셀 양식 다운로드">
        <IconButton onClick={handleDownloadTemplate} sx={{ bgcolor: alpha(theme.palette.info.main, 0.1) }}>
          <DescriptionIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="상품 목록 다운로드">
        <IconButton onClick={handleDownloadExcel} sx={{ bgcolor: alpha(theme.palette.success.main, 0.1) }}>
          <DownloadIcon />
        </IconButton>
      </Tooltip>
      {hasPermission('products:edit') && (
        <>
          <Tooltip title="엑셀 업로드 (product_code 기준 upsert)">
            <IconButton component="label" sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
              <UploadIcon />
              <input ref={fileInputRef} hidden type="file" accept=".xlsx,.xls" onChange={handleFileUpload} />
            </IconButton>
          </Tooltip>
          <Tooltip title="상품 이미지 일괄 업로드 (파일명 그대로 — 엑셀 '이미지' 열과 일치 · 권장: 파일명을 상품코드로(영문/숫자))">
            <IconButton component="label" sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.1) }}>
              <PhotoLibraryIcon />
              <input ref={imageInputRef} hidden type="file" accept="image/*" multiple onChange={handleImageUpload} />
            </IconButton>
          </Tooltip>
          <Tooltip title="소분류·배지 관리">
            <Button
              variant="outlined"
              size="small"
              startIcon={<CategoryIcon />}
              endIcon={masterPanelOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              onClick={() => setMasterPanelOpen((prev) => !prev)}
            >
              소분류·배지 관리
            </Button>
          </Tooltip>
          <Tooltip title="전체 삭제">
            <IconButton
              onClick={() => {
                setDeleteAllConfirmText('');
                setDeleteAllDialogOpen(true);
              }}
              sx={{ bgcolor: alpha(theme.palette.error.main, 0.08), color: 'error.main' }}
            >
              <DeleteForeverIcon />
            </IconButton>
          </Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
            상품 추가
          </Button>
        </>
      )}
    </Box>
  );

  return (
    <Box>
      <PageHeader
        title="상품 관리"
        icon={Inventory2Icon}
        action={headerAction}
      />

      {/* 소분류·배지 마스터 관리 — 헤더 액션부에서 펼침/접이. 즉시 저장(하단 저장버튼 없음). */}
      {hasPermission('products:edit') && (
        <Collapse in={masterPanelOpen} unmountOnExit>
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            {/* 소분류 관리 */}
            <SectionCard
              title="소분류 관리"
              subtitle="대분류(검사/도서/도구) 하위의 분류입니다. 고객 주문서에서 칩으로 노출되며 탐색에 쓰입니다. (매출 집계에는 영향 없음 · 추가·수정·삭제 즉시 적용)"
              icon={AccountTreeIcon}
              padding={24}
              sx={{ flex: '1 1 360px', minWidth: 300 }}
              action={
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setSubDialog({ name: '', parent_category: '', color: MASTER_COLOR_PRESETS[0].value, sort_order: 0, is_active: true })}
                >
                  소분류 추가
                </Button>
              }
            >
              <Box sx={{ mt: 1 }}>
                {subcategories.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'text.disabled', py: 2, textAlign: 'center' }}>
                    등록된 소분류가 없습니다 · 추가해 시작하세요
                  </Typography>
                ) : (
                  subcategories.map((sub) => {
                    const count = masterUsage.subCounts[sub.name] || 0;
                    return (
                      <Box
                        key={sub.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          py: 1,
                          borderBottom: `1px solid ${theme.gray[100]}`,
                          opacity: sub.is_active ? 1 : 0.5,
                        }}
                      >
                        <BadgeChip label={sub.name} color={sub.color} />
                        <Chip label={sub.parent_category} size="small" variant="outlined" color="primary" />
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>순서 {sub.sort_order}</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>· 상품 {count}개</Typography>
                        <Box sx={{ flexGrow: 1 }} />
                        <Tooltip title={sub.is_active ? '활성 (신규 선택지에 노출)' : '비활성 (숨김)'} arrow>
                          <Switch size="small" checked={sub.is_active} onChange={() => handleToggleSubActive(sub)} />
                        </Tooltip>
                        <IconButton size="small" onClick={() => setSubDialog({ ...sub })}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <Tooltip title={count > 0 ? `상품 ${count}개 연결 — 삭제 불가` : '삭제'} arrow>
                          <span>
                            <IconButton size="small" onClick={() => handleDeleteSub(sub)} disabled={count > 0} sx={{ color: count > 0 ? 'text.disabled' : 'error.main' }}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    );
                  })
                )}
              </Box>
            </SectionCard>

            {/* 배지 관리 */}
            <SectionCard
              title="배지 관리"
              subtitle="상품 카드에 표시되는 강조 라벨입니다. (예: 추천, 한정) 고객 카드엔 우선순위 상위 2개만 노출됩니다. · 추가·수정·삭제 즉시 적용"
              icon={SellIcon}
              padding={24}
              sx={{ flex: '1 1 360px', minWidth: 300 }}
              action={
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setBadgeDialog({ name: '', color: MASTER_COLOR_PRESETS[0].value, priority: 0, is_active: true })}
                >
                  배지 추가
                </Button>
              }
            >
              <Box sx={{ mt: 1 }}>
                <Alert severity="info" icon={false} sx={{ borderRadius: `${theme.radii.sm}px`, py: 0.5, mb: 2 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    인기·신상품·할인 배지는 상품별 체크박스로 별도 관리됩니다(상품 추가/수정).
                  </Typography>
                </Alert>
                {badgeMaster.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'text.disabled', py: 2, textAlign: 'center' }}>
                    등록된 배지가 없습니다 · 추가해 시작하세요
                  </Typography>
                ) : (
                  badgeMaster.map((badge) => {
                    const count = masterUsage.badgeCounts[badge.name] || 0;
                    return (
                      <Box
                        key={badge.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          py: 1,
                          borderBottom: `1px solid ${theme.gray[100]}`,
                          opacity: badge.is_active ? 1 : 0.5,
                        }}
                      >
                        <BadgeChip label={badge.name} color={badge.color} />
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>우선순위 {badge.priority}</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>· 상품 {count}개</Typography>
                        <Box sx={{ flexGrow: 1 }} />
                        <Tooltip title={badge.is_active ? '활성 (신규 선택지에 노출)' : '비활성 (숨김)'} arrow>
                          <Switch size="small" checked={badge.is_active} onChange={() => handleToggleBadgeActive(badge)} />
                        </Tooltip>
                        <IconButton size="small" onClick={() => setBadgeDialog({ ...badge })}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <Tooltip title={count > 0 ? `상품 ${count}개 연결 — 삭제 불가` : '삭제'} arrow>
                          <span>
                            <IconButton size="small" onClick={() => handleDeleteBadge(badge)} disabled={count > 0} sx={{ color: count > 0 ? 'text.disabled' : 'error.main' }}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    );
                  })
                )}
              </Box>
            </SectionCard>
          </Box>
        </Collapse>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {renderQuickFilterCard({
          label: '전체 상품',
          value: totalProducts,
          Icon: InventoryIcon,
          baseColor: theme.palette.primary.main,
          active: productQuickFilter === null && !selectedCategory,
          onClick: () => { setProductQuickFilter(null); setSelectedCategory(''); },
        })}
        {renderQuickFilterCard({
          label: '할인 가능',
          value: totalDiscountableCount,
          Icon: TagIcon,
          baseColor: theme.palette.success.main,
          active: productQuickFilter === 'discountable',
          onClick: () => setProductQuickFilter((prev) => (prev === 'discountable' ? null : 'discountable')),
        })}
        {renderQuickFilterCard({
          label: '인기 상품',
          value: totalPopularCount,
          Icon: TrendingUpIcon,
          baseColor: theme.palette.warning.main,
          active: productQuickFilter === 'popular',
          onClick: () => setProductQuickFilter((prev) => (prev === 'popular' ? null : 'popular')),
        })}
        {[
          // 카테고리 색은 design-system Appendix §2-1 / 08 D17 정식 토큰
          // (constants/categoryColors.js). 인라인 hex·theme.palette 우회 금지.
          { key: '도서', Icon: MenuBookIcon, color: CATEGORY_COLORS[CATEGORY_KEY_BY_LABEL['도서']] },
          { key: '검사', Icon: ScienceIcon, color: CATEGORY_COLORS[CATEGORY_KEY_BY_LABEL['검사']] },
          { key: '도구', Icon: BuildIcon, color: CATEGORY_COLORS[CATEGORY_KEY_BY_LABEL['도구']] },
        ].map(({ key, Icon, color }) => renderQuickFilterCard({
          label: key,
          value: categoryCounts[key] ?? 0,
          Icon,
          baseColor: color,
          active: selectedCategory === key,
          onClick: () => setSelectedCategory(prev => prev === key ? '' : key),
        }))}
      </Box>

      <SectionCard sx={{ mb: 2 }} padding={16}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: availableTags.length > 0 ? 2 : 0 }}>
          <TextField
            label="상품명 검색"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setCurrentPage(1);
            }}
            size="small"
            sx={{ flexGrow: 1, minWidth: 200 }}
            InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
          />
          {hasFilters && (
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              {totalFiltered}개 표시 중
            </Typography>
          )}
          {hasFilters && (
            <Button variant="outlined" onClick={handleResetFilters} size="small" startIcon={<RestartAltIcon />}>
              초기화
            </Button>
          )}
        </Box>
        {availableTags.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {availableTags.map(tag => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                variant={selectedTags.includes(tag) ? 'filled' : 'outlined'}
                color={selectedTags.includes(tag) ? 'primary' : 'default'}
                onClick={() => {
                  setSelectedTags(prev =>
                    prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                  );
                  setCurrentPage(1);
                }}
                sx={{ fontWeight: selectedTags.includes(tag) ? 700 : 500 }}
              />
            ))}
          </Box>
        )}
      </SectionCard>

      {selectedCount > 0 && hasPermission('products:edit') && (
        <SectionCard
          padding={0}
          sx={{
            mb: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.04),
            borderColor: alpha(theme.palette.primary.main, 0.2),
          }}
        >
          <ActionSlot
            sx={{ px: 2, py: 1.5 }}
            leading={
              <>
                <CheckBoxIcon sx={{ color: 'primary.main' }} />
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  {selectedCount}개 선택됨
                </Typography>
              </>
            }
          >
            <Button size="small" variant="outlined" startIcon={<TuneIcon />} onClick={handleOpenBulkEdit}>
              선택 항목 편집
            </Button>
            <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => setDeleteDialogOpen(true)}>
              선택 삭제
            </Button>
            <Button size="small" variant="text" onClick={() => setSelectedIds(new Set())}>
              선택 해제
            </Button>
          </ActionSlot>
        </SectionCard>
      )}

      <SectionCard padding={0}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                {hasPermission('products:edit') && (
                  <TableCell padding="checkbox" sx={{ width: 48 }}>
                    <Checkbox
                      size="small"
                      checked={allPageSelected}
                      indeterminate={somePageSelected && !allPageSelected}
                      onChange={handleToggleAll}
                    />
                  </TableCell>
                )}
                <TableCell sx={{ fontWeight: 'bold' }} align="center">이미지</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>상품명</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>카테고리</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>하위 카테고리</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">가격</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>비고</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">상태 태그</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>태그</TableCell>
                {hasPermission('products:edit') && <TableCell sx={{ fontWeight: 'bold' }} align="center">작업</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableSkeleton rows={10} columns={hasPermission('products:edit') ? 10 : 9} />
              ) : displayedProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={hasPermission('products:edit') ? 10 : 9} sx={{ border: 0, py: 4 }}>
                    <EmptyState
                      icon={InventoryIcon}
                      title={hasFilters ? '검색 결과가 없습니다' : '등록된 상품이 없습니다'}
                      description={hasFilters ? '다른 검색어나 필터를 시도해 보세요' : '새 상품을 추가해 시작하세요'}
                      action={
                        hasFilters
                          ? { label: '필터 초기화', onClick: handleResetFilters, startIcon: <RestartAltIcon /> }
                          : hasPermission('products:edit')
                          ? { label: '상품 추가', onClick: () => handleOpen(), startIcon: <AddIcon /> }
                          : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                displayedProducts.map((product) => (
                  <TableRow
                    key={product.id}
                    selected={selectedIds.has(product.id)}
                    sx={{ '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) }, transition: 'background-color 0.2s' }}
                  >
                    {hasPermission('products:edit') && (
                      <TableCell padding="checkbox">
                        <Checkbox size="small" checked={selectedIds.has(product.id)} onChange={() => handleToggleOne(product.id)} />
                      </TableCell>
                    )}
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <ProductThumb filename={product.image_filename} name={product.name} />
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{product.name}</TableCell>
                    <TableCell><Chip label={product.category} size="small" color="primary" variant="outlined" /></TableCell>
                    <TableCell>
                      {product.sub_category
                        ? (subColorByName[product.sub_category]
                            ? <BadgeChip label={product.sub_category} color={subColorByName[product.sub_category]} />
                            : <BadgeChip label={`${product.sub_category} · 미등록`} color={MASTER_COLOR_FALLBACK} />)
                        : '-'}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontFeatureSettings: '"tnum" 1' }}>{(product.list_price || 0).toLocaleString()}원</TableCell>
                    <TableCell sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.notes || '-'}</TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center', minWidth: 80 }}>
                        {product.is_popular && <Chip label="인기" size="small" color="warning" />}
                        {product.is_new && <Chip label="신상품" size="small" color="primary" />}
                        {product.is_discountable && (
                          <Chip
                            label="할인"
                            size="small"
                            sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.main', border: 0 }}
                          />
                        )}
                        {/* 동적 배지 — 우선순위 정렬, 어드민은 전량 노출(C1 최대 2개 가드는 고객 화면 한정) */}
                        {[...(product.badges || [])]
                          .sort((a, b) => (badgePriorityByName[a] ?? 999) - (badgePriorityByName[b] ?? 999))
                          .map((name) => (
                            <BadgeChip
                              key={name}
                              label={badgeColorByName[name] ? name : `${name} · 미등록`}
                              color={badgeColorByName[name]}
                            />
                          ))}
                        {!product.is_popular && !product.is_new && !product.is_discountable && (product.badges || []).length === 0 && (
                          <Typography variant="caption" color="text.secondary">-</Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {(product.tags || []).slice(0, 2).map((tag, index) => (
                          <Chip key={index} label={tag} size="small" variant="outlined" />
                        ))}
                        {(product.tags || []).length > 2 && (
                          <Tooltip title={product.tags.slice(2).join(', ')} arrow>
                            <Chip label={`+${product.tags.length - 2}`} size="small" sx={{ cursor: 'pointer' }} />
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    {hasPermission('products:edit') && (
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => handleOpen(product)}
                          sx={{ color: 'primary.main', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) } }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {displayedProducts.length > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderTop: `1px solid ${theme.gray[100]}` }}>
            <FormControl size="small">
              <InputLabel>페이지당 항목 수</InputLabel>
              <Select
                value={productsPerPage}
                label="페이지당 항목 수"
                onChange={(event) => {
                  setProductsPerPage(parseInt(event.target.value, 10));
                  setCurrentPage(1);
                }}
              >
                {[10, 25, 50, 100].map((size) => (
                  <MenuItem key={size} value={size}>{size}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Pagination count={Math.max(1, Math.ceil(totalFiltered / productsPerPage))} page={currentPage} onChange={(_, page) => setCurrentPage(page)} color="primary" />
          </Box>
        )}
      </SectionCard>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>{isEditing ? '상품 수정' : '새 상품 추가'}</DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField autoFocus name="name" label="상품명" fullWidth value={currentProduct.name} onChange={handleChange} disabled={!hasPermission('products:edit')} />
            <TextField name="product_code" label="상품 코드" fullWidth value={currentProduct.product_code} onChange={handleChange} disabled={!hasPermission('products:edit')} />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth required error={categoryInvalid} disabled={!hasPermission('products:edit')}>
                <InputLabel id="product-category-label">카테고리</InputLabel>
                <Select
                  labelId="product-category-label"
                  name="category"
                  label="카테고리"
                  value={currentProduct.category || ''}
                  onChange={handleChange}
                >
                  {categories.map((cat) => (
                    <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Autocomplete
                freeSolo
                fullWidth
                options={subOptionsForCategory}
                value={currentProduct.sub_category || ''}
                onInputChange={(_, value) => setCurrentProduct((prev) => ({ ...prev, sub_category: value }))}
                disabled={!hasPermission('products:edit')}
                renderInput={(params) => {
                  const v = (currentProduct.sub_category || '').trim();
                  const unregistered = Boolean(v) && !subOptionsForCategory.includes(v) && !subcategories.some((s) => s.name === v);
                  return (
                    <TextField
                      {...params}
                      label="하위 카테고리"
                      placeholder="소분류 선택 또는 입력"
                      helperText={unregistered ? '마스터에 미등록된 소분류입니다 (설정에서 추가 가능)' : ' '}
                      FormHelperTextProps={{ sx: { color: unregistered ? 'text.disabled' : 'transparent' } }}
                    />
                  );
                }}
              />
            </Box>
            <TextField name="list_price" label="가격" type="number" fullWidth value={currentProduct.list_price} onChange={handleChange} disabled={!hasPermission('products:edit')} />
            <TextField name="notes" label="비고" fullWidth multiline rows={3} value={currentProduct.notes || ''} onChange={handleChange} disabled={!hasPermission('products:edit')} />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControlLabel control={<Checkbox checked={currentProduct.is_discountable} onChange={(event) => setCurrentProduct((prev) => ({ ...prev, is_discountable: event.target.checked }))} disabled={!hasPermission('products:edit')} />} label="할인 가능" />
              <FormControlLabel control={<Checkbox checked={currentProduct.is_popular} onChange={(event) => setCurrentProduct((prev) => ({ ...prev, is_popular: event.target.checked }))} disabled={!hasPermission('products:edit')} />} label="인기 상품" />
              <FormControlLabel control={<Checkbox checked={currentProduct.is_new} onChange={(event) => setCurrentProduct((prev) => ({ ...prev, is_new: event.target.checked }))} disabled={!hasPermission('products:edit')} />} label="신상품" />
            </Box>
            <Autocomplete
              multiple
              freeSolo
              options={availableTags}
              value={currentProduct.tags || []}
              onChange={(_, value) => setCurrentProduct((prev) => ({ ...prev, tags: value }))}
              renderTags={(value, getTagProps) => value.map((option, index) => (
                <Chip key={index} variant="outlined" label={option} {...getTagProps({ index })} />
              ))}
              renderInput={(params) => <TextField {...params} label="태그 (검색 편의)" placeholder="태그 추가" fullWidth />}
              disabled={!hasPermission('products:edit')}
            />
            {/* 배지 — 마스터 배지 칩 토글 그룹. 태그와 별도(태그=검색 / 배지=고객 노출). 무제한 선택. */}
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75 }}>
                배지 (고객 노출 라벨)
              </Typography>
              {(() => {
                const selected = currentProduct.badges || [];
                // 마스터에 없는데 이미 달린 배지(미등록·엑셀 유래)도 토글 칩으로 함께 노출 — 손실 방지.
                const customSelected = selected.filter((b) => !badgeOptions.includes(b));
                const allChips = [...badgeOptions, ...customSelected];
                return (
                  <>
                    {allChips.length === 0 ? (
                      <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mb: 1 }}>
                        등록된 배지가 없습니다. 상단 "소분류·배지 관리"에서 추가하거나 아래에서 직접 입력하세요.
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                        {allChips.map((name) => {
                          const isOn = selected.includes(name);
                          const registered = badgeColorByName[name];
                          const c = registered || MASTER_COLOR_FALLBACK;
                          return (
                            <Chip
                              key={name}
                              label={registered ? name : `${name} · 미등록`}
                              size="small"
                              onClick={hasPermission('products:edit') ? () => handleToggleBadge(name) : undefined}
                              variant={isOn ? 'filled' : 'outlined'}
                              sx={isOn
                                ? { bgcolor: alpha(c, 0.12), color: c, border: `1px solid ${alpha(c, 0.3)}`, fontWeight: 600 }
                                : { color: 'text.secondary', fontWeight: 500 }}
                            />
                          );
                        })}
                      </Box>
                    )}
                    {/* 직접 추가 — 마스터 미등록 배지 입력 보존(기존 freeSolo 대체) */}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        size="small"
                        placeholder="직접 추가 (마스터 미등록 배지)"
                        value={customBadgeInput}
                        onChange={(e) => setCustomBadgeInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomBadge(); } }}
                        disabled={!hasPermission('products:edit')}
                        sx={{ flexGrow: 1 }}
                      />
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={handleAddCustomBadge}
                        disabled={!hasPermission('products:edit') || !customBadgeInput.trim()}
                      >
                        추가
                      </Button>
                    </Box>
                    {selected.length >= 3 && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
                        고객 카드엔 우선순위 상위 2개만 노출됩니다.
                      </Typography>
                    )}
                  </>
                );
              })()}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleClose}>취소</Button>
          {hasPermission('products:edit') && <Button onClick={handleSave} variant="contained">저장</Button>}
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>선택 상품 삭제</DialogTitle>
        <DialogContent>
          <Typography>선택한 <strong>{selectedCount}개</strong> 상품을 삭제합니다.</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>이 작업은 되돌릴 수 없습니다.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>취소</Button>
          <Button onClick={handleDeleteSelected} variant="contained" color="error" disabled={deleting} startIcon={deleting ? <CircularProgress size={14} /> : null}>
            삭제
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteAllDialogOpen} onClose={() => setDeleteAllDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>전체 상품 삭제</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>등록된 <strong>모든 상품</strong>을 삭제합니다. 이 작업은 되돌릴 수 없습니다.</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            계속하려면 아래에 <strong>{DELETE_ALL_CONFIRM_TEXT}</strong> 를 입력하세요.
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder={DELETE_ALL_CONFIRM_TEXT}
            value={deleteAllConfirmText}
            onChange={(event) => setDeleteAllConfirmText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleDeleteAll();
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteAllDialogOpen(false)} disabled={deleting}>취소</Button>
          <Button onClick={handleDeleteAll} variant="contained" color="error" disabled={deleting || deleteAllConfirmText !== DELETE_ALL_CONFIRM_TEXT} startIcon={deleting ? <CircularProgress size={14} /> : null}>
            전체 삭제
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={bulkEditOpen} onClose={() => setBulkEditOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          선택 항목 편집
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 400, mt: 0.25 }}>
            선택한 {selectedCount}개 상품에 적용됩니다.
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
          <TriStateToggle label="인기 상품 (is_popular)" value={bulkIsPopular} onChange={setBulkIsPopular} />
          <TriStateToggle label="신상품 (is_new)" value={bulkIsNew} onChange={setBulkIsNew} />
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
              <Typography variant="caption" color="text.secondary">태그</Typography>
              <ToggleButtonGroup value={bulkTagsMode} exclusive size="small" onChange={(_, value) => { if (value) setBulkTagsMode(value); }}>
                <ToggleButton value="append" sx={{ px: 1.25, fontSize: '0.7rem' }}>추가</ToggleButton>
                <ToggleButton value="replace" sx={{ px: 1.25, fontSize: '0.7rem' }}>덮어쓰기</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Autocomplete
              multiple
              freeSolo
              options={availableTags}
              value={bulkTags}
              onChange={(_, value) => setBulkTags(value)}
              renderTags={(value, getTagProps) => value.map((option, index) => (
                <Chip key={index} variant="outlined" label={option} {...getTagProps({ index })} size="small" />
              ))}
              renderInput={(params) => <TextField {...params} size="small" placeholder={bulkTagsMode === 'append' ? '추가할 태그 입력' : '새 태그 목록 입력'} />}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setBulkEditOpen(false)} disabled={bulkSaving}>취소</Button>
          <Button onClick={handleBulkSave} variant="contained" disabled={bulkSaving} startIcon={bulkSaving ? <CircularProgress size={14} /> : null}>
            {bulkSaving ? '적용 중...' : '적용'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 이미지 일괄 업로드 진행/결과 다이얼로그 */}
      <Dialog
        open={imageUploadOpen}
        onClose={imageUploadProgress.running ? undefined : () => setImageUploadOpen(false)}
        disableEscapeKeyDown={imageUploadProgress.running}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {imageUploadProgress.running ? '이미지 업로드 중' : '이미지 업로드 완료'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {imageUploadProgress.current} / {imageUploadProgress.total}
              </Typography>
              {!imageUploadProgress.running && (
                <Typography variant="body2" color="text.secondary">
                  실패 {imageUploadResults.filter((r) => !r.ok).length}건
                </Typography>
              )}
            </Box>
            <LinearProgress
              variant="determinate"
              value={imageUploadProgress.total ? (imageUploadProgress.current / imageUploadProgress.total) * 100 : 0}
            />
          </Box>
          {imageUploadResults.some((r) => !r.ok) && (
            <Box sx={{ maxHeight: 220, overflow: 'auto' }}>
              {imageUploadResults.filter((r) => !r.ok).map((r) => (
                <Typography key={r.name} variant="caption" color="error.main" sx={{ display: 'block' }}>
                  {r.name}: {r.error || '실패'}
                </Typography>
              ))}
            </Box>
          )}
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1.5 }}>
            권장: 파일명을 상품코드로(영문/숫자). 한글·공백·특수문자 파일명은 업로드되지 않습니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImageUploadOpen(false)} disabled={imageUploadProgress.running}>
            닫기
          </Button>
        </DialogActions>
      </Dialog>

      {/* Upload Progress Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onClose={uploadProgress.phase === 'done' || uploadProgress.phase === 'error' ? () => setUploadDialogOpen(false) : undefined}
        disableEscapeKeyDown={uploadProgress.phase === 'uploading' || uploadProgress.phase === 'parsing'}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {uploadProgress.phase === 'parsing' && '엑셀 파싱 중...'}
          {uploadProgress.phase === 'uploading' && '상품 업로드 중'}
          {uploadProgress.phase === 'done' && '업로드 완료'}
          {uploadProgress.phase === 'error' && '업로드 오류'}
        </DialogTitle>
        <DialogContent>
          {/* Progress bar */}
          {(uploadProgress.phase === 'uploading' || uploadProgress.phase === 'parsing') && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {uploadProgress.phase === 'parsing' ? '파싱 중...' : `${uploadProgress.current.toLocaleString()} / ${uploadProgress.total.toLocaleString()}`}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {uploadProgress.total > 0 ? `${Math.round((uploadProgress.current / uploadProgress.total) * 100)}%` : ''}
                </Typography>
              </Box>
              <LinearProgress
                variant={uploadProgress.phase === 'parsing' ? 'indeterminate' : 'determinate'}
                value={uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
          )}

          {/* Summary (done phase) */}
          {uploadProgress.phase === 'done' && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body1" sx={{ fontWeight: 600, color: 'success.main', mb: 0.5 }}>
                성공: {uploadSuccessCount.toLocaleString()}건
              </Typography>
              {uploadErrors.length > 0 && (
                <Typography variant="body1" sx={{ fontWeight: 600, color: 'error.main' }}>
                  실패: {uploadErrors.length}건
                </Typography>
              )}
            </Box>
          )}

          {/* Log */}
          {uploadLog.length > 0 && (
            <Box sx={{ maxHeight: 150, overflow: 'auto', mb: 2, bgcolor: 'grey.50', borderRadius: 1, p: 1.5 }}>
              {uploadLog.map((line, i) => (
                <Typography key={i} variant="caption" sx={{ display: 'block', color: line.includes('실패') || line.includes('오류') ? 'error.main' : 'text.secondary' }}>
                  {line}
                </Typography>
              ))}
            </Box>
          )}

          {/* Error table */}
          {uploadErrors.length > 0 && (uploadProgress.phase === 'done' || uploadProgress.phase === 'error') && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>오류 내역</Typography>
              <TableContainer sx={{ maxHeight: 200, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, py: 0.5 }}>행</TableCell>
                      <TableCell sx={{ fontWeight: 700, py: 0.5 }}>상품코드</TableCell>
                      <TableCell sx={{ fontWeight: 700, py: 0.5 }}>상품명</TableCell>
                      <TableCell sx={{ fontWeight: 700, py: 0.5 }}>사유</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {uploadErrors.map((err, i) => (
                      <TableRow key={i}>
                        <TableCell sx={{ py: 0.5 }}>{err.row}</TableCell>
                        <TableCell sx={{ py: 0.5, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{err.product_code}</TableCell>
                        <TableCell sx={{ py: 0.5, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{err.name}</TableCell>
                        <TableCell sx={{ py: 0.5, color: 'error.main' }}>{err.error}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Note during upload */}
          {(uploadProgress.phase === 'uploading' || uploadProgress.phase === 'parsing') && (
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>
              업로드 중에는 창을 닫을 수 없습니다
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          {uploadErrors.length > 0 && (uploadProgress.phase === 'done' || uploadProgress.phase === 'error') && (
            <Button
              size="small"
              onClick={() => {
                const text = uploadErrors.map(e => `${e.row}행\t${e.product_code}\t${e.name}\t${e.error}`).join('\n');
                navigator.clipboard.writeText(`행\t상품코드\t상품명\t사유\n${text}`);
                addNotification('오류 내역이 복사되었습니다.', 'info');
              }}
            >
              오류 내역 복사
            </Button>
          )}
          <Button
            variant="contained"
            disabled={uploadProgress.phase === 'uploading' || uploadProgress.phase === 'parsing'}
            onClick={() => setUploadDialogOpen(false)}
          >
            닫기
          </Button>
        </DialogActions>
      </Dialog>

      {/* 소분류 추가/수정 다이얼로그 (즉시 저장) */}
      <Dialog open={Boolean(subDialog)} onClose={() => setSubDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{subDialog?.id ? '소분류 수정' : '소분류 추가'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2 }}>
          <TextField
            autoFocus
            label="소분류 이름"
            size="small"
            fullWidth
            value={subDialog?.name || ''}
            onChange={(e) => setSubDialog((p) => ({ ...p, name: e.target.value }))}
          />
          <FormControl size="small" fullWidth>
            <InputLabel id="sub-parent-label">소속 대분류</InputLabel>
            <Select
              labelId="sub-parent-label"
              label="소속 대분류"
              value={subDialog?.parent_category || ''}
              onChange={(e) => setSubDialog((p) => ({ ...p, parent_category: e.target.value }))}
            >
              {PARENT_CATEGORIES.map((cat) => (
                <MenuItem key={cat} value={cat}>{cat}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <ColorPresetPicker value={subDialog?.color} onChange={(c) => setSubDialog((p) => ({ ...p, color: c }))} />
          <TextField
            label="정렬 순서"
            type="number"
            size="small"
            fullWidth
            value={subDialog?.sort_order ?? 0}
            onChange={(e) => setSubDialog((p) => ({ ...p, sort_order: e.target.value }))}
            helperText="고객 화면 칩 노출 순서 (작을수록 먼저)"
          />
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>미리보기</Typography>
            <BadgeChip label={subDialog?.name || '소분류'} color={subDialog?.color} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSubDialog(null)} disabled={masterSaving}>취소</Button>
          <Button variant="contained" onClick={handleSaveSub} disabled={masterSaving}>
            {masterSaving ? <CircularProgress size={18} /> : '저장'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 배지 추가/수정 다이얼로그 (즉시 저장) */}
      <Dialog open={Boolean(badgeDialog)} onClose={() => setBadgeDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{badgeDialog?.id ? '배지 수정' : '배지 추가'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2 }}>
          <TextField
            autoFocus
            label="배지 이름"
            size="small"
            fullWidth
            value={badgeDialog?.name || ''}
            onChange={(e) => setBadgeDialog((p) => ({ ...p, name: e.target.value }))}
          />
          <ColorPresetPicker value={badgeDialog?.color} onChange={(c) => setBadgeDialog((p) => ({ ...p, color: c }))} />
          <TextField
            label="우선순위"
            type="number"
            size="small"
            fullWidth
            value={badgeDialog?.priority ?? 0}
            onChange={(e) => setBadgeDialog((p) => ({ ...p, priority: e.target.value }))}
            helperText="고객 카드 상위 2개 노출 시 정렬 기준 (작을수록 먼저)"
          />
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>미리보기</Typography>
            <BadgeChip label={badgeDialog?.name || '배지'} color={badgeDialog?.color} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setBadgeDialog(null)} disabled={masterSaving}>취소</Button>
          <Button variant="contained" onClick={handleSaveBadge} disabled={masterSaving}>
            {masterSaving ? <CircularProgress size={18} /> : '저장'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProductManagementPage;
