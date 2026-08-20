import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// base: GitHub Pages 프로젝트 사이트는 /<저장소명>/ 하위 경로로 서빙됨
export default defineConfig({
  base: '/testgame/',
  plugins: [react()],
})
