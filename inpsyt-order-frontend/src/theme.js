import { createTheme } from '@mui/material/styles';

// 모던 & 프로페셔널 테마 (토스 스타일 참고)
const theme = createTheme({
  palette: {
    primary: {
      main: '#2B398F', // 회사 대표 색상
    },
    secondary: {
      main: '#f9f9f9', // 배경색
    },
    background: {
      default: '#ffffff', // 기본 배경색
      paper: '#ffffff',   // 카드 등 종이 컴포넌트 배경색
    },
    text: {
      primary: '#333d4b', // 기본 텍스트 색상
      secondary: '#8b95a1', // 보조 텍스트 색상
    },
  },
  typography: {
    fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif',
    h4: {
      fontWeight: 700, // 제목 폰트 굵게
    },
    subtitle1: {
      fontWeight: 600,
    },
    button: {
      fontWeight: 600, // 버튼 텍스트 굵게
    },
  },
  shape: {
    borderRadius: 12, // 전역적으로 둥근 모서리 값 증가
  },
  components: {
    // 모든 Paper 컴포넌트(카드 등)에 대한 기본 스타일 재정의
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)', // 은은한 그림자 효과
          border: 'none', // 테두리 제거
        },
      },
    },
    // 모든 버튼에 대한 기본 스타일 재정의
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none', // 버튼 텍스트 대문자 변환 비활성화
          boxShadow: 'none',
        },
      },
    },
    // 원인 불명의 컨테이너 너비 제한을 강제로 해제
    MuiContainer: {
      styleOverrides: {
        maxWidthSm: {
          '&.MuiContainer-maxWidthSm': { // 클래스 이름을 명시하여 우선순위 확보
            maxWidth: 'none', 
          },
        },
      },
    },
  },
});

export default theme;