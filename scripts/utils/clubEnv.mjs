// Resolving which cluster a club lives on, for scripts that work against a
// club database directly. Each club has its own Atlas cluster, so the name
// alone is never enough — .env.<club> has to win over the shared .env, the
// same layering scripts/with-club.mjs applies to the dev server.
import { existsSync, readFileSync } from 'node:fs'

const throwError = (message) => {
  throw new Error(message)
}

export const parseEnvFile = (path) => {
  if (!path) throwError('Env file path is required')
  if (!existsSync(path)) return {}

  const entries = readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const at = line.indexOf('=')
      return [line.slice(0, at).trim(), stripQuotes(line.slice(at + 1).trim())]
    })
  return Object.fromEntries(entries)
}

const stripQuotes = (value) =>
  (value.startsWith('"') && value.endsWith('"')) ||
  (value.startsWith("'") && value.endsWith("'"))
    ? value.slice(1, -1)
    : value

export const resolveClubTarget = (club) => {
  if (!club) throwError('Club is required')

  const clubEnv = parseEnvFile(`.env.${club}`)
  const uri = clubEnv.MONGODB_URI || process.env.MONGODB_URI
  if (!uri)
    throwError(
      `No MONGODB_URI for "${club}" — add .env.${club} or set it in .env`,
    )

  return {
    uri,
    dbName: clubEnv.MONGODB_DB || process.env.MONGODB_DB || club,
  }
}
