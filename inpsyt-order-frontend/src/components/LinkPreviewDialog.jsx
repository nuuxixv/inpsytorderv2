import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Checkbox,
  Radio,
  RadioGroup,
  FormControlLabel,
  Alert,
  Divider,
  CircularProgress,
  useTheme,
} from '@mui/material';
import { searchOrdersForLinking, linkOrders } from '../api/orders';
import { supabase } from '../supabaseClient';
import { SHIPPING_DEFAULTS } from '../constants/shipping';
import { SectionCard, PriceBlock } from './ui';

// 합배송 연계 생성 미리보기 (설계 §5.2 / 위임 §5).
// 검색 → 대상 다중선택 → 미리보기(묶음 배송지 선택·배송비 변화·Case A/B·확인 체크) → linkOrders(childIds, repChildId)

const last4 = (phone) => (phone || '').replace(/\D/g, '').slice(-4);

const candidateLabel = (o) => {
  const addr = o.shipping_address || {};
  const road = [addr.address, addr.detail].filter(Boolean).join(' ') || '배송지 없음';
  const tail = last4(o.phone_number);
  return `${o.customer_name}${tail ? `(${tail})` : ''} · ${road}`;
};

const LinkPreviewDialog = ({ open, onClose, baseOrder, events, addNotification, onLinked }) => {
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selected, setSelected] = useState([]); // 추가로 묶을 주문 객체들
  const [repId, setRepId] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [linking, setLinking] = useState(false);
  const [settings, setSettings] = useState({
    free_shipping_threshold: SHIPPING_DEFAULTS.FREE_SHIPPING_THRESHOLD,
    shipping_cost: SHIPPING_DEFAULTS.SHIPPING_COST,
  });

  useEffect(() => {
    if (!open) return;
    setSearchTerm('');
    setSearchResults([]);
    setSelected([]);
    setRepId(baseOrder?.id ?? null);
    setConfirmed(false);
    supabase.from('site_settings').select('*').single().then(({ data }) => { if (data) setSettings(data); });
  }, [open, baseOrder]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setSearchLoading(true);
    try {
      const results = await searchOrdersForLinking(searchTerm, baseOrder.id);
      // 같은 학회 + 취소/환불 제외 후보만
      const filtered = results.filter(
        (o) => o.event_id === baseOrder.event_id && !['cancelled', 'refunded'].includes(o.status)
      );
      setSearchResults(filtered);
    } catch (e) {
      addNotification('검색 실패: ' + e.message, 'error');
    } finally {
      setSearchLoading(false);
    }
  };

  const toggleSelect = (order) => {
    setSelected((prev) =>
      prev.some((o) => o.id === order.id) ? prev.filter((o) => o.id !== order.id) : [...prev, order]
    );
  };

  if (!baseOrder) return null;

  const participants = [baseOrder, ...selected];
  const canPreview = participants.length >= 2;

  // 배송비 미리보기 — 정가 합 기준 무료배송 판정
  const combinedListPrice = participants.reduce((s, o) => s + (o.total_cost || 0), 0);
  const freeShipping = combinedListPrice >= settings.free_shipping_threshold;
  const currentDeliverySum = participants.reduce((s, o) => s + (o.delivery_fee || 0), 0);
  const afterDelivery = freeShipping ? 0 : settings.shipping_cost;
  const saved = Math.max(0, currentDeliverySum - afterDelivery);

  const rep = participants.find((o) => o.id === repId) || baseOrder;
  const isCaseB = afterDelivery > 0;
  const repIsPending = rep.status === 'pending';
  // Case B: 배송비 조정 대상(대표)이 pending일 때만 연계 가능(결제완료 금액 불변)
  const blockedByCaseB = isCaseB && !repIsPending;

  const eventName = events?.find((e) => e.id === baseOrder.event_id)?.name || '';

  const handleCreate = async () => {
    setLinking(true);
    try {
      const childIds = participants.map((o) => o.id);
      await linkOrders(childIds, rep.id);
      addNotification('합배송으로 묶었습니다.', 'success');
      onLinked();
    } catch (e) {
      addNotification('합배송 생성 실패: ' + e.message, 'error');
    } finally {
      setLinking(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>합배송 만들기</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          주문 #{baseOrder.id}({baseOrder.customer_name})과 함께 묶을 주문을 검색해 선택하세요.
          {eventName && ` · ${eventName}`}
        </Typography>

        {/* 검색 */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="고객명 또는 연락처 입력"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button variant="contained" onClick={handleSearch} disabled={searchLoading} sx={{ whiteSpace: 'nowrap' }}>
            {searchLoading ? <CircularProgress size={20} /> : '검색'}
          </Button>
        </Box>

        {searchResults.length > 0 && (
          <List dense sx={{ mb: 1 }}>
            {searchResults.map((result) => {
              const checked = selected.some((o) => o.id === result.id);
              return (
                <React.Fragment key={result.id}>
                  <ListItem disablePadding secondaryAction={<Checkbox edge="end" checked={checked} onChange={() => toggleSelect(result)} />}>
                    <ListItemButton onClick={() => toggleSelect(result)}>
                      <ListItemText
                        primary={`#${result.id} · ${result.customer_name} · ${(result.final_payment || 0).toLocaleString()}원`}
                        secondary={candidateLabel(result)}
                      />
                    </ListItemButton>
                  </ListItem>
                  <Divider component="li" />
                </React.Fragment>
              );
            })}
          </List>
        )}
        {searchResults.length === 0 && searchTerm && !searchLoading && (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 1 }}>검색 결과가 없습니다.</Typography>
        )}

        {/* 미리보기 */}
        {canPreview && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {/* ① 묶음 배송지 선택 */}
            <SectionCard title="묶음 배송지 선택" padding={16}>
              <RadioGroup value={repId} onChange={(e) => setRepId(Number(e.target.value))}>
                {participants.map((o) => (
                  <FormControlLabel
                    key={o.id}
                    value={o.id}
                    control={<Radio size="small" />}
                    label={<Typography variant="body2">{candidateLabel(o)}</Typography>}
                  />
                ))}
              </RadioGroup>
              <Typography variant="caption" color="text.secondary">
                이 주소로 {participants.length}건이 함께 배송됩니다.
              </Typography>
            </SectionCard>

            {/* ② 배송비 변화 + 절감액 */}
            <SectionCard title="배송비" padding={16}>
              <PriceBlock
                rows={[
                  { label: '기존 배송비 합계', value: currentDeliverySum, muted: currentDeliverySum === 0 },
                  { label: '합배송 후 배송비', value: afterDelivery, muted: afterDelivery === 0 },
                ]}
                totalLabel="배송비 절감"
                totalValue={saved}
                totalColor={saved > 0 ? theme.status.paid : undefined}
              />
            </SectionCard>

            {/* ③ Case A / B */}
            {isCaseB ? (
              <Alert severity="warning">
                묶음 배송비 {afterDelivery.toLocaleString()}원은 선택한 배송지 주문(#{rep.id} {rep.customer_name})에 부과됩니다.
                {blockedByCaseB && ' 이 주문은 결제대기 상태가 아니어서 배송비를 조정할 수 없습니다. 결제대기 상태의 주문을 배송지로 선택하세요.'}
              </Alert>
            ) : (
              <Alert severity="info">추가 배송비 없이 한 주소로 함께 배송됩니다.</Alert>
            )}

            {/* ④ 확인 체크 */}
            <FormControlLabel
              control={<Checkbox checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />}
              label={<Typography variant="body2">합배송한 뒤에는 다시 나눌 수 없습니다. 확인했습니다.</Typography>}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={linking}>취소</Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={!canPreview || !confirmed || blockedByCaseB || linking}
          startIcon={linking ? <CircularProgress size={14} /> : null}
        >
          합배송 만들기
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LinkPreviewDialog;
