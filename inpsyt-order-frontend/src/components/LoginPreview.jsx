import React, { useMemo, useRef, useState } from 'react';
import {
  Box, Typography, Button, TextField, Alert, IconButton, Snackbar,
  useTheme, CircularProgress,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ArrowBack as ArrowBackIcon,
  Shield as ShieldIcon,
  Store as StoreIcon,
  LocalShipping as ShippingIcon,
  Person as PersonIcon,
  Dialpad as DialpadIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';

/**
 * DEV-ONLY keystone: /preview/login.
 * 어드민 로그인 디자인 시안 — 실 LoginPage.jsx 사양 1:1 반영.
 * 사양 시트: design-system/specs/A8_LoginPage.md
 *
 * 핵심 발견 반영(사양 시트 §핵심 발견):
 *  1. 멀티스텝 3단계 — 단일 화면으로 단순화 금지
 *  2. PIN 6자리 자동 제출 — 100ms setTimeout 약속
 *  3. 모든 user_profiles 익명 SELECT 노출
 *  4. fulfillment 슬러그(접미사 없음)는 dead branch — 시안에서 표시만
 *  5. PIN type=password 유지(쇼울더서핑) + helperText "N / 6"
 *  6. 에러 한글화
 *  7. 100ms 자동 제출 — 중복 발화 방지(handlingSubmitRef)
 *  8. 라운드 토큰 흡수
 *
 * PreviewShell 없음 — 로그인 전 전체 화면.
 */

// ─── Mock 데이터 ───────────────────────────────────────────────

const ROLE_LABELS = {
  master:      { label: '마스터',       icon: ShieldIcon },
  onsite:      { label: '현장 마케팅',  icon: StoreIcon },
  fulfillment: { label: '출고',         icon: ShippingIcon },
};

// 사양 §발견 4: fulfillment(접미사 없음)는 dead branch.
// 실제로는 fulfillment_book / fulfillment_test 두 슬러그만 시드되지만,
// LoginPage 코드에는 fulfillment 분기도 있다(usersForRole). 시안은 코드를 따라간다.
const MOCK_USER_PROFILES = [
  { id: 'p-001', email: 'kimgw_a1b2c@inpsytorder.com',  name: '김건우', role: 'master' },
  { id: 'p-002', email: 'leesj_d4e5f@inpsytorder.com',  name: '이수정', role: 'master' },
  { id: 'p-003', email: 'parkjh_g7h8i@inpsytorder.com', name: '박지훈', role: 'onsite' },
  { id: 'p-004', email: 'choisy_j0k1l@inpsytorder.com', name: '최서연', role: 'onsite' },
  { id: 'p-005', email: 'jeongde_m2n3o@inpsytorder.com', name: '정다은', role: 'onsite' },
  { id: 'p-006', email: 'kangmh_p4q5r@inpsytorder.com', name: '강민호', role: 'fulfillment_book' },
  { id: 'p-007', email: 'yoonjw_s6t7u@inpsytorder.com', name: '윤지우', role: 'fulfillment_book' },
  { id: 'p-008', email: 'hanjh_v8w9x@inpsytorder.com',  name: '한지훈', role: 'fulfillment_test' },
];

// 사양 §시나리오: PIN 6자리. 시안에서는 mock으로 '123456'만 통과.
const MOCK_VALID_PIN = '123456';

const AVAILABLE_ROLES = ['master', 'onsite', 'fulfillment'];

// ─── 스텝 인디케이터 ───────────────────────────────────────────

const StepIndicator = ({ currentStep }) => {
  const theme = useTheme();
  const steps = [
    { idx: 0, label: '역할' },
    { idx: 1, label: '담당자' },
    { idx: 2, label: 'PIN' },
  ];
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 3 }}>
      {steps.map((s, i) => {
        const done = currentStep > s.idx;
        const active = currentStep === s.idx;
        const color = done
          ? theme.palette.success.main
          : active
            ? theme.palette.primary.main
            : theme.gray[300];
        return (
          <React.Fragment key={s.idx}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box
                sx={{
                  width: 24, height: 24,
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  bgcolor: done ? color : 'transparent',
                  border: `1.5px solid ${color}`,
                  color: done ? 'common.white' : color,
                  transition: `all 0.2s ${theme.easing.toss}`,
                }}
              >
                {done ? (
                  <CheckCircleIcon sx={{ fontSize: 14, color: 'common.white' }} />
                ) : (
                  <Typography variant="caption" sx={{ fontWeight: 700, color, lineHeight: 1 }}>
                    {s.idx + 1}
                  </Typography>
                )}
              </Box>
              <Typography
                variant="caption"
                sx={{
                  color: active ? 'text.primary' : 'text.secondary',
                  fontWeight: active ? 700 : 500,
                }}
              >
                {s.label}
              </Typography>
            </Box>
            {i < steps.length - 1 && (
              <Box sx={{ width: 20, height: 1, bgcolor: theme.gray[300] }} />
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
};

// ─── 메인 ──────────────────────────────────────────────────────

const LoginPreview = () => {
  const theme = useTheme();
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const handlingSubmitRef = useRef(false);

  const usersForRole = useMemo(() => {
    if (!selectedRole) return [];
    // 사양 line 88-93: fulfillment는 세 슬러그 묶음. dead branch 포함.
    if (selectedRole === 'fulfillment') {
      return MOCK_USER_PROFILES.filter(
        u => u.role === 'fulfillment' || u.role === 'fulfillment_book' || u.role === 'fulfillment_test',
      );
    }
    return MOCK_USER_PROFILES.filter(u => u.role === selectedRole);
  }, [selectedRole]);

  const currentStep = selectedUser ? 2 : selectedRole ? 1 : 0;

  const headingText = useMemo(() => {
    if (!selectedRole) return '역할을 선택해주세요';
    if (!selectedUser) return `${ROLE_LABELS[selectedRole].label} 선택`;
    return `${selectedUser.name} 님, 환영합니다`;
  }, [selectedRole, selectedUser]);

  const handleBack = () => {
    setError('');
    if (selectedUser) {
      setSelectedUser(null);
      setPin('');
      return;
    }
    if (selectedRole) {
      setSelectedRole(null);
    }
  };

  const submitLogin = (pinValue) => {
    if (handlingSubmitRef.current) return;
    handlingSubmitRef.current = true;
    setLoading(true);
    setError('');
    setTimeout(() => {
      if (pinValue === MOCK_VALID_PIN) {
        setSnackbar({ open: true, message: `${selectedUser.name} 님 로그인 성공 (mock) — /admin으로 이동` });
      } else {
        setError('비밀번호(PIN)가 일치하지 않습니다.');
        setPin('');
      }
      setLoading(false);
      handlingSubmitRef.current = false;
    }, 500);
  };

  const handlePinChange = (e) => {
    const next = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(next);
    if (next.length === 6) {
      // 사양 §발견 2: 6자리 도달 시 100ms 후 자동 제출
      setTimeout(() => submitLogin(next), 100);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (pin.length === 6) submitLogin(pin);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 420,
          bgcolor: 'background.paper',
          borderRadius: `${theme.radii.lg}px`,
          border: `1px solid ${theme.gray[200]}`,
          boxShadow: theme.customShadows.lg,
          p: { xs: 3, sm: 4 },
          position: 'relative',
        }}
      >
        {/* 뒤로가기 */}
        {(selectedRole || selectedUser) && (
          <IconButton
            onClick={handleBack}
            aria-label="뒤로가기"
            sx={{
              position: 'absolute',
              top: 16,
              left: 16,
              width: 36,
              height: 36,
              color: theme.gray[600],
              '&:hover': { bgcolor: theme.gray[50] },
            }}
          >
            <ArrowBackIcon sx={{ fontSize: 20 }} />
          </IconButton>
        )}

        {/* 로고 */}
        <Box sx={{ textAlign: 'center', mb: 3, mt: (selectedRole || selectedUser) ? 1 : 0 }}>
          <Box
            sx={{
              width: 56, height: 56, mx: 'auto', mb: 1.5,
              borderRadius: `${theme.radii.md}px`,
              bgcolor: theme.gray[900],
              color: 'common.white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              ...theme.typography.h2,
            }}
          >
            IP
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            인싸이트 현장주문 어드민
          </Typography>
        </Box>

        {/* 스텝 인디케이터 */}
        <StepIndicator currentStep={currentStep} />

        {/* 헤딩 */}
        <Typography
          component="h1"
          variant="h4"
          sx={{ textAlign: 'center', color: 'text.primary', mb: 2.5 }}
        >
          {headingText}
        </Typography>

        {/* 에러 알림 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: `${theme.radii.md}px` }}>
            {error}
          </Alert>
        )}

        {/* Step 1 — 역할 선택 */}
        {currentStep === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {AVAILABLE_ROLES.map(role => {
              const meta = ROLE_LABELS[role];
              const Icon = meta.icon;
              return (
                <Button
                  key={role}
                  variant="outlined"
                  fullWidth
                  size="large"
                  onClick={() => setSelectedRole(role)}
                  sx={{
                    py: 2,
                    flexDirection: 'column',
                    gap: 0.75,
                    borderColor: theme.gray[200],
                    color: 'text.secondary',
                    '&:hover': {
                      borderColor: theme.palette.primary.main,
                      bgcolor: alpha(theme.palette.primary.main, 0.04),
                      color: theme.palette.primary.main,
                    },
                  }}
                >
                  <Icon sx={{ fontSize: 28 }} />
                  <Typography variant="subtitle1" sx={{ color: 'inherit', lineHeight: 1 }}>
                    {meta.label}
                  </Typography>
                </Button>
              );
            })}
          </Box>
        )}

        {/* Step 2 — 담당자 선택 */}
        {currentStep === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {usersForRole.length === 0 ? (
              <Alert severity="info" sx={{ borderRadius: `${theme.radii.md}px` }}>
                등록된 담당자가 없습니다.
              </Alert>
            ) : (
              usersForRole.map(u => (
                <Button
                  key={u.id}
                  variant="contained"
                  fullWidth
                  size="large"
                  startIcon={<PersonIcon sx={{ fontSize: 20 }} />}
                  onClick={() => setSelectedUser(u)}
                  sx={{ py: 1.5, justifyContent: 'flex-start' }}
                >
                  <Typography variant="subtitle1" sx={{ color: 'inherit', flex: 1, textAlign: 'left', ml: 1 }}>
                    {u.name}
                  </Typography>
                </Button>
              ))
            )}
            {/* 사양 §보안 항목: user_profiles 익명 SELECT 안내 */}
            <Typography variant="caption" sx={{ color: 'text.disabled', textAlign: 'center', mt: 1 }}>
              학회 부스 환경에서는 의도된 노출
            </Typography>
          </Box>
        )}

        {/* Step 3 — PIN 입력 */}
        {currentStep === 2 && (
          <Box component="form" onSubmit={handleFormSubmit}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75, mb: 2, color: 'text.secondary' }}>
              <DialpadIcon sx={{ fontSize: 16 }} />
              <Typography variant="caption" sx={{ color: 'inherit' }}>
                비밀번호(PIN)를 입력하세요
              </Typography>
            </Box>
            <TextField
              fullWidth
              type="password"
              name="password"
              autoFocus
              placeholder="••••••"
              value={pin}
              onChange={handlePinChange}
              disabled={loading}
              inputProps={{
                inputMode: 'numeric',
                pattern: '[0-9]*',
                maxLength: 6,
                style: {
                  textAlign: 'center',
                  letterSpacing: '0.5em',
                  fontFeatureSettings: '"tnum" 1',
                },
              }}
              helperText={
                <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>숫자 6자리</span>
                  <Box
                    component="span"
                    sx={{
                      fontFeatureSettings: '"tnum" 1',
                      color: pin.length === 6 ? theme.palette.success.main : 'text.disabled',
                      fontWeight: 700,
                    }}
                  >
                    {pin.length} / 6
                  </Box>
                </Box>
              }
              sx={{ mb: 2 }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading || pin.length !== 6}
              sx={{ py: 1.5 }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : '로그인'}
            </Button>
            <Typography variant="caption" sx={{ color: 'text.disabled', textAlign: 'center', display: 'block', mt: 1.5 }}>
              시안 mock — 올바른 PIN: <Box component="code" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: 'text.secondary' }}>{MOCK_VALID_PIN}</Box>
            </Typography>
          </Box>
        )}
      </Box>

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
    </Box>
  );
};

export default LoginPreview;
