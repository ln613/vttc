import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

// https://vite.dev/config/
export default defineConfig({
  plugins: [solid()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  optimizeDeps: {
    include: ['pusher-js'],
  },
})
