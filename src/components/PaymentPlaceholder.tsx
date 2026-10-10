import { Show } from 'solid-js'
import { formatDollars } from '../../shared/rules/booking'
import { langActions } from '../stores/langStore'
import '../pages/booking.css'

const t = langActions.t

// Where the card payment will go once Stripe is connected. Until then it
// says so plainly, and — only where the site allows the placeholder
// (PAYMENTS_MODE=placeholder, see netlify/functions/utils/payments.js) —
// offers to complete the payment without a card, for testing. Styled by
// booking.css, so it takes the look of whichever page opens it.
const PaymentPlaceholder = (props: {
  amountCents: number
  available: boolean
  busy: boolean
  onPay: () => void
  onBack: () => void
}) => (
  <div style={{ display: 'flex', 'flex-direction': 'column', gap: '12px' }}>
    <div class="bk-pay-amount">
      <span>{t('payment.amountToPay')}</span>
      <span class="bk-price">{formatDollars(props.amountCents)}</span>
    </div>
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
  </div>
)

export default PaymentPlaceholder
