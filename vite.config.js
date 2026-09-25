import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    host: '127.0.0.1',
    proxy: {
      '/relcon-api': {
        target: 'http://192.168.0.188',
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/relcon-api/, ''),
      },
    },
    port: 5173,
    watch: {
      usePolling: true,
      interval: 300,
      ignored: [
        '**/AppData/**',
        '**/Code/Network/**',
        '**/Cookies'
      ]
    }
  }
})