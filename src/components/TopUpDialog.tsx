import { Show, Switch, Match, For } from 'solid-js'
import Input from './Input'
import CardPayment from './CardPayment'
import { clubTaxNote } from '../utils/tax'
import { creditsState, creditsActions } from '../stores/creditsStore'
import { formatCredits, formatDollars } from '../../shared/rules/booking'
import type { TopUpOption } from '../../shared/rules/wallet'
import { langActions } from '../stores/langStore'
import {
  formatBalance,
  formatPoints,
  pointsModel,
  walletT,
} from '../i18n/wallet'
import '../pages/booking.css'

const t = langActions.t

// Top up the court-booking balance: an amount, then payment. A credits club
// takes any whole-dollar amount; a points club offers set amounts, each with
// its reward points (specs/rules/wallet.md). Opens above the booking dialog,
// and takes the look of the page it is on.
const TopUpDialog = () => (
  <Show when={creditsState.topUpOpen}>
    <div class="bk-overlay is-top" onClick={creditsActions.closeTopUp}>
      <div class="bk-dialog" onClick={(e) => e.stopPropagation()}>
        <div class="bk-dialog-head">
          <h2 class="bk-dialog-title">{walletT('topUpTitle')}</h2>
        </div>
        <div class="bk-dialog-body">
          <Switch>
            <Match when={creditsState.topUpStep === 'amount' && pointsModel}>
              <OptionsStep />
            </Match>
            <Match when={creditsState.topUpStep === 'amount'}>
              <AmountStep />
            </Match>
            <Match when={creditsState.topUpStep === 'pay'}>
              <CardPayment
                amountCents={creditsState.amountCents}
                subtotalCents={creditsState.subtotalCents}
                taxes={creditsState.taxes}
                checkout={creditsState.checkout}
                available={creditsState.paymentsAvailable}
                busy={creditsState.busy}
                onPay={creditsActions.payTopUp}
                onBack={creditsActions.closeTopUp}
                onCardError={creditsActions.cardError}
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
        <Show when={clubTaxNote()}> {t('payment.plusTax', { taxes: clubTaxNote() })}</Show>
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

// A points club: one of its amounts, each showing the points it gives.
const OptionsStep = () => (
  <>
    <p class="bk-note">
      {t('topUp.chooseAmount')}
      <Show when={clubTaxNote()}> {t('payment.plusTax', { taxes: clubTaxNote() })}</Show>
    </p>
    <div class="bk-options">
      <For each={creditsState.topUpOptions}>
        {(option) => <OptionButton option={option} />}
      </For>
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

const OptionButton = (props: { option: TopUpOption }) => (
  <button
    type="button"
    class={
      creditsActions.isChosenOption(props.option)
        ? 'bk-option is-on'
        : 'bk-option'
    }
    aria-pressed={creditsActions.isChosenOption(props.option)}
    onClick={() => creditsActions.chooseOption(props.option)}
  >
    <span class="bk-option-amount">
      {formatDollars(props.option.dollars * 100)}
    </span>
    <span class="bk-option-bonus">
      {props.option.points > 0
        ? t('topUp.bonus', { points: formatPoints(props.option.points) })
        : t('topUp.noBonus')}
    </span>
  </button>
)

const DoneStep = () => (
  <>
    <p class="bk-done">
      {walletT('added', { amount: formatBalance(creditsState.creditsBought) })}
    </p>
    <Show when={creditsState.pointsEarned > 0}>
      <p class="bk-note" style={{ 'text-align': 'center' }}>
        {t('topUp.pointsAdded', {
          points: formatPoints(creditsState.pointsEarned),
          total: formatPoints(creditsState.points ?? 0),
        })}
      </p>
    </Show>
    <p class="bk-note" style={{ 'text-align': 'center' }}>
      {walletT('balanceLine', {
        amount: formatBalance(creditsState.balance ?? 0),
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
