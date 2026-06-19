#!/usr/bin/env node
// Copy the freshly-built web bundle (../dist) into ./www so Cordova
// packages the current app. Run after `vite build`.
//
// Usage:
//   node ios/sync.js

import { rmSync, cpSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = resolve(__dirname, '..', 'dist')
const wwwDir = resolve(__dirname, 'www')

if (!existsSync(distDir)) {
  console.error(
    '[ios/sync] ../dist does not exist — run `npm run build` first.',
  )
  process.exit(1)
}

console.log(`[ios/sync] clearing ${wwwDir}`)
rmSync(wwwDir, { recursive: true, force: true })

console.log(`[ios/sync] copying ${distDir} → ${wwwDir}`)
cpSync(distDir, wwwDir, { recursive: true })

console.log('[ios/sync] done.')
