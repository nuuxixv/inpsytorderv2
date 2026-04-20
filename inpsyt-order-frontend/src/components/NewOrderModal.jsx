import React, { useState, useMemo, useEffect } from 'react';
import DaumPostcode from 'react-daum-postcode';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, TextField, IconButton,
  FormControlLabel, Checkbox, Select, MenuItem,
  FormControl, InputLabel, Chip, Divider, InputAdornment,
  CircularProgress, Stack, alpha, Modal,
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
import { matchesSearch } from '../utils/search';

const postcodeModalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '90%',
  maxWidth: 400,
  bgcolor: 'background.paper',
  boxShadow: 24,
  borderRadius: 2,
  overflow: 'hidden',
  zIndex: 1400,
};

const getEventStatus = (startDate, endDate) => {
  const now = new Date();
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  if (!start || !end) return null;
  if (now < start) return { label: '예정', color: '#0984e3' };
  if (now > end) return { label: '종료', color: '#b2bec3' };
  return { label: '진행중', color: '#00b894' };
};

const NewOrderModal = ({ open, onClose, onSuccess, events = [], products = [], settings = {} }) => {
  const { addNotification } = useNotification();
  const [saving, setSaving] = useState(false);

  // Customer info
  const [isOnSite, setIsOnSite] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [postcode, setPostcode] = useState('');
  const [address, setAddress] = useState('');
  const [detailAddress, setDetailAddress] = useState('');
  const [postcodeOpen, setPostcodeOpen] = useState(false);

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
      setPostcode('');
      setAddress('');
      setDetailAddress('');
      setSelectedEventId('');
      setSearchTerm('');
      setSelectedCategory('all');
      setCart([]);
    }
  }, [open]);

  // Daum postcode
  const handleCompletePostcode = (data) => {
    let fullAddress = data.address;
    let extraAddress = '';
    if (data.addressType === 'R') {
      if (data.bname !== '') extraAddress += data.bname;
      if (data.buildingName !== '') extraAddress += (extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName);
      fullAddress += (extraAddress !== '' ? ` (${extraAddress})` : '');
    }
    setPostcode(data.zonecode);
    setAddress(fullAddress);
    setPostcodeOpen(false);
  };

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
      list = list.filter(p => matchesSearch(p.name, searchTerm));
    } else {
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

  // Calculations — 현장판매 시 배송비 없음
  const { totalAmount, discountAmount, deliveryFee, finalPayment } = useMemo(() => {
    const originalSubtotal = cart.reduce((sum, c) => sum + (c.product.list_price || 0) * c.quantity, 0);
    const discountedSubtotal = cart.reduce((sum, c) => sum + calcDiscountedPrice(c.product) * c.quantity, 0);
    const calcDiscount = originalSubtotal - discountedSubtotal;
    const freeThreshold = settings.free_shipping_threshold ?? 30000;
    const shipCost = settings.shipping_cost ?? 3000;
    const fee = isOnSite ? 0 : (discountedSubtotal > 0 && discountedSubtotal < freeThreshold ? shipCost : 0);
    return {
      totalAmount: originalSubtotal,
      discountAmount: calcDiscount,
      deliveryFee: fee,
      finalPayment: discountedSubtotal + fee,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, discountRate, settings, isOnSite]);

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
      const shippingAddress = !isOnSite && (address.trim() || postcode)
        ? { postcode, address: address.trim(), detail: detailAddress.trim() }
        : null;

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_name: customerName,
          phone_number: phone || null,
          shipping_address: shippingAddress,
          event_id: selectedEventId,
          is_on_site_sale: isOnSite,
          status: 'pending',
          total_cost: totalAmount,
          discount_amount: discountAmount,
          delivery_fee: deliveryFee,
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
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>신규 주문 추가</Typography>
          <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 0, overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, height: { sm: 560 } }}>

            {/* ── LEFT PANEL ── */}
            <Box sx={{
              flex: '0 0 300px',
              p: 2.5,
              borderRight: { sm: '1px solid' },
              borderColor: { sm: 'divider' },
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              overflowY: 'auto',
            }}>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={isOnSite}
                    onChange={(e) => {
                      setIsOnSite(e.target.checked);
                      if (e.target.checked) { setName(''); setPhone(''); setPostcode(''); setAddress(''); setDetailAddress(''); }
                    }}
                  />
                }
                label={<Typography variant="body2" sx={{ fontWeight: 600 }}>현장판매</Typography>}
              />

              <FormControl fullWidth size="small" required>
                <InputLabel>학회 / 행사 *</InputLabel>
                <Select
                  value={selectedEventId}
                  label="학회 / 행사 *"
                  onChange={e => setSelectedEventId(e.target.value)}
                >
                  {sortedEvents.map(ev => {
                    const status = getEventStatus(ev.start_date, ev.end_date);
                    return (
                      <MenuItem key={ev.id} value={ev.id}>
                        <Box sx={{ width: '100%' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            {status && (
                              <Box component="span" sx={{
                                fontSize: '0.6rem', fontWeight: 700, px: 0.75, py: 0.25,
                                borderRadius: '4px', bgcolor: alpha(status.color, 0.12),
                                color: status.color, flexShrink: 0,
                              }}>
                                {status.label}
                              </Box>
                            )}
                            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                              {ev.name}
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {ev.start_date}{ev.discount_rate > 0 && ` · 할인 ${Math.round(ev.discount_rate * 100)}%`}
                          </Typography>
                        </Box>
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>

              {!isOnSite && (
                <>
                  <TextField
                    fullWidth size="small" label="고객명 *"
                    value={name} onChange={e => setName(e.target.value)}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>,
                    }}
                  />
                  <TextField
                    fullWidth size="small" label="연락처"
                    value={phone} onChange={handlePhoneChange}
                    inputProps={{ maxLength: 13 }} placeholder="010-0000-0000"
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><PhoneIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>,
                    }}
                  />
                  <TextField
                    fullWidth size="small" label="주소 검색"
                    value={address}
                    onClick={() => setPostcodeOpen(true)}
                    InputProps={{
                      readOnly: true,
                      startAdornment: <InputAdornment position="start"><HomeIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>,
                      endAdornment: (
                        <InputAdornment position="end">
                          <Button size="small" variant="outlined" onClick={() => setPostcodeOpen(true)}
                            sx={{ minWidth: 'auto', px: 1, py: 0.25, fontSize: '0.7rem', borderRadius: 1 }}>
                            검색
                          </Button>
                        </InputAdornment>
                      ),
                    }}
                    sx={{ cursor: 'pointer', '& .MuiInputBase-root': { cursor: 'pointer' } }}
                  />
                  {address && (
                    <TextField
                      fullWidth size="small" label="상세주소"
                      value={detailAddress} onChange={e => setDetailAddress(e.target.value)}
                    />
                  )}
                </>
              )}

              {/* ── Order Summary ── */}
              {cart.length > 0 && (
                <Box sx={{ mt: 'auto', pt: 1.5 }}>
                  <Divider sx={{ mb: 1.5 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>주문 요약</Typography>
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
                    {!isOnSite && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">배송비</Typography>
                        <Typography variant="body2">{deliveryFee > 0 ? `${deliveryFee.toLocaleString()}원` : '무료'}</Typography>
                      </Box>
                    )}
                    <Divider />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>최종 결제금액</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: 'primary.main' }}>{finalPayment.toLocaleString()}원</Typography>
                    </Box>
                  </Stack>
                </Box>
              )}
            </Box>

            {/* ── RIGHT PANEL ── */}
            <Box sx={{ flex: 1, minWidth: 0, p: 2.5, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>

              {/* Search */}
              <TextField
                fullWidth size="small" placeholder="상품명으로 검색"
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'text.disabled' }} /></InputAdornment>,
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px', bgcolor: '#F2F4F6',
                    '& fieldset': { borderColor: 'transparent' },
                    '&:hover fieldset': { borderColor: 'transparent' },
                    '&.Mui-focused fieldset': { borderColor: 'primary.main' },
                  },
                }}
              />

              {/* Category chips */}
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', flexShrink: 0 }}>
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
              <Box sx={{ flex: '1 1 0', overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 2, minHeight: 0 }}>
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
                          px: 1.5,
                          py: 1,
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                          '&:last-child': { borderBottom: 'none' },
                          bgcolor: inCart ? alpha('#1976d2', 0.04) : 'transparent',
                          minWidth: 0,
                        }}
                      >
                        <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {product.name}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25, flexWrap: 'wrap' }}>
                            {product.category && (
                              <Chip label={product.category} size="small" sx={{ height: 16, fontSize: '0.6rem', borderRadius: '4px' }} />
                            )}
                            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
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
                        <Box sx={{ flexShrink: 0 }}>
                          {inCart ? (
                            <Chip label="담김" size="small" color="primary" variant="outlined" sx={{ borderRadius: '8px', fontWeight: 600, fontSize: '0.7rem' }} />
                          ) : (
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => handleAddToCart(product)}
                              sx={{ minWidth: 44, borderRadius: '8px', fontWeight: 700, fontSize: '0.75rem', px: 1 }}
                            >
                              담기
                            </Button>
                          )}
                        </Box>
                      </Box>
                    );
                  })
                )}
              </Box>

              {/* Cart */}
              {cart.length > 0 && (
                <Box sx={{ flexShrink: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                    장바구니 ({cart.length}종)
                  </Typography>
                  <Stack spacing={0.5} sx={{ maxHeight: 160, overflowY: 'auto' }}>
                    {cart.map(({ product, quantity }) => {
                      const discounted = calcDiscountedPrice(product);
                      return (
                        <Box
                          key={product.id}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            px: 1.25,
                            py: 0.75,
                            borderRadius: 1.5,
                            border: '1px solid',
                            borderColor: 'divider',
                            bgcolor: 'grey.50',
                            minWidth: 0,
                          }}
                        >
                          <Typography variant="body2" sx={{ flex: 1, minWidth: 0, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {product.name}
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {(discounted * quantity).toLocaleString()}원
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                            <IconButton size="small" onClick={() => handleDecrement(product.id)} sx={{ width: 22, height: 22 }}>
                              <RemoveIcon sx={{ fontSize: 12 }} />
                            </IconButton>
                            <Typography variant="body2" sx={{ minWidth: 18, textAlign: 'center', fontWeight: 700, fontSize: '0.8rem' }}>{quantity}</Typography>
                            <IconButton size="small" onClick={() => handleIncrement(product.id)} sx={{ width: 22, height: 22 }}>
                              <AddIcon sx={{ fontSize: 12 }} />
                            </IconButton>
                          </Box>
                          <IconButton size="small" onClick={() => handleRemoveFromCart(product.id)} sx={{ width: 22, height: 22, color: 'text.disabled', flexShrink: 0 }}>
                            <CloseIcon sx={{ fontSize: 12 }} />
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

      {/* Daum Postcode Modal */}
      <Modal open={postcodeOpen} onClose={() => setPostcodeOpen(false)} sx={{ zIndex: 1400 }}>
        <Box sx={postcodeModalStyle}>
          <DaumPostcode onComplete={handleCompletePostcode} style={{ height: '60vh' }} />
        </Box>
      </Modal>
    </>
  );
};

export default NewOrderModal;
