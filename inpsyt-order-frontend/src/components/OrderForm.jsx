import React, { useState } from 'react';
import DaumPostcode from 'react-daum-postcode';
import {
  Typography,
  TextField,
  Modal,
  Box,
  Card,
  Stack
} from '@mui/material';

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '90%',
  maxWidth: 400,
  bgcolor: 'background.paper',
  boxShadow: 24,
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
    <Card>
      <Typography variant="h5" gutterBottom>주문자 정보</Typography>
      <Stack spacing={2}>
        <TextField required id="name" name="name" label="성함" value={customerInfo.name} onChange={handleChange} />
        <TextField required id="email" name="email" label="이메일" type="email" value={customerInfo.email} onChange={handleChange} />
        <TextField required id="phone" name="phone" label="연락처" value={customerInfo.phone} onChange={handlePhoneChange} inputProps={{ maxLength: 13 }} />
        <TextField 
          id="address" 
          name="address" 
          label="주소 (클릭하여 검색)" 
          value={customerInfo.address} 
          onClick={handleOpenPostcode}
          InputProps={{ readOnly: true }}
          sx={{ cursor: 'pointer' }}
        />
        <TextField id="detailAddress" name="detailAddress" label="상세주소" value={customerInfo.detailAddress} onChange={handleChange} />
        <TextField id="inpsytId" name="inpsytId" label="인싸이트 ID (온라인코드 구매 시)" value={customerInfo.inpsytId} onChange={handleChange} />
        <TextField multiline rows={3} id="request" name="request" label="요청사항" value={customerInfo.request} onChange={handleChange} />
      </Stack>

      <Modal open={isPostcodeModalOpen} onClose={handleClosePostcode}>
        <Box sx={modalStyle}>
          <DaumPostcode onComplete={handleCompletePostcode} style={{ height: '50vh' }} />
        </Box>
      </Modal>
    </Card>
  );
};

export default OrderForm;