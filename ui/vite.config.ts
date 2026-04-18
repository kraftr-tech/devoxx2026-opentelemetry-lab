import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      allowedHosts: true,
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api/products': {
          target: process.env.PRODUCTS_SERVICE_URL || 'http://products-service:8002',
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/api/users': {
          target: process.env.USERS_SERVICE_URL || 'http://users-service:8001',
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/api/payments': {
          target: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:8003',
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/api/billing': {
          target: process.env.BILLING_SERVICE_URL || 'http://billing-service:8004',
          rewrite: (path) => path.replace(/^\/api\/billing/, ''),
        },
      },
    },
  };
});
