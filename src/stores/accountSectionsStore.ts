import { createStore } from 'solid-js/store'
import { myBookingsActions } from './myBookingsStore'

// Which sections of the Account page are open. Profile starts open; My
// Bookings loads its list each time it is opened. See specs/pages/Account.md.

export type AccountSection = 'profile' | 'credits' | 'myBookings'

type SectionsState = Record<AccountSection, boolean>

const getInitialState = (): SectionsState => ({
  profile: true,
  credits: false,
  myBookings: false,
})

const [accountSectionsState, setAccountSectionsState] =
  createStore<SectionsState>(getInitialState())

export { accountSectionsState }

const isAccountSection = (value: unknown): value is AccountSection =>
  typeof value === 'string' && value in getInitialState()

const open = (section: AccountSection) => {
  setAccountSectionsState(section, true)
  if (section === 'myBookings') void myBookingsActions.init()
}

const toggle = (section: AccountSection) => {
  if (accountSectionsState[section]) setAccountSectionsState(section, false)
  else open(section)
}

// The page opened at a section (`/account?open=myBookings`, from the
// booking confirmation): only that one open, so it is in view on a phone.
const init = (requested?: unknown) => {
  setAccountSectionsState(getInitialState())
  if (!isAccountSection(requested)) return
  setAccountSectionsState('profile', false)
  open(requested)
}

const reset = () => {
  setAccountSectionsState(getInitialState())
  myBookingsActions.reset()
}

export const accountSectionsActions = { init, toggle, reset }
