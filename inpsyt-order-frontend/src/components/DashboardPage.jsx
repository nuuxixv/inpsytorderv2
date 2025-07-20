import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardContent, CircularProgress, Button, ButtonGroup } from '@mui/material';
import { supabase } from '../supabaseClient';
import { subDays, formatISO } from 'date-fns';

const StatCard = ({ title, value, description }) => (
  <Card>
    <CardContent>
      <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
        {title}
      </Typography>
      <Typography variant="h5" component="div">
        {value}
      </Typography>
      {description && (
        <Typography sx={{ mt: 1.5 }} color="text.secondary">
          {description}
        </Typography>
      )}
    </CardContent>
  </Card>
);

const DashboardPage = () => {
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState(30); // Default to last 30 days

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        let ordersQuery = supabase.from('orders').select('created_at, total_amount, order_items(quantity, price_at_purchase, product_id)');

        if (dateRange !== 'all') {
          const fromDate = formatISO(subDays(new Date(), dateRange));
          ordersQuery = ordersQuery.gte('created_at', fromDate);
        }

        const [ordersRes, productsRes] = await Promise.all([
          ordersQuery,
          supabase.from('products').select('product_code, type')
        ]);

        if (ordersRes.error) throw ordersRes.error;
        if (productsRes.error) throw productsRes.error;

        const orders = ordersRes.data;
        const products = productsRes.data;

        const productTypeMap = products.reduce((acc, p) => {
          acc[p.product_code] = p.type;
          return acc;
        }, {});

        let totalSales = 0;
        let bookSales = 0;
        let testSales = 0;

        orders.forEach(order => {
          totalSales += order.total_amount || 0;
          order.order_items.forEach(item => {
            const itemType = productTypeMap[item.product_id];
            const itemTotal = item.price_at_purchase * item.quantity;
            if (itemType === '도서') {
              bookSales += itemTotal;
            } else if (itemType === '검사') {
              testSales += itemTotal;
            }
          });
        });

        const totalOrders = orders.length;
        const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

        setSummaryData({
          totalSales,
          bookSales: {
            amount: bookSales,
            percentage: totalSales > 0 ? Math.round((bookSales / totalSales) * 100) : 0,
          },
          testSales: {
            amount: testSales,
            percentage: totalSales > 0 ? Math.round((testSales / totalSales) * 100) : 0,
          },
          totalOrders,
          avgOrderValue,
        });

      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('데이터를 불러오는 데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [dateRange]);

  if (loading) {
    return <CircularProgress />;
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  if (!summaryData) {
    return <Typography>데이터가 없습니다.</Typography>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" gutterBottom>
          대시보드
        </Typography>
        <ButtonGroup variant="outlined" aria-label="outlined button group">
          <Button onClick={() => setDateRange(7)} variant={dateRange === 7 ? 'contained' : 'outlined'}>최근 7일</Button>
          <Button onClick={() => setDateRange(30)} variant={dateRange === 30 ? 'contained' : 'outlined'}>최근 30일</Button>
          <Button onClick={() => setDateRange('all')} variant={dateRange === 'all' ? 'contained' : 'outlined'}>전체</Button>
        </ButtonGroup>
      </Box>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6} lg={3}>
          <StatCard title="총 매출" value={`${summaryData.totalSales.toLocaleString()}원`} />
        </Grid>
        <Grid item xs={12} md={6} lg={3}>
          <StatCard title="총 주문 건수" value={`${summaryData.totalOrders}건`} />
        </Grid>
        <Grid item xs={12} md={6} lg={3}>
          <StatCard title="평균 주문 금액" value={`${Math.round(summaryData.avgOrderValue).toLocaleString()}원`} />
        </Grid>
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6">매출 비중</Typography>
              <Box sx={{ mt: 2 }}>
                <Typography>도서 매출: {summaryData.bookSales.amount.toLocaleString()}원 ({summaryData.bookSales.percentage}%)</Typography>
                <Typography>검사 매출: {summaryData.testSales.amount.toLocaleString()}원 ({summaryData.testSales.percentage}%)</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage;
