import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
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
  Divider,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { supabase } from '../supabaseClient';
import { deleteOrderGroup, reassignGroupRepresentative } from '../api/orders';
import { summarizeGroupStatus } from '../utils/groupOrder';
import { SHIPPING_DEFAULTS } from '../constants/shipping';
import { SectionCard, StatusBadge, InfoRow, PriceBlock, ActionSlot } from './ui';
import OrderSections from './OrderSections';
import ShippingPickModal from './ShippingPickModal';

// 껍데기 모달 (설계 §5.2 / 위임 §2). 껍데기 자체 편집 없음 — 조망 + 자식 토글 편집.
// 내부 용어(대표·껍데기·부모·자식) UI 노출 금지 — "합배송 건·묶음 배송지·주문 1·2".

const CANCELLED = ['cancelled', 'refunded'];

const GroupOrderModal = ({ shell, open, onClose, statusToKorean, productsMap, products, events, addNotification, onUpdate, productsLoading, hasPermission }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [menuAnchor, setMenuAnchor] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pick, setPick] = useState({ open: false, oldRep: null, candidates: [], newStatus: null });
  const [settings, setSettings] = useState({
    free_shipping_threshold: SHIPPING_DEFAULTS.FREE_SHIPPING_THRESHOLD,
    shipping_cost: SHIPPING_DEFAULTS.SHIPPING_COST,
  });

  useEffect(() => {
    supabase.from('site_settings').select('*').single().then(({ data }) => { if (data) setSettings(data); });
  }, []);

  if (!shell) return null;

  const children = shell.linkedChildren || [];
  // 대표(묶음 배송지·배송비 담당) = 서버 명시값 representative_child_id
  const repChildId = shell.representative_child_id ?? null;
  const repChild = repChildId != null ? children.find((c) => c.id === repChildId) : null;
  const summary = summarizeGroupStatus(children);
  const total = shell.mergedTotal ?? shell.final_payment ?? 0;
  const isMaster = hasPermission('master');
  const repToken = repChild?.access_token || shell.access_token;

  const addr = shell.shipping_address || {};

  // 대표 취소 위임 인터셉트 — OrderSections 상태 변경 전에 호출됨.
  const handleStatusChangeIntercept = async (child, newStatus) => {
    if (!CANCELLED.includes(newStatus)) return false;
    if (repChildId == null || child.id !== repChildId) return false; // 대표가 아니면 일반 처리
    const siblings = children.filter((c) => c.id !== child.id && !CANCELLED.includes(c.status));
    if (siblings.length === 0) return false; // 남은 활성 주문 없음 — 일반 취소

    if (siblings.length === 1) {
      try {
        await reassignGroupRepresentative(shell.id, child.id, siblings[0].id);
        const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', child.id);
        if (error) throw error;
        addNotification('묶음 배송지를 자동으로 옮기고 주문을 취소했습니다.', 'success');
        onUpdate();
      } catch (e) {
        addNotification('배송지 위임 실패: ' + e.message, 'error');
      }
      return true;
    }

    setPick({ open: true, oldRep: child, candidates: siblings, newStatus });
    return true;
  };

  const handleDeleteGroup = async () => {
    setDeleting(true);
    try {
      const result = await deleteOrderGroup(shell.id);
      if (result?.needs_onsite_fee) {
        addNotification(
          `합배송을 해제했습니다. 일부 주문은 결제완료 상태라 배송비 ${(result.total_onsite_fee_amount || 0).toLocaleString()}원을 현장에서 별도 결제로 안내해 주세요.`,
          'warning'
        );
      } else {
        addNotification('합배송을 해제했습니다.', 'success');
      }
      setDeleteConfirmOpen(false);
      onUpdate();
      onClose();
    } catch (e) {
      addNotification('합배송 삭제 실패: ' + e.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const WrapperComponent = isMobile ? Drawer : Modal;
  const wrapperProps = isMobile
    ? { anchor: 'bottom', open, onClose, PaperProps: { sx: { borderRadius: `${theme.radii.lg}px ${theme.radii.lg}px 0 0`, maxHeight: '95vh' } } }
    : { open, onClose, closeAfterTransition: true, BackdropComponent: Backdrop, BackdropProps: { timeout: 500 } };

  const modalStyle = isMobile
    ? { p: 0, display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.paper' }
    : {
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '90%', maxWidth: 800, bgcolor: 'background.paper', boxShadow: theme.customShadows.lg,
        p: 0, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        borderRadius: `${theme.radii.lg}px`, overflow: 'hidden',
      };

  const content = (
    <Box sx={modalStyle}>
      {/* Header */}
      <Box
        sx={{
          p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          bgcolor: theme.gray[50], borderBottom: `1px solid ${theme.gray[200]}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h5">합배송 건</Typography>
          <StatusBadge value={summary.value} size="sm" label={statusToKorean?.[summary.value]} />
          {summary.caption && (
            <Typography variant="caption" color="text.secondary">{summary.caption}</Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {(repToken || isMaster) && (
            <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ color: theme.gray[500] }} aria-label="더보기">
              <MoreVertIcon sx={{ fontSize: 20 }} />
            </IconButton>
          )}
          <IconButton aria-label="close" onClick={onClose} sx={{ color: theme.gray[500] }}><CloseIcon /></IconButton>
        </Box>
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1, minHeight: 0, p: isMobile ? 2 : 3, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, '& > *': { flexShrink: 0 } }}>
        {/* ① 묶음 배송지 */}
        <SectionCard title="묶음 배송지" padding={20}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <InfoRow label="받는 분" value={shell.customer_name || 'N/A'} labelWidth={96} />
            <InfoRow label="연락처" value={shell.phone_number || 'N/A'} mono muted={!shell.phone_number} labelWidth={96} />
            <InfoRow label="우편번호" value={addr.postcode || 'N/A'} mono muted={!addr.postcode} labelWidth={96} />
            <InfoRow label="도로명" value={addr.address || 'N/A'} multiline labelWidth={96} />
            <InfoRow label="상세 주소" value={addr.detail || 'N/A'} multiline muted={!addr.detail} labelWidth={96} />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            이 주소로 함께 배송됩니다.
          </Typography>
        </SectionCard>

        {/* ② 전체 상품 (주문별 구분) */}
        <SectionCard title="전체 상품" padding={20}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {children.map((child, idx) => (
              <Box key={child.id}>
                <Typography variant="overline" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                  주문 {idx + 1} · {child.customer_name}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  {(child.order_items || []).map((item, i) => (
                    <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                      <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
                        {item.product_name || productsMap[item.product_id]?.name || '상품'}
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75 }}>
                          × {item.quantity}
                        </Typography>
                      </Typography>
                      <Typography variant="body2" sx={{ fontFeatureSettings: '"tnum" 1', whiteSpace: 'nowrap' }}>
                        {((item.price_at_purchase || 0) * (item.quantity || 0)).toLocaleString()}원
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        </SectionCard>

        {/* ③ 결제금액 (주문별 + 합산) */}
        <SectionCard title="결제금액" padding={20}>
          <PriceBlock
            rows={children.map((child, idx) => ({
              label: `주문 ${idx + 1} · ${child.customer_name}`,
              value: child.final_payment || 0,
            }))}
            totalLabel="합산 결제금액"
            totalValue={total}
            totalColor={theme.palette.primary.main}
          />
        </SectionCard>

        {/* ④⑤ 주문별 단건 토글 */}
        {children.map((child, idx) => (
          <Accordion
            key={child.id}
            disableGutters
            TransitionProps={{ unmountOnExit: true }}
            sx={{
              border: `1px solid ${theme.gray[200]}`,
              borderRadius: `${theme.radii.lg}px !important`,
              boxShadow: 'none',
              '&:before': { display: 'none' },
              overflow: 'hidden',
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', width: '100%' }}>
                <Typography variant="subtitle2">주문 {idx + 1}</Typography>
                <Typography variant="body2" color="text.secondary">{child.customer_name} · #{child.id}</Typography>
                <Typography variant="body2" sx={{ fontFeatureSettings: '"tnum" 1', ml: 'auto' }}>
                  {(child.final_payment || 0).toLocaleString()}원
                </Typography>
                <StatusBadge value={child.status} size="sm" label={statusToKorean?.[child.status]} />
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ bgcolor: theme.gray[50] }}>
              <OrderSections
                order={child}
                statusToKorean={statusToKorean}
                productsMap={productsMap}
                products={products}
                events={events}
                addNotification={addNotification}
                onUpdate={onUpdate}
                productsLoading={productsLoading}
                hasPermission={hasPermission}
                onStatusChangeIntercept={handleStatusChangeIntercept}
              />
            </AccordionDetails>
          </Accordion>
        ))}
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

      {/* 헤더 ⋮ 메뉴 */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 200, borderRadius: `${theme.radii.md}px`, boxShadow: theme.customShadows.md } } }}
      >
        {repToken && (
          <MenuItem
            component="a"
            href={`/order/status/${repToken}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMenuAnchor(null)}
            sx={{ minHeight: 44 }}
          >
            <ListItemIcon><OpenInNewIcon sx={{ fontSize: 18 }} /></ListItemIcon>
            <ListItemText primary="고객 주문서 열기" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
          </MenuItem>
        )}
        {repToken && isMaster && <Divider sx={{ my: 0.5 }} />}
        {isMaster && (
          <MenuItem onClick={() => { setMenuAnchor(null); setDeleteConfirmOpen(true); }} sx={{ minHeight: 44, color: 'error.main' }}>
            <ListItemIcon><DeleteIcon sx={{ fontSize: 18, color: theme.palette.error.main }} /></ListItemIcon>
            <ListItemText primary="합배송 삭제" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
          </MenuItem>
        )}
      </Menu>

      {/* 합배송 삭제 확인 */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>합배송 삭제</DialogTitle>
        <DialogContent>
          <Typography variant="body1">이 합배송 묶음을 해제합니다.</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            묶인 {children.length}건의 개별 주문은 유지됩니다. 이 작업은 되돌릴 수 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>취소</Button>
          <Button onClick={handleDeleteGroup} variant="contained" color="error" disabled={deleting} startIcon={deleting ? <CircularProgress size={14} /> : null}>
            삭제
          </Button>
        </DialogActions>
      </Dialog>

      {/* 대표 취소 위임 — 묶음 배송지 선택 */}
      <ShippingPickModal
        open={pick.open}
        onClose={() => setPick({ open: false, oldRep: null, candidates: [], newStatus: null })}
        groupParentId={shell.id}
        oldRep={pick.oldRep}
        candidates={pick.candidates}
        newStatus={pick.newStatus}
        settings={settings}
        addNotification={addNotification}
        onDone={() => { setPick({ open: false, oldRep: null, candidates: [], newStatus: null }); onUpdate(); }}
      />
    </>
  );
};

export default GroupOrderModal;
