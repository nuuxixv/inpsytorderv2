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
import { useNotification } from '../hooks/useNotification';

const EventManagementPage = () => {
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
  }, [addNotification]);

  useEffect(() => {
    fetchEvents();

    const channel = supabase
      .channel('events_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        () => {
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

  const handleChange = (name, value) => {
    if (name === 'name') {
      const slug = value
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      setCurrentEvent(prev => ({ ...prev, name: value, order_url_slug: slug }));
    } else {
      setCurrentEvent(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async () => {
    if (!currentEvent) return;

    if (!currentEvent.name || !currentEvent.order_url_slug) {
      addNotification('학회명과 고유 주소는 필수입니다.', 'error');
      return;
    }

    // URL 슬러그 유효성 검사 (소문자, 숫자, 하이픈만 허용)
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(currentEvent.order_url_slug)) {
      addNotification('고유 주소는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.', 'error');
      return;
    }

    // URL 슬러그 중복 검사
    const { data: existingEvent, error: fetchError } = await supabase
      .from('events')
      .select('id')
      .eq('order_url_slug', currentEvent.order_url_slug)
      .not('id', 'eq', currentEvent.id || -1) // 수정 시 현재 학회는 제외
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116: no rows found
      addNotification(`중복 검사 실패: ${fetchError.message}`, 'error');
      return;
    }

    if (existingEvent) {
      addNotification('이미 사용중인 고유 주소입니다.', 'error');
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


  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">학회 관리</Typography>
        <Button variant="contained" onClick={() => handleOpen()}>새 학회 추가</Button>
      </Box>
      <TableContainer sx={{ mt: 3 }}>
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
                  <Typography variant="body2" component="span">
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

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>{isEditing ? '학회 수정' : '새 학회 추가'}</DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <TextField
            autoFocus
            margin="dense"
            name="name"
            label="학회명"
            type="text"
            fullWidth
            value={currentEvent?.name || ''}
            onChange={(e) => handleChange(e.target.name, e.target.value)}
          />
          <TextField
            margin="dense"
            name="order_url_slug"
            label="고유 주소 (Slug)"
            type="text"
            fullWidth
            value={currentEvent?.order_url_slug || ''}
            onChange={(e) => handleChange(e.target.name, e.target.value)}
            helperText="주문 페이지 주소로 사용됩니다. 예: spring-2024 (영문, 숫자, 하이픈만 가능)"
          />
          <TextField
            margin="dense"
            name="discount_rate"
            label="할인율"
            type="number"
            fullWidth
            value={currentEvent?.discount_rate || 0}
            onChange={(e) => handleChange(e.target.name, e.target.value)}
            inputProps={{ step: "0.01", min: "0", max: "1" }}
          />
          <TextField
            margin="dense"
            name="start_date"
            label="시작일"
            type="date"
            fullWidth
            value={currentEvent?.start_date || ''}
            onChange={(e) => handleChange(e.target.name, e.target.value)}
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
            onChange={(e) => handleChange(e.target.name, e.target.value)}
            InputLabelProps={{
              shrink: true,
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleClose}>취소</Button>
          <Button onClick={handleSave}>저장</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default EventManagementPage;