#!/usr/bin/env node
// Copy the freshly-built APK into ../public/docs/vttc-live.apk so it
// gets served by the deployed site (e.g. as a download link). Run as
// part of the apk:build post-script chain.

import { existsSync, mkdirSync, copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const sourceApk =
  process.env.GDRIVE_APK_PATH ||
  resolve(
    __dirname,
    'platforms/android/app/build/outputs/apk/debug/app-debug.apk',
  )

const destDir = resolve(__dirname, '..', 'public', 'docs')
const destApk = resolve(destDir, 'vttc-live.apk')

if (!existsSync(sourceApk)) {
  console.error(`[apk/public] APK not found at ${sourceApk}`)
  process.exit(1)
}

mkdirSync(destDir, { recursive: true })
copyFileSync(sourceApk, destApk)
console.log(`[apk/public] copied → ${destApk}`)
