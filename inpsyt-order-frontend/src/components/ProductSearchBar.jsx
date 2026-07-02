import React, { useState, useEffect, useRef } from 'react';
import { TextField, InputAdornment } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

// 검색 입력을 로컬 상태로 격리해 타이핑 렉을 없앤다.
// input 값은 이 컴포넌트 안에서만 갱신되고, debounce된 값만 onSearch로 상위에 올린다.
// → IME 조합·매 키입력이 상위 트리(검사군 뷰) 리렌더를 유발하지 않음(입력은 input만, 트리는 debounce 후 1회).
// resetKey: 상위에서 값을 바꾸면 로컬 input을 빈 문자열로 초기화(필터 초기화 경로 등).
const ProductSearchBar = ({
  onSearch,
  delay = 250,
  label,
  placeholder = '상품명으로 검색 (띄어쓰기로 여러 키워드)',
  size,
  sx = { mb: 2 },
  resetKey = 0,
}) => {
  const [value, setValue] = useState('');
  const debounced = useDebouncedValue(value, delay);

  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  useEffect(() => {
    onSearchRef.current(debounced);
  }, [debounced]);

  // 상위 리셋 신호(resetKey 변경) 시 로컬 input 비우기 → debounce 통해 onSearch('') 전달.
  useEffect(() => {
    if (resetKey === 0) return;
    setValue('');
  }, [resetKey]);

  return (
    <TextField
      fullWidth={size ? undefined : true}
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      size={size}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon sx={{ color: 'text.disabled' }} />
          </InputAdornment>
        ),
      }}
      sx={sx}
    />
  );
};

export default ProductSearchBar;
