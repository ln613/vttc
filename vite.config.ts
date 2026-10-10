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
// The club's public website, if it has one: content in each language and its
// images (clubs/<slug>/site). Only this club's files are bundled.
const clubSitePath = fileURLToPath(new URL(`./clubs/${CLUB}/site`, import.meta.url))

// index.html is static, so the club's title and favicon are substituted at
// build time rather than being set from script after first paint.
const clubHtmlPlugin = {
  name: 'club-html',
  transformIndexHtml: (html: string) =>
    html
      .replace('%CLUB_TITLE%', clubConfig.branding?.pageTitle ?? clubConfig.name)
      .replace('%CLUB_FAVICON%', clubConfig.branding?.faviconUrl ?? '/images/logo.png'),
}

// Where netlify dev serves the functions — the same default and override
// as src/utils/api.ts.
const devApiPort = process.env.VITE_DEV_API_PORT || '7004'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths so the bundle works when loaded from
  // file:// (Cordova/APK) as well as from a real origin.
  base: './',
  plugins: [solid(), clubHtmlPlugin],
  resolve: {
    alias: { 'club-config': clubConfigPath, 'club-site': clubSitePath },
  },
  server: {
    host: true,
    // netlify dev proxies to this (its targetPort). Overridable so a second
    // club can run alongside the first — scripts/with-club.mjs forwards the
    // same value to the CLI so the two can't drift.
    port: Number(process.env.VITE_DEV_PORT) || 7344,
    strictPort: true,
    // Reached from outside through an ngrok tunnel to this port: accept its
    // hostnames, and forward the API calls (made same-origin there, see
    // src/utils/api.ts) to the functions. Going through netlify dev's own
    // port doesn't work in dev — the /* rewrite in public/_redirects also
    // catches Vite's module requests.
    allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.io'],
    proxy: {
      '/.netlify/functions': `http://localhost:${devApiPort}`,
    },
  },
  optimizeDeps: {
    include: ['pusher-js'],
  },
})
