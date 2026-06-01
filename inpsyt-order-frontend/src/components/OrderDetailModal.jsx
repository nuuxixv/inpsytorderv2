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
  Collapse,
  Autocomplete,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DeleteIcon from '@mui/icons-material/Delete';
import DaumPostcode from 'react-daum-postcode';
import { supabase } from '../supabaseClient';
import { linkOrders, searchOrdersForLinking } from '../api/orders';
import { sendAlimtalk } from '../api/alimtalk';
import { SHIPPING_DEFAULTS } from '../constants/shipping';
import { SectionCard, StatusBadge, InfoRow, ActionSlot, PriceBlock } from './ui';

// 사양 시트: design-system/specs/A2_OrderDetailModal.md
// (M3-13 시안 정합본. 시안 부재 — 사양 시트 단일 진실 소스 기반 토큰·합성 컴포넌트 적용.)

const OrderDetailModal = ({ order, open, onClose, statusToKorean, productsMap, products, events, addNotification, onUpdate, productsLoading, hasPermission }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Initialize state with empty/default values, not from props directly.
  const [isEditing, setIsEditing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('');
  const [editedCustomerName, setEditedCustomerName] = useState('');
  const [editedPhoneNumber, setEditedPhoneNumber] = useState('');
  const [editedShippingAddress, setEditedShippingAddress] = useState('');
  const [editedShippingPostcode, setEditedShippingPostcode] = useState('');
  const [editedShippingDetail, setEditedShippingDetail] = useState('');
  const [editedCustomerRequest, setEditedCustomerRequest] = useState('');
  const [editedOrderItems, setEditedOrderItems] = useState([]);
  const [editedEventId, setEditedEventId] = useState('');
  const [editedAdminMemo, setEditedAdminMemo] = useState('');
  const [editedInpsytId, setEditedInpsytId] = useState('');
  const [showPostcode, setShowPostcode] = useState(false);

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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Settings state
  const [settings, setSettings] = useState({
    free_shipping_threshold: SHIPPING_DEFAULTS.FREE_SHIPPING_THRESHOLD,
    shipping_cost: SHIPPING_DEFAULTS.SHIPPING_COST,
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
      setEditedPhoneNumber(order.phone_number || '');
      setEditedShippingAddress(order.shipping_address?.address || '');
      setEditedShippingPostcode(order.shipping_address?.postcode || '');
      setEditedShippingDetail(order.shipping_address?.detail || '');
      setEditedCustomerRequest(order.customer_request || '');
      setEditedEventId(order.event_id || '');
      setEditedAdminMemo(order.admin_memo || '');
      setEditedInpsytId(order.inpsyt_id || '');
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
        phone_number: editedPhoneNumber,
        shipping_address: updatedShippingAddress,
        customer_request: editedCustomerRequest,
        inpsyt_id: editedInpsytId,
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
        return { order_id: order.id, product_id: item.product_id, quantity: item.quantity, price_at_purchase: discountedPrice, product_name: product?.name || null, product_code: product?.product_code || null, category: product?.category || null, list_price: product?.list_price || null };
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
      addNotification(`주문 ${order.id}의 상태가 '${statusToKorean[newStatus]}'으로 업데이트되었습니다.`, 'success');
      onUpdate();
      setCurrentStatus(newStatus);

      // paid 전환 시 알림톡 자동 발송 (현장 수령 제외)
      if (newStatus === 'paid' && !order.is_on_site_sale) {
        sendAlimtalk(order.id).then(({ success, error: alimtalkError, skipped }) => {
          if (skipped) return;
          if (!success) addNotification(`알림톡 발송 실패 — ${alimtalkError}`, 'warning');
          else addNotification('알림톡 발송 완료', 'info');
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
      addNotification('알림톡 재발송 완료', 'success');
      onUpdate();
    } else {
      addNotification(`알림톡 재발송 실패 — ${alimtalkError}`, 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      const { error: itemsError } = await supabase.from('order_items').delete().eq('order_id', order.id);
      if (itemsError) throw itemsError;
      const { error: orderError } = await supabase.from('orders').delete().eq('id', order.id);
      if (orderError) throw orderError;
      addNotification('주문이 삭제되었습니다.', 'success');
      setDeleteConfirmOpen(false);
      onUpdate();
      onClose();
    } catch (err) {
      addNotification(`삭제 실패: ${err.message}`, 'error');
    } finally {
      setDeleting(false);
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
    ? { anchor: 'bottom', open, onClose, PaperProps: { sx: { borderRadius: `${theme.radii.lg}px ${theme.radii.lg}px 0 0`, maxHeight: '95vh' } } }
    : { open, onClose, closeAfterTransition: true, BackdropComponent: Backdrop, BackdropProps: { timeout: 500 } };

  const modalStyle = isMobile
    ? { p: 0, display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.paper' }
    : {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '90%',
        maxWidth: 800,
        bgcolor: 'background.paper',
        boxShadow: theme.customShadows.lg,
        p: 0,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: `${theme.radii.lg}px`,
      };

  // 권한 캐싱 — 잦은 호출 회피
  const canEdit = hasPermission('orders:edit');
  const isMaster = hasPermission('master');

  // 학회·연락처·상태 변경 핸들러
  const handlePhoneInput = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 3 && digits.length <= 7) formatted = digits.slice(0, 3) + '-' + digits.slice(3);
    else if (digits.length > 7) formatted = digits.slice(0, 3) + '-' + digits.slice(3, 7) + '-' + digits.slice(7);
    setEditedPhoneNumber(formatted);
  };

  const handleDaumComplete = (data) => {
    let fullAddress = data.address;
    let extraAddress = '';
    if (data.addressType === 'R') {
      if (data.bname !== '') extraAddress += data.bname;
      if (data.buildingName !== '') extraAddress += (extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName);
      if (extraAddress !== '') fullAddress += ` (${extraAddress})`;
    }
    setEditedShippingAddress(fullAddress);
    setEditedShippingPostcode(data.zonecode);
    setShowPostcode(false);
  };

  // 주문자 정보 InfoRow rows — 편집 모드면 TextField, 조회면 텍스트
  const renderEditableField = (value, onChange, placeholder, extra) => (
    <TextField
      value={value}
      onChange={onChange}
      size="small"
      fullWidth
      disabled={!canEdit}
      placeholder={placeholder}
      {...extra}
    />
  );

  const content = (
    <Box sx={modalStyle}>
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          bgcolor: theme.gray[50],
          borderBottom: `1px solid ${theme.gray[200]}`,
          ...(isMobile && { borderRadius: `${theme.radii.lg}px ${theme.radii.lg}px 0 0` }),
        }}
      >
        <Typography variant="h5">상품주문정보 조회</Typography>
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
          {canEdit && order.status === 'paid' && !order.is_on_site_sale && (
            <Button size="small" variant="outlined" onClick={handleResendAlimtalk} sx={{ whiteSpace: 'nowrap' }}>
              알림톡 재발송
            </Button>
          )}
          {canEdit && (isEditing
            ? <Button variant="contained" onClick={handleSaveAll}>저장</Button>
            : <Button variant="outlined" onClick={() => setIsEditing(true)}>편집</Button>)}
          {isMaster && !isEditing && (
            <IconButton size="small" onClick={() => setDeleteConfirmOpen(true)} sx={{ color: 'error.main' }} title="삭제">
              <DeleteIcon fontSize="small" />
            </IconButton>
          )}
          <IconButton aria-label="close" onClick={onClose} sx={{ color: theme.gray[500] }}><CloseIcon /></IconButton>
        </Box>
      </Box>

      {/* Body */}
      <Box sx={{ p: isMobile ? 2 : 3, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>

        {/* 주문 상세 정보 */}
        <SectionCard title="주문 상세 정보" padding={20}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <InfoRow label="상품주문번호" value={displayId} mono labelWidth={96} />
            <InfoRow label="주문일" value={new Date(order.created_at).toLocaleString('ko-KR')} labelWidth={96} />
            <InfoRow
              label="학회명"
              labelWidth={96}
              value={isEditing ? (
                <FormControl size="small" fullWidth>
                  <Select
                    value={editedEventId}
                    onChange={(e) => setEditedEventId(e.target.value)}
                    disabled={!canEdit}
                  >
                    {events && events.map((event) => (
                      <MenuItem key={event.id} value={event.id}>{event.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (events && events.find(e => e.id === order.event_id)?.name || 'N/A')}
            />
            <InfoRow
              label="상태"
              labelWidth={96}
              value={(
                <FormControl size="small" fullWidth>
                  <Select
                    value={currentStatus}
                    onChange={(e) => {
                      const newStatus = e.target.value;
                      setCurrentStatus(newStatus);
                      handleSaveStatusOnly(newStatus);
                    }}
                    disabled={!canEdit}
                  >
                    {statusToKorean && Object.entries(statusToKorean).map(([key, value]) => (
                      <MenuItem key={key} value={key}>{value}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
          </Box>
        </SectionCard>

        {/* 상태 이력 */}
        {Array.isArray(order.status_history) && order.status_history.length > 0 && (
          <StatusHistoryAccordion history={order.status_history} statusToKorean={statusToKorean} />
        )}

        {/* 주문자 정보 */}
        <SectionCard title="주문자 정보" padding={20}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <InfoRow
              label="주문자명"
              labelWidth={96}
              value={isEditing
                ? renderEditableField(editedCustomerName, (e) => setEditedCustomerName(e.target.value))
                : order.customer_name}
            />
            <InfoRow
              label="연락처"
              labelWidth={96}
              mono={!isEditing}
              value={isEditing
                ? renderEditableField(editedPhoneNumber, handlePhoneInput, '010-0000-0000')
                : (order.phone_number || 'N/A')}
            />
            <InfoRow
              label="인싸이트 ID"
              labelWidth={96}
              value={isEditing
                ? renderEditableField(editedInpsytId, (e) => setEditedInpsytId(e.target.value))
                : (order.inpsyt_id || 'N/A')}
              muted={!isEditing && !order.inpsyt_id}
            />
          </Box>
        </SectionCard>

        {/* 배송지 정보 — 3필드 분리 유지 */}
        <SectionCard title="배송지 정보" padding={20}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <InfoRow
              label="우편번호"
              labelWidth={96}
              mono
              value={isEditing
                ? (editedShippingPostcode || '-')
                : (order.shipping_address?.postcode || 'N/A')}
              muted={isEditing ? !editedShippingPostcode : !order.shipping_address?.postcode}
            />
            <InfoRow
              label="주소"
              labelWidth={96}
              multiline
              value={isEditing ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ flex: 1, color: editedShippingAddress ? 'text.primary' : 'text.secondary' }}>
                    {editedShippingAddress || '-'}
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setShowPostcode(true)}
                    disabled={!canEdit}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    검색
                  </Button>
                </Box>
              ) : (order.shipping_address?.address || 'N/A')}
            />
            <InfoRow
              label="상세 주소"
              labelWidth={96}
              multiline
              value={isEditing
                ? renderEditableField(editedShippingDetail, (e) => setEditedShippingDetail(e.target.value))
                : (order.shipping_address?.detail || 'N/A')}
            />
            <InfoRow
              label="배송 메모"
              labelWidth={96}
              multiline
              value={isEditing
                ? renderEditableField(editedCustomerRequest, (e) => setEditedCustomerRequest(e.target.value))
                : (order.customer_request || '없음')}
              muted={!isEditing && !order.customer_request}
            />
          </Box>
        </SectionCard>

        {/* 관리자 메모 */}
        <SectionCard title="관리자 메모" padding={20}>
          {isEditing ? (
            <TextField
              value={editedAdminMemo}
              onChange={(e) => setEditedAdminMemo(e.target.value)}
              size="small"
              fullWidth
              multiline
              rows={3}
              placeholder="관리자만 볼 수 있는 메모입니다. 환불 정보, 고객 특이사항 등을 기록하세요."
              disabled={!canEdit}
            />
          ) : (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: order.admin_memo ? 'text.primary' : 'text.secondary' }}>
              {order.admin_memo || '작성된 메모가 없습니다.'}
            </Typography>
          )}
        </SectionCard>

        {/* 연계 주문 */}
        <SectionCard
          title="연계 주문"
          padding={20}
          action={canEdit && !order.parent_order_id ? (
            <Button size="small" variant="outlined" onClick={() => setLinkDialogOpen(true)}>
              연계 주문 연결
            </Button>
          ) : null}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {linkedParent && (
              <LinkedOrderRow tone="parent" data={linkedParent} statusToKorean={statusToKorean} />
            )}
            {linkedChildren.map(child => (
              <LinkedOrderRow key={child.id} tone="child" data={child} statusToKorean={statusToKorean} />
            ))}
            {!linkedParent && linkedChildren.length === 0 && (
              <Typography variant="body2" color="text.secondary">연계된 주문이 없습니다.</Typography>
            )}
          </Box>
        </SectionCard>

        {/* 주문 상품 목록 */}
        <SectionCard title="주문 상품 목록" padding={20}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 120, whiteSpace: 'nowrap' }}>상품명</TableCell>
                  <TableCell align="right" sx={{ minWidth: 80, whiteSpace: 'nowrap' }}>정가</TableCell>
                  <TableCell align="right" sx={{ minWidth: 80, whiteSpace: 'nowrap' }}>할인가</TableCell>
                  <TableCell align="right" sx={{ minWidth: 60, whiteSpace: 'nowrap' }}>수량</TableCell>
                  <TableCell align="right" sx={{ minWidth: 80, whiteSpace: 'nowrap' }}>합계</TableCell>
                  {canEdit && isEditing && <TableCell sx={{ minWidth: 50, whiteSpace: 'nowrap' }}>작업</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {productsLoading ? (
                  <TableRow>
                    <TableCell colSpan={canEdit && isEditing ? 6 : 5} align="center">
                      <CircularProgress size={24} />
                    </TableCell>
                  </TableRow>
                ) : (
                  (editedOrderItems || []).map((item, index) => {
                    const product = productsMap[item.product_id];
                    const originalPrice = isEditing
                      ? (product?.list_price || 0)
                      : (item.list_price || product?.list_price || 0);
                    const discountedPrice = originalPrice * (1 - discountRate);
                    const itemTotal = discountedPrice * item.quantity;
                    return (
                      <TableRow key={index}>
                        <TableCell sx={{ p: 1 }}>
                          {isEditing ? (
                            <Autocomplete
                              size="small"
                              fullWidth
                              options={products || []}
                              getOptionLabel={(option) => option.name || ''}
                              value={products?.find(p => p.id === item.product_id) || null}
                              onChange={(_, newValue) => { if (newValue) handleItemChange(index, 'product_id', newValue.id); }}
                              disabled={!canEdit}
                              renderInput={(params) => <TextField {...params} placeholder="상품 검색" />}
                              isOptionEqualToValue={(option, value) => option.id === value.id}
                            />
                          ) : (item.product_name || product?.name || '알 수 없는 상품')}
                        </TableCell>
                        <TableCell align="right" sx={{ fontFeatureSettings: '"tnum" 1' }}>{originalPrice.toLocaleString()}원</TableCell>
                        <TableCell align="right" sx={{ fontFeatureSettings: '"tnum" 1' }}>{discountedPrice.toLocaleString()}원</TableCell>
                        <TableCell align="right" sx={{ p: 1 }}>
                          {isEditing ? (
                            <TextField
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value, 10) || 0)}
                              size="small"
                              sx={{ width: 80 }}
                              inputProps={{ min: 0 }}
                              disabled={!canEdit}
                            />
                          ) : (item.quantity)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontFeatureSettings: '"tnum" 1' }}>{itemTotal.toLocaleString()}원</TableCell>
                        {canEdit && isEditing && (
                          <TableCell sx={{ p: 1 }}>
                            <IconButton onClick={() => handleRemoveOrderItem(index)} color="error" size="small" title="삭제">
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {canEdit && isEditing && (
            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={handleAddOrderItem} variant="outlined" size="small">상품 추가</Button>
            </Box>
          )}
        </SectionCard>

        {/* 결제 정보 — PriceBlock */}
        <SectionCard title="결제 정보" padding={20}>
          <PriceBlock
            rows={[
              { label: '정가의 합', value: subtotal },
              { label: '할인된 금액', value: totalDiscount, muted: totalDiscount === 0 },
              { label: '배송비', value: shippingFee, muted: shippingFee === 0 },
            ]}
            totalLabel="총 결제 금액"
            totalValue={finalTotal}
            totalColor={theme.palette.primary.main}
          />
        </SectionCard>
      </Box>

      {/* Footer */}
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', borderTop: `1px solid ${theme.gray[200]}` }}>
        <ActionSlot justify={isMobile ? 'flex-start' : 'flex-end'} sx={{ width: '100%' }}>
          <Button onClick={onClose} variant="outlined" size="large" fullWidth={isMobile}>닫기</Button>
        </ActionSlot>
      </Box>
    </Box>
  );

  return (
    <>
      <WrapperComponent {...wrapperProps}>
        {isMobile ? content : <Fade in={open}>{content}</Fade>}
      </WrapperComponent>

      {/* 연계 주문 검색 다이얼로그 */}
      <Dialog
        open={linkDialogOpen}
        onClose={() => { setLinkDialogOpen(false); setLinkSearchResults([]); setLinkSearchTerm(''); }}
        maxWidth="sm"
        fullWidth
      >
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
            />
            <Button variant="contained" onClick={handleLinkSearch} disabled={linkSearchLoading} sx={{ whiteSpace: 'nowrap' }}>
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
                const savedColor = freeShipping ? theme.status.paid : theme.status.completed;
                return (
                  <React.Fragment key={result.id}>
                    <ListItem disablePadding>
                      <ListItemButton onClick={() => handleConfirmLink(result)} disabled={linkLoading}>
                        <ListItemText
                          primary={`#${result.id} · ${result.customer_name} · ${result.final_payment?.toLocaleString()}원`}
                          secondary={
                            <Box component="span" sx={{ display: 'inline' }}>
                              {new Date(result.created_at).toLocaleDateString('ko-KR')} ·{' '}
                              <Box component="span" sx={{ color: savedColor, fontWeight: 700 }}>
                                연계 시 {saved.toLocaleString()}원 절감 {freeShipping ? '(무료배송)' : '(합배송)'}
                              </Box>
                            </Box>
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
          <Button onClick={() => { setLinkDialogOpen(false); setLinkSearchResults([]); setLinkSearchTerm(''); }}>취소</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>주문 삭제</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            주문 <strong>#{order?.id}</strong> ({order?.customer_name})을 삭제합니다.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            이 작업은 되돌릴 수 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>취소</Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={14} /> : null}
          >
            삭제
          </Button>
        </DialogActions>
      </Dialog>

      {/* Daum Postcode Dialog */}
      <Dialog open={showPostcode} onClose={() => setShowPostcode(false)} maxWidth="sm" fullWidth sx={{ zIndex: 1400 }}>
        <DialogTitle>주소 검색</DialogTitle>
        <DialogContent>
          <DaumPostcode onComplete={handleDaumComplete} style={{ height: '60vh' }} />
        </DialogContent>
      </Dialog>
    </>
  );
};

// ─── 연계 주문 행 (Alert 대신 톤 카드) ────────────────────────────
const LinkedOrderRow = ({ tone, data, statusToKorean }) => {
  const theme = useTheme();
  const isParent = tone === 'parent';
  const accent = isParent ? theme.palette.info.main : theme.palette.warning.main;
  const label = isParent ? '원주문 (1차)' : '추가 주문 (2차)';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        flexWrap: 'wrap',
        p: 1.5,
        borderRadius: `${theme.radii.md}px`,
        bgcolor: alpha(accent, 0.06),
        border: `1px solid ${alpha(accent, 0.2)}`,
      }}
    >
      <Box sx={{ minWidth: 96 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: accent }}>{label}</Typography>
      </Box>
      <Typography variant="body2" sx={{ flex: 1, minWidth: 0, fontFeatureSettings: '"tnum" 1' }}>
        #{data.id} · {data.customer_name} · {data.final_payment?.toLocaleString()}원
      </Typography>
      <StatusBadge value={data.status} size="sm" label={statusToKorean?.[data.status]} />
    </Box>
  );
};

const StatusHistoryAccordion = ({ history, statusToKorean }) => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const reversed = [...history].reverse();
  const current = reversed[0];
  const rest = reversed.slice(1);

  return (
    <SectionCard padding={20}>
      <Box
        onClick={() => setOpen(o => !o)}
        sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          mb: 1.5, cursor: 'pointer', userSelect: 'none',
        }}
      >
        <Typography variant="subtitle1">상태 이력</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {!open && rest.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              {rest.length}개 이전 이력
            </Typography>
          )}
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </Box>
      </Box>
      <Paper variant="outlined" sx={{ borderRadius: `${theme.radii.md}px`, overflow: 'hidden' }}>
        {/* 현재 상태는 항상 표시 */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            px: 2,
            py: 1.25,
            bgcolor: theme.gray[50],
            borderBottom: open && rest.length > 0 ? `1px solid ${theme.gray[200]}` : 'none',
          }}
        >
          <StatusBadge value={current.status} size="sm" label={statusToKorean?.[current.status]} />
          <Typography variant="body2" sx={{ fontFeatureSettings: '"tnum" 1' }}>
            {new Date(current.changed_at).toLocaleString('ko-KR', {
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit', second: '2-digit',
            })}
          </Typography>
          <Box
            sx={{
              ml: 'auto',
              px: 1,
              py: 0.25,
              borderRadius: `${theme.radii.sm}px`,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.4)}`,
              color: theme.palette.primary.main,
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 700 }}>현재</Typography>
          </Box>
        </Box>
        {/* 이전 이력 — 접힘/펼침 */}
        <Collapse in={open}>
          {rest.map((entry, idx) => (
            <Box
              key={idx}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                px: 2,
                py: 1.25,
                borderBottom: idx < rest.length - 1 ? `1px solid ${theme.gray[200]}` : 'none',
              }}
            >
              <StatusBadge value={entry.status} size="sm" label={statusToKorean?.[entry.status]} />
              <Typography variant="body2" color="text.secondary" sx={{ fontFeatureSettings: '"tnum" 1' }}>
                {new Date(entry.changed_at).toLocaleString('ko-KR', {
                  year: 'numeric', month: '2-digit', day: '2-digit',
                  hour: '2-digit', minute: '2-digit', second: '2-digit',
                })}
              </Typography>
            </Box>
          ))}
        </Collapse>
      </Paper>
    </SectionCard>
  );
};

export default OrderDetailModal;
