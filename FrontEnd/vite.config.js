import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ["all"],
    headers: {
      // chu y: header nay de google identity chap nhan http localhost
      "Referrer-Policy": "no-referrer-when-downgrade",
    },
  },
});
