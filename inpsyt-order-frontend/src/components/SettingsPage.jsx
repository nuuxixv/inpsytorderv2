import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Stack,
  InputAdornment,
} from '@mui/material';
import { supabase } from '../supabaseClient';
import { useNotification } from '../hooks/useNotification';

const SettingsPage = () => {
  const { addNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    free_shipping_threshold: 30000,
    shipping_cost: 3000,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

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
        });
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', p: 2 }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>
        설정
      </Typography>

      <Paper sx={{ p: 4, borderRadius: '16px' }}>
        <Stack spacing={4}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              배송비 정책
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              주문 금액에 따른 배송비 및 무료 배송 기준을 설정합니다. 현장 판매는 배송비가 적용되지 않습니다.
            </Typography>
            
            <Stack spacing={2}>
              <TextField
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
            </Stack>
          </Box>

          <Divider />

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={fetchSettings}
              disabled={saving}
              sx={{ borderRadius: '10px', px: 3 }}
            >
              취소
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
              sx={{ borderRadius: '10px', px: 4, fontWeight: 700 }}
            >
              {saving ? <CircularProgress size={24} /> : '저장하기'}
            </Button>
          </Box>
        </Stack>
      </Paper>

      <Alert severity="info" sx={{ mt: 3, borderRadius: '12px' }}>
        설정 변경 사항은 즉시 적용됩니다.
        (이미 생성된 주문에는 영향을 주지 않으며, 신규 주문부터 적용됩니다.)
      </Alert>

    </Box>
  );
};

export default SettingsPage;
