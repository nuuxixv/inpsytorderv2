import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Chip,
  alpha,
  useTheme,
  Button,
  TextField,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  LocalShipping as ShippingIcon,
  MenuBook as BookIcon,
  Psychology as TestIcon,
  ShoppingCart as CartIcon,
  Receipt as ReceiptIcon,
  EmojiEvents as TrophyIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { supabase } from '../supabaseClient';
import { formatISO, startOfToday, endOfToday, format } from 'date-fns';
import OrderDetailModal from './OrderDetailModal';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { useNavigate } from 'react-router-dom';

// ─── Status Maps ───
const statusToKorean = {
  pending: '결제대기', paid: '결제완료', preparing: '상품준비중',
  shipped: '배송중', delivered: '배송완료', cancelled: '주문취소', refunded: '결제취소',
};
const statusColors = {
  pending: '#F59E0B', paid: '#10B981', preparing: '#3B82F6',
  shipped: '#6366F1', delivered: '#22C55E', cancelled: '#EF4444', refunded: '#F43F5E',
};

// ─── KPI Card ───
const KpiCard = ({ title, value, icon: Icon, color, subtitle }) => {
  const theme = useTheme();
  return (
    <Card sx={{
      height: '100%',
      background: `linear-gradient(135deg, ${alpha(color, 0.08)} 0%, ${alpha(color, 0.03)} 100%)`,
      border: `1px solid ${alpha(color, 0.15)}`,
      transition: 'transform 0.2s',
      '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 6px 20px ${alpha(color, 0.15)}` },
    }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: 0.5 }}>
              {title}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color, mt: 0.5 }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" sx={{ color: 'text.disabled', mt: 0.25, display: 'block' }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box sx={{ p: 1, borderRadius: 2, bgcolor: alpha(color, 0.1) }}>
            <Icon sx={{ fontSize: 22, color }} />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

// ─── Status Bar ───
const StatusBar = ({ statusCounts, totalOrders }) => {
  if (totalOrders === 0) return null;
  const orderedStatuses = ['pending', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled', 'refunded'];
  const segments = orderedStatuses
    .filter(s => (statusCounts[s] || 0) > 0)
    .map(s => ({ key: s, count: statusCounts[s], pct: (statusCounts[s] / totalOrders) * 100 }));

  return (
    <Card sx={{ overflow: 'hidden' }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
          주문 상태 분포
        </Typography>
        <Box sx={{ display: 'flex', borderRadius: 2, overflow: 'hidden', height: 28 }}>
          {segments.map(seg => (
            <Tooltip key={seg.key} title={`${statusToKorean[seg.key]}: ${seg.count}건 (${seg.pct.toFixed(1)}%)`} arrow>
              <Box sx={{
                width: `${seg.pct}%`, bgcolor: statusColors[seg.key], minWidth: seg.pct > 5 ? 'auto' : 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'width 0.4s ease',
              }}>
                {seg.pct > 12 && (
                  <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, fontSize: '0.65rem' }}>
                    {seg.count}
                  </Typography>
                )}
              </Box>
            </Tooltip>
          ))}
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1.5 }}>
          {segments.map(seg => (
            <Box key={seg.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: statusColors[seg.key] }} />
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                {statusToKorean[seg.key]} {seg.count}
              </Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

// ─── Product Ranking Card ───
const RankingCard = ({ title, icon: Icon, color, items }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Icon sx={{ fontSize: 20, color }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography>
      </Box>
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
          판매 데이터 없음
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {items.map((item, i) => (
            <Box key={item.product_id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="caption" sx={{
                fontWeight: 800, color: i < 3 ? color : 'text.disabled',
                minWidth: 20, textAlign: 'center',
                fontSize: i === 0 ? '0.875rem' : '0.75rem',
              }}>
                {i + 1}
              </Typography>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{
                  fontWeight: i < 3 ? 600 : 400,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {item.name}
                </Typography>
              </Box>
              <Chip
                label={`${item.totalQuantity}부`}
                size="small"
                sx={{
                  fontWeight: 700, fontSize: '0.7rem', height: 22,
                  bgcolor: i === 0 ? alpha(color, 0.15) : 'action.hover',
                  color: i === 0 ? color : 'text.secondary',
                }}
              />
            </Box>
          ))}
        </Box>
      )}
    </CardContent>
  </Card>
);

// ─── Field Report Section ───
const FieldReportSection = ({ eventId, eventName }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editDayNumber, setEditDayNumber] = useState(1);
  const [editAuthor, setEditAuthor] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('field_reports')
        .select('*')
        .eq('event_id', eventId)
        .order('day_number', { ascending: true })
        .order('created_at', { ascending: false });
      if (!error) setReports(data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { if (eventId) fetchReports(); }, [eventId]);

  const handleSave = async () => {
    if (!editContent.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await supabase.from('field_reports').update({
          content: editContent, day_number: editDayNumber,
          author_name: editAuthor, updated_at: new Date().toISOString(),
        }).eq('id', editingId);
      } else {
        await supabase.from('field_reports').insert({
          event_id: eventId, content: editContent,
          day_number: editDayNumber, author_name: editAuthor,
        });
      }
      setIsEditing(false); setEditContent(''); setEditingId(null);
      fetchReports();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleEdit = (report) => {
    setEditingId(report.id);
    setEditContent(report.content);
    setEditDayNumber(report.day_number || 1);
    setEditAuthor(report.author_name || '');
    setIsEditing(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('보고를 삭제하시겠습니까?')) return;
    await supabase.from('field_reports').delete().eq('id', id);
    fetchReports();
  };

  const handleNew = () => {
    setEditingId(null);
    setEditContent(`${eventName} 현장마케팅 보고드립니다.\n\n0. 판매\n검사 판매: \n도서 판매: \n합계: \n\n1. 도서 관련\n\n2. 검사 관련\n\n이상 현장마케팅 마무리하겠습니다.`);
    setEditDayNumber(1);
    setEditAuthor('');
    setIsEditing(true);
  };

  return (
    <Card>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EditIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>현장 보고</Typography>
          </Box>
          {!isEditing && (
            <Button size="small" startIcon={<AddIcon />} onClick={handleNew} variant="outlined"
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
              새 보고
            </Button>
          )}
        </Box>

        {isEditing && (
          <Box sx={{ mb: 2, p: 2, bgcolor: '#F8F9FA', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel>일차</InputLabel>
                <Select value={editDayNumber} label="일차" onChange={e => setEditDayNumber(e.target.value)}>
                  {[1, 2, 3, 4, 5].map(d => <MenuItem key={d} value={d}>{d}일차</MenuItem>)}
                </Select>
              </FormControl>
              <TextField size="small" label="작성자" value={editAuthor}
                onChange={e => setEditAuthor(e.target.value)} sx={{ minWidth: 120 }} />
            </Box>
            <TextField fullWidth multiline minRows={8} maxRows={20} value={editContent}
              onChange={e => setEditContent(e.target.value)} placeholder="현장 보고 내용을 입력하세요..."
              sx={{ mb: 1.5, '& .MuiInputBase-root': { fontSize: '0.875rem', lineHeight: 1.7 } }} />
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button size="small" onClick={() => setIsEditing(false)} sx={{ borderRadius: 2 }}>취소</Button>
              <Button size="small" variant="contained" startIcon={<SaveIcon />}
                onClick={handleSave} disabled={saving || !editContent.trim()}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                {saving ? '저장 중...' : '저장'}
              </Button>
            </Box>
          </Box>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
        ) : reports.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            아직 작성된 보고가 없습니다
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {reports.map((report) => (
              <Box key={report.id} sx={{ p: 2, bgcolor: '#FAFBFC', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip label={`${report.day_number || 1}일차`} size="small"
                      sx={{ fontWeight: 700, fontSize: '0.7rem', height: 22 }} />
                    {report.author_name && (
                      <Typography variant="caption" color="text.secondary">{report.author_name}</Typography>
                    )}
                    <Typography variant="caption" color="text.disabled">
                      {format(new Date(report.created_at), 'MM/dd HH:mm')}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton size="small" onClick={() => handleEdit(report)}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                    <IconButton size="small" onClick={() => handleDelete(report.id)}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
                  </Box>
                </Box>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: '0.8125rem' }}>
                  {report.content}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════
// ─── MAIN DASHBOARD ───
// ═══════════════════════════════════════
const DashboardPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('all');
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [productsMap, setProductsMap] = useState({});
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const { hasPermission } = useAuth();
  const addNotification = useNotification();

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // ─── Data Fetching ───
  const fetchAllProducts = async () => {
    let all = []; let from = 0; const ps = 1000;
    while (true) {
      const { data, error } = await supabase.from('products').select('*').range(from, from + ps - 1);
      if (error) throw error;
      all = all.concat(data);
      if (data.length < ps) break;
      from += ps;
    }
    return all;
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true); setProductsLoading(true);
      try {
        const [eventsRes, allProds] = await Promise.all([
          supabase.from('events').select('id, name').order('start_date', { ascending: false }).limit(20),
          fetchAllProducts(),
        ]);
        if (eventsRes.error) throw eventsRes.error;
        setEvents(eventsRes.data);
        setProducts(allProds);
        setProductsMap(allProds.reduce((acc, p) => { acc[p.id] = p; return acc; }, {}));
      } catch (e) { console.error(e); }
      setProductsLoading(false); setLoading(false);
    };
    init();
  }, []);

  const fetchData = async () => {
    if (!selectedEventId || productsLoading) return;
    setLoading(true);
    try {
      if (selectedEventId === 'all') {
        await fetchOverallData();
      } else {
        await fetchEventData();
      }
    } catch (e) {
      console.error(e);
      setDashboardData(null);
    }
    setLoading(false); setRefreshing(false);
  };

  useEffect(() => { if (!productsLoading) fetchData(); }, [selectedEventId, productsLoading]);

  const fetchOverallData = async () => {
    const fromDate = formatISO(new Date(new Date().getFullYear(), 0, 1));
    const [ordersRes, recentRes] = await Promise.all([
      supabase.from('orders').select('id, final_payment, status, order_items(product_id, quantity, price_at_purchase)').gte('created_at', fromDate),
      supabase.from('orders').select('*, events(name), order_items(*, products(*))').order('created_at', { ascending: false }).limit(5),
    ]);
    if (ordersRes.error) throw ordersRes.error;
    if (recentRes.error) throw recentRes.error;

    const orders = ordersRes.data;
    const statusCounts = {};
    let bookRevenue = 0, testRevenue = 0, totalRevenue = 0;
    const productSales = {};

    orders.forEach(order => {
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
      totalRevenue += order.final_payment || 0;
      (order.order_items || []).forEach(item => {
        const prod = productsMap[item.product_id];
        if (!prod) return;
        const qty = item.quantity || 0;
        const price = item.price_at_purchase || prod.list_price || 0;
        const cat = (prod.category || '').toLowerCase();
        if (cat.includes('도서') || cat.includes('book')) bookRevenue += price * qty;
        else if (cat.includes('검사') || cat.includes('test')) testRevenue += price * qty;
        if (!productSales[item.product_id]) productSales[item.product_id] = { product_id: item.product_id, name: prod.name, category: prod.category, totalQuantity: 0 };
        productSales[item.product_id].totalQuantity += qty;
      });
    });

    const salesList = Object.values(productSales);
    const bookTop5 = salesList.filter(p => (p.category || '').includes('도서') || (p.category || '').toLowerCase().includes('book'))
      .sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, 5);
    const testTop5 = salesList.filter(p => (p.category || '').includes('검사') || (p.category || '').toLowerCase().includes('test'))
      .sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, 5);

    setDashboardData({
      viewType: 'overall', totalRevenue, bookRevenue, testRevenue,
      totalOrders: orders.length, statusCounts, bookTop5, testTop5,
      recentOrders: recentRes.data,
    });
  };

  const fetchEventData = async () => {
    const todayStart = formatISO(startOfToday());
    const todayEnd = formatISO(endOfToday());
    const [eventRes, allOrdersRes, todayOrdersRes, recentRes] = await Promise.all([
      supabase.from('events').select('name').eq('id', selectedEventId).single(),
      supabase.from('orders').select('id, final_payment, status, order_items(product_id, quantity, price_at_purchase)').eq('event_id', selectedEventId),
      supabase.from('orders').select('id, final_payment, status').eq('event_id', selectedEventId).gte('created_at', todayStart).lt('created_at', todayEnd),
      supabase.from('orders').select('*, events(name), order_items(*, products(*))').eq('event_id', selectedEventId).order('created_at', { ascending: false }).limit(5),
    ]);
    if (eventRes.error) throw eventRes.error;

    const allOrders = allOrdersRes.data || [];
    const todayOrders = todayOrdersRes.data || [];
    const statusCounts = {};
    let bookRevenue = 0, testRevenue = 0, totalRevenue = 0;
    const productSales = {};

    allOrders.forEach(order => {
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
      totalRevenue += order.final_payment || 0;
      (order.order_items || []).forEach(item => {
        const prod = productsMap[item.product_id];
        if (!prod) return;
        const qty = item.quantity || 0;
        const price = item.price_at_purchase || prod.list_price || 0;
        const cat = (prod.category || '').toLowerCase();
        if (cat.includes('도서') || cat.includes('book')) bookRevenue += price * qty;
        else if (cat.includes('검사') || cat.includes('test')) testRevenue += price * qty;
        if (!productSales[item.product_id]) productSales[item.product_id] = { product_id: item.product_id, name: prod.name, category: prod.category, totalQuantity: 0 };
        productSales[item.product_id].totalQuantity += qty;
      });
    });

    const todayRevenue = todayOrders.reduce((s, o) => s + (o.final_payment || 0), 0);
    const salesList = Object.values(productSales);
    const bookTop5 = salesList.filter(p => (p.category || '').includes('도서') || (p.category || '').toLowerCase().includes('book'))
      .sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, 5);
    const testTop5 = salesList.filter(p => (p.category || '').includes('검사') || (p.category || '').toLowerCase().includes('test'))
      .sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, 5);

    setDashboardData({
      viewType: 'event', eventName: eventRes.data.name,
      totalRevenue, bookRevenue, testRevenue, totalOrders: allOrders.length,
      todayRevenue, todayOrders: todayOrders.length, statusCounts,
      bookTop5, testTop5, recentOrders: recentRes.data || [],
    });
  };

  // ─── Handlers ───
  const handleRefresh = () => { setRefreshing(true); fetchData(); };
  const handleRowClick = (order) => { setSelectedOrder(order); setIsModalOpen(true); };

  // ─── Derived ───
  const pendingCount = dashboardData?.statusCounts?.pending || 0;
  const paidCount = dashboardData?.statusCounts?.paid || 0;
  const hasAlerts = pendingCount > 0 || paidCount > 0;

  if (loading && !dashboardData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* ─── Header ─── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, mb: 3, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>📋 대시보드</Typography>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', width: { xs: '100%', sm: 'auto' } }}>
          <IconButton onClick={handleRefresh} disabled={refreshing}
            sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08), '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.15) } }}>
            <RefreshIcon sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none', fontSize: 20 }} />
          </IconButton>
          <FormControl sx={{ minWidth: 200, flexGrow: { xs: 1, sm: 0 } }} size="small">
            <InputLabel>학회 선택</InputLabel>
            <Select value={selectedEventId} label="학회 선택" onChange={e => setSelectedEventId(e.target.value)}>
              <MenuItem value="all"><em>전체 (연간)</em></MenuItem>
              {events.map(ev => <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : dashboardData && (
        <Grid container spacing={2.5}>
          {/* ─── Action Alerts ─── */}
          {hasAlerts && (
            <Grid item xs={12}>
              <Card sx={{
                bgcolor: alpha('#F59E0B', 0.06), border: `1px solid ${alpha('#F59E0B', 0.2)}`,
                cursor: 'pointer', transition: 'all 0.2s',
                '&:hover': { bgcolor: alpha('#F59E0B', 0.1) },
              }} onClick={() => navigate('/admin/orders')}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <WarningIcon sx={{ color: '#F59E0B', fontSize: 24 }} />
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    {pendingCount > 0 && (
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        💳 결제대기 <strong style={{ color: '#F59E0B' }}>{pendingCount}건</strong>
                      </Typography>
                    )}
                    {paidCount > 0 && (
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        📦 배송 준비 필요 <strong style={{ color: '#3B82F6' }}>{paidCount}건</strong>
                      </Typography>
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                    주문관리로 이동 →
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* ─── KPI Cards ─── */}
          <Grid item xs={6} md={3}>
            <KpiCard title="검사 판매" value={`${(dashboardData.testRevenue || 0).toLocaleString()}원`}
              icon={TestIcon} color="#6366F1" />
          </Grid>
          <Grid item xs={6} md={3}>
            <KpiCard title="도서 판매" value={`${(dashboardData.bookRevenue || 0).toLocaleString()}원`}
              icon={BookIcon} color="#3B82F6" />
          </Grid>
          <Grid item xs={6} md={3}>
            <KpiCard title="합계 매출" value={`${(dashboardData.totalRevenue || 0).toLocaleString()}원`}
              icon={ReceiptIcon} color="#10B981" />
          </Grid>
          <Grid item xs={6} md={3}>
            <KpiCard title={dashboardData.viewType === 'event' ? '오늘 주문' : '총 주문'}
              value={`${(dashboardData.viewType === 'event' ? dashboardData.todayOrders : dashboardData.totalOrders) || 0}건`}
              icon={CartIcon} color="#F59E0B"
              subtitle={dashboardData.viewType === 'event' ? `총 ${dashboardData.totalOrders}건` : null} />
          </Grid>

          {/* ─── Status Bar ─── */}
          <Grid item xs={12}>
            <StatusBar statusCounts={dashboardData.statusCounts || {}} totalOrders={dashboardData.totalOrders || 0} />
          </Grid>

          {/* ─── Product Rankings ─── */}
          <Grid item xs={12} md={6}>
            <RankingCard title="도서 판매 TOP 5" icon={BookIcon} color="#3B82F6" items={dashboardData.bookTop5 || []} />
          </Grid>
          <Grid item xs={12} md={6}>
            <RankingCard title="검사 판매 TOP 5" icon={TestIcon} color="#6366F1" items={dashboardData.testTop5 || []} />
          </Grid>

          {/* ─── Recent Orders ─── */}
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>최근 주문</Typography>
                {(dashboardData.recentOrders || []).length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                    주문 내역이 없습니다
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {dashboardData.recentOrders.map(order => (
                      <Box key={order.id} onClick={() => handleRowClick(order)}
                        sx={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          p: 1.5, borderRadius: 2, cursor: 'pointer', transition: 'bgcolor 0.15s',
                          '&:hover': { bgcolor: 'action.hover' },
                        }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{order.customer_name}</Typography>
                          <Chip label={statusToKorean[order.status] || order.status} size="small"
                            sx={{
                              height: 20, fontSize: '0.65rem', fontWeight: 700,
                              bgcolor: alpha(statusColors[order.status] || '#999', 0.12),
                              color: statusColors[order.status] || '#999',
                            }} />
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                          {(order.final_payment || 0).toLocaleString()}원
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* ─── Field Reports (event-specific only) ─── */}
          {selectedEventId !== 'all' && (
            <Grid item xs={12}>
              <FieldReportSection eventId={selectedEventId} eventName={dashboardData.eventName || ''} />
            </Grid>
          )}
        </Grid>
      )}

      {/* ─── Order Detail Modal ─── */}
      {selectedOrder && (
        <OrderDetailModal
          open={isModalOpen}
          onClose={() => { setIsModalOpen(false); setSelectedOrder(null); }}
          order={selectedOrder}
          events={events}
          hasPermission={hasPermission}
          statusToKorean={statusToKorean}
          products={products}
          productsMap={productsMap}
          addNotification={addNotification}
          onUpdate={fetchData}
          productsLoading={productsLoading}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Box>
  );
};

export default DashboardPage;