import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The frontend talks to the API at "/api". In development, Vite proxies that
// to the Express server so there are no CORS concerns. Override the target
// with VITE_API_PROXY if your backend runs elsewhere.
const API_PROXY = process.env.VITE_API_PROXY || 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
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
