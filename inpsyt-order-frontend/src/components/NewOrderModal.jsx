import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, TextField, IconButton,
  FormControlLabel, Checkbox, Select, MenuItem,
  FormControl, InputLabel, Chip, Divider, InputAdornment,
  CircularProgress, Stack, alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { supabase } from '../supabaseClient';
import { useNotification } from '../hooks/useNotification';

const statusLabel = {
  pending: '결제대기',
  paid: '결제완료',
};

const NewOrderModal = ({ open, onClose, onSuccess, events = [], products = [], settings = {} }) => {
  const { addNotification } = useNotification();
  const [saving, setSaving] = useState(false);

  // Customer info
  const [isOnSite, setIsOnSite] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [initialStatus, setInitialStatus] = useState('pending');

  // Event selection
  const [selectedEventId, setSelectedEventId] = useState('');

  // Product search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Cart: [{ product, quantity }]
  const [cart, setCart] = useState([]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setIsOnSite(false);
      setName('');
      setPhone('');
      setAddress('');
      setInitialStatus('pending');
      setSelectedEventId('');
      setSearchTerm('');
      setSelectedCategory('all');
      setCart([]);
    }
  }, [open]);

  // Derived: selected event
  const selectedEvent = useMemo(
    () => events.find(e => e.id === selectedEventId) || null,
    [events, selectedEventId],
  );
  const discountRate = selectedEvent?.discount_rate || 0;

  // Phone formatter
  const handlePhoneChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    let fmt = raw;
    if (raw.length > 3 && raw.length <= 7) fmt = `${raw.slice(0, 3)}-${raw.slice(3)}`;
    else if (raw.length > 7) fmt = `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
    setPhone(fmt);
  };

  // Categories from products
  const categories = useMemo(() => {
    const known = ['도서', '검사'];
    const extracted = [...new Set(products.map(p => p.category).filter(Boolean))];
    return [...new Set([...known, ...extracted])];
  }, [products]);

  // Filtered products for search list
  const filteredProducts = useMemo(() => {
    let list = products;
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      list = list.filter(p => p.name?.toLowerCase().includes(lower));
    } else {
      // default: popular only
      list = list.filter(p => p.is_popular);
    }
    if (selectedCategory !== 'all') {
      list = list.filter(p => p.category === selectedCategory);
    }
    return list.slice(0, 50);
  }, [products, searchTerm, selectedCategory]);

  // Cart helpers
  const getCartItem = (productId) => cart.find(c => c.product.id === productId);

  const calcDiscountedPrice = (product) =>
    product.is_discountable && discountRate > 0
      ? Math.round(product.list_price * (1 - discountRate))
      : product.list_price;

  const handleAddToCart = (product) => {
    if (getCartItem(product.id)) return;
    setCart(prev => [...prev, { product, quantity: 1 }]);
  };

  const handleIncrement = (productId) => {
    setCart(prev => prev.map(c => c.product.id === productId ? { ...c, quantity: c.quantity + 1 } : c));
  };

  const handleDecrement = (productId) => {
    setCart(prev =>
      prev
        .map(c => c.product.id === productId ? { ...c, quantity: c.quantity - 1 } : c)
        .filter(c => c.quantity > 0)
    );
  };

  const handleRemoveFromCart = (productId) => {
    setCart(prev => prev.filter(c => c.product.id !== productId));
  };

  // Calculations
  const { totalAmount, discountAmount, shippingCost, finalPayment } = useMemo(() => {
    const originalSubtotal = cart.reduce((sum, c) => sum + (c.product.list_price || 0) * c.quantity, 0);
    const discountedSubtotal = cart.reduce((sum, c) => sum + calcDiscountedPrice(c.product) * c.quantity, 0);
    const calcDiscount = originalSubtotal - discountedSubtotal;
    const freeThreshold = settings.free_shipping_threshold ?? 30000;
    const shipCost = settings.shipping_cost ?? 3000;
    const calcShipping = discountedSubtotal > 0 && discountedSubtotal < freeThreshold ? shipCost : 0;
    return {
      totalAmount: originalSubtotal,
      discountAmount: calcDiscount,
      shippingCost: calcShipping,
      finalPayment: discountedSubtotal + calcShipping,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, discountRate, settings]);

  const handleSave = async () => {
    if (!isOnSite && !name.trim()) {
      addNotification('고객명을 입력해주세요.', 'warning'); return;
    }
    if (!selectedEventId) {
      addNotification('학회(행사)를 선택해주세요.', 'warning'); return;
    }
    if (cart.length === 0) {
      addNotification('상품을 1개 이상 담아주세요.', 'warning'); return;
    }

    setSaving(true);
    try {
      const customerName = isOnSite ? `현장판매_${Date.now()}` : name.trim();
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_name: customerName,
          phone_number: phone || null,
          shipping_address: address.trim() ? { address: address.trim(), postcode: '', detail: '' } : null,
          event_id: selectedEventId,
          is_on_site_sale: isOnSite,
          status: initialStatus,
          total_amount: totalAmount,
          discount_amount: discountAmount,
          shipping_cost: shippingCost,
          final_payment: finalPayment,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = cart.map(c => ({
        order_id: orderData.id,
        product_id: c.product.id,
        quantity: c.quantity,
        price_at_purchase: calcDiscountedPrice(c.product),
      }));
      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      addNotification('신규 주문이 추가되었습니다.', 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      addNotification(`주문 추가 실패: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => (b.start_date || '').localeCompare(a.start_date || '')),
    [events],
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>신규 주문 추가</Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, minHeight: 500 }}>

          {/* ── LEFT PANEL: Customer + Event ── */}
          <Box sx={{ flex: '0 0 320px', p: 3, borderRight: { sm: '1px solid' }, borderColor: { sm: 'divider' }, display: 'flex', flexDirection: 'column', gap: 2.5 }}>

            <FormControlLabel
              control={
                <Checkbox
                  checked={isOnSite}
                  onChange={(e) => {
                    setIsOnSite(e.target.checked);
                    if (e.target.checked) { setName(''); setPhone(''); setAddress(''); }
                  }}
                />
              }
              label={<Typography variant="body2" sx={{ fontWeight: 600 }}>현장판매 (익명)</Typography>}
            />

            <FormControl fullWidth size="small" required>
              <InputLabel>학회 / 행사 *</InputLabel>
              <Select
                value={selectedEventId}
                label="학회 / 행사 *"
                onChange={e => setSelectedEventId(e.target.value)}
              >
                {sortedEvents.map(ev => (
                  <MenuItem key={ev.id} value={ev.id}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>{ev.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {ev.start_date} {ev.discount_rate > 0 && `· 할인 ${Math.round(ev.discount_rate * 100)}%`}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {!isOnSite && (
              <>
                <TextField
                  fullWidth
                  size="small"
                  label="고객명 *"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>,
                  }}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="연락처"
                  value={phone}
                  onChange={handlePhoneChange}
                  inputProps={{ maxLength: 13 }}
                  placeholder="010-0000-0000"
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><PhoneIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>,
                  }}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="주소 (선택)"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><HomeIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>,
                  }}
                />
              </>
            )}

            <FormControl fullWidth size="small">
              <InputLabel>초기 상태</InputLabel>
              <Select value={initialStatus} label="초기 상태" onChange={e => setInitialStatus(e.target.value)}>
                <MenuItem value="pending">결제대기</MenuItem>
                <MenuItem value="paid">결제완료</MenuItem>
              </Select>
            </FormControl>

            {/* ── Order Summary ── */}
            {cart.length > 0 && (
              <Box sx={{ mt: 'auto', pt: 2 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>주문 요약</Typography>
                <Stack spacing={0.75}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">총 상품금액</Typography>
                    <Typography variant="body2">{totalAmount.toLocaleString()}원</Typography>
                  </Box>
                  {discountAmount > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="error.main">할인</Typography>
                      <Typography variant="body2" color="error.main">- {discountAmount.toLocaleString()}원</Typography>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">배송비</Typography>
                    <Typography variant="body2">{shippingCost > 0 ? `${shippingCost.toLocaleString()}원` : '무료'}</Typography>
                  </Box>
                  <Divider />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>최종 결제금액</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: 'primary.main' }}>{finalPayment.toLocaleString()}원</Typography>
                  </Box>
                </Stack>
              </Box>
            )}
          </Box>

          {/* ── RIGHT PANEL: Product search + Cart ── */}
          <Box sx={{ flex: 1, p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>

            {/* Search */}
            <TextField
              fullWidth
              size="small"
              placeholder="상품명으로 검색"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'text.disabled' }} /></InputAdornment>,
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  bgcolor: '#F2F4F6',
                  '& fieldset': { borderColor: 'transparent' },
                  '&:hover fieldset': { borderColor: 'transparent' },
                  '&.Mui-focused fieldset': { borderColor: 'primary.main' },
                },
              }}
            />

            {/* Category chips */}
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              {['all', ...categories].map(cat => (
                <Chip
                  key={cat}
                  label={cat === 'all' ? '전체' : cat}
                  size="small"
                  variant={selectedCategory === cat ? 'filled' : 'outlined'}
                  color={selectedCategory === cat ? 'primary' : 'default'}
                  onClick={() => setSelectedCategory(cat)}
                  sx={{ borderRadius: '8px', fontWeight: selectedCategory === cat ? 700 : 500, cursor: 'pointer' }}
                />
              ))}
            </Box>

            {/* Product list */}
            <Box sx={{ flex: 1, overflowY: 'auto', maxHeight: 280, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              {filteredProducts.length === 0 ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 100 }}>
                  <Typography variant="body2" color="text.secondary">
                    {searchTerm ? '검색 결과가 없습니다' : '인기 상품이 없습니다'}
                  </Typography>
                </Box>
              ) : (
                filteredProducts.map(product => {
                  const inCart = !!getCartItem(product.id);
                  const discounted = calcDiscountedPrice(product);
                  const isDisc = product.is_discountable && discountRate > 0;
                  return (
                    <Box
                      key={product.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        px: 2,
                        py: 1.25,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        '&:last-child': { borderBottom: 'none' },
                        bgcolor: inCart ? alpha('#1976d2', 0.04) : 'transparent',
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {product.name}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
                          {product.category && (
                            <Chip label={product.category} size="small" sx={{ height: 16, fontSize: '0.65rem', borderRadius: '4px' }} />
                          )}
                          <Typography variant="caption" color="text.secondary">
                            {isDisc ? (
                              <>
                                <span style={{ textDecoration: 'line-through', marginRight: 4 }}>{product.list_price?.toLocaleString()}원</span>
                                <span style={{ color: '#d32f2f', fontWeight: 700 }}>{discounted.toLocaleString()}원</span>
                              </>
                            ) : (
                              `${product.list_price?.toLocaleString()}원`
                            )}
                          </Typography>
                        </Box>
                      </Box>
                      {inCart ? (
                        <Chip label="담김" size="small" color="primary" variant="outlined" sx={{ ml: 1, borderRadius: '8px', fontWeight: 600, fontSize: '0.7rem' }} />
                      ) : (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleAddToCart(product)}
                          sx={{ ml: 1, minWidth: 48, borderRadius: '8px', fontWeight: 700, fontSize: '0.75rem', px: 1 }}
                        >
                          담기
                        </Button>
                      )}
                    </Box>
                  );
                })
              )}
            </Box>

            {/* Cart */}
            {cart.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  장바구니 ({cart.length}종)
                </Typography>
                <Stack spacing={0.5}>
                  {cart.map(({ product, quantity }) => {
                    const discounted = calcDiscountedPrice(product);
                    return (
                      <Box
                        key={product.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          px: 1.5,
                          py: 1,
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: 'grey.50',
                        }}
                      >
                        <Typography variant="body2" sx={{ flex: 1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {product.name}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 700, minWidth: 72, textAlign: 'right' }}>
                          {(discounted * quantity).toLocaleString()}원
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <IconButton size="small" onClick={() => handleDecrement(product.id)} sx={{ width: 24, height: 24 }}>
                            <RemoveIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                          <Typography variant="body2" sx={{ minWidth: 20, textAlign: 'center', fontWeight: 700 }}>{quantity}</Typography>
                          <IconButton size="small" onClick={() => handleIncrement(product.id)} sx={{ width: 24, height: 24 }}>
                            <AddIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Box>
                        <IconButton size="small" onClick={() => handleRemoveFromCart(product.id)} sx={{ width: 24, height: 24, color: 'text.disabled' }}>
                          <CloseIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={saving}>취소</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || cart.length === 0}
          startIcon={saving ? <CircularProgress size={16} /> : null}
        >
          {saving ? '저장 중...' : '주문 추가'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NewOrderModal;
