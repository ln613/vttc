#!/usr/bin/env node
// Run a command with one club's environment loaded.
//
//   node scripts/with-club.mjs netlify dev
//   node scripts/with-club.mjs --club othertc vite build
//
// Layering, later winning:
//   1. .env            shared across clubs, and where CLUB is set
//   2. .env.<club>     that club's secrets (database, Pusher, mail, …)
//   3. the real environment / --club, so CI and Netlify can override
//
// `.env.<club>` is optional: with only a `.env` this behaves exactly as
// before, which is what keeps a single-club checkout working untouched.

import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const parseEnvFile = (path) => {
  if (!existsSync(path)) return {}
  const out = {}
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    // Strip one layer of matching quotes, keeping any inside the string.
    if (value.length >= 2 && /^(".*"|'.*')$/s.test(value)) value = value.slice(1, -1)
    out[key] = value
  }
  return out
}

const argv = process.argv.slice(2)
let club = process.env.CLUB
const flag = argv.indexOf('--club')
if (flag !== -1) {
  club = argv[flag + 1]
  argv.splice(flag, 2)
}

const shared = parseEnvFile('.env')
club = club || shared.CLUB || 'vttc'

if (!existsSync(`clubs/${club}/config.json`)) {
  console.error(
    `No clubs/${club}/config.json — check CLUB in .env, or pass --club <slug>.`,
  )
  process.exit(1)
}

// The real environment already wins over .env, so only fill what's missing.
const layered = { ...shared, ...parseEnvFile(`.env.${club}`) }
for (const [key, value] of Object.entries(layered)) {
  if (process.env[key] === undefined) process.env[key] = value
}
process.env.CLUB = club

if (!argv.length) {
  console.error('Nothing to run. Usage: with-club.mjs [--club <slug>] <command> [args…]')
  process.exit(1)
}

// Keep the CLI, vite and the browser on the same ports. VITE_DEV_API_PORT
// is what src/utils/api.ts calls in dev and VITE_DEV_PORT is what
// vite.config.ts listens on, so forwarding both here is what stops them
// drifting from netlify.toml. Only needed to run two clubs at once.
const apiPort = process.env.VITE_DEV_API_PORT
const vitePort = process.env.VITE_DEV_PORT
const isNetlifyDev = argv[0] === 'netlify' && argv[1] === 'dev'
if (isNetlifyDev) {
  if (apiPort && !argv.includes('--port')) argv.push('--port', apiPort)
  if (vitePort && !argv.includes('--targetPort')) argv.push('--targetPort', vitePort)
}

console.log(
  `club: ${club}` +
    (isNetlifyDev ? `  (api ${apiPort || 7004}, vite ${vitePort || 7344})` : ''),
)
const child = spawn(argv[0], argv.slice(1), { stdio: 'inherit', env: process.env })
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)))
