import React, { useState, useEffect } from 'react';
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
  MenuItem,
  Select,
  FormControl,
  IconButton,
  Modal,
  Backdrop,
  Fade,
  Drawer,
  useMediaQuery,
  useTheme,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
  CircularProgress,
  Alert,
  Collapse,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { supabase } from '../supabaseClient';
import { linkOrders, searchOrdersForLinking } from '../api/orders';
import { sendAlimtalk } from '../api/alimtalk';

const OrderDetailModal = ({ order, open, onClose, statusToKorean, productsMap, products, events, addNotification, onUpdate, productsLoading, hasPermission }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Initialize state with empty/default values, not from props directly.
  const [isEditing, setIsEditing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('');
  const [editedCustomerName, setEditedCustomerName] = useState('');
  const [editedCustomerEmail, setEditedCustomerEmail] = useState('');
  const [editedPhoneNumber, setEditedPhoneNumber] = useState('');
  const [editedShippingAddress, setEditedShippingAddress] = useState('');
  const [editedShippingPostcode, setEditedShippingPostcode] = useState('');
  const [editedShippingDetail, setEditedShippingDetail] = useState('');
  const [editedCustomerRequest, setEditedCustomerRequest] = useState('');
  const [editedOrderItems, setEditedOrderItems] = useState([]);
  const [editedEventId, setEditedEventId] = useState('');
  const [editedAdminMemo, setEditedAdminMemo] = useState('');
  
  const [subtotal, setSubtotal] = useState(0);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [shippingFee, setShippingFee] = useState(0);
  const [finalTotal, setFinalTotal] = useState(0);

  const [linkedParent, setLinkedParent] = useState(null);
  const [linkedChildren, setLinkedChildren] = useState([]);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkSearchTerm, setLinkSearchTerm] = useState('');
  const [linkSearchResults, setLinkSearchResults] = useState([]);
  const [linkSearchLoading, setLinkSearchLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);

  // Settings state
  const [settings, setSettings] = useState({
    free_shipping_threshold: 30000,
    shipping_cost: 3000,
  });

  // Fetch settings
  useEffect(() => {
    supabase
      .from('site_settings')
      .select('*')
      .single()
      .then(({ data }) => {
        if (data) setSettings(data);
      });
  }, []);

  // This useEffect is the single source of truth for setting state from the order prop.
  useEffect(() => {
    if (order) {
      setEditedOrderItems(JSON.parse(JSON.stringify(order.mergedItems || order.order_items || [])));
      setCurrentStatus(order.status || '');
      setEditedCustomerName(order.customer_name || '');
      setEditedCustomerEmail(order.email || '');
      setEditedPhoneNumber(order.phone_number || '');
      setEditedShippingAddress(order.shipping_address?.address || '');
      setEditedShippingPostcode(order.shipping_address?.postcode || '');
      setEditedShippingDetail(order.shipping_address?.detail || '');
      setEditedCustomerRequest(order.customer_request || '');
      setEditedEventId(order.event_id || '');
      setEditedAdminMemo(order.admin_memo || '');
      setIsEditing(false);

      // When not in editing mode, show the stored values.
      setSubtotal(order.total_cost || 0);
      setTotalDiscount(order.discount_amount || 0);
      setShippingFee(order.delivery_fee || 0);
      setFinalTotal(order.final_payment || 0);
    }
  }, [order]);

  // Recalculate totals ONLY when in editing mode
  useEffect(() => {
    if (!isEditing || !events || !productsMap) return;

    const currentEvent = events.find(e => e.id === editedEventId);
    const discountRate = currentEvent?.discount_rate || 0;

    let currentSubtotal = 0;
    (editedOrderItems || []).forEach(item => {
      const product = productsMap[item.product_id];
      const originalPrice = product?.list_price || 0;
      currentSubtotal += originalPrice * item.quantity;
    });

    const currentTotalDiscount = currentSubtotal * discountRate;
    const subtotalAfterDiscount = currentSubtotal - currentTotalDiscount;
    // 무료배송 기준은 정가(할인 전) 기준 — create-order Edge Function과 동일한 로직
    const currentShippingFee = currentSubtotal >= settings.free_shipping_threshold ? 0 : settings.shipping_cost;
    const currentFinalTotal = subtotalAfterDiscount + currentShippingFee;

    setSubtotal(currentSubtotal);
    setTotalDiscount(currentTotalDiscount);
    setShippingFee(currentShippingFee);
    setFinalTotal(currentFinalTotal);

  }, [isEditing, editedOrderItems, editedEventId, productsMap, events, settings]);

  useEffect(() => {
    if (!order) return;
    setLinkedParent(null);
    setLinkedChildren([]);

    // Fetch parent order if this is a child
    if (order.parent_order_id) {
      supabase
        .from('orders')
        .select('id, customer_name, phone_number, total_cost, final_payment, delivery_fee, status, created_at')
        .eq('id', order.parent_order_id)
        .single()
        .then(({ data }) => { if (data) setLinkedParent(data); });
    }

    // Fetch child orders (orders that reference this one as parent)
    supabase
      .from('orders')
      .select('id, customer_name, phone_number, total_cost, final_payment, delivery_fee, status, created_at')
      .eq('parent_order_id', order.id)
      .then(({ data }) => { if (data) setLinkedChildren(data); });
  }, [order]);


  const handleAddOrderItem = () => {
    if (products && products.length > 0) {
      const defaultProduct = products[0];
      setEditedOrderItems([...editedOrderItems, { product_id: defaultProduct.id, quantity: 1 }]);
    } else {
      addNotification('추가할 상품 정보가 없습니다.', 'warning');
    }
  };

  const handleRemoveOrderItem = (index) => {
    const updatedItems = editedOrderItems.filter((_, i) => i !== index);
    setEditedOrderItems(updatedItems);
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...editedOrderItems];
    updatedItems[index][field] = value;
    setEditedOrderItems(updatedItems);
  };


  const handleSaveAll = async () => {
    try {
      const updatedShippingAddress = { postcode: editedShippingPostcode, address: editedShippingAddress, detail: editedShippingDetail };
      const orderUpdates = {
        status: currentStatus,
        customer_name: editedCustomerName,
        email: editedCustomerEmail,
        phone_number: editedPhoneNumber,
        shipping_address: updatedShippingAddress,
        customer_request: editedCustomerRequest,
        total_cost: subtotal,
        discount_amount: totalDiscount,
        delivery_fee: shippingFee,
        final_payment: finalTotal,
        event_id: editedEventId,
        admin_memo: editedAdminMemo,
      };

      const currentEvent = events.find(e => e.id === editedEventId);
      const discountRate = currentEvent?.discount_rate || 0;

      const orderItemsPayload = editedOrderItems.map(item => {
        const product = productsMap[item.product_id];
        const originalPrice = product?.list_price || 0;
        const discountedPrice = originalPrice * (1 - discountRate);
        return { order_id: order.id, product_id: item.product_id, quantity: item.quantity, price_at_purchase: discountedPrice };
      });

      const { error } = await supabase.rpc('update_order_details', { order_id_param: order.id, updates_param: orderUpdates, items_param: orderItemsPayload });
      if (error) throw error;

      addNotification('주문 정보가 성공적으로 업데이트되었습니다.', 'success');
      setIsEditing(false);
      onUpdate();
      onClose();

    } catch (error) {
      console.error('Client-side error in handleSaveAll:', error);
      addNotification(`주문 정보 업데이트 실패: ${error.message}`, 'error');
    }
  };

  const handleSaveStatusOnly = async (newStatus) => {
    console.log('[DEBUG] handleSaveStatusOnly called, newStatus:', newStatus);
    try {
      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', order.id);
      if (error) throw error;
      addNotification(`주문 ${order.id}의 상태가 '${statusToKorean[newStatus]}'으로 업데이트되었습니다.`, 'success');
      onUpdate();
      setCurrentStatus(newStatus);

      // paid 전환 시 알림톡 자동 발송 (현장 수령 제외)
      if (newStatus === 'paid' && !order.is_on_site_sale) {
        sendAlimtalk(order.id).then(({ success, error: alimtalkError, skipped }) => {
          if (skipped) return;
          if (!success) console.error('알림톡 발송 오류:', alimtalkError);
          else addNotification('알림톡이 발송되었습니다.', 'info');
        });
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      addNotification(`주문 상태 업데이트 실패: ${error.message}`, 'error');
    }
  };

  const handleResendAlimtalk = async () => {
    const { success, error: alimtalkError } = await sendAlimtalk(order.id);
    if (success) {
      addNotification('알림톡이 재발송되었습니다.', 'success');
      onUpdate();
    } else {
      addNotification(`알림톡 재발송 실패: ${alimtalkError}`, 'error');
    }
  };

  const handleLinkSearch = async () => {
    if (!linkSearchTerm.trim()) return;
    setLinkSearchLoading(true);
    try {
      const results = await searchOrdersForLinking(linkSearchTerm, order.id);
      setLinkSearchResults(results);
    } catch (e) {
      addNotification('검색 실패: ' + e.message, 'error');
    } finally {
      setLinkSearchLoading(false);
    }
  };

  const handleConfirmLink = async (parentOrder) => {
    setLinkLoading(true);
    try {
      const result = await linkOrders(parentOrder.id, order.id);
      addNotification(
        `연계 완료! 배송비 조정: ${result.saved.toLocaleString()}원 절감 (최종 결제금액: ${result.newFinalPayment.toLocaleString()}원)`,
        'success'
      );
      setLinkDialogOpen(false);
      setLinkSearchTerm('');
      setLinkSearchResults([]);
      onUpdate();
      onClose();
    } catch (e) {
      addNotification('연계 실패: ' + e.message, 'error');
    } finally {
      setLinkLoading(false);
    }
  };

  if (!order) return null;

  // 연계 주문 포맷 ID
  const displayId = order.parent_order_id
    ? `${order.id}(${order.parent_order_id})`
    : order.linkedChildren?.length > 0
      ? `${order.id}-${order.linkedChildren.length + 1}`
      : order.id;

  // discountRate for render: editing 중이면 선택된 학회, 아니면 저장된 학회 기준
  const renderEvent = events?.find(e => e.id === (isEditing ? editedEventId : order.event_id));
  const discountRate = renderEvent?.discount_rate || 0;

  const WrapperComponent = isMobile ? Drawer : Modal;
  const wrapperProps = isMobile
    ? { anchor: 'bottom', open, onClose, PaperProps: { sx: { borderRadius: '16px 16px 0 0', maxHeight: '95vh' } } }
    : { open, onClose, closeAfterTransition: true, BackdropComponent: Backdrop, BackdropProps: { timeout: 500 } };

  const modalStyle = isMobile
    ? { p: 0, display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.paper' }
    : { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '90%', maxWidth: 800, bgcolor: 'background.paper', boxShadow: 24, p: 0, maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: '16px' };

  const content = (
    <Box sx={modalStyle}>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'grey.100', ...(isMobile && { borderRadius: '16px 16px 0 0' }) }}>
        <Typography variant="h6">상품주문정보 조회</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {order.access_token && (
            <IconButton
              component="a"
              href={`/order/status/${order.access_token}`}
              target="_blank"
              rel="noopener noreferrer"
              size="small"
              title="고객 주문 조회 페이지"
              sx={{ color: 'primary.main' }}
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          )}
          {hasPermission('orders:edit') && order.status === 'paid' && !order.is_on_site_sale && (
            <Button
              size="small"
              variant="outlined"
              onClick={handleResendAlimtalk}
              sx={{ borderRadius: '8px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
            >
              알림톡 재발송
            </Button>
          )}
          {hasPermission('orders:edit') && (isEditing ? (<Button variant="contained" onClick={handleSaveAll} sx={{ borderRadius: '8px' }}>저장</Button>) : (<Button variant="outlined" onClick={() => setIsEditing(true)} sx={{ borderRadius: '8px' }}>편집</Button>))}
          <IconButton aria-label="close" onClick={onClose} sx={{ color: (theme) => theme.palette.grey[500] }}><CloseIcon /></IconButton>
        </Box>
      </Box>
      <Box sx={{ p: isMobile ? 2 : 3, overflowY: 'auto' }}>
        <Box sx={{ mb: 4 }}><Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>주문 상세 정보</Typography><Paper variant="outlined" sx={{ borderRadius: '12px' }}><Table size="small"><TableBody><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50', width: 120 }}>상품주문번호</TableCell><TableCell>{displayId}</TableCell></TableRow><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>주문일</TableCell><TableCell>{new Date(order.created_at).toLocaleString('ko-KR')}</TableCell></TableRow><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>학회명</TableCell><TableCell sx={{ p: 1 }}>{isEditing ? (<FormControl size="small" fullWidth><Select value={editedEventId} onChange={(e) => setEditedEventId(e.target.value)} disabled={!hasPermission('orders:edit')} sx={{ borderRadius: '8px' }}>{events && events.map((event) => (<MenuItem key={event.id} value={event.id}>{event.name}</MenuItem>))}</Select></FormControl>) : (events && events.find(e => e.id === order.event_id)?.name || 'N/A')}</TableCell></TableRow><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>상태</TableCell><TableCell sx={{ p: 1 }}><FormControl size="small" fullWidth><Select value={currentStatus} onChange={(e) => { const newStatus = e.target.value; console.log('[DEBUG] Select onChange, newStatus:', newStatus); setCurrentStatus(newStatus); handleSaveStatusOnly(newStatus); }} disabled={!hasPermission('orders:edit')} sx={{ borderRadius: '8px' }}>{statusToKorean && Object.entries(statusToKorean).map(([key, value]) => (<MenuItem key={key} value={key}>{value}</MenuItem>))}</Select></FormControl></TableCell></TableRow></TableBody></Table></Paper></Box>
        {/* 상태 이력 */}
        {Array.isArray(order.status_history) && order.status_history.length > 0 && (
          <StatusHistoryAccordion history={order.status_history} statusToKorean={statusToKorean} />
        )}
        <Box sx={{ mb: 4 }}><Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>주문자 정보</Typography><Paper variant="outlined" sx={{ borderRadius: '12px' }}><Table size="small"><TableBody><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50', width: 120 }}>주문자명</TableCell><TableCell sx={{ p: 1 }}>{isEditing ? (<TextField value={editedCustomerName} onChange={(e) => setEditedCustomerName(e.target.value)} size="small" fullWidth disabled={!hasPermission('orders:edit')} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />) : (order.customer_name)}</TableCell></TableRow><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>연락처</TableCell><TableCell sx={{ p: 1 }}>{isEditing ? (<TextField value={editedPhoneNumber} onChange={(e) => setEditedPhoneNumber(e.target.value)} size="small" fullWidth disabled={!hasPermission('orders:edit')} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />) : (order.phone_number || 'N/A')}</TableCell></TableRow><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>이메일</TableCell><TableCell sx={{ p: 1 }}>{isEditing ? (<TextField value={editedCustomerEmail} onChange={(e) => setEditedCustomerEmail(e.target.value)} size="small" fullWidth disabled={!hasPermission('orders:edit')} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />) : (order.email)}</TableCell></TableRow></TableBody></Table></Paper></Box>
        <Box sx={{ mb: 4 }}><Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>배송지 정보</Typography><Paper variant="outlined" sx={{ borderRadius: '12px' }}><Table size="small"><TableBody><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50', width: 120 }}>우편번호</TableCell><TableCell sx={{ p: 1 }}>{isEditing ? (<TextField value={editedShippingPostcode} onChange={(e) => setEditedShippingPostcode(e.target.value)} size="small" fullWidth disabled={!hasPermission('orders:edit')} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />) : (order.shipping_address?.postcode || 'N/A')}</TableCell></TableRow><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>주소</TableCell><TableCell sx={{ p: 1 }}>{isEditing ? (<TextField value={editedShippingAddress} onChange={(e) => setEditedShippingAddress(e.target.value)} size="small" fullWidth disabled={!hasPermission('orders:edit')} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />) : (order.shipping_address?.address || 'N/A')}</TableCell></TableRow><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>상세 주소</TableCell><TableCell sx={{ p: 1 }}>{isEditing ? (<TextField value={editedShippingDetail} onChange={(e) => setEditedShippingDetail(e.target.value)} size="small" fullWidth disabled={!hasPermission('orders:edit')} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />) : (order.shipping_address?.detail || 'N/A')}</TableCell></TableRow><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>배송 메모</TableCell><TableCell sx={{ p: 1 }}>{isEditing ? (<TextField value={editedCustomerRequest} onChange={(e) => setEditedCustomerRequest(e.target.value)} size="small" fullWidth disabled={!hasPermission('orders:edit')} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />) : (order.customer_request || '없음')}</TableCell></TableRow></TableBody></Table></Paper></Box>
        <Box sx={{ mb: 4 }}><Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>관리자 메모</Typography><Paper variant="outlined" sx={{ borderRadius: '12px' }}><Table size="small"><TableBody><TableRow><TableCell sx={{ p: 1 }}>{isEditing ? (<TextField value={editedAdminMemo} onChange={(e) => setEditedAdminMemo(e.target.value)} size="small" fullWidth multiline rows={3} placeholder="관리자만 볼 수 있는 메모입니다. 환불 정보, 고객 특이사항 등을 기록하세요." disabled={!hasPermission('orders:edit')} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />) : (<Typography sx={{ whiteSpace: 'pre-wrap', p: 1 }}>{order.admin_memo || '작성된 메모가 없습니다.'}</Typography>)}</TableCell></TableRow></TableBody></Table></Paper></Box>
        {/* 연계 주문 섹션 */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>연계 주문</Typography>
            {hasPermission('orders:edit') && !order.parent_order_id && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => setLinkDialogOpen(true)}
                sx={{ borderRadius: '8px' }}
              >
                연계 주문 연결
              </Button>
            )}
          </Box>
          {linkedParent && (
            <Alert severity="info" sx={{ mb: 1, borderRadius: '8px' }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>원주문 (1차)</Typography>
              <Typography variant="body2">
                #{linkedParent.id} · {linkedParent.customer_name} · {linkedParent.final_payment?.toLocaleString()}원
                <Chip label={linkedParent.status} size="small" sx={{ ml: 1 }} />
              </Typography>
            </Alert>
          )}
          {linkedChildren.length > 0 && linkedChildren.map(child => (
            <Alert severity="warning" key={child.id} sx={{ mb: 1, borderRadius: '8px' }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>추가 주문 (2차)</Typography>
              <Typography variant="body2">
                #{child.id} · {child.customer_name} · {child.final_payment?.toLocaleString()}원
                <Chip label={child.status} size="small" sx={{ ml: 1 }} />
              </Typography>
            </Alert>
          ))}
          {!linkedParent && linkedChildren.length === 0 && (
            <Typography variant="body2" color="text.secondary">연계된 주문이 없습니다.</Typography>
          )}
        </Box>
        <Box sx={{ mb: 4 }}><Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>주문 상품 목록</Typography><TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '12px' }}><Table size="small"><TableHead><TableRow sx={{ bgcolor: 'grey.50' }}><TableCell sx={{ minWidth: 120, whiteSpace: 'nowrap' }}>상품명</TableCell><TableCell align="right" sx={{ minWidth: 80, whiteSpace: 'nowrap' }}>정가</TableCell><TableCell align="right" sx={{ minWidth: 80, whiteSpace: 'nowrap' }}>할인가</TableCell><TableCell align="right" sx={{ minWidth: 60, whiteSpace: 'nowrap' }}>수량</TableCell><TableCell align="right" sx={{ minWidth: 80, whiteSpace: 'nowrap' }}>합계</TableCell>{hasPermission('orders:edit') && <TableCell sx={{ minWidth: 50, whiteSpace: 'nowrap' }}>작업</TableCell>}</TableRow></TableHead><TableBody>{productsLoading ? (<TableRow><TableCell colSpan={6} align="center"><CircularProgress size={24} /></TableCell></TableRow>) : ((editedOrderItems || []).map((item, index) => { const product = productsMap[item.product_id]; const originalPrice = product?.list_price || 0; const discountedPrice = originalPrice * (1 - discountRate); const itemTotal = discountedPrice * item.quantity; return (<TableRow key={index}><TableCell sx={{ p: 1 }}>{isEditing ? (<FormControl size="small" fullWidth><Select value={item.product_id} onChange={(e) => handleItemChange(index, 'product_id', e.target.value)} disabled={!hasPermission('orders:edit')} sx={{ borderRadius: '8px' }}>{products.map((p) => (<MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>))}</Select></FormControl>) : (product?.name || '알 수 없는 상품')}</TableCell><TableCell align="right">{originalPrice.toLocaleString()}원</TableCell><TableCell align="right">{discountedPrice.toLocaleString()}원</TableCell><TableCell align="right" sx={{ p: 1 }}>{isEditing ? (<TextField type="number" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value, 10) || 0)} size="small" sx={{ width: 70, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} inputProps={{ min: 0 }} disabled={!hasPermission('orders:edit')} />) : (item.quantity)}</TableCell><TableCell align="right">{itemTotal.toLocaleString()}원</TableCell>{hasPermission('orders:edit') && isEditing && (<TableCell><IconButton onClick={() => handleRemoveOrderItem(index)} color="error" size="small"><CloseIcon /></IconButton></TableCell>)}</TableRow>); }))}</TableBody></Table>{hasPermission('orders:edit') && isEditing && (<Box sx={{ mt: 1, p: 1, textAlign: 'right' }}><Button onClick={handleAddOrderItem} variant="outlined" size="small" sx={{ borderRadius: '8px' }}>상품 추가</Button></Box>)}</TableContainer></Box>
        <Box><Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>결제 정보</Typography><Paper variant="outlined" sx={{ borderRadius: '12px' }}><Table size="small"><TableBody><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50', width: '60%' }}>정가의 합</TableCell><TableCell align="right">{subtotal.toLocaleString()}원</TableCell></TableRow><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>할인된 금액</TableCell><TableCell align="right">{totalDiscount.toLocaleString()}원</TableCell></TableRow><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>배송비</TableCell><TableCell align="right">{shippingFee.toLocaleString()}원</TableCell></TableRow><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50', fontSize: '1.1rem' }}>총 결제 금액</TableCell><TableCell align="right" sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{finalTotal.toLocaleString()}원</TableCell></TableRow></TableBody></Table></Paper></Box>
      </Box>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', borderTop: 1, borderColor: 'divider' }}><Button onClick={onClose} variant="outlined" size="large" fullWidth={isMobile} sx={{ borderRadius: '12px', minHeight: '48px' }}>닫기</Button></Box>
    </Box>
  );

  return (
    <>
      <WrapperComponent {...wrapperProps}>
        {isMobile ? content : <Fade in={open}>{content}</Fade>}
      </WrapperComponent>

      {/* 연계 주문 검색 다이얼로그 */}
      <Dialog open={linkDialogOpen} onClose={() => { setLinkDialogOpen(false); setLinkSearchResults([]); setLinkSearchTerm(''); }} maxWidth="sm" fullWidth>
        <DialogTitle>연계 주문 연결</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            현재 주문(#{order?.id})을 다른 주문의 추가 주문으로 연결합니다.
            고객명 또는 연락처로 원주문을 검색하세요.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="고객명 또는 연락처 입력"
              value={linkSearchTerm}
              onChange={(e) => setLinkSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLinkSearch()}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
            />
            <Button variant="contained" onClick={handleLinkSearch} disabled={linkSearchLoading} sx={{ borderRadius: '8px', whiteSpace: 'nowrap' }}>
              {linkSearchLoading ? <CircularProgress size={20} /> : '검색'}
            </Button>
          </Box>
          {linkSearchResults.length > 0 && (
            <List dense>
              {linkSearchResults.map(result => {
                const combinedListPrice = (order?.total_cost || 0) + result.total_cost;
                const freeShipping = combinedListPrice >= settings.free_shipping_threshold;
                const parentPaidShipping = ['paid', 'completed'].includes(result.status) ? result.delivery_fee : 0;
                const newFinal = (order?.total_cost || 0) - (order?.discount_amount || 0) - (freeShipping ? parentPaidShipping : 0);
                const saved = (order?.final_payment || 0) - newFinal;
                return (
                  <React.Fragment key={result.id}>
                    <ListItem disablePadding>
                      <ListItemButton onClick={() => handleConfirmLink(result)} disabled={linkLoading} sx={{ borderRadius: '8px' }}>
                        <ListItemText
                          primary={`#${result.id} · ${result.customer_name} · ${result.final_payment?.toLocaleString()}원`}
                          secondary={
                            <span>
                              {new Date(result.created_at).toLocaleDateString('ko-KR')} ·{' '}
                              <strong style={{ color: freeShipping ? '#10B981' : '#6366F1' }}>
                                연계 시 {saved.toLocaleString()}원 절감 {freeShipping ? '(무료배송)' : '(합배송)'}
                              </strong>
                            </span>
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                );
              })}
            </List>
          )}
          {linkSearchResults.length === 0 && linkSearchTerm && !linkSearchLoading && (
            <Typography variant="body2" color="text.secondary" align="center">검색 결과가 없습니다.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setLinkDialogOpen(false); setLinkSearchResults([]); setLinkSearchTerm(''); }} sx={{ borderRadius: '8px' }}>취소</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

const StatusHistoryAccordion = ({ history, statusToKorean }) => {
  const [open, setOpen] = useState(false);
  const reversed = [...history].reverse();
  const current = reversed[0];
  const rest = reversed.slice(1);

  return (
    <Box sx={{ mb: 4 }}>
      <Box
        onClick={() => setOpen(o => !o)}
        sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          mb: open ? 1 : 0, cursor: 'pointer', userSelect: 'none',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>상태 이력</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {!open && (
            <Typography variant="caption" color="text.secondary">
              {rest.length}개 이전 이력
            </Typography>
          )}
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </Box>
      </Box>
      <Paper variant="outlined" sx={{ borderRadius: '12px', overflow: 'hidden' }}>
        {/* 현재 상태는 항상 표시 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.25, bgcolor: 'grey.50', borderBottom: open && rest.length > 0 ? '1px solid' : 'none', borderColor: 'divider' }}>
          <Chip label={statusToKorean[current.status] || current.status} size="small" sx={{ minWidth: 72, fontWeight: 700 }} />
          <Typography variant="body2">
            {new Date(current.changed_at).toLocaleString('ko-KR', {
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit', second: '2-digit',
            })}
          </Typography>
          <Chip label="현재" size="small" color="primary" variant="outlined" sx={{ ml: 'auto', fontSize: '0.7rem' }} />
        </Box>
        {/* 이전 이력 — 접힘/펼침 */}
        <Collapse in={open}>
          {rest.map((entry, idx) => (
            <Box
              key={idx}
              sx={{
                display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.25,
                borderBottom: idx < rest.length - 1 ? '1px solid' : 'none',
                borderColor: 'divider',
              }}
            >
              <Chip label={statusToKorean[entry.status] || entry.status} size="small" sx={{ minWidth: 72 }} />
              <Typography variant="body2" color="text.secondary">
                {new Date(entry.changed_at).toLocaleString('ko-KR', {
                  year: 'numeric', month: '2-digit', day: '2-digit',
                  hour: '2-digit', minute: '2-digit', second: '2-digit',
                })}
              </Typography>
            </Box>
          ))}
        </Collapse>
      </Paper>
    </Box>
  );
};

export default OrderDetailModal;
