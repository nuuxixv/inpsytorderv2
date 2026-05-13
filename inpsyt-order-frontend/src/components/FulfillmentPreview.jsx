import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, Checkbox, OutlinedInput, ListItemText,
  IconButton, Tooltip, Snackbar, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  LocalShipping as LocalShippingIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  FileDownload as DownloadIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  BadgeOutlined as BadgeIcon,
  LocationOn as LocationIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import { PageHeader, SectionCard, StatusChip } from './ui';
import PreviewShell from './preview/PreviewShell';
import { STATUS_TO_KOREAN } from '../constants/orderStatus';

/**
 * DEV-ONLY keystone: /preview/fulfillment.
 * 어드민 출고 현황 디자인 시안 — 실제 로직은 FulfillmentPage.jsx 참고.
 * 운영 모델 절대 사실: 출고 알림/송장번호/배송추적 없음.
 */

// ─── Mock 데이터 ───────────────────────────────────────────────

const MOCK_EVENTS = [
  { id: 'e1', name: '2026년 한국심리학회 연차학술대회' },
  { id: 'e2', name: '2026 한국임상심리학회 봄학술대회' },
  { id: 'e3', name: '2026 한국상담심리학회 연차대회' },
];

// 4개 그룹: 단건 1, 묶음 2~3건 2개, 도서+검사 혼합 1
const MOCK_GROUPS = [
  {
    id: 'g1',
    customer_name: '김현수',
    phone: '010-2341-1234',
    insight_id: 'IPS-29481',
    address: '서울특별시 서초구 반포대로 222, 강남빌딩 7층 701호',
    request_note: '부재 시 경비실에 맡겨주세요',
    event_id: 'e1',
    orders: [
      { id: 20264107, insight_id: 'IPS-29481', summary: 'MMPI-2 검사지 외 2건', total: 245000, status: 'paid', category: 'test' },
    ],
  },
  {
    id: 'g2',
    customer_name: '이정민',
    phone: '010-8842-7610',
    insight_id: 'IPS-30188',
    address: '경기도 성남시 분당구 판교역로 235, 미래에셋플레이스 12층',
    request_note: '평일 오전 10시 이후 배송 부탁드립니다',
    event_id: 'e1',
    orders: [
      { id: 20264106, insight_id: 'IPS-30188', summary: 'K-WAIS-IV 채점판', total: 89000, status: 'paid', category: 'test' },
      { id: 20264092, insight_id: 'IPS-30188', summary: 'BGT-2 도구 세트', total: 156000, status: 'paid', category: 'test' },
    ],
  },
  {
    id: 'g3',
    customer_name: '박지훈',
    phone: '010-5512-9087',
    insight_id: 'IPS-28774',
    address: '부산광역시 해운대구 센텀남대로 35, 센텀그린타워 9층 905호',
    request_note: '현관 앞 놓아주세요',
    event_id: 'e2',
    orders: [
      { id: 20264105, insight_id: 'IPS-28774', summary: '아동·청소년 임상총서 (전 4권)', total: 178000, status: 'paid', category: 'book' },
      { id: 20264099, insight_id: 'IPS-28774', summary: 'CBCL 6-18 채점판', total: 142000, status: 'paid', category: 'test' },
      { id: 20264081, insight_id: 'IPS-28774', summary: '임상심리평가 핸드북', total: 92000, status: 'preparing', category: 'book' },
    ],
  },
  {
    id: 'g4',
    customer_name: '최서연',
    phone: '010-3320-4815',
    insight_id: 'IPS-30421',
    address: '대구광역시 수성구 동대구로 348, 메디컬센터 5층',
    request_note: '',
    event_id: 'e3',
    orders: [
      { id: 20264104, insight_id: 'IPS-30421', summary: '심리치료의 기초 외 1권', total: 64000, status: 'completed', category: 'book' },
      { id: 20264095, insight_id: 'IPS-30421', summary: 'Rorschach 검사 도구', total: 312000, status: 'completed', category: 'test' },
    ],
  },
];

const PRODUCT_CATEGORIES = [
  { key: 'all',  label: '전체' },
  { key: 'book', label: '도서' },
  { key: 'test', label: '검사' },
];

const PAYMENT_STATUS_OPTIONS = ['paid', 'preparing', 'completed'];
const FULFILLMENT_STATUS_OPTIONS = [
  { key: 'pending', label: '대기' },
  { key: 'shipped', label: '발송완료' },
];

const PAYMENT_STATUS_LABEL = {
  ...STATUS_TO_KOREAN,
  preparing: '출고대기',
};

// ─── 그룹 카드 ─────────────────────────────────────────────────

const CopyIconButton = ({ tooltip, icon, onClick }) => {
  const theme = useTheme();
  return (
    <Tooltip title={tooltip} placement="top" arrow>
      <IconButton
        size="small"
        onClick={onClick}
        sx={{
          width: 44, height: 44,
          borderRadius: `${theme.radii.sm}px`,
          color: theme.gray[600],
          border: `1px solid ${theme.gray[200]}`,
          bgcolor: '#fff',
          cursor: 'copy',
          transition: `all 0.15s ${theme.easing.toss}`,
          '&:hover': {
            bgcolor: alpha(theme.palette.primary.main, 0.06),
            borderColor: alpha(theme.palette.primary.main, 0.3),
            color: theme.palette.primary.main,
          },
        }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
};

// 데이터 라인 (라벨 + 값 + 인라인 복사 버튼)
const DataLine = ({ label, value, onCopy, mono = false, multiline = false, muted = false }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: multiline ? 'flex-start' : 'center',
        gap: 1,
        py: 0.5,
        minHeight: 28,
      }}
    >
      <Typography
        sx={{
          flex: '0 0 64px',
          fontSize: '0.6875rem',
          fontWeight: 700,
          color: 'text.disabled',
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          pt: multiline ? '2px' : 0,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          flex: 1,
          fontSize: '0.875rem',
          fontWeight: 500,
          color: muted ? 'text.secondary' : 'text.primary',
          letterSpacing: '-0.01em',
          fontFamily: mono
            ? 'ui-monospace, SFMono-Regular, Menlo, monospace'
            : undefined,
          fontFeatureSettings: mono ? '"tnum" 1' : undefined,
          wordBreak: 'break-all',
        }}
      >
        {value}
      </Typography>
      {onCopy && (
        <IconButton
          size="small"
          onClick={onCopy}
          sx={{
            width: 28,
            height: 28,
            color: theme.gray[400],
            cursor: 'copy',
            '&:hover': {
              color: theme.palette.primary.main,
              bgcolor: alpha(theme.palette.primary.main, 0.06),
            },
          }}
        >
          <ContentCopyIcon sx={{ fontSize: 14 }} />
        </IconButton>
      )}
    </Box>
  );
};

const FulfillmentGroupCard = ({ group, selected, onSelectToggle, onCopy, onComplete }) => {
  const theme = useTheme();
  const totalAmount = group.orders.reduce((sum, o) => sum + o.total, 0);
  const orderCount = group.orders.length;
  const requestNote = group.request_note?.trim();

  return (
    <SectionCard
      padding={0}
      sx={{
        mb: 2,
        position: 'relative',
      }}
    >
      {/* 그룹 헤더 */}
      <Box
        sx={{
          px: 3, py: 2,
          borderBottom: `1px solid ${theme.gray[100]}`,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box
          onClick={(e) => { e.stopPropagation(); onSelectToggle(); }}
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 44, height: 44, ml: -1,
            cursor: 'pointer',
          }}
        >
          <Checkbox checked={selected} size="small" sx={{ p: 0 }} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, minWidth: 0, flex: 1 }}>
          <Typography
            sx={{
              fontSize: '1rem', fontWeight: 700,
              color: 'text.primary', letterSpacing: '-0.015em',
            }}
          >
            {group.customer_name}
          </Typography>
          <Chip
            label={`묶음 ${orderCount}건`}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.6875rem',
              fontWeight: 700,
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              color: theme.palette.primary.main,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            }}
          />
          <Typography
            sx={{
              fontSize: '0.75rem', color: 'text.disabled',
              fontFeatureSettings: '"tnum" 1',
              ml: 'auto',
            }}
          >
            합계 {totalAmount.toLocaleString()}원
          </Typography>
        </Box>
      </Box>

      {/* 데이터 라인 (주소·연락처·인싸이트 ID·요청사항) */}
      <Box sx={{ px: 3, py: 1.5, borderBottom: `1px solid ${theme.gray[100]}` }}>
        <DataLine
          label="주소"
          value={group.address}
          onCopy={() => onCopy('주소', group.address)}
          multiline
        />
        <DataLine
          label="연락처"
          value={group.phone}
          onCopy={() => onCopy('연락처', group.phone)}
          mono
        />
        <DataLine
          label="ID"
          value={group.insight_id}
          onCopy={() => onCopy('인싸이트 ID', group.insight_id)}
          mono
        />
        <DataLine
          label="요청"
          value={requestNote || '없음'}
          onCopy={requestNote ? () => onCopy('요청사항', requestNote) : undefined}
          muted={!requestNote}
          multiline
        />
      </Box>

      {/* 액션 행 (복사 단축 + 출고 완료) */}
      <Box
        sx={{
          px: 3, py: 1.25,
          display: 'flex', alignItems: 'center', gap: 1,
          bgcolor: theme.gray[50],
          borderBottom: `1px solid ${theme.gray[100]}`,
          flexWrap: 'wrap',
        }}
      >
        <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled', fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', mr: 0.5 }}>
          단축 복사
        </Typography>
        <CopyIconButton
          tooltip={`이름 복사 — ${group.customer_name}`}
          icon={<PersonIcon sx={{ fontSize: 18 }} />}
          onClick={() => onCopy('이름', group.customer_name)}
        />
        <CopyIconButton
          tooltip={`연락처 복사 — ${group.phone}`}
          icon={<PhoneIcon sx={{ fontSize: 18 }} />}
          onClick={() => onCopy('연락처', group.phone)}
        />
        <CopyIconButton
          tooltip={`인싸이트 ID 복사 — ${group.insight_id}`}
          icon={<BadgeIcon sx={{ fontSize: 18 }} />}
          onClick={() => onCopy('인싸이트 ID', group.insight_id)}
        />
        <CopyIconButton
          tooltip={`주소 복사 — ${group.address}`}
          icon={<LocationIcon sx={{ fontSize: 18 }} />}
          onClick={() => onCopy('주소', group.address)}
        />
        <Box sx={{ ml: 'auto' }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
            onClick={onComplete}
            sx={{ minHeight: 36 }}
          >
            출고 완료 처리
          </Button>
        </Box>
      </Box>

      {/* 주문 행 리스트 */}
      <Box>
        {group.orders.map((order, idx) => (
          <Box
            key={order.id}
            sx={{
              display: 'grid',
              gridTemplateColumns: 'minmax(110px, 1fr) minmax(100px, 1fr) minmax(180px, 2.5fr) 120px 100px',
              alignItems: 'center',
              gap: 2,
              px: 3, py: 1.5,
              minHeight: 56,
              borderBottom: idx === group.orders.length - 1 ? 'none' : `1px solid ${theme.gray[50]}`,
              transition: `background-color 0.15s ${theme.easing.toss}`,
              '&:hover': { bgcolor: theme.gray[50] },
            }}
          >
            <Typography
              sx={{
                fontSize: '0.8125rem', color: 'text.disabled',
                fontWeight: 700, letterSpacing: '-0.01em',
                fontFeatureSettings: '"tnum" 1',
              }}
            >
              #{order.id}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.8125rem', color: 'text.secondary',
                fontFeatureSettings: '"tnum" 1',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {order.insight_id}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.875rem', color: 'text.primary',
                fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {order.summary}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.9375rem', fontWeight: 800,
                textAlign: 'right', letterSpacing: '-0.025em',
                color: 'text.primary',
                fontFeatureSettings: '"tnum" 1',
              }}
            >
              {order.total.toLocaleString()}원
            </Typography>
            <Box>
              <StatusChip status={order.status === 'preparing' ? 'paid' : order.status} size="sm" />
            </Box>
          </Box>
        ))}
      </Box>
    </SectionCard>
  );
};

// ─── 메인 ──────────────────────────────────────────────────────

const FulfillmentPreview = () => {
  const theme = useTheme();
  const [productCategory, setProductCategory] = useState('all');
  const [selectedPaymentStatuses, setSelectedPaymentStatuses] = useState(['paid', 'preparing', 'completed']);
  const [fulfillmentStatus, setFulfillmentStatus] = useState('pending');
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (productCategory !== 'all') count += 1;
    if (selectedPaymentStatuses.length !== 3) count += 1;
    if (fulfillmentStatus !== 'pending') count += 1;
    if (selectedEvents.length > 0) count += 1;
    if (searchTerm) count += 1;
    return count;
  }, [productCategory, selectedPaymentStatuses, fulfillmentStatus, selectedEvents, searchTerm]);

  const totalOrders = MOCK_GROUPS.reduce((sum, g) => sum + g.orders.length, 0);
  const bookCount = MOCK_GROUPS.reduce(
    (sum, g) => sum + g.orders.filter(o => o.category === 'book').length, 0,
  );
  const testCount = MOCK_GROUPS.reduce(
    (sum, g) => sum + g.orders.filter(o => o.category === 'test').length, 0,
  );

  const toggleGroup = (id) => {
    setSelectedGroupIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  const handleCopy = (label, value) => {
    setSnackbar({ open: true, message: `${label} 복사되었습니다 · ${value}` });
  };

  const handleGroupComplete = (groupName) => {
    setSnackbar({ open: true, message: `${groupName}님 묶음 — 출고 완료 처리됨` });
  };

  const handleBulkComplete = () => {
    if (selectedGroupIds.length === 0) return;
    setSnackbar({
      open: true,
      message: `${selectedGroupIds.length}개 묶음 일괄 출고 완료 처리됨`,
    });
    setSelectedGroupIds([]);
  };

  return (
    <PreviewShell activePath="/admin/fulfillment">
      <PageHeader
        title="출고 현황"
        subtitle={`총 ${totalOrders}건 · 도서 ${bookCount}건 · 검사 ${testCount}건`}
        icon={LocalShippingIcon}
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
              sx={{ minHeight: 36 }}
            >
              엑셀 다운로드
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
              disabled={selectedGroupIds.length === 0}
              onClick={handleBulkComplete}
              sx={{ minHeight: 36 }}
            >
              출고 완료 처리
              {selectedGroupIds.length > 0 && ` (${selectedGroupIds.length})`}
            </Button>
          </Box>
        }
      />

      {/* ─── 필터 영역 ─── */}
      <SectionCard sx={{ mb: 3 }} padding={20}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <FilterListIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography
            sx={{
              fontSize: '0.8125rem', fontWeight: 800,
              color: 'text.primary', letterSpacing: '-0.01em',
            }}
          >
            필터
          </Typography>
          {activeFilterCount > 0 && (
            <Chip
              label={activeFilterCount}
              size="small"
              sx={{
                height: 18, fontSize: '0.6875rem', fontWeight: 800,
                bgcolor: theme.palette.primary.main, color: '#fff',
              }}
            />
          )}
        </Box>

        {/* Row 1 — 카테고리 토글 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 700, mr: 0.5 }}>
            카테고리
          </Typography>
          {PRODUCT_CATEGORIES.map(({ key, label }) => (
            <Chip
              key={key}
              label={label}
              size="small"
              variant={productCategory === key ? 'filled' : 'outlined'}
              color={productCategory === key ? 'primary' : 'default'}
              onClick={() => setProductCategory(key)}
              sx={{
                paddingX: 1.5,
                fontWeight: productCategory === key ? 700 : 500,
                cursor: 'pointer',
              }}
            />
          ))}
        </Box>

        {/* Row 2 — 결제 상태 멀티 + 출고 상태 토글 */}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', mb: 1.5 }}>
          <FormControl size="small" sx={{ minWidth: 200, flex: '0 1 240px' }}>
            <InputLabel>결제 상태</InputLabel>
            <Select
              multiple
              value={selectedPaymentStatuses}
              label="결제 상태"
              input={<OutlinedInput label="결제 상태" />}
              onChange={(e) => setSelectedPaymentStatuses(e.target.value)}
              renderValue={(sel) =>
                sel.length === 0
                  ? '전체'
                  : sel.length === 3
                    ? '전체'
                    : sel.map(s => PAYMENT_STATUS_LABEL[s]).join(', ')
              }
            >
              {PAYMENT_STATUS_OPTIONS.map(key => (
                <MenuItem key={key} value={key}>
                  <Checkbox checked={selectedPaymentStatuses.includes(key)} size="small" />
                  <ListItemText
                    primary={PAYMENT_STATUS_LABEL[key]}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 700 }}>
              출고 상태
            </Typography>
            {FULFILLMENT_STATUS_OPTIONS.map(({ key, label }) => (
              <Chip
                key={key}
                label={label}
                size="small"
                variant={fulfillmentStatus === key ? 'filled' : 'outlined'}
                color={fulfillmentStatus === key ? 'primary' : 'default'}
                onClick={() => setFulfillmentStatus(key)}
                sx={{
                  paddingX: 1.5,
                  fontWeight: fulfillmentStatus === key ? 700 : 500,
                  cursor: 'pointer',
                }}
              />
            ))}
          </Box>
        </Box>

        {/* Row 3 — 행사 멀티 + 고객명 검색 */}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 200, flex: '1 1 240px' }}>
            <InputLabel>행사</InputLabel>
            <Select
              multiple
              value={selectedEvents}
              label="행사"
              input={<OutlinedInput label="행사" />}
              onChange={(e) => setSelectedEvents(e.target.value)}
              renderValue={(sel) =>
                sel.length === 0
                  ? '전체'
                  : sel.length === 1
                    ? MOCK_EVENTS.find(ev => ev.id === sel[0])?.name
                    : `${sel.length}개 선택`
              }
            >
              {MOCK_EVENTS.map(ev => (
                <MenuItem key={ev.id} value={ev.id}>
                  <Checkbox checked={selectedEvents.includes(ev.id)} size="small" />
                  <ListItemText primary={ev.name} primaryTypographyProps={{ variant: 'body2' }} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            placeholder="고객명 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ fontSize: 18, color: 'text.disabled', mr: 0.75 }} />,
            }}
            sx={{ flex: '1 1 200px', minWidth: 200 }}
          />
        </Box>
      </SectionCard>

      {/* ─── 그룹 카드 리스트 ─── */}
      {MOCK_GROUPS.length === 0 ? (
        <SectionCard sx={{ textAlign: 'center', py: 6 }}>
          <Typography
            sx={{ fontSize: '0.9375rem', fontWeight: 700, color: 'text.primary', mb: 0.5 }}
          >
            출고 대기 주문이 없습니다
          </Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
            필터를 조정해 주세요
          </Typography>
        </SectionCard>
      ) : (
        <Box>
          {MOCK_GROUPS.map((group) => (
            <FulfillmentGroupCard
              key={group.id}
              group={group}
              selected={selectedGroupIds.includes(group.id)}
              onSelectToggle={() => toggleGroup(group.id)}
              onCopy={handleCopy}
              onComplete={() => handleGroupComplete(group.customer_name)}
            />
          ))}
        </Box>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message={snackbar.message}
        action={
          <IconButton
            size="small"
            color="inherit"
            onClick={() => setSnackbar({ open: false, message: '' })}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        }
      />
    </PreviewShell>
  );
};

export default FulfillmentPreview;
