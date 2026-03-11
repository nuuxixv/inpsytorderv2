import React, { useState, useMemo } from 'react';
import DaumPostcode from 'react-daum-postcode';
import {
  Typography,
  TextField,
  Modal,
  Box,
  InputAdornment,
  Stack,
  Button,
  Divider,
  Autocomplete,
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Home as HomeIcon,
  Search as SearchIcon,
  Badge as BadgeIcon,
  Note as NoteIcon,
} from '@mui/icons-material';

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '92%',
  maxWidth: 420,
  bgcolor: 'background.paper',
  boxShadow: 24,
  borderRadius: '16px',
  overflow: 'hidden',
};

const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    minHeight: 52,
    bgcolor: '#F8F9FA',
    fontSize: '16px',
  },
};

const EMAIL_DOMAINS = [
  '@naver.com',
  '@gmail.com',
  '@daum.net',
  '@hanmail.net',
  '@kakao.com',
  '@nate.com',
];

const CustomerInfoStep = ({ customerInfo, setCustomerInfo, hasOnlineCode = false, isOnsitePurchase = false }) => {
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

  // Email autocomplete suggestions
  const emailSuggestions = useMemo(() => {
    const email = customerInfo.email || '';
    if (!email || email.includes('@')) return [];
    return EMAIL_DOMAINS.map(domain => `${email}${domain}`);
  }, [customerInfo.email]);

  const handleEmailChange = (event, newValue) => {
    // newValue comes from Autocomplete selection
    if (typeof newValue === 'string') {
      setCustomerInfo(prevState => ({ ...prevState, email: newValue }));
    }
  };

  const handleEmailInputChange = (event, newInputValue) => {
    setCustomerInfo(prevState => ({ ...prevState, email: newInputValue }));
  };

  return (
    <Box sx={{ px: 2, pb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 3, pt: 2 }}>
        <Typography variant="h3" sx={{ fontWeight: 800, mb: 0.5 }}>
          주문자 정보를 입력해주세요
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {isOnsitePurchase ? '주문자 확인을 위한 정보입니다' : '배송에 필요한 정보입니다'}
        </Typography>
      </Box>

      {/* Required section */}
      <Typography
        variant="overline"
        sx={{ color: 'text.secondary', fontWeight: 700, mb: 1.5, display: 'block' }}
      >
        필수 정보
      </Typography>
      <Stack spacing={2} sx={{ mb: 3 }}>
        <TextField
          required
          fullWidth
          name="name"
          label="성함"
          value={customerInfo.name}
          onChange={handleChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PersonIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
          sx={inputSx}
        />
        <TextField
          required
          fullWidth
          name="phone"
          label="연락처"
          placeholder="010-1234-5678"
          value={customerInfo.phone}
          onChange={handlePhoneChange}
          inputProps={{ maxLength: 13 }}
          helperText="숫자만 입력해주세요."
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PhoneIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
          sx={inputSx}
        />
        <Autocomplete
          freeSolo
          options={emailSuggestions}
          value={customerInfo.email}
          onChange={handleEmailChange}
          onInputChange={handleEmailInputChange}
          disableClearable
          renderInput={(params) => (
            <TextField
              {...params}
              required
              fullWidth
              name="email"
              label="이메일"
              type="email"
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={inputSx}
            />
          )}
          sx={{
            '& .MuiAutocomplete-listbox': {
              fontSize: '14px',
            },
          }}
        />
      </Stack>

      {!isOnsitePurchase && (
        <>
          <Divider sx={{ my: 3 }} />

          {/* Shipping section */}
          <Typography
            variant="overline"
            sx={{ color: 'text.secondary', fontWeight: 700, mb: 1.5, display: 'block' }}
          >
            배송지 정보
          </Typography>
          <Stack spacing={2} sx={{ mb: 3 }}>
            <TextField
              fullWidth
              name="address"
              label="주소 검색"
              value={customerInfo.address}
              onClick={handleOpenPostcode}
              InputProps={{
                readOnly: true,
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleOpenPostcode}
                      sx={{
                        minWidth: 'auto',
                        px: 1.5,
                        py: 0.5,
                        fontSize: '0.75rem',
                        borderRadius: '8px',
                      }}
                    >
                      검색
                    </Button>
                  </InputAdornment>
                ),
              }}
              sx={{
                ...inputSx,
                cursor: 'pointer',
                '& .MuiInputBase-root': { cursor: 'pointer' },
              }}
            />
            <TextField
              fullWidth
              name="detailAddress"
              label="상세주소"
              value={customerInfo.detailAddress}
              onChange={handleChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <HomeIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={inputSx}
            />
            <TextField
              fullWidth
              name="postcode"
              label="우편번호"
              value={customerInfo.postcode}
              InputProps={{ readOnly: true }}
              sx={inputSx}
            />
          </Stack>
        </>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Optional section */}
      <Typography
        variant="overline"
        sx={{ color: 'text.secondary', fontWeight: 700, mb: 1.5, display: 'block' }}
      >
        선택사항
      </Typography>
      <Stack spacing={2}>
        {hasOnlineCode && (
          <TextField
            fullWidth
            name="inpsytId"
            label="인싸이트 ID (온라인코드 구매 시 필수)"
            value={customerInfo.inpsytId}
            onChange={handleChange}
            placeholder="인싸이트 홈페이지 ID를 입력해주세요"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <BadgeIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
            sx={inputSx}
          />
        )}
        <TextField
          fullWidth
          multiline
          rows={3}
          name="request"
          label="요청하실 내용"
          value={customerInfo.request}
          onChange={handleChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
                <NoteIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '12px',
              bgcolor: '#F8F9FA',
              fontSize: '16px',
            },
          }}
        />
      </Stack>

      {/* Postcode modal */}
      <Modal open={isPostcodeModalOpen} onClose={handleClosePostcode}>
        <Box sx={modalStyle}>
          <DaumPostcode onComplete={handleCompletePostcode} style={{ height: '60vh' }} />
        </Box>
      </Modal>
    </Box>
  );
};

export default CustomerInfoStep;
