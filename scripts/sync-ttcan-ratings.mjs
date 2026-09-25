#!/usr/bin/env node
// Import the Table Tennis Canada rating list into a club's players
// collection, and keep it current.
//
//   npm run ratings:sync -- --club gvttc                  BC, with history
//   npm run ratings:sync -- --club gvttc --prov ON
//   npm run ratings:sync -- --club gvttc --national   (see the caveat below)
//   npm run ratings:sync -- --club gvttc --activity ALL   every player on record
//   npm run ratings:sync -- --club gvttc --no-history     ratings only, fast
//   npm run ratings:sync -- --club gvttc --dry-run        report, write nothing
//
// Safe to re-run: players are matched on their TTCan id and only the fields
// that come from TTCan are written, so a club's own additions (email, phone,
// account, host) survive every sync.
//
// ttcan.ca serves this from a classic ASP page behind an iframe — plain query
// strings, no session, no JavaScript. It does throttle, so requests are
// spaced out and 503s are retried.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { MongoClient } from 'mongodb'

const BASE = 'http://www.ttcan.ca/ratingSystem'
const LIST = `${BASE}/ctta_ratings3.asp`
const PLAYER = `${BASE}/ctta_ratings1.asp`
// The site returns 503 to clients it doesn't recognise as a browser.
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0 Safari/537.36'

// ==================== input ====================

const VALUE_FLAGS = ['club', 'prov', 'period', 'delay', 'out', 'activity']

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
    club: values.club ?? process.env.CLUB ?? 'gvttc',
    // Empty province means the national list.
    province: values.national ? '' : (values.prov ?? 'BC'),
    period: values.period ?? '',
    // The site defaults to 24 months, which quietly hides anyone who hasn't
    // played recently — half the BC list. 60 brings them back; ALL is wider
    // still, reaching to players last rated in the 1990s.
    activity: values.activity ?? '60',
    withHistory: !values['no-history'],
    dryRun: !!values['dry-run'],
    delayMs: Number(values.delay ?? 400),
    out: values.out,
  }
}

const throwError = (message) => {
  throw new Error(message)
}

// ==================== club environment ====================

// Same layering as scripts/with-club.mjs: .env.<club> wins over .env, so the
// target is the club's own cluster rather than whichever one .env points at.
const parseEnvFile = (path) => {
  if (!path) throwError('Env file path is required')
  if (!existsSync(path)) return {}
  const out = {}
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    let value = line.slice(eq + 1).trim()
    if (value.length >= 2 && /^(".*"|'.*')$/s.test(value))
      value = value.slice(1, -1)
    out[line.slice(0, eq).trim()] = value
  }
  return out
}

const resolveTarget = (club) => {
  if (!club) throwError('Club is required')
  const clubEnv = parseEnvFile(`.env.${club}`)
  const uri = clubEnv.MONGODB_URI || process.env.MONGODB_URI
  if (!uri) {
    throwError(
      `No MONGODB_URI for "${club}" — add .env.${club} or set it in .env`,
    )
  }
  const dbName = clubEnv.MONGODB_DB || process.env.MONGODB_DB || club
  return { uri, dbName }
}

// ==================== fetching ====================

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const fetchPage = async (url, { attempts = 4 } = {}) => {
  if (!url) throwError('URL is required')
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Referer: `${LIST}` },
    })
    if (response.ok) return response.text()
    // 503 is how the site throttles; back off rather than hammering it.
    if (response.status !== 503 || attempt === attempts) {
      throwError(`${url} -> ${response.status}`)
    }
    await sleep(1000 * attempt)
  }
  throwError(`${url} -> gave up after ${attempts} attempts`)
}

// Every parameter the site's own pagination links carry. Sending a subset
// loses the filter — asking for page 2 of BC with only Prov set returns the
// national list instead.
//
// CAVEAT on --national: the site caps that listing at 11 pages (1100
// players) and gives no hint that it has truncated. BC alone returns 729
// and Alberta 847, so a national sync silently misses most of the country,
// keeping only the highest-rated. Sync province by province when
// completeness matters; --national is only good for "the top of the
// national list".
const listUrl = ({ province, period, activity, page }) =>
  `${LIST}?activity=${activity}&Category_code=1&Full_Name=&Period_Issued=${period}` +
  `&Prov=${province}&Reg=&Region=&Sex=&Formv_ctta_ratings_Page=${page}`

// ==================== parsing ====================

const stripTags = (html) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

const tableRows = (html) =>
  [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) =>
    [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(
      (cell) => cell[1],
    ),
  )

// Columns: Serial, Name, Prov, Gender, Rating, Period, Last Played, Temp.
// The name cell carries the player's TTCan id, which is the only stable key
// this site offers — names repeat and change spelling.
const parseListPage = (html) => {
  if (!html) throwError('List page HTML is required')
  const players = []
  for (const cells of tableRows(html)) {
    if (cells.length < 7) continue
    const rating = Number(stripTags(cells[4]))
    if (!Number.isFinite(rating)) continue
    const id = (cells[1].match(/Player_ID=(\d+)/) || [])[1]
    if (!id) continue
    players.push({
      ttcanId: Number(id),
      ttcanName: stripTags(cells[1]),
      province: stripTags(cells[2]),
      sex: parseSex(stripTags(cells[3])),
      rating,
      periodId: Number(stripTags(cells[5])) || undefined,
      lastPlayed: stripTags(cells[6]) || undefined,
    })
  }
  return players
}

const parseSex = (value) => {
  if (value === 'M') return 'male'
  if (value === 'F') return 'female'
  return undefined
}

// Without a period the site lists every period at once, so a player appears
// dozens of times and "page 3 of 11" is mostly repeats. Default to the one
// the site marks SELECTED — the current list — rather than hardcoding an id
// that goes stale every month.
const currentPeriodId = (html) => {
  if (!html) throwError('List page HTML is required')
  const select = (html.match(
    /<select name="Period_Issued"[\s\S]*?<\/select>/i,
  ) || [])[0]
  if (!select) throwError('Could not find the period dropdown')
  const selected = select.match(/<option value="(\d+)"\s+SELECTED/i)
  if (selected) return selected[1]
  const first = select.match(/<option value="(\d+)"/i)
  if (!first) throwError('Could not read any period from the dropdown')
  return first[1]
}

const periodLabel = (html, periodId) => {
  const match = html.match(
    new RegExp(`<option value="${periodId}"[^>]*>([^<]+)<`, 'i'),
  )
  return match ? match[1].trim() : periodId
}

const lastPageNumber = (html) => {
  const pages = [...html.matchAll(/Formv_ctta_ratings_Page=(\d+)/g)].map((m) =>
    Number(m[1]),
  )
  return pages.length ? Math.max(...pages) : 1
}

// The detail page adds the year of birth and every rating period on record.
const parsePlayerPage = (html) => {
  if (!html) throwError('Player page HTML is required')
  const text = stripTags(html)
  const birthYear =
    Number((text.match(/Year of Birth:\s*(\d{4})/i) || [])[1]) || undefined

  const history = []
  for (const cells of tableRows(html)) {
    if (cells.length < 5) continue
    const periodId = Number(stripTags(cells[0]))
    const rating = Number(stripTags(cells[4]))
    if (!Number.isFinite(periodId) || !Number.isFinite(rating)) continue
    history.push({ periodId, period: stripTags(cells[1]), rating })
  }
  // Newest first, as the site lists them.
  history.sort((a, b) => b.periodId - a.periodId)
  return { birthYear, history }
}

// ==================== mapping to a Player ====================

// TTCan writes the surname first, usually capitalised: "HUANG Edison",
// "LI Jonathan S.", "NG Pak Yu". The leading all-caps run is the surname and
// the rest is the given name; when nothing is capitalised ("Wang Zexuan")
// the first word is taken as the surname.
const splitName = (fullName) => {
  if (!fullName) throwError('A name is required')
  const words = fullName.split(/\s+/).filter(Boolean)
  if (words.length === 1)
    return { lastName: titleCase(words[0]), firstName: '' }

  let surnameCount = 0
  while (surnameCount < words.length - 1 && isAllCaps(words[surnameCount]))
    surnameCount++
  if (surnameCount === 0) surnameCount = 1

  return {
    lastName: words.slice(0, surnameCount).map(titleCase).join(' '),
    firstName: words.slice(surnameCount).join(' '),
  }
}

const isAllCaps = (word) => /^[A-Z][A-Z'.-]*$/.test(word)

const titleCase = (word) =>
  word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()

// Only the TTCan-derived fields. A club's own columns — email, phone,
// hasAccount, host — are never named here, so an upsert leaves them alone.
const toPlayerFields = (scraped, detail) => {
  const { firstName, lastName } = splitName(scraped.ttcanName)
  return {
    firstName,
    lastName,
    rating: scraped.rating,
    ...(scraped.sex ? { sex: scraped.sex } : {}),
    ttcanId: scraped.ttcanId,
    ttcanName: scraped.ttcanName,
    province: scraped.province,
    ...(scraped.lastPlayed ? { ttcanLastPlayed: scraped.lastPlayed } : {}),
    ...(scraped.periodId ? { ttcanPeriodId: scraped.periodId } : {}),
    // Only the year is published, so dateOfBirth is deliberately left unset
    // rather than invented — the age limits on registration read that field.
    ...(detail?.birthYear ? { birthYear: detail.birthYear } : {}),
    ...(detail?.history?.length ? { ttcanRatingHistory: detail.history } : {}),
    ttcanSyncedAt: new Date().toISOString(),
  }
}

// ==================== steps ====================

const scrapeList = async ({ province, period, activity, delayMs }) => {
  let html = await fetchPage(listUrl({ province, period, activity, page: 1 }))
  // An unspecified period means "All Periods"; resolve it to the current one
  // and start again, or every player comes back once per period.
  const resolved = period || currentPeriodId(html)
  if (resolved !== period) {
    console.log(`period: ${periodLabel(html, resolved)} (${resolved})`)
    await sleep(delayMs)
    html = await fetchPage(
      listUrl({ province, period: resolved, activity, page: 1 }),
    )
  }

  const pages = lastPageNumber(html)
  const players = parseListPage(html)
  console.log(`  page 1/${pages}: ${players.length} players`)

  for (let page = 2; page <= pages; page++) {
    await sleep(delayMs)
    const more = parseListPage(
      await fetchPage(listUrl({ province, period: resolved, activity, page })),
    )
    players.push(...more)
    console.log(`  page ${page}/${pages}: ${more.length} players`)
  }
  return dedupeById(players)
}

const dedupeById = (players) => {
  const byId = new Map()
  for (const player of players) byId.set(player.ttcanId, player)
  return [...byId.values()]
}

const scrapeHistories = async (players, { delayMs }) => {
  const details = new Map()
  let done = 0
  for (const player of players) {
    const url = `${PLAYER}?Player_ID=${player.ttcanId}&Period=${player.periodId ?? ''}&`
    try {
      details.set(player.ttcanId, parsePlayerPage(await fetchPage(url)))
    } catch (error) {
      console.log(`  ${player.ttcanName}: ${error.message}`)
    }
    done++
    if (done % 25 === 0) console.log(`  ${done}/${players.length}`)
    await sleep(delayMs)
  }
  return details
}

const writePlayers = async ({ uri, dbName, players, details }) => {
  const client = new MongoClient(uri)
  await client.connect()
  try {
    const collection = client.db(dbName).collection('players')
    const writes = players.map((player) => ({
      updateOne: {
        filter: { ttcanId: player.ttcanId },
        update: { $set: toPlayerFields(player, details.get(player.ttcanId)) },
        upsert: true,
      },
    }))
    const result = await collection.bulkWrite(writes)
    return {
      inserted: result.upsertedCount,
      updated: result.modifiedCount,
      total: await collection.countDocuments(),
    }
  } finally {
    await client.close()
  }
}

// ==================== run ====================

const run = async () => {
  const args = parseArgs(process.argv.slice(2))
  const target = resolveTarget(args.club)
  const where = args.province || 'all of Canada'

  console.log(`TTCan ratings -> ${args.club} (${target.dbName})`)
  console.log(
    `scope: ${where}` +
      `${args.period ? `, period ${args.period}` : ', current period'}` +
      `, active within ${args.activity === 'ALL' ? 'any time' : args.activity + ' months'}\n`,
  )

  const players = await scrapeList(args)
  console.log(`\n${players.length} players\n`)

  let details = new Map()
  if (args.withHistory) {
    console.log('rating history (one request per player)...')
    details = await scrapeHistories(players, args)
    const withYear = [...details.values()].filter((d) => d.birthYear).length
    console.log(`  ${details.size} fetched, ${withYear} with a birth year\n`)
  }

  if (args.out) {
    const rows = players.map((p) => toPlayerFields(p, details.get(p.ttcanId)))
    writeFileSync(args.out, JSON.stringify(rows, null, 2))
    console.log(`written to ${args.out}`)
  }

  if (args.dryRun) {
    console.log('dry run — nothing written to the database. Sample:')
    for (const player of players.slice(0, 5)) {
      const fields = toPlayerFields(player, details.get(player.ttcanId))
      console.log(
        `  ${fields.firstName} ${fields.lastName}  rating ${fields.rating}` +
          `  ${fields.birthYear ? 'b.' + fields.birthYear : ''}` +
          `  ${fields.ttcanRatingHistory?.length ?? 0} periods`,
      )
    }
    return
  }

  const result = await writePlayers({ ...target, players, details })
  console.log(
    `written: ${result.inserted} new, ${result.updated} updated ` +
      `(${result.total} players in ${target.dbName})`,
  )
}

run().catch((error) => {
  console.error(`\nFailed: ${error.message}`)
  process.exit(1)
})
