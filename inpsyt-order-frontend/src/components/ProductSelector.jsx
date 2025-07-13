import React from 'react';
import {
  Typography,
  List,
  ListItem,
  TextField,
  IconButton,
  Button,
  Autocomplete,
  Card,
  Box,
  Chip
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';

const DISCOUNT_RATE = 0.15; // 15% 할인율

const ProductSelector = ({ products, cart, setCart }) => {

  const handleProductChange = (event, newValue, index) => {
    if (!newValue) return;
    const newCart = [...cart];
    const existingItem = newCart[index];
    newCart[index] = { ...newValue, quantity: existingItem.quantity || 1 };
    setCart(newCart);
  };

  const handleQuantityChange = (index, newQuantity) => {
    if (newQuantity >= 1) {
      const newCart = [...cart];
      newCart[index].quantity = newQuantity;
      setCart(newCart);
    }
  };

  const addCartItem = () => {
    setCart([...cart, { id: null, name: '', quantity: 1, list_price: 0, is_discountable: true }]);
  };

  const removeCartItem = (index) => {
    if (cart.length > 1) {
      const newCart = cart.filter((_, i) => i !== index);
      setCart(newCart);
    } else {
      setCart([{ id: null, name: '', quantity: 1, list_price: 0, is_discountable: true }]);
    }
  };

  return (
    <Card>
      <Typography variant="h5" gutterBottom>상품 선택</Typography>
      <List sx={{ p: 0 }}>
        {cart.map((item, index) => {
          const quantity = item.quantity || 1;
          const totalOriginalPrice = (item.list_price || 0) * quantity;
          const discountedPrice = item.is_discountable ? Math.round(item.list_price * (1 - DISCOUNT_RATE)) : item.list_price;
          const totalDiscountedPrice = discountedPrice * quantity;

          return (
            <ListItem key={index} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', mb: 2, p:0, borderTop: index > 0 ? '1px solid #eee' : 'none', pt: index > 0 ? 2 : 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                 <Autocomplete
                  options={products}
                  getOptionLabel={(option) => option.name || ""}
                  value={products.find(p => p.id === item.id) || null}
                  onChange={(event, newValue) => handleProductChange(event, newValue, index)}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderInput={(params) => <TextField {...params} variant="standard" label={`상품 ${index + 1}`} />}
                  sx={{ flexGrow: 1 }}
                />
                <TextField
                  type="number"
                  variant="standard"
                  value={quantity}
                  onChange={(e) => handleQuantityChange(index, parseInt(e.target.value, 10) || 1)}
                  inputProps={{ min: 1, style: { textAlign: 'center' } }}
                  sx={{ width: '60px' }}
                />
                <IconButton onClick={() => removeCartItem(index)} size="small">
                  <RemoveCircleOutlineIcon />
                </IconButton>
              </Box>
              {item.id && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, width: '100%', mt: 1.5, pr: '48px' }}>
                   <Chip label={item.category} size="small" />
                   <Typography variant="body2" color="text.secondary" sx={{ textDecoration: item.is_discountable ? 'line-through' : 'none' }}>
                      {totalOriginalPrice.toLocaleString()}원
                   </Typography>
                   {item.is_discountable && (
                      <Typography variant="body2" color="error.main" component="span" sx={{ fontWeight: 'bold' }}>
                        {`→ ${totalDiscountedPrice.toLocaleString()}원`}
                      </Typography>
                   )}
                </Box>
              )}
            </ListItem>
          )
        })}
        <Button startIcon={<AddCircleOutlineIcon />} onClick={addCartItem} sx={{ mt: 1 }}>
          상품 추가하기
        </Button>
      </List>
    </Card>
  );
};

export default ProductSelector;
