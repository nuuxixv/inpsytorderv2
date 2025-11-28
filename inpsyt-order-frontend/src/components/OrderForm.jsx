import React, { useState } from 'react';
import DaumPostcode from 'react-daum-postcode';
import {
  Typography,
  TextField,
  Modal,
  Box,
  Card,
  Grid,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Home as HomeIcon,
  Search as SearchIcon,
  Badge as BadgeIcon,
  Note as NoteIcon
} from '@mui/icons-material';

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '90%',
  maxWidth: 400,
  bgcolor: 'background.paper',
  boxShadow: 24,
  borderRadius: 2,
  overflow: 'hidden'
};

const OrderForm = ({ customerInfo, setCustomerInfo }) => {
  const [isPostcodeModalOpen, setIsPostcodeModalOpen] = useState(false);

  const handleOpenPostcode = () => setIsPostcodeModalOpen(true);
  const handleClosePostcode = () => setIsPostcodeModalOpen(false);

  const handleCompletePostcode = (data) => {
    let fullAddress = data.address;
    let extraAddress = '';

    if (data.addressType === 'R') {
      if (data.bname !== '') extraAddress += data.bname;
      if (data.buildingName !== '') extraAddress += (extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName);
      fullAddress += (extraAddress !== '' ? ` (${extraAddress})` : '');
    }

    setCustomerInfo(prevState => ({
      ...prevState,
      postcode: data.zonecode,
      address: fullAddress,
    }));
    handleClosePostcode();
  };

  const handlePhoneChange = (e) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, '');
    let formattedValue = rawValue;
    if (rawValue.length > 3 && rawValue.length <= 7) {
      formattedValue = `${rawValue.slice(0, 3)}-${rawValue.slice(3)}`;
    } else if (rawValue.length > 7) {
      formattedValue = `${rawValue.slice(0, 3)}-${rawValue.slice(3, 7)}-${rawValue.slice(7, 11)}`;
    }
    setCustomerInfo(prevState => ({ ...prevState, phone: formattedValue }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCustomerInfo(prevState => ({ ...prevState, [name]: value }));
  };

  return (
    <Card sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
        주문자 정보
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6}>
          <TextField
            required
            fullWidth
            id="name"
            name="name"
            label="성함"
            value={customerInfo.name}
            onChange={handleChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            required
            fullWidth
            id="phone"
            name="phone"
            label="연락처"
            value={customerInfo.phone}
            onChange={handlePhoneChange}
            inputProps={{ maxLength: 13 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PhoneIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            required
            fullWidth
            id="email"
            name="email"
            label="이메일"
            type="email"
            value={customerInfo.email}
            onChange={handleChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            id="address"
            name="address"
            label="주소 검색"
            value={customerInfo.address}
            onClick={handleOpenPostcode}
            InputProps={{
              readOnly: true,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="primary" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <Typography variant="caption" color="primary" sx={{ fontWeight: 'bold', cursor: 'pointer' }}>
                    검색하기
                  </Typography>
                </InputAdornment>
              )
            }}
            sx={{ cursor: 'pointer', '& .MuiInputBase-root': { cursor: 'pointer' } }}
          />
        </Grid>
        <Grid item xs={12} sm={8}>
          <TextField
            fullWidth
            id="detailAddress"
            name="detailAddress"
            label="상세주소"
            value={customerInfo.detailAddress}
            onChange={handleChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <HomeIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            id="postcode"
            name="postcode"
            label="우편번호"
            value={customerInfo.postcode}
            InputProps={{
              readOnly: true,
            }}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            id="inpsytId"
            name="inpsytId"
            label="인싸이트 ID (온라인코드 구매 시 필수)"
            value={customerInfo.inpsytId}
            onChange={handleChange}
            placeholder="인싸이트 홈페이지 ID를 입력해주세요"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <BadgeIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            multiline
            rows={3}
            id="request"
            name="request"
            label="요청사항"
            value={customerInfo.request}
            onChange={handleChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
                  <NoteIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
      </Grid>

      <Modal open={isPostcodeModalOpen} onClose={handleClosePostcode}>
        <Box sx={modalStyle}>
          <DaumPostcode onComplete={handleCompletePostcode} style={{ height: '50vh' }} />
        </Box>
      </Modal>
    </Card>
  );
};

export default OrderForm;