import React, { useState } from 'react';
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
  useTheme,
} from '@mui/material';
import {
  Person as PersonIcon,
  Phone as PhoneIcon,
  Home as HomeIcon,
  Search as SearchIcon,
  Badge as BadgeIcon,
  Note as NoteIcon,
} from '@mui/icons-material';

// 사양 §Step 1 — 주문자 정보. 주소 3필드 분리 절대 유지.

const CustomerInfoStep = ({ customerInfo, setCustomerInfo, hasOnlineCode = false, isOnsitePurchase = false, eventName = '', discountRate = 0 }) => {
  const theme = useTheme();
  const [isPostcodeModalOpen, setIsPostcodeModalOpen] = useState(false);

  // 모달 스타일·인풋 스타일을 테마 토큰으로 정합화.
  const modalStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '92%',
    maxWidth: 420,
    bgcolor: 'background.paper',
    boxShadow: theme.customShadows.lg,
    borderRadius: `${theme.radii.lg}px`,
    overflow: 'hidden',
  };

  // 인풋 셸은 theme.MuiTextField 글로벌 토큰을 그대로 받고,
  // 폼 자체 높이만 52(터치 영역)로 끌어올린다. 인라인 fontSize 금지(02 §타이포 약속 1).
  const inputSx = {
    '& .MuiOutlinedInput-root': { minHeight: 52 },
  };

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
    <Box sx={{ px: 2, pb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 3, pt: 2, textAlign: 'center' }}>
        <Typography variant="h3" sx={{ fontWeight: 800, mb: 0.5 }}>
          {isOnsitePurchase ? '주문자 정보를 입력해주세요' : '배송 받으실 주소를 입력해주세요'}
        </Typography>
        {eventName && (
          <Typography variant="body2" color="text.secondary">
            {eventName}
            {discountRate > 0 && ` · ${(discountRate * 100).toFixed(0)}% 할인 적용`}
          </Typography>
        )}
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
              required
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
                      sx={{ minWidth: 'auto', px: 1.5, py: 0.5 }}
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
              required
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
            {/* 우편번호 — 칸은 히든(Daum 검색이 자동 저장, 출고 정보엔 그대로 포함). 건우님 2026-06-01 */}
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
