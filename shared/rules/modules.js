// Which parts of the app a club uses — see specs/rules/modules.md. A super
// admin turns them on and off on the Modules page; the server and the
// browser both read them through the rules below, so they agree on what a
// switch means.
//
//   required          always on
//   requiredWhen: X   on whenever X is on
//
// A module is only in effect when every module above it is: turning
// Tournament off turns off Events, Players, Live Score and the rest, without
// losing what each of them was set to.

export const MODULES = [
  {
    key: 'tournament',
    label: 'Tournament',
    children: [
      { key: 'events', label: 'Events', required: true },
      { key: 'players', label: 'Players', required: true },
      { key: 'gamePlay', label: 'Game Play', required: true },
      { key: 'liveScore', label: 'Live Score' },
      { key: 'schedule', label: 'Schedule' },
    ],
  },
  {
    key: 'booking',
    label: 'Booking',
    children: [{ key: 'calendar', label: 'Calendar' }],
  },
  {
    key: 'account',
    label: 'Account',
    required: true,
    children: [
      {
        key: 'profile',
        label: 'Profile',
        required: true,
        children: [
          { key: 'rating', label: 'Rating', requiredWhen: 'tournament' },
        ],
      },
      { key: 'credit', label: 'Credit' },
      { key: 'myBooking', label: 'My Booking', requiredWhen: 'booking' },
    ],
  },
]

// Every module at every level, each with the key of the one above it.
const flatten = (modules, parent) =>
  modules.flatMap((m) => [
    { ...m, parent },
    ...flatten(m.children || [], m.key),
  ])

const allModules = () => flatten(MODULES, null)

export const moduleKeys = () => allModules().map((m) => m.key)

const findModule = (key) => allModules().find((m) => m.key === key)

// Before a super admin has saved anything: everything on, except Booking,
// which follows the club config (`booking.enabled`) — a club without a
// court to book never sees it.
export const defaultModules = (clubConfig) => {
  const modules = Object.fromEntries(moduleKeys().map((key) => [key, true]))
  modules.booking = !!clubConfig?.booking?.enabled
  return modules
}

// Why a module's switch can't be changed right now, or null when it can.
export const moduleLockReason = (modules, key) => {
  const m = findModule(key)
  if (!m) return null
  if (m.required) return 'Always on'
  if (m.requiredWhen && modules[m.requiredWhen]) {
    return `Required while ${findModule(m.requiredWhen).label} is on`
  }
  return null
}

/**
 * The saved switches made whole and consistent: unknown keys dropped,
 * missing ones from the defaults, and every lock applied.
 */
export const normalizeModules = (stored, clubConfig) => {
  const modules = defaultModules(clubConfig)
  for (const key of moduleKeys()) {
    if (typeof stored?.[key] === 'boolean') modules[key] = stored[key]
  }
  for (const m of allModules()) {
    if (moduleLockReason(modules, m.key)) modules[m.key] = true
  }
  return modules
}

// Whether a module is in effect: its own switch, and every one above it.
export const isModuleOn = (modules, key) => {
  const m = findModule(key)
  if (!m || !modules?.[key]) return false
  return m.parent ? isModuleOn(modules, m.parent) : true
}

// The nearest module above this one that is switched off, if any.
export const offAncestor = (modules, key) => {
  const parent = findModule(key)?.parent
  if (!parent) return null
  return modules?.[parent] ? offAncestor(modules, parent) : findModule(parent)
}
