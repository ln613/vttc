import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

// One club per build. `import clubConfig from 'club-config'` resolves to
// that club's JSON, which Vite inlines — so the browser gets the config
// with no request, and the server reads the very same file through
// netlify/functions/utils/club.js.
const CLUB = process.env.CLUB || 'vttc'
const clubConfigPath = fileURLToPath(
  new URL(`./clubs/${CLUB}/config.json`, import.meta.url),
)
const clubConfig = JSON.parse(readFileSync(clubConfigPath, 'utf8'))

// index.html is static, so the club's title and favicon are substituted at
// build time rather than being set from script after first paint.
const clubHtmlPlugin = {
  name: 'club-html',
  transformIndexHtml: (html: string) =>
    html
      .replace('%CLUB_TITLE%', clubConfig.branding?.pageTitle ?? clubConfig.name)
      .replace('%CLUB_FAVICON%', clubConfig.branding?.faviconUrl ?? '/images/logo.png'),
}

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths so the bundle works when loaded from
  // file:// (Cordova/APK) as well as from a real origin.
  base: './',
  plugins: [solid(), clubHtmlPlugin],
  resolve: {
    alias: { 'club-config': clubConfigPath },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  optimizeDeps: {
    include: ['pusher-js'],
  },
})
