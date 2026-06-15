import path from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// HomeOps web (plan §3.12). Served same-origin behind the reverse proxy at
// homeops.localhost, so the API base is the relative `/api` — no CORS, no Vite proxy.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['homeops.localhost'],
    hmr: {
      clientPort: 443,
      protocol: 'wss',
      host: 'homeops.localhost',
    },
  },
});
