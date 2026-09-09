#!/usr/bin/env node
// Strip everything from the player snapshots embedded in event documents
// except the fields the app actually reads (see embeddedPlayers.js).
//
// Events embed a copy of each player in participants, match sides, group
// standings, knockout seeding and team order-of-play. Those copies were of
// the whole player document, so events carried password hashes, emails,
// phone numbers and rating histories — and served them to anyone who
// called type=events.
//
//   node --env-file=.env scripts/trim-embedded-players.mjs --db vttc-dev
//   node --env-file=.env scripts/trim-embedded-players.mjs --db vttc --apply
//
// Dry run unless --apply is given.

import { MongoClient } from 'mongodb'
import { sanitizeForStorage } from '../netlify/functions/utils/embeddedPlayers.js'

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? dflt : process.argv[i + 1]
}
const dbName = arg('db')
const apply = process.argv.includes('--apply')

if (!dbName) {
  console.error('Which database? --db vttc-dev | --db vttc')
  process.exit(1)
}

const STRIPPED = ['password', 'email', 'phone', 'ratingHistory', 'isSuperAdmin']
const bytes = (v) => JSON.stringify(v ?? null).length
const kb = (n) => `${(n / 1024).toFixed(0)} KB`

const client = new MongoClient(process.env.MONGODB_URI)
await client.connect()
const events = client.db(dbName).collection('events')

const all = await events.find({}).toArray()
let before = 0
let after = 0
let changed = 0
const found = new Set()
const writes = []

for (const event of all) {
  const trimmed = {
    participants: sanitizeForStorage(event.participants),
    eventStages: sanitizeForStorage(event.eventStages),
  }
  const wasSize = bytes(event.participants) + bytes(event.eventStages)
  const isSize = bytes(trimmed.participants) + bytes(trimmed.eventStages)
  before += wasSize
  after += isSize
  if (wasSize === isSize) continue

  changed++
  const raw = JSON.stringify({ p: event.participants, s: event.eventStages })
  for (const field of STRIPPED) if (raw.includes(`"${field}":`)) found.add(field)
  writes.push({
    updateOne: { filter: { _id: event._id }, update: { $set: trimmed } },
  })
}

console.log(`${dbName}: ${all.length} events, ${changed} carrying extra player fields`)
console.log(`  embedded size: ${kb(before)} -> ${kb(after)}  (${
  before ? (((before - after) / before) * 100).toFixed(0) : 0
}% smaller)`)
console.log(`  fields removed: ${[...found].join(', ') || 'none'}`)

if (!writes.length) {
  console.log('\nNothing to do.')
} else if (!apply) {
  console.log(`\nDry run. Re-run with --apply to write ${writes.length} events.`)
} else {
  const result = await events.bulkWrite(writes)
  console.log(`\napplied: ${result.modifiedCount} events updated`)
  // Prove it, rather than trusting the write.
  const recheck = await events.find({}).toArray()
  const still = STRIPPED.filter((f) =>
    recheck.some((e) =>
      JSON.stringify({ p: e.participants, s: e.eventStages }).includes(`"${f}":`),
    ),
  )
  console.log(
    still.length
      ? `  STILL PRESENT: ${still.join(', ')}`
      : '  verified: no stripped field remains in any event document',
  )
}

await client.close()
process.exit(0)
