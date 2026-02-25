import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/annotation_webapp_system_TMFE/',
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
