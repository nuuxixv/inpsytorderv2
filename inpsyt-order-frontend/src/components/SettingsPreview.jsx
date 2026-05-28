import React, { useState } from 'react';
import {
  Box, Typography, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  IconButton, Snackbar, Alert, useTheme, InputAdornment,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Settings as SettingsIcon,
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Close as CloseIcon,
  QrCode2 as QrCodeIcon,
  Info as InfoIcon,
  Event as EventIcon,
  LocalShipping as ShippingIcon,
  WarningAmberRounded as WarningIcon,
} from '@mui/icons-material';
import { PageHeader, SectionCard, ActionSlot, InfoRow } from './ui';
import PreviewShell from './preview/PreviewShell';

/**
 * DEV-ONLY keystone: /preview/settings.
 * 어드민 설정 디자인 시안 — 실 SettingsPage.jsx 사양 1:1 반영.
 * 사양 시트: design-system/specs/A8_SettingsPage.md
 *
 * 핵심 발견 반영(사양 시트 §핵심 발견):
 *  1. active_event_slug 마이그레이션 누락 — 시안에서 토스트로 안내
 *  2. prod URL 하드코딩 — 시안에서 표시(env별 안내)
 *  3. 권한 체크 없음 — 라우팅 가드 의존
 *  4. email_domains 컬럼 미노출
 *  5. 신규 주문에만 적용 안내 Alert
 *  6. QR은 SVG만
 *  7. "없음" italic 옵션 명확화
 */

const MOCK_EVENTS = [
  { id: 'e1', name: '2026년 한국심리학회 연차학술대회', slug: 'kpa-2026-annual', created_at: '2026-04-12T10:00:00' },
  { id: 'e2', name: '2026 한국임상심리학회 봄학술대회', slug: 'kcp-2026-spring', created_at: '2026-03-20T10:00:00' },
  { id: 'e3', name: '2026 한국상담심리학회 연차대회', slug: 'kacp-2026', created_at: '2026-02-15T10:00:00' },
];

const REDIRECT_URL = 'https://inpsytorder.vercel.app/go';
const APP_VERSION = 'v2.4.1';
const APP_ENV = 'production';

const SettingsPreview = () => {
  const theme = useTheme();
  const [activeEventSlug, setActiveEventSlug] = useState('kpa-2026-annual');
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(30000);
  const [shippingCost, setShippingCost] = useState(3000);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  const toast = (msg) => setSnackbar({ open: true, message: msg });

  const handleCopy = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(REDIRECT_URL).catch(() => {});
    }
    toast('URL이 클립보드에 복사되었습니다.');
  };

  const handleQrDownload = () => {
    toast('QR 코드를 다운로드했습니다. (qr-inpsytorder-go.svg)');
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast('설정이 저장되었습니다. (mock)');
    }, 600);
  };

  const handleCancel = () => {
    setActiveEventSlug('kpa-2026-annual');
    setFreeShippingThreshold(30000);
    setShippingCost(3000);
    toast('변경 사항을 폐기했습니다.');
  };

  const activeEventName = MOCK_EVENTS.find(e => e.slug === activeEventSlug)?.name;

  return (
    <PreviewShell activePath="/admin/settings">
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
            <InputLabel>활성 학회 선택</InputLabel>
            <Select
              value={activeEventSlug}
              label="활성 학회 선택"
              onChange={(e) => setActiveEventSlug(e.target.value)}
            >
              <MenuItem value="">
                <Typography variant="body2" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                  선택 안 함 (비활성)
                </Typography>
              </MenuItem>
              {MOCK_EVENTS.map(e => (
                <MenuItem key={e.id} value={e.slug}>
                  <Box>
                    <Typography variant="body2" sx={{ color: 'text.primary' }}>{e.name}</Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.disabled',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      }}
                    >
                      {e.slug}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* URL 안내 카드 */}
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
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontWeight: 500,
                color: 'text.primary',
                wordBreak: 'break-all',
                mb: 0.5,
              }}
            >
              {REDIRECT_URL}
            </Typography>
            {activeEventSlug ? (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {activeEventName} 주문 페이지로 자동 이동
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
                onClick={handleCopy}
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

          {/* 사양 §핵심 발견 1: 마이그레이션 누락 안내 */}
          <Alert
            severity="warning"
            icon={<WarningIcon sx={{ fontSize: 18 }} />}
            sx={{ borderRadius: `${theme.radii.md}px`, py: 0.75 }}
          >
            <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 600, display: 'block' }}>
              잠재 부채: active_event_slug 컬럼 마이그레이션 누락
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              운영 DB에는 추가돼 있지만 supabase/migrations/에 SQL이 없습니다. 신규 환경 부트스트랩 시 진입 실패 가능.
            </Typography>
          </Alert>
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
            value={freeShippingThreshold}
            onChange={(e) => setFreeShippingThreshold(parseInt(e.target.value, 10) || 0)}
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
            value={shippingCost}
            onChange={(e) => setShippingCost(parseInt(e.target.value, 10) || 0)}
            InputProps={{
              endAdornment: <InputAdornment position="end">원</InputAdornment>,
            }}
            helperText="기준 금액 미만 구매 시 부과되는 배송비입니다."
          />

          {/* 정책 요약 — 시각 위계 */}
          <Box
            sx={{
              p: 1.5,
              borderRadius: `${theme.radii.sm}px`,
              bgcolor: alpha(theme.palette.primary.main, 0.04),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
            }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}>
              현재 정책 요약
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.primary', lineHeight: 1.6, fontFeatureSettings: '"tnum" 1' }}>
              <Box component="span" sx={{ fontWeight: 700, color: theme.palette.primary.main }}>
                {freeShippingThreshold.toLocaleString()}원
              </Box>
              {' 이상 구매 시 무료 · 미만 구매 시 '}
              <Box component="span" sx={{ fontWeight: 700, color: theme.palette.primary.main }}>
                {shippingCost.toLocaleString()}원
              </Box>
              {' 부과'}
            </Typography>
          </Box>
        </Box>
      </SectionCard>

      {/* 블록 3 — 시스템 정보 (사양 시트에 없는 추가 정보지만 readonly 노출만, 위임 지시서 §화면 구조 명시) */}
      <SectionCard
        title="시스템 정보"
        subtitle="현재 환경의 빌드 정보입니다."
        icon={InfoIcon}
        sx={{ mb: 3 }}
        padding={24}
      >
        <Box sx={{ mt: 1 }}>
          <InfoRow label="버전" value={APP_VERSION} mono />
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
                  bgcolor: alpha(theme.palette.success.main, 0.1),
                  border: `1px solid ${alpha(theme.palette.success.main, 0.25)}`,
                  color: theme.palette.success.main,
                  ...theme.typography.caption,
                  fontWeight: 700,
                }}
              >
                {APP_ENV}
              </Box>
            }
          />
          <InfoRow label="배포일" value="2026.05.27 14:22" mono />
          <InfoRow label="DB 리전" value="ap-northeast-2" mono />
        </Box>
      </SectionCard>

      {/* 안내 Alert */}
      <Alert
        severity="info"
        icon={<InfoIcon sx={{ fontSize: 18 }} />}
        sx={{ borderRadius: `${theme.radii.md}px`, mb: 3 }}
      >
        <Typography variant="caption" sx={{ color: 'text.primary' }}>
          설정 변경 사항은 즉시 적용됩니다. (이미 생성된 주문에는 영향을 주지 않으며, 신규 주문부터 적용됩니다.)
        </Typography>
      </Alert>

      {/* 액션 */}
      <ActionSlot>
        <Button variant="outlined" onClick={handleCancel} disabled={saving} sx={{ minHeight: 44 }}>
          취소
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ minHeight: 44 }}>
          {saving ? '저장 중...' : '저장하기'}
        </Button>
      </ActionSlot>

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

export default SettingsPreview;
