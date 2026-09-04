#!/usr/bin/env node
// Watch the Atlas cluster's connection usage against the shared-tier
// ceiling (500). Connections are a CLUSTER-wide metric — this number is the
// same one the deployed Netlify functions are contending for, so it can be
// run from anywhere.
//
// Usage:
//   npm run db:connections            # one-shot snapshot
//   npm run db:connections -- --watch # poll every 5s
//   npm run db:connections -- --watch 2
import { MongoClient } from 'mongodb'

const WARN_AT = 0.7
const ALERT_AT = 0.85

const parseArgs = (argv) => {
  const watch = argv.includes('--watch')
  const raw = watch ? Number(argv[argv.indexOf('--watch') + 1]) : NaN
  const seconds = Number.isFinite(raw) && raw > 0 ? raw : 5
  return { watch, intervalMs: seconds * 1000 }
}

const getUri = () => {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not set (run via `npm run db:connections`)')
  return uri
}

// A monitor should barely register in the number it is reporting.
const connect = async (uri) => {
  const client = new MongoClient(uri, { maxPoolSize: 1, minPoolSize: 0 })
  await client.connect()
  return client
}

const readStats = async (client) => {
  const admin = client.db().admin()
  const [status, hello] = await Promise.all([
    admin.command({ serverStatus: 1 }),
    admin.command({ hello: 1 }),
  ])
  const { current, available, totalCreated } = status.connections
  return {
    node: hello.me || 'unknown',
    setName: hello.setName || '',
    current,
    available,
    totalCreated,
    ceiling: current + available,
  }
}

const level = (ratio) =>
  ratio >= ALERT_AT ? 'ALERT' : ratio >= WARN_AT ? 'WARN ' : 'ok   '

const formatLine = (s) => {
  const ratio = s.ceiling ? s.current / s.ceiling : 0
  const pct = (ratio * 100).toFixed(1).padStart(5)
  const bars = Math.round(ratio * 30)
  const bar = '#'.repeat(bars).padEnd(30, '.')
  const time = new Date().toTimeString().slice(0, 8)
  return `${time}  ${level(ratio)}  ${String(s.current).padStart(3)}/${s.ceiling}  ${pct}%  [${bar}]  created=${s.totalCreated}`
}

const run = async () => {
  const { watch, intervalMs } = parseArgs(process.argv.slice(2))
  const client = await connect(getUri())
  try {
    const first = await readStats(client)
    console.log(`cluster: ${first.setName}  node: ${first.node}`)
    console.log(`ceiling: ${first.ceiling} connections (shared Atlas tier)`)
    console.log('note: this monitor itself accounts for ~1-2 of the count\n')
    console.log(formatLine(first))
    if (!watch) return
    await new Promise((resolve) => {
      const timer = setInterval(async () => {
        try {
          console.log(formatLine(await readStats(client)))
        } catch (err) {
          console.error('read failed:', err.message)
        }
      }, intervalMs)
      const stop = () => {
        clearInterval(timer)
        resolve()
      }
      process.on('SIGINT', stop)
      process.on('SIGTERM', stop)
    })
  } finally {
    await client.close()
  }
}

run().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
