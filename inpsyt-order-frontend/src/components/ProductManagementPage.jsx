import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Chip,
  Pagination,
  IconButton,
  Card,
  CardContent,
  alpha,
  useTheme,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Add as AddIcon,
  FileDownload as DownloadIcon,
  FileUpload as UploadIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  Inventory as InventoryIcon,
  Category as CategoryIcon,
  LocalOffer as TagIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { fetchProducts as fetchProductsApi, fetchAllProducts } from '../api/products';
import { useNotification } from '../hooks/useNotification';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';
import { useAuth } from '../hooks/useAuth';
import EmptyState from './EmptyState';
import TableSkeleton from './TableSkeleton';

const ProductManagementPage = () => {
  const theme = useTheme();
  const [products, setProducts] = useState([]);
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const { user, hasPermission } = useAuth();
  const { addNotification } = useNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [availableTags, setAvailableTags] = useState([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage, setProductsPerPage] = useState(50);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [productQuickFilter, setProductQuickFilter] = useState(null); // null=전체, 'discountable', 'popular'
  const [totalDiscountableCount, setTotalDiscountableCount] = React.useState(0);
  const [totalPopularCount, setTotalPopularCount] = React.useState(0);

  const fileInputRef = useRef(null);

  const categories = ['도서', '검사', '도구'];

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const [pageResult, discountResult, popularResult] = await Promise.all([
        fetchProductsApi({
          searchTerm,
          category: selectedCategory,
          currentPage,
          productsPerPage,
        }),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_discountable', true),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_popular', true),
      ]);

      if (pageResult.error) {
        addNotification(`상품 목록을 불러오는 데 실패했습니다: ${pageResult.error.message}`, 'error');
      } else {
        setProducts(pageResult.data);
        setTotalProducts(pageResult.count);
        const allTags = pageResult.data.flatMap(product => product.tags || []);
        setAvailableTags(Array.from(new Set(allTags)));
      }
      if (!discountResult.error) setTotalDiscountableCount(discountResult.count || 0);
      if (!popularResult.error) setTotalPopularCount(popularResult.count || 0);
    } finally {
      setLoading(false);
    }
  }, [addNotification, searchTerm, selectedCategory, currentPage, productsPerPage]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchProducts();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [fetchProducts]);

  const handleOpen = (product = null) => {
    setIsEditing(!!product);
    setCurrentProduct(product || { name: '', product_code: '', category: '', sub_category: '', list_price: 0, notes: '', is_discountable: false, is_popular: false, is_new: false, is_recommend: false, tags: [] });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setCurrentProduct(null);
  };

  const handleSave = async () => {
    if (!hasPermission('products:edit')) {
      addNotification('상품 정보를 편집할 권한이 없습니다.', 'error');
      return;
    }
    if (!currentProduct) return;

    const { id, ...upsertData } = currentProduct;

    let query;
    if (isEditing) {
      query = supabase.from('products').update(upsertData).eq('id', id);
    } else {
      query = supabase.from('products').insert([upsertData]);
    }

    const { error } = await query;

    if (error) {
      addNotification(`저장 실패: ${error.message}`, 'error');
    } else {
      addNotification('성공적으로 저장되었습니다.', 'success');
      fetchProducts();
      handleClose();
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCurrentProduct(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleTagsChange = (event, newTags) => {
    setCurrentProduct(prev => ({ ...prev, tags: newTags }));
  };

  const handleFileUpload = async (event) => {
    if (!hasPermission('products:edit')) {
      addNotification('상품을 업로드할 권한이 없습니다.', 'error');
      return;
    }
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        const productsToUpload = json.map(row => ({
          name: row['상품명'],
          product_code: row['상품코드'],
          category: row['카테고리'],
          sub_category: row['하위카테고리'] || null,
          list_price: parseFloat(row['정가']) || 0,
          notes: row['비고'] || null,
          is_discountable: row['할인여부'] === 'TRUE' || row['할인여부'] === 'Y',
          is_popular: row['인기상품'] === 'TRUE' || row['인기상품'] === 'Y',
          is_new: row['신상여부'] === 'TRUE' || row['신상여부'] === 'Y',
          tags: row['태그'] ? row['태그'].split(',').map(tag => tag.trim()) : [],
        }));

        const { data: invokeData, error: invokeError } = await supabase.functions.invoke('upload-products-excel', {
          body: { products: productsToUpload },
        });

        if (invokeError) throw invokeError;
        if (invokeData.error) throw new Error(invokeData.error);

        addNotification(`엑셀 업로드 성공: ${invokeData.message}`, 'success');
        fetchProducts();
      } catch (error) {
        addNotification(`엑셀 업로드 실패: ${error.message}`, 'error');
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      { '상품명': '예시 상품명', '상품코드': 'PROD001', '카테고리': '도서', '하위카테고리': '심리학', '정가': 15000, '비고': '상품 설명', '할인여부': 'TRUE', '인기상품': 'FALSE', '신상여부': 'TRUE', '태그': '신경정신,치매' },
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '상품_업로드_양식');
    XLSX.writeFile(workbook, '상품_업로드_양식.xlsx');
    addNotification('엑셀 양식 파일이 다운로드되었습니다.', 'success');
  };

  const handleDownloadExcel = async () => {
    try {
      const allProducts = await fetchAllProducts();
      const dataForExcel = allProducts.map(product => ({
        '상품명': product.name,
        '상품코드': product.product_code,
        '카테고리': product.category,
        '하위카테고리': product.sub_category || '',
        '정가': product.list_price,
        '비고': product.notes || '',
        '할인여부': product.is_discountable ? 'TRUE' : 'FALSE',
        '인기상품': product.is_popular ? 'TRUE' : 'FALSE',
        '신상여부': product.is_new ? 'TRUE' : 'FALSE',
        '태그': product.tags?.join(',') || '',
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '상품_목록');
      XLSX.writeFile(workbook, '상품_목록.xlsx');
      addNotification('현재 상품 목록이 엑셀 파일로 다운로드되었습니다.', 'success');
    } catch (error) {
      addNotification(`엑셀 다운로드 실패: ${error.message}`, 'error');
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setCurrentPage(1);
  };

  if (!user || !hasPermission('products:view')) {
    return <Box sx={{ p: 3 }}><Typography>상품 관리 페이지 접근 권한이 없습니다.</Typography></Box>;
  }

  const totalDiscountable = totalDiscountableCount;
  const totalPopular = totalPopularCount;
  const hasFilters = searchTerm || selectedCategory;

  const displayedProducts = productQuickFilter === 'discountable'
    ? products.filter(p => p.is_discountable)
    : productQuickFilter === 'popular'
    ? products.filter(p => p.is_popular)
    : products;

  const statCardSx = (active) => ({
    cursor: 'pointer',
    transition: 'box-shadow 0.2s, transform 0.15s',
    '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' },
    ...(active ? { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '2px' } : {}),
  });

  return (
    <Box>
      {/* Header with Stats */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CategoryIcon sx={{ color: 'primary.main', fontSize: '1.4rem' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
              상품 관리
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="양식 다운로드">
              <IconButton
                onClick={handleDownloadTemplate}
                sx={{
                  bgcolor: alpha(theme.palette.info.main, 0.1),
                  '&:hover': { bgcolor: alpha(theme.palette.info.main, 0.2) }
                }}
              >
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="엑셀 다운로드">
              <IconButton
                onClick={handleDownloadExcel}
                sx={{
                  bgcolor: alpha(theme.palette.success.main, 0.1),
                  '&:hover': { bgcolor: alpha(theme.palette.success.main, 0.2) }
                }}
              >
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            {hasPermission('products:edit') && (
              <>
                <Tooltip title="엑셀 업로드">
                  <IconButton
                    component="label"
                    sx={{
                      bgcolor: alpha(theme.palette.warning.main, 0.1),
                      '&:hover': { bgcolor: alpha(theme.palette.warning.main, 0.2) }
                    }}
                  >
                    <UploadIcon />
                    <input type="file" accept=".xlsx, .xls" hidden onChange={handleFileUpload} ref={fileInputRef} />
                  </IconButton>
                </Tooltip>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpen()}
                  sx={{ ml: 1 }}
                >
                  새 상품 추가
                </Button>
              </>
            )}
          </Box>
        </Box>

        {/* Stats Cards */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Card onClick={() => setProductQuickFilter(null)} sx={{ flex: '1 1 180px',
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.primary.main, productQuickFilter === null ? 0.6 : 0.2)}`,
            ...statCardSx(productQuickFilter === null),
          }}>
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
          <Card onClick={() => setProductQuickFilter(f => f === 'discountable' ? null : 'discountable')} sx={{ flex: '1 1 180px',
            background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.success.main, productQuickFilter === 'discountable' ? 0.6 : 0.2)}`,
            ...statCardSx(productQuickFilter === 'discountable'),
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>할인 가능</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'success.main' }}>{totalDiscountable}</Typography>
                </Box>
                <TagIcon sx={{ fontSize: 40, color: alpha(theme.palette.success.main, 0.5) }} />
              </Box>
            </CardContent>
          </Card>
          <Card onClick={() => setProductQuickFilter(f => f === 'popular' ? null : 'popular')} sx={{ flex: '1 1 180px',
            background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.1)} 0%, ${alpha(theme.palette.warning.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.warning.main, productQuickFilter === 'popular' ? 0.6 : 0.2)}`,
            ...statCardSx(productQuickFilter === 'popular'),
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>인기 상품</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'warning.main' }}>{totalPopular}</Typography>
                </Box>
                <TrendingUpIcon sx={{ fontSize: 40, color: alpha(theme.palette.warning.main, 0.5) }} />
              </Box>
            </CardContent>
          </Card>
          <Card sx={{ flex: '1 1 180px',
            background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.1)} 0%, ${alpha(theme.palette.info.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>카테고리</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'info.main' }}>{categories.length}</Typography>
                </Box>
                <SearchIcon sx={{ fontSize: 40, color: alpha(theme.palette.info.main, 0.5) }} />
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              label="상품명 검색"
              variant="outlined"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ flexGrow: 1, minWidth: 200 }}
              size="small"
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
            <FormControl variant="outlined" sx={{ minWidth: 200 }} size="small">
              <InputLabel>카테고리</InputLabel>
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                label="카테고리"
              >
                <MenuItem value="">
                  <em>전체</em>
                </MenuItem>
                {categories.map((cat) => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {hasFilters && (
              <Button
                variant="outlined"
                onClick={handleResetFilters}
                size="small"
              >
                필터 초기화
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableCell sx={{ fontWeight: 'bold' }}>상품명</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>카테고리</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>하위 카테고리</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">정가</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>비고</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">상태 태그</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>태그</TableCell>
                {hasPermission('products:edit') && <TableCell sx={{ fontWeight: 'bold' }} align="center">작업</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableSkeleton rows={10} columns={11} />
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} sx={{ border: 0, py: 4 }}>
                    <EmptyState
                      message={hasFilters ? "검색 결과가 없습니다" : "등록된 상품이 없습니다"}
                      subMessage={hasFilters ? "다른 검색어나 필터를 시도해보세요" : "새 상품을 추가하여 시작하세요"}
                      icon={<InventoryIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
                      action={hasFilters ? {
                        label: "필터 초기화",
                        onClick: handleResetFilters
                      } : hasPermission('products:edit') ? {
                        label: "상품 추가",
                        onClick: () => handleOpen()
                      } : null}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                displayedProducts.map((product) => (
                  <TableRow
                    key={product.id}
                    sx={{
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) },
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <TableCell sx={{ fontWeight: 500 }}>{product.name}</TableCell>
                    <TableCell>
                      <Chip label={product.category} size="small" color="primary" variant="outlined" />
                    </TableCell>
                    <TableCell>{product.sub_category || '-'}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {product.list_price.toLocaleString()}원
                    </TableCell>
                    <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {product.notes || '-'}
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center', width: 100, mx: 'auto' }}>
                        {product.is_popular && <Chip label="인기" size="small" color="warning" sx={{ height: 20, fontSize: '0.7rem' }} />}
                        {product.is_new && <Chip label="신규출시" size="small" color="primary" sx={{ height: 20, fontSize: '0.7rem' }} />}
                        {product.is_discountable && <Chip label="할인" size="small" color="success" sx={{ height: 20, fontSize: '0.7rem', bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.main', border: 0 }} />}
                        {!product.is_popular && !product.is_new && !product.is_discountable && <Typography variant="caption" color="text.secondary">-</Typography>}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {product.tags?.slice(0, 2).map((tag, idx) => (
                          <Chip key={idx} label={tag} size="small" variant="outlined" />
                        ))}
                        {product.tags?.length > 2 && (
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
                          sx={{
                            color: 'primary.main',
                            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) }
                          }}
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

        {/* Pagination */}
        {products.length > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderTop: 1, borderColor: 'divider' }}>
            <FormControl variant="outlined" size="small">
              <InputLabel>페이지당 항목 수</InputLabel>
              <Select
                value={productsPerPage}
                onChange={(e) => {
                  setProductsPerPage(parseInt(e.target.value, 10));
                  setCurrentPage(1);
                }}
                label="페이지당 항목 수"
              >
                <MenuItem value={10}>10</MenuItem>
                <MenuItem value={25}>25</MenuItem>
                <MenuItem value={50}>50</MenuItem>
                <MenuItem value={100}>100</MenuItem>
              </Select>
            </FormControl>
            <Pagination
              count={Math.ceil(totalProducts / productsPerPage)}
              page={currentPage}
              onChange={(event, value) => setCurrentPage(value)}
              color="primary"
            />
          </Box>
        )}
      </Card>

      {/* Edit/Add Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          {isEditing ? '상품 수정' : '새 상품 추가'}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              autoFocus
              name="name"
              label="상품명"
              type="text"
              fullWidth
              value={currentProduct?.name || ''}
              onChange={handleChange}
              disabled={!hasPermission('products:edit')}
            />
            <TextField
              name="product_code"
              label="상품 코드"
              type="text"
              fullWidth
              value={currentProduct?.product_code || ''}
              onChange={handleChange}
              disabled={!hasPermission('products:edit')}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                name="category"
                label="카테고리"
                type="text"
                fullWidth
                value={currentProduct?.category || ''}
                onChange={handleChange}
                disabled={!hasPermission('products:edit')}
              />
              <TextField
                name="sub_category"
                label="하위 카테고리"
                type="text"
                fullWidth
                value={currentProduct?.sub_category || ''}
                onChange={handleChange}
                disabled={!hasPermission('products:edit')}
              />
            </Box>
            <TextField
              name="list_price"
              label="정가"
              type="number"
              fullWidth
              value={currentProduct?.list_price || 0}
              onChange={handleChange}
              disabled={!hasPermission('products:edit')}
            />
            <TextField
              name="notes"
              label="비고"
              type="text"
              fullWidth
              multiline
              rows={3}
              value={currentProduct?.notes || ''}
              onChange={handleChange}
              disabled={!hasPermission('products:edit')}
            />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={currentProduct?.is_discountable || false}
                    onChange={(e) => setCurrentProduct(prev => ({ ...prev, is_discountable: e.target.checked }))}
                    name="is_discountable"
                    color="primary"
                    disabled={!hasPermission('products:edit')}
                  />
                }
                label="할인 가능"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={currentProduct?.is_popular || false}
                    onChange={(e) => setCurrentProduct(prev => ({ ...prev, is_popular: e.target.checked }))}
                    name="is_popular"
                    color="primary"
                    disabled={!hasPermission('products:edit')}
                  />
                }
                label="인기 상품"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={currentProduct?.is_new || false}
                    onChange={(e) => setCurrentProduct(prev => ({ ...prev, is_new: e.target.checked }))}
                    name="is_new"
                    color="primary"
                    disabled={!hasPermission('products:edit')}
                  />
                }
                label="신상품"
              />
            </Box>
            <Autocomplete
              multiple
              freeSolo
              options={availableTags}
              value={currentProduct?.tags || []}
              onChange={handleTagsChange}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip variant="outlined" label={option} {...getTagProps({ index })} key={index} />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="태그"
                  placeholder="태그 추가"
                  fullWidth
                />
              )}
              disabled={!hasPermission('products:edit')}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleClose}>취소</Button>
          {hasPermission('products:edit') && (
            <Button onClick={handleSave} variant="contained">
              저장
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProductManagementPage;