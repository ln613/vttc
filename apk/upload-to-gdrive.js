#!/usr/bin/env node
// Upload the freshly-built APK to Google Drive on the account used by
// the rest of the project (vttclive@gmail.com).
//
// Auth is done via a stored OAuth refresh token so the build is fully
// non-interactive. One-time setup is documented in apk/README.md.
//
// Required env vars (read from .env if present):
//   GDRIVE_CLIENT_ID
//   GDRIVE_CLIENT_SECRET
//   GDRIVE_REFRESH_TOKEN
//   GDRIVE_FOLDER_ID  -- id of the destination folder in vttclive@'s Drive
//
// Optional:
//   GDRIVE_APK_PATH   -- override the APK location
//
// If any required var is missing the script logs a friendly notice and
// exits 0 so the apk:build pipeline doesn't fail for devs who haven't
// set up the upload locally.

import { readFileSync, statSync, existsSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Minimal inline .env loader (no extra dep).
const loadDotEnv = () => {
  const envPath = resolve(__dirname, '..', '.env')
  if (!existsSync(envPath)) return
  const text = readFileSync(envPath, 'utf-8')
  for (const raw of text.split('\n')) {
    const line = raw.split('#')[0].trim()
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/i)
    if (!m) continue
    const key = m[1]
    if (process.env[key]) continue
    let value = m[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

loadDotEnv()

const required = {
  GDRIVE_CLIENT_ID: process.env.GDRIVE_CLIENT_ID,
  GDRIVE_CLIENT_SECRET: process.env.GDRIVE_CLIENT_SECRET,
  GDRIVE_REFRESH_TOKEN: process.env.GDRIVE_REFRESH_TOKEN,
  GDRIVE_FOLDER_ID: process.env.GDRIVE_FOLDER_ID,
}

const missing = Object.entries(required)
  .filter(([, v]) => !v)
  .map(([k]) => k)

if (missing.length > 0) {
  console.log(
    `[gdrive] Skipping upload — missing env: ${missing.join(', ')}`,
  )
  console.log(
    '[gdrive] See apk/README.md → "Upload built APK to Google Drive" for one-time setup.',
  )
  process.exit(0)
}

const apkPath =
  process.env.GDRIVE_APK_PATH ||
  resolve(
    __dirname,
    'platforms/android/app/build/outputs/apk/debug/app-debug.apk',
  )

if (!existsSync(apkPath)) {
  console.error(`[gdrive] APK not found at ${apkPath}`)
  process.exit(1)
}

const fetchAccessToken = async () => {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: required.GDRIVE_CLIENT_ID,
      client_secret: required.GDRIVE_CLIENT_SECRET,
      refresh_token: required.GDRIVE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    throw new Error(`OAuth refresh failed (${res.status}): ${await res.text()}`)
  }
  const json = await res.json()
  return json.access_token
}

const uploadApk = async (accessToken) => {
  const body = readFileSync(apkPath)
  const size = statSync(apkPath).size
  const metadata = {
    name: basename(apkPath),
    parents: [required.GDRIVE_FOLDER_ID],
  }

  // Resumable session start.
  const init = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'application/vnd.android.package-archive',
        'X-Upload-Content-Length': String(size),
      },
      body: JSON.stringify(metadata),
    },
  )
  if (!init.ok) {
    throw new Error(
      `Drive session init failed (${init.status}): ${await init.text()}`,
    )
  }
  const sessionUrl = init.headers.get('location')
  if (!sessionUrl) throw new Error('No upload session URL returned by Drive')

  const put = await fetch(sessionUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': String(size),
    },
    body,
  })
  if (!put.ok) {
    throw new Error(
      `Drive upload failed (${put.status}): ${await put.text()}`,
    )
  }
  return put.json()
}

console.log(`[gdrive] uploading ${apkPath}`)
const accessToken = await fetchAccessToken()
const result = await uploadApk(accessToken)
console.log(`[gdrive] uploaded: ${result.name} (id=${result.id})`)
