import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  CircularProgress,
  CssBaseline,
  IconButton,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ArrowBack as ArrowBackIcon,
  Dialpad as DialpadIcon,
  Person as PersonIcon,
  Shield as ShieldIcon,
  LocalShipping as ShippingIcon,
  Storefront as StoreIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';

// 사양 §표시 정보 — Step 1 역할 큰 버튼 라벨/아이콘
const ROLE_LABELS = {
  master:      { label: '마스터',       icon: ShieldIcon },
  onsite:      { label: '현장 마케팅',  icon: StoreIcon },
  fulfillment: { label: '출고',         icon: ShippingIcon },
};

const AVAILABLE_ROLES = ['master', 'onsite', 'fulfillment'];

// ─── 숫자 단축키 배지 (kbd) ─────────────────────────────────────
const KbdBadge = ({ children, sx }) => {
  const theme = useTheme();
  return (
    <Box
      component="span"
      sx={{
        flexShrink: 0,
        width: 18,
        height: 18,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: `${theme.radii.xs}px`,
        bgcolor: theme.gray[100],
        color: theme.gray[600],
        border: `1px solid ${theme.gray[200]}`,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: '0.6875rem',
        fontWeight: 700,
        lineHeight: 1,
        ...sx,
      }}
    >
      {children}
    </Box>
  );
};

// ─── 스텝 인디케이터 (시안 답습) ─────────────────────────────────
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
          ? theme.palette.primary.main
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

const LoginPage = () => {
  const theme = useTheme();
  const [profiles, setProfiles] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // 사양 §발견 7: 100ms 자동 제출 중복 발화 방지(7번째 키스트로크 회피)
  const handlingSubmitRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        // user_profiles RLS 적용(20260601) — anon은 직접 SELECT 차단. 로그인 셀렉터용 최소 컬럼(id/name/role/email)만 RPC로.
        const { data, error: fetchError } = await supabase.rpc('get_login_directory');
        if (fetchError) throw fetchError;
        setProfiles(data || []);
      } catch (err) {
        console.error('Error fetching user profiles:', err);
        setError('사용자 목록을 불러오지 못했습니다. 관리자에게 문의하세요.');
      } finally {
        setLoadingProfiles(false);
      }
    };
    fetchProfiles();
  }, []);

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!selectedUser || !password) return;
    if (handlingSubmitRef.current) return;
    handlingSubmitRef.current = true;

    setLoading(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: selectedUser.email,
        password,
      });

      if (signInError) throw signInError;

      navigate('/admin');
    } catch (err) {
      if (err.message && err.message.includes('Invalid login credentials')) {
        setError('비밀번호(PIN)가 일치하지 않습니다.');
      } else {
        setError(err.message);
      }
      setPassword('');
    } finally {
      setLoading(false);
      handlingSubmitRef.current = false;
    }
  };

  const handleBack = () => {
    if (selectedUser) {
      setSelectedUser(null);
      setPassword('');
      setError(null);
    } else if (selectedRole) {
      setSelectedRole(null);
      setError(null);
    }
  };

  // 사양 §필터: '출고' 역할은 fulfillment_book/fulfillment_test 두 슬러그를 묶어 노출
  const usersForRole = useMemo(() => {
    if (!selectedRole) return [];
    if (selectedRole === 'fulfillment') {
      return profiles.filter(
        p => p.role === 'fulfillment_book' || p.role === 'fulfillment_test',
      );
    }
    return profiles.filter(p => p.role === selectedRole);
  }, [profiles, selectedRole]);

  const currentStep = selectedUser ? 2 : selectedRole ? 1 : 0;

  const headingText = useMemo(() => {
    if (!selectedRole) return '역할을 선택해주세요';
    if (!selectedUser) return `${ROLE_LABELS[selectedRole]?.label} 선택`;
    return `${selectedUser.name} 님, 환영합니다`;
  }, [selectedRole, selectedUser]);

  const handlePinChange = (e) => {
    const pin = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPassword(pin);
    if (pin.length === 6 && selectedUser) {
      // 사양 §발견 2: 6자리 도달 시 100ms 후 자동 제출 (React 18 비동기 업데이트 안전 마진)
      setTimeout(() => {
        document.querySelector('form')?.requestSubmit();
      }, 100);
    }
  };

  // 숫자 단축키 — step 0(역할)·1(담당자)에서만. PIN 단계(2)는 PIN 입력이므로 무시.
  useEffect(() => {
    if (currentStep === 2) return;
    const onKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key < '1' || e.key > '9') return;
      const k = Number(e.key);
      if (currentStep === 0) {
        if (k <= AVAILABLE_ROLES.length) setSelectedRole(AVAILABLE_ROLES[k - 1]);
      } else if (currentStep === 1) {
        if (k <= Math.min(9, usersForRole.length)) setSelectedUser(usersForRole[k - 1]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentStep, usersForRole]);

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
      <CssBaseline />
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
        {/* 뒤로가기 (사양 line 119-127) */}
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

        {/* 로고 — 토큰화. 시안 답습으로 LOGO.svg + 부제 */}
        <Box sx={{ textAlign: 'center', mb: 3, mt: (selectedRole || selectedUser) ? 1 : 0 }}>
          <Box
            component="img"
            src="/LOGO.svg"
            alt="인싸이트"
            sx={{ height: 40, mb: 1, display: 'inline-block' }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            인싸이트 현장주문 어드민
          </Typography>
        </Box>

        {/* 스텝 인디케이터 (시안 답습) */}
        <StepIndicator currentStep={currentStep} />

        {/* 헤딩 — 사양 §컨테이너 */}
        <Typography
          component="h1"
          variant="h4"
          sx={{ textAlign: 'center', color: 'text.primary', mb: 2.5 }}
        >
          {headingText}
        </Typography>

        {/* 에러 알림 (사양 line 135) */}
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: `${theme.radii.md}px` }}>
            {error}
          </Alert>
        )}

        {/* 스텝 콘텐츠 공통 래퍼 — minHeight 290px 안정 + 세로 중앙 (담당자 많을 때만 아래 확장) */}
        <Box
          sx={{
            minHeight: 290,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
        {loadingProfiles ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : currentStep === 0 ? (
          /* Step 1 — 역할 선택 (사양 line 139-167) */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {AVAILABLE_ROLES.map((role, i) => {
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
                    position: 'relative',
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
                  <KbdBadge sx={{ position: 'absolute', top: 8, left: 8 }}>{i + 1}</KbdBadge>
                  <Icon sx={{ fontSize: 28 }} />
                  <Typography variant="subtitle1" sx={{ color: 'inherit', lineHeight: 1 }}>
                    {meta.label}
                  </Typography>
                </Button>
              );
            })}
          </Box>
        ) : currentStep === 1 ? (
          /* Step 2 — 담당자 선택 (사양 line 168-189) — 2열 그리드 */
          usersForRole.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: `${theme.radii.md}px` }}>
              등록된 담당자가 없습니다.
            </Alert>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
              {usersForRole.map((user, i) => (
                <Button
                  key={user.id}
                  variant="contained"
                  fullWidth
                  size="large"
                  color="primary"
                  onClick={() => setSelectedUser(user)}
                  sx={{ py: 1.5, justifyContent: 'flex-start', gap: 1, minWidth: 0 }}
                >
                  {i < 9 && (
                    <KbdBadge sx={{ bgcolor: alpha('#fff', 0.22), color: 'common.white', borderColor: alpha('#fff', 0.35) }}>
                      {i + 1}
                    </KbdBadge>
                  )}
                  <PersonIcon sx={{ fontSize: 20, flexShrink: 0 }} />
                  <Box sx={{ flex: 1, minWidth: 0, textAlign: 'left', display: 'flex', alignItems: 'baseline', gap: 0.5, overflow: 'hidden' }}>
                    <Typography variant="subtitle1" component="span" sx={{ color: 'inherit', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {user.name}
                    </Typography>
                    {user.position && (
                      <Typography variant="caption" component="span" sx={{ color: alpha('#fff', 0.7), flexShrink: 0 }}>
                        {user.position}
                      </Typography>
                    )}
                  </Box>
                </Button>
              ))}
            </Box>
          )
        ) : (
          /* Step 3 — PIN 입력 (사양 line 190-249) */
          <Box component="form" noValidate onSubmit={handleLogin}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.75,
                mb: 2,
                color: 'text.secondary',
              }}
            >
              <DialpadIcon sx={{ fontSize: 16 }} />
              <Typography variant="caption" sx={{ color: 'inherit' }}>
                비밀번호(PIN)를 입력하세요
              </Typography>
            </Box>
            <TextField
              fullWidth
              required
              type="password"
              name="password"
              id="password"
              autoComplete="current-password"
              autoFocus
              placeholder="••••••"
              value={password}
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
                      color: password.length === 6 ? theme.palette.primary.main : 'text.disabled',
                      fontWeight: 700,
                    }}
                  >
                    {password.length} / 6
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
              disabled={loading || password.length !== 6}
              sx={{ py: 1.5 }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : '로그인'}
            </Button>
          </Box>
        )}
        </Box>
      </Box>
    </Box>
  );
};

export default LoginPage;
