import React, { useEffect, useCallback, useReducer } from 'react';
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
  Card,
  CardContent,
  Stack,
  Chip,
  SwipeableDrawer,
  useMediaQuery,
  useTheme,
  Menu,
} from '@mui/material';
import { format, subDays } from 'date-fns';
import { supabase } from '../supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { Close as CloseIcon, KeyboardArrowDown as KeyboardArrowDownIcon } from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import OrderDetailModal from './OrderDetailModal';
import EmptyState from './EmptyState';
import TableSkeleton from './TableSkeleton';
import { SearchOff as SearchOffIcon, FilterList as FilterListIcon } from '@mui/icons-material';
import { getEvents } from '../api/events';
import { fetchAllProducts } from '../api/products';
import { getOrders, groupLinkedOrders } from '../api/orders';

const statusToKorean = {
  pending: '결제대기',
  paid: '결제완료',
  cancelled: '주문취소',
  refunded: '결제취소',
  completed: '처리완료',
};

const initialState = {
  orders: [],
  loading: true,
  productsLoading: true,
  currentPage: 1,
  totalOrders: 0,
  searchTerm: '',
  selectedStatus: '',
  events: [],
  selectedEvent: '',
  startDate: subDays(new Date(), 30),
  endDate: new Date(),
  products: [],
  productsMap: {},
  openOrderDetailModal: false,
  selectedOrder: null,
  openNewOrderModal: false,
  newOrder: {
    isOnSiteSale: false,
    customerName: '',
    customerEmail: '',
    contact: '',
    address: '',
    selectedEvent: '',
    items: [{ product_id: '', quantity: 1, price_at_purchase: 0 }],
  },
  newOrderCalculations: {
    totalAmount: 0,
    discountAmount: 0,
    shippingCost: 0,
    finalPayment: 0,
  },
  settings: {
    free_shipping_threshold: 30000,
    shipping_cost: 3000,
  },
  selectedOrders: [],
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, ...action.payload };
    case 'SET_SELECTED_ORDERS':
        return { ...state, selectedOrders: action.payload };
    case 'TOGGLE_SELECT_ALL':
        if (action.payload.length === state.orders.length) {
            return { ...state, selectedOrders: [] };
        }
        return { ...state, selectedOrders: action.payload };
    case 'SET_FILTER':
      return { ...state, currentPage: 1, selectedOrders: [], [action.payload.key]: action.payload.value };
    case 'CLEAR_FILTERS':
      return {
        ...state,
        searchTerm: '',
        selectedStatus: '',
        selectedEvent: '',
        startDate: subDays(new Date(), 30),
        endDate: new Date(),
        selectedOrders: [],
      };
    case 'OPEN_ORDER_DETAIL':
      return { ...state, selectedOrder: action.payload, openOrderDetailModal: true };
    case 'CLOSE_ORDER_DETAIL':
      return { ...state, selectedOrder: null, openOrderDetailModal: false };
    case 'OPEN_NEW_ORDER':
      return { ...state, openNewOrderModal: true, newOrder: initialState.newOrder };
    case 'CLOSE_NEW_ORDER':
      return { ...state, openNewOrderModal: false };
    case 'UPDATE_NEW_ORDER_FIELD':
      return { ...state, newOrder: { ...state.newOrder, [action.payload.key]: action.payload.value } };
    case 'TOGGLE_ONSITE_SALE': {
        const isOnSite = action.payload;
        return {
            ...state,
            newOrder: {
                ...state.newOrder,
                isOnSiteSale: isOnSite,
                customerName: isOnSite ? `현장판매_${Date.now()}` : '',
                customerEmail: '',
                contact: '',
                address: '',
            }
        };
    }
    case 'UPDATE_NEW_ORDER_ITEM': {
        const newItems = [...state.newOrder.items];
        newItems[action.payload.index][action.payload.field] = action.payload.value;
        return { ...state, newOrder: { ...state.newOrder, items: newItems } };
    }
    case 'ADD_NEW_ORDER_ITEM':
        return { ...state, newOrder: { ...state.newOrder, items: [...state.newOrder.items, { product_id: '', quantity: 1, price_at_purchase: 0 }] } };
    case 'REMOVE_NEW_ORDER_ITEM':
        return { ...state, newOrder: { ...state.newOrder, items: state.newOrder.items.filter((_, i) => i !== action.payload) } };
    case 'SET_NEW_ORDER_CALCULATIONS':
        return { ...state, newOrderCalculations: action.payload };
    default:
      throw new Error();
  }
}

const OrderManagementPage = () => {
  const { user, hasPermission } = useAuth();
  const { addNotification } = useNotification();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [filterDrawerOpen, setFilterDrawerOpen] = React.useState(false);
  const [searchParams] = useSearchParams();
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    selectedStatus: searchParams.get('status') || '',
  });
  const [bulkStatus, setBulkStatus] = React.useState('');
  const [excelMenuAnchor, setExcelMenuAnchor] = React.useState(null);

  const handleSelectAllClick = () => {
    if (state.selectedOrders.length === state.orders.length && state.orders.length > 0) {
      dispatch({ type: 'SET_SELECTED_ORDERS', payload: [] });
    } else {
      dispatch({ type: 'SET_SELECTED_ORDERS', payload: state.orders.map(o => o.id) });
    }
  };

  const handleSelectOneClick = (event, id) => {
    event.stopPropagation();
    const selectedIndex = state.selectedOrders.indexOf(id);
    let newSelected = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(state.selectedOrders, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(state.selectedOrders.slice(1));
    } else if (selectedIndex === state.selectedOrders.length - 1) {
      newSelected = newSelected.concat(state.selectedOrders.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        state.selectedOrders.slice(0, selectedIndex),
        state.selectedOrders.slice(selectedIndex + 1),
      );
    }
    dispatch({ type: 'SET_SELECTED_ORDERS', payload: newSelected });
  };


  const ordersPerPage = 10;

  const fetchProducts = useCallback(async () => {
    dispatch({ type: 'SET_STATE', payload: { productsLoading: true } });
    try {
      const productsData = await fetchAllProducts();
      const newProductsMap = {};
      productsData.forEach(p => { newProductsMap[p.id] = { id: p.id, name: p.name, list_price: p.list_price, is_popular: p.is_popular, category: p.category }; });
      dispatch({ type: 'SET_STATE', payload: { products: productsData, productsMap: newProductsMap } });
    } catch {
      addNotification('상품 정보를 불러오는 데 실패했습니다.', 'error');
    } finally {
      dispatch({ type: 'SET_STATE', payload: { productsLoading: false } });
    }
  }, [addNotification]);

  const fetchEvents = useCallback(async () => {
    try {
      const eventsData = await getEvents();
      dispatch({ type: 'SET_STATE', payload: { events: eventsData } });
    } catch {
      addNotification('학회 정보를 불러오는 데 실패했습니다.', 'error');
    }
  }, [addNotification]);

  const fetchOrders = useCallback(async () => {
    dispatch({ type: 'SET_STATE', payload: { loading: true } });
    try {
      const { data, count } = await getOrders({
        currentPage: state.currentPage,
        ordersPerPage,
        searchTerm: state.searchTerm,
        selectedStatus: state.selectedStatus,
        selectedEvent: state.selectedEvent,
        startDate: state.startDate,
        endDate: state.endDate,
      });
      dispatch({ type: 'SET_STATE', payload: { orders: groupLinkedOrders(data || []), totalOrders: count || 0 } });
    } catch {
      addNotification('주문 정보를 불러오는 데 실패했습니다.', 'error');
      dispatch({ type: 'SET_STATE', payload: { orders: [], totalOrders: 0 } });
    }
    dispatch({ type: 'SET_STATE', payload: { loading: false } });
  }, [state.currentPage, state.searchTerm, state.selectedStatus, state.selectedEvent, state.startDate, state.endDate, addNotification]);

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase.from('site_settings').select('*').single();
    if (data) {
      dispatch({ type: 'SET_STATE', payload: { settings: data } });
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchEvents();
    fetchSettings();
  }, [fetchProducts, fetchEvents, fetchSettings]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // New Order Modal Calculations
  useEffect(() => {
    const currentEvent = state.events.find(e => e.id === state.newOrder.selectedEvent);
    const discountRate = currentEvent ? currentEvent.discount_rate : 0;

    // originalSubtotal = 정가 합계, discountedSubtotal = 할인가 합계 (price_at_purchase 기준)
    const originalSubtotal = state.newOrder.items.reduce((sum, item) => {
      const product = state.products.find(p => p.id === item.product_id);
      return sum + (product?.list_price || 0) * (item.quantity || 0);
    }, 0);
    const discountedSubtotal = state.newOrder.items.reduce((sum, item) => {
      return sum + (item.price_at_purchase || 0) * (item.quantity || 0);
    }, 0);
    const calculatedDiscount = originalSubtotal - discountedSubtotal;
    const { free_shipping_threshold, shipping_cost } = state.settings;
    const calculatedShipping = discountedSubtotal > 0 && discountedSubtotal < free_shipping_threshold ? shipping_cost : 0;
    const calculatedFinalPayment = discountedSubtotal + calculatedShipping;

    dispatch({ type: 'SET_NEW_ORDER_CALCULATIONS', payload: { totalAmount: originalSubtotal, discountAmount: calculatedDiscount, shippingCost: calculatedShipping, finalPayment: calculatedFinalPayment } });
  }, [state.newOrder.items, state.newOrder.selectedEvent, state.events, state.products, state.settings]);

  const handleSaveNewOrder = async () => {
    const { isOnSiteSale, customerName, customerEmail, selectedEvent, items } = state.newOrder;
    const { finalPayment, totalAmount, discountAmount, shippingCost } = state.newOrderCalculations;

    if (!isOnSiteSale && (!customerName || !customerEmail)) {
      addNotification('일반 주문은 고객명과 이메일을 모두 입력해야 합니다.', 'warning');
      return;
    }
    if (!selectedEvent) {
      addNotification('학회를 선택해주세요.', 'warning');
      return;
    }
    if (items.some(item => !item.product_id || item.quantity <= 0)) {
      addNotification('유효하지 않은 상품 항목이 있습니다. 상품을 선택하고 수량을 1 이상으로 입력하세요.', 'warning');
      return;
    }

    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({ ...state.newOrder, final_payment: finalPayment, total_amount: totalAmount, discount_amount: discountAmount, shipping_cost: shippingCost, status: 'pending' })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItemsToInsert = items.map(item => ({ ...item, order_id: orderData.id }));
      const { error: orderItemsError } = await supabase.from('order_items').insert(orderItemsToInsert);
      if (orderItemsError) throw orderItemsError;

      addNotification('신규 주문이 성공적으로 추가되었습니다.', 'success');
      dispatch({ type: 'CLOSE_NEW_ORDER' });
      fetchOrders();
    } catch (error) {
      console.error('Error saving new order:', error);
      addNotification(`신규 주문 추가 실패: ${error.message}`, 'error');
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus || state.selectedOrders.length === 0) {
      addNotification('변경할 상태를 선택하고, 하나 이상의 주문을 선택해주세요.', 'warning');
      return;
    }

    dispatch({ type: 'SET_STATE', payload: { loading: true } });
    try {
      // This RPC function needs to be created in Supabase
      const { error } = await supabase.rpc('bulk_update_order_status', {
        order_ids: state.selectedOrders,
        new_status: bulkStatus
      });

      if (error) throw error;

      addNotification(`${state.selectedOrders.length}개 주문의 상태가 '${statusToKorean[bulkStatus]}'으로 업데이트되었습니다.`, 'success');
      dispatch({ type: 'SET_SELECTED_ORDERS', payload: [] });
      setBulkStatus('');
      fetchOrders(); // Refresh the orders list
    } catch (err) {
      addNotification(`일괄 상태 업데이트 실패: ${err.message}`, 'error');
    } finally {
        dispatch({ type: 'SET_STATE', payload: { loading: false } });
    }
  };

  const handleExcelDownload = async (type) => {
    setExcelMenuAnchor(null);
    dispatch({ type: 'SET_STATE', payload: { loading: true } });
    try {
      const { data: allOrders, error } = await getOrders({ ...state, currentPage: 1, ordersPerPage: state.totalOrders });
      if (error) throw error;

      const dataForExcel = [];
      const isFilteredByEvent = Boolean(state.selectedEvent);
      
      allOrders.forEach(order => {
        const orderEvent = state.events.find(e => e.id === order.event_id)?.name || 'N/A';
        
        const itemsToExport = order.order_items.filter(item => {
           const product = state.productsMap[item.product_id];
           if (!product) return false;
           
           if (type === 'book') return product.category === '도서';
           if (type === 'test') return product.category?.includes('검사') || product.category === '온라인검사';
           return true;
        });

        if (itemsToExport.length === 0) return;

        itemsToExport.forEach(item => {
           const product = state.productsMap[item.product_id];
           const row = {
             '주문일시': format(new Date(order.created_at), 'yyyy-MM-dd HH:mm'),
             '주문번호': order.id,
             '고객명': order.customer_name,
             '이메일': order.email,
             '연락처': order.phone_number,
             '배송 주소': `${order.shipping_address?.postcode || ''} ${order.shipping_address?.address || ''} ${order.shipping_address?.detail || ''}`.trim(),
             '고객 요청사항': order.customer_request || '-',
             '관리자 메모': order.admin_memo || '-',
           };
           
           if (!isFilteredByEvent) {
             row['학회명'] = orderEvent;
           }

           row['카테고리'] = product?.category || 'N/A';
           row['상품명'] = product?.name || 'N/A';
           row['주문 수량'] = item.quantity;
           row['실결제금액(참고)'] = order.final_payment;
           row['상태'] = statusToKorean[order.status] || order.status;
           
           dataForExcel.push(row);
        });
      });

      if (dataForExcel.length === 0) {
        addNotification(`해당 조건에 맞는 주문 내역이 없습니다. (출고 데이터 없음)`, 'warning');
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '출고목록');
      
      const dateStr = format(new Date(), 'yyyyMMdd');
      const eventPrefix = isFilteredByEvent 
        ? `[${state.events.find(e => e.id === state.selectedEvent)?.name}]_` 
        : '';
      const typeStr = type === 'book' ? '도서출고목록' : type === 'test' ? '검사출고목록' : '통합주문목록';
      
      XLSX.writeFile(workbook, `${eventPrefix}${typeStr}_${dateStr}.xlsx`);
      addNotification('엑셀 파일이 성공적으로 생성되었습니다.', 'success');
    } catch (err) {
      addNotification(`엑셀 다운로드 실패: ${err.message}`, 'error');
    } finally {
      dispatch({ type: 'SET_STATE', payload: { loading: false } });
    }
  };

  const handleStatusChange = useCallback(async (orderId, newStatus) => {
    try {
      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
      if (error) throw error;
      addNotification(`주문 ${orderId}의 상태가 '${statusToKorean[newStatus]}'으로 업데이트되었습니다.`, 'success');
      fetchOrders();
    } catch (err) {
      addNotification(`주문 상태 업데이트 실패: ${err.message}`, 'error');
    }
  }, [fetchOrders, addNotification]);

  const formatOrderId = (order) => {
    if (order.parent_order_id) {
      return `#${order.id}(${order.parent_order_id})`;
    }
    if (order.linkedChildren && order.linkedChildren.length > 0) {
      return `#${order.id}-${order.linkedChildren.length + 1}`;
    }
    return `#${order.id}`;
  };

  const filterControls = (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel>학회 선택</InputLabel>
        <Select
          value={state.selectedEvent}
          label="학회 선택"
          onChange={(e) => dispatch({ type: 'SET_FILTER', payload: { key: 'selectedEvent', value: e.target.value } })}
        >
          <MenuItem value=""><em>전체</em></MenuItem>
          {state.events.map((event) => <MenuItem key={event.id} value={event.id}>{event.name}</MenuItem>)}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel>주문 상태</InputLabel>
        <Select
          value={state.selectedStatus}
          label="주문 상태"
          onChange={(e) => dispatch({ type: 'SET_FILTER', payload: { key: 'selectedStatus', value: e.target.value } })}
        >
          <MenuItem value=""><em>전체</em></MenuItem>
          {Object.entries(statusToKorean).map(([key, value]) => <MenuItem key={key} value={key}>{value}</MenuItem>)}
        </Select>
      </FormControl>
      <TextField
        label="고객 이름/이메일 검색"
        variant="outlined"
        size="small"
        sx={{ flex: 1, minWidth: 180 }}
        value={state.searchTerm}
        onChange={(e) => dispatch({ type: 'SET_FILTER', payload: { key: 'searchTerm', value: e.target.value } })}
      />
      <TextField
        label="시작일"
        type="date"
        variant="outlined"
        size="small"
        value={state.startDate ? format(state.startDate, 'yyyy-MM-dd') : ''}
        onChange={(e) => dispatch({ type: 'SET_FILTER', payload: { key: 'startDate', value: e.target.value ? new Date(e.target.value) : null } })}
        InputLabelProps={{ shrink: true }}
        sx={{ minWidth: 150 }}
      />
      <TextField
        label="종료일"
        type="date"
        variant="outlined"
        size="small"
        value={state.endDate ? format(state.endDate, 'yyyy-MM-dd') : ''}
        onChange={(e) => dispatch({ type: 'SET_FILTER', payload: { key: 'endDate', value: e.target.value ? new Date(e.target.value) : null } })}
        InputLabelProps={{ shrink: true }}
        sx={{ minWidth: 150 }}
      />
      <Button variant="outlined" onClick={() => { dispatch({ type: 'CLEAR_FILTERS' }); if (isMobile) setFilterDrawerOpen(false); }}>
        필터 초기화
      </Button>
    </Box>
  );

  if (!user || (!hasPermission('orders:view') && !hasPermission('master'))) {
    return <Box sx={{ p: 3 }}><Typography>주문 관리 페이지 접근 권한이 없습니다.</Typography></Box>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', p: { xs: 1, md: 2 } }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 2, px: { xs: 1, md: 0 } }}>주문 관리</Typography>

      {isMobile ? (
        <Box sx={{ px: 1, mb: 2, display: 'flex', justifyContent: 'flex-start' }}>
          <Button startIcon={<FilterListIcon />} variant="outlined" onClick={() => setFilterDrawerOpen(true)} sx={{ borderRadius: '8px' }}>
            필터
          </Button>
          <SwipeableDrawer 
            anchor="bottom" 
            open={filterDrawerOpen} 
            onClose={() => setFilterDrawerOpen(false)} 
            onOpen={() => setFilterDrawerOpen(true)}
            PaperProps={{ sx: { borderRadius: '16px 16px 0 0', p: 3, pb: 6, maxHeight: '80vh' } }}
          >
            <Typography variant="h6" fontWeight="bold" mb={2}>주문 필터</Typography>
            {filterControls}
            <Button variant="contained" fullWidth sx={{ mt: 3, borderRadius: '8px', minHeight: 48 }} onClick={() => setFilterDrawerOpen(false)}>
              확인
            </Button>
          </SwipeableDrawer>
        </Box>
      ) : (
        <Paper sx={{ p: 2, mb: 2 }}>
          {filterControls}
        </Paper>
      )}

      <Paper sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Box flexGrow={1}>
            {hasPermission('orders:edit') && state.selectedOrders.length > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, backgroundColor: 'grey.100', borderRadius: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                        {state.selectedOrders.length}개 선택됨
                    </Typography>
                    <FormControl size="small" sx={{ minWidth: 150, backgroundColor: 'white' }}>
                        <InputLabel>상태 일괄 변경</InputLabel>
                        <Select
                            value={bulkStatus}
                            label="상태 일괄 변경"
                            onChange={(e) => setBulkStatus(e.target.value)}
                        >
                            {Object.entries(statusToKorean).map(([key, value]) => <MenuItem key={key} value={key}>{value}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <Button variant="contained" onClick={handleBulkStatusUpdate} disabled={!bulkStatus}>
                        적용
                    </Button>
                </Box>
            )}
          </Box>
          <Box display="flex" gap={2}>
            {hasPermission('orders:edit') && <Button variant="contained" color="primary" onClick={() => dispatch({ type: 'OPEN_NEW_ORDER' })}>신규 주문 추가</Button>}
            <Button 
              variant="outlined" 
              onClick={(e) => setExcelMenuAnchor(e.currentTarget)}
              endIcon={<KeyboardArrowDownIcon />}
            >
              엑셀 다운로드
            </Button>
            <Menu
              anchorEl={excelMenuAnchor}
              open={Boolean(excelMenuAnchor)}
              onClose={() => setExcelMenuAnchor(null)}
            >
              <MenuItem onClick={() => handleExcelDownload('book')}>📘 도서 출고 전용 엑셀</MenuItem>
              <MenuItem onClick={() => handleExcelDownload('test')}>📄 검사 출고 전용 엑셀</MenuItem>
              <Divider />
              <MenuItem onClick={() => handleExcelDownload('all')}>전체 통합 엑셀 (백업용)</MenuItem>
            </Menu>
          </Box>
        </Box>
        {isMobile ? (
          <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 1 }}>
            {state.loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
            ) : state.orders.length === 0 ? (
              <Box sx={{ py: 4 }}>
                <EmptyState 
                  message={state.searchTerm || state.selectedStatus || state.selectedEvent ? "조건에 맞는 주문이 없습니다." : "아직 접수된 주문이 없습니다."}
                  subMessage={state.searchTerm || state.selectedStatus || state.selectedEvent ? "검색 조건이나 필터를 변경해보세요." : "새로운 주문이 들어오면 여기에 표시됩니다."}
                />
              </Box>
            ) : (
              <Stack spacing={2} sx={{ pb: 2 }}>
                {state.orders.map((order) => {
                  const isSelected = state.selectedOrders.indexOf(order.id) !== -1;
                  return (
                    <Card 
                      key={order.id} 
                      variant="outlined" 
                      onClick={() => dispatch({ type: 'OPEN_ORDER_DETAIL', payload: order })}
                      sx={{ borderRadius: '12px', borderColor: isSelected ? 'primary.main' : 'divider', borderWidth: isSelected ? 2 : 1 }}
                    >
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                          <Box display="flex" alignItems="center" gap={1}>
                            {hasPermission('orders:edit') && (
                              <Checkbox
                                checked={isSelected}
                                onClick={(event) => handleSelectOneClick(event, order.id)}
                                sx={{ p: 0 }}
                              />
                            )}
                            <Typography variant="subtitle2" color="text.secondary">
                              {format(new Date(order.created_at), 'yyyy-MM-dd')}
                            </Typography>
                          </Box>
                          <Chip 
                            label={statusToKorean[order.status]} 
                            size="small" 
                            color={order.status === 'completed' ? 'success' : order.status === 'pending' ? 'warning' : 'default'} 
                            sx={{ fontWeight: 'bold' }} 
                          />
                        </Box>
                        <Box display="flex" justifyContent="space-between" alignItems="flex-end">
                          <Box>
                            <Typography fontWeight="bold" fontSize="1.1rem">{order.customer_name}</Typography>
                            <Typography variant="body2" color="text.secondary">{state.events.find(e => e.id === order.event_id)?.name || 'N/A'}</Typography>
                          </Box>
                          <Typography fontWeight="bold" color="primary.main">{(order.final_payment || 0).toLocaleString()}원</Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            )}
          </Box>
        ) : (
          <TableContainer sx={{ flexGrow: 1 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow sx={{ '& .MuiTableCell-root': { bgcolor: 'grey.200', fontWeight: 'bold' } }}>
                  {hasPermission('orders:edit') && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={state.selectedOrders.length > 0 && state.selectedOrders.length < state.orders.length}
                        checked={state.orders.length > 0 && state.selectedOrders.length === state.orders.length}
                        onChange={handleSelectAllClick}
                        inputProps={{ 'aria-label': 'select all orders' }}
                      />
                    </TableCell>
                  )}
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
                {state.loading ? (
                  <TableSkeleton rows={ordersPerPage} columns={hasPermission('orders:edit') ? 8 : 7} />
                ) : state.orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={hasPermission('orders:edit') ? 8 : 7}>
                      <Box sx={{ py: 4 }}>
                        {state.searchTerm || state.selectedStatus || state.selectedEvent ? (
                          <EmptyState 
                            message="조건에 맞는 주문이 없습니다." 
                            subMessage="검색 조건이나 필터를 변경해보세요."
                            icon={<SearchOffIcon sx={{ fontSize: 64 }} />}
                            action={{ label: "필터 초기화", onClick: () => dispatch({ type: 'CLEAR_FILTERS' }) }}
                          />
                        ) : (
                          <EmptyState 
                            message="아직 접수된 주문이 없습니다." 
                            subMessage="새로운 주문이 들어오면 여기에 표시됩니다."
                          />
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  state.orders.map((order) => {
                    const isSelected = state.selectedOrders.indexOf(order.id) !== -1;
                    return (
                      <TableRow 
                        key={order.id} 
                        hover 
                        role="checkbox" 
                        aria-checked={isSelected} 
                        tabIndex={-1} 
                        selected={isSelected}
                        sx={{ cursor: 'pointer' }}
                      >
                        {hasPermission('orders:edit') && (
                          <TableCell padding="checkbox" onClick={(event) => handleSelectOneClick(event, order.id)}>
                            <Checkbox
                              checked={isSelected}
                              inputProps={{ 'aria-labelledby': `order-checkbox-${order.id}` }}
                            />
                          </TableCell>
                        )}
                        <TableCell onClick={() => dispatch({ type: 'OPEN_ORDER_DETAIL', payload: order })}>{formatOrderId(order)}</TableCell>
                        <TableCell onClick={() => dispatch({ type: 'OPEN_ORDER_DETAIL', payload: order })}>{order.customer_name}</TableCell>
                        <TableCell onClick={() => dispatch({ type: 'OPEN_ORDER_DETAIL', payload: order })}>{order.email}</TableCell>
                        <TableCell onClick={() => dispatch({ type: 'OPEN_ORDER_DETAIL', payload: order })}>{state.events.find(e => e.id === order.event_id)?.name || 'N/A'}</TableCell>
                        <TableCell onClick={() => dispatch({ type: 'OPEN_ORDER_DETAIL', payload: order })}>{(order.final_payment || 0).toLocaleString()}원</TableCell>
                        <TableCell onClick={() => dispatch({ type: 'OPEN_ORDER_DETAIL', payload: order })}>{format(new Date(order.created_at), 'yyyy-MM-dd HH:mm')}</TableCell>
                        <TableCell>
                          <FormControl size="small" variant="outlined" sx={{ minWidth: 100 }} onClick={(e) => e.stopPropagation()}>
                            <Select value={order.status} onChange={(e) => handleStatusChange(order.id, e.target.value)} disabled={!hasPermission('orders:edit')}>
                              {Object.entries(statusToKorean).map(([key, value]) => <MenuItem key={key} value={key}>{value}</MenuItem>)}
                            </Select>
                          </FormControl>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <Pagination count={Math.ceil(state.totalOrders / ordersPerPage)} page={state.currentPage} onChange={(_, value) => dispatch({ type: 'SET_FILTER', payload: { key: 'currentPage', value } })} color="primary" />
        </Box>
      </Paper>

      {state.selectedOrder && !state.productsLoading && (
        <OrderDetailModal
          open={state.openOrderDetailModal}
          onClose={() => dispatch({ type: 'CLOSE_ORDER_DETAIL' })}
          order={state.selectedOrder}
          statusToKorean={statusToKorean}
          productsMap={state.productsMap}
          products={state.products}
          events={state.events}
          addNotification={addNotification}
          onUpdate={fetchOrders}
          hasPermission={hasPermission}
        />
      )}

      <Dialog open={state.openNewOrderModal} onClose={() => dispatch({ type: 'CLOSE_NEW_ORDER' })} maxWidth="md" fullWidth>
        <DialogTitle>신규 주문 추가</DialogTitle>
        <DialogContent>
          <FormControlLabel
            control={<Checkbox checked={state.newOrder.isOnSiteSale} onChange={(e) => dispatch({ type: 'TOGGLE_ONSITE_SALE', payload: e.target.checked })} />}
            label="현장판매"
          />
          <TextField margin="dense" label="고객명" fullWidth variant="standard" value={state.newOrder.customerName} onChange={(e) => dispatch({ type: 'UPDATE_NEW_ORDER_FIELD', payload: { key: 'customerName', value: e.target.value } })} disabled={state.newOrder.isOnSiteSale} required={!state.newOrder.isOnSiteSale} />
          <TextField margin="dense" label="이메일" type="email" fullWidth variant="standard" value={state.newOrder.customerEmail} onChange={(e) => dispatch({ type: 'UPDATE_NEW_ORDER_FIELD', payload: { key: 'customerEmail', value: e.target.value } })} disabled={state.newOrder.isOnSiteSale} required={!state.newOrder.isOnSiteSale} />
          <TextField margin="dense" label="연락처" fullWidth variant="standard" value={state.newOrder.contact} onChange={(e) => dispatch({ type: 'UPDATE_NEW_ORDER_FIELD', payload: { key: 'contact', value: e.target.value } })} disabled={state.newOrder.isOnSiteSale} />
          <TextField margin="dense" label="주소" fullWidth variant="standard" value={state.newOrder.address} onChange={(e) => dispatch({ type: 'UPDATE_NEW_ORDER_FIELD', payload: { key: 'address', value: e.target.value } })} disabled={state.newOrder.isOnSiteSale} />
          
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, mt: 2 }}>
            <FormControl fullWidth margin="dense">
              <InputLabel>학회 선택 *</InputLabel>
              <Select value={state.newOrder.selectedEvent} onChange={(e) => dispatch({ type: 'UPDATE_NEW_ORDER_FIELD', payload: { key: 'selectedEvent', value: e.target.value } })} required>
                {state.events.map((event) => <MenuItem key={event.id} value={event.id}>{event.name}</MenuItem>)}
              </Select>
            </FormControl>
            {state.newOrder.selectedEvent && (
              <Typography variant="body2" color="primary" sx={{ mb: 1, whiteSpace: 'nowrap' }}>
                (할인율: {Math.round((state.events.find(e => e.id === state.newOrder.selectedEvent)?.discount_rate || 0) * 100)}%)
              </Typography>
            )}
          </Box>

          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>주문 항목</Typography>
          {state.newOrder.items.map((item, index) => (
            <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
              <Autocomplete
                options={state.products}
                getOptionLabel={(option) => option.name || ''}
                value={state.products.find(p => p.id === item.product_id) || null}
                onChange={(event, newValue) => {
                    const newItems = [...state.newOrder.items];
                    if (newValue) {
                        newItems[index].product_id = newValue.id;
                        newItems[index].price_at_purchase = newValue.list_price;
                    } else {
                        newItems[index].product_id = '';
                        newItems[index].price_at_purchase = 0;
                    }
                    dispatch({ type: 'UPDATE_NEW_ORDER_FIELD', payload: { key: 'items', value: newItems } });
                }}
                loading={state.productsLoading}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="상품 검색"
                    variant="standard"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {state.productsLoading ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                sx={{ flexGrow: 1 }}
              />
              <TextField label="수량" type="number" value={item.quantity} onChange={(e) => dispatch({ type: 'UPDATE_NEW_ORDER_ITEM', payload: { index, field: 'quantity', value: parseInt(e.target.value, 10) || 1 } })} sx={{ width: 100 }} InputProps={{ inputProps: { min: 1 } }} />
              <TextField label="개당 가격" type="number" value={item.price_at_purchase} onChange={(e) => dispatch({ type: 'UPDATE_NEW_ORDER_ITEM', payload: { index, field: 'price_at_purchase', value: parseFloat(e.target.value) || 0 } })} sx={{ width: 150 }} />
              <IconButton onClick={() => dispatch({ type: 'REMOVE_NEW_ORDER_ITEM', payload: index })}><CloseIcon /></IconButton>
            </Box>
          ))}
          <Button onClick={() => dispatch({ type: 'ADD_NEW_ORDER_ITEM' })} sx={{ mt: 1 }}>항목 추가</Button>
          
          <Paper variant="outlined" sx={{ p: 2, mt: 2, backgroundColor: 'grey.50' }}>
            <Typography variant="h6" gutterBottom>주문 요약</Typography>
            <Grid container spacing={1}>
                <Grid item xs={6}><Typography>총 상품 금액:</Typography></Grid>
                <Grid item xs={6} textAlign="right"><Typography>{state.newOrderCalculations.totalAmount.toLocaleString()}원</Typography></Grid>
                <Grid item xs={6}><Typography color="error">할인 금액:</Typography></Grid>
                <Grid item xs={6} textAlign="right"><Typography color="error">- {state.newOrderCalculations.discountAmount.toLocaleString()}원</Typography></Grid>
                <Grid item xs={6}><Typography>배송비:</Typography></Grid>
                <Grid item xs={6} textAlign="right"><Typography>{state.newOrderCalculations.shippingCost.toLocaleString()}원</Typography></Grid>
                <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>
                <Grid item xs={6}><Typography variant="h6" component="div">최종 결제 금액:</Typography></Grid>
                <Grid item xs={6} textAlign="right"><Typography variant="h6" component="div">{state.newOrderCalculations.finalPayment.toLocaleString()}원</Typography></Grid>
            </Grid>
          </Paper>

        </DialogContent>
        <DialogActions>
          <Button onClick={() => dispatch({ type: 'CLOSE_NEW_ORDER' })}>취소</Button>
          <Button onClick={handleSaveNewOrder} variant="contained">저장</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrderManagementPage;