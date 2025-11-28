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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Autocomplete,
  Chip,
  IconButton,
  Card,
  CardContent,
  alpha,
  useTheme,
  Tooltip,
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Event as EventIcon,
  Discount as DiscountIcon,
  Link as LinkIcon,
  CalendarMonth as CalendarIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { supabase } from '../supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import EmptyState from './EmptyState';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import TableSkeleton from './TableSkeleton';

const EventManagementPage = () => {
  const theme = useTheme();
  const [events, setEvents] = useState([]);
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [availableTags, setAvailableTags] = useState([]);
  const { user, hasPermission } = useAuth();
  const { addNotification } = useNotification();
  const [loading, setLoading] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, discount_rate, order_url_slug, start_date, end_date, tags')
        .order('start_date', { ascending: false });
      
      if (error) {
        console.error('Error fetching events:', error);
        addNotification('학회 정보를 불러오는 데 실패했습니다.', 'error');
      } else {
        setEvents(data);
        const allTags = data.flatMap(event => event.tags || []);
        setAvailableTags(Array.from(new Set(allTags)));
      }
    } finally {
      setLoading(false);
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
    setCurrentEvent(event || { name: '', discount_rate: 0, order_url_slug: '', start_date: '', end_date: '', tags: [] });
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

  const handleTagsChange = (event, newTags) => {
    setCurrentEvent(prev => ({ ...prev, tags: newTags }));
  };

  const handleSave = async () => {
    if (!hasPermission('events:edit')) {
      addNotification('학회 정보를 편집할 권한이 없습니다.', 'error');
      return;
    }
    if (!currentEvent) return;

    if (!currentEvent.name || !currentEvent.order_url_slug) {
      addNotification('학회명과 고유 주소는 필수입니다.', 'error');
      return;
    }

    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(currentEvent.order_url_slug)) {
      addNotification('고유 주소는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.', 'error');
      return;
    }

    const { data: existingEvent, error: fetchError } = await supabase
      .from('events')
      .select('id')
      .eq('order_url_slug', currentEvent.order_url_slug)
      .not('id', 'eq', currentEvent.id || -1)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
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

  const handleCopyUrl = (slug) => {
    const url = `${window.location.origin}/order/${slug}`;
    navigator.clipboard.writeText(url);
    addNotification('주문 URL이 클립보드에 복사되었습니다.', 'success');
  };

  const getEventStatus = (startDate, endDate) => {
    const now = new Date();
    const start = parseISO(startDate);
    const end = parseISO(endDate);

    if (isBefore(now, start)) {
      return { label: '예정', color: 'info' };
    } else if (isAfter(now, end)) {
      return { label: '종료', color: 'default' };
    } else {
      return { label: '진행중', color: 'success' };
    }
  };

  if (!user || !hasPermission('events:view')) {
    return <Box sx={{ p: 3 }}><Typography>학회 관리 페이지 접근 권한이 없습니다.</Typography></Box>;
  }

  const activeEvents = events.filter(e => {
    const now = new Date();
    const end = parseISO(e.end_date);
    return !isAfter(now, end);
  }).length;

  const upcomingEvents = events.filter(e => {
    const now = new Date();
    const start = parseISO(e.start_date);
    return isBefore(now, start);
  }).length;

  return (
    <Box>
      {/* Header with Stats */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
            🎯 학회 관리
          </Typography>
          {hasPermission('events:edit') && (
            <Button 
              variant="contained" 
              startIcon={<AddIcon />}
              onClick={() => handleOpen()}
            >
              새 학회 추가
            </Button>
          )}
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={4}>
            <Card sx={{ 
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      전체 학회
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                      {events.length}
                    </Typography>
                  </Box>
                  <EventIcon sx={{ fontSize: 40, color: alpha(theme.palette.primary.main, 0.5) }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Card sx={{ 
              background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.main, 0.05)} 100%)`,
              border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      활성 학회
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                      {activeEvents}
                    </Typography>
                  </Box>
                  <CalendarIcon sx={{ fontSize: 40, color: alpha(theme.palette.success.main, 0.5) }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Card sx={{ 
              background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.1)} 0%, ${alpha(theme.palette.info.main, 0.05)} 100%)`,
              border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      예정 학회
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'info.main' }}>
                      {upcomingEvents}
                    </Typography>
                  </Box>
                  <DiscountIcon sx={{ fontSize: 40, color: alpha(theme.palette.info.main, 0.5) }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Events Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableCell sx={{ fontWeight: 'bold' }}>학회명</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>상태</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>고유 주소</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">할인율</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>기간</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>태그</TableCell>
                {hasPermission('events:edit') && <TableCell sx={{ fontWeight: 'bold' }} align="center">작업</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableSkeleton rows={5} columns={7} />
              ) : events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ border: 0, py: 4 }}>
                    <EmptyState
                      message="등록된 학회가 없습니다"
                      subMessage="새 학회를 추가하여 시작하세요"
                      icon={<EventIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
                      action={hasPermission('events:edit') ? {
                        label: "학회 추가",
                        onClick: () => handleOpen()
                      } : null}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                events.map((event) => {
                  const status = getEventStatus(event.start_date, event.end_date);
                  return (
                    <TableRow 
                      key={event.id}
                      sx={{ 
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) },
                        transition: 'background-color 0.2s'
                      }}
                    >
                      <TableCell sx={{ fontWeight: 500 }}>{event.name}</TableCell>
                      <TableCell>
                        <Chip 
                          label={status.label} 
                          size="small" 
                          color={status.color}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                            {event.order_url_slug}
                          </Typography>
                          <Tooltip title="URL 복사">
                            <IconButton 
                              size="small" 
                              onClick={() => handleCopyUrl(event.order_url_slug)}
                              sx={{ 
                                color: 'primary.main',
                                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) }
                              }}
                            >
                              <CopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={`${(event.discount_rate * 100).toFixed(0)}%`}
                          size="small"
                          color={event.discount_rate > 0 ? 'success' : 'default'}
                          variant={event.discount_rate > 0 ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">
                            {format(parseISO(event.start_date), 'yyyy.MM.dd')}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ~ {format(parseISO(event.end_date), 'yyyy.MM.dd')}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {event.tags?.slice(0, 2).map((tag, idx) => (
                            <Chip key={idx} label={tag} size="small" variant="outlined" />
                          ))}
                          {event.tags?.length > 2 && (
                            <Chip label={`+${event.tags.length - 2}`} size="small" />
                          )}
                        </Box>
                      </TableCell>
                      {hasPermission('events:edit') && (
                        <TableCell align="center">
                          <IconButton 
                            size="small" 
                            onClick={() => handleOpen(event)}
                            sx={{ 
                              color: 'primary.main',
                              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) }
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Edit/Add Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          {isEditing ? '학회 수정' : '새 학회 추가'}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              autoFocus
              name="name"
              label="학회명"
              type="text"
              fullWidth
              value={currentEvent?.name || ''}
              onChange={(e) => handleChange(e.target.name, e.target.value)}
              disabled={!hasPermission('events:edit')}
            />
            <TextField
              name="order_url_slug"
              label="고유 주소 (Slug)"
              type="text"
              fullWidth
              value={currentEvent?.order_url_slug || ''}
              onChange={(e) => handleChange(e.target.name, e.target.value)}
              helperText="주문 페이지 주소로 사용됩니다. 예: spring-2024 (영문, 숫자, 하이픈만 가능)"
              disabled={!hasPermission('events:edit')}
            />
            <TextField
              name="discount_rate"
              label="할인율 (0~1)"
              type="number"
              fullWidth
              value={currentEvent?.discount_rate || 0}
              onChange={(e) => handleChange(e.target.name, e.target.value)}
              inputProps={{ step: "0.01", min: "0", max: "1" }}
              helperText="예: 0.1 = 10% 할인"
              disabled={!hasPermission('events:edit')}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                name="start_date"
                label="시작일"
                type="date"
                fullWidth
                value={currentEvent?.start_date || ''}
                onChange={(e) => handleChange(e.target.name, e.target.value)}
                InputLabelProps={{
                  shrink: true,
                }}
                disabled={!hasPermission('events:edit')}
              />
              <TextField
                name="end_date"
                label="종료일"
                type="date"
                fullWidth
                value={currentEvent?.end_date || ''}
                onChange={(e) => handleChange(e.target.name, e.target.value)}
                InputLabelProps={{
                  shrink: true,
                }}
                disabled={!hasPermission('events:edit')}
              />
            </Box>
            <Autocomplete
              multiple
              freeSolo
              options={availableTags}
              value={currentEvent?.tags || []}
              onChange={handleTagsChange}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip variant="outlined" label={option} {...getTagProps({ index })} key={index} />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="태그"
                  placeholder="태그 추가"
                  fullWidth
                />
              )}
              disabled={!hasPermission('events:edit')}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleClose}>취소</Button>
          {hasPermission('events:edit') && (
            <Button onClick={handleSave} variant="contained">
              저장
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EventManagementPage;