import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Snackbar,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import { supabase } from '../supabaseClient';
import { useAuth } from '../AuthContext';
import { useNotification } from '../NotificationContext';

const EventManagementPage = () => {
  const { user, masterPassword } = useAuth();
  const [events, setEvents] = useState([]);
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(null);
  const { addNotification } = useNotification();

  const fetchEvents = useCallback(async () => {
    const { data, error } = await supabase
      .from('events')
      .select('id, name, discount_rate, order_url_slug, start_date, end_date')
      .order('name', { ascending: true });
    if (error) {
      console.error('Error fetching events:', error);
      addNotification('학회 정보를 불러오는 데 실패했습니다.', 'error');
    } else {
      setEvents(data);
    }
  }, []);

  useEffect(() => {
    fetchEvents();

    const channel = supabase
      .channel('events_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        (payload) => {
          fetchEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEvents]);

  const handleOpen = (event = null) => {
    setIsEditing(!!event);
    setCurrentEvent(event || { name: '', discount_rate: 0, order_url_slug: '', start_date: '', end_date: '' });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setCurrentEvent(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCurrentEvent(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!currentEvent) return;

    if (!currentEvent.name || !currentEvent.order_url_slug) {
      addNotification('학회명과 URL 슬러그는 필수입니다.', 'error');
      return;
    }

    const { id, ...upsertData } = currentEvent;

    let query;
    if (isEditing) {
      query = supabase.from('events').update(upsertData).eq('id', id);
    } else {
      query = supabase.from('events').insert([upsertData]);
    }

    const { error } = await query;

    if (error) {
      addNotification(`저장 실패: ${error.message}`, 'error');
    } else {
      addNotification('성공적으로 저장되었습니다.', 'success');
      fetchEvents();
      handleClose();
    }
  };

  const handleUpdateEventDiscount = useCallback(async (eventId, newDiscountRate) => {
    if (!user || !masterPassword) {
      addNotification('권한이 없습니다.', 'error');
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('events')
        .update({ discount_rate: newDiscountRate })
        .eq('id', eventId);

      if (updateError) {
        throw updateError;
      }

      addNotification('할인율이 업데이트되었습니다.', 'success');
      fetchEvents(); // 학회 목록 갱신
    } catch (err) {
      console.error('Error updating event discount rate:', err);
      addNotification(`할인율 업데이트 실패: ${err.message}`, 'error');
    }
  }, [user, masterPassword, fetchEvents]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">학회 관리</Typography>
        <Button variant="contained" onClick={() => handleOpen()}>새 학회 추가</Button>
      </Box>
      <Paper elevation={3} sx={{ p: 3, mt: 3, borderRadius: '12px', bgcolor: '#fff' }}>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>학회 ID</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>학회명</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>고유 주소</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>할인율</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>시작일</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>종료일</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>작업</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>{event.id}</TableCell>
                  <TableCell>{event.name}</TableCell>
                  <TableCell>{event.order_url_slug}</TableCell>
                  <TableCell>
                    <Typography variant="body2" component="span" sx={{ ml: 1 }}>
                      {(event.discount_rate * 100).toFixed(0)}%
                    </Typography>
                  </TableCell>
                  <TableCell>{event.start_date}</TableCell>
                  <TableCell>{event.end_date}</TableCell>
                  <TableCell>
                    <Button variant="outlined" size="small" onClick={() => handleOpen(event)}>
                      수정
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>{isEditing ? '학회 수정' : '새 학회 추가'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            name="name"
            label="학회명"
            type="text"
            fullWidth
            value={currentEvent?.name || ''}
            onChange={handleChange}
          />
          <TextField
            margin="dense"
            name="order_url_slug"
            label="고유 주소 (Slug)"
            type="text"
            fullWidth
            value={currentEvent?.order_url_slug || ''}
            onChange={handleChange}
            helperText="주문 페이지 주소로 사용됩니다. 예: spring-2024 (영문, 숫자, 하이픈만 가능)"
          />
          <TextField
            margin="dense"
            name="discount_rate"
            label="할인율"
            type="number"
            fullWidth
            value={currentEvent?.discount_rate || 0}
            onChange={handleChange}
            inputProps={{ step: "0.01", min: "0", max: "1" }}
          />
          <TextField
            margin="dense"
            name="start_date"
            label="시작일"
            type="date"
            fullWidth
            value={currentEvent?.start_date || ''}
            onChange={handleChange}
            InputLabelProps={{
              shrink: true,
            }}
          />
          <TextField
            margin="dense"
            name="end_date"
            label="종료일"
            type="date"
            fullWidth
            value={currentEvent?.end_date || ''}
            onChange={handleChange}
            InputLabelProps={{
              shrink: true,
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>취소</Button>
          <Button onClick={handleSave}>저장</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EventManagementPage;