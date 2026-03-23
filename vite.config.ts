import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],

  server: {
    // Enables HTTPS in local dev so camera permission works on non-localhost origins.
    // Run: npx vite --https  OR set VITE_HTTPS=true
    // Leave undefined for plain localhost (already a secure context).
    https: process.env.VITE_HTTPS === 'true' ? {} : undefined,

    // Allow camera permission on the local network IP (e.g. testing on phone)
    host: true,
  },
})
