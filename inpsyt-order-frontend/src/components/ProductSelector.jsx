import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Autocomplete,
  CircularProgress,
  IconButton,
  Card,
  Stack,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon, Remove as RemoveIcon } from '@mui/icons-material';
import { fetchProducts } from '../api/products';
import { useNotification } from '../hooks/useNotification';

const ProductSelector = ({ selectedProducts, onProductChange, discountRate, eventTags }) => {
  const { addNotification } = useNotification();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadProducts = useCallback(async (search, tagsToFilter = []) => {
    setLoading(true);
    try {
      const { data } = await fetchProducts({ searchTerm: search, tags: tagsToFilter });
      setOptions(data);
    } catch (error) {
      addNotification(`상품 검색에 실패했습니다: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchTerm.length >= 2) {
        loadProducts(searchTerm, eventTags);
      } else if (searchTerm.length === 0 && open) {
        loadProducts('', eventTags);
      } else {
        setOptions([]);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchTerm, open, eventTags, loadProducts]);

  const handleAddProduct = (product) => {
    if (product && !selectedProducts.some(p => p.id === product.id)) {
      onProductChange([...selectedProducts, { ...product, quantity: 1 }]);
    } else if (product) {
      addNotification('이미 추가된 상품입니다.', 'info');
    }
    setSearchTerm('');
    setOptions([]);
  };

  const handleQuantityChange = (productId, newQuantity) => {
    onProductChange(
      selectedProducts.map((p) =>
        p.id === productId ? { ...p, quantity: newQuantity > 0 ? newQuantity : 1 } : p
      )
    );
  };

  const handleRemoveProduct = (productId) => {
    onProductChange(selectedProducts.filter((p) => p.id !== productId));
  };

  const incrementQuantity = (productId) => {
    const product = selectedProducts.find(p => p.id === productId);
    if (product) {
      handleQuantityChange(productId, product.quantity + 1);
    }
  };

  const decrementQuantity = (productId) => {
    const product = selectedProducts.find(p => p.id === productId);
    if (product && product.quantity > 1) {
      handleQuantityChange(productId, product.quantity - 1);
    }
  };

  // Mobile Card View
  const renderMobileView = () => (
    <Stack spacing={2}>
      {selectedProducts.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary', bgcolor: 'background.default', borderRadius: 2 }}>
          <Typography variant="body1">추가된 상품이 없습니다.</Typography>
        </Box>
      ) : (
        selectedProducts.map((product) => {
          const itemTotal = product.is_discountable 
            ? Math.round(product.list_price * (1 - discountRate)) * product.quantity
            : product.list_price * product.quantity;
          
          return (
            <Card key={product.id} elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1, pr: 1, lineHeight: 1.4 }}>
                  {product.name}
                </Typography>
                <IconButton 
                  onClick={() => handleRemoveProduct(product.id)} 
                  size="small" 
                  sx={{ 
                    mt: -0.5, 
                    color: 'text.secondary',
                    '&:hover': { color: 'error.main', bgcolor: 'error.lighter' }
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  정가: {product.list_price.toLocaleString()}원
                </Typography>
                {product.is_discountable && discountRate > 0 && (
                  <Typography variant="caption" sx={{ bgcolor: 'error.light', color: 'white', px: 1, py: 0.5, borderRadius: 1, fontWeight: 'bold' }}>
                    {(discountRate * 100).toFixed(0)}% 할인
                  </Typography>
                )}
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'background.default', p: 1.5, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IconButton 
                    onClick={() => decrementQuantity(product.id)} 
                    size="small"
                    disabled={product.quantity <= 1}
                    sx={{ bgcolor: 'white', boxShadow: 1, width: 32, height: 32 }}
                  >
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      minWidth: 30, 
                      textAlign: 'center',
                      fontWeight: 'bold'
                    }}
                  >
                    {product.quantity}
                  </Typography>
                  <IconButton 
                    onClick={() => incrementQuantity(product.id)} 
                    size="small"
                    sx={{ bgcolor: 'white', boxShadow: 1, width: 32, height: 32 }}
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Box>
                
                <Typography variant="h6" color="primary" sx={{ fontWeight: 800 }}>
                  {itemTotal.toLocaleString()}원
                </Typography>
              </Box>
            </Card>
          );
        })
      )}
    </Stack>
  );

  // Desktop Table View
  const renderDesktopView = () => (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
      <Table size="medium">
        <TableHead>
          <TableRow sx={{ bgcolor: 'background.default' }}>
            <TableCell sx={{ py: 2 }}>상품명</TableCell>
            <TableCell align="right">정가</TableCell>
            <TableCell align="center" sx={{ width: '140px' }}>수량</TableCell>
            <TableCell align="right">합계</TableCell>
            <TableCell align="center" sx={{ width: '80px' }}>삭제</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {selectedProducts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                추가된 상품이 없습니다.
              </TableCell>
            </TableRow>
          ) : (
            selectedProducts.map((product) => {
              const itemTotal = product.is_discountable 
                ? Math.round(product.list_price * (1 - discountRate)) * product.quantity
                : product.list_price * product.quantity;
              
              return (
                <TableRow key={product.id} hover>
                  <TableCell sx={{ fontWeight: 500 }}>
                    {product.name}
                    {product.is_discountable && discountRate > 0 && (
                       <Box component="span" sx={{ ml: 1, bgcolor: 'error.light', color: 'white', px: 0.8, py: 0.2, borderRadius: 0.5, fontSize: '0.7rem' }}>
                         {(discountRate * 100).toFixed(0)}%
                       </Box>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'text.secondary' }}>{product.list_price.toLocaleString()}원</TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      <IconButton size="small" onClick={() => decrementQuantity(product.id)} disabled={product.quantity <= 1}>
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                      <Typography sx={{ fontWeight: 'bold', minWidth: 20, textAlign: 'center' }}>{product.quantity}</Typography>
                      <IconButton size="small" onClick={() => incrementQuantity(product.id)}>
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: '1rem' }}>
                    {itemTotal.toLocaleString()}원
                  </TableCell>
                  <TableCell align="center">
                    <IconButton onClick={() => handleRemoveProduct(product.id)} size="small" color="default" sx={{ '&:hover': { color: 'error.main' } }}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <Card sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>상품 추가</Typography>
      <Autocomplete
        id="product-search-autocomplete"
        open={open}
        onOpen={() => {
          setOpen(true);
          if (searchTerm.length === 0) {
            loadProducts('', eventTags);
          }
        }}
        onClose={() => setOpen(false)}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        getOptionLabel={(option) => option.name || ''}
        options={options}
        loading={loading}
        value={null}
        onChange={(event, newValue) => {
          handleAddProduct(newValue);
        }}
        onInputChange={(event, newInputValue) => {
          setSearchTerm(newInputValue);
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={searchTerm.length === 0 ? "드롭다운을 눌러 인기 상품 보기" : "상품명으로 검색 (2글자 이상)"}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
            sx={{ 
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                bgcolor: 'background.default',
                '& fieldset': { borderColor: 'transparent' },
                '&:hover fieldset': { borderColor: 'primary.light' },
                '&.Mui-focused fieldset': { borderColor: 'primary.main' }
              }
            }}
          />
        )}
        renderOption={(props, option) => (
          <Box component="li" {...props} key={option.id} sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>{option.name}</Typography>
              <Typography variant="caption" color="text.secondary">{option.list_price.toLocaleString()}원</Typography>
            </Box>
          </Box>
        )}
      />

      <Typography variant="h6" sx={{ mt: 4, mb: 2, fontWeight: 600, color: 'text.secondary' }}>주문 상품 목록</Typography>
      {isMobile ? renderMobileView() : renderDesktopView()}
    </Card>
  );
};

export default ProductSelector;