import { Show, Switch, Match } from 'solid-js'
import Input from './Input'
import PaymentPlaceholder from './PaymentPlaceholder'
import { creditsState, creditsActions } from '../stores/creditsStore'
import { formatCredits } from '../../shared/rules/booking'
import { langActions } from '../stores/langStore'
import '../pages/booking.css'

const t = langActions.t

// Top up court-booking credits: an amount in dollars, then payment. Opens
// above the booking dialog, and takes the look of the page it is on.
const TopUpDialog = () => (
  <Show when={creditsState.topUpOpen}>
    <div class="bk-overlay is-top" onClick={creditsActions.closeTopUp}>
      <div class="bk-dialog" onClick={(e) => e.stopPropagation()}>
        <div class="bk-dialog-head">
          <h2 class="bk-dialog-title">{t('topUp.title')}</h2>
        </div>
        <div class="bk-dialog-body">
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
            <p class="bk-error" style={{ 'text-align': 'center', margin: 0 }}>
              {creditsState.topUpError}
            </p>
          </Show>
        </div>
      </div>
    </div>
  </Show>
)

const AmountStep = () => {
  const r = creditsActions.rules()
  return (
    <>
      <p class="bk-note">
        {t('topUp.rate', {
          credits: r.creditsPerDollar,
          min: r.minTopUpDollars,
        })}
      </p>
      <Input
        label={t('topUp.amount')}
        name="topUpDollars"
        value={creditsState.dollars}
        onChange={creditsActions.setDollars}
        inputMode="numeric"
        autofocus
      />
      <div class="bk-price-row" style={{ 'border-top': 0, 'padding-top': 0 }}>
        <span>{t('topUp.youGet')}</span>
        <span class="bk-price">
          {t('booking.creditsAmount', {
            credits: formatCredits(creditsActions.topUpPreviewCredits()),
          })}
        </span>
      </div>
      <div class="bk-actions">
        <button
          type="button"
          class="bk-btn bk-btn-secondary bk-btn-fill"
          onClick={creditsActions.closeTopUp}
          disabled={creditsState.busy}
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          class="bk-btn bk-btn-primary bk-btn-fill"
          onClick={creditsActions.startTopUp}
          disabled={creditsState.busy}
        >
          {creditsState.busy ? t('common.pleaseWait') : t('common.continue')}
        </button>
      </div>
    </>
  )
}

const DoneStep = () => (
  <>
    <p class="bk-done">
      {t('topUp.added', { credits: formatCredits(creditsState.creditsBought) })}
    </p>
    <p class="bk-note" style={{ 'text-align': 'center' }}>
      {t('topUp.balanceIs', {
        balance: formatCredits(creditsState.balance ?? 0),
      })}
    </p>
    <div class="bk-actions is-center">
      <button
        type="button"
        class="bk-btn bk-btn-primary"
        onClick={creditsActions.closeTopUp}
      >
        {t('common.done')}
      </button>
    </div>
  </>
)

export default TopUpDialog
