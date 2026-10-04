import { Show, type JSX } from 'solid-js'
import Button from './Button'
import { formatDollars } from '../../shared/rules/booking'

// Where the card payment will go once Stripe is connected. Until then it
// says so plainly, and — only where the site allows the placeholder
// (PAYMENTS_MODE=placeholder, see netlify/functions/utils/payments.js) —
// offers to complete the payment without a card, for testing.
const PaymentPlaceholder = (props: {
  amountCents: number
  available: boolean
  busy: boolean
  onPay: () => void
  onBack: () => void
}) => (
  <div style={boxStyle}>
    <div style={amountRowStyle}>
      <span>Amount to pay</span>
      <strong style={amountStyle}>{formatDollars(props.amountCents)}</strong>
    </div>
    <div style={cardAreaStyle}>
      <strong>Card payment (Stripe)</strong>
      <span>Card payments are coming soon.</span>
    </div>
    <Show
      when={props.available}
      fallback={<div style={unavailableStyle}>Online payment is not available yet. Please pay at the club.</div>}
    >
      <div style={testNoteStyle}>Test mode: no card is charged.</div>
    </Show>
    <div style={actionsStyle}>
      <Button color="#888" onClick={props.onBack} disabled={props.busy}>
        Back
      </Button>
      <Show when={props.available}>
        <Button color="#27ae60" onClick={props.onPay} disabled={props.busy}>
          {props.busy ? 'Paying...' : 'Simulate payment'}
        </Button>
      </Show>
    </div>
  </div>
)

const boxStyle: JSX.CSSProperties = { display: 'flex', 'flex-direction': 'column', gap: '12px' }

const amountRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'space-between',
  'align-items': 'baseline',
  'font-size': '15px',
  color: '#333',
}

const amountStyle: JSX.CSSProperties = { 'font-size': '22px' }

const cardAreaStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '4px',
  padding: '16px',
  border: '2px dashed #c9d3dd',
  'border-radius': '10px',
  color: '#555',
  'font-size': '14px',
  'text-align': 'center',
}

const testNoteStyle: JSX.CSSProperties = { 'font-size': '13px', color: '#777', 'text-align': 'center' }

const unavailableStyle: JSX.CSSProperties = {
  'font-size': '14px',
  color: '#e67e22',
  'text-align': 'center',
  padding: '8px 12px',
  'background-color': '#fef9e7',
  'border-radius': '6px',
}

const actionsStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'center',
  gap: '12px',
  'margin-top': '4px',
}

export default PaymentPlaceholder
