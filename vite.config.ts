import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 10000,
      rollupOptions: {
        input: path.resolve(__dirname, 'index.html'),
      },
    },
    resolve: {
      dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
      alias: {
        '@': path.resolve(__dirname, 'artifacts/pos-system/src'),
        '@workspace/api-client-react': path.resolve(__dirname, 'artifacts/pos-system/src/lib/api-client-react.tsx'),
      },
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
      ],
    },
    server: {
      hmr: false,
      ws: false,
      watch: null,
    },
  };
});
