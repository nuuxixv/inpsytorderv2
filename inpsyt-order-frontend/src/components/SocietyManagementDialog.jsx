import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  CircularProgress,
  alpha
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { supabase } from '../supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';

const SocietyManagementDialog = ({ open, onClose, onUpdated }) => {
  const [societies, setSocieties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const { hasPermission } = useAuth();
  const { addNotification } = useNotification();

  useEffect(() => {
    if (open) fetchSocieties();
  }, [open]);

  const fetchSocieties = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('societies').select('*').order('name');
    if (error) {
      addNotification('조직 목록을 불러오지 못했습니다.', 'error');
    } else {
      setSocieties(data || []);
    }
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newSlug.trim()) {
      addNotification('학회명과 영문 약자(Slug)를 모두 입력해주세요.', 'error');
      return;
    }
    
    // Validate slug
    if (!/^[a-z0-9-]+$/.test(newSlug)) {
        addNotification('영문 약자는 소문자, 숫자, 하이픈만 가능합니다.', 'error');
        return;
    }

    const { error } = await supabase.from('societies').insert([
      { name: newName.trim(), slug_prefix: newSlug.trim() }
    ]);

    if (error) {
      addNotification(`추가 실패: ${error.message}`, 'error');
    } else {
      addNotification('추가되었습니다.', 'success');
      setNewName('');
      setNewSlug('');
      fetchSocieties();
      if (onUpdated) onUpdated();
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`'${name}' 학회를 목록에서 삭제하시겠습니까? (기존 주문/행사 데이터에는 영향을 주지 않습니다)`)) return;
    
    const { error } = await supabase.from('societies').delete().eq('id', id);
    if (error) {
      addNotification(`삭제 실패: ${error.message}`, 'error');
    } else {
      addNotification('삭제되었습니다.', 'success');
      fetchSocieties();
      if (onUpdated) onUpdated();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 'bold' }}>주최 학회 목록 관리</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          이곳에 등록된 학회는 새 행사 추가 시 드롭다운 목록으로 제공되며, 고유 주소(URL) 자동 생성 시 영문 약자가 활용됩니다.
        </Typography>

        {/* Add New Section */}
        {hasPermission('events:edit') && (
          <Box sx={{ display: 'flex', gap: 1, mb: 3, p: 2, bgcolor: alpha('#10B981', 0.05), borderRadius: 2 }}>
            <TextField 
              size="small" 
              label="학회명 (예: 대한비만학회)" 
              value={newName} 
              onChange={e => setNewName(e.target.value)} 
              fullWidth
            />
            <TextField 
              size="small" 
              label="영문 약자 (예: ksso)" 
              value={newSlug} 
              onChange={e => setNewSlug(e.target.value)} 
              sx={{ width: 150 }}
            />
            <Button variant="contained" onClick={handleAdd} disableElevation sx={{ minWidth: 80 }}>추가</Button>
          </Box>
        )}

        {/* List Section */}
        {loading ? (
           <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
        ) : societies.length === 0 ? (
           <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>등록된 학회가 없습니다.</Typography>
        ) : (
          <List sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            {societies.map((soc) => (
              <ListItem key={soc.id} divider>
                <ListItemText 
                  primary={soc.name} 
                  secondary={`URL 접두사: ${soc.slug_prefix}`} 
                  primaryTypographyProps={{ fontWeight: 600 }}
                />
                {hasPermission('events:edit') && (
                  <ListItemSecondaryAction>
                    <IconButton edge="end" onClick={() => handleDelete(soc.id, soc.name)} color="error" size="small">
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                )}
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="outlined">닫기</Button>
      </DialogActions>
    </Dialog>
  );
};

export default SocietyManagementDialog;
