import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, Checkbox, OutlinedInput, ListItemText, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, LinearProgress,
  Snackbar, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Inventory2 as Inventory2Icon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  FileUpload as UploadIcon,
  Add as AddIcon,
  Edit as EditIcon,
  ContentCopy as DuplicateIcon,
  DeleteForever as DeleteForeverIcon,
  ToggleOn as ToggleOnIcon,
  LocalOffer as TagIcon,
  Close as CloseIcon,
  WarningAmberRounded as WarningIcon,
} from '@mui/icons-material';
import { PageHeader, SectionCard, StatusChip } from './ui';
import PreviewShell from './preview/PreviewShell';

/**
 * DEV-ONLY keystone: /preview/products.
 * 어드민 상품 관리 디자인 시안 — 채택안(OrderManagementPreview) 톤 + FulfillmentPreview 패턴.
 * 위험 액션(전체 삭제) = 받아쓰기 모달, 일괄 액션 바, 엑셀 업로드 진행률.
 * 실제 로직은 ProductManagementPage.jsx 참고 (코드 복제 X, 구조 차용 O).
 */

// ─── Mock 데이터 ───────────────────────────────────────────────

const CATEGORIES = [
  { key: 'all',  label: '전체' },
  { key: 'book', label: '도서' },
  { key: 'test', label: '검사' },
];

const SUB_CATEGORIES = [
  '아동·청소년', '성인', '임상', '상담', '교육', '연구',
];

const STATUS_TOGGLES = [
  { key: 'all',      label: '전체' },
  { key: 'active',   label: '활성' },
  { key: 'inactive', label: '비활성' },
];

// 12개 (도서 8 / 검사 4)
const MOCK_PRODUCTS = [
  { id: 1,  code: 'BK-1041', name: '아동·청소년 임상총서 (전 4권)', category: 'book', sub: '아동·청소년', price: 178000, stock: 24,  status: 'active' },
  { id: 2,  code: 'BK-1058', name: '심리치료의 기초', category: 'book', sub: '임상', price: 32000, stock: 56,  status: 'active' },
  { id: 3,  code: 'BK-1062', name: '임상심리평가 핸드북', category: 'book', sub: '임상', price: 48000, stock: 12,  status: 'active' },
  { id: 4,  code: 'BK-1075', name: '상담심리학 개론 (제3판)', category: 'book', sub: '상담', price: 38000, stock: 0,   status: 'inactive' },
  { id: 5,  code: 'BK-1081', name: '발달심리학 워크북', category: 'book', sub: '아동·청소년', price: 28000, stock: 42,  status: 'active' },
  { id: 6,  code: 'BK-1094', name: '심리평가 사례집', category: 'book', sub: '임상', price: 52000, stock: 8,   status: 'active' },
  { id: 7,  code: 'BK-1102', name: '인지행동치료 매뉴얼', category: 'book', sub: '임상', price: 44000, stock: 31,  status: 'active' },
  { id: 8,  code: 'BK-1118', name: '교육심리 측정과 평가', category: 'book', sub: '교육', price: 36000, stock: 0,   status: 'inactive' },
  { id: 9,  code: 'TS-2014', name: 'MMPI-2 검사지 (50매)', category: 'test', sub: '성인', price: 89000, stock: 18,  status: 'active' },
  { id: 10, code: 'TS-2027', name: 'K-WAIS-IV 채점판', category: 'test', sub: '성인', price: 142000, stock: 6,   status: 'active' },
  { id: 11, code: 'TS-2033', name: 'CBCL 6-18 채점판', category: 'test', sub: '아동·청소년', price: 78000, stock: 22,  status: 'active' },
  { id: 12, code: 'TS-2048', name: 'BGT-2 도구 세트', category: 'test', sub: '임상', price: 156000, stock: 4,   status: 'active' },
];

const DELETE_ALL_CONFIRM_TEXT = '전체삭제';

// ─── 헬퍼 컴포넌트 ─────────────────────────────────────────────

const RowIconButton = ({ tooltip, icon, onClick, danger = false }) => {
  const theme = useTheme();
  return (
    <Tooltip title={tooltip} placement="top" arrow>
      <IconButton
        size="small"
        onClick={onClick}
        sx={{
          width: 40, height: 40,
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
        }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
};

const CategoryChip = ({ category }) => {
  const theme = useTheme();
  const isBook = category === 'book';
  const color = isBook ? theme.palette.primary.main : theme.palette.secondary?.main || theme.gray[700];
  const label = isBook ? '도서' : '검사';
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 0.875,
        py: 0.25,
        borderRadius: `${theme.radii.sm}px`,
        bgcolor: alpha(color, 0.08),
        border: `1px solid ${alpha(color, 0.2)}`,
        fontSize: '0.6875rem',
        fontWeight: 700,
        letterSpacing: '-0.01em',
        color,
        lineHeight: 1.4,
      }}
    >
      {label}
    </Box>
  );
};

const ProductRow = ({ product, selected, onSelectToggle, onEdit, onDuplicate, onDelete }) => {
  const theme = useTheme();
  const isLowStock = product.stock > 0 && product.stock <= 10;
  const isOutOfStock = product.stock === 0;
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '44px 60px minmax(180px, 2fr) 120px 110px 90px 140px',
        alignItems: 'center',
        gap: 2,
        px: 2,
        minHeight: 56,
        bgcolor: selected ? alpha(theme.palette.primary.main, 0.04) : 'transparent',
        borderBottom: `1px solid ${theme.gray[100]}`,
        transition: `background-color 0.15s ${theme.easing.toss}`,
        '&:hover': { bgcolor: selected ? alpha(theme.palette.primary.main, 0.06) : theme.gray[50] },
      }}
    >
      <Box onClick={(e) => { e.stopPropagation(); onSelectToggle(); }} sx={{ display: 'flex', alignItems: 'center', height: 44 }}>
        <Checkbox checked={selected} size="small" sx={{ p: 0 }} />
      </Box>
      <Box>
        <CategoryChip category={product.category} />
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
            {product.code}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled' }}>·</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled' }}>{product.sub}</Typography>
        </Box>
      </Box>
      <Typography
        sx={{
          fontSize: '0.9375rem', fontWeight: 800, textAlign: 'right',
          letterSpacing: '-0.025em', color: 'text.primary',
          fontFeatureSettings: '"tnum" 1',
        }}
      >
        {product.price.toLocaleString()}원
      </Typography>
      <Typography
        sx={{
          fontSize: '0.875rem', fontWeight: 700, textAlign: 'right',
          fontFeatureSettings: '"tnum" 1',
          color: isOutOfStock ? theme.palette.error.main : isLowStock ? theme.palette.warning.main : 'text.primary',
        }}
      >
        {product.stock}개
      </Typography>
      <Box>
        <StatusChip
          status={product.status === 'active' ? 'paid' : 'cancelled'}
          size="sm"
        />
      </Box>
      <Box sx={{ display: 'flex', gap: 0.75, justifyContent: 'flex-end' }}>
        <RowIconButton tooltip="수정" icon={<EditIcon sx={{ fontSize: 18 }} />} onClick={onEdit} />
        <RowIconButton tooltip="복제" icon={<DuplicateIcon sx={{ fontSize: 18 }} />} onClick={onDuplicate} />
        <RowIconButton tooltip="삭제" icon={<DeleteForeverIcon sx={{ fontSize: 18 }} />} onClick={onDelete} danger />
      </Box>
    </Box>
  );
};

// ─── 위험 액션 모달 ────────────────────────────────────────────

const DeleteAllConfirmDialog = ({ open, count, onClose, onConfirm }) => {
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
          maxWidth: 480,
          width: '100%',
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
          선택 상품 전체 삭제
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
            선택한 <strong style={{ fontFeatureSettings: '"tnum" 1' }}>{count}개</strong>의 상품이 카탈로그에서 제거됩니다.
            이 작업은 <strong>되돌릴 수 없습니다.</strong>
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary', mb: 1 }}>
          진행하시려면 아래에 <strong style={{ color: theme.palette.error.main }}>"{DELETE_ALL_CONFIRM_TEXT}"</strong> 를 정확히 입력하세요.
        </Typography>
        <TextField
          fullWidth
          size="small"
          autoFocus
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
        <Button onClick={handleClose} sx={{ minHeight: 40, color: 'text.secondary' }}>
          취소
        </Button>
        <Button
          variant="contained"
          color="error"
          disabled={!match}
          onClick={handleConfirm}
          startIcon={<DeleteForeverIcon sx={{ fontSize: 16 }} />}
          sx={{ minHeight: 40 }}
        >
          전체 삭제
        </Button>
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
          products_2026Q2.xlsx · 청크 {Math.ceil(progress / 25)}/4 처리 중
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
  const [category, setCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSubs, setSelectedSubs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (category !== 'all') n += 1;
    if (statusFilter !== 'all') n += 1;
    if (selectedSubs.length > 0) n += 1;
    if (searchTerm) n += 1;
    return n;
  }, [category, statusFilter, selectedSubs, searchTerm]);

  const totalCount = MOCK_PRODUCTS.length;
  const bookCount = MOCK_PRODUCTS.filter(p => p.category === 'book').length;
  const testCount = MOCK_PRODUCTS.filter(p => p.category === 'test').length;

  const allSelected = selectedIds.length === MOCK_PRODUCTS.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : MOCK_PRODUCTS.map(p => p.id));
  const toggleSelectOne = (id) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

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

  const handleBulkDelete = () => {
    setDeleteDialogOpen(false);
    setSnackbar({ open: true, message: `${selectedIds.length}개 상품이 삭제되었습니다` });
    setSelectedIds([]);
  };

  const handleBulkToggleActive = () => {
    setSnackbar({ open: true, message: `${selectedIds.length}개 상품 활성 상태가 토글되었습니다` });
  };

  const handleBulkPrice = () => {
    setSnackbar({ open: true, message: `${selectedIds.length}개 상품 가격 일괄 수정 모달 (mock)` });
  };

  return (
    <PreviewShell activePath="/admin/products">
      <PageHeader
        title="상품 관리"
        subtitle={`총 ${totalCount}개 · 도서 ${bookCount} · 검사 ${testCount}`}
        icon={Inventory2Icon}
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<UploadIcon sx={{ fontSize: 16 }} />}
              onClick={handleUploadStart}
              sx={{ minHeight: 36 }}
            >
              엑셀 업로드
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon sx={{ fontSize: 16 }} />}
              sx={{ minHeight: 36 }}
            >
              신규 상품 등록
            </Button>
          </Box>
        }
      />

      {/* ─── 필터 영역 ─── */}
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
        </Box>

        {/* Row 1 — 카테고리 토글 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 700, mr: 0.5 }}>
            카테고리
          </Typography>
          {CATEGORIES.map(({ key, label }) => (
            <Chip
              key={key}
              label={label}
              size="small"
              variant={category === key ? 'filled' : 'outlined'}
              color={category === key ? 'primary' : 'default'}
              onClick={() => setCategory(key)}
              sx={{ paddingX: 1.5, fontWeight: category === key ? 700 : 500, cursor: 'pointer' }}
            />
          ))}
          <Box sx={{ width: 1, height: 20, bgcolor: theme.gray[200], mx: 1 }} />
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 700, mr: 0.5 }}>
            상태
          </Typography>
          {STATUS_TOGGLES.map(({ key, label }) => (
            <Chip
              key={key}
              label={label}
              size="small"
              variant={statusFilter === key ? 'filled' : 'outlined'}
              color={statusFilter === key ? 'primary' : 'default'}
              onClick={() => setStatusFilter(key)}
              sx={{ paddingX: 1.5, fontWeight: statusFilter === key ? 700 : 500, cursor: 'pointer' }}
            />
          ))}
        </Box>

        {/* Row 2 — 하위 카테고리 멀티 + 검색 */}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 200, flex: '0 1 240px' }}>
            <InputLabel>하위 카테고리</InputLabel>
            <Select
              multiple
              value={selectedSubs}
              label="하위 카테고리"
              input={<OutlinedInput label="하위 카테고리" />}
              onChange={(e) => setSelectedSubs(e.target.value)}
              renderValue={(sel) =>
                sel.length === 0
                  ? '전체'
                  : sel.length === 1
                    ? sel[0]
                    : `${sel.length}개 선택`
              }
            >
              {SUB_CATEGORIES.map(sub => (
                <MenuItem key={sub} value={sub}>
                  <Checkbox checked={selectedSubs.includes(sub)} size="small" />
                  <ListItemText primary={sub} primaryTypographyProps={{ variant: 'body2' }} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            placeholder="상품명·코드 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ fontSize: 18, color: 'text.disabled', mr: 0.75 }} />,
            }}
            sx={{ flex: '1 1 220px', minWidth: 220 }}
          />
        </Box>
      </SectionCard>

      {/* ─── 일괄 액션 바 (선택 있을 때만) ─── */}
      {selectedIds.length > 0 && (
        <SectionCard
          padding={0}
          sx={{
            mb: 2,
            borderLeft: `3px solid ${theme.palette.primary.main}`,
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
                startIcon={<ToggleOnIcon sx={{ fontSize: 18 }} />}
                onClick={handleBulkToggleActive}
                sx={{ minHeight: 36 }}
              >
                활성 토글
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<TagIcon sx={{ fontSize: 16 }} />}
                onClick={handleBulkPrice}
                sx={{ minHeight: 36 }}
              >
                가격 일괄 수정
              </Button>
            </Box>

            {/* 위험 액션 — 우측 끝 분리 */}
            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 1, height: 24, bgcolor: theme.gray[200] }} />
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<DeleteForeverIcon sx={{ fontSize: 16 }} />}
                onClick={() => setDeleteDialogOpen(true)}
                sx={{
                  minHeight: 36,
                  borderColor: alpha(theme.palette.error.main, 0.4),
                  '&:hover': {
                    bgcolor: alpha(theme.palette.error.main, 0.06),
                    borderColor: theme.palette.error.main,
                  },
                }}
              >
                선택 전체 삭제
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
            checked={allSelected}
            indeterminate={someSelected}
            onChange={toggleSelectAll}
            sx={{ p: 0, ml: 0.5 }}
          />
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
              <Box component="span" sx={{ fontWeight: 800, color: 'text.primary', fontFeatureSettings: '"tnum" 1' }}>
                {totalCount}
              </Box>
              개 상품
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled' }}>
              · 코드순
            </Typography>
          </Box>
        </Box>

        {/* Header */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '44px 60px minmax(180px, 2fr) 120px 110px 90px 140px',
            alignItems: 'center',
            gap: 2,
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
          <span>분류</span>
          <span>상품명 · 코드</span>
          <span style={{ textAlign: 'right' }}>가격</span>
          <span style={{ textAlign: 'right' }}>재고</span>
          <span>상태</span>
          <span style={{ textAlign: 'right' }}>액션</span>
        </Box>

        {/* Rows */}
        <Box>
          {MOCK_PRODUCTS.map(product => (
            <ProductRow
              key={product.id}
              product={product}
              selected={selectedIds.includes(product.id)}
              onSelectToggle={() => toggleSelectOne(product.id)}
              onEdit={() => setSnackbar({ open: true, message: `${product.name} 편집 모달 (mock)` })}
              onDuplicate={() => setSnackbar({ open: true, message: `${product.name} 복제됨` })}
              onDelete={() => setSnackbar({ open: true, message: `${product.name} 삭제 확인 (mock)` })}
            />
          ))}
        </Box>

        {/* Footer */}
        <Box
          sx={{
            px: 2, py: 1.5,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderTop: `1px solid ${theme.gray[100]}`,
          }}
        >
          <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled' }}>
            1-{totalCount} / 총 {totalCount}개
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', fontFeatureSettings: '"tnum" 1' }}>
            최종 수정: 2026-04-18 14:32
          </Typography>
        </Box>
      </SectionCard>

      <DeleteAllConfirmDialog
        open={deleteDialogOpen}
        count={selectedIds.length}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleBulkDelete}
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
