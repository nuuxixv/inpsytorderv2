import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Radio,
  RadioGroup,
  FormControlLabel,
  Alert,
  CircularProgress,
} from '@mui/material';
import { reassignGroupRepresentative } from '../api/orders';
import { supabase } from '../supabaseClient';
import { SHIPPING_DEFAULTS } from '../constants/shipping';

// 대표 취소 위임 — 묶음 배송지 선택 모달 (설계 §4 / 위임 §6).
// 남은 활성 자식 2건+ 일 때만 사용. 1건이면 상위에서 모달 없이 자동 위임.

const last4 = (phone) => (phone || '').replace(/\D/g, '').slice(-4);
const candidateLabel = (o) => {
  const addr = o.shipping_address || {};
  const road = [addr.address, addr.detail].filter(Boolean).join(' ') || '배송지 없음';
  const tail = last4(o.phone_number);
  return `${o.customer_name}${tail ? `(${tail})` : ''} · ${road}`;
};

const ShippingPickModal = ({ open, onClose, groupParentId, oldRep, candidates, newStatus, settings, addNotification, onDone }) => {
  const [newRepId, setNewRepId] = useState(null);
  const [saving, setSaving] = useState(false);

  const cfg = settings || {
    free_shipping_threshold: SHIPPING_DEFAULTS.FREE_SHIPPING_THRESHOLD,
    shipping_cost: SHIPPING_DEFAULTS.SHIPPING_COST,
  };

  useEffect(() => {
    if (!open || !candidates?.length) return;
    const pendingFirst = candidates.find((c) => c.status === 'pending');
    setNewRepId((pendingFirst || candidates[0]).id);
  }, [open, candidates]);

  if (!open || !candidates?.length) return null;

  // 옛 대표 상품이 빠진 그룹의 정가 합 기준 배송비 재계산
  const remainingListPrice = candidates.reduce((s, o) => s + (o.total_cost || 0), 0);
  const freeShipping = remainingListPrice >= cfg.free_shipping_threshold;
  const newRepDeliveryFee = freeShipping ? 0 : cfg.shipping_cost;

  const newRep = candidates.find((c) => c.id === newRepId) || candidates[0];
  const newRepPending = newRep.status === 'pending';

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await reassignGroupRepresentative(groupParentId, oldRep.id, newRep.id);
      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', oldRep.id);
      if (error) throw error;
      addNotification('묶음 배송지를 변경하고 주문을 취소했습니다.', 'success');
      onDone();
    } catch (e) {
      addNotification('배송지 위임 실패: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>묶음 배송지를 선택해주세요</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          취소하려는 주문이 함께 배송되는 주문들의 배송지였습니다. 남은 주문 중 어느 주소로 함께 배송할지 선택하세요.
        </Typography>
        <RadioGroup value={newRepId} onChange={(e) => setNewRepId(Number(e.target.value))}>
          {candidates.map((c) => (
            <FormControlLabel
              key={c.id}
              value={c.id}
              control={<Radio size="small" />}
              label={<Typography variant="body2">{candidateLabel(c)}</Typography>}
            />
          ))}
        </RadioGroup>
        {newRepDeliveryFee > 0 && (
          <Alert severity="info" sx={{ mt: 1.5 }}>
            {newRepPending
              ? `결제 시 배송비 ${newRepDeliveryFee.toLocaleString()}원이 함께 청구됩니다.`
              : `배송비 ${newRepDeliveryFee.toLocaleString()}원은 현장에서 별도로 결제 안내해 주세요.`}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>취소</Button>
        <Button variant="contained" onClick={handleConfirm} disabled={saving} startIcon={saving ? <CircularProgress size={14} /> : null}>
          이 주소로 배송
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShippingPickModal;
