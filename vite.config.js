import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173, // 固定前端在 5173
    proxy: {
      // 把前端呼叫的 API 與圖檔，全部轉發給後端
      '/api': 'http://localhost:3000',
      '/data': 'http://localhost:3000',
      '/DRAWING': 'http://localhost:3000'
    }
  }
})