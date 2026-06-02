import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-esbuild': ['esbuild-wasm'],
        },
      },
    },
    sourcemap: false,
    minify: 'esbuild',
    cssMinify: 'esbuild',
  },
})
