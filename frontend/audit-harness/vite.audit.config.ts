import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const harness = __dirname

export default defineConfig({
  root: path.resolve(harness, '..'),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /.*lib\/AuthContext(\.tsx)?$/, replacement: path.resolve(harness, 'auth-mock.tsx') },
      { find: /.*lib\/supabase(\.ts)?$/, replacement: path.resolve(harness, 'supabase-stub.ts') },
      { find: /^framer-motion$/, replacement: path.resolve(harness, 'framer-stub.tsx') },
    ],
  },
  server: { port: 5199, strictPort: true },
})
