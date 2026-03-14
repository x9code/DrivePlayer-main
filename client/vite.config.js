import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime - cached very aggressively
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Animation library (large, rarely changes)
          'framer-motion': ['framer-motion'],
          // Icon library (large, rarely changes)
          'react-icons': ['react-icons'],
          // HTTP client
          'axios': ['axios'],
        }
      }
    },
    // Warn if any single chunk exceeds 800KB
    chunkSizeWarningLimit: 800,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
    host: true, // Expose to network
    allowedHosts: true, // Allow tunneling (ngrok/localtunnel)
  },
})

