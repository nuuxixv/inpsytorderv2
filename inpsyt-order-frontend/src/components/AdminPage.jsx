import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  CircularProgress,
  Alert,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button
} from '@mui/material';

const AdminPage = ({ user }) => {
    console.log("AdminPage received user:", user);  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*, products(*))') // 주문 상세 내역 및 상품 정보 함께 가져오기
        .order('created_at', { ascending: false });
      if (error) throw error;
      console.log("Fetched orders data:", data);
      setOrders(data);
    } catch (error) {
      setError(error.message);
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;
      
      // 상태 변경 후 목록 새로고침
      fetchOrders();

    } catch (error) {
      console.error("Error updating order status:", error);
      alert(`주문 상태 업데이트 중 오류가 발생했습니다: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate('/login'); // 로그아웃 후 로그인 페이지로 이동
    } catch (error) {
      console.error("Error logging out:", error);
      alert(`로그아웃 중 오류가 발생했습니다: ${error.message}`);
    }
  };

  // 사용자 역할 확인 (예시: user.user_metadata.role이 'master'인지 확인)
  const userRole = user?.app_metadata?.role || 'guest';
  const isMaster = userRole === 'master';

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  }

  if (error) {
    return <Alert severity="error" sx={{ mt: 4 }}>{error}</Alert>;
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" gutterBottom>
          주문 관리 ({userRole === 'master' ? '마스터' : userRole === 'manager' ? '매니저' : '게스트'})
        </Typography>
        <Button variant="outlined" color="secondary" onClick={handleLogout}>
          로그아웃
        </Button>
      </Box>
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>주문일</TableCell>
              <TableCell>주문자</TableCell>
              <TableCell>이메일</TableCell>
              <TableCell>연락처</TableCell>
              <TableCell>주소</TableCell>
              <TableCell>결제 금액</TableCell>
              <TableCell>상태</TableCell>
              <TableCell>작업</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.map((order) => (
              <React.Fragment key={order.id}>
                <TableRow>
                  <TableCell>{new Date(order.created_at).toLocaleString('ko-KR')}</TableCell>
                  <TableCell>{order.customer_name}</TableCell>
                  <TableCell>{order.email}</TableCell>
                  <TableCell>{order.phone_number}</TableCell>
                  <TableCell>{`(${order.shipping_address.postcode}) ${order.shipping_address.address} ${order.shipping_address.detail || ''}`}</TableCell>
                  <TableCell>{order.final_payment.toLocaleString()}원</TableCell>
                  <TableCell>{order.status}</TableCell> 
                  <TableCell>
                    {isMaster ? (
                      <FormControl variant="standard" sx={{ m: 1, minWidth: 120 }}>
                        <InputLabel id={`status-label-${order.id}`}>상태</InputLabel>
                        <Select
                          labelId={`status-label-${order.id}`}
                          id={`status-select-${order.id}`}
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          label="상태"
                        >
                          <MenuItem value={"pending"}>대기 중</MenuItem>
                          <MenuItem value={"paid"}>결제 완료</MenuItem>
                          <MenuItem value={"shipped"}>출고 완료</MenuItem>
                          <MenuItem value={"cancelled"}>주문 취소</MenuItem>
                        </Select>
                      </FormControl>
                    ) : (
                      <Typography variant="body2">{order.status}</Typography>
                    )}
                  </TableCell>
                </TableRow>
                {order.order_items && order.order_items.length > 0 && (
                  <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
                      <Box sx={{ margin: 1 }}>
                        <Typography variant="h6" gutterBottom component="div">
                          주문 상품
                        </Typography>
                        <Table size="small" aria-label="purchases">
                          <TableHead>
                            <TableRow>
                              <TableCell>상품명</TableCell>
                              <TableCell align="right">가격</TableCell>
                              <TableCell align="right">수량</TableCell>
                              <TableCell align="right">총액</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {order.order_items.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell component="th" scope="row">
                                  {item.products?.name || '알 수 없는 상품'}
                                </TableCell>
                                <TableCell align="right">{item.price_at_purchase.toLocaleString()}원</TableCell>
                                <TableCell align="right">{item.quantity}</TableCell>
                                <TableCell align="right">{(item.price_at_purchase * item.quantity).toLocaleString()}원</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
};

export default AdminPage;
