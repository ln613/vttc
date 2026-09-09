import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// The club this deployment serves. One club per deployment: each has its own
// database, Pusher app and Netlify account, so there is nothing to switch at
// request time. `CLUB` picks which clubs/<slug>/config.json is loaded.
//
// Read once at module load — the file ships with the function bundle via the
// `included_files` entry in netlify.toml, and it cannot change without a
// redeploy anyway.
const CLUB_SLUG = process.env.CLUB || 'vttc'

// Where clubs/ might be, depending on how this module is being run.
// Netlify bundles functions to CommonJS, so `import.meta.url` is undefined
// there and resolving against it throws; under `node --env-file` it is a
// real file URL. The bundled function is served from the repo root, and
// netlify.toml's included_files puts clubs/ alongside it, so cwd covers
// both dev and deployed.
const configCandidates = (slug) => {
  const relative = join('clubs', slug, 'config.json')
  const paths = [join(process.cwd(), relative)]

  let here
  try {
    here = dirname(fileURLToPath(import.meta.url))
  } catch {
    here = typeof __dirname === 'string' ? __dirname : undefined
  }
  if (here) {
    paths.push(join(here, '..', '..', '..', relative))
    paths.push(join(here, relative))
  }
  return paths
}

const loadConfig = (slug) => {
  const candidates = configCandidates(slug)
  const found = candidates.find((path) => existsSync(path))
  if (!found) {
    throw new Error(
      `Club "${slug}" has no clubs/${slug}/config.json. Looked in:\n  ` +
        `${candidates.join('\n  ')}\n` +
        'Check the CLUB environment variable, and that netlify.toml still ' +
        'lists clubs/**/*.json under [functions] included_files.',
    )
  }
  try {
    return JSON.parse(readFileSync(found, 'utf8'))
  } catch (err) {
    throw new Error(`Club "${slug}" config at ${found} is unreadable: ${err.message}`)
  }
}

export const club = loadConfig(CLUB_SLUG)

// An env var still wins for the timezone: it was configurable before this
// file existed and some deployments set it directly.
export const getClubTimezone = () =>
  process.env.CLUB_TIMEZONE || club.timezone || 'America/Vancouver'

export const getTableConfig = () => club.tables

// Does an event match one of a tier's rules? Each rule is a set of
// conditions that must all hold, so the tier lists read as "any of these".
const eventMatchesTierRule = (event, rule) => {
  if (rule.type && event.type !== rule.type) return false
  if (rule.restriction && event.restriction !== rule.restriction) return false
  if (rule.ageLimitType && event.ageLimitType !== rule.ageLimitType) return false
  if (rule.ratingLimitMax != null) {
    if (event.ratingLimit == null || event.ratingLimit > rule.ratingLimitMax) {
      return false
    }
  }
  if (rule.ratingLimitMin != null) {
    if (event.ratingLimit == null || event.ratingLimit < rule.ratingLimitMin) {
      return false
    }
  }
  if (rule.ageLimitMax != null) {
    if (event.ageLimit == null || event.ageLimit > rule.ageLimitMax) return false
  }
  if (rule.ageLimitMin != null) {
    if (event.ageLimit == null || event.ageLimit < rule.ageLimitMin) return false
  }
  return true
}

export const eventIsInTier = (event, tier) => {
  if (!event) return false
  const rules = club.tiers?.[tier] || []
  return rules.some((rule) => eventMatchesTierRule(event, rule))
}
