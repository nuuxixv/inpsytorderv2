import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, Checkbox, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, LinearProgress,
  ToggleButton, ToggleButtonGroup, Autocomplete, Pagination,
  Snackbar, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Inventory2 as Inventory2Icon,
  Inventory as InventoryIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  FileUpload as UploadIcon,
  FileDownload as DownloadIcon,
  Description as DescriptionIcon,
  Add as AddIcon,
  Edit as EditIcon,
  DeleteForever as DeleteForeverIcon,
  Delete as DeleteIcon,
  Tune as TuneIcon,
  LocalOffer as TagIcon,
  TrendingUp as TrendingUpIcon,
  MenuBook as MenuBookIcon,
  Science as ScienceIcon,
  Build as BuildIcon,
  Close as CloseIcon,
  WarningAmberRounded as WarningIcon,
  RestartAlt as RestartAltIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { PageHeader, SectionCard } from './ui';
import PreviewShell from './preview/PreviewShell';

/**
 * DEV-ONLY keystone: /preview/products.
 * 어드민 상품 관리 디자인 시안 — 실 ProductManagementPage.jsx 기능 전체 복원.
 * 권한: master(편집) vs viewer(읽기) 시뮬레이션 토글로 차이 노출.
 * 위험 액션(전체 삭제) = 받아쓰기 모달, 일괄 편집 = TriState 토글 + 태그 추가/덮어쓰기.
 */

// ─── Mock 데이터 ───────────────────────────────────────────────

const DELETE_ALL_CONFIRM_TEXT = '삭제합니다';
const CATEGORIES = ['도서', '검사', '도구'];
const TAGS_POOL = ['신경정신', '치매', '아동', '청소년', '성인', '임상', '교육', '연구', '상담'];

// 12개 상품 (도서 6 / 검사 4 / 도구 2)
const MOCK_PRODUCTS = [
  { id: 1,  product_code: 'BK-1041', name: '아동·청소년 임상총서 (전 4권)', category: '도서', sub_category: '아동·청소년', list_price: 178000, notes: '4권 세트', is_discountable: true,  is_popular: true,  is_new: false, tags: ['아동', '청소년', '임상'] },
  { id: 2,  product_code: 'BK-1058', name: '심리치료의 기초', category: '도서', sub_category: '임상', list_price: 32000, notes: '제3판', is_discountable: true,  is_popular: false, is_new: false, tags: ['임상'] },
  { id: 3,  product_code: 'BK-1062', name: '임상심리평가 핸드북', category: '도서', sub_category: '임상', list_price: 48000, notes: '', is_discountable: true,  is_popular: false, is_new: true,  tags: ['임상', '연구'] },
  { id: 4,  product_code: 'BK-1075', name: '상담심리학 개론 (제3판)', category: '도서', sub_category: '상담', list_price: 38000, notes: '품절 예정', is_discountable: false, is_popular: false, is_new: false, tags: ['상담'] },
  { id: 5,  product_code: 'BK-1081', name: '발달심리학 워크북', category: '도서', sub_category: '아동·청소년', list_price: 28000, notes: '', is_discountable: true,  is_popular: false, is_new: true,  tags: ['아동', '청소년'] },
  { id: 6,  product_code: 'BK-1094', name: '심리평가 사례집', category: '도서', sub_category: '임상', list_price: 52000, notes: '', is_discountable: true,  is_popular: true,  is_new: false, tags: ['임상'] },
  { id: 7,  product_code: 'TS-2014', name: 'MMPI-2 검사지 (50매)', category: '검사', sub_category: '성인', list_price: 89000, notes: '소모품', is_discountable: false, is_popular: true,  is_new: false, tags: ['성인', '신경정신'] },
  { id: 8,  product_code: 'TS-2027', name: 'K-WAIS-IV 채점판', category: '검사', sub_category: '성인', list_price: 142000, notes: '', is_discountable: false, is_popular: false, is_new: false, tags: ['성인'] },
  { id: 9,  product_code: 'TS-2033', name: 'CBCL 6-18 채점판', category: '검사', sub_category: '아동·청소년', list_price: 78000, notes: '', is_discountable: false, is_popular: true,  is_new: false, tags: ['아동', '청소년'] },
  { id: 10, product_code: 'TS-2048', name: 'BGT-2 도구 세트', category: '검사', sub_category: '임상', list_price: 156000, notes: '', is_discountable: false, is_popular: false, is_new: true,  tags: ['임상', '신경정신'] },
  { id: 11, product_code: 'TL-3012', name: '로르샤흐 카드 세트', category: '도구', sub_category: '임상', list_price: 312000, notes: '주문 후 4주', is_discountable: false, is_popular: false, is_new: false, tags: ['임상'] },
  { id: 12, product_code: 'TL-3024', name: 'TAT 도판 세트', category: '도구', sub_category: '임상', list_price: 248000, notes: '', is_discountable: false, is_popular: false, is_new: false, tags: ['임상', '치매'] },
];

// ─── 헬퍼 ──────────────────────────────────────────────────────

const CATEGORY_META = {
  '도서': { icon: MenuBookIcon, color: 'info' },
  '검사': { icon: ScienceIcon, color: 'secondary' },
  '도구': { icon: BuildIcon, color: 'gray' },
};

const TriStateToggle = ({ label, value, onChange }) => (
  <Box>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
      {label}
    </Typography>
    <ToggleButtonGroup
      value={value === null ? 'none' : value ? 'on' : 'off'}
      exclusive
      size="small"
      onChange={(_, next) => {
        if (!next) return;
        onChange(next === 'none' ? null : next === 'on');
      }}
    >
      <ToggleButton value="none" sx={{ px: 1.5, fontSize: '0.75rem' }}>변경 없음</ToggleButton>
      <ToggleButton value="on" sx={{ px: 1.5, fontSize: '0.75rem' }}>ON</ToggleButton>
      <ToggleButton value="off" sx={{ px: 1.5, fontSize: '0.75rem' }}>OFF</ToggleButton>
    </ToggleButtonGroup>
  </Box>
);

const RowIconButton = ({ tooltip, icon, onClick, danger = false, disabled = false }) => {
  const theme = useTheme();
  return (
    <Tooltip title={tooltip} placement="top" arrow>
      <span>
        <IconButton
          size="small"
          onClick={onClick}
          disabled={disabled}
          sx={{
            width: 36, height: 36,
            borderRadius: `${theme.radii.sm}px`,
            color: danger ? theme.palette.error.main : theme.gray[600],
            border: `1px solid ${theme.gray[200]}`,
            bgcolor: '#fff',
            transition: `all 0.15s ${theme.easing.toss}`,
            '&:hover': danger
              ? {
                  bgcolor: alpha(theme.palette.error.main, 0.06),
                  borderColor: alpha(theme.palette.error.main, 0.3),
                  color: theme.palette.error.dark,
                }
              : {
                  bgcolor: alpha(theme.palette.primary.main, 0.06),
                  borderColor: alpha(theme.palette.primary.main, 0.3),
                  color: theme.palette.primary.main,
                },
            '&.Mui-disabled': { opacity: 0.4 },
          }}
        >
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );
};

// 빠른 필터 카드 (전체 / 할인 가능 / 인기 / 카테고리별)
const QuickFilterCard = (props) => {
  const { label, value, icon: IconComp, color, active, onClick } = props;
  const theme = useTheme();
  const baseColor = (() => {
    if (color === 'primary') return theme.palette.primary.main;
    if (color === 'success') return theme.status.completed;
    if (color === 'warning') return theme.accent.warning;
    if (color === 'info') return theme.status.paid;
    if (color === 'secondary') return theme.palette.secondary?.main || theme.status.preparing;
    return theme.gray[600];
  })();

  return (
    <Box
      onClick={onClick}
      sx={{
        flex: '1 1 140px',
        minWidth: 130,
        cursor: 'pointer',
        bgcolor: 'background.paper',
        border: `1px solid ${alpha(baseColor, active ? 0.55 : 0.18)}`,
        borderRadius: `${theme.radii.md}px`,
        px: 1.5,
        py: 1.25,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        transition: `all 0.15s ${theme.easing.toss}`,
        '&:hover': {
          borderColor: alpha(baseColor, 0.4),
          bgcolor: alpha(baseColor, 0.04),
        },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled', fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
          {label}
        </Typography>
        <Typography
          sx={{
            fontSize: '1.5rem',
            fontWeight: 800,
            color: active ? baseColor : 'text.primary',
            letterSpacing: '-0.02em',
            fontFeatureSettings: '"tnum" 1',
            lineHeight: 1.1,
          }}
        >
          {value}
        </Typography>
      </Box>
      <IconComp sx={{ fontSize: 28, color: alpha(baseColor, active ? 0.7 : 0.4) }} />
    </Box>
  );
};

const ProductRow = ({ product, selected, onSelectToggle, onEdit, canEdit }) => {
  const theme = useTheme();
  const { color: catColor } = CATEGORY_META[product.category] || {};
  const palette = (() => {
    if (catColor === 'info') return theme.status.paid;
    if (catColor === 'secondary') return theme.palette.secondary?.main || theme.status.preparing;
    return theme.gray[600];
  })();

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '44px minmax(180px, 2fr) 80px 120px 130px 100px minmax(120px, 1.2fr) 60px',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        minHeight: 56,
        bgcolor: selected ? alpha(theme.palette.primary.main, 0.04) : 'transparent',
        borderBottom: `1px solid ${theme.gray[100]}`,
        transition: `background-color 0.15s ${theme.easing.toss}`,
        '&:hover': { bgcolor: selected ? alpha(theme.palette.primary.main, 0.06) : theme.gray[50] },
      }}
    >
      <Box onClick={(e) => { if (!canEdit) return; e.stopPropagation(); onSelectToggle(); }} sx={{ display: 'flex', alignItems: 'center', height: 44 }}>
        <Checkbox checked={selected} size="small" disabled={!canEdit} sx={{ p: 0 }} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: '0.9375rem', fontWeight: 700, letterSpacing: '-0.015em',
            color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {product.name}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', fontFeatureSettings: '"tnum" 1', fontWeight: 600 }}>
            {product.product_code}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled' }}>·</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {product.sub_category || '-'}
          </Typography>
        </Box>
      </Box>
      <Box>
        <Chip
          label={product.category}
          size="small"
          sx={{
            height: 22,
            fontSize: '0.6875rem',
            fontWeight: 700,
            bgcolor: alpha(palette, 0.08),
            color: palette,
            border: `1px solid ${alpha(palette, 0.2)}`,
          }}
        />
      </Box>
      <Typography
        sx={{
          fontSize: '0.9375rem', fontWeight: 800, textAlign: 'right',
          letterSpacing: '-0.025em', color: 'text.primary',
          fontFeatureSettings: '"tnum" 1',
        }}
      >
        {product.list_price.toLocaleString()}원
      </Typography>
      <Typography
        sx={{
          fontSize: '0.75rem', color: 'text.secondary',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {product.notes || '-'}
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {product.is_popular && (
          <Chip label="인기" size="small" color="warning" sx={{ height: 20, fontSize: '0.6875rem', fontWeight: 700 }} />
        )}
        {product.is_new && (
          <Chip label="신상품" size="small" color="primary" sx={{ height: 20, fontSize: '0.6875rem', fontWeight: 700 }} />
        )}
        {product.is_discountable && (
          <Chip
            label="할인"
            size="small"
            sx={{ height: 20, fontSize: '0.6875rem', fontWeight: 700, bgcolor: alpha(theme.status.completed, 0.1), color: theme.status.completed }}
          />
        )}
        {!product.is_popular && !product.is_new && !product.is_discountable && (
          <Typography variant="caption" color="text.disabled">-</Typography>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', overflow: 'hidden' }}>
        {(product.tags || []).slice(0, 2).map((tag) => (
          <Chip
            key={tag}
            label={tag}
            size="small"
            variant="outlined"
            sx={{ height: 20, fontSize: '0.6875rem' }}
          />
        ))}
        {(product.tags || []).length > 2 && (
          <Tooltip title={product.tags.slice(2).join(', ')} arrow>
            <Chip label={`+${product.tags.length - 2}`} size="small" sx={{ height: 20, fontSize: '0.6875rem', cursor: 'pointer' }} />
          </Tooltip>
        )}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <RowIconButton
          tooltip={canEdit ? '편집' : '편집 권한 없음'}
          icon={<EditIcon sx={{ fontSize: 18 }} />}
          onClick={onEdit}
          disabled={!canEdit}
        />
      </Box>
    </Box>
  );
};

// ─── 상품 편집·추가 모달 ───────────────────────────────────────

const ProductEditDialog = ({ open, product, onClose, onSave, canEdit }) => {
  const theme = useTheme();
  const isEditing = Boolean(product?.id);
  const [form, setForm] = useState({
    name: '', product_code: '', category: '', sub_category: '',
    list_price: 0, notes: '', is_discountable: false, is_popular: false, is_new: false, tags: [],
  });

  React.useEffect(() => {
    if (open) {
      setForm(product || {
        name: '', product_code: '', category: '', sub_category: '',
        list_price: 0, notes: '', is_discountable: false, is_popular: false, is_new: false, tags: [],
      });
    }
  }, [open, product]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { borderRadius: `${theme.radii.lg}px`, maxWidth: 520, width: '100%' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25, pb: 1.5 }}>
        <Box
          sx={{
            width: 36, height: 36,
            borderRadius: `${theme.radii.sm}px`,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {isEditing ? <EditIcon sx={{ fontSize: 20, color: theme.palette.primary.main }} /> : <AddIcon sx={{ fontSize: 20, color: theme.palette.primary.main }} />}
        </Box>
        <Typography sx={{ fontSize: '1.125rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          {isEditing ? '상품 수정' : '새 상품 추가'}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pb: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="상품명" size="small" fullWidth
            value={form.name} onChange={(e) => setField('name', e.target.value)}
            InputLabelProps={{ shrink: true }} disabled={!canEdit}
          />
          <TextField
            label="상품 코드" size="small" fullWidth
            value={form.product_code} onChange={(e) => setField('product_code', e.target.value)}
            InputLabelProps={{ shrink: true }} disabled={!canEdit}
          />
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <FormControl size="small" fullWidth>
              <InputLabel shrink>카테고리</InputLabel>
              <Select
                label="카테고리"
                value={form.category}
                onChange={(e) => setField('category', e.target.value)}
                disabled={!canEdit}
              >
                {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField
              label="하위 카테고리" size="small" fullWidth
              value={form.sub_category || ''} onChange={(e) => setField('sub_category', e.target.value)}
              InputLabelProps={{ shrink: true }} disabled={!canEdit}
            />
          </Box>
          <TextField
            label="가격" size="small" type="number" fullWidth
            value={form.list_price} onChange={(e) => setField('list_price', Number(e.target.value) || 0)}
            InputLabelProps={{ shrink: true }} disabled={!canEdit}
          />
          <TextField
            label="비고" size="small" fullWidth multiline rows={2}
            value={form.notes || ''} onChange={(e) => setField('notes', e.target.value)}
            InputLabelProps={{ shrink: true }} disabled={!canEdit}
          />
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {[
              { key: 'is_discountable', label: '할인 가능' },
              { key: 'is_popular', label: '인기 상품' },
              { key: 'is_new', label: '신상품' },
            ].map(({ key, label }) => (
              <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Checkbox
                  size="small"
                  checked={Boolean(form[key])}
                  onChange={(e) => setField(key, e.target.checked)}
                  disabled={!canEdit}
                />
                <Typography sx={{ fontSize: '0.8125rem', color: 'text.primary' }}>{label}</Typography>
              </Box>
            ))}
          </Box>
          <Autocomplete
            multiple
            freeSolo
            size="small"
            options={TAGS_POOL}
            value={form.tags || []}
            onChange={(_, v) => setField('tags', v)}
            disabled={!canEdit}
            renderInput={(params) => <TextField {...params} label="태그" placeholder="태그 추가" InputLabelProps={{ shrink: true }} />}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ minHeight: 40, color: 'text.secondary' }}>취소</Button>
        {canEdit && (
          <Button variant="contained" onClick={() => onSave(form)} sx={{ minHeight: 40 }}>
            저장
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

// ─── 위험 액션 모달 ────────────────────────────────────────────

const DeleteSelectedDialog = ({ open, count, onClose, onConfirm }) => {
  const theme = useTheme();
  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx: { borderRadius: `${theme.radii.lg}px`, maxWidth: 420, width: '100%' } }}>
      <DialogTitle sx={{ pb: 1.5 }}>
        <Typography sx={{ fontSize: '1.125rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          선택 상품 삭제
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: '0.9375rem', mb: 0.5 }}>
          선택한 <strong style={{ fontFeatureSettings: '"tnum" 1' }}>{count}개</strong> 상품을 삭제합니다.
        </Typography>
        <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
          이 작업은 되돌릴 수 없습니다.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ minHeight: 40, color: 'text.secondary' }}>취소</Button>
        <Button
          variant="contained"
          color="error"
          onClick={onConfirm}
          startIcon={<DeleteIcon sx={{ fontSize: 16 }} />}
          sx={{ minHeight: 40 }}
        >
          삭제
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const DeleteAllConfirmDialog = ({ open, onClose, onConfirm }) => {
  const theme = useTheme();
  const [text, setText] = useState('');
  const match = text.trim() === DELETE_ALL_CONFIRM_TEXT;

  const handleClose = () => { setText(''); onClose(); };
  const handleConfirm = () => {
    if (!match) return;
    onConfirm();
    setText('');
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: {
          borderRadius: `${theme.radii.lg}px`,
          border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
          maxWidth: 480, width: '100%',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25, pb: 1.5 }}>
        <Box
          sx={{
            width: 36, height: 36,
            borderRadius: `${theme.radii.sm}px`,
            bgcolor: alpha(theme.palette.error.main, 0.1),
            border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <WarningIcon sx={{ fontSize: 20, color: theme.palette.error.main }} />
        </Box>
        <Typography sx={{ fontSize: '1.125rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'text.primary' }}>
          전체 상품 삭제
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pb: 2 }}>
        <Box
          sx={{
            p: 1.5, mb: 2,
            borderRadius: `${theme.radii.sm}px`,
            bgcolor: alpha(theme.palette.error.main, 0.05),
            border: `1px solid ${alpha(theme.palette.error.main, 0.15)}`,
          }}
        >
          <Typography sx={{ fontSize: '0.8125rem', color: theme.palette.error.dark, fontWeight: 600, lineHeight: 1.5 }}>
            등록된 <strong>모든 상품</strong>이 카탈로그에서 제거됩니다.
            이 작업은 <strong>되돌릴 수 없습니다.</strong>
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary', mb: 1 }}>
          계속하시려면 아래에 <strong style={{ color: theme.palette.error.main }}>&quot;{DELETE_ALL_CONFIRM_TEXT}&quot;</strong>를 정확히 입력하세요.
        </Typography>
        <TextField
          fullWidth size="small" autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={DELETE_ALL_CONFIRM_TEXT}
          InputProps={{ sx: { fontFeatureSettings: '"tnum" 1' } }}
          sx={{
            '& .MuiOutlinedInput-root': {
              ...(match && {
                '& fieldset': { borderColor: theme.palette.error.main, borderWidth: 2 },
              }),
            },
          }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={handleClose} sx={{ minHeight: 40, color: 'text.secondary' }}>취소</Button>
        <Button
          variant="contained" color="error" disabled={!match} onClick={handleConfirm}
          startIcon={<DeleteForeverIcon sx={{ fontSize: 16 }} />}
          sx={{ minHeight: 40 }}
        >
          전체 삭제
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── 일괄 편집 모달 (TriState + 태그 추가/덮어쓰기) ────────────

const BulkEditDialog = ({ open, count, onClose, onConfirm }) => {
  const theme = useTheme();
  const [isPopular, setIsPopular] = useState(null);
  const [isNew, setIsNew] = useState(null);
  const [tagsValue, setTagsValue] = useState([]);
  const [tagsMode, setTagsMode] = useState('append');

  const handleClose = () => {
    setIsPopular(null); setIsNew(null); setTagsValue([]); setTagsMode('append');
    onClose();
  };

  const handleConfirm = () => {
    onConfirm({ isPopular, isNew, tags: tagsValue, mode: tagsMode });
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} PaperProps={{ sx: { borderRadius: `${theme.radii.lg}px`, maxWidth: 440, width: '100%' } }}>
      <DialogTitle sx={{ pb: 1.5 }}>
        <Typography sx={{ fontSize: '1.125rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          선택 항목 편집
        </Typography>
        <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', fontWeight: 400, mt: 0.25 }}>
          선택한 {count}개 상품에 적용됩니다
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1.5 }}>
        <TriStateToggle label="인기 상품 (is_popular)" value={isPopular} onChange={setIsPopular} />
        <TriStateToggle label="신상품 (is_new)" value={isNew} onChange={setIsNew} />
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
            <Typography variant="caption" color="text.secondary">태그</Typography>
            <ToggleButtonGroup
              value={tagsMode}
              exclusive
              size="small"
              onChange={(_, v) => { if (v) setTagsMode(v); }}
            >
              <ToggleButton value="append" sx={{ px: 1.25, fontSize: '0.7rem' }}>추가</ToggleButton>
              <ToggleButton value="replace" sx={{ px: 1.25, fontSize: '0.7rem' }}>덮어쓰기</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Autocomplete
            multiple
            freeSolo
            size="small"
            options={TAGS_POOL}
            value={tagsValue}
            onChange={(_, v) => setTagsValue(v)}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                placeholder={tagsMode === 'append' ? '추가할 태그 입력' : '새 태그 목록 입력'}
              />
            )}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={handleClose} sx={{ minHeight: 40, color: 'text.secondary' }}>취소</Button>
        <Button variant="contained" onClick={handleConfirm} sx={{ minHeight: 40 }}>적용</Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── 엑셀 업로드 진행률 모달 ────────────────────────────────────

const UploadProgressDialog = ({ open, progress, onClose }) => {
  const theme = useTheme();
  const isDone = progress >= 100;
  return (
    <Dialog
      open={open}
      onClose={isDone ? onClose : undefined}
      PaperProps={{ sx: { borderRadius: `${theme.radii.lg}px`, maxWidth: 440, width: '100%' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25, pb: 1.5 }}>
        <Box
          sx={{
            width: 36, height: 36,
            borderRadius: `${theme.radii.sm}px`,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <UploadIcon sx={{ fontSize: 20, color: theme.palette.primary.main }} />
        </Box>
        <Typography sx={{ fontSize: '1.125rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          엑셀 업로드 {isDone ? '완료' : '중'}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pb: 2 }}>
        <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', mb: 1.5 }}>
          products_2026Q2.xlsx · 청크 {Math.min(4, Math.ceil(progress / 25))}/4 처리 중
        </Typography>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 8,
            borderRadius: `${theme.radii.sm}px`,
            bgcolor: theme.gray[100],
            '& .MuiLinearProgress-bar': { borderRadius: `${theme.radii.sm}px` },
          }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled' }}>
            {isDone ? '124행 / 124행 (오류 0건)' : `${Math.floor(progress * 1.24)}행 / 124행`}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'text.primary', fontFeatureSettings: '"tnum" 1' }}>
            {progress}%
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={!isDone} variant={isDone ? 'contained' : 'text'} sx={{ minHeight: 40 }}>
          {isDone ? '닫기' : '진행 중...'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── 메인 ──────────────────────────────────────────────────────

const ProductManagementPreview = () => {
  const theme = useTheme();

  // 권한 시뮬레이션 (시안용)
  const [canEdit, setCanEdit] = useState(true);

  // 필터·검색·페이징
  const [category, setCategory] = useState('');
  const [quickFilter, setQuickFilter] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(50);

  // 선택·모달
  const [selectedIds, setSelectedIds] = useState([]);
  const [editProduct, setEditProduct] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteSelectedOpen, setDeleteSelectedOpen] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  // 집계
  const totalCount = MOCK_PRODUCTS.length;
  const discountableCount = MOCK_PRODUCTS.filter(p => p.is_discountable).length;
  const popularCount = MOCK_PRODUCTS.filter(p => p.is_popular).length;
  const categoryCounts = useMemo(() => {
    const out = {};
    CATEGORIES.forEach(c => { out[c] = MOCK_PRODUCTS.filter(p => p.category === c).length; });
    return out;
  }, []);
  const availableTags = useMemo(
    () => Array.from(new Set(MOCK_PRODUCTS.flatMap(p => p.tags || []))).sort(),
    [],
  );

  // 필터링
  const filteredProducts = useMemo(() => {
    let list = MOCK_PRODUCTS;
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(s) || p.product_code.toLowerCase().includes(s));
    }
    if (category) list = list.filter(p => p.category === category);
    if (quickFilter === 'discountable') list = list.filter(p => p.is_discountable);
    if (quickFilter === 'popular') list = list.filter(p => p.is_popular);
    if (selectedTags.length > 0) list = list.filter(p => selectedTags.some(t => p.tags?.includes(t)));
    return list;
  }, [searchTerm, category, quickFilter, selectedTags]);

  const totalFiltered = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / perPage));
  const displayedProducts = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredProducts.slice(start, start + perPage);
  }, [filteredProducts, currentPage, perPage]);

  const allPageSelected = displayedProducts.length > 0 && displayedProducts.every(p => selectedIds.includes(p.id));
  const somePageSelected = displayedProducts.some(p => selectedIds.includes(p.id)) && !allPageSelected;

  const hasFilters = Boolean(searchTerm || category || quickFilter || selectedTags.length > 0);
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (category) n += 1;
    if (quickFilter) n += 1;
    if (selectedTags.length > 0) n += 1;
    if (searchTerm) n += 1;
    return n;
  }, [category, quickFilter, selectedTags, searchTerm]);

  // 핸들러
  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds(prev => prev.filter(id => !displayedProducts.some(p => p.id === id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...displayedProducts.map(p => p.id)])));
    }
  };
  const toggleSelectOne = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleResetFilters = () => {
    setSearchTerm(''); setCategory(''); setQuickFilter(null); setSelectedTags([]); setCurrentPage(1);
  };

  const handleOpenEdit = (product) => {
    setEditProduct(product);
    setEditDialogOpen(true);
  };

  const handleSaveProduct = (form) => {
    setEditDialogOpen(false);
    setSnackbar({ open: true, message: `${form.name || '상품'} 저장됨 (mock)` });
  };

  const handleUploadStart = () => {
    setUploadProgress(0);
    setUploadDialogOpen(true);
    let tick = 0;
    const interval = setInterval(() => {
      tick += 1;
      const next = Math.min(100, tick * 20);
      setUploadProgress(next);
      if (next >= 100) clearInterval(interval);
    }, 400);
  };

  const handleUploadClose = () => {
    setUploadDialogOpen(false);
    if (uploadProgress >= 100) {
      setSnackbar({ open: true, message: '엑셀 업로드 완료 · 124행 처리 (오류 0건)' });
    }
  };

  const handleDeleteSelected = () => {
    setDeleteSelectedOpen(false);
    setSnackbar({ open: true, message: `${selectedIds.length}개 상품이 삭제되었습니다 (mock)` });
    setSelectedIds([]);
  };

  const handleDeleteAll = () => {
    setDeleteAllOpen(false);
    setSnackbar({ open: true, message: '전체 상품을 삭제했습니다 (mock)' });
    setSelectedIds([]);
  };

  const handleBulkApply = ({ isPopular, isNew, tags, mode }) => {
    const parts = [];
    if (isPopular !== null) parts.push(`인기=${isPopular ? 'ON' : 'OFF'}`);
    if (isNew !== null) parts.push(`신상품=${isNew ? 'ON' : 'OFF'}`);
    if (tags.length > 0) parts.push(`태그(${mode === 'append' ? '추가' : '덮어쓰기'})=${tags.join(', ')}`);
    const summary = parts.length > 0 ? ` · ${parts.join(' / ')}` : '';
    setSnackbar({ open: true, message: `${selectedIds.length}개 상품 일괄 수정${summary} (mock)` });
    setSelectedIds([]);
  };

  return (
    <PreviewShell activePath="/admin/products">
      <PageHeader
        title="상품 관리"
        subtitle={`총 ${totalCount}개 · 도서 ${categoryCounts['도서']} · 검사 ${categoryCounts['검사']} · 도구 ${categoryCounts['도구']}`}
        icon={Inventory2Icon}
        action={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* 권한 시뮬레이션 토글 (시안 전용) */}
            <Tooltip title="권한 시뮬레이션 (시안 전용)">
              <Box
                onClick={() => setCanEdit(prev => !prev)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5,
                  px: 1, py: 0.5, mr: 0.5,
                  borderRadius: `${theme.radii.sm}px`,
                  border: `1px dashed ${theme.gray[300]}`,
                  cursor: 'pointer',
                  fontSize: '0.6875rem',
                  color: canEdit ? theme.palette.primary.main : 'text.disabled',
                  fontWeight: 700,
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase',
                  '&:hover': { bgcolor: theme.gray[50] },
                }}
              >
                {canEdit ? <></> : <LockIcon sx={{ fontSize: 12, mr: 0.25 }} />}
                {canEdit ? 'master' : 'viewer'}
              </Box>
            </Tooltip>
            <Tooltip title="엑셀 양식 다운로드">
              <IconButton
                size="small"
                onClick={() => setSnackbar({ open: true, message: '엑셀 양식 다운로드 (mock)' })}
                sx={{
                  width: 36, height: 36,
                  borderRadius: `${theme.radii.sm}px`,
                  border: `1px solid ${theme.gray[200]}`,
                  bgcolor: alpha(theme.status.paid, 0.06),
                  color: theme.status.paid,
                }}
              >
                <DescriptionIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="상품 목록 엑셀 다운로드">
              <IconButton
                size="small"
                onClick={() => setSnackbar({ open: true, message: '상품 목록을 다운로드했습니다 (mock)' })}
                sx={{
                  width: 36, height: 36,
                  borderRadius: `${theme.radii.sm}px`,
                  border: `1px solid ${theme.gray[200]}`,
                  bgcolor: alpha(theme.status.completed, 0.06),
                  color: theme.status.completed,
                }}
              >
                <DownloadIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            {canEdit && (
              <>
                <Tooltip title="엑셀 업로드 (product_code 기준 upsert)">
                  <IconButton
                    size="small"
                    onClick={handleUploadStart}
                    sx={{
                      width: 36, height: 36,
                      borderRadius: `${theme.radii.sm}px`,
                      border: `1px solid ${theme.gray[200]}`,
                      bgcolor: alpha(theme.accent.warning, 0.08),
                      color: theme.accent.warning,
                    }}
                  >
                    <UploadIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="전체 삭제">
                  <IconButton
                    size="small"
                    onClick={() => setDeleteAllOpen(true)}
                    sx={{
                      width: 36, height: 36,
                      borderRadius: `${theme.radii.sm}px`,
                      border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
                      bgcolor: alpha(theme.palette.error.main, 0.06),
                      color: theme.palette.error.main,
                    }}
                  >
                    <DeleteForeverIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                  onClick={() => handleOpenEdit(null)}
                  sx={{ minHeight: 36 }}
                >
                  상품 추가
                </Button>
              </>
            )}
          </Box>
        }
      />

      {/* ─── 빠른 필터 카드 (전체/할인/인기 + 카테고리 3종) ─── */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
        <QuickFilterCard
          label="전체 상품"
          value={totalCount}
          icon={InventoryIcon}
          color="primary"
          active={!quickFilter && !category}
          onClick={() => { setQuickFilter(null); setCategory(''); }}
        />
        <QuickFilterCard
          label="할인 가능"
          value={discountableCount}
          icon={TagIcon}
          color="success"
          active={quickFilter === 'discountable'}
          onClick={() => setQuickFilter(prev => prev === 'discountable' ? null : 'discountable')}
        />
        <QuickFilterCard
          label="인기 상품"
          value={popularCount}
          icon={TrendingUpIcon}
          color="warning"
          active={quickFilter === 'popular'}
          onClick={() => setQuickFilter(prev => prev === 'popular' ? null : 'popular')}
        />
        {CATEGORIES.map(cat => {
          const meta = CATEGORY_META[cat];
          return (
            <QuickFilterCard
              key={cat}
              label={cat}
              value={categoryCounts[cat]}
              icon={meta.icon}
              color={meta.color}
              active={category === cat}
              onClick={() => setCategory(prev => prev === cat ? '' : cat)}
            />
          );
        })}
      </Box>

      {/* ─── 검색 + 태그 필터 ─── */}
      <SectionCard sx={{ mb: 3 }} padding={20}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <FilterListIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 800, color: 'text.primary', letterSpacing: '-0.01em' }}>
            필터
          </Typography>
          {activeFilterCount > 0 && (
            <Chip
              label={activeFilterCount}
              size="small"
              sx={{ height: 18, fontSize: '0.6875rem', fontWeight: 800, bgcolor: theme.palette.primary.main, color: '#fff' }}
            />
          )}
          {hasFilters && (
            <Button
              size="small"
              variant="text"
              startIcon={<RestartAltIcon sx={{ fontSize: 16 }} />}
              onClick={handleResetFilters}
              sx={{ ml: 'auto', minHeight: 32, color: 'text.secondary' }}
            >
              초기화
            </Button>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', mb: availableTags.length > 0 ? 1.5 : 0 }}>
          <TextField
            size="small"
            placeholder="상품명·코드 검색"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            InputProps={{
              startAdornment: <SearchIcon sx={{ fontSize: 18, color: 'text.disabled', mr: 0.75 }} />,
            }}
            sx={{ flex: '1 1 240px', minWidth: 240 }}
          />
          {hasFilters && (
            <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
              {totalFiltered}개 표시 중
            </Typography>
          )}
        </Box>

        {availableTags.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 700, mr: 0.5 }}>
              태그
            </Typography>
            {availableTags.map(tag => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                variant={selectedTags.includes(tag) ? 'filled' : 'outlined'}
                color={selectedTags.includes(tag) ? 'primary' : 'default'}
                onClick={() => {
                  setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
                  setCurrentPage(1);
                }}
                sx={{
                  paddingX: 1,
                  fontWeight: selectedTags.includes(tag) ? 700 : 500,
                  cursor: 'pointer',
                }}
              />
            ))}
          </Box>
        )}
      </SectionCard>

      {/* ─── 일괄 액션 바 (선택 있을 때만) ─── */}
      {selectedIds.length > 0 && canEdit && (
        <SectionCard
          padding={0}
          sx={{
            mb: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.03),
          }}
        >
          <Box
            sx={{
              px: 2.5, py: 1.5,
              display: 'flex', alignItems: 'center', gap: 1.5,
              flexWrap: 'wrap',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                sx={{
                  fontSize: '0.9375rem', fontWeight: 800,
                  color: theme.palette.primary.main, letterSpacing: '-0.015em',
                  fontFeatureSettings: '"tnum" 1',
                }}
              >
                {selectedIds.length}개 선택됨
              </Typography>
              <Button
                size="small"
                variant="text"
                onClick={() => setSelectedIds([])}
                sx={{ color: 'text.secondary', minHeight: 36 }}
              >
                해제
              </Button>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, ml: 1 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<TuneIcon sx={{ fontSize: 16 }} />}
                onClick={() => setBulkEditOpen(true)}
                sx={{ minHeight: 36 }}
              >
                선택 항목 편집
              </Button>
            </Box>

            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 1, height: 24, bgcolor: theme.gray[200] }} />
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon sx={{ fontSize: 16 }} />}
                onClick={() => setDeleteSelectedOpen(true)}
                sx={{
                  minHeight: 36,
                  borderColor: alpha(theme.palette.error.main, 0.4),
                  '&:hover': {
                    bgcolor: alpha(theme.palette.error.main, 0.06),
                    borderColor: theme.palette.error.main,
                  },
                }}
              >
                선택 삭제
              </Button>
            </Box>
          </Box>
        </SectionCard>
      )}

      {/* ─── 상품 테이블 ─── */}
      <SectionCard padding={0}>
        {/* Toolbar */}
        <Box
          sx={{
            px: 2, py: 1.5,
            display: 'flex', alignItems: 'center', gap: 2,
            borderBottom: `1px solid ${theme.gray[100]}`,
            minHeight: 56,
          }}
        >
          <Checkbox
            size="small"
            checked={allPageSelected}
            indeterminate={somePageSelected}
            onChange={toggleSelectAll}
            disabled={!canEdit}
            sx={{ p: 0, ml: 0.5 }}
          />
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
              <Box component="span" sx={{ fontWeight: 800, color: 'text.primary', fontFeatureSettings: '"tnum" 1' }}>
                {totalFiltered}
              </Box>
              개 상품
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled' }}>
              · 인기순 → 이름순
            </Typography>
          </Box>
        </Box>

        {/* Header */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '44px minmax(180px, 2fr) 80px 120px 130px 100px minmax(120px, 1.2fr) 60px',
            alignItems: 'center',
            gap: 1.5,
            px: 2,
            py: 1,
            borderBottom: `1px solid ${theme.gray[200]}`,
            bgcolor: theme.gray[50],
            '& > *': {
              fontSize: '0.6875rem', fontWeight: 700, color: 'text.secondary',
              letterSpacing: '0.03em', textTransform: 'uppercase',
            },
          }}
        >
          <span />
          <span>상품명 · 코드</span>
          <span>카테고리</span>
          <span style={{ textAlign: 'right' }}>가격</span>
          <span>비고</span>
          <span>상태</span>
          <span>태그</span>
          <span style={{ textAlign: 'right' }}>작업</span>
        </Box>

        {/* Rows */}
        <Box>
          {displayedProducts.length === 0 ? (
            <Box sx={{ py: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, color: 'text.disabled' }}>
              <InventoryIcon sx={{ fontSize: 48 }} />
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700 }}>
                {hasFilters ? '검색 결과가 없습니다' : '등록된 상품이 없습니다'}
              </Typography>
              {hasFilters && (
                <Button size="small" variant="outlined" startIcon={<RestartAltIcon sx={{ fontSize: 16 }} />} onClick={handleResetFilters}>
                  필터 초기화
                </Button>
              )}
            </Box>
          ) : (
            displayedProducts.map(product => (
              <ProductRow
                key={product.id}
                product={product}
                selected={selectedIds.includes(product.id)}
                onSelectToggle={() => toggleSelectOne(product.id)}
                onEdit={() => handleOpenEdit(product)}
                canEdit={canEdit}
              />
            ))
          )}
        </Box>

        {/* Footer — 페이지당 항목 수 + 페이징 */}
        {displayedProducts.length > 0 && (
          <Box
            sx={{
              px: 2, py: 1.5,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderTop: `1px solid ${theme.gray[100]}`,
              gap: 2,
              flexWrap: 'wrap',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>페이지당</InputLabel>
                <Select
                  value={perPage}
                  label="페이지당"
                  onChange={(e) => { setPerPage(Number(e.target.value)); setCurrentPage(1); }}
                >
                  {[10, 25, 50, 100].map(n => <MenuItem key={n} value={n}>{n}개</MenuItem>)}
                </Select>
              </FormControl>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', fontFeatureSettings: '"tnum" 1' }}>
                {(currentPage - 1) * perPage + 1}-{Math.min(currentPage * perPage, totalFiltered)} / {totalFiltered}개
              </Typography>
            </Box>
            <Pagination
              count={totalPages}
              page={currentPage}
              onChange={(_, p) => setCurrentPage(p)}
              color="primary"
              size="small"
              showFirstButton
              showLastButton
            />
          </Box>
        )}
      </SectionCard>

      {/* ─── 모달들 ─── */}
      <ProductEditDialog
        open={editDialogOpen}
        product={editProduct}
        canEdit={canEdit}
        onClose={() => setEditDialogOpen(false)}
        onSave={handleSaveProduct}
      />

      <DeleteSelectedDialog
        open={deleteSelectedOpen}
        count={selectedIds.length}
        onClose={() => setDeleteSelectedOpen(false)}
        onConfirm={handleDeleteSelected}
      />

      <DeleteAllConfirmDialog
        open={deleteAllOpen}
        onClose={() => setDeleteAllOpen(false)}
        onConfirm={handleDeleteAll}
      />

      <BulkEditDialog
        open={bulkEditOpen}
        count={selectedIds.length}
        onClose={() => setBulkEditOpen(false)}
        onConfirm={handleBulkApply}
      />

      <UploadProgressDialog
        open={uploadDialogOpen}
        progress={uploadProgress}
        onClose={handleUploadClose}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
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

export default ProductManagementPreview;
