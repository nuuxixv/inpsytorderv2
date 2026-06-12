import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  TextField,
  MenuItem,
  Pagination,
  Collapse,
  IconButton,
  alpha,
  useTheme,
} from '@mui/material';
import {
  History as HistoryIcon,
  Search as SearchIcon,
  KeyboardArrowDown as ArrowDownIcon,
  KeyboardArrowRight as ArrowRightIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { getAuditLogs, getAuditActors, AUDIT_PAGE_SIZE } from '../api/auditLog';
import { PageHeader, SectionCard, EmptyState, RoleChip, DateField } from './ui';

// 종류(target_table) → 한글 라벨 + 색 토큰. A7 역할칩과 컬럼·맥락이 분리되어 혼동 없음.
// raw hex 없이 theme 팔레트만 사용. orders/order_items 는 '주문' 한 칩으로 묶음.
const KIND_META = {
  orders:        { label: '주문',   colorKey: 'primary' },
  order_items:   { label: '주문',   colorKey: 'primary' },
  user_auth:     { label: '사용자', colorKey: 'warning' },
  site_settings: { label: '설정',   colorKey: 'info' },
  events:        { label: '학회',   colorKey: 'secondary' },
  products:      { label: '상품',   colorKey: 'success' },
};

// 종류 칩 토글 필터 옵션 (order_items 는 orders 와 묶이므로 토글 목록에서 제외)
const KIND_FILTERS = [
  { key: 'orders',        label: '주문',   tables: ['orders', 'order_items'] },
  { key: 'user_auth',     label: '사용자', tables: ['user_auth'] },
  { key: 'site_settings', label: '설정',   tables: ['site_settings'] },
  { key: 'events',        label: '학회',   tables: ['events'] },
  { key: 'products',      label: '상품',   tables: ['products'] },
];

// 대상 라벨: target_table 한글명 + #target_id
const TARGET_TABLE_LABEL = {
  orders: '주문',
  order_items: '주문 항목',
  user_auth: '사용자',
  site_settings: '설정',
  events: '학회',
  products: '상품',
};

const DATE_PRESETS = [
  { key: '7', label: '최근 7일', days: 7 },
  { key: '30', label: '최근 30일', days: 30 },
  { key: 'custom', label: '직접 범위', days: null },
];

const KindChip = ({ table }) => {
  const theme = useTheme();
  const meta = KIND_META[table];
  if (!meta) {
    return (
      <Box
        sx={{
          display: 'inline-flex',
          px: 1,
          py: 0.5,
          borderRadius: `${theme.radii.sm}px`,
          border: `1px solid ${theme.gray[200]}`,
          color: 'text.secondary',
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1 }}>
          {table || '기타'}
        </Typography>
      </Box>
    );
  }
  const palette = theme.palette[meta.colorKey]?.main || theme.gray[600];
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1,
        py: 0.5,
        borderRadius: `${theme.radii.sm}px`,
        bgcolor: alpha(palette, 0.1),
        border: `1px solid ${alpha(palette, 0.2)}`,
        color: palette,
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 700, color: palette, lineHeight: 1 }}>
        {meta.label}
      </Typography>
    </Box>
  );
};

// jsonb 값을 읽기 쉬운 문자열로. 객체/배열은 들여쓰기 JSON, 원시값은 그대로.
const formatValue = (v) => {
  if (v === undefined) return undefined;
  if (v === null) return 'null';
  if (typeof v === 'object') return JSON.stringify(v, null, 2);
  return String(v);
};

// before/after(jsonb) 를 필드 단위 diff 행 목록으로 변환.
// action='create' → 모든 after 필드 added, 'delete' → 모든 before 필드 removed.
// 그 외 → before[k] !== after[k] 인 키만(JSON 비교).
const buildDiffRows = (before, after, action) => {
  const b = before && typeof before === 'object' ? before : {};
  const a = after && typeof after === 'object' ? after : {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].sort();
  const rows = [];
  for (const key of keys) {
    const inB = key in b;
    const inA = key in a;
    const bStr = inB ? formatValue(b[key]) : undefined;
    const aStr = inA ? formatValue(a[key]) : undefined;
    if (action === 'create') {
      if (inA) rows.push({ key, before: undefined, after: aStr });
      continue;
    }
    if (action === 'delete') {
      if (inB) rows.push({ key, before: bStr, after: undefined });
      continue;
    }
    if (bStr !== aStr) rows.push({ key, before: bStr, after: aStr });
  }
  return rows;
};

// GitHub/IDE식 diff 줄 — 빨강(제거)/초록(추가) 음영. 색은 theme success/error alpha 만.
const DiffLine = ({ field, marker, value, theme }) => {
  const isRemove = marker === '-';
  const accent = isRemove ? theme.palette.error.main : theme.palette.success.main;
  return (
    <Box
      sx={{
        display: 'flex',
        bgcolor: alpha(accent, 0.12),
        borderLeft: `2px solid ${alpha(accent, 0.5)}`,
        px: 1,
        py: 0.5,
      }}
    >
      <Box
        component="span"
        sx={{ width: 14, flexShrink: 0, color: accent, fontWeight: 700, userSelect: 'none' }}
      >
        {marker}
      </Box>
      <Box sx={{ minWidth: 0, fontSize: '0.75rem', lineHeight: 1.6, color: theme.gray[800] }}>
        <Box component="span" sx={{ fontWeight: 700 }}>{field}: </Box>
        <Box component="span" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{value}</Box>
      </Box>
    </Box>
  );
};

// 한 행의 변경 필드 diff 묶음. 변경 없음이면 안내.
const DiffView = ({ before, after, action, theme }) => {
  const rows = buildDiffRows(before, after, action);
  if (rows.length === 0) {
    return (
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        변경된 필드가 없습니다.
      </Typography>
    );
  }
  return (
    <Box
      sx={{
        border: `1px solid ${theme.gray[200]}`,
        borderRadius: `${theme.radii.sm}px`,
        overflow: 'hidden',
        bgcolor: theme.palette.background.paper,
      }}
    >
      {rows.map((row, i) => (
        <Box key={row.key} sx={{ borderTop: i > 0 ? `1px solid ${theme.gray[100]}` : 'none' }}>
          {row.before !== undefined && (
            <DiffLine field={row.key} marker="-" value={row.before} theme={theme} />
          )}
          {row.after !== undefined && (
            <DiffLine field={row.key} marker="+" value={row.after} theme={theme} />
          )}
        </Box>
      ))}
    </Box>
  );
};

const AuditLogPage = () => {
  const theme = useTheme();
  const { permissions } = useAuth();
  const { addNotification } = useNotification();
  const isMaster = permissions.includes('master');

  const [logs, setLogs] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);

  const [actors, setActors] = useState([]);
  const [datePreset, setDatePreset] = useState('30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [actorId, setActorId] = useState('');
  const [activeKinds, setActiveKinds] = useState([]); // KIND_FILTERS.key 배열
  const [search, setSearch] = useState('');

  const { startDate, endDate } = useMemo(() => {
    if (datePreset === 'custom') {
      return {
        startDate: customStart ? new Date(customStart) : null,
        endDate: customEnd ? new Date(customEnd) : null,
      };
    }
    const preset = DATE_PRESETS.find((p) => p.key === datePreset);
    if (!preset?.days) return { startDate: null, endDate: null };
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (preset.days - 1));
    return { startDate: start, endDate: end };
  }, [datePreset, customStart, customEnd]);

  const tables = useMemo(() => {
    if (activeKinds.length === 0) return null;
    return activeKinds.flatMap((k) => KIND_FILTERS.find((f) => f.key === k)?.tables || []);
  }, [activeKinds]);

  const fetchLogs = useCallback(async () => {
    if (!isMaster) return;
    setLoading(true);
    try {
      const { data, count: total } = await getAuditLogs({
        page,
        startDate,
        endDate,
        actorId: actorId || undefined,
        tables,
        search,
      });
      setLogs(data);
      setCount(total);
    } catch (err) {
      addNotification(`로그를 불러오지 못했습니다: ${err.message}`, 'error');
      setLogs([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [isMaster, page, startDate, endDate, actorId, tables, search, addNotification]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!isMaster) return;
    getAuditActors()
      .then(setActors)
      .catch(() => {});
  }, [isMaster]);

  // 필터 변경 시 1페이지로 복귀
  useEffect(() => {
    setPage(1);
  }, [datePreset, customStart, customEnd, actorId, activeKinds, search]);

  const toggleKind = (key) => {
    setActiveKinds((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const totalPages = Math.max(1, Math.ceil(count / AUDIT_PAGE_SIZE));

  if (!isMaster) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">접근 권한이 없습니다.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="로그"
        subtitle="누가·언제·무엇을 바꿨는지 기록합니다. 읽기 전용입니다."
        icon={HistoryIcon}
      />

      {/* 필터 */}
      <SectionCard sx={{ mb: 3 }} padding={16}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              select
              size="small"
              label="기간"
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value)}
              sx={{ minWidth: 140 }}
            >
              {DATE_PRESETS.map((p) => (
                <MenuItem key={p.key} value={p.key}>{p.label}</MenuItem>
              ))}
            </TextField>
            {datePreset === 'custom' && (
              <>
                <DateField
                  label="시작일"
                  size="small"
                  fullWidth={false}
                  sx={{ minWidth: 160 }}
                  value={customStart}
                  onChange={(iso) => setCustomStart(iso || '')}
                />
                <DateField
                  label="종료일"
                  size="small"
                  fullWidth={false}
                  sx={{ minWidth: 160 }}
                  value={customEnd}
                  onChange={(iso) => setCustomEnd(iso || '')}
                />
              </>
            )}
            <TextField
              select
              size="small"
              label="행위자"
              value={actorId}
              onChange={(e) => setActorId(e.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">전체</MenuItem>
              {actors.map((a) => (
                <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              placeholder="대상·요약 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ fontSize: 18, color: 'text.disabled', mr: 0.75 }} />,
              }}
              sx={{ flex: '1 1 240px', minWidth: 200 }}
            />
          </Box>

          {/* 종류 칩 토글 */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            {KIND_FILTERS.map((f) => {
              const active = activeKinds.includes(f.key);
              const palette = theme.palette[KIND_META[f.tables[0]]?.colorKey]?.main || theme.gray[600];
              return (
                <Box
                  key={f.key}
                  onClick={() => toggleKind(f.key)}
                  sx={{
                    cursor: 'pointer',
                    px: 1.5,
                    py: 0.75,
                    borderRadius: `${theme.radii.sm}px`,
                    bgcolor: active ? alpha(palette, 0.1) : 'transparent',
                    border: `1px solid ${active ? alpha(palette, 0.35) : theme.gray[200]}`,
                    color: active ? palette : theme.gray[600],
                    transition: `all 0.15s ${theme.easing.toss}`,
                    '&:hover': { borderColor: alpha(palette, 0.4) },
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1 }}>
                    {f.label}
                  </Typography>
                </Box>
              );
            })}
            <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto' }}>
              총 {count}건
            </Typography>
          </Box>
        </Box>
      </SectionCard>

      {/* 목록 */}
      <SectionCard padding={0}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={HistoryIcon}
            title="기록이 없어요"
            description="선택한 조건에 해당하는 변경 기록이 없습니다."
          />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                  <TableCell sx={{ width: 40 }} />
                  <TableCell sx={{ fontWeight: 700 }}>시각</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>행위자</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>종류</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>대상</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>요약</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((log) => {
                  const open = expandedId === log.id;
                  const targetLabel = `${TARGET_TABLE_LABEL[log.target_table] || log.target_table || '대상'}${
                    log.target_id ? ` #${log.target_id}` : ''
                  }`;
                  return (
                    <React.Fragment key={log.id}>
                      <TableRow
                        hover
                        onClick={() => setExpandedId(open ? null : log.id)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          <IconButton size="small" sx={{ width: 32, height: 32 }}>
                            {open ? <ArrowDownIcon sx={{ fontSize: 18 }} /> : <ArrowRightIcon sx={{ fontSize: 18 }} />}
                          </IconButton>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFeatureSettings: '"tnum" 1', whiteSpace: 'nowrap' }}>
                            {log.created_at ? format(new Date(log.created_at), 'yyyy.MM.dd') : '-'}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1' }}>
                            {log.created_at ? format(new Date(log.created_at), 'HH:mm') : ''}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {log.actor_name || '이름 없음'}
                            </Typography>
                            <RoleChip role={log.actor_role} />
                          </Box>
                        </TableCell>
                        <TableCell>
                          <KindChip table={log.target_table} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                            {targetLabel}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {log.summary || '-'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={6} sx={{ p: 0, borderBottom: open ? undefined : 'none' }}>
                          <Collapse in={open} timeout="auto" unmountOnExit>
                            <Box sx={{ p: 2.5, bgcolor: theme.gray[50] }}>
                              <DiffView
                                before={log.before}
                                after={log.after}
                                action={log.action}
                                theme={theme}
                              />
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </SectionCard>

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, v) => setPage(v)}
            color="primary"
            shape="rounded"
          />
        </Box>
      )}
    </Box>
  );
};

export default AuditLogPage;
