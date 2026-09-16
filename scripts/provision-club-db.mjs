#!/usr/bin/env node
// Provision a new club's MongoDB: Atlas project, free cluster, database user,
// network access, both databases, and the tournament templates to start from.
//
//   npm run db:new-club -- gvttc
//   npm run db:new-club -- gvttc --source-db vttc --region US_WEST_2
//   npm run db:new-club -- gvttc --show-uri
//
// Every step is idempotent: re-running finds what already exists rather than
// creating a second copy, so a run that fails half way can simply be repeated.
//
// Needs an Atlas API key with the Organization Project Creator role (see
// TODO.md). That role grants Project Owner only on projects the key itself
// creates, so this script cannot reach the clubs already running.
import { createHash, randomBytes } from 'node:crypto'
import { MongoClient } from 'mongodb'

const ATLAS = 'https://cloud.mongodb.com'
const API_V2 = 'application/vnd.atlas.2023-01-01+json'

// ==================== input ====================

const VALUE_FLAGS = ['source-db', 'region', 'provider']

const parseArgs = (argv) => {
  const values = {}
  let slug
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) {
      // The first bare argument is the club; a value flag consumes its own.
      if (!slug) slug = arg
      continue
    }
    const name = arg.slice(2)
    if (VALUE_FLAGS.includes(name)) values[name] = argv[++i]
    else values[name] = true
  }
  return {
    slug,
    sourceDb: values['source-db'] ?? 'vttc',
    region: values.region ?? 'US_WEST_2',
    provider: values.provider ?? 'AWS',
    showUri: !!values['show-uri'],
  }
}

const validateInput = (args, env) => {
  const errors = []
  if (!args.slug) errors.push('Which club? e.g. npm run db:new-club -- gvttc')
  if (args.slug && !/^[a-z][a-z0-9-]{1,30}$/.test(args.slug)) {
    errors.push('Club slug must be lowercase letters, digits and dashes')
  }
  if (!env.MONGODB_PROJECT_CREATOR_PUBLIC_KEY) {
    errors.push('MONGODB_PROJECT_CREATOR_PUBLIC_KEY is not set')
  }
  if (!env.MONGODB_PROJECT_CREATOR_PRIVATE_KEY) {
    errors.push('MONGODB_PROJECT_CREATOR_PRIVATE_KEY is not set')
  }
  if (!env.MONGODB_URI) {
    errors.push(
      'MONGODB_URI is not set (the existing cluster, for credentials and templates)',
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

// ==================== provisioning steps ====================

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

const seedDatabases = async ({ uri, sourceUri, sourceDb, databases }) => {
  if (!uri || !sourceUri) throwError('Both cluster URIs are required')

  const templates = await readTournamentTemplates(sourceUri, sourceDb)
  const client = new MongoClient(uri)
  await client.connect()
  const report = []
  try {
    for (const name of databases) {
      report.push(await seedOneDatabase(client.db(name), name, templates))
    }
  } finally {
    await client.close()
  }
  return { templates: templates.length, report }
}

const readTournamentTemplates = async (sourceUri, sourceDb) => {
  const client = new MongoClient(sourceUri)
  await client.connect()
  try {
    return await client
      .db(sourceDb)
      .collection('tournaments')
      .find({})
      .toArray()
  } finally {
    await client.close()
  }
}

const seedOneDatabase = async (db, name, templates) => {
  // Mongo creates a database lazily, so without an explicit createCollection
  // neither the database nor the collection exists until something writes.
  const existing = (await db.listCollections().toArray()).map((c) => c.name)
  if (!existing.includes('tournaments'))
    await db.createCollection('tournaments')

  const collection = db.collection('tournaments')
  const already = await collection.countDocuments()
  if (already > 0)
    return `${name}: ${already} tournament(s) already, left alone`
  if (templates.length === 0) return `${name}: created, no templates to copy`

  const result = await collection.insertMany(templates)
  return `${name}: created, ${result.insertedCount} tournament(s) copied`
}

// ==================== run ====================

const run = async () => {
  const args = parseArgs(process.argv.slice(2))
  validateInput(args, process.env)

  const credentials = readExistingCredentials(process.env.MONGODB_URI)
  const api = createAtlasClient({
    username: process.env.MONGODB_PROJECT_CREATOR_PUBLIC_KEY,
    password: process.env.MONGODB_PROJECT_CREATOR_PRIVATE_KEY,
  })

  const org = await getOrgId(api)
  console.log(`organization: ${org.name}`)

  const project = await findOrCreateProject(api, {
    name: args.slug,
    orgId: org.id,
  })
  console.log(
    `project:      ${args.slug} ${project.created ? '(created)' : '(existing)'}`,
  )

  const cluster = await findOrCreateCluster(api, {
    projectId: project.id,
    name: args.slug,
    provider: args.provider,
    region: args.region,
  })
  console.log(
    `cluster:      ${args.slug} M0 ${args.provider}/${args.region} ` +
      `${cluster.created ? '(created — this takes a minute)' : '(existing)'}`,
  )

  const ready = await waitForCluster(api, {
    projectId: project.id,
    name: args.slug,
  })
  const host = (ready.connectionStrings?.standardSrv || '').replace(
    'mongodb+srv://',
    '',
  )
  if (!host) throwError('Cluster is IDLE but reported no connection string')

  const user = await ensureDatabaseUser(api, {
    projectId: project.id,
    username: credentials.username,
    password: credentials.password,
  })
  console.log(
    `db user:      ${credentials.username} ${user.created ? '(created)' : '(existing)'}`,
  )

  const access = await ensureOpenAccessList(api, { projectId: project.id })
  console.log(
    `network:      0.0.0.0/0 ${access.created ? '(added)' : '(existing)'}`,
  )

  const { templates, report } = await seedDatabases({
    uri: buildUri(host, credentials),
    sourceUri: process.env.MONGODB_URI,
    sourceDb: args.sourceDb,
    databases: [args.slug, `${args.slug}-dev`],
  })
  console.log(`templates:    ${templates} found in ${args.sourceDb}`)
  for (const line of report) console.log(`              ${line}`)

  const uri = `mongodb+srv://${credentials.username}:${
    args.showUri ? credentials.password : '<password>'
  }@${host}/${args.slug}?retryWrites=true`
  console.log(
    `\nAdd to .env.${args.slug}:\n\n  CLUB=${args.slug}\n  MONGODB_URI=${uri}\n`,
  )
  console.log(
    'Then: clubs/' +
      args.slug +
      '/config.json for branding and tables, and the\n' +
      "same MONGODB_URI in that club's Netlify site (MONGODB_DB=" +
      args.slug +
      '-dev for a dev site).',
  )
}

run().catch((error) => {
  console.error(`\nFailed: ${error.message}`)
  process.exit(1)
})
