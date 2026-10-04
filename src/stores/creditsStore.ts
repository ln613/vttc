import { createStore } from 'solid-js/store'
import clubConfig from 'club-config'
import { apiGet, apiPost } from '../utils/api'
import { authState, authActions } from './authStore'
import { modulesActions } from './modulesStore'
import {
  bookingRules,
  isValidTopUp,
  topUpCredits,
} from '../../shared/rules/booking'

// A player's court-booking credits, and topping them up. Shared by the
// Account page (balance, Top up) and the Booking page (pay with credits, or
// top up when there are not enough). See specs/rules/booking.md.

export type TopUpStep = 'amount' | 'pay' | 'done'

interface CreditsState {
  balance: number | null
  paymentsAvailable: boolean
  loading: boolean
  error: string | null
  // The top-up dialog.
  topUpOpen: boolean
  topUpStep: TopUpStep
  dollars: string
  paymentId: string
  amountCents: number
  creditsBought: number
  busy: boolean
  topUpError: string | null
}

const getInitialState = (): CreditsState => ({
  balance: null,
  paymentsAvailable: false,
  loading: false,
  error: null,
  topUpOpen: false,
  topUpStep: 'amount',
  dollars: '',
  paymentId: '',
  amountCents: 0,
  creditsBought: 0,
  busy: false,
  topUpError: null,
})

const [creditsState, setCreditsState] = createStore<CreditsState>(getInitialState())

export { creditsState }

const rules = bookingRules(clubConfig.booking)

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback

// ==================== derived ====================

// The Credit module (specs/rules/modules.md): balances, top-ups, and paying
// for a booking with credits.
const isCreditOn = (): boolean => modulesActions.on('credit')

// A signed-in player with a player record: not a guest, not the tablet, and
// not the club-admin login, which has no player behind it.
const isPlayer = (): boolean =>
  authActions.hasPlayerRecord() && !authState.isTablet

// A player who books with credits; with Credit off, they pay by card.
const paysWithCredits = (): boolean => isPlayer() && isCreditOn()

// A player who has My Booking to go back to.
const hasMyBookings = (): boolean => isPlayer() && modulesActions.on('myBooking')

const dollarsValue = (): number => Number(creditsState.dollars)

const topUpPreviewCredits = (): number =>
  isValidTopUp(rules, dollarsValue()) ? topUpCredits(rules, dollarsValue()) : 0

// ==================== balance ====================

const fetchBalance = async () => {
  if (!paysWithCredits()) return
  setCreditsState({ loading: true, error: null })
  try {
    const data = await apiGet<{ credits: number; paymentsAvailable: boolean }>('myCredits')
    setCreditsState({ balance: data.credits, paymentsAvailable: data.paymentsAvailable, loading: false })
  } catch (err) {
    setCreditsState({ loading: false, error: errorMessage(err, 'Could not load your credits') })
  }
}

const setBalance = (balance: number) => setCreditsState('balance', balance)

// ==================== top up ====================

const openTopUp = () => {
  setCreditsState({
    topUpOpen: true,
    topUpStep: 'amount',
    dollars: String(rules.minTopUpDollars),
    paymentId: '',
    topUpError: null,
    busy: false,
  })
}

const closeTopUp = () => setCreditsState({ topUpOpen: false, topUpError: null })

const setDollars = (value: string) =>
  setCreditsState({ dollars: value.replace(/[^\d]/g, ''), topUpError: null })

interface TopUpResponse {
  paymentId: string
  amountCents: number
  credits: number
  paymentsAvailable: boolean
}

const startTopUp = async () => {
  if (!isValidTopUp(rules, dollarsValue())) {
    return setCreditsState('topUpError', `Top up at least $${rules.minTopUpDollars}, in whole dollars`)
  }
  setCreditsState({ busy: true, topUpError: null })
  try {
    const result = await apiPost<TopUpResponse>('topUpCredits', { dollars: dollarsValue() })
    setCreditsState({
      busy: false,
      topUpStep: 'pay',
      paymentId: result.paymentId,
      amountCents: result.amountCents,
      creditsBought: result.credits,
      paymentsAvailable: result.paymentsAvailable,
    })
  } catch (err) {
    setCreditsState({ busy: false, topUpError: errorMessage(err, 'Could not start the top-up') })
  }
}

const payTopUp = async () => {
  setCreditsState({ busy: true, topUpError: null })
  try {
    const result = await apiPost<{ balance: number }>('confirmPayment', {
      paymentId: creditsState.paymentId,
    })
    setCreditsState({ busy: false, topUpStep: 'done', balance: result.balance })
  } catch (err) {
    setCreditsState({ busy: false, topUpError: errorMessage(err, 'Payment failed') })
  }
}

const reset = () => setCreditsState(getInitialState())

export const creditsActions = {
  isCreditOn,
  paysWithCredits,
  hasMyBookings,
  isPlayer,
  topUpPreviewCredits,
  fetchBalance,
  setBalance,
  openTopUp,
  closeTopUp,
  setDollars,
  startTopUp,
  payTopUp,
  reset,
  rules: () => rules,
}
