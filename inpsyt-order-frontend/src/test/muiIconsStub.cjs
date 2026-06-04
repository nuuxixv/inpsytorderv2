// 테스트 전용 스텁 — @mui/icons-material 배럴 import('from "@mui/icons-material"')이
// 아이콘 1만여개 파일을 한꺼번에 열어 Windows EMFILE("too many open files")을 유발.
// vite.config의 test.alias가 배럴(정확히 '@mui/icons-material')만 이 스텁으로 치환한다.
// (deep import 'from "@mui/icons-material/Search"' 등은 실제 파일 그대로 — 1파일씩이라 무해)
// 모든 아이콘 이름에 대해 더미 컴포넌트를 반환하므로 컴포넌트 렌더 테스트엔 영향 없음.
const React = require('react');

const StubIcon = React.forwardRef(function StubIcon(props, ref) {
  return React.createElement('span', { ref, 'data-mui-icon-stub': true, ...props });
});

// 명명 import(예: import { DownloadIcon } from '@mui/icons-material')를 위해
// 어떤 속성 접근이든 StubIcon을 반환하는 Proxy. CJS interop으로 명명/기본 import 모두 동작.
module.exports = new Proxy(
  { __esModule: true, default: StubIcon },
  { get: (target, prop) => (prop in target ? target[prop] : StubIcon) }
);
