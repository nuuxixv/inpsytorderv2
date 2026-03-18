import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Warning as WarningIcon,
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
import { formatISO, startOfToday, endOfToday, format, subYears } from 'date-fns';
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

// ─── Compact KPI Item (For Bento Row 1) ───
const CompactKpi = ({ title, value, icon: Icon, color, yoyPct }) => {
  return (
    <Box sx={{ flex: 1, p: 2, borderRadius: 2, bgcolor: alpha(color, 0.04), border: `1px solid ${alpha(color, 0.1)}`, display: 'flex', alignItems: 'center', gap: 2 }}>
      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(color, 0.1) }}>
        <Icon sx={{ fontSize: 28, color }} />
      </Box>
      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>{title}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'end', gap: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color }}>{value}</Typography>
          {yoyPct !== undefined && yoyPct !== null && (
            <Chip 
              label={`${yoyPct > 0 ? '▲' : yoyPct < 0 ? '▼' : '-'} ${Math.abs(yoyPct)}%`} 
              size="small" 
              sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: yoyPct > 0 ? alpha('#10B981', 0.15) : alpha('#EF4444', 0.15), color: yoyPct > 0 ? '#10B981' : '#EF4444', mb: 0.5 }} 
            />
          )}
        </Box>
      </Box>
    </Box>
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
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>주문 처리 현황</Typography>
      <Box sx={{ display: 'flex', width: '100%', borderRadius: 2, overflow: 'hidden', height: 28, position: 'relative' }}>
        {segments.map(seg => (
          <Tooltip key={seg.key} title={`${statusToKorean[seg.key]}: ${seg.count}건 (${seg.pct.toFixed(1)}%)`} arrow>
            <Box sx={{
              flex: seg.count, bgcolor: statusColors[seg.key], minWidth: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.4s ease',
            }}>
              {seg.pct > 12 && (
                <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, fontSize: '0.65rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', px: 0.5 }}>
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
    </Box>
  );
};

// ─── Product Ranking Box ───
const RankingBox = ({ title, icon: Icon, color, items }) => (
  <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
      <Icon sx={{ fontSize: 20, color }} />
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography>
    </Box>
    <Box sx={{ flex: 1, bgcolor: alpha(color, 0.03), borderRadius: 2, p: 2, minWidth: 0 }}>
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>판매 내역 없음</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
          {items.map((item, i) => (
            <Box key={item.product_id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, bg: '#fff', p: 1, borderRadius: 1, minWidth: 0 }}>
               <Typography variant="caption" sx={{ fontWeight: 800, color: i < 3 ? color : 'text.disabled', minWidth: 16 }}>{i + 1}</Typography>
               <Tooltip title={item.name} arrow placement="top">
                 <Typography variant="body2" sx={{ flex: 1, fontWeight: i < 3 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, cursor: 'pointer' }}>
                   {item.name}
                 </Typography>
               </Tooltip>
               <Chip label={`${item.totalQuantity}부`} size="small" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700, bgcolor: i === 0 ? alpha(color, 0.15) : 'action.hover', color: i === 0 ? color : 'text.secondary', flexShrink: 0 }} />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  </Box>
);

// ─── Field Report Section ───
const FieldReportSection = ({ eventId, eventName, revenueData }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editDayNumber, setEditDayNumber] = useState(1);
  const [editAuthor, setEditAuthor] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchReports = useCallback(async () => {
    // If it's a multi-event filter (like "Overall"), we don't save reports to a single event ID easily
    if (!eventId || eventId === 'all') {
      setReports([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.from('field_reports').select('*').eq('event_id', eventId).order('day_number', { ascending: true }).order('created_at', { ascending: false });
      if (!error) setReports(data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [eventId]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const handleSave = async () => {
    if (!editContent.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await supabase.from('field_reports').update({ content: editContent, day_number: editDayNumber, author_name: editAuthor, updated_at: new Date().toISOString() }).eq('id', editingId);
      } else {
        await supabase.from('field_reports').insert({ event_id: eventId, content: editContent, day_number: editDayNumber, author_name: editAuthor });
      }
      setIsEditing(false); setEditingId(null); fetchReports();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleEdit = (report) => {
    setEditingId(report.id); setEditContent(report.content); setEditDayNumber(report.day_number || 1); setEditAuthor(report.author_name || ''); setIsEditing(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('삭제하시겠습니까?')) return;
    await supabase.from('field_reports').delete().eq('id', id);
    fetchReports();
  };

  const handleNew = () => {
    setEditingId(null);
    const testRev = (revenueData?.testRevenue || 0).toLocaleString();
    const bookRev = (revenueData?.bookRevenue || 0).toLocaleString();
    const totalRev = (revenueData?.totalRevenue || 0).toLocaleString();
    setEditContent(`${eventName || '전체'} 현장마케팅 보고드립니다.\n\n0. 판매\n검사 판매: ${testRev}원\n도서 판매: ${bookRev}원\n합계: ${totalRev}원\n\n1. 도서 관련\n\n2. 검사 관련\n\n이상 현장마케팅 마무리하겠습니다.`);
    setEditDayNumber(1); setEditAuthor(''); setIsEditing(true);
  };

  if (!eventId || eventId === 'all') {
    return (
      <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
        <Typography variant="body2">특정 행사를 선택해야 보고서를 작성할 수 있습니다.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>현장 보고서</Typography>
        </Box>
        {!isEditing && <Button size="small" startIcon={<AddIcon />} onClick={handleNew} variant="outlined" sx={{ borderRadius: 2 }}>새 보고</Button>}
      </Box>

      {isEditing && (
        <Box sx={{ mb: 2, p: 2, bgcolor: '#FAFBFC', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
            <FormControl size="small" sx={{ width: 100 }}>
              <InputLabel>일차</InputLabel>
              <Select value={editDayNumber} label="일차" onChange={e => setEditDayNumber(e.target.value)}>
                {[1, 2, 3, 4, 5].map(d => <MenuItem key={d} value={d}>{d}일차</MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" label="작성자" value={editAuthor} onChange={e => setEditAuthor(e.target.value)} sx={{ width: 120 }} />
          </Box>
          <TextField fullWidth multiline minRows={5} maxRows={15} value={editContent} onChange={e => setEditContent(e.target.value)} sx={{ mb: 1.5 }} />
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button size="small" onClick={() => setIsEditing(false)}>취소</Button>
            <Button size="small" variant="contained" onClick={handleSave} disabled={saving || !editContent.trim()}>{saving ? '저장중...' : '저장'}</Button>
          </Box>
        </Box>
      )}

      {loading ? ( <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={20} /></Box> ) : reports.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>생성된 보고서가 없습니다</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {reports.map((report) => (
            <Box key={report.id} sx={{ p: 2, bgcolor: '#FAFBFC', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip label={`${report.day_number || 1}일차`} size="small" sx={{ fontWeight: 700, fontSize: '0.7rem' }} />
                  {report.author_name && <Typography variant="caption" color="text.secondary">{report.author_name}</Typography>}
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton size="small" onClick={() => handleEdit(report)}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                  <IconButton size="small" onClick={() => handleDelete(report.id)}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
                </Box>
              </Box>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '0.8125rem' }}>{report.content}</Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};


// ─── Audit Log Section (Master Only) ───
const AuditLogSection = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profilesMap, setProfilesMap] = useState({});

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch latest 20 logs
      const { data: logData, error: logError } = await supabase
        .from('admin_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
        
      if (logError) throw logError;

      // Fetch user profiles for mapping
      const { data: profiles, error: profError } = await supabase
        .from('user_profiles')
        .select('id, name, email');
        
      if (!profError && profiles) {
        const pMap = {};
        profiles.forEach(p => pMap[p.id] = p);
        setProfilesMap(pMap);
      }

      setLogs(logData || []);
    } catch (e) {
      console.error('Failed to fetch admin logs', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>시스템 접속 기록 (최근 20건)</Typography>
        <IconButton size="small" onClick={fetchLogs}><RefreshIcon sx={{ fontSize: 18 }} /></IconButton>
      </Box>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={20} /></Box>
      ) : logs.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>기록이 없습니다.</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {logs.map(log => {
            const profile = profilesMap[log.user_id] || {};
            const isLogin = log.action === 'login';
            return (
              <Box key={log.id} sx={{ p: 1.5, bgcolor: '#FAFBFC', borderRadius: 2, border: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Chip label={isLogin ? '로그인' : '로그아웃'} size="small" color={isLogin ? 'success' : 'default'} sx={{ height: 20, fontSize: '0.65rem' }} />
                    <Typography variant="caption" sx={{ fontWeight: 800 }}>{profile.name || '알 수 없음'} ({profile.email || log.user_id})</Typography>
                    <Chip label={log.role} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
                  </Box>
                  <Typography variant="caption" color="text.secondary">IP: {log.ip_address}</Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  {format(new Date(log.created_at), 'MM/dd HH:mm:ss')}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};


// ═══════════════════════════════════════
// ─── MAIN DASHBOARD ───
// ═══════════════════════════════════════
const DashboardPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [productsMap, setProductsMap] = useState({});
  const [products, setProducts] = useState([]);
  
  // Hierarchy Filters State
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedSociety, setSelectedSociety] = useState('all');
  const [selectedEventId, setSelectedEventId] = useState('all');

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { hasPermission } = useAuth();
  const addNotification = useNotification();

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // ─── Data Initialization ───
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
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

        const [eventsRes, allProds] = await Promise.all([
          supabase.from('events').select('id, name, start_date, tags, event_year, host_society, event_season').order('start_date', { ascending: false }),
          fetchAllProducts(),
        ]);
        if (eventsRes.error) throw eventsRes.error;
        setEvents(eventsRes.data || []);
        
        setProducts(allProds);
        setProductsMap(allProds.reduce((acc, p) => { acc[p.id] = p; return acc; }, {}));
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    init();
  }, []);

  // ─── Derived Filters ───
  const years = useMemo(() => {
    const ySet = new Set(events.map(e => {
      if (e.event_year) return e.event_year.toString();
      return e.start_date ? new Date(e.start_date).getFullYear().toString() : null;
    }).filter(Boolean));
    return Array.from(ySet).sort((a,b) => b.localeCompare(a));
  }, [events]);

  const societies = useMemo(() => {
    const sSet = new Set();
    events.forEach(e => {
      if (e.host_society) {
        sSet.add(e.host_society);
      } else if (e.tags) {
        // Simple heuristic filtering for backward compatibility
        e.tags.forEach(t => {
          if (!['춘계', '추계', '연수강좌', '온라인', '오프라인'].includes(t)) sSet.add(t);
        });
      }
    });
    return Array.from(sSet).sort();
  }, [events]);

  const filteredEventsForDropdown = useMemo(() => {
    return events.filter(e => {
      const eYear = e.event_year ? e.event_year.toString() : (e.start_date ? new Date(e.start_date).getFullYear().toString() : null);
      const matchYear = selectedYear === 'all' || eYear === selectedYear;
      
      const eSocietyMatches = e.host_society ? e.host_society === selectedSociety : (e.tags && e.tags.includes(selectedSociety));
      const matchSociety = selectedSociety === 'all' || eSocietyMatches;
      
      return matchYear && matchSociety;
    });
  }, [events, selectedYear, selectedSociety]);

  // Handle cascading dropdown resets
  useEffect(() => { setSelectedEventId('all'); }, [selectedYear, selectedSociety]);

  // ─── Aggregate Data Fetching ───
  const fetchDataForEventIds = async (eventIds, targetEventName = '전체(합계)') => {
    if (!eventIds || eventIds.length === 0) {
      setDashboardData({
        eventName: targetEventName, totalRevenue: 0, bookRevenue: 0, testRevenue: 0,
        totalOrders: 0, statusCounts: {}, bookTop5: [], testTop5: [], recentOrders: []
      });
      return;
    }

    // Split eventIds into chunks if there are too many, but usually it's fine for REST
    const [ordersRes, recentRes] = await Promise.all([
      supabase.from('orders').select('id, final_payment, status, created_at, order_items(product_id, quantity, price_at_purchase)').in('event_id', eventIds),
      supabase.from('orders').select('*, events(name), order_items(*, products(*))').in('event_id', eventIds).order('created_at', { ascending: false }).limit(5),
    ]);

    if (ordersRes.error) throw ordersRes.error;
    
    // YoY Calculation for the previous year (same selected society, previous year)
    let yoyPct = null;
    if (selectedYear !== 'all' && selectedEventId === 'all') {
      const prevYearStr = (parseInt(selectedYear) - 1).toString();
      const prevYearEvents = events.filter(e => {
        const eYear = e.event_year ? e.event_year.toString() : (e.start_date ? new Date(e.start_date).getFullYear().toString() : null);
        const matchYear = eYear === prevYearStr;
        const eSocietyMatches = e.host_society ? e.host_society === selectedSociety : (e.tags && e.tags.includes(selectedSociety));
        const matchSociety = selectedSociety === 'all' || eSocietyMatches;
        return matchYear && matchSociety;
      }).map(e => e.id);
      
      if (prevYearEvents.length > 0) {
        const { data: prevOrders } = await supabase.from('orders').select('final_payment').in('event_id', prevYearEvents);
        if (prevOrders) {
          const prevTotal = prevOrders.reduce((sum, o) => sum + (o.final_payment || 0), 0);
          const currentTotal = ordersRes.data.reduce((sum, o) => sum + (o.final_payment || 0), 0);
          if (prevTotal > 0) {
            yoyPct = Math.round(((currentTotal - prevTotal) / prevTotal) * 100);
          }
        }
      }
    }

    const orders = ordersRes.data || [];
    const statusCounts = {};
    let bookRevenue = 0, testRevenue = 0, totalRevenue = 0;
    const productSales = {};

    const todayStart = formatISO(startOfToday());
    let todayOrdersCount = 0;

    orders.forEach(order => {
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
      totalRevenue += order.final_payment || 0;
      if (order.created_at >= todayStart) todayOrdersCount++;

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
    const bookTop5 = salesList.filter(p => (p.category || '').includes('도서') || (p.category || '').toLowerCase().includes('book')).sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, 5);
    const testTop5 = salesList.filter(p => (p.category || '').includes('검사') || (p.category || '').toLowerCase().includes('test')).sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, 5);

    setDashboardData({
      eventName: targetEventName, totalRevenue, bookRevenue, testRevenue, yoyPct,
      totalOrders: orders.length, statusCounts, bookTop5, testTop5, todayOrdersCount,
      recentOrders: recentRes.data || []
    });
  };

  const fetchData = async () => {
    if (Object.keys(productsMap).length === 0) return;
    setLoading(true);
    try {
      if (selectedEventId === 'all') {
        const eventIds = filteredEventsForDropdown.map(e => e.id);
        const nameLabel = selectedSociety !== 'all' 
          ? `${selectedYear !== 'all' ? selectedYear + '년 ' : ''}${selectedSociety} 누적 합계` 
          : `${selectedYear !== 'all' ? selectedYear + '년 ' : '전체 기간 '}누적 합계`;
        await fetchDataForEventIds(eventIds, nameLabel);
      } else {
        const evt = events.find(e => e.id === selectedEventId);
        await fetchDataForEventIds([selectedEventId], evt ? evt.name : '개별 행사 보기');
      }
    } catch (e) {
      console.error(e);
      setDashboardData(null);
    }
    setLoading(false); setRefreshing(false);
  };

  useEffect(() => { fetchData(); }, [selectedEventId, selectedYear, selectedSociety, productsMap]);

  // ─── Handlers ───
  const handleRefresh = () => { setRefreshing(true); fetchData(); };
  const handleRowClick = (order) => { setSelectedOrder(order); setIsModalOpen(true); };

  // ─── Render ───
  if (events.length === 0 && loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;
  }

  const pendingCount = dashboardData?.statusCounts?.pending || 0;
  const paidCount = dashboardData?.statusCounts?.paid || 0;
  const hasAlerts = pendingCount > 0 || paidCount > 0;

  return (
    <Box sx={{ pb: 6 }}>
      {/* ─── Header & Hierarchy Filters ─── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, mb: 2, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>대시보드</Typography>
        <IconButton onClick={handleRefresh} disabled={refreshing || loading} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
          <RefreshIcon sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none', fontSize: 20 }} />
        </IconButton>
      </Box>

      <Card sx={{ mb: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', borderRadius: 3 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>연도 보기</InputLabel>
                <Select value={selectedYear} label="연도 보기" onChange={e => setSelectedYear(e.target.value)}>
                  <MenuItem value="all"><em>전체 연도</em></MenuItem>
                  {years.map(y => <MenuItem key={y} value={y}>{y}년</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>학회 필터 (태그)</InputLabel>
                <Select value={selectedSociety} label="학회 필터 (태그)" onChange={e => setSelectedSociety(e.target.value)}>
                  <MenuItem value="all"><em>모든 학회</em></MenuItem>
                  {societies.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>상세 행사</InputLabel>
                <Select value={selectedEventId} label="상세 행사" onChange={e => setSelectedEventId(e.target.value)}>
                  <MenuItem value="all"><em>{filteredEventsForDropdown.length > 0 ? '전체 내역 합산 (합계)' : '관련 행사 없음'}</em></MenuItem>
                  {filteredEventsForDropdown.map(ev => <MenuItem key={ev.id} value={ev.id}>{ev.name} ({ev.start_date ? new Date(ev.start_date).toLocaleDateString() : '일자 미상'})</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : dashboardData && (
        <>
        <Grid container spacing={3}>
          {/* ─── Row 1: Revenue Metrics (Unified Bento Row) ─── */}
          <Grid size={{ xs: 12 }}>
            <Card sx={{ borderRadius: 3, boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}>
              <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>
                  {dashboardData.eventName} 매출 현황
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, width: '100%' }}>
                  <CompactKpi title="총 검사 판매액" value={`${(dashboardData.testRevenue || 0).toLocaleString()}원`} icon={TestIcon} color="#6366F1" />
                  <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />
                  <CompactKpi title="총 도서 판매액" value={`${(dashboardData.bookRevenue || 0).toLocaleString()}원`} icon={BookIcon} color="#3B82F6" />
                  <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />
                  <CompactKpi title="조합 합산 매출액" value={`${(dashboardData.totalRevenue || 0).toLocaleString()}원`} icon={ReceiptIcon} color="#10B981" yoyPct={dashboardData.yoyPct} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* ─── Row 2: Top Rankings (Balanced 50/50) ─── */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ borderRadius: 3, height: '100%', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
              <CardContent><RankingBox title="검사 판매 TOP 5" icon={TestIcon} color="#6366F1" items={dashboardData.testTop5 || []} /></CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ borderRadius: 3, height: '100%', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
              <CardContent><RankingBox title="도서 판매 TOP 5" icon={BookIcon} color="#3B82F6" items={dashboardData.bookTop5 || []} /></CardContent>
            </Card>
          </Grid>

          {/* ─── Row 3: Operational Status ─── */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ borderRadius: 3, height: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}>
              <CardContent sx={{ p: 3, '&:last-child': { pb: 3 }, display: 'flex', flexDirection: 'column', height: '100%', gap: 3 }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>오늘 접수 내역</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha('#F59E0B', 0.1) }}><CartIcon sx={{ color: '#F59E0B' }} /></Box>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#F59E0B' }}>{dashboardData.todayOrdersCount}건</Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>전체 누적 {dashboardData.totalOrders}건 중 접수</Typography>
                </Box>

                {hasAlerts && (
                  <Box sx={{ mt: 'auto' }}>
                    <Box onClick={() => navigate('/admin/orders')} sx={{ p: 2, borderRadius: 2, cursor: 'pointer', bgcolor: alpha('#F59E0B', 0.08), border: `1px solid ${alpha('#F59E0B', 0.2)}`, transition: 'all 0.2s', '&:hover': { bgcolor: alpha('#F59E0B', 0.15) } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <WarningIcon sx={{ color: '#F59E0B', fontSize: 20 }} />
                        <Typography variant="caption" sx={{ fontWeight: 800, color: '#F59E0B' }}>처리 필요 알림</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {pendingCount > 0 && <Typography variant="body2" sx={{ fontWeight: 600 }}>결제대기 {pendingCount}건</Typography>}
                        {paidCount > 0 && <Typography variant="body2" sx={{ fontWeight: 600 }}>배송준비 필요 {paidCount}건</Typography>}
                      </Box>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <Card sx={{ borderRadius: 3, height: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}>
              <CardContent sx={{ p: 3, '&:last-child': { pb: 3 }, display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
                <StatusBar statusCounts={dashboardData.statusCounts || {}} totalOrders={dashboardData.totalOrders || 0} />
              </CardContent>
            </Card>
          </Grid>

          {/* ─── Row 4: Reports and Recent Actions ─── */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ borderRadius: 3, height: '100%', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
              <CardContent>
                <FieldReportSection 
                  eventId={selectedEventId} 
                  eventName={dashboardData.eventName} 
                  revenueData={dashboardData} 
                />
              </CardContent>
            </Card>
          </Grid>
          
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ borderRadius: 3, height: '100%', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
              <CardContent>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>최근 주문 실시간 내역</Typography>
                {(dashboardData.recentOrders || []).length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>주문 내역이 없습니다</Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {dashboardData.recentOrders.map(order => (
                      <Box key={order.id} onClick={() => handleRowClick(order)} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, borderRadius: 2, cursor: 'pointer', transition: 'bgcolor 0.15s', '&:hover': { bgcolor: 'action.hover' }}}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{order.customer_name}</Typography>
                          <Chip label={statusToKorean[order.status] || order.status} size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: alpha(statusColors[order.status] || '#999', 0.12), color: statusColors[order.status] || '#999' }} />
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="body2" sx={{ fontWeight: 800, color: 'primary.main' }}>{(order.final_payment || 0).toLocaleString()}원</Typography>
                          <Typography variant="caption" sx={{ color: 'text.disabled' }}>{format(new Date(order.created_at), 'MM/dd HH:mm')}</Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {hasPermission('master') && (
          <Grid container spacing={3} sx={{ mt: 0 }}>
            <Grid size={{ xs: 12 }}>
              <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                <CardContent>
                  <AuditLogSection />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
        </>
      )}

      {/* ─── Order Detail Modal ─── */}
      {selectedOrder && (
        <OrderDetailModal
          open={isModalOpen} onClose={() => { setIsModalOpen(false); setSelectedOrder(null); }}
          order={selectedOrder} events={events} hasPermission={hasPermission}
          statusToKorean={statusToKorean} products={products} productsMap={productsMap}
          addNotification={addNotification} onUpdate={fetchData} productsLoading={loading}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Box>
  );
};

export default DashboardPage;