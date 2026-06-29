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
} from '@mui/icons-material';
import QRCode from 'qrcode';
import { supabase } from '../supabaseClient';
import { useNotification } from '../hooks/useNotification';
import { PageHeader, SectionCard, ActionSlot, InfoRow } from './ui';

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

  useEffect(() => {
    fetchSettings();
    fetchEvents();
  }, []);

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

      {/* 소분류·배지 마스터 관리는 상품 관리 화면으로 이동(2026-06-29 건우님 결정) */}
      <Alert
        severity="info"
        icon={<InfoIcon sx={{ fontSize: 18 }} />}
        sx={{ borderRadius: `${theme.radii.md}px`, mb: 3 }}
      >
        <Typography variant="caption" sx={{ color: 'text.primary' }}>
          소분류·배지는 상품 관리 화면(상단 "소분류·배지 관리")에서 관리합니다.
        </Typography>
      </Alert>

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
    </Box>
  );
};

export default SettingsPage;
