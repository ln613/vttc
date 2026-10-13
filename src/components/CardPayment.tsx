import { Show, onMount, onCleanup } from 'solid-js'
import { formatDollars } from '../../shared/rules/booking'
import { langActions } from '../stores/langStore'
import { openMonerisCheckout, type PaymentCheckout } from '../utils/payment'
import '../pages/booking.css'

const t = langActions.t

// The payment step of a guest booking and of a top-up: the amount, then the
// card. With Moneris (netlify/functions/utils/payments.js) that is Moneris's
// own card form embedded here; card details go to Moneris, never to us.
// Without it, only where the site allows the placeholder
// (PAYMENTS_MODE=placeholder), a button completes the payment with no card,
// for testing; elsewhere it says online payment isn't available. Styled by
// booking.css, so it takes the look of whichever page opens it.
const CardPayment = (props: {
  amountCents: number
  checkout: PaymentCheckout
  available: boolean
  busy: boolean
  // The placeholder's button, or Moneris's form reporting it finished.
  onPay: () => void
  onBack: () => void
  onCardError: (message: string) => void
}) => (
  <div style={{ display: 'flex', 'flex-direction': 'column', gap: '12px' }}>
    <div class="bk-pay-amount">
      <span>{t('payment.amountToPay')}</span>
      <span class="bk-price">{formatDollars(props.amountCents)}</span>
    </div>
    <Show
      when={props.checkout.provider === 'moneris' && props.checkout.ticket}
      fallback={<PlaceholderPayment {...props} />}
    >
      {(ticket) => (
        <>
          <Show when={props.busy}>
            <p class="bk-note" style={{ 'text-align': 'center' }}>
              {t('payment.checking')}
            </p>
          </Show>
          {/* Keyed on the ticket: a new card form (after a decline) is a
              fresh mount, so Moneris starts over cleanly. */}
          <Show when={ticket()} keyed>
            {(current) => (
              <MonerisForm
                ticket={current}
                checkout={props.checkout}
                onComplete={props.onPay}
                onCancel={props.onBack}
                onError={props.onCardError}
              />
            )}
          </Show>
          <p class="bk-note" style={{ 'text-align': 'center' }}>
            {t('payment.secure')}
          </p>
          <div class="bk-actions">
            <button
              type="button"
              class="bk-btn bk-btn-secondary bk-btn-fill"
              onClick={() => props.onBack()}
              disabled={props.busy}
            >
              {t('common.back')}
            </button>
          </div>
        </>
      )}
    </Show>
  </div>
)

// Moneris's card form, in a box of its own. Opened when shown, closed when
// the payment step goes away.
const MonerisForm = (props: {
  ticket: string
  checkout: PaymentCheckout
  onComplete: () => void
  onCancel: () => void
  onError: (message: string) => void
}) => {
  const divId = `moneris-checkout-${props.ticket}`
  let close: () => void = () => undefined
  onMount(() => {
    openMonerisCheckout(divId, props.checkout, {
      onComplete: () => props.onComplete(),
      onCancel: () => props.onCancel(),
      onError: (message) => props.onError(message),
    })
      .then((closeForm) => (close = closeForm))
      .catch((err: unknown) =>
        props.onError(err instanceof Error ? err.message : t('payment.formFailed')),
      )
  })
  onCleanup(() => close())
  return <div id={divId} class="bk-card-form" />
}

const PlaceholderPayment = (props: {
  available: boolean
  busy: boolean
  onPay: () => void
  onBack: () => void
}) => (
  <>
    <div class="bk-pay-card">
      <strong>{t('payment.cardTitle')}</strong>
      <span>{t('payment.comingSoon')}</span>
    </div>
    <Show
      when={props.available}
      fallback={
        <div class="bk-pay-unavailable">{t('payment.unavailable')}</div>
      }
    >
      <p class="bk-note" style={{ 'text-align': 'center' }}>
        {t('payment.testMode')}
      </p>
    </Show>
    <div class="bk-actions">
      <button
        type="button"
        class="bk-btn bk-btn-secondary bk-btn-fill"
        onClick={() => props.onBack()}
        disabled={props.busy}
      >
        {t('common.back')}
      </button>
      <Show when={props.available}>
        <button
          type="button"
          class="bk-btn bk-btn-primary bk-btn-fill"
          onClick={() => props.onPay()}
          disabled={props.busy}
        >
          {props.busy ? t('payment.paying') : t('payment.simulate')}
        </button>
      </Show>
    </div>
  </>
)

export default CardPayment
