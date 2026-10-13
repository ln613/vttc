import { apiPost } from './api'
import { langState } from '../stores/langStore'

// How the browser takes a card for a payment — see
// netlify/functions/utils/payments.js (checkoutFor). Moneris: its own card
// form, opened with the payment's ticket. Placeholder: the "Simulate
// payment" button (local development only). None: no online payment.
export interface PaymentCheckout {
  provider: 'moneris' | 'placeholder' | 'none'
  ticket?: string
  environment?: 'qa' | 'prod'
  scriptUrl?: string
}

export const NO_CHECKOUT: PaymentCheckout = { provider: 'none' }

/** The card form's language, as far as Moneris has it (English or French). */
export const paymentLanguage = (): string => langState.lang

/** A fresh card form for a payment after a decline or a form left. */
export const renewPaymentTicket = (paymentId: string) =>
  apiPost<{ paymentId: string; checkout: PaymentCheckout }>('renewPaymentTicket', {
    paymentId,
    language: paymentLanguage(),
  })

// ==================== Moneris Checkout ====================

// The pieces of Moneris's checkout script (chkt_v2.00.js) used here.
interface MonerisCheckoutInstance {
  setMode: (mode: string) => void
  setCheckoutDiv: (id: string) => void
  setCallback: (event: string, handler: (data: string) => void) => void
  startCheckout: (ticket: string) => void
  closeCheckout: (ticket?: string) => void
}

declare global {
  interface Window {
    monerisCheckout?: new () => MonerisCheckoutInstance
  }
}

const loadedScripts = new Map<string, Promise<void>>()

// Moneris's script, loaded once per address.
const loadScript = (url: string): Promise<void> => {
  const known = loadedScripts.get(url)
  if (known) return known
  const loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = url
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      loadedScripts.delete(url)
      reject(new Error('The card form could not be loaded'))
    }
    document.head.appendChild(script)
  })
  loadedScripts.set(url, loading)
  return loading
}

// Moneris hands each callback a JSON string; anything unreadable counts as
// an empty message.
const parseEvent = (data: unknown): { response_code?: string } => {
  if (typeof data !== 'string') return (data as object) || {}
  try {
    return JSON.parse(data)
  } catch {
    return {}
  }
}

export interface MonerisHandlers {
  // The form finished (paid, or the buyer gave up after a decline): the
  // server checks the receipt to know which.
  onComplete: () => void
  onCancel: () => void
  onError: (message: string) => void
}

/**
 * Open Moneris's card form in the element with id `divId`. Returns a close
 * function for when the page moves on.
 */
export const openMonerisCheckout = async (
  divId: string,
  checkout: PaymentCheckout,
  handlers: MonerisHandlers,
): Promise<() => void> => {
  if (!checkout.ticket || !checkout.scriptUrl) {
    throw new Error('This payment has no card form')
  }
  await loadScript(checkout.scriptUrl)
  const Checkout = window.monerisCheckout
  if (!Checkout) throw new Error('The card form could not be loaded')

  const form = new Checkout()
  form.setMode(checkout.environment === 'prod' ? 'prod' : 'qa')
  form.setCheckoutDiv(divId)
  form.setCallback('page_loaded', (data) => {
    // "001" is a form ready to use; anything else is a form that failed.
    const code = parseEvent(data).response_code
    if (code && code !== '001') handlers.onError(`The card form could not start (${code})`)
  })
  form.setCallback('cancel_transaction', () => handlers.onCancel())
  form.setCallback('error_event', () => handlers.onError('The card form ran into a problem'))
  form.setCallback('payment_receipt', () => undefined)
  form.setCallback('payment_complete', () => handlers.onComplete())
  form.startCheckout(checkout.ticket)

  return () => {
    try {
      form.closeCheckout(checkout.ticket)
    } catch {
      // already closed
    }
  }
}
