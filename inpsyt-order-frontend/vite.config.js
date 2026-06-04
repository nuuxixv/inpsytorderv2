import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          mui: ['@mui/material', '@mui/icons-material'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    // 파일별 fork 격리(기본) — vi.mock이 파일 간 오염되지 않게. EMFILE은 아래 아이콘
    // 스텁으로 해결되므로 singleFork 불필요.
    pool: 'forks',
    // Windows EMFILE 방지: '@mui/icons-material' 배럴 import가 아이콘 1만여 파일을
    // 한꺼번에 열어 'too many open files' 발생 → 배럴만 더미 스텁으로 치환.
    // 정규식 $ 로 배럴만 매칭(deep import '@mui/icons-material/X'는 실파일 유지).
    alias: [
      {
        find: /^@mui\/icons-material$/,
        replacement: fileURLToPath(new URL('./src/test/muiIconsStub.cjs', import.meta.url)),
      },
    ],
    server: {
      deps: {
        inline: [/@mui\/material/],
      },
    },
  },
})