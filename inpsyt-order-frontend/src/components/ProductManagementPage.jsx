import React, { useState, useEffect, useCallback } from 'react';
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
} from '@mui/material';
import { supabase } from '../supabaseClient';
import { useNotification } from '../hooks/useNotification';

const ProductManagementPage = () => {
  const [products, setProducts] = useState([]);
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const { addNotification } = useNotification();

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase.from('products').select('*').order('name');
    if (error) addNotification(`상품 목록을 불러오는 데 실패했습니다: ${error.message}`, 'error');
    else setProducts(data);
  }, [addNotification]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleOpen = (product = null) => {
    setIsEditing(!!product);
    setCurrentProduct(product || { name: '', product_code: '', category: '', sub_category: '', list_price: 0, notes: '', is_discountable: false });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setCurrentProduct(null);
  };

  const handleSave = async () => {
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

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">상품 관리</Typography>
        <Button variant="contained" onClick={() => handleOpen()}>새 상품 추가</Button>
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
              <TableCell sx={{ fontWeight: 'bold' }} align="center">작업</TableCell>
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
                <TableCell align="center">
                  <Button variant="outlined" size="small" onClick={() => handleOpen(product)}>수정</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>{isEditing ? '상품 수정' : '새 상품 추가'}</DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <TextField autoFocus margin="dense" name="name" label="상품명" type="text" fullWidth value={currentProduct?.name || ''} onChange={handleChange} />
          <TextField margin="dense" name="product_code" label="상품 코드" type="text" fullWidth value={currentProduct?.product_code || ''} onChange={handleChange} />
          <TextField margin="dense" name="category" label="카테고리" type="text" fullWidth value={currentProduct?.category || ''} onChange={handleChange} />
          <TextField margin="dense" name="sub_category" label="하위 카테고리" type="text" fullWidth value={currentProduct?.sub_category || ''} onChange={handleChange} />
          <TextField margin="dense" name="list_price" label="정가" type="number" fullWidth value={currentProduct?.list_price || 0} onChange={handleChange} />
          <TextField margin="dense" name="notes" label="비고" type="text" fullWidth multiline rows={2} value={currentProduct?.notes || ''} onChange={handleChange} />
          <FormControlLabel
            control={
              <Checkbox
                checked={currentProduct?.is_discountable || false}
                onChange={(e) => handleChange({ target: { name: 'is_discountable', checked: e.target.checked } })}
                name="is_discountable"
                color="primary"
              />
            }
            label="할인 가능"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleClose}>취소</Button>
          <Button onClick={handleSave}>저장</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default ProductManagementPage;