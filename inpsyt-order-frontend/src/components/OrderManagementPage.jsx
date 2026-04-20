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
  ListItemText,
  OutlinedInput,
  Divider,
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
import { Close as CloseIcon, KeyboardArrowDown as KeyboardArrowDownIcon, ShoppingCart as ShoppingCartIcon, RestartAlt as RestartAltIcon } from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import OrderDetailModal from './OrderDetailModal';
import NewOrderModal from './NewOrderModal';
import EmptyState from './EmptyState';
import TableSkeleton from './TableSkeleton';
import { SearchOff as SearchOffIcon, FilterList as FilterListIcon } from '@mui/icons-material';
import { getEvents } from '../api/events';
import { fetchAllProducts } from '../api/products';
import { getOrders, groupLinkedOrders } from '../api/orders';
import { sendAlimtalk } from '../api/alimtalk';

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
  selectedStatuses: [],
  events: [],
  selectedEvents: [],
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
        selectedStatuses: [],
        selectedEvents: [],
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
  // lazy init: 모듈 로드 시점에 한 번 고정되는 것이 아니라, 컴포넌트 마운트 시점에 재평가.
  // 장기 세션(탭을 며칠간 열어둠)에서 startDate/endDate가 옛날 날짜로 굳는 버그 방지.
  const [state, dispatch] = useReducer(reducer, null, () => ({
    ...initialState,
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
    selectedStatuses: searchParams.get('status') ? [searchParams.get('status')] : [],
  }));
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
        selectedStatuses: state.selectedStatuses,
        selectedEvents: state.selectedEvents,
        startDate: state.startDate,
        endDate: state.endDate,
      });
      dispatch({ type: 'SET_STATE', payload: { orders: groupLinkedOrders(data || []), totalOrders: count || 0 } });
    } catch {
      addNotification('주문 정보를 불러오는 데 실패했습니다.', 'error');
      dispatch({ type: 'SET_STATE', payload: { orders: [], totalOrders: 0 } });
    }
    dispatch({ type: 'SET_STATE', payload: { loading: false } });
  }, [state.currentPage, state.searchTerm, state.selectedStatuses, state.selectedEvents, state.startDate, state.endDate, addNotification]);

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


  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus || state.selectedOrders.length === 0) {
      addNotification('변경할 상태를 선택하고, 하나 이상의 주문을 선택해주세요.', 'warning');
      return;
    }

    dispatch({ type: 'SET_STATE', payload: { loading: true } });
    try {
      const { error } = await supabase.rpc('bulk_update_order_status', {
        order_ids: state.selectedOrders,
        new_status: bulkStatus
      });

      if (error) throw error;

      addNotification(`${state.selectedOrders.length}개 주문의 상태가 '${statusToKorean[bulkStatus]}'으로 업데이트되었습니다.`, 'success');

      // paid 일괄 전환 시 알림톡 순차 발송
      if (bulkStatus === 'paid') {
        let successCount = 0;
        let failCount = 0;
        let firstFailReason = null;

        for (const orderId of state.selectedOrders) {
          const { success, skipped, error: alimtalkError } = await sendAlimtalk(orderId);
          if (skipped) continue;
          if (success) successCount++;
          else {
            failCount++;
            if (!firstFailReason) firstFailReason = alimtalkError;
          }
        }

        if (successCount + failCount > 0) {
          if (failCount === 0) {
            addNotification(`알림톡 ${successCount}건 발송 완료`, 'info');
          } else {
            const reason = firstFailReason ? ` — ${firstFailReason}` : '';
            addNotification(`알림톡 ${successCount}건 성공, ${failCount}건 실패${reason} — 실패 건은 모달에서 재발송하세요.`, 'warning');
          }
        }
      }

      dispatch({ type: 'SET_SELECTED_ORDERS', payload: [] });
      setBulkStatus('');
      fetchOrders();
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
      const { data: allOrders, error } = await getOrders({
        currentPage: 1,
        ordersPerPage: state.totalOrders,
        searchTerm: state.searchTerm,
        selectedStatuses: state.selectedStatuses,
        selectedEvents: state.selectedEvents,
        startDate: state.startDate,
        endDate: state.endDate,
      });
      if (error) throw error;

      const dataForExcel = [];
      const isFilteredByEvent = state.selectedEvents.length === 1;
      
      allOrders.forEach(order => {
        const orderEvent = state.events.find(e => e.id === order.event_id)?.name || 'N/A';
        
        const itemsToExport = order.order_items.filter(item => {
           const itemCategory = item.category || state.productsMap[item.product_id]?.category;
           if (!itemCategory && !state.productsMap[item.product_id]) return false;

           if (type === 'book') return itemCategory === '도서';
           if (type === 'test') return itemCategory?.includes('검사') || itemCategory === '온라인검사';
           return true;
        });

        if (itemsToExport.length === 0) return;

        itemsToExport.forEach(item => {
           const product = state.productsMap[item.product_id];
           const row = {
             '주문일시': format(new Date(order.created_at), 'yyyy-MM-dd HH:mm'),
             '주문번호': order.id,
             '고객명': order.customer_name,
             '연락처': order.phone_number,
             '배송 주소': `${order.shipping_address?.postcode || ''} ${order.shipping_address?.address || ''} ${order.shipping_address?.detail || ''}`.trim(),
             '고객 요청사항': order.customer_request || '-',
             '관리자 메모': order.admin_memo || '-',
           };

           if (!isFilteredByEvent) {
             row['학회명'] = orderEvent;
           }

           row['카테고리'] = item.category || product?.category || 'N/A';
           row['상품명'] = item.product_name || product?.name || 'N/A';
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
        ? `[${state.events.find(e => e.id === state.selectedEvents[0])?.name}]_`
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

      // paid 전환 시 알림톡 자동 발송 (현장 수령 제외)
      if (newStatus === 'paid') {
        sendAlimtalk(orderId).then(({ success, error: alimtalkError, skipped }) => {
          if (skipped) return;
          if (!success) addNotification(`알림톡 발송 실패 — ${alimtalkError}`, 'warning');
          else addNotification('알림톡 발송 완료', 'info');
        });
      }
    } catch (err) {
      addNotification(`주문 상태 업데이트 실패: ${err.message}`, 'error');
    }
  }, [fetchOrders, addNotification, state.orders]);

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
      {/* 학회 멀티 선택 */}
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <InputLabel>학회 선택</InputLabel>
        <Select
          multiple
          value={state.selectedEvents}
          label="학회 선택"
          input={<OutlinedInput label="학회 선택" />}
          onChange={(e) => dispatch({ type: 'SET_FILTER', payload: { key: 'selectedEvents', value: e.target.value } })}
          renderValue={(selected) =>
            selected.length === 0
              ? '전체'
              : selected.length === 1
              ? state.events.find(e => e.id === selected[0])?.name || ''
              : `${selected.length}개 선택`
          }
        >
          {state.events.map((event) => (
            <MenuItem key={event.id} value={event.id}>
              <Checkbox checked={state.selectedEvents.includes(event.id)} size="small" />
              <ListItemText primary={event.name} primaryTypographyProps={{ variant: 'body2' }} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* 주문상태 멀티 선택 */}
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel>주문 상태</InputLabel>
        <Select
          multiple
          value={state.selectedStatuses}
          label="주문 상태"
          input={<OutlinedInput label="주문 상태" />}
          onChange={(e) => dispatch({ type: 'SET_FILTER', payload: { key: 'selectedStatuses', value: e.target.value } })}
          renderValue={(selected) =>
            selected.length === 0
              ? '전체'
              : selected.map(s => statusToKorean[s]).join(', ')
          }
        >
          {Object.entries(statusToKorean).map(([key, value]) => (
            <MenuItem key={key} value={key}>
              <Checkbox checked={state.selectedStatuses.includes(key)} size="small" />
              <ListItemText primary={value} primaryTypographyProps={{ variant: 'body2' }} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        label="고객명 검색"
        variant="outlined"
        size="small"
        sx={{ flex: 1, minWidth: 160 }}
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
      <Button
        variant="outlined"
        startIcon={<RestartAltIcon />}
        onClick={() => { dispatch({ type: 'CLEAR_FILTERS' }); if (isMobile) setFilterDrawerOpen(false); }}
      >
        초기화
      </Button>
    </Box>
  );

  if (!user || (!hasPermission('orders:view') && !hasPermission('master'))) {
    return <Box sx={{ p: 3 }}><Typography>주문 관리 페이지 접근 권한이 없습니다.</Typography></Box>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <ShoppingCartIcon sx={{ color: 'primary.main', fontSize: '1.4rem' }} />
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>주문 관리</Typography>
      </Box>

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
            {hasPermission('orders:edit') && <Button variant="contained" color="primary" onClick={() => dispatch({ type: 'OPEN_NEW_ORDER' })}>+ 신규 주문</Button>}
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
                  message={state.searchTerm || state.selectedStatuses.length > 0 || state.selectedEvents.length > 0 ? "조건에 맞는 주문이 없습니다." : "아직 접수된 주문이 없습니다."}
                  subMessage={state.searchTerm || state.selectedStatuses.length > 0 || state.selectedEvents.length > 0 ? "검색 조건이나 필터를 변경해보세요." : "새로운 주문이 들어오면 여기에 표시됩니다."}
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
                        {state.searchTerm || state.selectedStatuses.length > 0 || state.selectedEvents.length > 0 ? (
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

      <NewOrderModal
        open={state.openNewOrderModal}
        onClose={() => dispatch({ type: 'CLOSE_NEW_ORDER' })}
        onSuccess={() => { fetchOrders(); }}
        events={state.events}
        products={state.products}
        settings={state.settings}
      />
    </Box>
  );
};

export default OrderManagementPage;