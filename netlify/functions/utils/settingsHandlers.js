import { getDB } from './db.js'
import { club } from './club.js'

const COLLECTION = 'settings'
const DOC_ID = 'global'

// A function, not a constant: tabletMirrorEnabled's default is whatever the
// club config says, so it cannot be baked in at module load of a shared
// object that is then spread into responses.
const defaultSettings = () => ({
  // When true, unpaid participants are excluded from generating
  // groups / round-robin / first-round knockout (when no group stage
  // exists). When false, they are included.
  ignoreUnpaidInGeneration: true,
  // Two tablets on one table — see specs/rules/tablet mirror.md. The club
  // config supplies the default; an admin can change it for the club, and
  // the value is copied onto each event as it is created.
  tabletMirrorEnabled: !!club.tabletMirrorEnabled,
  // Whether the match-day password lets someone without an account score a
  // match. Absent from the club config means allowed, which is how the app
  // behaved before this could be turned off.
  allowPublicUmpire: club.allowPublicUmpire !== false,
  // Human umpires — see specs/rules/umpires.md. Off by default: a club
  // that does not track who umpired should not be asked about it.
  saveUmpireInfo: !!club.saveUmpireInfo,
  maxUmpiresPerTable: club.maxUmpiresPerTable ?? 1,
})

const throwError = (msg) => {
  throw new Error(msg)
}

const readSettingsDoc = async () => {
  const db = getDB()
  const doc = await db.collection(COLLECTION).findOne({ docId: DOC_ID })
  return { ...defaultSettings(), ...(doc?.settings || {}) }
}

export const getSettings = async () => readSettingsDoc()

export const saveSettings = async (body) => {
  if (!body) throwError('Request body is required')
  const defaults = defaultSettings()
  const allowedKeys = Object.keys(defaults)
  const settings = {}
  for (const k of allowedKeys) {
    if (k in body) settings[k] = body[k]
  }
  const db = getDB()
  await db.collection(COLLECTION).updateOne(
    { docId: DOC_ID },
    {
      $set: {
        docId: DOC_ID,
        settings: { ...defaults, ...settings },
        updatedAt: new Date().toISOString(),
      },
    },
    { upsert: true },
  )
  return { success: true, settings: { ...defaults, ...settings } }
}
