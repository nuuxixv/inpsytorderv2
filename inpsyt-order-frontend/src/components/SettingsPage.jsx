import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Tooltip,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  QrCode2 as QrCodeIcon,
  Info as InfoIcon,
  Event as EventIcon,
  LocalShipping as ShippingIcon,
  WarningAmberRounded as WarningIcon,
  AccountTree as AccountTreeIcon,
  Sell as SellIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import QRCode from 'qrcode';
import { supabase } from '../supabaseClient';
import { useNotification } from '../hooks/useNotification';
import {
  fetchSubcategories,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
  fetchBadges,
  createBadge,
  updateBadge,
  deleteBadge,
  fetchMasterUsageCounts,
} from '../api/masters';
import { MASTER_COLOR_PRESETS, MASTER_COLOR_FALLBACK } from '../constants/categoryColors';
import { PageHeader, SectionCard, ActionSlot, InfoRow } from './ui';

const PARENT_CATEGORIES = ['검사', '도서', '도구'];

// 소프트 틴트 칩(C1 §배지 패턴) — 배경 alpha + 진한 글자색. 솔리드 아님.
const SoftChip = ({ label, color }) => {
  const c = color || MASTER_COLOR_FALLBACK;
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        bgcolor: alpha(c, 0.12),
        color: c,
        border: `1px solid ${alpha(c, 0.3)}`,
        fontWeight: 600,
      }}
    />
  );
};

// 색 프리셋 선택 — 자유 hex 금지(AA 대비·토큰 정합). 견본 클릭으로만 선택.
const ColorPresetPicker = ({ value, onChange }) => (
  <Box>
    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75 }}>
      색
    </Typography>
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      {MASTER_COLOR_PRESETS.map((preset) => {
        const selected = value === preset.value;
        return (
          <Tooltip key={preset.value} title={preset.label} arrow>
            <Box
              onClick={() => onChange(preset.value)}
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                bgcolor: preset.value,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: selected ? '2px solid' : '2px solid transparent',
                borderColor: selected ? 'text.primary' : 'transparent',
                transition: 'transform 0.1s',
                '&:hover': { transform: 'scale(1.1)' },
              }}
            >
              {selected && <CheckIcon sx={{ fontSize: 18, color: '#fff' }} />}
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  </Box>
);

// 사양 §발견 2: 리다이렉트 베이스는 VITE_APP_URL 우선, 없으면 현재 origin.
const APP_BASE_URL = import.meta.env?.VITE_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
const REDIRECT_URL = `${APP_BASE_URL}/go`;

// 시스템 정보 — 빌드와 실제로 연동되는 환경 모드만 노출 (가짜 정적값 제거).
const APP_ENV = (import.meta.env?.MODE === 'production') ? 'production' : (import.meta.env?.MODE || 'development');

const SettingsPage = () => {
  const theme = useTheme();
  const { addNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState([]);
  const [settings, setSettings] = useState({
    free_shipping_threshold: 30000,
    shipping_cost: 3000,
    active_event_slug: '',
  });
  // 사양 §핵심 발견 1: active_event_slug 마이그레이션 누락 감지.
  // fetchSettings에서 select 결과에 컬럼이 없으면 true.
  const [activeSlugMissing, setActiveSlugMissing] = useState(false);

  // ── 소분류·배지 마스터 (즉시 저장 — site_settings 일괄저장과 분리) ──
  const [subcategories, setSubcategories] = useState([]);
  const [badges, setBadges] = useState([]);
  const [usage, setUsage] = useState({ subCounts: {}, badgeCounts: {} });
  const [subDialog, setSubDialog] = useState(null); // null | { id?, name, parent_category, color, sort_order, is_active }
  const [badgeDialog, setBadgeDialog] = useState(null); // null | { id?, name, color, priority, is_active }
  const [masterSaving, setMasterSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchEvents();
    loadMasters();
  }, []);

  const loadMasters = async () => {
    try {
      const [subs, bdgs, counts] = await Promise.all([
        fetchSubcategories(),
        fetchBadges(),
        fetchMasterUsageCounts(),
      ]);
      setSubcategories(subs);
      setBadges(bdgs);
      setUsage(counts);
    } catch (error) {
      console.error('Error loading masters:', error);
    }
  };

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, order_url_slug')
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setEvents(data);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .single();

      if (error) throw error;
      if (data) {
        setSettings({
          free_shipping_threshold: data.free_shipping_threshold,
          shipping_cost: data.shipping_cost,
          active_event_slug: data.active_event_slug || '',
        });
        // 사양 §핵심 발견 1: 컬럼 자체가 응답에 없으면 운영 DB 마이그레이션 누락.
        setActiveSlugMissing(!Object.prototype.hasOwnProperty.call(data, 'active_event_slug'));
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      addNotification('설정 정보를 불러오는 데 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('site_settings')
        .update({
          free_shipping_threshold: parseInt(settings.free_shipping_threshold, 10),
          shipping_cost: parseInt(settings.shipping_cost, 10),
          active_event_slug: settings.active_event_slug || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1); // Assuming ID 1 for now, or we can use a more robust way if needed

      if (error) throw error;
      addNotification('설정이 성공적으로 저장되었습니다.', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      addNotification(`설정 저장 실패: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(REDIRECT_URL);
    addNotification('URL이 클립보드에 복사되었습니다.', 'success');
  };

  const handleQrDownload = async () => {
    try {
      const svgStr = await QRCode.toString(REDIRECT_URL, {
        type: 'svg',
        color: { dark: '#252525', light: '#FFFFFF' },
        margin: 1,
        width: 300,
      });
      const blob = new Blob([svgStr], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'qr-inpsytorder-go.svg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addNotification('QR 코드가 다운로드되었습니다.', 'success');
    } catch (err) {
      console.error('QR generation error:', err);
      addNotification('QR 코드 생성에 실패했습니다.', 'error');
    }
  };

  // ── 소분류 마스터 CRUD ──
  const handleSaveSub = async () => {
    const d = subDialog;
    if (!d.name?.trim()) {
      addNotification('소분류 이름을 입력해 주세요.', 'warning');
      return;
    }
    if (!PARENT_CATEGORIES.includes(d.parent_category)) {
      addNotification('소속 대분류를 선택해 주세요.', 'warning');
      return;
    }
    // 같은 대분류 내 이름 중복 검증(자연키 유일성)
    const dup = subcategories.some(
      (s) => s.parent_category === d.parent_category && s.name.trim() === d.name.trim() && s.id !== d.id,
    );
    if (dup) {
      addNotification('같은 대분류에 동일한 이름의 소분류가 이미 있습니다.', 'warning');
      return;
    }
    setMasterSaving(true);
    try {
      const payload = {
        name: d.name.trim(),
        parent_category: d.parent_category,
        color: d.color,
        sort_order: Number(d.sort_order) || 0,
        is_active: d.is_active,
      };
      if (d.id) await updateSubcategory(d.id, payload);
      else await createSubcategory(payload);
      addNotification('소분류가 저장되었습니다.', 'success');
      setSubDialog(null);
      loadMasters();
    } catch (error) {
      addNotification(`소분류 저장 실패: ${error.message}`, 'error');
    } finally {
      setMasterSaving(false);
    }
  };

  const handleDeleteSub = async (sub) => {
    const count = usage.subCounts[sub.name] || 0;
    if (count > 0) {
      addNotification(`이 소분류를 쓰는 상품 ${count}개가 있어 삭제할 수 없습니다.`, 'warning');
      return;
    }
    try {
      await deleteSubcategory(sub.id);
      addNotification('소분류를 삭제했습니다.', 'success');
      loadMasters();
    } catch (error) {
      addNotification(`소분류 삭제 실패: ${error.message}`, 'error');
    }
  };

  const handleToggleSubActive = async (sub) => {
    try {
      await updateSubcategory(sub.id, { is_active: !sub.is_active });
      loadMasters();
    } catch (error) {
      addNotification(`상태 변경 실패: ${error.message}`, 'error');
    }
  };

  // ── 배지 마스터 CRUD ──
  const handleSaveBadge = async () => {
    const d = badgeDialog;
    if (!d.name?.trim()) {
      addNotification('배지 이름을 입력해 주세요.', 'warning');
      return;
    }
    const dup = badges.some((b) => b.name.trim() === d.name.trim() && b.id !== d.id);
    if (dup) {
      addNotification('동일한 이름의 배지가 이미 있습니다.', 'warning');
      return;
    }
    setMasterSaving(true);
    try {
      const payload = {
        name: d.name.trim(),
        color: d.color,
        priority: Number(d.priority) || 0,
        is_active: d.is_active,
      };
      if (d.id) await updateBadge(d.id, payload);
      else await createBadge(payload);
      addNotification('배지가 저장되었습니다.', 'success');
      setBadgeDialog(null);
      loadMasters();
    } catch (error) {
      addNotification(`배지 저장 실패: ${error.message}`, 'error');
    } finally {
      setMasterSaving(false);
    }
  };

  const handleDeleteBadge = async (badge) => {
    const count = usage.badgeCounts[badge.name] || 0;
    if (count > 0) {
      addNotification(`이 배지를 쓰는 상품 ${count}개가 있어 삭제할 수 없습니다.`, 'warning');
      return;
    }
    try {
      await deleteBadge(badge.id);
      addNotification('배지를 삭제했습니다.', 'success');
      loadMasters();
    } catch (error) {
      addNotification(`배지 삭제 실패: ${error.message}`, 'error');
    }
  };

  const handleToggleBadgeActive = async (badge) => {
    try {
      await updateBadge(badge.id, { is_active: !badge.is_active });
      loadMasters();
    } catch (error) {
      addNotification(`상태 변경 실패: ${error.message}`, 'error');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const activeEventName = events.find((e) => e.order_url_slug === settings.active_event_slug)?.name;
  const threshold = parseInt(settings.free_shipping_threshold, 10) || 0;
  const shipping = parseInt(settings.shipping_cost, 10) || 0;

  return (
    <Box>
      <PageHeader
        title="설정"
        subtitle="리다이렉트 학회 · 배송비 · 시스템 정보"
        icon={SettingsIcon}
      />

      {/* 블록 1 — 리다이렉트 학회 관리 */}
      <SectionCard
        title="리다이렉트 학회 관리"
        subtitle="/go 경로로 접속 시 자동으로 이동할 학회를 설정합니다. QR 코드를 인쇄물에 활용할 수 있습니다."
        icon={EventIcon}
        sx={{ mb: 3 }}
        padding={24}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
          <FormControl size="small" fullWidth>
            <InputLabel id="active-event-label">활성 학회 선택</InputLabel>
            <Select
              labelId="active-event-label"
              value={settings.active_event_slug}
              label="활성 학회 선택"
              onChange={(e) => setSettings({ ...settings, active_event_slug: e.target.value })}
            >
              <MenuItem value="">
                <Typography variant="body2" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                  선택 안 함 (비활성)
                </Typography>
              </MenuItem>
              {events.map((event) => (
                <MenuItem key={event.id} value={event.order_url_slug}>
                  <Box>
                    <Typography variant="body2" sx={{ color: 'text.primary' }}>
                      {event.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.disabled' }}
                    >
                      {event.order_url_slug}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* URL 안내 카드 — 시안 답습 */}
          <Box
            sx={{
              p: 2,
              borderRadius: `${theme.radii.md}px`,
              bgcolor: theme.gray[50],
              border: `1px solid ${theme.gray[200]}`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
              <QrCodeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                리다이렉트 URL
              </Typography>
            </Box>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 500,
                color: 'text.primary',
                wordBreak: 'break-all',
                mb: 0.5,
              }}
            >
              {REDIRECT_URL}
            </Typography>
            {settings.active_event_slug ? (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {activeEventName ? `${activeEventName} 주문 페이지로 자동 이동` : '활성 학회 주문 페이지로 자동 이동'}
              </Typography>
            ) : (
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                활성 학회 미설정 — /go 진입 시 안내 화면
              </Typography>
            )}

            <ActionSlot justify="flex-start" sx={{ mt: 1.5 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<CopyIcon sx={{ fontSize: 16 }} />}
                onClick={handleCopyUrl}
                sx={{ minHeight: 36 }}
              >
                URL 복사
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
                onClick={handleQrDownload}
                sx={{ minHeight: 36 }}
              >
                QR 다운로드 (SVG)
              </Button>
            </ActionSlot>
          </Box>

          {/* 사양 §핵심 발견 1: active_event_slug 마이그레이션 누락 감지 시 노출 */}
          {activeSlugMissing && (
            <Alert
              severity="warning"
              icon={<WarningIcon sx={{ fontSize: 18 }} />}
              sx={{ borderRadius: `${theme.radii.md}px`, py: 0.75 }}
            >
              <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 600, display: 'block' }}>
                잠재 부채: active_event_slug 컬럼 마이그레이션 누락
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                현재 환경의 site_settings 응답에 컬럼이 없습니다. 신규 환경 부트스트랩 시 진입 실패 가능 — supabase/migrations에 ALTER 추가 필요.
              </Typography>
            </Alert>
          )}
        </Box>
      </SectionCard>

      {/* 블록 2 — 배송비 정책 */}
      <SectionCard
        title="배송비 정책"
        subtitle="주문 금액에 따른 배송비 및 무료 배송 기준을 설정합니다. 현장 판매는 배송비가 적용되지 않습니다."
        icon={ShippingIcon}
        sx={{ mb: 3 }}
        padding={24}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            size="small"
            fullWidth
            label="무료 배송 기준 금액"
            type="number"
            value={settings.free_shipping_threshold}
            onChange={(e) => setSettings({ ...settings, free_shipping_threshold: e.target.value })}
            InputProps={{
              endAdornment: <InputAdornment position="end">원</InputAdornment>,
            }}
            helperText="이 금액 이상 구매 시 배송비가 0원이 됩니다."
          />
          <TextField
            size="small"
            fullWidth
            label="배송비"
            type="number"
            value={settings.shipping_cost}
            onChange={(e) => setSettings({ ...settings, shipping_cost: e.target.value })}
            InputProps={{
              endAdornment: <InputAdornment position="end">원</InputAdornment>,
            }}
            helperText="기준 금액 미만 구매 시 부과되는 배송비입니다."
          />

          {/* 정책 요약 — 시안 답습. 입력값 즉시 반영 미리보기. */}
          <Box
            sx={{
              p: 1.5,
              borderRadius: `${theme.radii.sm}px`,
              bgcolor: alpha(theme.palette.primary.main, 0.04),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
            }}
          >
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}
            >
              현재 정책 요약
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: 'text.primary', lineHeight: 1.6, fontFeatureSettings: '"tnum" 1' }}
            >
              <Box component="span" sx={{ fontWeight: 700, color: theme.palette.primary.main }}>
                {threshold.toLocaleString()}원
              </Box>
              {' 이상 구매 시 무료 · 미만 구매 시 '}
              <Box component="span" sx={{ fontWeight: 700, color: theme.palette.primary.main }}>
                {shipping.toLocaleString()}원
              </Box>
              {' 부과'}
            </Typography>
          </Box>
        </Box>
      </SectionCard>

      {/* 블록 3 — 시스템 정보 (시안 답습, readonly 노출) */}
      <SectionCard
        title="시스템 정보"
        subtitle="현재 환경의 빌드 정보입니다."
        icon={InfoIcon}
        sx={{ mb: 3 }}
        padding={24}
      >
        <Box sx={{ mt: 1 }}>
          <InfoRow
            label="환경"
            value={
              <Box
                component="span"
                sx={{
                  display: 'inline-block',
                  px: 0.75,
                  py: 0.25,
                  borderRadius: `${theme.radii.sm}px`,
                  bgcolor: alpha(
                    APP_ENV === 'production' ? theme.palette.success.main : theme.palette.warning.main,
                    0.1,
                  ),
                  border: `1px solid ${alpha(
                    APP_ENV === 'production' ? theme.palette.success.main : theme.palette.warning.main,
                    0.25,
                  )}`,
                  color: APP_ENV === 'production' ? theme.palette.success.main : theme.palette.warning.main,
                  ...theme.typography.caption,
                  fontWeight: 700,
                }}
              >
                {APP_ENV}
              </Box>
            }
          />
        </Box>
      </SectionCard>

      {/* 블록 4 — 소분류 관리 (마스터 즉시 저장 — 하단 저장하기와 분리) */}
      <SectionCard
        title="소분류 관리"
        subtitle="대분류(검사/도서/도구) 하위의 분류입니다. 고객 주문서에서 칩으로 노출되며 탐색에 쓰입니다. (매출 집계에는 영향 없음)"
        icon={AccountTreeIcon}
        sx={{ mb: 3 }}
        padding={24}
        action={
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setSubDialog({ name: '', parent_category: '', color: MASTER_COLOR_PRESETS[0].value, sort_order: 0, is_active: true })}
          >
            소분류 추가
          </Button>
        }
      >
        <Box sx={{ mt: 1 }}>
          <Alert severity="info" icon={false} sx={{ borderRadius: `${theme.radii.sm}px`, py: 0.5, mb: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              추가·수정·삭제는 즉시 적용됩니다. (하단 "저장하기"는 배송비·리다이렉트 설정 전용)
            </Typography>
          </Alert>
          {subcategories.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.disabled', py: 2, textAlign: 'center' }}>
              등록된 소분류가 없습니다 · 추가해 시작하세요
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {subcategories.map((sub) => {
                const count = usage.subCounts[sub.name] || 0;
                return (
                  <Box
                    key={sub.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      py: 1,
                      borderBottom: `1px solid ${theme.gray[100]}`,
                      opacity: sub.is_active ? 1 : 0.5,
                    }}
                  >
                    <SoftChip label={sub.name} color={sub.color} />
                    <Chip label={sub.parent_category} size="small" variant="outlined" color="primary" />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      순서 {sub.sort_order}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      · 상품 {count}개
                    </Typography>
                    <Box sx={{ flexGrow: 1 }} />
                    <Tooltip title={sub.is_active ? '활성 (신규 선택지에 노출)' : '비활성 (숨김)'} arrow>
                      <Switch size="small" checked={sub.is_active} onChange={() => handleToggleSubActive(sub)} />
                    </Tooltip>
                    <IconButton size="small" onClick={() => setSubDialog({ ...sub })}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <Tooltip title={count > 0 ? `상품 ${count}개 연결 — 삭제 불가` : '삭제'} arrow>
                      <span>
                        <IconButton size="small" onClick={() => handleDeleteSub(sub)} disabled={count > 0} sx={{ color: count > 0 ? 'text.disabled' : 'error.main' }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      </SectionCard>

      {/* 블록 5 — 배지 관리 */}
      <SectionCard
        title="배지 관리"
        subtitle="상품 카드에 표시되는 강조 라벨입니다. (예: 추천, 한정) 카드당 최대 2개가 우선순위 순으로 노출됩니다."
        icon={SellIcon}
        sx={{ mb: 3 }}
        padding={24}
        action={
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setBadgeDialog({ name: '', color: MASTER_COLOR_PRESETS[0].value, priority: 0, is_active: true })}
          >
            배지 추가
          </Button>
        }
      >
        <Box sx={{ mt: 1 }}>
          <Alert severity="info" icon={false} sx={{ borderRadius: `${theme.radii.sm}px`, py: 0.5, mb: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              인기·신상품·할인 배지는 상품별 체크박스로 별도 관리됩니다(상품 관리 화면).
            </Typography>
          </Alert>
          {badges.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.disabled', py: 2, textAlign: 'center' }}>
              등록된 배지가 없습니다 · 추가해 시작하세요
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {badges.map((badge) => {
                const count = usage.badgeCounts[badge.name] || 0;
                return (
                  <Box
                    key={badge.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      py: 1,
                      borderBottom: `1px solid ${theme.gray[100]}`,
                      opacity: badge.is_active ? 1 : 0.5,
                    }}
                  >
                    <SoftChip label={badge.name} color={badge.color} />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      우선순위 {badge.priority}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      · 상품 {count}개
                    </Typography>
                    <Box sx={{ flexGrow: 1 }} />
                    <Tooltip title={badge.is_active ? '활성 (신규 선택지에 노출)' : '비활성 (숨김)'} arrow>
                      <Switch size="small" checked={badge.is_active} onChange={() => handleToggleBadgeActive(badge)} />
                    </Tooltip>
                    <IconButton size="small" onClick={() => setBadgeDialog({ ...badge })}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <Tooltip title={count > 0 ? `상품 ${count}개 연결 — 삭제 불가` : '삭제'} arrow>
                      <span>
                        <IconButton size="small" onClick={() => handleDeleteBadge(badge)} disabled={count > 0} sx={{ color: count > 0 ? 'text.disabled' : 'error.main' }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      </SectionCard>

      {/* 안내 Alert — 사양 §하단 안내 */}
      <Alert
        severity="info"
        icon={<InfoIcon sx={{ fontSize: 18 }} />}
        sx={{ borderRadius: `${theme.radii.md}px`, mb: 3 }}
      >
        <Typography variant="caption" sx={{ color: 'text.primary' }}>
          설정 변경 사항은 즉시 적용됩니다. (이미 생성된 주문에는 영향을 주지 않으며, 신규 주문부터 적용됩니다.)
        </Typography>
      </Alert>

      {/* 액션 — 사양 §블록 3 */}
      <ActionSlot>
        <Button
          variant="outlined"
          onClick={fetchSettings}
          disabled={saving}
          sx={{ minHeight: 44 }}
        >
          취소
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          sx={{ minHeight: 44, fontWeight: 700 }}
        >
          {saving ? <CircularProgress size={20} /> : '저장하기'}
        </Button>
      </ActionSlot>

      {/* 소분류 추가/수정 다이얼로그 */}
      <Dialog open={Boolean(subDialog)} onClose={() => setSubDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{subDialog?.id ? '소분류 수정' : '소분류 추가'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2 }}>
          <TextField
            autoFocus
            label="소분류 이름"
            size="small"
            fullWidth
            value={subDialog?.name || ''}
            onChange={(e) => setSubDialog((p) => ({ ...p, name: e.target.value }))}
          />
          <FormControl size="small" fullWidth>
            <InputLabel id="sub-parent-label">소속 대분류</InputLabel>
            <Select
              labelId="sub-parent-label"
              label="소속 대분류"
              value={subDialog?.parent_category || ''}
              onChange={(e) => setSubDialog((p) => ({ ...p, parent_category: e.target.value }))}
            >
              {PARENT_CATEGORIES.map((cat) => (
                <MenuItem key={cat} value={cat}>{cat}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <ColorPresetPicker value={subDialog?.color} onChange={(c) => setSubDialog((p) => ({ ...p, color: c }))} />
          <TextField
            label="정렬 순서"
            type="number"
            size="small"
            fullWidth
            value={subDialog?.sort_order ?? 0}
            onChange={(e) => setSubDialog((p) => ({ ...p, sort_order: e.target.value }))}
            helperText="고객 화면 칩 노출 순서 (작을수록 먼저)"
          />
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>미리보기</Typography>
            <SoftChip label={subDialog?.name || '소분류'} color={subDialog?.color} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSubDialog(null)} disabled={masterSaving}>취소</Button>
          <Button variant="contained" onClick={handleSaveSub} disabled={masterSaving}>
            {masterSaving ? <CircularProgress size={18} /> : '저장'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 배지 추가/수정 다이얼로그 */}
      <Dialog open={Boolean(badgeDialog)} onClose={() => setBadgeDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{badgeDialog?.id ? '배지 수정' : '배지 추가'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2 }}>
          <TextField
            autoFocus
            label="배지 이름"
            size="small"
            fullWidth
            value={badgeDialog?.name || ''}
            onChange={(e) => setBadgeDialog((p) => ({ ...p, name: e.target.value }))}
          />
          <ColorPresetPicker value={badgeDialog?.color} onChange={(c) => setBadgeDialog((p) => ({ ...p, color: c }))} />
          <TextField
            label="우선순위"
            type="number"
            size="small"
            fullWidth
            value={badgeDialog?.priority ?? 0}
            onChange={(e) => setBadgeDialog((p) => ({ ...p, priority: e.target.value }))}
            helperText="카드당 최대 2개 노출 시 정렬 기준 (작을수록 먼저)"
          />
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>미리보기</Typography>
            <SoftChip label={badgeDialog?.name || '배지'} color={badgeDialog?.color} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setBadgeDialog(null)} disabled={masterSaving}>취소</Button>
          <Button variant="contained" onClick={handleSaveBadge} disabled={masterSaving}>
            {masterSaving ? <CircularProgress size={18} /> : '저장'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SettingsPage;
