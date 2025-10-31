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
  Snackbar,
  Alert,
  FormControlLabel,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Chip,
  Pagination,
} from '@mui/material';
import { fetchProducts as fetchProductsApi, fetchAllProducts } from '../api/products';
import { useNotification } from '../hooks/useNotification';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';
import { useAuth } from '../hooks/useAuth'; // useAuth 임포트

const ProductManagementPage = () => {
  const [products, setProducts] = useState([]);
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const { user, hasPermission } = useAuth(); // user와 hasPermission 가져오기
  const { addNotification } = useNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [availableTags, setAvailableTags] = useState([]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1); 
  const [productsPerPage, setProductsPerPage] = useState(50);
  const [totalProducts, setTotalProducts] = useState(0);

  const fileInputRef = useRef(null);

  const categories = ['도서', '검사', '도구'];

  const fetchProducts = useCallback(async () => {
    const { data, count, error } = await fetchProductsApi({ 
      searchTerm,
      category: selectedCategory,
      currentPage,
      productsPerPage,
    });

    if (error) {
      addNotification(`상품 목록을 불러오는 데 실패했습니다: ${error.message}`, 'error');
    } else {
      setProducts(data);
      setTotalProducts(count);
      const allTags = data.flatMap(product => product.tags || []);
      setAvailableTags(Array.from(new Set(allTags)));
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
    setCurrentProduct(product || { name: '', product_code: '', category: '', sub_category: '', list_price: 0, notes: '', is_discountable: false, is_popular: false, tags: [] });
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
    console.log('handleSave - upsertData:', upsertData); // Debug log

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
    console.log('handleChange - name:', name, 'value:', value, 'type:', type, 'checked:', checked); // Debug log
    setCurrentProduct(prev => {
      const newState = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      };
      console.log('handleChange - new currentProduct state:', newState); // Debug log
      return newState;
    });
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

        // Map JSON data to match Supabase table columns
        const productsToUpload = json.map(row => ({
          name: row['상품명'],
          product_code: row['상품코드'],
          category: row['카테고리'],
          sub_category: row['하위카테고리'] || null,
          list_price: parseFloat(row['정가']) || 0,
          notes: row['비고'] || null,
          is_discountable: row['할인여부'] === 'TRUE' || row['할인여부'] === 'Y',
          is_popular: row['인기상품'] === 'TRUE' || row['인기상품'] === 'Y',
          tags: row['태그'] ? row['태그'].split(',').map(tag => tag.trim()) : [],
        }));

        const { data: invokeData, error: invokeError } = await supabase.functions.invoke('upload-products-excel', {
          body: { products: productsToUpload },
        });

        if (invokeError) throw invokeError;
        if (invokeData.error) throw new Error(invokeData.error);

        addNotification(`엑셀 업로드 성공: ${invokeData.message}`, 'success');
        fetchProducts(); // Refresh product list
      } catch (error) {
        addNotification(`엑셀 업로드 실패: ${error.message}`, 'error');
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = ''; // Clear file input
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      { '상품명': '예시 상품명', '상품코드': 'PROD001', '카테고리': '도서', '하위카테고리': '심리학', '정가': 15000, '비고': '상품 설명', '할인여부': 'TRUE', '인기상품': 'FALSE', '태그': '신경정신,치매' },
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

  if (!user || !hasPermission('products:view')) {
    return <Box sx={{ p: 3 }}><Typography>상품 관리 페이지 접근 권한이 없습니다.</Typography></Box>;
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">상품 관리</Typography>
        <Box>
          {hasPermission('products:edit') && <Button variant="contained" onClick={() => handleOpen()} sx={{ mr: 1 }}>새 상품 추가</Button>}
          <Button variant="outlined" onClick={handleDownloadTemplate} sx={{ mr: 1 }}>양식 다운로드</Button>
          <Button variant="outlined" onClick={handleDownloadExcel} sx={{ mr: 1 }}>엑셀 다운로드</Button>
          {hasPermission('products:edit') && (
            <Button variant="outlined" component="label">
              엑셀 업로드
              <input type="file" accept=".xlsx, .xls" hidden onChange={handleFileUpload} ref={fileInputRef} />
            </Button>
          )}
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          label="상품명 검색"
          variant="outlined"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ flexGrow: 1 }}
        />
        <FormControl variant="outlined" sx={{ minWidth: 200 }}>
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
      </Box>
      <TableContainer sx={{ mt: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>상품명</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>카테고리</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>하위 카테고리</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>상품 코드</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="right">정가</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>비고</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>할인 가능</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>인기 상품</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>태그</TableCell>
              {hasPermission('products:edit') && <TableCell sx={{ fontWeight: 'bold' }} align="center">작업</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell>{product.name}</TableCell>
                <TableCell>{product.category}</TableCell>
                <TableCell>{product.sub_category}</TableCell>
                <TableCell>{product.product_code}</TableCell>
                <TableCell align="right">{product.list_price.toLocaleString()}원</TableCell>
                <TableCell>{product.notes}</TableCell>
                <TableCell>{product.is_discountable ? '예' : '아니오'}</TableCell>
                <TableCell>{product.is_popular ? '예' : '아니오'}</TableCell>
                <TableCell>{product.tags?.join(', ')}</TableCell>
                {hasPermission('products:edit') && (
                  <TableCell align="center">
                    <Button variant="outlined" size="small" onClick={() => handleOpen(product)}>수정</Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
        <FormControl variant="outlined" size="small">
          <InputLabel>페이지당 항목 수</InputLabel>
          <Select
            value={productsPerPage}
            onChange={(e) => {
              setProductsPerPage(parseInt(e.target.value, 10));
              setCurrentPage(1); // Reset to first page when items per page changes
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

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>{isEditing ? '상품 수정' : '새 상품 추가'}</DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <TextField autoFocus margin="dense" name="name" label="상품명" type="text" fullWidth value={currentProduct?.name || ''} onChange={handleChange} disabled={!hasPermission('products:edit')} />
          <TextField margin="dense" name="product_code" label="상품 코드" type="text" fullWidth value={currentProduct?.product_code || ''} onChange={handleChange} disabled={!hasPermission('products:edit')} />
          <TextField margin="dense" name="category" label="카테고리" type="text" fullWidth value={currentProduct?.category || ''} onChange={handleChange} disabled={!hasPermission('products:edit')} />
          <TextField margin="dense" name="sub_category" label="하위 카테고리" type="text" fullWidth value={currentProduct?.sub_category || ''} onChange={handleChange} disabled={!hasPermission('products:edit')} />
          <TextField margin="dense" name="list_price" label="정가" type="number" fullWidth value={currentProduct?.list_price || 0} onChange={handleChange} disabled={!hasPermission('products:edit')} />
          <TextField margin="dense" name="notes" label="비고" type="text" fullWidth multiline rows={2} value={currentProduct?.notes || ''} onChange={handleChange} disabled={!hasPermission('products:edit')} />
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
          <Autocomplete
            multiple
            freeSolo
            options={availableTags}
            value={currentProduct?.tags || []}
            onChange={handleTagsChange}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip variant="outlined" label={option} {...getTagProps({ index })} />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                margin="dense"
                label="태그"
                placeholder="태그 추가"
                fullWidth
              />
            )}
            sx={{ mt: 2 }}
            disabled={!hasPermission('products:edit')}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleClose}>취소</Button>
          {hasPermission('products:edit') && <Button onClick={handleSave}>저장</Button>}
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default ProductManagementPage;