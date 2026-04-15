import React, { useState, useEffect } from 'react';
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
  Paper,
  IconButton
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Dialpad as DialpadIcon, Person as PersonIcon, Shield as ShieldIcon, LocalShipping as ShippingIcon, Storefront as StoreIcon } from '@mui/icons-material';

const ROLE_LABELS = {
  'master': { label: '마스터', icon: <ShieldIcon fontSize="large" sx={{ mb: 1 }} /> },
  'onsite': { label: '현장 마케팅', icon: <StoreIcon fontSize="large" sx={{ mb: 1 }} /> },
  'fulfillment': { label: '출고', icon: <ShippingIcon fontSize="large" sx={{ mb: 1 }} /> }
};

const LoginPage = () => {
  const [profiles, setProfiles] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const { data, error } = await supabase.from('user_profiles').select('*');
        if (error) throw error;
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
    
    setLoading(true);
    setError(null);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: selectedUser.email,
        password,
      });

      if (signInError) throw signInError;

      navigate('/admin');
    } catch (error) {
      if (error.message.includes('Invalid login credentials')) {
        setError('비밀번호(PIN)가 일치하지 않습니다.');
      } else {
        setError(error.message);
      }
    } finally {
      setLoading(false);
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

  const availableRoles = ['master', 'onsite', 'fulfillment'];
  const usersForRole = profiles.filter(p =>
    selectedRole === 'fulfillment'
      ? p.role === 'fulfillment' || p.role === 'fulfillment_book' || p.role === 'fulfillment_test'
      : p.role === selectedRole
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: 'background.default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CssBaseline />
      <Paper 
        elevation={3}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          maxWidth: 420,
          p: 4,
          borderRadius: 4,
          position: 'relative'
        }}
      >
        {(selectedRole || selectedUser) && (
          <IconButton 
            onClick={handleBack} 
            sx={{ position: 'absolute', left: 16, top: 16 }}
            aria-label="뒤로가기"
          >
            <ArrowBackIcon />
          </IconButton>
        )}

        <img src="/LOGO.svg" alt="logo" style={{ height: 40, marginBottom: '32px', marginTop: '8px' }} />
        
        <Typography component="h1" variant="h6" sx={{ fontWeight: 'bold', mb: 4, color: 'text.primary' }}>
          {selectedUser ? `${selectedUser.name} 님, 환영합니다` : selectedRole ? `${ROLE_LABELS[selectedRole]?.label} 선택` : '역할을 선택해주세요'}
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 3, width: '100%' }}>{error}</Alert>}

        {loadingProfiles ? (
          <CircularProgress sx={{ my: 4 }} />
        ) : !selectedRole ? (
          /* STEP 1: 역할 선택 */
          <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {availableRoles.map(role => (
              <Button
                key={role}
                fullWidth
                variant="outlined"
                size="large"
                onClick={() => setSelectedRole(role)}
                sx={{
                  py: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  textTransform: 'none',
                  borderColor: 'divider',
                  color: 'text.secondary',
                  '&:hover': {
                    borderColor: 'primary.main',
                    color: 'primary.main',
                    bgcolor: 'primary.50'
                  }
                }}
              >
                {ROLE_LABELS[role]?.icon}
                <Typography variant="subtitle1" fontWeight="bold">{ROLE_LABELS[role]?.label}</Typography>
              </Button>
            ))}
          </Box>
        ) : !selectedUser ? (
          /* STEP 2: 담당자(이름) 선택 */
          <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {usersForRole.length === 0 ? (
              <Alert severity="info" sx={{ width: '100%' }}>등록된 담당자가 없습니다.</Alert>
            ) : (
              usersForRole.map(user => (
                <Button
                  key={user.id}
                  fullWidth
                  variant="contained"
                  size="large"
                  color="primary"
                  onClick={() => setSelectedUser(user)}
                  sx={{ py: 1.5, fontSize: '1.1rem', fontWeight: 600 }}
                  startIcon={<PersonIcon />}
                >
                  {user.name}
                </Button>
              ))
            )}
          </Box>
        ) : (
          /* STEP 3: 비밀번호(PIN) 입력 */
          <Box component="form" noValidate onSubmit={handleLogin} sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, color: 'text.secondary' }}>
              <DialpadIcon sx={{ mr: 1 }} />
              <Typography variant="body2">비밀번호(PIN)를 입력하세요</Typography>
            </Box>
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              placeholder="••••••"
              type="password"
              id="password"
              autoComplete="current-password"
              autoFocus
              variant="outlined"
              inputMode="numeric"
              pattern="[0-9]*"
              sx={{ 
                mb: 3, 
                '& .MuiOutlinedInput-root': { 
                  fontSize: '1.5rem', 
                  letterSpacing: '0.5em',
                  textAlign: 'center'
                },
                '& input': { textAlign: 'center' }
              }}
              value={password}
              onChange={(e) => {
                const pin = e.target.value.replace(/\D/g, '').slice(0, 6);
                setPassword(pin);
                if (pin.length === 6 && selectedUser) {
                  setTimeout(() => {
                    document.querySelector('form')?.requestSubmit();
                  }, 100);
                }
              }}
              inputProps={{ maxLength: 6, inputMode: 'numeric' }}
              helperText={
                <Box component="span" sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <span style={{ color: password.length === 6 ? '#10B981' : 'inherit' }}>
                    {password.length} / 6
                  </span>
                </Box>
              }
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              sx={{ py: 1.5, fontSize: '1.1rem', fontWeight: 600 }}
              disabled={loading || password.length !== 6}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : '로그인'}
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default LoginPage;
