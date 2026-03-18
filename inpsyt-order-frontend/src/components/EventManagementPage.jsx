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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Event as EventIcon,
  Discount as DiscountIcon,
  Link as LinkIcon,
  CalendarMonth as CalendarIcon,
  ContentCopy as CopyIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { supabase } from '../supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import EmptyState from './EmptyState';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import TableSkeleton from './TableSkeleton';
import SocietyManagementDialog from './SocietyManagementDialog';

const EventManagementPage = () => {
  const theme = useTheme();
  const [events, setEvents] = useState([]);
  const [open, setOpen] = useState(false);
  const [societyModalOpen, setSocietyModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [availableTags, setAvailableTags] = useState([]);
  const [availableSocieties, setAvailableSocieties] = useState([]);
  const { user, hasPermission } = useAuth();
  const { addNotification } = useNotification();
  const [loading, setLoading] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch events and societies in parallel
      const [eventsRes, societiesRes] = await Promise.all([
        supabase
          .from('events')
          .select('id, name, discount_rate, order_url_slug, start_date, end_date, tags, event_year, host_society, event_season, status')
          .order('start_date', { ascending: false }),
        supabase.from('societies').select('id, name, slug_prefix').order('name', { ascending: true })
      ]);
      
      if (eventsRes.error) {
        console.error('Error fetching events:', eventsRes.error);
        addNotification('학회 정보를 불러오는 데 실패했습니다.', 'error');
      } else {
        setEvents(eventsRes.data);
        const allTags = eventsRes.data.flatMap(event => event.tags || []);
        setAvailableTags(Array.from(new Set(allTags)));
      }

      if (!societiesRes.error && societiesRes.data) {
        setAvailableSocieties(societiesRes.data);
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
    setCurrentEvent(event || { 
      name: '', discount_rate: 0, order_url_slug: '', start_date: '', end_date: '', tags: [],
      event_year: new Date().getFullYear(), host_society: '', event_season: ''
    });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setCurrentEvent(null);
  };

  const handleChange = (name, value) => {
    setCurrentEvent(prev => {
      let newState = { ...prev, [name]: value };

      // Auto-update order_url_slug when name changes manually
      if (name === 'name' && !isEditing && !newState.order_url_slug) {
        newState.order_url_slug = value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      }

      // Auto-suggest name and URL if year, society, and season change
      if (['event_year', 'host_society', 'event_season'].includes(name) && !isEditing) {
        const newYear = name === 'event_year' ? value : prev.event_year;
        const newSociety = name === 'host_society' ? value : prev.host_society;
        const newSeason = name === 'event_season' ? value : prev.event_season;
        
        if (newYear && newSociety && newSeason) {
          // Auto-suggest Name
          newState.name = `${newYear} ${newSociety} ${newSeason}`;
          
          // Auto-suggest URL Slug with random suffix to prevent guessing
          const societyObj = availableSocieties.find(s => s.name === newSociety);
          if (societyObj) {
            const seasonMap = {
              '춘계학술대회': 'spring', '추계학술대회': 'fall', '연수강좌': 'training',
              '보수교육': 'edu', '세미나': 'seminar', '기타': 'etc'
            };
            const sPrefix = societyObj.slug_prefix || 'event';
            const seasonEng = seasonMap[newSeason] || 'etc';
            const randomToken = Math.random().toString(36).slice(2, 6); // 4자리 랜덤 토큰
            newState.order_url_slug = `${sPrefix}-${newYear}-${seasonEng}-${randomToken}`;
          }
        }
        
        // Auto-add Host Society to Tags if missing
        if (name === 'host_society' && value && typeof value === 'string') {
          const currentTags = newState.tags || [];
          if (!currentTags.includes(value)) {
            newState.tags = [...currentTags, value];
          }
        }
      }

      return newState;
    });
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
    const url = `${window.location.origin}/order?events=${slug}`;
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
          <Box sx={{ display: 'flex', gap: 1 }}>
            {hasPermission('events:edit') && (
              <Button 
                variant="outlined" 
                startIcon={<SettingsIcon />}
                onClick={() => setSocietyModalOpen(true)}
              >
                주최 학회 관리
              </Button>
            )}
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
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, p: 3, pb: 0, fontSize: '1.5rem' }}>
          {isEditing ? '학회 수정' : '새 학회 추가'}
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5, mt: 2 }}>
            {/* Step 1: Structured Information */}
            <Box sx={{ p: 2.5, bgcolor: alpha(theme.palette.primary.main, 0.03), borderRadius: 2, border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main', textTransform: 'uppercase', letterSpacing: 1 }}>행사 구조 정보 (마법사)</Typography>
              
              <TextField
                select
                fullWidth
                label="연도"
                name="event_year"
                value={currentEvent?.event_year || ''}
                onChange={(e) => handleChange(e.target.name, e.target.value)}
                disabled={!hasPermission('events:edit')}
                InputLabelProps={{ shrink: true }}
              >
                <MenuItem value=""><em>연도 선택</em></MenuItem>
                {[...Array(5)].map((_, i) => {
                  const year = new Date().getFullYear() - 1 + i;
                  return <MenuItem key={year} value={year}>{year}년</MenuItem>;
                })}
              </TextField>

              <TextField
                select
                fullWidth
                label="행사 구분"
                name="event_season"
                value={currentEvent?.event_season || ''}
                onChange={(e) => handleChange(e.target.name, e.target.value)}
                disabled={!hasPermission('events:edit')}
                InputLabelProps={{ shrink: true }}
              >
                <MenuItem value=""><em>시즌 선택</em></MenuItem>
                <MenuItem value="춘계학술대회">춘계학술대회</MenuItem>
                <MenuItem value="추계학술대회">추계학술대회</MenuItem>
                <MenuItem value="연수강좌">연수강좌</MenuItem>
                <MenuItem value="보수교육">보수교육</MenuItem>
                <MenuItem value="세미나">세미나</MenuItem>
                <MenuItem value="기타">기타</MenuItem>
              </TextField>

              <Autocomplete
                freeSolo
                options={availableSocieties.map(s => s.name)}
                value={currentEvent?.host_society || ''}
                onChange={(e, newValue) => handleChange('host_society', newValue)}
                onInputChange={(e, newInputValue) => {
                   if (e && e.type === 'change') handleChange('host_society', newInputValue);
                }}
                disabled={!hasPermission('events:edit')}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    label="주최 학회" 
                    placeholder="목록에서 선택하거나 직접 입력" 
                    InputLabelProps={{ shrink: true }}
                  />
                )}
              />
            </Box>

            <Divider />

            {/* Step 2: Generated & Extra Info */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <TextField
                name="name"
                label="행사명 통합 (자동 완성)"
                fullWidth
                value={currentEvent?.name || ''}
                onChange={(e) => handleChange(e.target.name, e.target.value)}
                disabled={!hasPermission('events:edit')}
                InputLabelProps={{ shrink: true }}
                helperText="위에서 입력한 정보로 자동 생성됩니다."
              />
            <TextField
              name="order_url_slug"
              label="고유 주소 (Slug)"
              type="text"
              fullWidth
              value={currentEvent?.order_url_slug || ''}
              onChange={(e) => handleChange(e.target.name, e.target.value)}
                InputLabelProps={{ shrink: true }}
                helperText="주문 페이지 주소로 사용됩니다. 영문, 숫자, 하이픈만 가능"
              />
              
              <TextField
                name="discount_rate"
                label="할인율 (%)"
                type="number"
                fullWidth
                value={currentEvent?.discount_rate ? Math.round(currentEvent.discount_rate * 100) : 0}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  handleChange('discount_rate', val / 100);
                }}
                inputProps={{ step: "1", min: "0", max: "100" }}
                InputLabelProps={{ shrink: true }}
                helperText="예: 15 = 15% 할인"
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
                  InputLabelProps={{ shrink: true }}
                  disabled={!hasPermission('events:edit')}
                />
                <TextField
                  name="end_date"
                  label="종료일"
                  type="date"
                  fullWidth
                  value={currentEvent?.end_date || ''}
                  onChange={(e) => handleChange(e.target.name, e.target.value)}
                  InputLabelProps={{ shrink: true }}
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
                    InputLabelProps={{ shrink: true }}
                  />
                )}
                disabled={!hasPermission('events:edit')}
              />
            </Box>
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

      <SocietyManagementDialog 
        open={societyModalOpen} 
        onClose={() => setSocietyModalOpen(false)} 
        onUpdated={fetchEvents} 
      />
    </Box>
  );
};

export default EventManagementPage;