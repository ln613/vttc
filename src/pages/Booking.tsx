import {
  Show,
  For,
  Switch,
  Match,
  onMount,
  onCleanup,
  createEffect,
  on,
  type JSX,
} from 'solid-js'
import { A, useNavigate } from '@solidjs/router'
import { Header } from '../components/Header'
import Input from '../components/Input'
import Select from '../components/Select'
import CardPayment from '../components/CardPayment'
import TopUpDialog from '../components/TopUpDialog'
import {
  bookingState,
  bookingActions,
  type DayBooking,
} from '../stores/bookingStore'
import { creditsState, creditsActions } from '../stores/creditsStore'
import { authState, authActions } from '../stores/authStore'
import { langActions } from '../stores/langStore'
import { hasSiteLook, loadSiteFonts } from '../site/siteContent'
import { formatDollars } from '../../shared/rules/booking'
import { clubTaxNote } from '../utils/tax'
import { formatBalance, walletT } from '../i18n/wallet'
import './booking.css'
import WaiverContent from '../components/WaiverContent'
import { waiverActions } from '../stores/waiverStore'

// Court booking: pick a day, pick a free half hour, choose how long, then
// book with credits (a signed-in player) or as a guest who pays by card.
// A club with its own website gets the page in its site's look (.bk-site,
// booking.css) and in the site's languages. See specs/pages/Booking.md.

const t = langActions.t

const Booking = () => {
  onMount(() => {
    loadSiteFonts()
    void bookingActions.init()
  })
  onCleanup(bookingActions.reset)
  // Signing in (or out) from the header changes how the booking is paid.
  createEffect(
    on(
      () => authState.user?._id,
      () => void creditsActions.fetchBalance(),
      { defer: true },
    ),
  )

  return (
    <div class={hasSiteLook() ? 'bk bk-site' : 'bk'}>
      <Header />
      <Show when={hasSiteLook()} fallback={<PlainHead />}>
        <SiteHead />
      </Show>
      <div class="bk-wrap">
        <BalanceLine />
        <WeekStrip />
        <Show when={bookingState.error}>
          <div class="bk-error">{bookingState.error}</div>
        </Show>
        <DayGrid />
      </div>
      <BookingDialog />
      <TopUpDialog />
    </div>
  )
}

// ==================== heading ====================

// The hours are an admin setting that arrives with the day, so nothing is
// said about them until it has.
const hoursText = () =>
  t('booking.hours', {
    open: langActions.clock(bookingActions.rules().openMinutes),
    close: langActions.clock(bookingActions.rules().closeMinutes),
    min: langActions.length(bookingActions.rules().minMinutes),
  })

const PlainHead = () => (
  <div class="bk-wrap" style={{ 'padding-bottom': 0 }}>
    <h1 class="bk-title">{t('booking.title')}</h1>
    <Show when={bookingState.day}>
      <p class="bk-hint">{hoursText()}</p>
    </Show>
  </div>
)

const SiteHead = () => (
  <header class="bk-head">
    <div class="bk-head-inner">
      <p class="bk-kicker">{t('booking.kicker')}</p>
      <h1 class="bk-title">{t('booking.title')}</h1>
      <Show when={bookingState.day}>
        <p class="bk-hint">
          {hoursText()} {t('booking.pricesNote')}{' '}
          <A href="/pricing">{t('booking.seePricing')}</A>
        </p>
      </Show>
    </div>
  </header>
)

const BalanceLine = () => (
  <Show
    when={creditsActions.paysWithCredits() && creditsState.balance !== null}
  >
    <div class="bk-balance">
      <span>
        {walletT('yourBalance')}{' '}
        <strong>{formatBalance(creditsState.balance ?? 0)}</strong>
      </span>
      <button
        type="button"
        class="bk-btn bk-btn-primary bk-btn-small"
        onClick={creditsActions.openTopUp}
      >
        {t('booking.topUp')}
      </button>
    </div>
  </Show>
)

// ==================== the week ====================

const longDate = (date: string) =>
  langActions.date(date, { weekday: 'long', month: 'long', day: 'numeric' })

const WeekStrip = () => (
  <div class="bk-week">
    <button
      type="button"
      class="bk-arrow"
      disabled={!bookingActions.canGoBack()}
      onClick={() => bookingActions.shiftWeek(-1)}
      aria-label={t('booking.previousWeek')}
    >
      ‹
    </button>
    <div class="bk-days">
      <For each={bookingActions.weekDays()}>
        {(date) => <DayButton date={date} />}
      </For>
    </div>
    <button
      type="button"
      class="bk-arrow"
      onClick={() => bookingActions.shiftWeek(1)}
      aria-label={t('booking.nextWeek')}
    >
      ›
    </button>
  </div>
)

const DayButton = (props: { date: string }) => (
  <button
    type="button"
    class={bookingState.date === props.date ? 'bk-day is-on' : 'bk-day'}
    onClick={() => bookingActions.selectDate(props.date)}
  >
    <span class="bk-day-name">
      {props.date === bookingActions.today()
        ? t('booking.today')
        : langActions.date(props.date, { weekday: 'short' })}
    </span>
    <span class="bk-day-num">
      {langActions.date(props.date, { day: 'numeric' }).replace(/\D/g, '')}
    </span>
    <span class="bk-day-name">
      {langActions.date(props.date, { month: 'short' })}
    </span>
  </button>
)

// ==================== the day ====================

const DayGrid = () => (
  <div class="bk-card">
    <div class="bk-card-head">
      <h2 class="bk-card-title">{longDate(bookingState.date)}</h2>
      <Show when={bookingState.loading}>
        <span class="bk-loading">{t('common.loading')}</span>
      </Show>
    </div>
    <Show when={bookingState.day}>
      <div
        class="bk-grid"
        style={{
          'grid-template-columns': `84px repeat(${bookingActions.courts().length}, minmax(0, 1fr))`,
        }}
      >
        <Show when={bookingActions.courts().length > 1}>
          <For each={bookingActions.courts()}>
            {(court, i) => (
              <div class="bk-court-head" style={{ 'grid-column': i() + 2 }}>
                {bookingActions.courtLabel(court)}
              </div>
            )}
          </For>
        </Show>
        <For each={bookingActions.gridSlots()}>
          {(slot, row) => (
            <div class="bk-time" style={{ 'grid-row': row() + firstRow() }}>
              {langActions.clock(slot)}
            </div>
          )}
        </For>
        <For each={bookingActions.courts()}>
          {(court, col) => (
            <For each={bookingActions.gridSlots()}>
              {(slot, row) => (
                <SlotCell
                  court={court}
                  slot={slot}
                  row={row() + firstRow()}
                  col={col() + 2}
                />
              )}
            </For>
          )}
        </For>
      </div>
    </Show>
    <Legend />
  </div>
)

// With more than one court, row 1 holds the court names.
const firstRow = () => (bookingActions.courts().length > 1 ? 2 : 1)

// A booking is drawn once, from its first half hour, spanning its length;
// the half hours it covers draw nothing of their own.
const SlotCell = (props: {
  court: number
  slot: number
  row: number
  col: number
}) => {
  const booking = () => bookingActions.bookingAt(props.court, props.slot)
  return (
    <Switch>
      <Match when={booking()?.start === props.slot}>
        <BookedBlock booking={booking()!} row={props.row} col={props.col} />
      </Match>
      <Match when={booking()}>{null}</Match>
      <Match when={true}>
        <FreeCell
          court={props.court}
          slot={props.slot}
          row={props.row}
          col={props.col}
        />
      </Match>
    </Switch>
  )
}

const bookedLabel = (b: DayBooking) =>
  b.mine ? t('booking.yourBooking') : b.name || t('booking.booked')

const timeRange = (start: number, minutes: number) =>
  `${langActions.clock(start)} – ${langActions.clock(start + minutes)}`

const BookedBlock = (props: {
  booking: DayBooking
  row: number
  col: number
}) => {
  const rows = () => props.booking.minutes / bookingActions.rules().slotMinutes
  return (
    <div
      class={props.booking.mine ? 'bk-booked is-mine' : 'bk-booked'}
      style={{
        'grid-row': `${props.row} / span ${rows()}`,
        'grid-column': props.col,
      }}
    >
      <strong>{bookedLabel(props.booking)}</strong>
      <span>{timeRange(props.booking.start, props.booking.minutes)}</span>
    </div>
  )
}

// A free half hour shows what it costs, since the price follows the time.
const FreeCell = (props: {
  court: number
  slot: number
  row: number
  col: number
}) => {
  const status = () => bookingActions.slotStatus(props.court, props.slot)
  const free = () => status() === 'free'
  return (
    <button
      type="button"
      class={free() ? 'bk-slot is-free' : 'bk-slot is-off'}
      style={{ 'grid-row': props.row, 'grid-column': props.col }}
      disabled={!free()}
      onClick={() => bookingActions.selectSlot(props.court, props.slot)}
      aria-label={`${bookingActions.courtLabel(props.court)} ${langActions.clock(props.slot)}`}
    >
      <Show when={free()}>
        <span>{t('booking.available')}</span>
        <span class="bk-rate">
          ${bookingActions.hourlyRate(props.slot)}
          {t('booking.perHour')}
        </span>
      </Show>
    </button>
  )
}

const Legend = () => (
  <div class="bk-legend">
    <span>
      <span class="bk-swatch is-free" /> {t('booking.available')}
    </span>
    <span>
      <span class="bk-swatch is-mine" /> {t('booking.yourBooking')}
    </span>
    <span>
      <span class="bk-swatch is-taken" /> {t('booking.booked')}
    </span>
  </div>
)

// ==================== the dialog ====================

const BookingDialog = () => (
  <Show when={bookingState.step}>
    <div
      class="bk-overlay"
      onClick={() => !bookingState.busy && bookingActions.closeDialog()}
    >
      <div class="bk-dialog" onClick={(e) => e.stopPropagation()}>
        <div class="bk-dialog-head">
          <h2 class="bk-dialog-title">
            {t('booking.bookCourt', {
              court: bookingActions.courtLabel(bookingState.court),
            })}
          </h2>
          <div class="bk-dialog-when">
            {longDate(bookingState.date)}
            <br />
            <strong>
              {timeRange(bookingState.start, bookingState.minutes)}
            </strong>
          </div>
        </div>
        <div class="bk-dialog-body">
          <Switch>
            <Match when={bookingState.step === 'details'}>
              <DetailsStep />
            </Match>
            <Match when={bookingState.step === 'guest'}>
              <GuestStep />
            </Match>
            <Match when={bookingState.step === 'waiver'}>
              <GuestWaiverStep />
            </Match>
            <Match when={bookingState.step === 'pay'}>
              <PayStep />
            </Match>
            <Match when={bookingState.step === 'done'}>
              <DoneStep />
            </Match>
          </Switch>
          <Show when={bookingState.dialogError}>
            <p class="bk-error" style={{ 'text-align': 'center', margin: 0 }}>
              {bookingState.dialogError}
            </p>
          </Show>
        </div>
      </div>
    </div>
  </Show>
)

const Actions = (props: { children: JSX.Element; center?: boolean }) => (
  <div class={props.center ? 'bk-actions is-center' : 'bk-actions'}>
    {props.children}
  </div>
)

const DetailsStep = () => (
  <>
    <Select
      label={t('booking.length')}
      name="bookingLength"
      value={String(bookingState.minutes)}
      onChange={(value) => bookingActions.setMinutes(Number(value))}
      options={bookingActions.lengthSelectOptions()}
      noPlaceholder
      noMargin
    />
    <Switch>
      <Match when={creditsActions.paysWithCredits()}>
        <PlayerPayment />
      </Match>
      <Match when={true}>
        <GuestPayment />
      </Match>
    </Switch>
  </>
)

const PlayerPayment = () => (
  <>
    <div class="bk-price-row">
      <span>{t('booking.cost')}</span>
      <span class="bk-price">
        {formatBalance(bookingActions.costCredits())}
      </span>
    </div>
    <p class="bk-note">
      {walletT('balanceLine', {
        amount: formatBalance(creditsState.balance ?? 0),
      })}
    </p>
    <Show when={!bookingActions.hasEnoughCredits()}>
      <p class="bk-warn">{walletT('notEnough')}</p>
    </Show>
    <Actions>
      <button
        type="button"
        class="bk-btn bk-btn-secondary bk-btn-fill"
        onClick={bookingActions.closeDialog}
        disabled={bookingState.busy}
      >
        {t('common.cancel')}
      </button>
      <Show
        when={bookingActions.hasEnoughCredits()}
        fallback={
          <button
            type="button"
            class="bk-btn bk-btn-accent bk-btn-fill"
            onClick={creditsActions.openTopUp}
          >
            {t('booking.topUp')}
          </button>
        }
      >
        <button
          type="button"
          class="bk-btn bk-btn-primary bk-btn-fill"
          onClick={bookingActions.bookWithCredits}
          disabled={bookingState.busy}
        >
          {bookingState.busy ? t('booking.booking') : t('booking.book')}
        </button>
      </Show>
    </Actions>
  </>
)

const GuestPayment = () => (
  <>
    <div class="bk-price-row">
      <span>{t('booking.price')}</span>
      <span class="bk-price">{formatDollars(bookingActions.priceCents())}</span>
    </div>
    <Show when={clubTaxNote()}>
      <p class="bk-note">{t('payment.plusTax', { taxes: clubTaxNote() })}</p>
    </Show>
    <Show when={!authActions.isSignedIn()}>
      <p class="bk-note">
        {t('booking.haveAccount')}{' '}
        <button
          type="button"
          class="bk-link"
          onClick={bookingActions.signInForCredits}
        >
          {t('booking.signIn')}
        </button>{' '}
        {walletT('toBook')}
      </p>
    </Show>
    <Actions>
      <button
        type="button"
        class="bk-btn bk-btn-secondary bk-btn-fill"
        onClick={bookingActions.closeDialog}
      >
        {t('common.cancel')}
      </button>
      <button
        type="button"
        class="bk-btn bk-btn-primary bk-btn-fill"
        onClick={bookingActions.startGuest}
      >
        {creditsActions.isPlayer()
          ? t('booking.payByCard')
          : t('booking.bookAsGuest')}
      </button>
    </Actions>
  </>
)

// The club's liability waiver, which a guest accepts before paying
// (specs/rules/waiver.md).
const GuestWaiverStep = () => (
  <Show when={waiverActions.text()}>
    {(text) => (
      <>
        <h3 class="bk-section-title" style={{ margin: 0 }}>
          {text().title}
        </h3>
        <WaiverContent
          text={text()}
          agreed={bookingState.waiverAgreed}
          onAgree={bookingActions.setWaiverAgreed}
        />
        <Actions>
          <button
            type="button"
            class="bk-btn bk-btn-secondary bk-btn-fill"
            onClick={bookingActions.backToGuest}
            disabled={bookingState.busy}
          >
            {t('common.back')}
          </button>
          <button
            type="button"
            class="bk-btn bk-btn-primary bk-btn-fill"
            onClick={() => void bookingActions.acceptWaiverAndContinue()}
            disabled={!bookingState.waiverAgreed || bookingState.busy}
          >
            {bookingState.busy ? t('common.pleaseWait') : t('waiver.accept')}
          </button>
        </Actions>
      </>
    )}
  </Show>
)

const GuestStep = () => (
  <>
    <Input
      label={t('booking.firstName')}
      name="guestFirstName"
      value={bookingState.firstName}
      onChange={(v) => bookingActions.setGuestField('firstName', v)}
      autocomplete="given-name"
      autofocus
      required
    />
    <Input
      label={t('booking.lastName')}
      name="guestLastName"
      value={bookingState.lastName}
      onChange={(v) => bookingActions.setGuestField('lastName', v)}
      autocomplete="family-name"
      required
    />
    <Input
      label={t('booking.email')}
      name="guestEmail"
      type="email"
      value={bookingState.email}
      onChange={(v) => bookingActions.setGuestField('email', v)}
      autocomplete="email"
      inputMode="email"
      required
    />
    <Input
      label={t('booking.phone')}
      name="guestPhone"
      type="tel"
      value={bookingState.phone}
      onChange={(v) => bookingActions.setGuestField('phone', v)}
      autocomplete="tel"
      inputMode="tel"
      required
    />
    <Actions>
      <button
        type="button"
        class="bk-btn bk-btn-secondary bk-btn-fill"
        onClick={bookingActions.backToDetails}
        disabled={bookingState.busy}
      >
        {t('common.back')}
      </button>
      <button
        type="button"
        class="bk-btn bk-btn-primary bk-btn-fill"
        onClick={bookingActions.submitGuest}
        disabled={bookingState.busy}
      >
        {bookingState.busy
          ? t('common.pleaseWait')
          : t('booking.continueToPayment')}
      </button>
    </Actions>
  </>
)

const PayStep = () => (
  <>
    <p class="bk-note" style={{ 'text-align': 'center' }}>
      {t('booking.holding', {
        time: bookingState.heldUntil
          ? langActions.instantTime(bookingState.heldUntil)
          : '',
      })}
    </p>
    <CardPayment
      amountCents={bookingState.amountCents}
      subtotalCents={bookingState.subtotalCents}
      taxes={bookingState.taxes}
      checkout={bookingState.checkout}
      available={bookingState.day?.paymentsAvailable ?? false}
      busy={bookingState.busy}
      onPay={bookingActions.payAsGuest}
      onBack={bookingActions.closeDialog}
      onCardError={bookingActions.cardError}
    />
  </>
)

const DoorCodeBox = () => (
  <Show
    when={bookingState.doorCode}
    fallback={
      <p class="bk-warn" style={{ 'text-align': 'center' }}>
        {creditsActions.hasMyBookings()
          ? t('booking.codeNotReadyMine')
          : t('booking.codeNotReadyGuest')}
      </p>
    }
  >
    {(door) => (
      <div class="bk-code">
        <span class="bk-code-label">{t('booking.doorCode')}</span>
        <span class="bk-code-digits">{door().code}</span>
        <span class="bk-code-label">
          {t('booking.works', { window: langActions.doorWindow(door()) })}
        </span>
      </div>
    )}
  </Show>
)

const MyBookingsLink = () => {
  const navigate = useNavigate()
  const open = () => {
    bookingActions.closeDialog()
    navigate('/account?open=myBookings')
  }
  return (
    <button type="button" class="bk-link" onClick={open}>
      {t('booking.myBookings')}
    </button>
  )
}

// "Your code and receipt are always in {link}." with the link in place.
const AlwaysInMyBookings = () => {
  const parts = () => t('booking.alwaysIn').split('{link}')
  return (
    <p class="bk-note">
      {parts()[0]}
      <MyBookingsLink />
      {parts()[1]}
    </p>
  )
}

const DoneStep = () => (
  <>
    <p class="bk-done">{t('booking.youreBooked')}</p>
    <DoorCodeBox />
    <Show
      when={creditsActions.paysWithCredits() && bookingState.bookedCredits > 0}
    >
      <p class="bk-note">
        {walletT('used', {
          used: formatBalance(bookingState.bookedCredits),
          balance: formatBalance(creditsState.balance ?? 0),
        })}
      </p>
    </Show>
    <Show when={bookingState.receiptSentTo}>
      <p class="bk-note">
        {t('booking.receiptSent', { email: bookingState.receiptSentTo ?? '' })}
      </p>
    </Show>
    <Show when={creditsActions.hasMyBookings()}>
      <AlwaysInMyBookings />
    </Show>
    <Actions center>
      <button
        type="button"
        class="bk-btn bk-btn-primary"
        onClick={bookingActions.closeDialog}
      >
        {t('common.done')}
      </button>
    </Actions>
  </>
)

export default Booking
