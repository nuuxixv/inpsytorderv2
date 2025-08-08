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
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Skeleton,
  Pagination,
  Checkbox,
  FormControlLabel,
  Autocomplete,
  Divider,
  Grid,
} from '@mui/material';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { supabase } from '../supabaseClient';
import { useAuth } from '../AuthContext';
import { useNotification } from '../NotificationContext';
import { Close as CloseIcon } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import OrderDetailModal from './OrderDetailModal';

const OrderManagementPage = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();

  // Page state
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const ordersPerPage = 10;

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  // Product state
  const [products, setProducts] = useState([]);
  const [productsMap, setProductsMap] = useState({});
  const [productsLoading, setProductsLoading] = useState(true);

  // Order Detail Modal state
  const [openOrderDetailModal, setOpenOrderDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // New Order Modal state
  const [openNewOrderModal, setOpenNewOrderModal] = useState(false);
  const [isOnSiteSale, setIsOnSiteSale] = useState(false);
  const [newOrderCustomerName, setNewOrderCustomerName] = useState('');
  const [newOrderCustomerEmail, setNewOrderCustomerEmail] = useState('');
  const [newOrderContact, setNewOrderContact] = useState('');
  const [newOrderAddress, setNewOrderAddress] = useState('');
  const [newOrderSelectedEvent, setNewOrderSelectedEvent] = useState('');
  const [newOrderItems, setNewOrderItems] = useState([{ product_id: '', quantity: 1, price_at_purchase: 0 }]);
  
  // New Order Calculation State
  const [totalAmount, setTotalAmount] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [finalPayment, setFinalPayment] = useState(0);

  const statusToKorean = {
    pending: '결제대기',
    paid: '결제완료',
    completed: '처리완료',
    cancelled: '주문취소',
    refunded: '결제취소',
  };

  // Fetching data
  useEffect(() => {
    const fetchInitialData = async () => {
      setProductsLoading(true);
      try {
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('id, product_code, name, list_price');
        if (productsError) throw productsError;
        
        setProducts(productsData);
        const newProductsMap = {};
        productsData.forEach(p => {
          newProductsMap[p.id] = { id: p.id, name: p.name, list_price: p.list_price };
        });
        setProductsMap(newProductsMap);

      } catch (err) {
        console.error('Error fetching products:', err);
        addNotification('상품 정보를 불러오는 데 실패했습니다.', 'error');
      } finally {
        setProductsLoading(false);
      }
    };
    fetchInitialData();
  }, [addNotification]);

  const fetchEvents = useCallback(async () => {
    const { data, error } = await supabase.from('events').select('id, name, discount_rate').order('name', { ascending: true });
    if (error) {
      console.error('Error fetching events:', error);
      addNotification('학회 정보를 불러오는 데 실패했습니다.', 'error');
    } else {
      setEvents(data);
    }
  }, [addNotification]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    const from = (currentPage - 1) * ordersPerPage;
    const to = from + ordersPerPage - 1;

    let query = supabase
      .from('orders')
      .select(`*, order_items (product_id, quantity, price_at_purchase)`, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (searchTerm) query = query.or(`customer_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    if (selectedStatus) query = query.eq('status', selectedStatus);
    if (selectedEvent && selectedEvent !== '') query = query.eq('event_id', selectedEvent);
    if (startDate && endDate) {
      const start = format(startOfDay(startDate), 'yyyy-MM-dd HH:mm:ss');
      const end = format(endOfDay(endDate), 'yyyy-MM-dd HH:mm:ss');
      query = query.gte('created_at', start).lte('created_at', end);
    }

    const { data, error, count } = await query.range(from, to);

    if (error) {
      console.error('Error fetching orders:', error);
      addNotification('주문 정보를 불러오는 데 실패했습니다.', 'error');
      setOrders([]);
      setTotalOrders(0);
    } else {
      setOrders(data);
      setTotalOrders(count || 0);
    }
    setLoading(false);
  }, [searchTerm, selectedStatus, selectedEvent, startDate, endDate, addNotification, currentPage, ordersPerPage]);

  useEffect(() => {
    fetchEvents();
    fetchOrders();
  }, [fetchEvents, fetchOrders]);

  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    setStartDate(thirtyDaysAgo);
    setEndDate(today);
  }, []);

  // New Order Modal Calculations
  useEffect(() => {
    const currentEvent = events.find(e => e.id === newOrderSelectedEvent);
    const discountRate = currentEvent ? currentEvent.discount_rate : 0; // e.g., 0.15 for 15%

    const subtotal = newOrderItems.reduce((sum, item) => {
      const price = item.price_at_purchase || 0;
      const quantity = item.quantity || 0;
      return sum + (price * quantity);
    }, 0);

    const calculatedDiscount = subtotal * discountRate;
    const calculatedShipping = subtotal > 0 && subtotal < 50000 ? 3000 : 0; // 5만원 미만 배송비 3000원 정책 예시
    const calculatedFinalPayment = subtotal - calculatedDiscount + calculatedShipping;

    setTotalAmount(subtotal);
    setDiscountAmount(calculatedDiscount);
    setShippingCost(calculatedShipping);
    setFinalPayment(calculatedFinalPayment);

  }, [newOrderItems, newOrderSelectedEvent, events]);

  // Event Handlers
  const handleOpenNewOrderModal = () => {
    setIsOnSiteSale(false);
    setNewOrderCustomerName('');
    setNewOrderCustomerEmail('');
    setNewOrderContact('');
    setNewOrderAddress('');
    setNewOrderSelectedEvent('');
    setNewOrderItems([{ product_id: '', quantity: 1, price_at_purchase: 0 }]);
    setOpenNewOrderModal(true);
  };

  const handleCloseNewOrderModal = () => setOpenNewOrderModal(false);

  const handleIsOnSiteSaleChange = (event) => {
    const checked = event.target.checked;
    setIsOnSiteSale(checked);
    if (checked) {
      setNewOrderCustomerName(`현장판매_${Date.now()}`);
      setNewOrderCustomerEmail('');
      setNewOrderContact('');
      setNewOrderAddress('');
    } else {
      setNewOrderCustomerName('');
    }
  };

  const handleNewOrderItemChange = (index, field, value) => {
    const updatedItems = [...newOrderItems];
    updatedItems[index][field] = value;
    setNewOrderItems(updatedItems);
  };
  
  const handleProductChange = (index, newValue) => {
    const updatedItems = [...newOrderItems];
    if (newValue) {
      updatedItems[index].product_id = newValue.id;
      updatedItems[index].price_at_purchase = newValue.list_price;
    } else {
      updatedItems[index].product_id = '';
      updatedItems[index].price_at_purchase = 0;
    }
    setNewOrderItems(updatedItems);
  };

  const handleAddNewOrderItem = () => setNewOrderItems([...newOrderItems, { product_id: '', quantity: 1, price_at_purchase: 0 }]);
  const handleRemoveNewOrderItem = (index) => {
    const updatedItems = newOrderItems.filter((_, i) => i !== index);
    setNewOrderItems(updatedItems);
  };

  const handleSaveNewOrder = async () => {
    if (!isOnSiteSale && (!newOrderCustomerName || !newOrderCustomerEmail)) {
      addNotification('일반 주문은 고객명과 이메일을 모두 입력해야 합니다.', 'warning');
      return;
    }
    if (!newOrderSelectedEvent) {
      addNotification('학회를 선택해주세요.', 'warning');
      return;
    }
    if (newOrderItems.some(item => !item.product_id || item.quantity <= 0)) {
      addNotification('유효하지 않은 상품 항목이 있습니다. 상품을 선택하고 수량을 1 이상으로 입력하세요.', 'warning');
      return;
    }

    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_name: newOrderCustomerName,
          email: newOrderCustomerEmail,
          contact: newOrderContact,
          address: newOrderAddress,
          event_id: newOrderSelectedEvent,
          total_amount: totalAmount,
          discount_amount: discountAmount,
          shipping_cost: shippingCost,
          final_payment: finalPayment,
          status: 'pending',
          is_on_site_sale: isOnSiteSale,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItemsToInsert = newOrderItems.map(item => ({
        order_id: orderData.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price_at_purchase: item.price_at_purchase,
      }));

      const { error: orderItemsError } = await supabase.from('order_items').insert(orderItemsToInsert);
      if (orderItemsError) throw orderItemsError;

      addNotification('신규 주문이 성공적으로 추가되었습니다.', 'success');
      handleCloseNewOrderModal();
      fetchOrders();
    } catch (error) {
      console.error('Error saving new order:', error);
      addNotification(`신규 주문 추가 실패: ${error.message}`, 'error');
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedStatus('');
    setSelectedEvent('');
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    setStartDate(thirtyDaysAgo);
    setEndDate(today);
  };

  const handleStatusChange = useCallback(async (orderId, newStatus) => {
    try {
      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
      if (error) throw error;
      addNotification(`주문 ${orderId}의 상태가 '${statusToKorean[newStatus]}'으로 업데이트되었습니다.`, 'success');
      fetchOrders();
    } catch (err) {
      console.error('Error updating order status:', err);
      addNotification(`주문 상태 업데이트 실패: ${err.message}`, 'error');
    }
  }, [fetchOrders, addNotification, statusToKorean]);

  const handleRowClick = (order) => {
    setSelectedOrder(order);
    setOpenOrderDetailModal(true);
  };
  
  // Render helpers
  const renderPriceSummary = () => (
    <Paper variant="outlined" sx={{ p: 2, mt: 2, backgroundColor: 'grey.50' }}>
      <Typography variant="h6" gutterBottom>주문 요약</Typography>
      <Grid container spacing={1}>
        <Grid item xs={6}><Typography>총 상품 금액:</Typography></Grid>
        <Grid item xs={6} textAlign="right"><Typography>{totalAmount.toLocaleString()}원</Typography></Grid>
        <Grid item xs={6}><Typography color="error">할인 금액:</Typography></Grid>
        <Grid item xs={6} textAlign="right"><Typography color="error">- {discountAmount.toLocaleString()}원</Typography></Grid>
        <Grid item xs={6}><Typography>배송비:</Typography></Grid>
        <Grid item xs={6} textAlign="right"><Typography>{shippingCost.toLocaleString()}원</Typography></Grid>
        <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>
        <Grid item xs={6}><Typography variant="h6" component="div">최종 결제 금액:</Typography></Grid>
        <Grid item xs={6} textAlign="right"><Typography variant="h6" component="div">{finalPayment.toLocaleString()}원</Typography></Grid>
      </Grid>
    </Paper>
  );

  if (!user) {
    return <Box sx={{ p: 3 }}><Typography>로그인이 필요합니다.</Typography></Box>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', p: 2, bgcolor: '#f5f5f5' }}>
      <Typography variant="h4" gutterBottom sx={{ color: '#333', fontWeight: 'bold' }}>주문 관리</Typography>
      
      <Paper elevation={3} sx={{ p: 2, mb: 2, borderRadius: '12px' }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 180, flexGrow: 1 }}>
            <InputLabel>학회 선택</InputLabel>
            <Select
              value={selectedEvent}
              label="학회 선택"
              onChange={(e) => { setSelectedEvent(e.target.value); setCurrentPage(1); }}
            >
              <MenuItem value=""><em>전체</em></MenuItem>
              {events.map((event) => <MenuItem key={event.id} value={event.id}>{event.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180, flexGrow: 1 }}>
            <InputLabel>주문 상태</InputLabel>
            <Select
              value={selectedStatus}
              label="주문 상태"
              onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
            >
              <MenuItem value=""><em>전체</em></MenuItem>
              {Object.entries(statusToKorean).map(([key, value]) => <MenuItem key={key} value={key}>{value}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField
            label="고객 이름/이메일 검색"
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            sx={{ minWidth: 240, flexGrow: 2 }}
          />
          <TextField
            label="시작일"
            type="date"
            variant="outlined"
            size="small"
            value={startDate ? format(startDate, 'yyyy-MM-dd') : ''}
            onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : null)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 150, flexGrow: 1 }}
          />
          <TextField
            label="종료일"
            type="date"
            variant="outlined"
            size="small"
            value={endDate ? format(endDate, 'yyyy-MM-dd') : ''}
            onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : null)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 150, flexGrow: 1 }}
          />
          <Button variant="outlined" onClick={handleClearFilters} sx={{ flexShrink: 0 }}>
            필터 초기화
          </Button>
        </Box>
      </Paper>

      {/* Orders Table Section */}
      <Paper elevation={3} sx={{ flexGrow: 1, borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button variant="contained" color="primary" onClick={handleOpenNewOrderModal}>신규 주문 추가</Button>
          <Button variant="outlined" onClick={() => { /* Excel Download Logic */ }}>엑셀 다운로드</Button>
        </Box>
        <TableContainer sx={{ flexGrow: 1 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow sx={{ '& .MuiTableCell-root': { bgcolor: 'grey.200', fontWeight: 'bold' } }}>
                <TableCell>주문번호</TableCell>
                <TableCell>고객명</TableCell>
                <TableCell>이메일</TableCell>
                <TableCell>학회명</TableCell>
                <TableCell>총 금액</TableCell>
                <TableCell>주문일시</TableCell>
                <TableCell>상태</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from(new Array(ordersPerPage)).map((_, index) => (
                  <TableRow key={index}><TableCell colSpan={7}><Skeleton animation="wave" /></TableCell></TableRow>
                ))
              ) : orders.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center">조회된 주문이 없습니다.</TableCell></TableRow>
              ) : (
                orders.map((order) => (
                  <TableRow key={order.id} hover onClick={() => handleRowClick(order)} sx={{ cursor: 'pointer' }}>
                    <TableCell>{order.id}</TableCell>
                    <TableCell>{order.customer_name}</TableCell>
                    <TableCell>{order.email}</TableCell>
                    <TableCell>{events.find(e => e.id === order.event_id)?.name || 'N/A'}</TableCell>
                    <TableCell>{(order.final_payment || 0).toLocaleString()}원</TableCell>
                    <TableCell>{format(new Date(order.created_at), 'yyyy-MM-dd HH:mm')}</TableCell>
                    <TableCell>
                      <FormControl size="small" variant="outlined" sx={{ minWidth: 100 }} onClick={(e) => e.stopPropagation()}>
                        <Select value={order.status} onChange={(e) => handleStatusChange(order.id, e.target.value)}>
                          {Object.entries(statusToKorean).map(([key, value]) => <MenuItem key={key} value={key}>{value}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <Pagination count={Math.ceil(totalOrders / ordersPerPage)} page={currentPage} onChange={(_, value) => setCurrentPage(value)} color="primary" />
        </Box>
      </Paper>

      {/* Order Detail Modal */}
      {selectedOrder && !productsLoading && (
        <OrderDetailModal
          open={openOrderDetailModal}
          onClose={() => setOpenOrderDetailModal(false)}
          order={selectedOrder}
          statusToKorean={statusToKorean}
          productsMap={productsMap}
          products={products}
          events={events}
          addNotification={addNotification}
          onUpdate={fetchOrders}
        />
      )}

      {/* New Order Modal */}
      <Dialog open={openNewOrderModal} onClose={handleCloseNewOrderModal} maxWidth="md" fullWidth>
        <DialogTitle>신규 주문 추가</DialogTitle>
        <DialogContent>
          <FormControlLabel
            control={<Checkbox checked={isOnSiteSale} onChange={handleIsOnSiteSaleChange} />}
            label="현장판매"
          />
          <TextField margin="dense" label="고객명" fullWidth variant="standard" value={newOrderCustomerName} onChange={(e) => setNewOrderCustomerName(e.target.value)} disabled={isOnSiteSale} required={!isOnSiteSale} />
          <TextField margin="dense" label="이메일" type="email" fullWidth variant="standard" value={newOrderCustomerEmail} onChange={(e) => setNewOrderCustomerEmail(e.target.value)} disabled={isOnSiteSale} required={!isOnSiteSale} />
          <TextField margin="dense" label="연락처" fullWidth variant="standard" value={newOrderContact} onChange={(e) => setNewOrderContact(e.target.value)} disabled={isOnSiteSale} />
          <TextField margin="dense" label="주소" fullWidth variant="standard" value={newOrderAddress} onChange={(e) => setNewOrderAddress(e.target.value)} disabled={isOnSiteSale} />
          
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, mt: 2 }}>
            <FormControl fullWidth margin="dense">
              <InputLabel>학회 선택 *</InputLabel>
              <Select value={newOrderSelectedEvent} onChange={(e) => setNewOrderSelectedEvent(e.target.value)} required>
                {events.map((event) => <MenuItem key={event.id} value={event.id}>{event.name}</MenuItem>)}
              </Select>
            </FormControl>
            {newOrderSelectedEvent && (
              <Typography variant="body2" color="primary" sx={{ mb: 1, whiteSpace: 'nowrap' }}>
                (할인율: {Math.round((events.find(e => e.id === newOrderSelectedEvent)?.discount_rate || 0) * 100)}%)
              </Typography>
            )}
          </Box>

          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>주문 항목</Typography>
          {newOrderItems.map((item, index) => (
            <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
              <Autocomplete
                options={products}
                getOptionLabel={(option) => option.name || ''}
                value={products.find(p => p.id === item.product_id) || null}
                onChange={(event, newValue) => handleProductChange(index, newValue)}
                loading={productsLoading}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="상품 검색"
                    variant="standard"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {productsLoading ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                sx={{ flexGrow: 1 }}
              />
              <TextField label="수량" type="number" value={item.quantity} onChange={(e) => handleNewOrderItemChange(index, 'quantity', parseInt(e.target.value, 10) || 1)} sx={{ width: 100 }} InputProps={{ inputProps: { min: 1 } }} />
              <TextField label="개당 가격" type="number" value={item.price_at_purchase} onChange={(e) => handleNewOrderItemChange(index, 'price_at_purchase', parseFloat(e.target.value) || 0)} sx={{ width: 150 }} />
              <IconButton onClick={() => handleRemoveNewOrderItem(index)}><CloseIcon /></IconButton>
            </Box>
          ))}
          <Button onClick={handleAddNewOrderItem} sx={{ mt: 1 }}>항목 추가</Button>
          
          {renderPriceSummary()}

        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseNewOrderModal}>취소</Button>
          <Button onClick={handleSaveNewOrder} variant="contained">저장</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrderManagementPage;