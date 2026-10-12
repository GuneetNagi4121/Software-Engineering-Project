import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The frontend talks to the API at "/api". In development, Vite proxies that
// to the Express server so there are no CORS concerns. Override the target
// with VITE_API_PROXY if your backend runs elsewhere.
const API_PROXY = process.env.VITE_API_PROXY || 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Keep the heavy map and chart libraries out of the main bundle so
        // the pages that do not use them are not penalised.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          map: ['leaflet', 'react-leaflet'],
          charts: ['recharts'],
        },
      },
    },
  },
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: API_PROXY,
        changeOrigin: true,
      },
    },
  },
});
