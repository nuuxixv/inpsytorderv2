
import React, { useState } from 'react';
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
  Paper, // Paper 컴포넌트 import
} from '@mui/material';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      navigate('/admin');
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: 'background.default', // 테마 배경색 사용
        display: 'flex',
        alignItems: 'center', // 수직 중앙 정렬
        justifyContent: 'center', // 수평 중앙 정렬
      }}
    >
      <CssBaseline />
      <Box 
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          maxWidth: 360, // 너비 소폭 축소
          p: 2,
        }}
      >
        <img src="/LOGO.svg" alt="logo" style={{ height: 40, marginBottom: '32px' }} />
        <Typography component="h1" variant="h5" sx={{ fontWeight: 'bold', mb: 4 }}>
          관리자 로그인
        </Typography>
        <Box component="form" noValidate onSubmit={handleLogin} sx={{ width: '100%' }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="이메일 주소"
            name="email"
            autoComplete="email"
            autoFocus
            variant="standard" // 밑줄 스타일
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="비밀번호"
            type="password"
            id="password"
            autoComplete="current-password"
            variant="standard" // 밑줄 스타일
            sx={{ mt: 3 }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 6, mb: 2, py: '12px' }} // 버튼 높이 소폭 조정
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : '로그인'}
          </Button>
          {error && <Alert severity="error" sx={{ mt: 2, width: '100%' }}>{error}</Alert>}
        </Box>
      </Box>
    </Box>
  );
};

export default LoginPage;
