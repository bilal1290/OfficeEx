import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Absolute base so deep routes (e.g. /chat) load assets correctly on Vercel.
  // Capacitor uses HashRouter, so this remains compatible with native builds.
  base: '/',
})
