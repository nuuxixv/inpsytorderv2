import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Button, IconButton, Divider, useTheme, useMediaQuery,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Menu, MenuItem, ListItemIcon, ListItemText,
  Select, FormControl, TextField, Tooltip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ReceiptLong as ReceiptLongIcon,
  Close as CloseIcon,
  Download as DownloadIcon,
  Add as AddIcon,
  PersonAddAlt as PersonAddIcon,
  EventNote as EventNoteIcon,
  DeleteOutline as DeleteOutlineIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { PageHeader, SectionCard, EmptyState } from './ui';
import PreviewShell from './preview/PreviewShell';
import { numberToKoreanCurrency } from '../utils/koreanCurrency';

/**
 * DEV-ONLY keystone: /preview/payment-receipt.
 * A10b 지불증(수당 영수증) 생성 모달 시안 — 모달 열린 상태로 렌더(눈 확인용).
 *
 * 사양: design-system/specs/A10_PaymentReceiptModal.md
 *  - §2 수당규정(반일40k·종일70k·출장20k·평일1박)
 *  - §3 입력단위 = (멤버,날짜) 셀 단일선택 → 같은 날짜 중복 원천차단
 *  - §4 모달구조(상단 학회/날짜 · 멤버 행 · 참관추가 · 하단 총합+한글)
 *  - §5 직급(차장>과장>대리>사원 고정 드롭다운, 정렬축)
 *
 * 레이아웃 결정: "멤버별 날짜 서브행"(그리드 아님). 근거는 specs "모달 시안" 섹션.
 *  - 멤버 카드 1장 = 멤버 헤더(이름·직급·합산) + 날짜별 1줄(4세그먼트 단일선택)
 *  - 단일선택 = 같은 날짜에 주말근무+출장 동시 불가(원천차단)
 *
 * 실 export 로직은 utils/depositResolution.js 패턴 확장(allowanceRules.js 신규). 시안은 미연결.
 */

// ─── 수당 규정 (고정 단가) — §2 ────────────────────────────────
const RATE = {
  none:  { key: 'none',  label: '미근무', amount: 0,     desc: '' },
  half:  { key: 'half',  label: '반일',   amount: 40000, desc: '오전/오후 4~5h' },
  full:  { key: 'full',  label: '종일',   amount: 70000, desc: '09~17 / 10~18' },
  trip:  { key: 'trip',  label: '출장',   amount: 20000, desc: '평일 1박' },
};
const RATE_ORDER = ['none', 'half', 'full', 'trip'];

// ─── 직급 (차장>과장>대리>사원 고정) — §5 ──────────────────────
const POSITIONS = ['차장', '과장', '대리', '사원'];
const POSITION_RANK = Object.fromEntries(POSITIONS.map((p, i) => [p, i]));

// ─── Mock: 로그인 관리자(영수인) ───────────────────────────────
const ME = { id: 'u-me', name: '김현장', position: '대리' };

// ─── Mock: 학회(읽기) + 근무 날짜 후보 ─────────────────────────
// 부산 지방 학회 가정 → 출장 1박 발생. 9/13(금) 출장 전날 평일 + 9/14(토)·9/15(일) 주말근무.
const MOCK_EVENT = {
  hostSociety: '한국심리학회',
  name: '2026 한국심리학회 추계학술대회',
  venue: '부산 BEXCO 제1전시장',
  startDate: '2026-09-13',
  endDate: '2026-09-15',
};

// 날짜 후보 — 학회기간 자동 + "날짜 추가"로 평일 출장일 보강(여기선 09-12 추가 시연 가능)
const dow = (iso) => ['일', '월', '화', '수', '목', '금', '토'][new Date(iso + 'T00:00:00').getDay()];
const dot = (iso) => iso.slice(5).replace('-', '.');
const isWeekend = (iso) => [0, 6].includes(new Date(iso + 'T00:00:00').getDay());

const INITIAL_DATES = ['2026-09-13', '2026-09-14', '2026-09-15'];

// ─── Mock: 참석자(attendee_ids → user_profiles join, 이름·직급) ──
// 정렬: 직급순 → 이름순. 초기 근무패턴은 "현실 시나리오" 프리필.
const INITIAL_MEMBERS = [
  {
    id: 'u-004', name: '정마스터', position: '과장', adhoc: false,
    work: { '2026-09-13': 'trip', '2026-09-14': 'full', '2026-09-15': 'half' },
  },
  {
    id: 'u-me', name: '김현장', position: '대리', adhoc: false,
    work: { '2026-09-13': 'trip', '2026-09-14': 'full', '2026-09-15': 'full' },
  },
  {
    id: 'u-002', name: '이부스', position: '사원', adhoc: false,
    work: { '2026-09-13': 'none', '2026-09-14': 'half', '2026-09-15': 'half' },
  },
];

const won = (n) => `${n.toLocaleString()}원`;

const sortMembers = (arr) =>
  [...arr].sort((a, b) => {
    const r = (POSITION_RANK[a.position] ?? 99) - (POSITION_RANK[b.position] ?? 99);
    return r !== 0 ? r : a.name.localeCompare(b.name, 'ko');
  });

// ─── 멤버 합산 ─────────────────────────────────────────────────
const memberTotal = (member, dates) =>
  dates.reduce((sum, d) => sum + (RATE[member.work[d] || 'none']?.amount || 0), 0);

// ─── 4세그먼트 단일선택 (미근무/반일/종일/출장) — §3 ────────────
// 한 줄 = 한 날짜. 단일선택이라 같은 날짜에 주말근무+출장 동시 불가가 구조적으로 보장됨.
const WorkSegmented = ({ value, onChange }) => {
  const theme = useTheme();
  return (
    <Box
      role="radiogroup"
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 0.5,
        bgcolor: theme.gray[100],
        borderRadius: `${theme.radii.md}px`,
        p: 0.5,
        width: '100%',
      }}
    >
      {RATE_ORDER.map((key) => {
        const rate = RATE[key];
        const selected = value === key;
        const isNone = key === 'none';
        return (
          <Box
            key={key}
            role="radio"
            aria-checked={selected}
            tabIndex={0}
            onClick={() => onChange(key)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(key); } }}
            sx={{
              minHeight: 52,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.125,
              px: 0.5,
              borderRadius: `${theme.radii.sm}px`,
              cursor: 'pointer',
              userSelect: 'none',
              bgcolor: selected ? 'background.paper' : 'transparent',
              border: selected
                ? `1.5px solid ${isNone ? theme.gray[300] : theme.palette.primary.main}`
                : '1.5px solid transparent',
              boxShadow: selected && !isNone ? theme.customShadows.xs : 'none',
              transition: `all 0.12s ${theme.easing.toss}`,
              '&:hover': { bgcolor: selected ? 'background.paper' : theme.gray[50] },
              '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 1 },
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                lineHeight: 1.2,
                color: selected ? (isNone ? 'text.secondary' : 'primary.main') : 'text.secondary',
              }}
            >
              {rate.label}
            </Typography>
            {!isNone && (
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.6875rem',
                  lineHeight: 1.1,
                  fontFeatureSettings: '"tnum" 1',
                  color: selected ? 'primary.main' : 'text.disabled',
                }}
              >
                {rate.amount.toLocaleString()}
              </Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

// ─── 멤버 카드 (헤더 + 날짜 서브행) ────────────────────────────
const MemberCard = ({ member, dates, onChangeWork, onRemove }) => {
  const theme = useTheme();
  const total = memberTotal(member, dates);
  const worked = total > 0;

  return (
    <Box
      sx={{
        border: `1px solid ${theme.gray[200]}`,
        borderRadius: `${theme.radii.lg}px`,
        bgcolor: worked ? 'background.paper' : theme.gray[50],
        overflow: 'hidden',
        transition: `all 0.2s ${theme.easing.toss}`,
      }}
    >
      {/* 멤버 헤더: 이름 · 직급 · 합산 · (참관 삭제) */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1.25,
          borderBottom: `1px solid ${theme.gray[100]}`,
          bgcolor: theme.gray[50],
        }}
      >
        <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>{member.name}</Typography>
        <Box
          sx={{
            px: 0.75, py: 0.125, borderRadius: `${theme.radii.sm}px`,
            bgcolor: theme.gray[100], border: `1px solid ${theme.gray[200]}`,
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', lineHeight: 1.4 }}>
            {member.position}
          </Typography>
        </Box>
        {member.adhoc && (
          <Box
            sx={{
              px: 0.75, py: 0.125, borderRadius: `${theme.radii.sm}px`,
              bgcolor: alpha(theme.accent.attention, 0.12),
              border: `1px solid ${alpha(theme.accent.attention, 0.28)}`,
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 700, color: theme.accent.attention, lineHeight: 1.4 }}>
              참관
            </Typography>
          </Box>
        )}
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontFeatureSettings: '"tnum" 1',
              color: worked ? 'text.primary' : 'text.disabled',
            }}
          >
            {won(total)}
          </Typography>
          {member.adhoc && (
            <Tooltip title="참관 직원 제거" arrow>
              <IconButton
                size="small"
                onClick={onRemove}
                aria-label={`${member.name} 제거`}
                sx={{ width: 36, height: 36, color: 'text.disabled', '&:hover': { color: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.06) } }}
              >
                <DeleteOutlineIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* 날짜별 서브행 */}
      <Box sx={{ px: 2, py: 1.25, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {dates.map((d) => {
          const weekend = isWeekend(d);
          return (
            <Box key={d} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {/* 날짜 라벨 (요일·주말 톤) */}
              <Box sx={{ flex: '0 0 64px', display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, fontFeatureSettings: '"tnum" 1', color: 'text.primary' }}>
                  {dot(d)}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 600, color: weekend ? theme.palette.error.main : 'text.disabled' }}
                >
                  {dow(d)}요일
                </Typography>
              </Box>
              {/* 4세그먼트 단일선택 */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <WorkSegmented value={member.work[d] || 'none'} onChange={(k) => onChangeWork(member.id, d, k)} />
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

// ─── 참관 직원 추가 인라인 폼 (미저장 1회성) — §4 ───────────────
const AddObserverForm = ({ onAdd, onCancel }) => {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [position, setPosition] = useState('사원');
  const valid = name.trim().length > 0;
  return (
    <Box
      sx={{
        border: `1px dashed ${alpha(theme.palette.primary.main, 0.4)}`,
        borderRadius: `${theme.radii.lg}px`,
        bgcolor: alpha(theme.palette.primary.main, 0.03),
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', letterSpacing: '0.02em' }}>
        참관 직원 추가 (이 지불증에만 1회 사용 · 저장 안 됨)
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          label="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="참관 직원 이름"
          InputLabelProps={{ shrink: true }}
          sx={{ flex: '1 1 160px', minWidth: 140 }}
          autoFocus
        />
        <FormControl size="small" sx={{ flex: '0 0 120px', minWidth: 110 }}>
          <Select value={position} onChange={(e) => setPosition(e.target.value)} displayEmpty>
            {POSITIONS.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button size="small" onClick={onCancel} sx={{ color: 'text.secondary', minHeight: 40 }}>취소</Button>
        <Button
          size="small"
          variant="contained"
          disabled={!valid}
          onClick={() => onAdd(name.trim(), position)}
          sx={{ minHeight: 40 }}
        >
          추가
        </Button>
      </Box>
    </Box>
  );
};

// ─── 지불증 모달 본체 ──────────────────────────────────────────
const PaymentReceiptModal = ({ open, onClose, onToast }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [dates, setDates] = useState(INITIAL_DATES);
  const [members, setMembers] = useState(INITIAL_MEMBERS);
  const [addingObserver, setAddingObserver] = useState(false);
  const [addDateAnchor, setAddDateAnchor] = useState(null);

  const sorted = useMemo(() => sortMembers(members), [members]);

  // 총합 / 한글금액 (미근무=0 멤버는 문서에서 제외되지만 합산엔 0이라 영향 없음)
  const grandTotal = useMemo(
    () => sorted.reduce((sum, m) => sum + memberTotal(m, dates), 0),
    [sorted, dates],
  );
  const koreanTotal = numberToKoreanCurrency(grandTotal);
  const paidMemberCount = sorted.filter((m) => memberTotal(m, dates) > 0).length;

  const changeWork = (memberId, date, key) =>
    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, work: { ...m.work, [date]: key } } : m)));

  const addObserver = (name, position) => {
    setMembers((prev) => [...prev, { id: `adhoc-${Date.now()}`, name, position, adhoc: true, work: {} }]);
    setAddingObserver(false);
    onToast(`참관 직원 "${name}" 추가됨 (mock)`);
  };
  const removeMember = (id) => setMembers((prev) => prev.filter((m) => m.id !== id));

  // "날짜 추가" — 평일 출장 전날 보강 시연(09-12 금 ← 실제로는 토. 시연용 후보 몇 개)
  const DATE_CANDIDATES = ['2026-09-12', '2026-09-16'];
  const addableDates = DATE_CANDIDATES.filter((d) => !dates.includes(d));
  const addDate = (d) => {
    setDates((prev) => [...prev, d].sort());
    setAddDateAnchor(null);
    onToast(`근무 날짜 ${dot(d)} 추가 (mock)`);
  };

  const empty = sorted.length === 0;
  const allZero = !empty && grandTotal === 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      scroll="paper"
      PaperProps={{ sx: { borderRadius: isMobile ? 0 : `${theme.radii.lg}px`, maxWidth: 600, width: '100%' } }}
    >
      {/* 헤더 */}
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25, pb: 1.5 }}>
        <Box
          sx={{
            width: 36, height: 36, borderRadius: `${theme.radii.sm}px`,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ReceiptLongIcon sx={{ fontSize: 20, color: 'primary.main' }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="div" variant="h4" sx={{ letterSpacing: '-0.02em' }}>지불증 내보내기</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>참석 직원 수당(주말근무·출장비) 영수증</Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="닫기" sx={{ width: 40, height: 40, color: 'text.secondary' }}>
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ bgcolor: theme.gray[50] }}>
        {/* 상단: 학회(읽기) + 근무 날짜 */}
        <Box
          sx={{
            mt: 0.5, mb: 2, p: 2, borderRadius: `${theme.radii.md}px`,
            bgcolor: 'background.paper', border: `1px solid ${theme.gray[200]}`,
          }}
        >
          <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>{MOCK_EVENT.name}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
            <EventNoteIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1' }}>
              {dot(MOCK_EVENT.startDate)} ~ {dot(MOCK_EVENT.endDate)} · {MOCK_EVENT.venue}
            </Typography>
          </Box>

          <Divider sx={{ my: 1.5 }} />

          {/* 근무 날짜 칩 + 날짜 추가 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mr: 0.25 }}>근무 날짜</Typography>
            {dates.map((d) => {
              const weekend = isWeekend(d);
              return (
                <Box
                  key={d}
                  sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.5,
                    px: 1, py: 0.375, borderRadius: `${theme.radii.sm}px`,
                    bgcolor: theme.gray[50], border: `1px solid ${theme.gray[200]}`,
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700, fontFeatureSettings: '"tnum" 1', color: 'text.primary' }}>
                    {dot(d)}
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: weekend ? theme.palette.error.main : 'text.disabled' }}>
                    {dow(d)}
                  </Typography>
                </Box>
              );
            })}
            <Button
              size="small"
              variant="text"
              startIcon={<AddIcon sx={{ fontSize: 16 }} />}
              disabled={addableDates.length === 0}
              onClick={(e) => setAddDateAnchor(e.currentTarget)}
              sx={{ minHeight: 36, color: 'primary.main', px: 1 }}
            >
              날짜 추가
            </Button>
            <Menu
              anchorEl={addDateAnchor}
              open={Boolean(addDateAnchor)}
              onClose={() => setAddDateAnchor(null)}
            >
              {addableDates.map((d) => (
                <MenuItem key={d} onClick={() => addDate(d)} sx={{ minHeight: 44 }}>
                  <ListItemText
                    primary={`${dot(d)} (${dow(d)})`}
                    secondary={isWeekend(d) ? '주말' : '평일 — 출장 전날 보강용'}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </MenuItem>
              ))}
            </Menu>
          </Box>
          <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.75 }}>
            출장 전날(평일)이 필요하면 날짜를 추가하세요. 각 날짜는 멤버별로 미근무/반일/종일/출장 중 하나만 선택됩니다.
          </Typography>
        </Box>

        {/* 멤버 리스트 */}
        {empty ? (
          <Box sx={{ bgcolor: 'background.paper', border: `1px solid ${theme.gray[200]}`, borderRadius: `${theme.radii.lg}px` }}>
            <EmptyState
              icon={ReceiptLongIcon}
              title="참석자가 없습니다"
              description="이 학회에 참석자가 등록되지 않았어요. 참관 직원을 추가해 지불증을 작성하세요."
              action={{ label: '참관 직원 추가', onClick: () => setAddingObserver(true), startIcon: <PersonAddIcon sx={{ fontSize: 18 }} /> }}
            />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {sorted.map((m) => (
              <MemberCard
                key={m.id}
                member={m}
                dates={dates}
                onChangeWork={changeWork}
                onRemove={() => removeMember(m.id)}
              />
            ))}

            {/* 참관 직원 추가 */}
            {addingObserver ? (
              <AddObserverForm onAdd={addObserver} onCancel={() => setAddingObserver(false)} />
            ) : (
              <Button
                fullWidth
                variant="outlined"
                startIcon={<PersonAddIcon sx={{ fontSize: 18 }} />}
                onClick={() => setAddingObserver(true)}
                sx={{
                  minHeight: 48,
                  borderStyle: 'dashed',
                  borderColor: theme.gray[300],
                  color: 'text.secondary',
                  bgcolor: 'background.paper',
                  '&:hover': { borderColor: 'primary.main', color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.03) },
                }}
              >
                참관 직원 추가
              </Button>
            )}
          </Box>
        )}
      </DialogContent>

      {/* 하단: 총합 미리보기 + 다운로드 */}
      <DialogActions sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 1.5, px: 3, py: 2.5 }}>
        {/* 총합 패널 */}
        <Box
          sx={{
            p: 2, borderRadius: `${theme.radii.md}px`,
            bgcolor: allZero ? theme.gray[50] : alpha(theme.palette.primary.main, 0.04),
            border: `1px solid ${allZero ? theme.gray[200] : alpha(theme.palette.primary.main, 0.16)}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2 }}>
            <Typography variant="subtitle1" sx={{ color: 'text.primary' }}>
              총 지급액
              {!empty && (
                <Typography component="span" variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, ml: 0.75 }}>
                  지급 대상 {paidMemberCount}명
                </Typography>
              )}
            </Typography>
            <Typography variant="h4" sx={{ color: allZero ? 'text.disabled' : 'primary.main', fontFeatureSettings: '"tnum" 1', letterSpacing: '-0.02em' }}>
              {won(grandTotal)}
            </Typography>
          </Box>
          {!allZero && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.25 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                금 {koreanTotal}원정
              </Typography>
            </Box>
          )}
          {allZero && (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
              모든 멤버가 미근무 상태예요. 근무 항목을 하나 이상 선택하면 지급액이 계산됩니다.
            </Typography>
          )}
        </Box>

        {/* 영수인(읽기) + 다운로드 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            영수인 <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>{ME.name} {ME.position}</Box>
          </Typography>
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
            <Button onClick={onClose} sx={{ minHeight: 48, color: 'text.secondary' }}>취소</Button>
            <Button
              variant="contained"
              startIcon={<DownloadIcon sx={{ fontSize: 18 }} />}
              disabled={allZero || empty}
              onClick={() => onToast(`지불증 다운로드 · ${won(grandTotal)} (mock)`)}
              sx={{ minHeight: 48 }}
            >
              지불증 다운로드
            </Button>
          </Box>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

// ─── Preview 래퍼 (모달 열린 상태로 렌더 + 진입 행) ─────────────
const PaymentReceiptModalPreview = () => {
  const theme = useTheme();
  const [open, setOpen] = useState(true);
  const [snackEl, setSnackEl] = useState(null);
  const [toast, setToast] = useState('');
  const [rowMenuAnchor, setRowMenuAnchor] = useState(null);

  const showToast = (msg) => { setToast(msg); };

  return (
    <PreviewShell activePath="/admin/events">
      <PageHeader
        title="지불증 모달 시안"
        subtitle="A10b · 학회 행 ⋯메뉴 → 지불증 내보내기 → 멤버×날짜 입력 → 다운로드"
        icon={ReceiptLongIcon}
      />

      {/* 진입 맥락 재현: 학회 1행 + ⋯ 메뉴 (실서비스는 A10 목록 행에서 진입) */}
      <SectionCard padding={20} sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>{MOCK_EVENT.name}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {dot(MOCK_EVENT.startDate)} ~ {dot(MOCK_EVENT.endDate)} · {MOCK_EVENT.venue}
            </Typography>
          </Box>
          <IconButton
            onClick={(e) => setRowMenuAnchor(e.currentTarget)}
            aria-label="행 메뉴"
            sx={{ color: 'text.secondary', '&:hover': { bgcolor: theme.gray[100] } }}
          >
            <MoreVertIcon sx={{ fontSize: 20 }} />
          </IconButton>
          <Menu anchorEl={rowMenuAnchor} open={Boolean(rowMenuAnchor)} onClose={() => setRowMenuAnchor(null)}>
            <MenuItem onClick={() => { setRowMenuAnchor(null); setOpen(true); }} sx={{ minHeight: 44 }}>
              <ListItemIcon><ReceiptLongIcon sx={{ fontSize: 18 }} /></ListItemIcon>
              <ListItemText primary="지불증 내보내기" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
            </MenuItem>
          </Menu>
        </Box>
        {!open && (
          <Button
            variant="outlined"
            startIcon={<ReceiptLongIcon sx={{ fontSize: 18 }} />}
            onClick={() => setOpen(true)}
            sx={{ mt: 2 }}
          >
            모달 다시 열기
          </Button>
        )}
      </SectionCard>

      <PaymentReceiptModal open={open} onClose={() => setOpen(false)} onToast={showToast} />

      {/* 간이 토스트 (Snackbar 대용 — 시연용) */}
      {toast && (
        <Box
          onClick={() => setToast('')}
          sx={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            bgcolor: theme.gray[900], color: '#fff', px: 2, py: 1.25,
            borderRadius: `${theme.radii.md}px`, boxShadow: theme.customShadows.lg,
            fontSize: '0.875rem', fontWeight: 500, zIndex: 2000, cursor: 'pointer',
          }}
        >
          {toast}
        </Box>
      )}
    </PreviewShell>
  );
};

export default PaymentReceiptModalPreview;
