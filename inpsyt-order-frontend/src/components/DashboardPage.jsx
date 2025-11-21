import React, { useState, useEffect } from 'react';
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
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper,
  IconButton,
  Chip,
  alpha,
  useTheme,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Refresh as RefreshIcon,
  AttachMoney as MoneyIcon,
  ShoppingCart as CartIcon,
  Today as TodayIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '../supabaseClient';
import { startOfYear, endOfYear, getYear, subYears, formatISO, startOfToday, endOfToday } from 'date-fns';
import OrderDetailModal from './OrderDetailModal';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';

const StatCard = ({ title, value, icon: Icon, trend, trendValue, color = 'primary' }) => {
  const theme = useTheme();
  
  return (
    <Card 
      sx={{ 
        height: '100%',
        background: `linear-gradient(135deg, ${alpha(theme.palette[color].main, 0.1)} 0%, ${alpha(theme.palette[color].main, 0.05)} 100%)`,
        border: `1px solid ${alpha(theme.palette[color].main, 0.2)}`,
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 8px 24px ${alpha(theme.palette[color].main, 0.25)}`,
        }
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 500 }} color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', color: `${color}.main` }}>
              {value}
            </Typography>
          </Box>
          {Icon && (
            <Box 
              sx={{ 
                p: 1.5, 
                borderRadius: 2, 
                bgcolor: alpha(theme.palette[color].main, 0.1),
                color: `${color}.main`
              }}
            >
              <Icon sx={{ fontSize: 28 }} />
            </Box>
          )}
        </Box>
        {trend && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {trend === 'up' ? (
              <TrendingUpIcon sx={{ fontSize: 16, color: 'success.main' }} />
            ) : (
              <TrendingDownIcon sx={{ fontSize: 16, color: 'error.main' }} />
            )}
            <Typography 
              variant="caption" 
              sx={{ 
                color: trend === 'up' ? 'success.main' : 'error.main',
                fontWeight: 600
              }}
            >
              {trendValue}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              vs 작년
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

const statusToKorean = {
  pending: '결제대기',
  paid: '결제완료',
  preparing: '상품준비중',
  shipped: '배송중',
  delivered: '배송완료',
  cancelled: '주문취소',
  refunded: '결제취소',
};

const statusColors = {
  pending: 'warning',
  paid: 'success',
  preparing: 'info',
  shipped: 'primary',
  delivered: 'success',
  cancelled: 'error',
  refunded: 'error',
};

const DashboardPage = () => {
  const theme = useTheme();
  const [events, setEvents] = useState([]);
  const [products, setProducts] = useState([]);
  const [productsMap, setProductsMap] = useState({});
  const [productsLoading, setProductsLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState('all');
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const { hasPermission } = useAuth();
  const addNotification = useNotification();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchAllProducts = async () => {
    let allProducts = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .range(from, from + pageSize - 1);
      
      if (error) throw error;
      
      allProducts = allProducts.concat(data);
      
      if (data.length < pageSize) {
        break;
      }
      
      from += pageSize;
    }
    return allProducts;
  };

  const fetchData = async () => {
    if (!selectedEventId) return;
    setLoading(true);
    setError(null);
    try {
      if (selectedEventId === 'all') {
        await fetchOverallData();
      } else {
        await fetchEventSpecificData();
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('대시보드 데이터를 불러오는 데 실패했습니다.');
      setDashboardData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setProductsLoading(true);
      try {
        const [eventsRes, allProducts] = await Promise.all([
          supabase.from('events').select('id, name').order('start_date', { ascending: false }).limit(10),
          fetchAllProducts()
        ]);

        if (eventsRes.error) throw eventsRes.error;

        setEvents(eventsRes.data);
        setProducts(allProducts);
        const newProductsMap = allProducts.reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {});
        setProductsMap(newProductsMap);
      } catch (err) {
        console.error('Error fetching initial data:', err);
        setError('초기 데이터 로딩에 실패했습니다.');
      } finally {
        setProductsLoading(false);
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!productsLoading) {
      fetchData();
    }
  }, [selectedEventId, productsLoading]);

  const fetchOverallData = async () => {
    const fromDate = formatISO(startOfYear(new Date()));
    const [ordersRes, recentOrdersRes] = await Promise.all([
      supabase.from('orders').select('final_payment, events(name)').gte('created_at', fromDate),
      supabase.from('orders').select('*, events(name), order_items(*, products(*))').order('created_at', { ascending: false }).limit(5)
    ]);
    if (ordersRes.error) throw ordersRes.error;
    if (recentOrdersRes.error) throw recentOrdersRes.error;
    const annualData = ordersRes.data.reduce((acc, order) => {
      const eventName = order.events?.name || '기타';
      if (!acc[eventName]) { acc[eventName] = { name: eventName, revenue: 0, orders: 0 }; }
      acc[eventName].revenue += order.final_payment || 0;
      acc[eventName].orders += 1;
      return acc;
    }, {});
    setDashboardData({ viewType: 'overall', annualData: Object.values(annualData), recentOrders: recentOrdersRes.data });
  };

  const fetchEventSpecificData = async () => {
    const todayStart = formatISO(startOfToday());
    const todayEnd = formatISO(endOfToday());
    const [currentEventRes, totalOrdersRes, todayOrdersRes, recentOrdersRes] = await Promise.all([
      supabase.from('events').select('name, start_date').eq('id', selectedEventId).single(),
      supabase.from('orders').select('final_payment').eq('event_id', selectedEventId),
      supabase.from('orders').select('final_payment, status').eq('event_id', selectedEventId).gte('created_at', todayStart).lt('created_at', todayEnd),
      supabase.from('orders').select('*, events(name), order_items(*, products(*))').eq('event_id', selectedEventId).order('created_at', { ascending: false }).limit(5),
    ]);

    if (currentEventRes.error) throw currentEventRes.error;
    if (totalOrdersRes.error) throw totalOrdersRes.error;
    if (todayOrdersRes.error) throw todayOrdersRes.error;
    if (recentOrdersRes.error) throw recentOrdersRes.error;

    const totalRevenue = totalOrdersRes.data.reduce((sum, order) => sum + order.final_payment, 0);
    const totalOrdersCount = totalOrdersRes.data.length;
    const todayRevenue = todayOrdersRes.data.reduce((sum, order) => sum + order.final_payment, 0);
    const todayOrdersCount = todayOrdersRes.data.length;
    const todayStatusCounts = todayOrdersRes.data.reduce((acc, order) => { acc[order.status] = (acc[order.status] || 0) + 1; return acc; }, {});

    let lastYearData = null;
    const currentEvent = currentEventRes.data;
    if (currentEvent) {
      const coreEventName = currentEvent.name.replace(/\d{4}년?/g, '').trim();
      const lastYear = getYear(subYears(new Date(currentEvent.start_date), 1));
      const { data: lastYearEvents } = await supabase.from('events').select('id').ilike('name', `%${coreEventName}%`).gte('start_date', formatISO(startOfYear(new Date(lastYear, 0, 1)))).lt('start_date', formatISO(endOfYear(new Date(lastYear, 11, 31))));
      if (lastYearEvents && lastYearEvents.length > 0) {
        const { data: lastYearOrders } = await supabase.from('orders').select('final_payment').eq('event_id', lastYearEvents[0].id);
        if (lastYearOrders) {
          lastYearData = { totalRevenue: lastYearOrders.reduce((sum, order) => sum + order.final_payment, 0), totalOrdersCount: lastYearOrders.length };
        }
      }
    }

    setDashboardData({ viewType: 'event', totalRevenue, totalOrdersCount, todayRevenue, todayOrdersCount, todayStatusCounts, recentOrders: recentOrdersRes.data, lastYearData });
  };

  const handleEventChange = (event) => { setSelectedEventId(event.target.value); };
  const handleRowClick = (order) => { setSelectedOrder(order); setIsModalOpen(true); };
  const handleCloseModal = () => { setIsModalOpen(false); setSelectedOrder(null); };
  const handleUpdate = () => { fetchData(); };
  const handleRefresh = () => { setRefreshing(true); fetchData(); };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF1919'];

  const renderOverallView = () => {
    if (!dashboardData || dashboardData.viewType !== 'overall') return null;
    const { annualData, recentOrders } = dashboardData;
    
    const totalRevenue = annualData.reduce((sum, item) => sum + item.revenue, 0);
    const totalOrders = annualData.reduce((sum, item) => sum + item.orders, 0);
    
    return (
      <>
        <Grid item xs={12}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard 
                title="연간 총 매출" 
                value={`${totalRevenue.toLocaleString()}원`}
                icon={MoneyIcon}
                color="primary"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard 
                title="연간 총 주문" 
                value={`${totalOrders}건`}
                icon={CartIcon}
                color="success"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard 
                title="활성 이벤트" 
                value={`${annualData.length}개`}
                icon={AssessmentIcon}
                color="info"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard 
                title="평균 주문액" 
                value={`${totalOrders > 0 ? Math.round(totalRevenue / totalOrders).toLocaleString() : 0}원`}
                icon={TodayIcon}
                color="warning"
              />
            </Grid>
          </Grid>
        </Grid>
        
        <Grid item xs={12} md={7}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                연간 실적 분석 (매출 기준)
              </Typography>
              <Box sx={{ height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={annualData} 
                      cx="50%" 
                      cy="50%" 
                      labelLine={false} 
                      outerRadius={120} 
                      fill="#8884d8" 
                      dataKey="revenue" 
                      nameKey="name"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {annualData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value.toLocaleString()}원`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={5}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                최근 주문
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>주문번호</TableCell>
                      <TableCell>주문자</TableCell>
                      <TableCell>상태</TableCell>
                      <TableCell align="right">금액</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentOrders.map((row) => (
                      <TableRow 
                        key={row.id} 
                        hover 
                        onClick={() => handleRowClick(row)} 
                        sx={{ 
                          cursor: 'pointer',
                          '&:hover': {
                            bgcolor: alpha(theme.palette.primary.main, 0.05)
                          }
                        }}
                      >
                        <TableCell>{row.id}</TableCell>
                        <TableCell>{row.customer_name}</TableCell>
                        <TableCell>
                          <Chip 
                            label={statusToKorean[row.status] || row.status}
                            color={statusColors[row.status] || 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          {row.final_payment.toLocaleString()}원
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </>
    );
  };

  const renderEventSpecificView = () => {
    if (!dashboardData || dashboardData.viewType !== 'event') return null;
    const { totalRevenue, totalOrdersCount, todayRevenue, todayOrdersCount, todayStatusCounts, recentOrders, lastYearData } = dashboardData;
    
    const revenueTrend = lastYearData && lastYearData.totalRevenue > 0
      ? ((totalRevenue - lastYearData.totalRevenue) / lastYearData.totalRevenue * 100).toFixed(1)
      : null;
    
    const ordersTrend = lastYearData && lastYearData.totalOrdersCount > 0
      ? ((totalOrdersCount - lastYearData.totalOrdersCount) / lastYearData.totalOrdersCount * 100).toFixed(1)
      : null;
    
    return (
      <Grid container item xs={12} spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: 'primary.main' }}>
            📊 오늘의 현황
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard 
                title="오늘 매출" 
                value={`${todayRevenue.toLocaleString()}원`}
                icon={MoneyIcon}
                color="primary"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard 
                title="오늘 주문" 
                value={`${todayOrdersCount}건`}
                icon={CartIcon}
                color="success"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard 
                title="결제완료" 
                value={`${todayStatusCounts['paid'] || 0}건`}
                icon={TodayIcon}
                color="info"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard 
                title="결제대기" 
                value={`${todayStatusCounts['pending'] || 0}건`}
                icon={AssessmentIcon}
                color="warning"
              />
            </Grid>
          </Grid>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                최근 주문
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>주문자</TableCell>
                      <TableCell>상태</TableCell>
                      <TableCell align="right">금액</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentOrders.map((row) => (
                      <TableRow 
                        key={row.id} 
                        hover 
                        onClick={() => handleRowClick(row)} 
                        sx={{ 
                          cursor: 'pointer',
                          '&:hover': {
                            bgcolor: alpha(theme.palette.primary.main, 0.05)
                          }
                        }}
                      >
                        <TableCell>{row.customer_name}</TableCell>
                        <TableCell>
                          <Chip 
                            label={statusToKorean[row.status] || row.status}
                            color={statusColors[row.status] || 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          {row.final_payment.toLocaleString()}원
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, height: '100%' }}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                  금년 총 성과
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      총 매출
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                      {totalRevenue.toLocaleString()}원
                    </Typography>
                    {revenueTrend && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        {parseFloat(revenueTrend) >= 0 ? (
                          <TrendingUpIcon sx={{ fontSize: 16, color: 'success.main' }} />
                        ) : (
                          <TrendingDownIcon sx={{ fontSize: 16, color: 'error.main' }} />
                        )}
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: parseFloat(revenueTrend) >= 0 ? 'success.main' : 'error.main',
                            fontWeight: 600
                          }}
                        >
                          {Math.abs(parseFloat(revenueTrend))}% vs 작년
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      총 주문
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                      {totalOrdersCount}건
                    </Typography>
                    {ordersTrend && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        {parseFloat(ordersTrend) >= 0 ? (
                          <TrendingUpIcon sx={{ fontSize: 16, color: 'success.main' }} />
                        ) : (
                          <TrendingDownIcon sx={{ fontSize: 16, color: 'error.main' }} />
                        )}
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: parseFloat(ordersTrend) >= 0 ? 'success.main' : 'error.main',
                            fontWeight: 600
                          }}
                        >
                          {Math.abs(parseFloat(ordersTrend))}% vs 작년
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {lastYearData && (
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                    작년 동일 학회
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        총 매출
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {lastYearData.totalRevenue.toLocaleString()}원
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        총 주문
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {lastYearData.totalOrdersCount}건
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            )}
          </Box>
        </Grid>
      </Grid>
    );
  };

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
          📈 대시보드
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <IconButton 
            onClick={handleRefresh} 
            disabled={refreshing}
            sx={{ 
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.2),
              }
            }}
          >
            <RefreshIcon sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </IconButton>
          <FormControl sx={{ minWidth: 240 }} size="small">
            <InputLabel id="event-select-label">학회 선택</InputLabel>
            <Select 
              labelId="event-select-label" 
              id="event-select" 
              value={selectedEventId} 
              label="학회 선택" 
              onChange={handleEventChange}
            >
              <MenuItem value="all"><em>전체</em></MenuItem>
              {events.map((event) => (
                <MenuItem key={event.id} value={event.id}>{event.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>
      
      {loading || productsLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {selectedEventId === 'all' ? renderOverallView() : renderEventSpecificView()}
        </Grid>
      )}
      
      {selectedOrder && (
        <OrderDetailModal 
          open={isModalOpen} 
          onClose={handleCloseModal} 
          order={selectedOrder} 
          events={events} 
          hasPermission={hasPermission} 
          statusToKorean={statusToKorean} 
          products={products} 
          productsMap={productsMap} 
          addNotification={addNotification} 
          onUpdate={handleUpdate} 
          productsLoading={productsLoading} 
        />
      )}
      
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </Box>
  );
};

export default DashboardPage;