import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Card, CardContent, Dialog,
  DialogActions, DialogContent, DialogTitle, FormControlLabel, Checkbox,
  FormControl, InputLabel, Select, MenuItem, Autocomplete, Chip,
  Pagination, IconButton, Tooltip, ToggleButton, ToggleButtonGroup,
  CircularProgress, alpha, useTheme,
} from '@mui/material';
import {
  Add as AddIcon, FileDownload as DownloadIcon, FileUpload as UploadIcon,
  Edit as EditIcon, Search as SearchIcon, Inventory as InventoryIcon,
  Category as CategoryIcon, LocalOffer as TagIcon,
  TrendingUp as TrendingUpIcon, Delete as DeleteIcon,
  DeleteForever as DeleteForeverIcon, CheckBox as CheckBoxIcon,
  RestartAlt as RestartAltIcon, Tune as TuneIcon,
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { fetchProducts as fetchProductsApi, fetchAllProducts } from '../api/products';
import { useNotification } from '../hooks/useNotification';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../supabaseClient';
import EmptyState from './EmptyState';
import TableSkeleton from './TableSkeleton';

const categories = ['도서', '검사', '기구'];
const DELETE_ALL_CONFIRM_TEXT = '삭제합니다';

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

  const [products, setProducts] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalDiscountableCount, setTotalDiscountableCount] = useState(0);
  const [totalPopularCount, setTotalPopularCount] = useState(0);
  const [availableTags, setAvailableTags] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [productQuickFilter, setProductQuickFilter] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage, setProductsPerPage] = useState(50);
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(createEmptyProduct());

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
      const [pageResult, discountableResult, popularResult] = await Promise.all([
        fetchProductsApi({ searchTerm, category: selectedCategory, currentPage, productsPerPage }),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_discountable', true),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_popular', true),
      ]);

      setProducts(pageResult.data || []);
      setTotalProducts(pageResult.count || 0);
      setTotalDiscountableCount(discountableResult.count || 0);
      setTotalPopularCount(popularResult.count || 0);
      setSelectedIds(new Set());

      const tags = (pageResult.data || []).flatMap((product) => product.tags || []);
      setAvailableTags(Array.from(new Set(tags)).sort());
    } catch (error) {
      addNotification(`상품 목록을 불러오지 못했습니다: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification, currentPage, productsPerPage, searchTerm, selectedCategory]);

  useEffect(() => {
    const timer = setTimeout(() => { fetchProducts(); }, 250);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  const displayedProducts = useMemo(() => {
    if (productQuickFilter === 'discountable') return products.filter((product) => product.is_discountable);
    if (productQuickFilter === 'popular') return products.filter((product) => product.is_popular);
    return products;
  }, [productQuickFilter, products]);

  const allPageSelected = displayedProducts.length > 0 && displayedProducts.every((product) => selectedIds.has(product.id));
  const somePageSelected = displayedProducts.some((product) => selectedIds.has(product.id));
  const selectedCount = selectedIds.size;
  const hasFilters = Boolean(searchTerm || selectedCategory);

  const handleOpen = (product = null) => {
    setIsEditing(Boolean(product));
    setCurrentProduct(product ? { ...product } : createEmptyProduct());
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setCurrentProduct(createEmptyProduct());
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setCurrentProduct((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = async () => {
    if (!hasPermission('products:edit')) {
      addNotification('상품 수정 권한이 없습니다.', 'error');
      return;
    }

    try {
      const payload = { ...currentProduct, list_price: Number(currentProduct.list_price) || 0 };
      if (isEditing) {
        const { id, ...updates } = payload;
        const { error } = await supabase.from('products').update(updates).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('products').insert([payload]);
        if (error) throw error;
      }

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

  const handleFileUpload = async (event) => {
    if (!hasPermission('products:edit')) {
      addNotification('엑셀 업로드 권한이 없습니다.', 'error');
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet);

      const productsToUpload = rows.map((row) => ({
        name: row['상품명'],
        product_code: row['상품코드'],
        category: row['카테고리'],
        sub_category: row['하위카테고리'] || null,
        list_price: parseFloat(row['가격']) || 0,
        notes: row['비고'] || null,
        is_discountable: parseBool(row['할인여부']),
        is_popular: parseBool(row['인기상품']),
        is_new: parseBool(row['신상품여부']),
        tags: row['태그']
          ? String(row['태그']).split(',').map((tag) => tag.trim()).filter(Boolean)
          : [],
      }));

      const { data, error } = await supabase.functions.invoke('upload-products-excel', {
        body: { products: productsToUpload },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      addNotification(data?.message || '엑셀 업로드가 완료되었습니다.', 'success');
      fetchProducts();
    } catch (error) {
      addNotification(`엑셀 업로드 실패: ${error.message}`, 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
  };

  if (!user || !hasPermission('products:view')) {
    return <Box sx={{ p: 3 }}><Typography>상품 관리 페이지 접근 권한이 없습니다.</Typography></Box>;
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CategoryIcon sx={{ color: 'primary.main', fontSize: '1.4rem' }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>상품 관리</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Tooltip title="엑셀 양식 다운로드">
              <IconButton onClick={handleDownloadTemplate} sx={{ bgcolor: alpha(theme.palette.info.main, 0.1) }}>
                <DownloadIcon />
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
        </Box>

        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Card
            onClick={() => setProductQuickFilter(null)}
            sx={{
              flex: '1 1 180px',
              cursor: 'pointer',
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
              border: `1px solid ${alpha(theme.palette.primary.main, productQuickFilter === null ? 0.6 : 0.2)}`,
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>전체 상품</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>{totalProducts}</Typography>
                </Box>
                <InventoryIcon sx={{ fontSize: 40, color: alpha(theme.palette.primary.main, 0.5) }} />
              </Box>
            </CardContent>
          </Card>
          <Card
            onClick={() => setProductQuickFilter((prev) => (prev === 'discountable' ? null : 'discountable'))}
            sx={{
              flex: '1 1 180px',
              cursor: 'pointer',
              background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.main, 0.05)} 100%)`,
              border: `1px solid ${alpha(theme.palette.success.main, productQuickFilter === 'discountable' ? 0.6 : 0.2)}`,
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>할인 가능</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'success.main' }}>{totalDiscountableCount}</Typography>
                </Box>
                <TagIcon sx={{ fontSize: 40, color: alpha(theme.palette.success.main, 0.5) }} />
              </Box>
            </CardContent>
          </Card>
          <Card
            onClick={() => setProductQuickFilter((prev) => (prev === 'popular' ? null : 'popular'))}
            sx={{
              flex: '1 1 180px',
              cursor: 'pointer',
              background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.1)} 0%, ${alpha(theme.palette.warning.main, 0.05)} 100%)`,
              border: `1px solid ${alpha(theme.palette.warning.main, productQuickFilter === 'popular' ? 0.6 : 0.2)}`,
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>인기 상품</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'warning.main' }}>{totalPopularCount}</Typography>
                </Box>
                <TrendingUpIcon sx={{ fontSize: 40, color: alpha(theme.palette.warning.main, 0.5) }} />
              </Box>
            </CardContent>
          </Card>
          <Card sx={{ flex: '1 1 180px' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>카테고리 수</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'info.main' }}>{categories.length}</Typography>
                </Box>
                <SearchIcon sx={{ fontSize: 40, color: alpha(theme.palette.info.main, 0.5) }} />
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
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
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>카테고리</InputLabel>
              <Select
                value={selectedCategory}
                label="카테고리"
                onChange={(event) => {
                  setSelectedCategory(event.target.value);
                  setCurrentPage(1);
                }}
              >
                <MenuItem value=""><em>전체</em></MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category} value={category}>{category}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {hasFilters && (
              <Button variant="outlined" onClick={handleResetFilters} size="small" startIcon={<RestartAltIcon />}>
                초기화
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {selectedCount > 0 && hasPermission('products:edit') && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            mb: 1.5,
            px: 2,
            py: 1.25,
            bgcolor: alpha(theme.palette.primary.main, 0.06),
            borderRadius: 2,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
          }}
        >
          <CheckBoxIcon sx={{ color: 'primary.main', fontSize: '1.2rem' }} />
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
            {selectedCount}개 선택됨
          </Typography>
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
            <Button size="small" variant="outlined" startIcon={<TuneIcon />} onClick={handleOpenBulkEdit}>
              선택 항목 편집
            </Button>
            <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => setDeleteDialogOpen(true)}>
              선택 삭제
            </Button>
            <Button size="small" variant="text" onClick={() => setSelectedIds(new Set())}>
              선택 해제
            </Button>
          </Box>
        </Box>
      )}

      <Card>
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
                <TableSkeleton rows={10} columns={hasPermission('products:edit') ? 9 : 8} />
              ) : displayedProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={hasPermission('products:edit') ? 9 : 8} sx={{ border: 0, py: 4 }}>
                    <EmptyState
                      message={hasFilters ? '검색 결과가 없습니다' : '등록된 상품이 없습니다'}
                      subMessage={hasFilters ? '다른 검색어나 필터를 시도해 보세요' : '새 상품을 추가해 시작하세요'}
                      icon={<InventoryIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
                      action={
                        hasFilters
                          ? { label: '필터 초기화', onClick: handleResetFilters }
                          : hasPermission('products:edit')
                          ? { label: '상품 추가', onClick: () => handleOpen() }
                          : null
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
                    <TableCell sx={{ fontWeight: 500 }}>{product.name}</TableCell>
                    <TableCell><Chip label={product.category} size="small" color="primary" variant="outlined" /></TableCell>
                    <TableCell>{product.sub_category || '-'}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>{(product.list_price || 0).toLocaleString()}원</TableCell>
                    <TableCell sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.notes || '-'}</TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center', minWidth: 80 }}>
                        {product.is_popular && <Chip label="인기" size="small" color="warning" sx={{ height: 20, fontSize: '0.7rem' }} />}
                        {product.is_new && <Chip label="신상품" size="small" color="primary" sx={{ height: 20, fontSize: '0.7rem' }} />}
                        {product.is_discountable && (
                          <Chip
                            label="할인"
                            size="small"
                            sx={{ height: 20, fontSize: '0.7rem', bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.main', border: 0 }}
                          />
                        )}
                        {!product.is_popular && !product.is_new && !product.is_discountable && (
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
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderTop: 1, borderColor: 'divider' }}>
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
            <Pagination count={Math.ceil(totalProducts / productsPerPage)} page={currentPage} onChange={(_, page) => setCurrentPage(page)} color="primary" />
          </Box>
        )}
      </Card>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>{isEditing ? '상품 수정' : '새 상품 추가'}</DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField autoFocus name="name" label="상품명" fullWidth value={currentProduct.name} onChange={handleChange} disabled={!hasPermission('products:edit')} />
            <TextField name="product_code" label="상품 코드" fullWidth value={currentProduct.product_code} onChange={handleChange} disabled={!hasPermission('products:edit')} />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField name="category" label="카테고리" fullWidth value={currentProduct.category} onChange={handleChange} disabled={!hasPermission('products:edit')} />
              <TextField name="sub_category" label="하위 카테고리" fullWidth value={currentProduct.sub_category || ''} onChange={handleChange} disabled={!hasPermission('products:edit')} />
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
              renderInput={(params) => <TextField {...params} label="태그" placeholder="태그 추가" fullWidth />}
              disabled={!hasPermission('products:edit')}
            />
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
    </Box>
  );
};

export default ProductManagementPage;
