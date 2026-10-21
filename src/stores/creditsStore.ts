import { createStore } from 'solid-js/store'
import type { TaxLine } from '../../shared/rules/tax'
import clubConfig from 'club-config'
import { apiGet, apiPost } from '../utils/api'
import { authState, authActions } from './authStore'
import { modulesActions } from './modulesStore'
import { langActions } from './langStore'
import {
  bookingRules,
  isValidTopUp,
  topUpCredits,
} from '../../shared/rules/booking'
import {
  DEFAULT_TOP_UP_OPTIONS,
  findTopUpOption,
  sortTopUpOptions,
  type TopUpOption,
} from '../../shared/rules/wallet'
import { pointsModel } from '../i18n/wallet'
import {
  NO_CHECKOUT,
  paymentLanguage,
  renewPaymentTicket,
  type PaymentCheckout,
} from '../utils/payment'

// A player's court-booking balance, and topping it up. Shared by the
// Account page (balance, Top up) and the Booking page (pay from the
// balance, or top up when there is not enough). See specs/rules/booking.md
// and, for the two ways a club can run it, specs/rules/wallet.md.

export type TopUpStep = 'amount' | 'pay' | 'done'

// A paid top-up, for the history under the balance.
export interface TopUpRecord {
  _id: string
  paidAt: string
  amountCents: number
  subtotalCents: number
  taxes: TaxLine[]
  credits: number
  points: number
  cardType: string | null
  last4: string | null
}

interface CreditsState {
  balance: number | null
  // Reward points (points model): only ever redeemed for gifts.
  points: number | null
  // The amounts a points club offers, from its settings.
  topUpOptions: TopUpOption[]
  paymentsAvailable: boolean
  loading: boolean
  error: string | null
  // The top-up dialog.
  topUpOpen: boolean
  topUpStep: TopUpStep
  dollars: string
  paymentId: string
  amountCents: number
  // The card amount's breakdown when the club charges tax.
  subtotalCents: number
  taxes: TaxLine[]
  // How the card is taken (Moneris's form, or the placeholder).
  checkout: PaymentCheckout
  creditsBought: number
  pointsEarned: number
  // Where the top-up's receipt was emailed.
  receiptSentTo: string | null
  busy: boolean
  topUpError: string | null
  // The player's paid top-ups, newest first.
  topUps: TopUpRecord[]
  topUpsLoaded: boolean
}

const getInitialState = (): CreditsState => ({
  balance: null,
  points: null,
  topUpOptions: DEFAULT_TOP_UP_OPTIONS,
  paymentsAvailable: false,
  loading: false,
  error: null,
  topUpOpen: false,
  topUpStep: 'amount',
  dollars: '',
  paymentId: '',
  amountCents: 0,
  subtotalCents: 0,
  taxes: [],
  checkout: NO_CHECKOUT,
  creditsBought: 0,
  pointsEarned: 0,
  receiptSentTo: null,
  busy: false,
  topUpError: null,
  topUps: [],
  topUpsLoaded: false,
})

const [creditsState, setCreditsState] =
  createStore<CreditsState>(getInitialState())

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
const hasMyBookings = (): boolean =>
  isPlayer() && modulesActions.on('myBooking')

const dollarsValue = (): number => Number(creditsState.dollars)

const topUpPreviewCredits = (): number =>
  isValidTopUp(rules, dollarsValue()) ? topUpCredits(rules, dollarsValue()) : 0

// A points club tops up by one of its offered amounts.
const isValidAmount = (): boolean =>
  pointsModel
    ? !!findTopUpOption(creditsState.topUpOptions, dollarsValue())
    : isValidTopUp(rules, dollarsValue())

const isChosenOption = (option: TopUpOption): boolean =>
  dollarsValue() === option.dollars

// ==================== balance ====================

const fetchBalance = async () => {
  if (!paysWithCredits()) return
  setCreditsState({ loading: true, error: null })
  try {
    const data = await apiGet<{
      credits: number
      points: number
      paymentsAvailable: boolean
    }>('myCredits')
    setCreditsState({
      balance: data.credits,
      points: data.points ?? 0,
      paymentsAvailable: data.paymentsAvailable,
      loading: false,
    })
  } catch (err) {
    setCreditsState({
      loading: false,
      error: errorMessage(err, 'Could not load your credits'),
    })
  }
}

const setBalance = (balance: number) => setCreditsState('balance', balance)

const fetchTopUps = async () => {
  if (!paysWithCredits()) return
  try {
    const topUps = await apiGet<TopUpRecord[]>('myTopUps')
    setCreditsState({ topUps, topUpsLoaded: true })
  } catch {
    // The history is a convenience; the balance above it still shows.
    setCreditsState({ topUpsLoaded: true })
  }
}

// ==================== top up ====================

const openTopUp = () => {
  setCreditsState({
    topUpOpen: true,
    topUpStep: 'amount',
    dollars: String(
      pointsModel
        ? (creditsState.topUpOptions[0]?.dollars ?? '')
        : rules.minTopUpDollars,
    ),
    paymentId: '',
    receiptSentTo: null,
    topUpError: null,
    busy: false,
  })
  if (pointsModel) void fetchTopUpOptions()
}

// The amounts on offer live in the club's settings, which an admin can
// change, so they are read each time the dialog opens.
const fetchTopUpOptions = async () => {
  try {
    const settings = await apiGet<{ topUpOptions?: TopUpOption[] }>('settings')
    const options = sortTopUpOptions(settings.topUpOptions ?? [])
    if (!options.length) return
    setCreditsState({ topUpOptions: options })
    if (!findTopUpOption(options, dollarsValue())) {
      setCreditsState({ dollars: String(options[0].dollars) })
    }
  } catch {
    // Keep the defaults; the server checks the amount anyway.
  }
}

const chooseOption = (option: TopUpOption) =>
  setCreditsState({ dollars: String(option.dollars), topUpError: null })

const closeTopUp = () => setCreditsState({ topUpOpen: false, topUpError: null })

const setDollars = (value: string) =>
  setCreditsState({ dollars: value.replace(/[^\d]/g, ''), topUpError: null })

interface TopUpResponse {
  paymentId: string
  amountCents: number
  subtotalCents?: number
  taxes?: TaxLine[]
  credits: number
  points?: number
  paymentsAvailable: boolean
  checkout?: PaymentCheckout
}

const startTopUp = async () => {
  if (!isValidAmount()) {
    return setCreditsState(
      'topUpError',
      langActions.t('topUp.minimum', { min: rules.minTopUpDollars }),
    )
  }
  setCreditsState({ busy: true, topUpError: null })
  try {
    const result = await apiPost<TopUpResponse>('topUpCredits', {
      dollars: dollarsValue(),
      language: paymentLanguage(),
    })
    setCreditsState({
      busy: false,
      topUpStep: 'pay',
      paymentId: result.paymentId,
      amountCents: result.amountCents,
      subtotalCents: result.subtotalCents ?? result.amountCents,
      taxes: result.taxes ?? [],
      creditsBought: result.credits,
      pointsEarned: result.points ?? 0,
      paymentsAvailable: result.paymentsAvailable,
      checkout: result.checkout ?? NO_CHECKOUT,
    })
  } catch (err) {
    setCreditsState({
      busy: false,
      topUpError: errorMessage(err, 'Could not start the top-up'),
    })
  }
}

// `completing`: called because an earlier card form turned out to be paid.
const payTopUp = async (completing = false) => {
  setCreditsState({ busy: true, topUpError: null })
  try {
    const result = await apiPost<{
      balance: number
      points?: number
      receiptSentTo?: string | null
    }>('confirmPayment', { paymentId: creditsState.paymentId })
    setCreditsState({
      busy: false,
      topUpStep: 'done',
      balance: result.balance,
      receiptSentTo: result.receiptSentTo ?? null,
      ...(result.points != null ? { points: result.points } : {}),
    })
    void fetchTopUps()
  } catch (err) {
    setCreditsState({
      busy: false,
      topUpError: errorMessage(err, 'Payment failed'),
    })
    await offerNewCardForm(undefined, completing)
  }
}

// The card form said something went wrong: say so, and open a fresh one.
// `detail` is what Moneris reported, kept on the payment's record.
const cardError = async (message: string, detail?: string) => {
  setCreditsState('topUpError', message)
  await offerNewCardForm(detail || message)
}

// After a decline or a broken form, Moneris needs a new ticket for the same
// payment. The placeholder has nothing to renew. If an earlier form did
// take the card after all, the payment is completed instead — once, so a
// payment the server won't complete can't loop.
const offerNewCardForm = async (reason?: string, completing = false) => {
  if (creditsState.checkout.provider !== 'moneris') return
  try {
    const renewed = await renewPaymentTicket(creditsState.paymentId, reason)
    if (renewed.paid && !completing) return await payTopUp(true)
    if (renewed.checkout) setCreditsState('checkout', renewed.checkout)
  } catch (err) {
    setCreditsState('topUpError', errorMessage(err, 'Payment failed'))
  }
}

const reset = () => setCreditsState(getInitialState())

export const creditsActions = {
  cardError,
  isCreditOn,
  paysWithCredits,
  hasMyBookings,
  isPlayer,
  topUpPreviewCredits,
  isChosenOption,
  chooseOption,
  fetchBalance,
  fetchTopUps,
  setBalance,
  openTopUp,
  closeTopUp,
  setDollars,
  startTopUp,
  payTopUp,
  reset,
  rules: () => rules,
}
