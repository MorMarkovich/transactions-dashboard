import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  appType: 'spa',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Keep React's JSX runtime with the renderer. A library chunk
          // must not pull in shared runtime modules required by public pages.
          if (/\/node_modules\/(?:react|react-dom|react-router(?:-dom)?|scheduler)\//.test(id)) return 'vendor'
          if (/\/node_modules\/(?:framer-motion|motion-dom|motion-utils)\//.test(id)) return 'motion'
          if (/\/node_modules\/recharts\//.test(id)) return 'charts'
          if (id.includes('/node_modules/@supabase/')) return 'supabase'
          if (id.includes('/node_modules/lucide-react/')) return 'icons'
        },
      },
    },
  },
})
