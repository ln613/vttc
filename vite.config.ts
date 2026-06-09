import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths so the bundle works when loaded from
  // file:// (Cordova/APK) as well as from a real origin.
  base: './',
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
