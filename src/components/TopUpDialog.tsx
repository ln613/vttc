import { Show, Switch, Match, type JSX } from 'solid-js'
import Input from './Input'
import Button from './Button'
import PaymentPlaceholder from './PaymentPlaceholder'
import { creditsState, creditsActions } from '../stores/creditsStore'
import { formatCredits } from '../../shared/rules/booking'

// Top up court-booking credits: an amount in dollars, then payment.
const TopUpDialog = () => (
  <Show when={creditsState.topUpOpen}>
    <div style={overlayStyle} onClick={creditsActions.closeTopUp}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={titleStyle}>Top up credits</h2>
        <Switch>
          <Match when={creditsState.topUpStep === 'amount'}>
            <AmountStep />
          </Match>
          <Match when={creditsState.topUpStep === 'pay'}>
            <PaymentPlaceholder
              amountCents={creditsState.amountCents}
              available={creditsState.paymentsAvailable}
              busy={creditsState.busy}
              onPay={creditsActions.payTopUp}
              onBack={creditsActions.closeTopUp}
            />
          </Match>
          <Match when={creditsState.topUpStep === 'done'}>
            <DoneStep />
          </Match>
        </Switch>
        <Show when={creditsState.topUpError}>
          <div style={errorStyle}>{creditsState.topUpError}</div>
        </Show>
      </div>
    </div>
  </Show>
)

const AmountStep = () => {
  const r = creditsActions.rules()
  return (
    <>
      <p style={hintStyle}>
        $1 = {r.creditsPerDollar} credits. Minimum ${r.minTopUpDollars}.
      </p>
      <Input
        label="Amount ($)"
        name="topUpDollars"
        value={creditsState.dollars}
        onChange={creditsActions.setDollars}
        inputMode="numeric"
        autofocus
      />
      <div style={previewStyle}>
        You get <strong>{formatCredits(creditsActions.topUpPreviewCredits())}</strong> credits
      </div>
      <div style={actionsStyle}>
        <Button color="#888" onClick={creditsActions.closeTopUp} disabled={creditsState.busy}>
          Cancel
        </Button>
        <Button color="#27ae60" onClick={creditsActions.startTopUp} disabled={creditsState.busy}>
          {creditsState.busy ? 'Please wait...' : 'Continue'}
        </Button>
      </div>
    </>
  )
}

const DoneStep = () => (
  <>
    <p style={doneStyle}>
      {formatCredits(creditsState.creditsBought)} credits added. Your balance is{' '}
      <strong>{formatCredits(creditsState.balance ?? 0)}</strong> credits.
    </p>
    <div style={actionsStyle}>
      <Button color="#27ae60" onClick={creditsActions.closeTopUp}>
        Done
      </Button>
    </div>
  </>
)

const overlayStyle: JSX.CSSProperties = {
  position: 'fixed',
  inset: 0,
  'background-color': 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'z-index': 1100,
  padding: '16px',
}

const dialogStyle: JSX.CSSProperties = {
  'background-color': '#fff',
  'border-radius': '12px',
  padding: '24px',
  width: '100%',
  'max-width': '380px',
  'box-sizing': 'border-box',
  'box-shadow': '0 8px 32px rgba(0, 0, 0, 0.2)',
}

const titleStyle: JSX.CSSProperties = {
  'font-size': '20px',
  'font-weight': 700,
  color: '#333',
  margin: '0 0 12px',
  'text-align': 'center',
}

const hintStyle: JSX.CSSProperties = { 'font-size': '14px', color: '#666', margin: '0 0 12px' }

const previewStyle: JSX.CSSProperties = { 'font-size': '15px', color: '#333', 'margin-top': '-4px' }

const doneStyle: JSX.CSSProperties = { 'font-size': '15px', color: '#333', 'text-align': 'center' }

const actionsStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'center',
  gap: '12px',
  'margin-top': '16px',
}

const errorStyle: JSX.CSSProperties = {
  color: '#e74c3c',
  'font-size': '14px',
  'text-align': 'center',
  'margin-top': '10px',
}

export default TopUpDialog
