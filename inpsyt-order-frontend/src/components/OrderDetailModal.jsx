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
  CircularProgress,
  useMediaQuery,
  useTheme,
  Autocomplete,
  Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { supabase } from '../supabaseClient';

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

  // This useEffect is the single source of truth for setting state from the order prop.
  useEffect(() => {
    if (order) {
      setEditedOrderItems(JSON.parse(JSON.stringify(order.order_items || [])));
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
    const currentShippingFee = subtotalAfterDiscount >= 30000 ? 0 : 3000;
    const currentFinalTotal = subtotalAfterDiscount + currentShippingFee;

    setSubtotal(currentSubtotal);
    setTotalDiscount(currentTotalDiscount);
    setShippingFee(currentShippingFee);
    setFinalTotal(currentFinalTotal);

  }, [isEditing, editedOrderItems, editedEventId, productsMap, events]);


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
    try {
      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', order.id);
      if (error) throw error;
      addNotification(`${order.customer_name}님의 주문 상태가 '${statusToKorean[newStatus]}'으로 변경되었습니다.`, 'success');
      onUpdate();
      setCurrentStatus(newStatus);
    } catch (error) {
      console.error('Error updating order status:', error);
      addNotification(`주문 상태 업데이트 실패: ${error.message}`, 'error');
    }
  };

  if (!order) return null;

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
        <Box>
          {hasPermission('orders:edit') && (isEditing ? (<Button variant="contained" onClick={handleSaveAll} sx={{ mr: 1, borderRadius: '8px' }}>저장</Button>) : (<Button variant="outlined" onClick={() => setIsEditing(true)} sx={{ mr: 1, borderRadius: '8px' }}>편집</Button>))}
          <IconButton aria-label="close" onClick={onClose} sx={{ color: (theme) => theme.palette.grey[500] }}><CloseIcon /></IconButton>
        </Box>
      </Box>
      <Box sx={{ p: isMobile ? 2 : 3, overflowY: 'auto' }}>
        <Box sx={{ mb: 4 }}><Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>주문 상세 정보</Typography><Paper variant="outlined" sx={{ borderRadius: '12px' }}><Table size="small"><TableBody><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50', width: 120 }}>상품주문번호</TableCell><TableCell>{order.id}</TableCell></TableRow><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>주문일</TableCell><TableCell>{new Date(order.created_at).toLocaleString('ko-KR')}</TableCell></TableRow><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>학회명</TableCell><TableCell sx={{ p: 1 }}>{isEditing ? (<FormControl size="small" fullWidth><Select value={editedEventId} onChange={(e) => setEditedEventId(e.target.value)} disabled={!hasPermission('orders:edit')} sx={{ borderRadius: '8px' }}>{events && events.map((event) => (<MenuItem key={event.id} value={event.id}>{event.name}</MenuItem>))}</Select></FormControl>) : (events && events.find(e => e.id === order.event_id)?.name || 'N/A')}</TableCell></TableRow><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>상태</TableCell><TableCell sx={{ p: 1 }}><FormControl size="small" fullWidth><Select value={currentStatus} onChange={(e) => { const newStatus = e.target.value; setCurrentStatus(newStatus); handleSaveStatusOnly(newStatus); }} disabled={!hasPermission('orders:edit')} sx={{ borderRadius: '8px' }}>{statusToKorean && Object.entries(statusToKorean).map(([key, value]) => (<MenuItem key={key} value={key}>{value}</MenuItem>))}</Select></FormControl></TableCell></TableRow></TableBody></Table></Paper></Box>
        <Box sx={{ mb: 4 }}><Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>주문자 정보</Typography><Paper variant="outlined" sx={{ borderRadius: '12px' }}><Table size="small"><TableBody><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50', width: 120 }}>주문자명</TableCell><TableCell sx={{ p: 1 }}>{isEditing ? (<TextField value={editedCustomerName} onChange={(e) => setEditedCustomerName(e.target.value)} size="small" fullWidth disabled={!hasPermission('orders:edit')} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />) : (order.customer_name)}</TableCell></TableRow><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>연락처</TableCell><TableCell sx={{ p: 1 }}>{isEditing ? (<TextField value={editedPhoneNumber} onChange={(e) => setEditedPhoneNumber(e.target.value)} size="small" fullWidth disabled={!hasPermission('orders:edit')} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />) : (order.phone_number || 'N/A')}</TableCell></TableRow><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>이메일</TableCell><TableCell sx={{ p: 1 }}>{isEditing ? (<TextField value={editedCustomerEmail} onChange={(e) => setEditedCustomerEmail(e.target.value)} size="small" fullWidth disabled={!hasPermission('orders:edit')} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />) : (order.email)}</TableCell></TableRow></TableBody></Table></Paper></Box>
        <Box sx={{ mb: 4 }}><Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>배송지 정보</Typography><Paper variant="outlined" sx={{ borderRadius: '12px' }}><Table size="small"><TableBody><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50', width: 120 }}>우편번호</TableCell><TableCell sx={{ p: 1 }}>{isEditing ? (<TextField value={editedShippingPostcode} onChange={(e) => setEditedShippingPostcode(e.target.value)} size="small" fullWidth disabled={!hasPermission('orders:edit')} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />) : (order.shipping_address?.postcode || 'N/A')}</TableCell></TableRow><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>주소</TableCell><TableCell sx={{ p: 1 }}>{isEditing ? (<TextField value={editedShippingAddress} onChange={(e) => setEditedShippingAddress(e.target.value)} size="small" fullWidth disabled={!hasPermission('orders:edit')} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />) : (order.shipping_address?.address || 'N/A')}</TableCell></TableRow><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>상세 주소</TableCell><TableCell sx={{ p: 1 }}>{isEditing ? (<TextField value={editedShippingDetail} onChange={(e) => setEditedShippingDetail(e.target.value)} size="small" fullWidth disabled={!hasPermission('orders:edit')} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />) : (order.shipping_address?.detail || 'N/A')}</TableCell></TableRow><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>배송 메모</TableCell><TableCell sx={{ p: 1 }}>{isEditing ? (<TextField value={editedCustomerRequest} onChange={(e) => setEditedCustomerRequest(e.target.value)} size="small" fullWidth disabled={!hasPermission('orders:edit')} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />) : (order.customer_request || '없음')}</TableCell></TableRow></TableBody></Table></Paper></Box>
        <Box sx={{ mb: 4 }}><Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>관리자 메모</Typography><Paper variant="outlined" sx={{ borderRadius: '12px' }}><Table size="small"><TableBody><TableRow><TableCell sx={{ p: 1 }}>{isEditing ? (<TextField value={editedAdminMemo} onChange={(e) => setEditedAdminMemo(e.target.value)} size="small" fullWidth multiline rows={3} placeholder="관리자만 볼 수 있는 메모입니다. 환불 정보, 고객 특이사항 등을 기록하세요." disabled={!hasPermission('orders:edit')} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />) : (<Typography sx={{ whiteSpace: 'pre-wrap', p: 1 }}>{order.admin_memo || '작성된 메모가 없습니다.'}</Typography>)}</TableCell></TableRow></TableBody></Table></Paper></Box>
        <Box sx={{ mb: 4 }}><Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>주문 상품 목록</Typography><TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '12px' }}><Table size="small"><TableHead><TableRow sx={{ bgcolor: 'grey.50' }}><TableCell sx={{ minWidth: 120, whiteSpace: 'nowrap' }}>상품명</TableCell><TableCell align="right" sx={{ minWidth: 80, whiteSpace: 'nowrap' }}>정가</TableCell><TableCell align="right" sx={{ minWidth: 80, whiteSpace: 'nowrap' }}>할인가</TableCell><TableCell align="right" sx={{ minWidth: 60, whiteSpace: 'nowrap' }}>수량</TableCell><TableCell align="right" sx={{ minWidth: 80, whiteSpace: 'nowrap' }}>합계</TableCell>{hasPermission('orders:edit') && isEditing && <TableCell sx={{ minWidth: 50, whiteSpace: 'nowrap' }}>작업</TableCell>}</TableRow></TableHead><TableBody>{productsLoading ? (<TableRow><TableCell colSpan={6} align="center"><CircularProgress size={24} /></TableCell></TableRow>) : ((editedOrderItems || []).map((item, index) => { const product = productsMap[item.product_id]; const originalPrice = product?.list_price || 0; const discountedPrice = originalPrice * (1 - discountRate); const itemTotal = discountedPrice * item.quantity; return (<TableRow key={index}><TableCell sx={{ p: 1 }}>{isEditing ? (
  <Autocomplete
    size="small"
    options={products || []}
    getOptionLabel={(option) => option.name || ''}
    value={products?.find(p => p.id === item.product_id) || null}
    onChange={(_, newValue) => {
      if (newValue) handleItemChange(index, 'product_id', newValue.id);
    }}
    disabled={!hasPermission('orders:edit')}
    renderInput={(params) => (
      <TextField {...params} placeholder="상품 검색" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
    )}
    isOptionEqualToValue={(option, value) => option.id === value?.id}
    sx={{ minWidth: 200 }}
  />
) : (product?.name || '알 수 없는 상품')}</TableCell><TableCell align="right">{originalPrice.toLocaleString()}원</TableCell><TableCell align="right">{discountedPrice.toLocaleString()}원</TableCell><TableCell align="right" sx={{ p: 1 }}>{isEditing ? (<TextField type="number" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value, 10) || 0)} size="small" sx={{ width: 70, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} inputProps={{ min: 0 }} disabled={!hasPermission('orders:edit')} />) : (item.quantity)}</TableCell><TableCell align="right">{itemTotal.toLocaleString()}원</TableCell>{hasPermission('orders:edit') && isEditing && (<TableCell><IconButton onClick={() => handleRemoveOrderItem(index)} color="error" size="small"><CloseIcon /></IconButton></TableCell>)}</TableRow>); }))}</TableBody></Table>{hasPermission('orders:edit') && isEditing && (<Box sx={{ mt: 1, p: 1, textAlign: 'right' }}><Button onClick={handleAddOrderItem} variant="outlined" size="small" sx={{ borderRadius: '8px' }}>상품 추가</Button></Box>)}</TableContainer></Box>
        <Box><Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>결제 정보</Typography><Paper variant="outlined" sx={{ borderRadius: '12px' }}><Table size="small"><TableBody><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50', width: '60%' }}>정가의 합</TableCell><TableCell align="right">{subtotal.toLocaleString()}원</TableCell></TableRow><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>할인된 금액</TableCell><TableCell align="right">{totalDiscount.toLocaleString()}원</TableCell></TableRow><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>배송비</TableCell><TableCell align="right">{shippingFee.toLocaleString()}원</TableCell></TableRow><TableRow><TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.50', fontSize: '1.1rem' }}>총 결제 금액</TableCell><TableCell align="right" sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{finalTotal.toLocaleString()}원</TableCell></TableRow></TableBody></Table></Paper></Box>
      </Box>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', gap: 1, borderTop: 1, borderColor: 'divider', flexDirection: isMobile ? 'column' : 'row' }}>
        {hasPermission('orders:edit') && isEditing && (
          <Button onClick={handleSaveAll} variant="contained" size="large" fullWidth={isMobile} sx={{ borderRadius: '12px', minHeight: '48px' }}>저장</Button>
        )}
        <Button onClick={onClose} variant="outlined" size="large" fullWidth={isMobile} sx={{ borderRadius: '12px', minHeight: '48px' }}>닫기</Button>
      </Box>
    </Box>
  );

  return (
    <WrapperComponent {...wrapperProps}>
      {isMobile ? content : <Fade in={open}>{content}</Fade>}
    </WrapperComponent>
  );
};

export default OrderDetailModal;
