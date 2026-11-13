#!/usr/bin/env node
// Import the USA Table Tennis rating list into a club's players collection,
// and keep it current.
//
//   npm run ratings:usatt -- --club spttc
//   npm run ratings:usatt -- --club spttc --dry-run        report, write nothing
//   npm run ratings:usatt -- --club spttc --out usatt.json also save the rows
//
// Safe to re-run: players are matched on their USATT member number and only
// the fields that come from USATT are written, so a club's own additions
// (email, phone, account, host) survive every sync.
//
// ratings.usatt.org is a JustGo widget; its list comes from JustGo's REST API,
// which wants the tenant id the widget sends (USATT_TENANT_ID in .env) and
// the widget's origin. The same list as the site's "rankings" table.
import { writeFileSync } from 'node:fs'
import { MongoClient } from 'mongodb'
import { resolveClubTarget } from './utils/clubEnv.mjs'

const API =
  'https://justgorestapi-prod-us.justgo.com/api/v1/events-results/rankings'
// The rating list's event type, as the site requests it.
const RATING_EVENT_TYPE = 'AA8491C6-C0EF-408E-9DE4-D141BCB42637'
const ORIGIN = 'https://usatt.justgo.com'
const MAX_PAGES = 200

// ==================== input ====================

const VALUE_FLAGS = ['club', 'page-size', 'delay', 'out']

const parseArgs = (argv) => {
  const values = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const name = arg.slice(2)
    if (VALUE_FLAGS.includes(name)) values[name] = argv[++i]
    else values[name] = true
  }
  return {
    club: values.club ?? process.env.CLUB ?? 'spttc',
    pageSize: Number(values['page-size'] ?? 20000),
    delayMs: Number(values.delay ?? 500),
    dryRun: !!values['dry-run'],
    out: values.out,
  }
}

const validateArgs = (args) => {
  if (!args.club) throwError('Club is required')
  if (!(args.pageSize > 0 && args.pageSize <= 50000))
    throwError('--page-size must be 1 to 50000')
  if (!process.env.USATT_TENANT_ID) throwError('Set USATT_TENANT_ID in .env')
}

const throwError = (message) => {
  throw new Error(message)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ==================== fetching ====================

const pageUrl = (pageSize, page) =>
  `${API}?PageSize=${pageSize}&PageNumber=${page}&ResultEventTypeId=${RATING_EVENT_TYPE}&All=0`

const fetchPage = async (pageSize, page, attempt = 1) => {
  const res = await fetch(pageUrl(pageSize, page), {
    headers: {
      accept: 'application/json',
      origin: ORIGIN,
      referer: `${ORIGIN}/`,
      'x-tenant-id': process.env.USATT_TENANT_ID,
    },
  })
  if (res.ok) return (await res.json())?.data?.players ?? []
  if (attempt < 4 && res.status >= 500) {
    await sleep(2000 * attempt)
    return fetchPage(pageSize, page, attempt + 1)
  }
  throwError(`page ${page}: HTTP ${res.status}`)
}

// The whole list in one request by default (about 10,300 players, 4MB):
// paging is unstable — players tied on rating shift between pages, so a
// paged fetch both repeats some and silently skips others (25 of 10,278 on
// 2026-11-13). Pages until one comes back short, should the list ever
// outgrow the page size; the reported total varies between pages, so it
// isn't trusted as the stopping point.
const fetchAll = async ({ pageSize, delayMs }) => {
  const players = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await fetchPage(pageSize, page)
    players.push(...batch)
    console.log(
      `  page ${page}: ${batch.length} players (${players.length} so far)`,
    )
    if (batch.length < pageSize) break
    await sleep(delayMs)
  }
  return dedupeByMember(players)
}

const dedupeByMember = (players) => {
  const byId = new Map()
  for (const player of players)
    if (player.memberId) byId.set(player.memberId, player)
  return [...byId.values()]
}

// ==================== mapping ====================

const SEX = { Male: 'M', Female: 'F' }

const titleCase = (text) =>
  text
    .toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase())

// Most names come properly cased; the ones typed all upper or all lower case
// are tidied, the rest kept exactly as USATT has them ("McDonald", "de la").
const tidyCase = (text) =>
  text === text.toUpperCase() || text === text.toLowerCase()
    ? titleCase(text)
    : text

// "Mazaud, Corentin" — surname first.
const splitName = (name) => {
  const [last, ...rest] = name.split(',')
  return {
    lastName: tidyCase(last.trim()),
    firstName: tidyCase(rest.join(',').trim()),
  }
}

// Only the USATT-derived fields. A club's own columns — email, phone,
// hasAccount, host — are never named here, so an upsert leaves them alone.
const toPlayerFields = (p) => ({
  ...splitName(p.playerName),
  rating: p.finalRating,
  ...(SEX[p.gender] ? { sex: SEX[p.gender] } : {}),
  usattId: Number(p.memberId),
  usattPlayerId: p.playerId,
  usattName: p.playerName,
  usattRank: p.ratingRank,
  ...(p.address ? { state: p.address } : {}),
  ...(p.country ? { country: p.country } : {}),
  ...(p.clubName ? { usattClub: p.clubName } : {}),
  usattSyncedAt: new Date().toISOString(),
})

// ==================== writing ====================

const writePlayers = async ({ uri, dbName, players }) => {
  const client = new MongoClient(uri)
  await client.connect()
  try {
    const collection = client.db(dbName).collection('players')
    const writes = players.map((player) => ({
      updateOne: {
        filter: { usattId: Number(player.memberId) },
        update: { $set: toPlayerFields(player) },
        upsert: true,
      },
    }))
    const result = await collection.bulkWrite(writes, { ordered: false })
    return {
      inserted: result.upsertedCount,
      updated: result.modifiedCount,
      total: await collection.countDocuments(),
    }
  } finally {
    await client.close()
  }
}

const printSample = (players) => {
  console.log('dry run — nothing written to the database. Sample:')
  for (const player of players.slice(0, 5)) {
    const f = toPlayerFields(player)
    console.log(
      `  ${f.firstName} ${f.lastName}  ${f.sex ?? '-'}  rating ${f.rating}  ${f.state ?? ''}  #${f.usattId}`,
    )
  }
}

// ==================== run ====================

const run = async () => {
  const args = parseArgs(process.argv.slice(2))
  validateArgs(args)
  const target = resolveClubTarget(args.club)
  console.log(`USATT ratings -> ${args.club} (${target.dbName})\n`)

  const players = await fetchAll(args)
  console.log(`\n${players.length} players\n`)

  if (args.out) {
    writeFileSync(
      args.out,
      JSON.stringify(players.map(toPlayerFields), null, 2),
    )
    console.log(`written to ${args.out}`)
  }
  if (args.dryRun) return printSample(players)

  const result = await writePlayers({ ...target, players })
  console.log(
    `written: ${result.inserted} new, ${result.updated} updated ` +
      `(${result.total} players in ${target.dbName})`,
  )
}

run().catch((error) => {
  console.error(`\nFailed: ${error.message}`)
  process.exit(1)
})
