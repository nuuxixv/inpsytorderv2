import { useEffect, useState } from 'react';

// 값 변경을 delay(ms) 만큼 지연시켜 반환. 검색 입력처럼 매 키입력마다 무거운 재계산을
// 트리거하는 것을 막는다(입력은 즉시 반영, 필터·검색만 지연 반응).
export function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
