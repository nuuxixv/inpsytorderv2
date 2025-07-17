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
  Snackbar,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Popover,
  Modal,
  Backdrop,
  Fade,
} from '@mui/material';
import { DateRangePicker } from 'react-date-range';
import 'react-date-range/dist/styles.css'; // main style file
import 'react-date-range/dist/theme/default.css'; // theme css file
import { format, startOfDay, endOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { supabase } from '../supabaseClient';
import { useAuth } from '../AuthContext';
import { Close as CloseIcon } from '@mui/icons-material';
import * as XLSX from 'xlsx';

const AdminPage = () => {
  const { user, masterPassword } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [openOrderDetailModal, setOpenOrderDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [openNewOrderModal, setOpenNewOrderModal] = useState(false); // New state for new order modal
  const [newOrderCustomerName, setNewOrderCustomerName] = useState('');
  const [newOrderCustomerEmail, setNewOrderCustomerEmail] = useState('');
  const [newOrderSelectedEvent, setNewOrderSelectedEvent] = useState('');
  const [newOrderItems, setNewOrderItems] = useState([{ product_id: '', quantity: 1, price_at_purchase: 0 }]); // Default with one item

  const [productsMap, setProductsMap] = useState({});

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, product_code, name, list_price')

        if (error) {
          console.error('Error fetching products:', error);
          return;
        }

        const newProductsMap = {};
        data.forEach(product => {
          newProductsMap[product.product_code] = {
            name: product.name,
            list_price: product.list_price,
          };
        });
        setProductsMap(newProductsMap);
      } catch (err) {
        console.error('Error fetching or processing products from Supabase:', err);
      }
    };

    fetchProducts();
  }, []);

  const statusToKorean = {
    pending: '대기중',
    confirmed: '확정',
    cancelled: '취소',
    completed: '완료',
  };

  const handleOpenNewOrderModal = () => {
    setNewOrderCustomerName('');
    setNewOrderCustomerEmail('');
    setNewOrderSelectedEvent('');
    setNewOrderItems([{ product_id: '', quantity: 1, price_at_purchase: 0 }]);
    setOpenNewOrderModal(true);
  };

  const handleCloseNewOrderModal = () => {
    setOpenNewOrderModal(false);
  };

  const handleNewOrderItemChange = (index, field, value) => {
    const updatedItems = [...newOrderItems];
    updatedItems[index][field] = value;
    setNewOrderItems(updatedItems);
  };

  const handleAddNewOrderItem = () => {
    setNewOrderItems([...newOrderItems, { product_id: '', quantity: 1, price_at_purchase: 0 }]);
  };

  const handleRemoveNewOrderItem = (index) => {
    const updatedItems = [...newOrderItems];
    updatedItems.splice(index, 1);
    setNewOrderItems(updatedItems);
  };

  const handleSaveNewOrder = async () => {
    if (!newOrderCustomerName || !newOrderCustomerEmail || !newOrderSelectedEvent || newOrderItems.length === 0) {
      setSnackbar({ open: true, message: '모든 필수 필드를 채워주세요.', severity: 'warning' });
      return;
    }

    // Calculate total amount
    const totalAmount = newOrderItems.reduce((sum, item) => sum + (item.quantity * item.price_at_purchase), 0);

    try {
      // 1. Insert into orders table
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_name: newOrderCustomerName,
          email: newOrderCustomerEmail,
          event_id: newOrderSelectedEvent,
          total_amount: totalAmount,
          status: 'pending', // Default status for new orders
        })
        .select()
        .single();

      if (orderError) {
        throw orderError;
      }

      // 2. Insert into order_items table
      const orderItemsToInsert = newOrderItems.map(item => ({
        order_id: orderData.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price_at_purchase: item.price_at_purchase,
      }));

      const { error: orderItemsError } = await supabase
        .from('order_items')
        .insert(orderItemsToInsert);

      if (orderItemsError) {
        throw orderItemsError;
      }

      setSnackbar({ open: true, message: '신규 주문이 성공적으로 추가되었습니다.', severity: 'success' });
      handleCloseNewOrderModal();
      fetchOrders(); // Refresh the order list
    } catch (error) {
      console.error('Error saving new order:', error);
      setSnackbar({ open: true, message: `신규 주문 추가 실패: ${error.message}`, severity: 'error' });
    }
  };

  const handleDownloadExcel = () => {
    if (orders.length === 0) {
      setSnackbar({ open: true, message: '다운로드할 주문이 없습니다.', severity: 'info' });
      return;
    }

    const data = orders.map(order => ({
      '주문번호': order.id,
      '고객명': order.customer_name,
      '이메일': order.email,
      '학회명': events.find(e => e.id === order.event_id)?.name || 'N/A',
      '총 금액': order.total_amount,
      '주문일시': format(new Date(order.created_at), 'yyyy-MM-dd HH:mm', { locale: ko }),
      '상태': statusToKorean[order.status],
      '상품 목록': order.order_items.map(item => `${item.product_id} (${item.quantity}개)`).join(', '),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '주문 목록');
    XLSX.writeFile(wb, '주문_목록.xlsx');

    setSnackbar({ open: true, message: '엑셀 파일 다운로드가 시작되었습니다.', severity: 'success' });
  };

  const fetchEvents = useCallback(async () => {
    const { data, error } = await supabase
      .from('events')
      .select('id, name, discount_rate')
      .order('name', { ascending: true });
    if (error) {
      console.error('Error fetching events:', error);
      setError('학회 정보를 불러오는 데 실패했습니다.');
    } else {
      setEvents(data);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null); // 오류 상태 초기화
    let query = supabase
      .from('orders')
      .select(`
        *,
        order_items (
          product_id,
          quantity,
          price_at_purchase
        )
      `)
      .order('created_at', { ascending: false });

    if (searchTerm) {
      query = query.or(`customer_name.ilike.%${searchTerm}%,customer_email.ilike.%${searchTerm}%`);
    }
    if (selectedStatus) {
      query = query.eq('status', selectedStatus);
    }
    if (selectedEvent && selectedEvent !== '') {
      query = query.eq('event_id', selectedEvent);
    }
    if (startDate && endDate) {
      const start = format(startOfDay(startDate), 'yyyy-MM-dd HH:mm:ss');
      const end = format(endOfDay(endDate), 'yyyy-MM-dd HH:mm:ss');
      query = query.gte('created_at', start).lte('created_at', end);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching orders:', error);
      setError('주문 정보를 불러오는 데 실패했습니다.');
    } else {
      setOrders(data);
    }
    setLoading(false);
  }, [searchTerm, selectedStatus, selectedEvent, startDate, endDate]);

  useEffect(() => {
    fetchEvents();
    fetchOrders();
  }, [fetchEvents, fetchOrders]);

  // 날짜 필터 기본값 설정 (컴포넌트 마운트 시 한 번만 실행)
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    setStartDate(thirtyDaysAgo);
    setEndDate(today);
  }, []);

  const handleSearch = () => {
    fetchOrders(); // 검색 버튼 클릭 시 fetchOrders 호출
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedStatus('');
    setSelectedEvent('');
    setStartDate(null);
    setEndDate(null);
    fetchOrders(); // 필터 초기화 후 fetchOrders 호출
  };

  const handleStatusChange = useCallback(async (orderId, newStatus) => {
    if (!user || !masterPassword) {
      setSnackbar({ open: true, message: '권한이 없습니다.', severity: 'error' });
      return;
    }

    try {
      // 1. Update order status in Supabase
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (updateError) {
        throw updateError;
      }

      // 2. Fetch the updated order details to send in the email
      const { data: updatedOrder, error: fetchError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            product_id,
            quantity,
            price_at_purchase
          )
        `)
        .eq('id', orderId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      // 3. Trigger Edge Function to send email
      const { data: edgeFunctionData, error: edgeFunctionError } = await supabase.functions.invoke('send-order-email', {
        method: 'POST',
        body: JSON.stringify(updatedOrder),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${masterPassword}` // Pass master password for authentication
        }
      });

      if (edgeFunctionError) {
        throw edgeFunctionError;
      }

      console.log('Edge Function Response:', edgeFunctionData);
      setSnackbar({ open: true, message: '주문 상태가 업데이트되고 이메일이 발송되었습니다.', severity: 'success' });
      fetchOrders(); // Refresh orders list
    } catch (err) {
      console.error('Error updating order status or sending email:', err);
      setSnackbar({ open: true, message: `상태 업데이트 및 이메일 발송 실패: ${err.message}`, severity: 'error' });
    }
  }, [user, masterPassword, fetchOrders]);

  const handleUpdateEventDiscount = useCallback(async (eventId, newDiscountRate) => {
    if (!user || !masterPassword) {
      setSnackbar({ open: true, message: '권한이 없습니다.', severity: 'error' });
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('events')
        .update({ discount_rate: newDiscountRate })
        .eq('id', eventId);

      if (updateError) {
        throw updateError;
      }

      setSnackbar({ open: true, message: '할인율이 업데이트되었습니다.', severity: 'success' });
      fetchEvents(); // 학회 목록 갱신
    } catch (err) {
      console.error('Error updating event discount rate:', err);
      setSnackbar({ open: true, message: `할인율 업데이트 실패: ${err.message}`, severity: 'error' });
    }
  }, [user, masterPassword, fetchEvents]);

  const handleRowClick = (order) => {
    setSelectedOrder(order);
    setOpenOrderDetailModal(true);
  };

  const handleCloseOrderDetailModal = () => {
    setOpenOrderDetailModal(false);
    setSelectedOrder(null);
  };

  if (!user) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Typography variant="h6">로그인이 필요합니다.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', p: 2, bgcolor: '#f5f5f5' }}>
      <Typography variant="h4" gutterBottom sx={{ color: '#333', fontWeight: 'bold' }}>
        관리자 페이지
      </Typography>

      {/* Filter and Search Section */}
      <Paper elevation={3} sx={{ p: 3, mb: 3, borderRadius: '12px', bgcolor: '#fff' }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>학회 선택</InputLabel>
            <Select
              value={selectedEvent}
              label="학회 선택"
              onChange={(e) => setSelectedEvent(e.target.value)}
            >
              <MenuItem value="">전체</MenuItem>
              {events.map((event) => (
                <MenuItem key={event.id} value={event.id}>{event.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>주문 상태</InputLabel>
            <Select
              value={selectedStatus}
              label="주문 상태"
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <MenuItem value="">전체</MenuItem>
              {Object.entries(statusToKorean).map(([key, value]) => (
                <MenuItem key={key} value={key}>{value}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="고객 이름/이메일 검색"
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ minWidth: 200 }}
          />
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              label="시작일"
              type="date"
              variant="outlined"
              size="small"
              value={startDate ? format(startDate, 'yyyy-MM-dd', { locale: ko }) : ''}
              onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : null)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 150 }}
            />
            <TextField
              label="종료일"
              type="date"
              variant="outlined"
              size="small"
              value={endDate ? format(endDate, 'yyyy-MM-dd', { locale: ko }) : ''}
              onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : null)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 150 }}
            />
            <Button variant="outlined" onClick={() => {
              const today = new Date();
              setStartDate(today);
              setEndDate(today);
            }}>오늘</Button>
            <Button variant="outlined" onClick={() => {
              const today = new Date();
              const threeDaysAgo = new Date();
              threeDaysAgo.setDate(today.getDate() - 2); // 오늘 포함 3일
              setStartDate(threeDaysAgo);
              setEndDate(today);
            }}>3일</Button>
          </Box>
          <Button variant="contained" onClick={handleSearch}>
            검색
          </Button>
          <Button variant="outlined" onClick={handleClearFilters}>
            필터 초기화
          </Button>
          
        </Box>
      </Paper>

      {/* Event Management Section */}
      <Paper elevation={3} sx={{ p: 3, mt: 3, borderRadius: '12px', bgcolor: '#fff' }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>학회 관리</Typography>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>학회 ID</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>학회명</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>할인율</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>작업</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>{event.id}</TableCell>
                  <TableCell>{event.name}</TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      value={event.discount_rate || 0}
                      onChange={(e) => {
                        const updatedEvents = events.map(evt =>
                          evt.id === event.id ? { ...evt, discount_rate: parseFloat(e.target.value) } : evt
                        );
                        setEvents(updatedEvents);
                      }}
                      inputProps={{ step: "0.01", min: "0", max: "1" }}
                      size="small"
                      sx={{ width: 80 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="outlined" size="small" onClick={() => handleUpdateEventDiscount(event.id, event.discount_rate)}>
                      저장
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Order Table Section */}
      <Paper elevation={3} sx={{ flexGrow: 1, borderRadius: '12px', overflow: 'hidden' }}>
        <TableContainer sx={{ height: '100%' }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mb: 2 }}>
            <Button variant="contained" onClick={handleOpenNewOrderModal}>
              신규 주문 추가
            </Button>
            <Button variant="outlined" onClick={handleDownloadExcel}>
              엑셀 다운로드
            </Button>
          </Box>
          <Table stickyHeader aria-label="order table">
            <TableHead>
              <TableRow sx={{ bgcolor: '#e0e0e0' }}>
                <TableCell sx={{ fontWeight: 'bold', minWidth: 100 }}>주문번호</TableCell>
                <TableCell sx={{ fontWeight: 'bold', minWidth: 150 }}>고객명</TableCell>
                <TableCell sx={{ fontWeight: 'bold', minWidth: 200 }}>이메일</TableCell>
                <TableCell sx={{ fontWeight: 'bold', minWidth: 150 }}>학회명</TableCell>
                <TableCell sx={{ fontWeight: 'bold', minWidth: 150 }}>총 금액</TableCell>
                <TableCell sx={{ fontWeight: 'bold', minWidth: 180 }}>주문일시</TableCell>
                <TableCell sx={{ fontWeight: 'bold', minWidth: 120 }}>상태</TableCell>
                <TableCell sx={{ fontWeight: 'bold', minWidth: 150 }}>작업</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography color="error">{error}</Typography>
                  </TableCell>
                </TableRow>
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography>조회된 주문이 없습니다.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                  <TableRow
                    key={order.id}
                    hover
                    onClick={() => handleRowClick(order)}
                    sx={{ '&:last-child td, &:last-child th': { border: 0 }, cursor: 'pointer' }}
                  >
                    <TableCell>{order.id}</TableCell>
                    <TableCell>{order.customer_name}</TableCell>
                    <TableCell>{order.email}</TableCell>
                    <TableCell>{events.find(e => e.id === order.event_id)?.name || 'N/A'}</TableCell>
                    <TableCell>{(order.total_amount || 0).toLocaleString()}원</TableCell>
                    <TableCell>{format(new Date(order.created_at), 'yyyy-MM-dd HH:mm', { locale: ko })}</TableCell>
                    <TableCell>
                      {user && masterPassword ? (
                        <FormControl size="small" variant="outlined" sx={{ minWidth: 100 }}>
                          <Select
                            value={order.status}
                            onChange={(e) => {
                              e.stopPropagation(); // Prevent row click when changing status
                              handleStatusChange(order.id, e.target.value);
                            }}
                            displayEmpty
                          >
                            {Object.entries(statusToKorean).map(([key, value]) => (
                              <MenuItem key={key} value={key}>{value}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      ) : (
                        <Typography variant="body2">{statusToKorean[order.status]}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {/* Actions for each row, if any */}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          open={openOrderDetailModal}
          onClose={handleCloseOrderDetailModal}
          order={selectedOrder}
          statusToKorean={statusToKorean}
          productsMap={productsMap}
          events={events}
        />
      )}

      {/* New Order Modal */}
      <Dialog open={openNewOrderModal} onClose={handleCloseNewOrderModal} maxWidth="md" fullWidth>
        <DialogTitle>
          신규 주문 추가
          <IconButton
            aria-label="close"
            onClick={handleCloseNewOrderModal}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="고객 이름"
              variant="outlined"
              size="small"
              value={newOrderCustomerName}
              onChange={(e) => setNewOrderCustomerName(e.target.value)}
              fullWidth
            />
            <TextField
              label="고객 이메일"
              variant="outlined"
              size="small"
              type="email"
              value={newOrderCustomerEmail}
              onChange={(e) => setNewOrderCustomerEmail(e.target.value)}
              fullWidth
            />
            <FormControl size="small" fullWidth>
              <InputLabel>학회 선택</InputLabel>
              <Select
                value={newOrderSelectedEvent}
                label="학회 선택"
                onChange={(e) => setNewOrderSelectedEvent(e.target.value)}
              >
                <MenuItem value="">학회 선택</MenuItem>
                {events.map((event) => (
                  <MenuItem key={event.id} value={event.id}>{event.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Typography variant="h6" sx={{ mt: 2 }}>주문 상품</Typography>
            {newOrderItems.map((item, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  label="상품명"
                  variant="outlined"
                  size="small"
                  value={item.product_id}
                  onChange={(e) => handleNewOrderItemChange(index, 'product_id', e.target.value)}
                  sx={{ flex: 3 }}
                />
                <TextField
                  label="수량"
                  variant="outlined"
                  size="small"
                  type="number"
                  value={item.quantity}
                  onChange={(e) => handleNewOrderItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="단가"
                  variant="outlined"
                  size="small"
                  type="number"
                  value={item.price_at_purchase}
                  onChange={(e) => handleNewOrderItemChange(index, 'price_at_purchase', parseInt(e.target.value) || 0)}
                  sx={{ flex: 1 }}
                />
                {newOrderItems.length > 1 && (
                  <IconButton onClick={() => handleRemoveNewOrderItem(index)} color="error">
                    <CloseIcon />
                  </IconButton>
                )}
              </Box>
            ))}
            <Button onClick={handleAddNewOrderItem} variant="outlined">
              상품 추가
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseNewOrderModal} variant="outlined">
            취소
          </Button>
          <Button onClick={handleSaveNewOrder} variant="contained">
            저장
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminPage;

// OrderDetailModal component definition
const OrderDetailModal = ({ order, open, onClose, statusToKorean, productsMap, events }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(order.status);
  const [editedCustomerName, setEditedCustomerName] = useState(order.customer_name);
  const [editedCustomerEmail, setEditedCustomerEmail] = useState(order.email);
  const [editedPhoneNumber, setEditedPhoneNumber] = useState(order.phone_number || '');
  const [editedShippingAddress, setEditedShippingAddress] = useState(order.shipping_address?.address || '');
  const [editedShippingPostcode, setEditedShippingPostcode] = useState(order.shipping_address?.postcode || '');
  const [editedShippingDetail, setEditedShippingDetail] = useState(order.shipping_address?.detail || '');
  const [editedCustomerRequest, setEditedCustomerRequest] = useState(order.customer_request || '');
  const [editedOrderItems, setEditedOrderItems] = useState(order.order_items || []);

  const handleAddOrderItem = () => {
    setEditedOrderItems([...editedOrderItems, { product_id: '', quantity: 1, price_at_purchase: 0 }]);
  };

  const handleSave = async () => {
        try {
          const updatedShippingAddress = {
            postcode: editedShippingPostcode,
            address: editedShippingAddress,
            detail: editedShippingDetail,
          };

          // Calculate new total_amount based on editedOrderItems
          const newTotalAmount = editedOrderItems.reduce((sum, item) => {
            const product = productsMap[item.product_id];
            const originalPrice = product ? product.list_price : 0;
            const event = events.find(e => e.id === order.event_id);
            const discountRate = event ? (event.discount_rate || 0) : 0;
            const discountedPrice = originalPrice * (1 - discountRate);
            return sum + (discountedPrice * item.quantity);
          }, 0);

          const { error: updateOrderError } = await supabase
            .from('orders')
            .update({
              status: currentStatus,
              customer_name: editedCustomerName,
              email: editedCustomerEmail,
              phone_number: editedPhoneNumber,
              shipping_address: updatedShippingAddress,
              customer_request: editedCustomerRequest,
              total_amount: newTotalAmount, // Update total_amount
            })
            .eq('id', order.id);

          if (updateOrderError) {
            throw updateOrderError;
          }

          // Update order_items
          // For simplicity, we'll delete existing and insert new ones. 
          // A more robust solution would compare and update/insert/delete selectively.
          const { error: deleteItemsError } = await supabase
            .from('order_items')
            .delete()
            .eq('order_id', order.id);

          if (deleteItemsError) {
            throw deleteItemsError;
          }

          const orderItemsToInsert = editedOrderItems.map(item => ({
            order_id: order.id,
            product_id: item.product_id,
            quantity: item.quantity,
            price_at_purchase: item.price_at_purchase, // Assuming price_at_purchase is still relevant or can be recalculated
          }));

          const { error: insertItemsError } = await supabase
            .from('order_items')
            .insert(orderItemsToInsert);

          if (insertItemsError) {
            throw insertItemsError;
          }

          alert('주문 정보가 업데이트되었습니다.');
          setIsEditing(false);
          onClose(); // 모달 닫기 또는 데이터 새로고침
        } catch (error) {
          console.error('Error updating order:', error);
          alert('주문 정보 업데이트 실패: ' + error.message);
        }
      };

  if (!order) return null;

  const modalStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '90%',
    maxWidth: 800,
    bgcolor: 'background.paper',
    boxShadow: 24,
    p: 0,
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column'
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeAfterTransition
      BackdropComponent={Backdrop}
      BackdropProps={{ timeout: 500 }}
    >
      <Fade in={open}>
        <Box sx={modalStyle}>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'grey.100' }}>
            <Typography variant="h6">상품주문정보 조회</Typography>
            <Box>
              {isEditing ? (
                <Button variant="contained" onClick={handleSave} sx={{ mr: 1 }}>저장</Button>
              ) : (
                <Button variant="outlined" onClick={() => setIsEditing(true)} sx={{ mr: 1 }}>편집</Button>
              )}
              <IconButton
                aria-label="close"
                onClick={onClose}
                sx={{
                  color: (theme) => theme.palette.grey[500],
                }}
              >
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
          <Box sx={{ p: 3, overflowY: 'auto' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>주문 상세 정보</Typography>
            <Paper variant="outlined" sx={{ mb: 3 }}>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50', width: 150 }}>상품주문번호</TableCell>
                    <TableCell>{order.id}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>주문일</TableCell>
                    <TableCell>{new Date(order.created_at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Paper>

            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>주문자 정보</Typography>
            <Paper variant="outlined" sx={{ mb: 3 }}>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50', width: 150 }}>주문자명</TableCell>
                    <TableCell>
                      {isEditing ? (
                        <TextField
                          value={editedCustomerName}
                          onChange={(e) => setEditedCustomerName(e.target.value)}
                          size="small"
                          fullWidth
                        />
                      ) : (
                        order.customer_name
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>연락처</TableCell>
                    <TableCell>
                      {isEditing ? (
                        <TextField
                          value={editedPhoneNumber}
                          onChange={(e) => setEditedPhoneNumber(e.target.value)}
                          size="small"
                          fullWidth
                        />
                      ) : (
                        order.phone_number || 'N/A'
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>이메일</TableCell>
                    <TableCell>
                      {isEditing ? (
                        <TextField
                          value={editedCustomerEmail}
                          onChange={(e) => setEditedCustomerEmail(e.target.value)}
                          size="small"
                          fullWidth
                        />
                      ) : (
                        order.email
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Paper>

            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>배송지 정보</Typography>
            <Paper variant="outlined" sx={{ mb: 3 }}>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50', width: 150 }}>우편번호</TableCell>
                    <TableCell>
                      {isEditing ? (
                        <TextField
                          value={editedShippingPostcode}
                          onChange={(e) => setEditedShippingPostcode(e.target.value)}
                          size="small"
                          fullWidth
                        />
                      ) : (
                        order.shipping_address?.postcode || 'N/A'
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50', width: 150 }}>주소</TableCell>
                    <TableCell>
                      {isEditing ? (
                        <TextField
                          value={editedShippingAddress}
                          onChange={(e) => setEditedShippingAddress(e.target.value)}
                          size="small"
                          fullWidth
                        />
                      ) : (
                        order.shipping_address?.address || 'N/A'
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50', width: 150 }}>상세 주소</TableCell>
                    <TableCell>
                      {isEditing ? (
                        <TextField
                          value={editedShippingDetail}
                          onChange={(e) => setEditedShippingDetail(e.target.value)}
                          size="small"
                          fullWidth
                        />
                      ) : (
                        order.shipping_address?.detail || 'N/A'
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50', width: 150 }}>배송 메모</TableCell>
                    <TableCell>
                      {isEditing ? (
                        <TextField
                          value={editedCustomerRequest}
                          onChange={(e) => setEditedCustomerRequest(e.target.value)}
                          size="small"
                          fullWidth
                        />
                      ) : (
                        order.customer_request || '없음'
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Paper>

            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>주문 상품 목록</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell>상품명</TableCell>
                    <TableCell align="right">정가</TableCell>
                    <TableCell align="right">할인가</TableCell>
                    <TableCell align="right">수량</TableCell>
                    <TableCell align="right">합계</TableCell>
                    {isEditing && <TableCell>작업</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  { (order.order_items || []).map((item, index) => {
                    const product = productsMap[item.product_id];
                    const originalPrice = product ? product.list_price : 0;
                    const event = events.find(e => e.id === order.event_id);
                    const discountRate = event ? (event.discount_rate || 0) : 0;
                    const discountedPrice = originalPrice * (1 - discountRate);
                    const itemTotal = discountedPrice * item.quantity;

                    return (
                      <TableRow key={index}>
                        <TableCell>
                        {isEditing ? (
                          <TextField
                            value={item.product_id}
                            onChange={(e) => {
                              const newProductId = e.target.value;
                              const updatedItems = editedOrderItems.map(edi =>
                                edi.product_id === item.product_id ? { ...edi, product_id: newProductId } : edi
                              );
                              setEditedOrderItems(updatedItems);
                            }}
                            size="small"
                            fullWidth
                          />
                        ) : (
                          product?.name || item.product_id || '알 수 없는 상품'
                        )}
                      </TableCell>
                        <TableCell align="right">{originalPrice.toLocaleString()}원</TableCell>
                        <TableCell align="right">{discountedPrice.toLocaleString()}원</TableCell>
                        <TableCell align="right">
                        {isEditing ? (
                          <TextField
                            type="number"
                            value={item.quantity}
                            onChange={(e) => {
                              const newQuantity = parseInt(e.target.value) || 0;
                              const updatedItems = editedOrderItems.map(edi =>
                                edi.product_id === item.product_id ? { ...edi, quantity: newQuantity } : edi
                              );
                              setEditedOrderItems(updatedItems);
                            }}
                            size="small"
                            sx={{ width: 60 }}
                          />
                        ) : (
                          item.quantity
                        )}
                      </TableCell>
                        <TableCell align="right">{itemTotal.toLocaleString()}원</TableCell>
                      {isEditing && (
                        <TableCell>
                          <IconButton onClick={() => {
                            const updatedItems = editedOrderItems.filter((_, i) => i !== index);
                            setEditedOrderItems(updatedItems);
                          }} color="error">
                            <CloseIcon />
                          </IconButton>
                        </TableCell>
                      )}
                      </TableRow>
                    );
                  })}</TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ mt: 2, textAlign: 'right' }}>
              <Typography variant="h6">총 결제 금액: {(order.total_amount || 0).toLocaleString()}원</Typography>
            </Box>
            <Paper variant="outlined" sx={{ mt: 3 }}>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50', width: 150 }}>정가의 합</TableCell>
                    <TableCell align="right">{editedOrderItems.reduce((sum, item) => {
                      const product = productsMap[item.product_id];
                      const originalPrice = product ? product.list_price : 0;
                      return sum + (originalPrice * item.quantity);
                    }, 0).toLocaleString()}원</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>할인된 금액</TableCell>
                    <TableCell align="right">{(editedOrderItems.reduce((sum, item) => {
                      const product = productsMap[item.product_id];
                      const originalPrice = product ? product.list_price : 0;
                      const event = events.find(e => e.id === order.event_id);
                      const discountRate = event ? (event.discount_rate || 0) : 0;
                      const discountedPrice = originalPrice * (1 - discountRate);
                      return sum + (originalPrice * item.quantity) - (discountedPrice * item.quantity);
                    }, 0)).toLocaleString()}원</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>배송비</TableCell>
                    <TableCell align="right">{3000..toLocaleString()}원</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>총 결제 금액</TableCell>
                    <TableCell align="right">{(editedOrderItems.reduce((sum, item) => {
                      const product = productsMap[item.product_id];
                      const originalPrice = product ? product.list_price : 0;
                      const event = events.find(e => e.id === order.event_id);
                      const discountRate = event ? (event.discount_rate || 0) : 0;
                      const discountedPrice = originalPrice * (1 - discountRate);
                      return sum + (discountedPrice * item.quantity);
                    }, 0) + 3000).toLocaleString()}원</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Paper>
          </Box>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', borderTop: 1, borderColor: 'divider' }}>
            <Button onClick={onClose} variant="outlined">닫기</Button>
          </Box>
        </Box>
      </Fade>
    </Modal>
  );
};