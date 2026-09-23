#!/usr/bin/env node
// Provision a new club end to end: MongoDB Atlas project + cluster,
// clubs/<slug>/config.json, a Netlify site with every env var set, and the
// local .env.<slug> to match. Everything reads from one filled-in template —
// copy .env.new-club.template, fill it in, then:
//
//   npm run club:new -- .env.new-club.template
//   npm run club:new -- .env.new-club.template --show-secrets
//
// Every step is idempotent: re-running finds what already exists rather than
// creating a second copy, so a run that fails half way can simply be
// repeated once you've fixed whatever it complained about.
//
// Three things it cannot do, because the provider requires a human (usually
// to defeat exactly this kind of automation) — the template says so at each
// section, and validation refuses to start without them filled in:
//   - a Gmail account + app password
//   - a Pusher app (Channels has no public "create app" API at all)
//   - a Netlify account + personal access token (site creation and env vars
//     ARE scriptable once the account exists — that part this script does)
//
// Needs an Atlas API key with the Organization Project Creator role (see
// TODO.md). That role grants Project Owner only on projects the key itself
// creates, so this script cannot reach the clubs already running.
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { MongoClient } from 'mongodb'

const ATLAS = 'https://cloud.mongodb.com'
const API_V2 = 'application/vnd.atlas.2023-01-01+json'

// ==================== input ====================

// Same shape as scripts/with-club.mjs's own parser: KEY=VALUE lines,
// '#' comments, blank lines skipped, one layer of matching quotes stripped.
const parseEnvFile = (path) => {
  if (!path) throwError('Template path is required')
  if (!existsSync(path)) throwError(`No such file: ${path}`)
  const out = {}
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    let value = line.slice(eq + 1).trim()
    if (value.length >= 2 && /^(".*"|'.*')$/s.test(value)) {
      value = value.slice(1, -1)
    }
    out[line.slice(0, eq).trim()] = value
  }
  return out
}

const parseArgs = (argv) => {
  const templatePath = argv.find((a) => !a.startsWith('--'))
  return {
    templatePath,
    showSecrets: argv.includes('--show-secrets'),
  }
}

// Table rows come in as JSON ("[[1,2,3],[4,5,6]]"); everything else is a
// plain string, trimmed, empty meaning "not set".
const parseTableRows = (raw) => {
  if (!raw?.trim()) return undefined
  let rows
  try {
    rows = JSON.parse(raw)
  } catch {
    throwError(`TABLE_ROWS is not valid JSON: ${raw}`)
  }
  if (
    !Array.isArray(rows) ||
    rows.length === 0 ||
    !rows.every((row) => Array.isArray(row) && row.every(Number.isInteger))
  ) {
    throwError('TABLE_ROWS must be a JSON array of arrays of table numbers')
  }
  return rows
}

const readClubInput = (template) => ({
  slug: template.CLUB_SLUG?.trim(),
  name: template.CLUB_NAME?.trim(),
  appName: template.APP_NAME?.trim(),
  contactName: template.CONTACT_NAME?.trim() || template.CLUB_NAME?.trim(),
  timezone: template.TIMEZONE?.trim() || 'America/Vancouver',
  bannerUrl: template.BANNER_URL?.trim(),
  bannerUrlMobile: template.BANNER_URL_MOBILE?.trim(),
  bannerAlt:
    template.BANNER_ALT?.trim() ||
    (template.CLUB_NAME ? `${template.CLUB_NAME.trim()} Banner` : undefined),
  faviconUrl: template.FAVICON_URL?.trim() || '/images/logo.png',
  pageTitle: template.PAGE_TITLE?.trim() || template.CLUB_NAME?.trim(),
  tableRows: parseTableRows(template.TABLE_ROWS),
  sourceDb: template.MONGODB_SOURCE_DB?.trim() || 'vttc',
  // Each club has its own cluster, so a source db on another club's
  // cluster needs its own URI — otherwise we look for it on this one
  // and quietly find nothing.
  sourceUri: template.MONGODB_SOURCE_URI?.trim(),
  region: template.MONGODB_REGION?.trim() || 'US_WEST_2',
  gmailAddress: template.GMAIL_ADDRESS?.trim(),
  gmailAppPassword: (template.GMAIL_APP_PASSWORD || '').replace(/\s+/g, ''),
  pusherAppId: template.PUSHER_APP_ID?.trim(),
  pusherKey: template.PUSHER_KEY?.trim(),
  pusherSecret: template.PUSHER_SECRET?.trim(),
  pusherCluster: template.PUSHER_CLUSTER?.trim(),
  netlifyToken: template.NETLIFY_AUTH_TOKEN?.trim(),
  netlifySiteName: template.NETLIFY_SITE_NAME?.trim(),
})

const validateInput = (club, env) => {
  const errors = []
  const required = {
    CLUB_SLUG: club.slug,
    CLUB_NAME: club.name,
    APP_NAME: club.appName,
    BANNER_URL: club.bannerUrl,
    TABLE_ROWS: club.tableRows,
    GMAIL_ADDRESS: club.gmailAddress,
    GMAIL_APP_PASSWORD: club.gmailAppPassword,
    PUSHER_APP_ID: club.pusherAppId,
    PUSHER_KEY: club.pusherKey,
    PUSHER_SECRET: club.pusherSecret,
    PUSHER_CLUSTER: club.pusherCluster,
    NETLIFY_AUTH_TOKEN: club.netlifyToken,
  }
  for (const [key, value] of Object.entries(required)) {
    if (!value) errors.push(`${key} is not set in the template`)
  }
  if (club.slug && !/^[a-z][a-z0-9-]{1,30}$/.test(club.slug)) {
    errors.push('CLUB_SLUG must be lowercase letters, digits and dashes')
  }
  if (!env.MONGODB_PROJECT_CREATOR_PUBLIC_KEY) {
    errors.push('MONGODB_PROJECT_CREATOR_PUBLIC_KEY is not set in .env')
  }
  if (!env.MONGODB_PROJECT_CREATOR_PRIVATE_KEY) {
    errors.push('MONGODB_PROJECT_CREATOR_PRIVATE_KEY is not set in .env')
  }
  if (!env.MONGODB_URI) {
    errors.push(
      'MONGODB_URI is not set in .env (the existing cluster, for credentials and templates)',
    )
  }
  if (errors.length) {
    console.error('Cannot start:\n  ' + errors.join('\n  '))
    process.exit(1)
  }
}

// The new cluster reuses the existing database credentials, so the club's
// connection string differs only in host and database name.
const readExistingCredentials = (uri) => {
  if (!uri) throwError('MONGODB_URI is required')
  const match = uri.match(/^mongodb\+srv:\/\/([^:]+):([^@]+)@/)
  if (!match)
    throwError('MONGODB_URI is not a mongodb+srv:// URI with credentials')
  return { username: match[1], password: decodeURIComponent(match[2]) }
}

const throwError = (message) => {
  throw new Error(message)
}

// ==================== Atlas API (HTTP Digest) ====================

const md5 = (value) => createHash('md5').update(value).digest('hex')

// Atlas authenticates with HTTP Digest, which fetch() doesn't implement: the
// first request is expected to 401 with a nonce, and the real request carries
// a hash of it. Done here rather than by shelling out to curl, which would put
// the private key in the process list where any user on the box can read it.
const digestHeader = (challenge, { method, path, username, password }) => {
  const field = (name) =>
    (challenge.match(new RegExp(`${name}="?([^",]+)"?`)) || [])[1]
  const realm = field('realm')
  const nonce = field('nonce')
  const qop = field('qop')
  const opaque = field('opaque')
  const cnonce = randomBytes(8).toString('hex')
  const nc = '00000001'

  const ha1 = md5(`${username}:${realm}:${password}`)
  const ha2 = md5(`${method}:${path}`)
  const response = qop
    ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${nonce}:${ha2}`)

  const parts = [
    `username="${username}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${path}"`,
    `response="${response}"`,
  ]
  if (qop) parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`)
  if (opaque) parts.push(`opaque="${opaque}"`)
  return `Digest ${parts.join(', ')}`
}

const createAtlasClient = ({ username, password }) => {
  if (!username || !password) throwError('Atlas API key is required')

  return async (method, path, body, { accept = API_V2 } = {}) => {
    const url = `${ATLAS}${path}`
    const init = {
      method,
      headers: {
        Accept: accept,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }

    const unauthorized = await fetch(url, init)
    if (unauthorized.status !== 401)
      return readAtlasResponse(unauthorized, path)

    const challenge = unauthorized.headers.get('www-authenticate')
    if (!challenge)
      throwError(`Atlas refused ${path} without a digest challenge`)

    const authed = await fetch(url, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: digestHeader(challenge, {
          method,
          path,
          username,
          password,
        }),
      },
    })
    return readAtlasResponse(authed, path)
  }
}

const readAtlasResponse = async (response, path) => {
  const text = await response.text()
  const body = text ? JSON.parse(text) : {}
  if (!response.ok) {
    throwError(
      `${path} -> ${response.status} ${body.errorCode || ''} ${body.detail || text}`,
    )
  }
  return body
}

// ==================== Atlas provisioning steps ====================

const getOrgId = async (api) => {
  const { results = [] } = await api('GET', '/api/atlas/v2/orgs')
  if (results.length === 0) throwError('The API key can see no organization')
  if (results.length > 1) {
    throwError(
      `Key spans ${results.length} organizations; this script expects one`,
    )
  }
  return { id: results[0].id, name: results[0].name }
}

const findOrCreateProject = async (api, { name, orgId }) => {
  if (!name || !orgId) throwError('Project name and org id are required')
  const { results = [] } = await api('GET', '/api/atlas/v2/groups')
  const existing = results.find((g) => g.name === name)
  if (existing) return { id: existing.id, created: false }
  const created = await api('POST', '/api/atlas/v2/groups', { name, orgId })
  return { id: created.id, created: true }
}

const findOrCreateCluster = async (
  api,
  { projectId, name, provider, region },
) => {
  if (!projectId || !name)
    throwError('Project id and cluster name are required')
  const path = `/api/atlas/v2/groups/${projectId}/clusters`
  const { results = [] } = await api('GET', path)
  const existing = results.find((c) => c.name === name)
  if (existing) return { created: false }

  // The v2 regionConfigs shape is rejected for free clusters
  // (INVALID_ATTRIBUTE), so a free tier is created through v1's
  // providerSettings. Everything else here speaks v2.
  await api(
    'POST',
    `/api/atlas/v1.0/groups/${projectId}/clusters`,
    {
      name,
      providerSettings: {
        providerName: 'TENANT',
        backingProviderName: provider,
        regionName: region,
        instanceSizeName: 'M0',
      },
    },
    { accept: 'application/json' },
  )
  return { created: true }
}

const waitForCluster = async (api, { projectId, name, attempts = 30 }) => {
  const path = `/api/atlas/v2/groups/${projectId}/clusters/${name}`
  for (let i = 0; i < attempts; i++) {
    const cluster = await api('GET', path)
    if (cluster.stateName === 'IDLE') return cluster
    await sleep(10_000)
  }
  throwError(`Cluster ${name} was still not IDLE after ${attempts} checks`)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const ensureDatabaseUser = async (api, { projectId, username, password }) => {
  if (!projectId || !username)
    throwError('Project id and username are required')
  const path = `/api/atlas/v2/groups/${projectId}/databaseUsers`
  const { results = [] } = await api('GET', path)
  if (results.some((u) => u.username === username)) return { created: false }

  await api('POST', path, {
    databaseName: 'admin',
    username,
    password,
    roles: [
      { databaseName: 'admin', roleName: 'readWriteAnyDatabase' },
      // clusterMonitor is what lets scripts/db-connections.mjs call
      // serverStatus; read/write alone cannot.
      { databaseName: 'admin', roleName: 'clusterMonitor' },
    ],
  })
  return { created: true }
}

// Netlify Functions run on Lambda, whose egress addresses are dynamic, so
// there is no narrower list to write. The database password is what protects
// the cluster — keep it per-club rather than shared.
const ensureOpenAccessList = async (api, { projectId }) => {
  if (!projectId) throwError('Project id is required')
  const path = `/api/atlas/v2/groups/${projectId}/accessList`
  const { results = [] } = await api('GET', path)
  if (results.some((entry) => entry.cidrBlock === '0.0.0.0/0')) {
    return { created: false }
  }
  await api('POST', path, [
    {
      cidrBlock: '0.0.0.0/0',
      comment: 'Netlify Functions (dynamic Lambda IPs)',
    },
  ])
  return { created: true }
}

// ==================== databases ====================

const buildUri = (host, { username, password }) =>
  `mongodb+srv://${username}:${encodeURIComponent(password)}@${host}/?retryWrites=true`

// Copied wholesale from the source club so a new club opens with the
// tournament formats and the player roster already in place.
const SEED_COLLECTIONS = ['tournaments', 'players']

const seedDatabases = async ({ uri, sourceUri, sourceDb, databases }) => {
  if (!uri || !sourceUri) throwError('Both cluster URIs are required')

  const source = await readSourceCollections(sourceUri, sourceDb)
  const client = new MongoClient(uri)
  await client.connect()
  const report = []
  try {
    for (const name of databases) {
      report.push(...(await seedOneDatabase(client.db(name), name, source)))
    }
  } finally {
    await client.close()
  }
  return { source, report }
}

const readSourceCollections = async (sourceUri, sourceDb) => {
  const client = new MongoClient(sourceUri)
  await client.connect()
  try {
    const db = client.db(sourceDb)
    const entries = await Promise.all(
      SEED_COLLECTIONS.map(async (name) => [
        name,
        await db.collection(name).find({}).toArray(),
      ]),
    )
    return Object.fromEntries(entries)
  } finally {
    await client.close()
  }
}

const seedOneDatabase = async (db, name, source) => {
  const existing = (await db.listCollections().toArray()).map((c) => c.name)
  const lines = []
  for (const collection of SEED_COLLECTIONS) {
    const outcome = await seedOneCollection(db, existing, collection, source[collection])
    lines.push(`${name}.${collection}: ${outcome}`)
  }
  return lines
}

// Never overwrites: a collection with anything in it is a club already in
// use, and a re-run must not reset it.
const seedOneCollection = async (db, existing, name, documents) => {
  // Mongo creates a database lazily, so without an explicit createCollection
  // neither the database nor the collection exists until something writes.
  if (!existing.includes(name)) await db.createCollection(name)

  const collection = db.collection(name)
  const already = await collection.countDocuments()
  if (already > 0) return `${already} already, left alone`
  if (documents.length === 0) return 'created, nothing to copy'

  const result = await collection.insertMany(documents)
  return `created, ${result.insertedCount} copied`
}

// ==================== club config file ====================

const CLUBS_DIR = 'clubs'

const buildClubConfig = (club) => {
  const all = club.tableRows.flat()
  return {
    slug: club.slug,
    name: club.name,
    appName: club.appName,
    timezone: club.timezone,
    branding: {
      bannerUrl: club.bannerUrl,
      // Left out entirely when unset, rather than written as an empty
      // string — the client falls back to the wide banner on absence.
      ...(club.bannerUrlMobile
        ? { bannerUrlMobile: club.bannerUrlMobile }
        : {}),
      bannerAlt: club.bannerAlt,
      contactName: club.contactName,
      faviconUrl: club.faviconUrl,
      pageTitle: club.pageTitle,
    },
    tables: {
      all,
      rows: club.tableRows,
      // Sequential order and empty tiers until someone who has stood in
      // the hall knows which tables are the good ones and what the rating
      // bands should be. TODO.md carries the same gap for GVTTC, filled in
      // by hand after the fact — this just makes that the documented
      // starting point instead of a silent omission.
      order: all,
      lowTierOrder: all,
      highTierOrder: all,
      knockoutExcluded: [],
      generalExcluded: [],
      highTierExcluded: [],
      highTierSemifinalExcluded: [],
      highTierFinalOnly: [],
      lowTierBigMatchPreferred: [],
    },
    tiers: { low: [], high: [] },
  }
}

// Never overwrites: a hand-edited config (real tier rules, a fixed table
// order) must survive re-running this script.
const ensureClubConfig = (club) => {
  const dir = `${CLUBS_DIR}/${club.slug}`
  const path = `${dir}/config.json`
  if (existsSync(path)) return { path, created: false }
  mkdirSync(dir, { recursive: true })
  writeFileSync(path, JSON.stringify(buildClubConfig(club), null, 2) + '\n')
  return { path, created: true }
}

// ==================== Netlify ====================

const NETLIFY = 'https://api.netlify.com/api/v1'

const createNetlifyClient = (token) => {
  if (!token) throwError('Netlify auth token is required')
  return async (method, path, body) => {
    const response = await fetch(`${NETLIFY}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const text = await response.text()
    const data = parseJsonBody(text)
    if (!response.ok) {
      const err = new Error(
        `${method} ${path} -> ${response.status} ${data.message || text || ''}`,
      )
      err.status = response.status
      throw err
    }
    return data
  }
}

// Netlify answers some refusals in plain text rather than JSON (notably
// "Site using Environment Variables API"), so the body can never be fed
// straight to JSON.parse.
const parseJsonBody = (text) => {
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

// Netlify does NOT error on a taken site name — it silently appends random
// characters and creates a second site instead. Idempotency needs an
// explicit lookup by name first, or every re-run would create a new one.
const findOrCreateSite = async (netlify, { name }) => {
  const sites = await netlify('GET', '/sites?per_page=100')
  const existing = sites.find((s) => s.name === name)
  if (existing) return { site: existing, created: false }
  const created = await netlify('POST', '/sites', { name })
  return { site: created, created: true }
}

const siteUrlOf = (site) =>
  site.ssl_url || site.url || `https://${site.name}.netlify.app`

// Build command lives on the site's build_settings object; env vars do not
// (see setSiteEnv). Read-merge-write rather than trusting a partial PATCH to
// merge the nested object for us.
const configureSite = async (netlify, site, { env }) => {
  const current = await netlify('GET', `/sites/${site.id}`)
  const { env: _legacyEnv, ...buildSettings } = current.build_settings || {}
  await netlify('PATCH', `/sites/${site.id}`, {
    build_settings: {
      ...buildSettings,
      cmd: 'node scripts/with-club.mjs vite build',
      dir: 'dist',
      functions_dir: 'netlify/functions',
    },
  })
  return setSiteEnv(netlify, site, env)
}

const ENV_SCOPES = ['builds', 'functions', 'runtime', 'post_processing']

// Teams migrated to the Environment Variables API reject env inside a
// build_settings PATCH with a plain-text "Site using Environment Variables
// API". Those vars live on the account, scoped to a site by query param.
// Older teams have no such endpoint, hence the fallback.
const setSiteEnv = async (netlify, site, env) => {
  const account = site.account_slug || site.account_id
  const entries = Object.entries(env).filter(([, value]) => value != null && value !== '')
  try {
    await writeAccountEnv(netlify, account, site.id, entries)
  } catch (e) {
    if (e.status !== 404) throw e
    await writeLegacyEnv(netlify, site, env)
  }
  return { envCount: entries.length }
}

const writeAccountEnv = async (netlify, account, siteId, entries) => {
  const query = `?site_id=${siteId}`
  const existing = await netlify('GET', `/accounts/${account}/env${query}`)
  const known = new Set((Array.isArray(existing) ? existing : []).map((v) => v.key))

  const toCreate = entries.filter(([key]) => !known.has(key))
  if (toCreate.length > 0)
    await netlify(
      'POST',
      `/accounts/${account}/env${query}`,
      toCreate.map(([key, value]) => envVarBody(key, value)),
    )

  // Updates are one call per key — the API has no batch update.
  for (const [key, value] of entries.filter(([key]) => known.has(key)))
    await netlify(
      'PUT',
      `/accounts/${account}/env/${key}${query}`,
      envVarBody(key, value),
    )
}

const envVarBody = (key, value) => ({
  key,
  scopes: ENV_SCOPES,
  values: [{ value: String(value), context: 'all' }],
})

const writeLegacyEnv = async (netlify, site, env) => {
  const current = await netlify('GET', `/sites/${site.id}`)
  await netlify('PATCH', `/sites/${site.id}`, {
    build_settings: {
      ...current.build_settings,
      env: { ...(current.build_settings?.env || {}), ...env },
    },
  })
}

const buildSiteEnv = (club, uri, siteUrl, authSecret) => ({
  CLUB: club.slug,
  MONGODB_URI: uri,
  MONGODB_DB: club.slug,
  PUSHER_APP_ID: club.pusherAppId,
  PUSHER_SECRET: club.pusherSecret,
  VITE_PUSHER_KEY: club.pusherKey,
  VITE_PUSHER_CLUSTER: club.pusherCluster,
  GMAIL_1: club.gmailAddress,
  GMAIL_1_APP_PASSWORD: club.gmailAppPassword,
  VITE_PROD_HOST: siteUrl,
  AUTH_SECRET: authSecret,
})

const provisionNetlifySite = async (club, { uri, authSecret }) => {
  const netlify = createNetlifyClient(club.netlifyToken)
  const { site, created } = await findOrCreateSite(netlify, {
    name: club.netlifySiteName || club.slug,
  })
  const siteUrl = siteUrlOf(site)
  const env = buildSiteEnv(club, uri, siteUrl, authSecret)
  const { envCount } = await configureSite(netlify, site, { env })
  return { site, created, url: siteUrl, envCount }
}

// ==================== local env file ====================

// Never overwrites: a live .env.<slug> may carry values someone tuned by
// hand (a rotated AUTH_SECRET, a different VITE_PROD_HOST during testing).
const ensureLocalEnvFile = (club, { uri, siteUrl, authSecret }) => {
  const path = `.env.${club.slug}`
  if (existsSync(path)) return { path, created: false }
  const lines = [
    `CLUB=${club.slug}`,
    '',
    `MONGODB_URI=${uri}`,
    `MONGODB_DB=${club.slug}`,
    '',
    `PUSHER_APP_ID=${club.pusherAppId}`,
    `PUSHER_SECRET=${club.pusherSecret}`,
    `VITE_PUSHER_KEY=${club.pusherKey}`,
    `VITE_PUSHER_CLUSTER=${club.pusherCluster}`,
    '',
    `GMAIL_1=${club.gmailAddress}`,
    `GMAIL_1_APP_PASSWORD=${club.gmailAppPassword}`,
    '',
    `VITE_PROD_HOST=${siteUrl}`,
    `AUTH_SECRET=${authSecret}`,
    '',
  ]
  writeFileSync(path, lines.join('\n'))
  return { path, created: true }
}

// ==================== run ====================

// The DB-scoped connection string every downstream step needs (the
// seeding client above deliberately uses the bare, database-less version).
const buildClubUri = (host, { username, password }, dbName) =>
  `mongodb+srv://${username}:${encodeURIComponent(password)}@${host}/${dbName}?retryWrites=true`

const describeSource = (source) =>
  SEED_COLLECTIONS.map((name) => `${source[name].length} ${name}`).join(', ')

const isSourceEmpty = (source) =>
  SEED_COLLECTIONS.every((name) => source[name].length === 0)

// A source db with nothing in it is far more often the wrong cluster than a
// genuinely empty one — each club's db lives on its own cluster, so the name
// alone resolves against whichever URI we happen to be holding.
const warnEmptySource = (club) =>
  `              ^ source db is empty. If ${club.sourceDb} is on another\n` +
  `                cluster, set MONGODB_SOURCE_URI in the template.`

const run = async () => {
  const args = parseArgs(process.argv.slice(2))
  if (!args.templatePath) {
    console.error(
      'Which template? e.g. npm run club:new -- .env.new-club.template',
    )
    process.exit(1)
  }
  const club = readClubInput(parseEnvFile(args.templatePath))
  validateInput(club, process.env)

  console.log(`provisioning ${club.name} (${club.slug})\n`)

  // ---- MongoDB Atlas ----
  const credentials = readExistingCredentials(process.env.MONGODB_URI)
  const atlas = createAtlasClient({
    username: process.env.MONGODB_PROJECT_CREATOR_PUBLIC_KEY,
    password: process.env.MONGODB_PROJECT_CREATOR_PRIVATE_KEY,
  })

  const org = await getOrgId(atlas)
  console.log(`organization: ${org.name}`)

  const project = await findOrCreateProject(atlas, {
    name: club.slug,
    orgId: org.id,
  })
  console.log(
    `project:      ${club.slug} ${project.created ? '(created)' : '(existing)'}`,
  )

  const cluster = await findOrCreateCluster(atlas, {
    projectId: project.id,
    name: club.slug,
    provider: 'AWS',
    region: club.region,
  })
  console.log(
    `cluster:      ${club.slug} M0 AWS/${club.region} ` +
      `${cluster.created ? '(created — this takes a minute)' : '(existing)'}`,
  )

  const ready = await waitForCluster(atlas, {
    projectId: project.id,
    name: club.slug,
  })
  const host = (ready.connectionStrings?.standardSrv || '').replace(
    'mongodb+srv://',
    '',
  )
  if (!host) throwError('Cluster is IDLE but reported no connection string')

  const user = await ensureDatabaseUser(atlas, {
    projectId: project.id,
    username: credentials.username,
    password: credentials.password,
  })
  console.log(
    `db user:      ${credentials.username} ${user.created ? '(created)' : '(existing)'}`,
  )

  const access = await ensureOpenAccessList(atlas, { projectId: project.id })
  console.log(
    `network:      0.0.0.0/0 ${access.created ? '(added)' : '(existing)'}`,
  )

  const { source, report } = await seedDatabases({
    uri: buildUri(host, credentials),
    sourceUri: club.sourceUri || process.env.MONGODB_URI,
    sourceDb: club.sourceDb,
    databases: [club.slug, `${club.slug}-dev`],
  })
  console.log(`source:       ${describeSource(source)} in ${club.sourceDb}`)
  if (isSourceEmpty(source)) console.log(warnEmptySource(club))
  for (const line of report) console.log(`              ${line}`)

  const uri = buildClubUri(host, credentials, club.slug)

  // ---- clubs/<slug>/config.json ----
  const config = ensureClubConfig(club)
  console.log(
    `\nconfig:       ${config.path} ${config.created ? '(created)' : '(already exists, left alone)'}`,
  )

  // ---- Netlify site + env vars ----
  const authSecret = randomBytes(32).toString('hex')
  console.log('\nnetlify site...')
  const site = await provisionNetlifySite(club, { uri, authSecret })
  console.log(
    `site:         ${site.site.name} ${site.created ? '(created)' : '(existing)'}`,
  )
  console.log(`url:          ${site.url}`)
  console.log(
    `env vars:     ${site.envCount} set (merged with anything already there)`,
  )

  // ---- local .env.<slug> ----
  const localEnv = ensureLocalEnvFile(club, {
    uri,
    siteUrl: site.url,
    authSecret,
  })
  console.log(
    `\nlocal env:    ${localEnv.path} ${localEnv.created ? '(written)' : '(already exists, left alone)'}`,
  )

  console.log(
    `\n${club.name} is provisioned. Two things still need a human:\n` +
      '  1. Link the Netlify site to this repo, so a git push deploys it:\n' +
      `     ${site.url.replace('https://', 'https://app.netlify.com/sites/').replace('.netlify.app', '')}` +
      ' -> Site configuration -> Build & deploy -> Link repository\n' +
      '     (needs a GitHub OAuth click in the browser — no API for that step)\n' +
      `  2. Review clubs/${club.slug}/config.json: table order / tier lists start\n` +
      '     as sequential / empty placeholders until the hall and rating bands\n' +
      '     are known — same gap TODO.md already notes for GVTTC.\n',
  )

  if (args.showSecrets) {
    console.log(`MONGODB_URI=${uri}`)
    console.log(`AUTH_SECRET=${authSecret}`)
  }
}

run().catch((error) => {
  console.error(`\nFailed: ${error.message}`)
  process.exit(1)
})
