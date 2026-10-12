import { getDB } from './db.js'
import { club } from './club.js'
import { isSmsConfigured } from './sms.js'
import { getGoogleClientId } from './googleAuth.js'
import { DEFAULT_BOOKING, bookingHoursError } from '../../../shared/rules/booking.js'
import {
  DEFAULT_TOP_UP_OPTIONS,
  isPointsModel,
  sortTopUpOptions,
  topUpOptionsError,
} from '../../../shared/rules/wallet.js'

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
  // match. Off unless the club config turns it on.
  allowPublicUmpire: !!club.allowPublicUmpire,
  // Human umpires — see specs/rules/umpires.md. Off by default: a club
  // that does not track who umpired should not be asked about it.
  saveUmpireInfo: !!club.saveUmpireInfo,
  maxUmpiresPerTable: club.maxUmpiresPerTable ?? 1,
  // Court booking hours ("HH:MM", "24:00" = midnight) — see
  // specs/rules/booking.md. The club config's are the default.
  bookingOpenTime: club.booking?.openTime || DEFAULT_BOOKING.openTime,
  bookingCloseTime: club.booking?.closeTime || DEFAULT_BOOKING.closeTime,
  // The top-up amounts a points club offers, with their reward points —
  // see specs/rules/wallet.md. Unused by a credits club.
  topUpOptions: DEFAULT_TOP_UP_OPTIONS,
})

const throwError = (msg) => {
  throw new Error(msg)
}

const readSettingsDoc = async () => {
  const db = getDB()
  const doc = await db.collection(COLLECTION).findOne({ docId: DOC_ID })
  return { ...defaultSettings(), ...(doc?.settings || {}) }
}

// Along with the stored settings, two things that are not settings but facts
// about this site's environment, which saveSettings never stores:
//   smsEnabled      it can text a verification code (sms.js)
//   googleClientId  "Sign in with Google" is set up (googleAuth.js). Public
//                   by nature — the browser needs it to show the button.
export const getSettings = async () => ({
  ...(await readSettingsDoc()),
  smsEnabled: isSmsConfigured(),
  googleClientId: getGoogleClientId(),
})

// The top-up amounts on offer (points model), smallest first.
export const getTopUpOptions = async () =>
  sortTopUpOptions((await readSettingsDoc()).topUpOptions)

// The court's opening hours as the booking rules want them.
export const getBookingHours = async () => {
  const s = await readSettingsDoc()
  return { openTime: s.bookingOpenTime, closeTime: s.bookingCloseTime }
}

const validateBookingHours = (settings) => {
  const error = bookingHoursError(
    { ...club.booking },
    settings.bookingOpenTime,
    settings.bookingCloseTime,
  )
  if (error) throwError(error)
}

export const saveSettings = async (body) => {
  if (!body) throwError('Request body is required')
  const defaults = defaultSettings()
  const allowedKeys = Object.keys(defaults)
  const settings = {}
  for (const k of allowedKeys) {
    if (k in body) settings[k] = body[k]
  }
  validateBookingHours({ ...defaults, ...settings })
  if (isPointsModel(club) && 'topUpOptions' in settings) {
    const error = topUpOptionsError(settings.topUpOptions)
    if (error) throwError(error)
    settings.topUpOptions = sortTopUpOptions(settings.topUpOptions)
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
