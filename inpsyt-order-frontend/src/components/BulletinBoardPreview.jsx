import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, IconButton, Snackbar, useTheme, Divider, Fab, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Checkbox, FormControlLabel,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer, Alert,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Announcement as AnnouncementIcon,
  PushPin as PushPinIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon,
  ArrowBack as ArrowBackIcon,
  WarningAmberRounded as WarningIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { PageHeader, SectionCard, ActionSlot, EmptyState } from './ui';
import PreviewShell from './preview/PreviewShell';

/**
 * DEV-ONLY keystone: /preview/bulletins.
 * 어드민 게시판 디자인 시안 — 실 BulletinBoardPage.jsx 사양 1:1 반영.
 * 사양 시트: design-system/specs/A7_BulletinBoardPage.md
 *
 * 핵심 발견 반영(사양 시트 §핵심 발견):
 *  1. 권한 매트릭스(bulletins:manage) vs 코드(master only) 불일치 — 시안은 코드 기준
 *  2. 본인 기준 안 읽음 닷 — 좌측 카드에 표시
 *  3. 카테고리 3색은 페이지 인라인 그대로(매뉴얼/패치노트/공지사항)
 *     별도 토큰 승격은 별도 사이클 — 시안에서는 페이지 인라인을 따라간다(D17 후속)
 *  4. SimpleMarkdown 본문 — mock 텍스트로 표시
 *  5. 읽음 처리 silent — 시안에서는 토스트 없음
 *  6. 데스크탑 좌(380)+우(flex) 동시 / 모바일은 단일 패널
 */

// 사양 §카테고리 필터 탭 line 26-30: 매뉴얼/패치노트/공지사항 색은 페이지 인라인 hex.
// 시안은 페이지 코드를 따라간다(D17 후속 토큰화 별도).
const BULLETIN_CATEGORY = {
  manual:     { label: '매뉴얼',     color: '#3B82F6' },
  patch_note: { label: '패치노트',   color: '#8B5CF6' },
  notice:     { label: '공지사항',   color: '#F59E0B' },
};

const ME_ID = 'u-001'; // master 가정

const MOCK_BULLETINS = [
  {
    id: 'b-001',
    title: '학회 부스 운영 매뉴얼 v2.4',
    content: '## 학회 부스 운영 매뉴얼\n\n- 결제 단말기 위치 확인\n- 출고용 박스 사전 준비\n- 알림톡 발송 확인은 1차 결제 후 5분 이내\n\n자세한 내용은 첨부 위키 참조.',
    category: 'manual',
    author_name: '김건우',
    author_id: 'u-001',
    is_pinned: true,
    created_at: '2026-05-20T09:00:00',
    updated_at: '2026-05-22T14:30:00',
  },
  {
    id: 'b-002',
    title: '2026 봄 학회 공지 — 부스 위치 변경',
    content: '부스 위치가 A-12 에서 **B-08** 로 변경되었습니다. 학회 첫날 오전 8시까지 집결 부탁드립니다.',
    category: 'notice',
    author_name: '김건우',
    author_id: 'u-001',
    is_pinned: true,
    created_at: '2026-05-25T11:20:00',
    updated_at: '2026-05-25T11:20:00',
  },
  {
    id: 'b-003',
    title: '패치 v2.4.1 — 출고 일괄 처리 안정화',
    content: '### v2.4.1 패치 노트\n\n- 출고 일괄 처리 시 간헐적 오류 수정\n- 알림톡 발송 retry 정책 보완\n- 상품 검색 속도 개선',
    category: 'patch_note',
    author_name: '이수정',
    author_id: 'u-002',
    is_pinned: false,
    created_at: '2026-05-27T18:00:00',
    updated_at: '2026-05-27T18:00:00',
  },
  {
    id: 'b-004',
    title: '결제 단말기 사용 절차',
    content: '1. 단말기 전원 켜기\n2. 카드 거치\n3. 결제 금액 입력\n4. 영수증 출력 옵션 선택',
    category: 'manual',
    author_name: '김건우',
    author_id: 'u-001',
    is_pinned: false,
    created_at: '2026-05-18T16:45:00',
    updated_at: '2026-05-18T16:45:00',
  },
  {
    id: 'b-005',
    title: '학회 직후 정산 체크리스트',
    content: '- 출고 완료 처리 확인\n- 미결제 주문 follow-up\n- 알림톡 발송 누락 케이스 점검',
    category: 'notice',
    author_name: '김건우',
    author_id: 'u-001',
    is_pinned: false,
    created_at: '2026-05-15T10:00:00',
    updated_at: '2026-05-15T10:00:00',
  },
  {
    id: 'b-006',
    title: '패치 v2.4.0 — 새 디자인 시스템 도입',
    content: '디자인 시스템 D17 합성 컴포넌트 6종 적용. StatusBadge·InfoRow·PriceBlock·ActionSlot·EmptyState·SectionCard.',
    category: 'patch_note',
    author_name: '이수정',
    author_id: 'u-002',
    is_pinned: false,
    created_at: '2026-05-10T13:15:00',
    updated_at: '2026-05-10T13:15:00',
  },
];

// 본인 기준 안 읽음 (사양 §발견 2)
const INITIAL_READ_IDS = new Set(['b-001', 'b-004', 'b-005']);

// ─── 헬퍼 ──────────────────────────────────────────────────────

const formatDate = (iso) => {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
};
const formatDateTime = (iso) => {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const CategoryChip = ({ category, size = 'sm' }) => {
  const theme = useTheme();
  const meta = BULLETIN_CATEGORY[category];
  if (!meta) return null;
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: size === 'sm' ? 0.75 : 1,
        py: 0.25,
        borderRadius: `${theme.radii.sm}px`,
        bgcolor: alpha(meta.color, 0.1),
        border: `1px solid ${alpha(meta.color, 0.25)}`,
      }}
    >
      <Typography variant="caption" sx={{ color: meta.color, fontWeight: 700, lineHeight: 1 }}>
        {meta.label}
      </Typography>
    </Box>
  );
};

const PinnedChip = () => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.25,
        px: 0.75,
        py: 0.25,
        borderRadius: `${theme.radii.sm}px`,
        bgcolor: alpha(theme.palette.error.main, 0.1),
        border: `1px solid ${alpha(theme.palette.error.main, 0.25)}`,
      }}
    >
      <PushPinIcon sx={{ fontSize: 12, color: theme.palette.error.main }} />
      <Typography variant="caption" sx={{ color: theme.palette.error.main, fontWeight: 700, lineHeight: 1 }}>
        고정
      </Typography>
    </Box>
  );
};

const UnreadDot = () => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        width: 8, height: 8,
        borderRadius: '50%',
        bgcolor: theme.palette.info.main,
        flexShrink: 0,
      }}
      aria-label="안 읽음"
    />
  );
};

// ─── 간단 마크다운 렌더 (시안용 — 실 SimpleMarkdown은 별도) ──────

const SimpleMarkdownPreview = ({ content }) => {
  const lines = content.split('\n');
  return (
    <Box>
      {lines.map((line, i) => {
        if (line.startsWith('### ')) {
          return (
            <Typography key={i} variant="h5" sx={{ mt: 1.5, mb: 0.75, color: 'text.primary' }}>
              {line.slice(4)}
            </Typography>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <Typography key={i} variant="h4" sx={{ mt: 2, mb: 1, color: 'text.primary' }}>
              {line.slice(3)}
            </Typography>
          );
        }
        if (line.startsWith('- ')) {
          return (
            <Typography key={i} variant="body2" sx={{ pl: 2, color: 'text.primary', lineHeight: 1.7 }}>
              · {line.slice(2)}
            </Typography>
          );
        }
        if (/^\d+\. /.test(line)) {
          return (
            <Typography key={i} variant="body2" sx={{ pl: 2, color: 'text.primary', lineHeight: 1.7 }}>
              {line}
            </Typography>
          );
        }
        if (!line.trim()) return <Box key={i} sx={{ height: 8 }} />;
        return (
          <Typography key={i} variant="body2" sx={{ color: 'text.primary', lineHeight: 1.7 }}>
            {line}
          </Typography>
        );
      })}
    </Box>
  );
};

// ─── 작성/편집 모달 ─────────────────────────────────────────────

const BulletinFormDialog = ({ open, bulletin, onClose, onSave }) => {
  const theme = useTheme();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('notice');
  const [isPinned, setIsPinned] = useState(false);

  React.useEffect(() => {
    if (bulletin) {
      setTitle(bulletin.title);
      setContent(bulletin.content);
      setCategory(bulletin.category);
      setIsPinned(bulletin.is_pinned);
    } else {
      setTitle(''); setContent(''); setCategory('notice'); setIsPinned(false);
    }
  }, [bulletin, open]);

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) return;
    onSave({ title: title.trim(), content: content.trim(), category, is_pinned: isPinned });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx: { borderRadius: `${theme.radii.lg}px`, maxWidth: 600, width: '100%' } }}>
      <DialogTitle sx={{ pb: 1.5 }}>
        <Typography variant="h4" sx={{ letterSpacing: '-0.02em' }}>
          {bulletin ? '게시글 수정' : '새 글 작성'}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1.5 }}>
        <TextField
          fullWidth autoFocus size="small"
          label="제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}>
            카테고리
          </Typography>
          <FormControl size="small" fullWidth>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {Object.entries(BULLETIN_CATEGORY).map(([key, meta]) => (
                <MenuItem key={key} value={key}>{meta.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <TextField
          fullWidth multiline rows={10}
          label="내용 (마크다운)"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="## 제목&#10;- 항목 1&#10;- 항목 2"
        />
        <FormControlLabel
          control={
            <Checkbox checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} size="small" />
          }
          label={<Typography variant="body2">상단 고정</Typography>}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ minHeight: 40, color: 'text.secondary' }}>취소</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!title.trim() || !content.trim()}
          sx={{ minHeight: 40 }}
        >
          {bulletin ? '수정하기' : '작성하기'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── 메인 ──────────────────────────────────────────────────────

const BulletinBoardPreview = () => {
  const theme = useTheme();
  const [bulletins] = useState(MOCK_BULLETINS);
  const [readIds, setReadIds] = useState(INITIAL_READ_IDS);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBulletin, setSelectedBulletin] = useState(null);

  const [formDialog, setFormDialog] = useState({ open: false, bulletin: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, bulletin: null });
  const [readersDialog, setReadersDialog] = useState({ open: false, bulletin: null });
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  // 사양 §권한: master만. (시안에서는 master로 가정)
  const isMaster = true;

  const filteredBulletins = useMemo(() => {
    let list = bulletins;
    if (categoryFilter !== 'all') {
      list = list.filter(b => b.category === categoryFilter);
    }
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      list = list.filter(b => b.title.toLowerCase().includes(s) || (b.content || '').toLowerCase().includes(s));
    }
    // 고정 우선, 최신순
    return [...list].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [bulletins, categoryFilter, searchTerm]);

  const unreadCount = bulletins.filter(b => !readIds.has(b.id)).length;

  const handleSelect = (b) => {
    setSelectedBulletin(b);
    if (!readIds.has(b.id)) {
      // 사양 §액션 §게시글 선택: 안 읽은 글이면 markBulletinRead. 실패 silent.
      setReadIds(prev => new Set([...prev, b.id]));
    }
  };

  const toast = (msg) => setSnackbar({ open: true, message: msg });

  const MOCK_READERS = [
    { user_id: 'u-001', user_name: '김건우', first_read_at: '2026-05-26T08:14:00', last_read_at: '2026-05-28T07:55:00' },
    { user_id: 'u-002', user_name: '이수정', first_read_at: '2026-05-26T10:30:00', last_read_at: '2026-05-26T10:30:00' },
    { user_id: 'u-003', user_name: '박지훈', first_read_at: '2026-05-27T14:22:00', last_read_at: '2026-05-27T14:22:00' },
  ];

  return (
    <PreviewShell activePath="/admin/bulletins">
      <PageHeader
        title="게시판"
        subtitle={`총 ${bulletins.length}개 · 안 읽음 ${unreadCount}개 (본인 기준)`}
        icon={AnnouncementIcon}
        action={
          isMaster && (
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon sx={{ fontSize: 16 }} />}
              onClick={() => setFormDialog({ open: true, bulletin: null })}
              sx={{ minHeight: 36 }}
            >
              새 글 작성
            </Button>
          )
        }
      />

      {/* 사양 §발견 1: 권한 매트릭스 vs 코드 불일치 안내 */}
      <Alert
        severity="info"
        sx={{ mb: 2, borderRadius: `${theme.radii.md}px`, py: 0.75 }}
      >
        <Typography variant="caption" sx={{ color: 'text.primary' }}>
          코드 기준: 작성·수정·삭제는 master만 가능. 권한 매트릭스의 <code>bulletins:manage</code> 권한은 현재 동작하지 않음 (잠재 부채).
        </Typography>
      </Alert>

      {/* 카테고리 필터 + 검색 */}
      <SectionCard sx={{ mb: 3 }} padding={20}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            <Chip
              label="전체"
              size="small"
              variant={categoryFilter === 'all' ? 'filled' : 'outlined'}
              color={categoryFilter === 'all' ? 'primary' : 'default'}
              onClick={() => setCategoryFilter('all')}
              sx={{ fontWeight: categoryFilter === 'all' ? 700 : 500, cursor: 'pointer' }}
            />
            {Object.entries(BULLETIN_CATEGORY).map(([key, meta]) => {
              const active = categoryFilter === key;
              return (
                <Chip
                  key={key}
                  label={meta.label}
                  size="small"
                  onClick={() => setCategoryFilter(key)}
                  sx={{
                    cursor: 'pointer',
                    fontWeight: active ? 700 : 500,
                    bgcolor: active ? alpha(meta.color, 0.15) : 'transparent',
                    border: `1px solid ${active ? alpha(meta.color, 0.4) : theme.gray[200]}`,
                    color: active ? meta.color : 'text.secondary',
                  }}
                />
              );
            })}
          </Box>
          <TextField
            size="small"
            placeholder="제목·본문 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ fontSize: 18, color: 'text.disabled', mr: 0.75 }} />,
            }}
            sx={{ flex: '1 1 200px', minWidth: 200 }}
          />
        </Box>
      </SectionCard>

      {/* 좌(380) + 우(flex) 동시 패널 */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
        {/* 좌측 — 목록 */}
        <SectionCard
          padding={0}
          sx={{
            width: { xs: '100%', md: 380 },
            display: { xs: selectedBulletin ? 'none' : 'block', md: 'block' },
            flexShrink: 0,
          }}
        >
          {filteredBulletins.length === 0 ? (
            <EmptyState
              icon={AnnouncementIcon}
              title="게시글이 없습니다"
              description="필터를 조정해 주세요"
            />
          ) : (
            <Box>
              {filteredBulletins.map((b, idx) => {
                const isUnread = !readIds.has(b.id);
                const isSelected = selectedBulletin?.id === b.id;
                return (
                  <React.Fragment key={b.id}>
                    <Box
                      onClick={() => handleSelect(b)}
                      sx={{
                        px: 2.5, py: 1.75,
                        cursor: 'pointer',
                        bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
                        borderLeft: isSelected ? `3px solid ${theme.palette.primary.main}` : '3px solid transparent',
                        transition: `background-color 0.15s ${theme.easing.toss}`,
                        '&:hover': {
                          bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.08) : theme.gray[50],
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75, flexWrap: 'wrap' }}>
                        {b.is_pinned && <PinnedChip />}
                        <CategoryChip category={b.category} />
                        {isUnread && <UnreadDot />}
                      </Box>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: isUnread ? 700 : 500,
                          color: 'text.primary',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          mb: 0.5,
                        }}
                      >
                        {b.title}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {b.author_name || '관리자'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontFeatureSettings: '"tnum" 1' }}>
                          {formatDate(b.created_at)}
                        </Typography>
                      </Box>
                    </Box>
                    {idx < filteredBulletins.length - 1 && <Divider />}
                  </React.Fragment>
                );
              })}
            </Box>
          )}
        </SectionCard>

        {/* 우측 — 상세 */}
        <Box sx={{ flex: 1, display: { xs: selectedBulletin ? 'block' : 'none', md: 'block' }, minWidth: 0, width: '100%' }}>
          {!selectedBulletin ? (
            <SectionCard padding={0}>
              <EmptyState
                icon={AnnouncementIcon}
                title="게시글을 선택해 주세요"
                description="좌측 목록에서 게시글을 선택하면 내용이 표시됩니다."
              />
            </SectionCard>
          ) : (
            <SectionCard padding={24}>
              {/* 모바일 한정 뒤로가기 */}
              <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 1.5 }}>
                <Button
                  size="small"
                  startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
                  onClick={() => setSelectedBulletin(null)}
                  sx={{ color: 'text.secondary' }}
                >
                  목록으로
                </Button>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5, flexWrap: 'wrap' }}>
                {selectedBulletin.is_pinned && <PinnedChip />}
                <CategoryChip category={selectedBulletin.category} />
              </Box>
              <Typography variant="h3" sx={{ color: 'text.primary', lineHeight: 1.3, mb: 1 }}>
                {selectedBulletin.title}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {selectedBulletin.author_name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>·</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1' }}>
                  {formatDateTime(selectedBulletin.created_at)}
                </Typography>
                {selectedBulletin.updated_at !== selectedBulletin.created_at && (
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    (수정됨)
                  </Typography>
                )}
                {/* 우측 액션 — master only */}
                {isMaster && (
                  <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5 }}>
                    <Tooltip title="읽음 현황" arrow>
                      <IconButton
                        size="small"
                        onClick={() => setReadersDialog({ open: true, bulletin: selectedBulletin })}
                        sx={{ width: 36, height: 36, color: 'text.secondary' }}
                      >
                        <VisibilityIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="수정" arrow>
                      <IconButton
                        size="small"
                        onClick={() => setFormDialog({ open: true, bulletin: selectedBulletin })}
                        sx={{ width: 36, height: 36, color: 'text.secondary' }}
                      >
                        <EditIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="삭제" arrow>
                      <IconButton
                        size="small"
                        onClick={() => setDeleteDialog({ open: true, bulletin: selectedBulletin })}
                        sx={{ width: 36, height: 36, color: theme.palette.error.main }}
                      >
                        <DeleteIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </Box>
              <Divider sx={{ mb: 2 }} />
              <SimpleMarkdownPreview content={selectedBulletin.content} />
            </SectionCard>
          )}
        </Box>
      </Box>

      {/* FAB — master only (모바일에서도 보임). PageHeader 액션과 중복이지만 사양에 명시. */}
      {isMaster && (
        <Fab
          color="primary"
          aria-label="새 글 작성"
          onClick={() => setFormDialog({ open: true, bulletin: null })}
          sx={{ position: 'fixed', bottom: 24, right: 24, display: { xs: 'flex', md: 'none' } }}
        >
          <AddIcon />
        </Fab>
      )}

      {/* 모달들 */}
      <BulletinFormDialog
        open={formDialog.open}
        bulletin={formDialog.bulletin}
        onClose={() => setFormDialog({ open: false, bulletin: null })}
        onSave={({ title }) => toast(`게시글 "${title}" 저장 (mock)`)}
      />

      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, bulletin: null })}
        PaperProps={{ sx: { borderRadius: `${theme.radii.lg}px`, maxWidth: 420, width: '100%' } }}
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
          <Typography variant="h4" sx={{ letterSpacing: '-0.02em' }}>게시글 삭제</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.primary' }}>
            이 게시글을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDeleteDialog({ open: false, bulletin: null })} sx={{ minHeight: 40, color: 'text.secondary' }}>
            취소
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteIcon sx={{ fontSize: 16 }} />}
            onClick={() => {
              toast(`게시글 "${deleteDialog.bulletin?.title}" 삭제 (mock)`);
              setDeleteDialog({ open: false, bulletin: null });
              setSelectedBulletin(null);
            }}
            sx={{ minHeight: 40 }}
          >
            삭제
          </Button>
        </DialogActions>
      </Dialog>

      {/* 읽음 현황 모달 */}
      <Dialog
        open={readersDialog.open}
        onClose={() => setReadersDialog({ open: false, bulletin: null })}
        PaperProps={{ sx: { borderRadius: `${theme.radii.lg}px`, maxWidth: 480, width: '100%' } }}
      >
        <DialogTitle sx={{ pb: 1.5 }}>
          <Typography variant="h4" sx={{ letterSpacing: '-0.02em' }}>읽음 현황</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 400, mt: 0.25 }}>
            {readersDialog.bulletin?.title}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {MOCK_READERS.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
              아직 읽은 사용자가 없습니다.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>이름</TableCell>
                    <TableCell>최초 확인</TableCell>
                    <TableCell>최종 확인</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {MOCK_READERS.map(r => (
                    <TableRow key={r.user_id}>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: 'text.primary' }}>{r.user_name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1' }}>
                          {formatDateTime(r.first_read_at).slice(5)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1' }}>
                          {formatDateTime(r.last_read_at).slice(5)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setReadersDialog({ open: false, bulletin: null })} variant="contained" sx={{ minHeight: 40 }}>
            닫기
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message={snackbar.message}
        action={
          <IconButton size="small" color="inherit" onClick={() => setSnackbar({ open: false, message: '' })}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        }
      />
    </PreviewShell>
  );
};

export default BulletinBoardPreview;
