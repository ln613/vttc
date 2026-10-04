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
import { useNavigate } from '@solidjs/router'
import { Header } from '../components/Header'
import Input from '../components/Input'
import Select from '../components/Select'
import Button from '../components/Button'
import PaymentPlaceholder from '../components/PaymentPlaceholder'
import TopUpDialog from '../components/TopUpDialog'
import { parseLocalDate } from '../utils/date'
import {
  bookingState,
  bookingActions,
  type DayBooking,
} from '../stores/bookingStore'
import { creditsState, creditsActions } from '../stores/creditsStore'
import { authState, authActions } from '../stores/authStore'
import {
  formatClock,
  formatLength,
  formatDollars,
  formatCredits,
} from '../../shared/rules/booking'

// Court booking: pick a day, pick a free half hour, choose how long, then
// book with credits (a signed-in player) or as a guest who pays by card.
// See specs/pages/Booking.md.
const Booking = () => {
  onMount(() => void bookingActions.init())
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
    <div style={containerStyle}>
      <Header />
      <div style={contentStyle}>
        <h1 style={titleStyle}>Book a Court</h1>
        <HoursLine />
        <BalanceLine />
        <WeekStrip />
        <Show when={bookingState.error}>
          <div style={errorStyle}>{bookingState.error}</div>
        </Show>
        <DayGrid />
      </div>
      <BookingDialog />
      <TopUpDialog />
    </div>
  )
}

// ==================== header lines ====================

// The hours are an admin setting that arrives with the day, so nothing is
// said about them until it has.
const HoursLine = () => (
  <Show when={bookingState.day}>
    <p style={hintStyle}>
      Open {formatClock(bookingActions.rules().openMinutes)} –{' '}
      {formatClock(bookingActions.rules().closeMinutes)}. Bookings start on the
      half hour, {formatLength(bookingActions.rules().minMinutes)} minimum.
    </p>
  </Show>
)

const BalanceLine = () => (
  <Show when={creditsActions.isPlayer() && creditsState.balance !== null}>
    <div style={balanceRowStyle}>
      <span>
        Your credits:{' '}
        <strong>{formatCredits(creditsState.balance ?? 0)}</strong>
      </span>
      <Button size="small" color="#3498db" onClick={creditsActions.openTopUp}>
        Top up
      </Button>
    </div>
  </Show>
)

// ==================== the week ====================

const dayName = (date: string) =>
  parseLocalDate(date).toLocaleDateString('en-US', { weekday: 'short' })
const dayNumber = (date: string) => parseLocalDate(date).getDate()
const monthName = (date: string) =>
  parseLocalDate(date).toLocaleDateString('en-US', { month: 'short' })
const longDate = (date: string) =>
  parseLocalDate(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

const WeekStrip = () => (
  <div style={weekRowStyle}>
    <button
      style={arrowButtonStyle(!bookingActions.canGoBack())}
      disabled={!bookingActions.canGoBack()}
      onClick={() => bookingActions.shiftWeek(-1)}
      aria-label="Previous week"
    >
      ‹
    </button>
    <div style={daysStyle}>
      <For each={bookingActions.weekDays()}>
        {(date) => <DayButton date={date} />}
      </For>
    </div>
    <button
      style={arrowButtonStyle(false)}
      onClick={() => bookingActions.shiftWeek(1)}
      aria-label="Next week"
    >
      ›
    </button>
  </div>
)

const DayButton = (props: { date: string }) => (
  <button
    style={dayButtonStyle(bookingState.date === props.date)}
    onClick={() => bookingActions.selectDate(props.date)}
  >
    <span style={dayNameStyle}>
      {props.date === bookingActions.today() ? 'Today' : dayName(props.date)}
    </span>
    <span style={dayNumberStyle}>{dayNumber(props.date)}</span>
    <span style={dayNameStyle}>{monthName(props.date)}</span>
  </button>
)

// ==================== the day ====================

const DayGrid = () => (
  <div style={dayCardStyle}>
    <div style={dayHeadingStyle}>
      <span>{longDate(bookingState.date)}</span>
      <Show when={bookingState.loading}>
        <span style={loadingStyle}>Loading...</span>
      </Show>
    </div>
    <Show when={bookingState.day}>
      <div style={gridStyle(bookingActions.courts().length)}>
        <Show when={bookingActions.courts().length > 1}>
          <For each={bookingActions.courts()}>
            {(court, i) => (
              <div style={courtHeadStyle(i() + 2)}>
                {bookingActions.courtLabel(court)}
              </div>
            )}
          </For>
        </Show>
        <For each={bookingActions.gridSlots()}>
          {(slot, row) => (
            <div style={timeCellStyle(row() + firstRow())}>
              {formatClock(slot)}
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
  b.mine ? 'Your booking' : b.name || 'Booked'

const BookedBlock = (props: {
  booking: DayBooking
  row: number
  col: number
}) => {
  const rows = () => props.booking.minutes / bookingActions.rules().slotMinutes
  return (
    <div style={bookedStyle(props.row, rows(), props.col, props.booking.mine)}>
      <strong>{bookedLabel(props.booking)}</strong>
      <span>
        {formatClock(props.booking.start)} –{' '}
        {formatClock(props.booking.start + props.booking.minutes)}
      </span>
    </div>
  )
}

const FreeCell = (props: {
  court: number
  slot: number
  row: number
  col: number
}) => {
  const status = () => bookingActions.slotStatus(props.court, props.slot)
  return (
    <button
      class={status() === 'free' ? 'vttc-booking-free' : undefined}
      style={slotStyle(props.row, props.col, status())}
      disabled={status() !== 'free'}
      onClick={() => bookingActions.selectSlot(props.court, props.slot)}
      aria-label={`${bookingActions.courtLabel(props.court)} ${formatClock(props.slot)}`}
    >
      <Show when={status() === 'free'}>Available</Show>
    </button>
  )
}

const Legend = () => (
  <div style={legendStyle}>
    <span style={legendItemStyle}>
      <span style={swatchStyle('#eafaf1', '#27ae60')} /> Available
    </span>
    <span style={legendItemStyle}>
      <span style={swatchStyle('#d6eaf8', '#2185d0')} /> Your booking
    </span>
    <span style={legendItemStyle}>
      <span style={swatchStyle('#e5e7eb', '#9ca3af')} /> Booked
    </span>
  </div>
)

// ==================== the dialog ====================

const BookingDialog = () => (
  <Show when={bookingState.step}>
    <div
      style={overlayStyle}
      onClick={() => !bookingState.busy && bookingActions.closeDialog()}
    >
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={dialogTitleStyle}>
          Book {bookingActions.courtLabel(bookingState.court)}
        </h2>
        <WhenLine />
        <Switch>
          <Match when={bookingState.step === 'details'}>
            <DetailsStep />
          </Match>
          <Match when={bookingState.step === 'guest'}>
            <GuestStep />
          </Match>
          <Match when={bookingState.step === 'pay'}>
            <PayStep />
          </Match>
          <Match when={bookingState.step === 'done'}>
            <DoneStep />
          </Match>
        </Switch>
        <Show when={bookingState.dialogError}>
          <div style={dialogErrorStyle}>{bookingState.dialogError}</div>
        </Show>
      </div>
    </div>
  </Show>
)

const endTime = () => bookingState.start + bookingState.minutes

const WhenLine = () => (
  <div style={whenStyle}>
    {longDate(bookingState.date)}
    <br />
    <strong>
      {formatClock(bookingState.start)} – {formatClock(endTime())}
    </strong>
  </div>
)

const DetailsStep = () => (
  <>
    <Select
      label="Length"
      name="bookingLength"
      value={String(bookingState.minutes)}
      onChange={(value) => bookingActions.setMinutes(Number(value))}
      options={bookingActions.lengthSelectOptions()}
      noPlaceholder
    />
    <Switch>
      <Match when={creditsActions.isPlayer()}>
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
    <div style={priceRowStyle}>
      <span>Cost</span>
      <strong>{formatCredits(bookingActions.costCredits())} credits</strong>
    </div>
    <div style={balanceNoteStyle}>
      Your balance: {formatCredits(creditsState.balance ?? 0)} credits
    </div>
    <Show when={!bookingActions.hasEnoughCredits()}>
      <div style={shortStyle}>
        Not enough credits. Top up to book this time.
      </div>
    </Show>
    <div style={actionsStyle}>
      <Button
        fill
        color="#888"
        onClick={bookingActions.closeDialog}
        disabled={bookingState.busy}
      >
        Cancel
      </Button>
      <Show
        when={bookingActions.hasEnoughCredits()}
        fallback={
          <Button fill color="#3498db" onClick={creditsActions.openTopUp}>
            Top up
          </Button>
        }
      >
        <Button
          fill
          color="#27ae60"
          onClick={bookingActions.bookWithCredits}
          disabled={bookingState.busy}
        >
          {bookingState.busy ? 'Booking...' : 'Book'}
        </Button>
      </Show>
    </div>
  </>
)

const GuestPayment = () => (
  <>
    <div style={priceRowStyle}>
      <span>Price</span>
      <strong>{formatDollars(bookingActions.priceCents())}</strong>
    </div>
    <Show when={!authActions.isSignedIn()}>
      <div style={balanceNoteStyle}>
        Have an account?{' '}
        <button
          style={linkButtonStyle}
          onClick={bookingActions.signInForCredits}
        >
          Sign in
        </button>{' '}
        to book with credits.
      </div>
    </Show>
    <div style={actionsStyle}>
      <Button fill color="#888" onClick={bookingActions.closeDialog}>
        Cancel
      </Button>
      <Button fill color="#27ae60" onClick={bookingActions.startGuest}>
        Book as guest
      </Button>
    </div>
  </>
)

const GuestStep = () => (
  <>
    <Input
      label="First Name"
      name="guestFirstName"
      value={bookingState.firstName}
      onChange={(v) => bookingActions.setGuestField('firstName', v)}
      autocomplete="given-name"
      autofocus
      required
    />
    <Input
      label="Last Name"
      name="guestLastName"
      value={bookingState.lastName}
      onChange={(v) => bookingActions.setGuestField('lastName', v)}
      autocomplete="family-name"
      required
    />
    <Input
      label="Email"
      name="guestEmail"
      type="email"
      value={bookingState.email}
      onChange={(v) => bookingActions.setGuestField('email', v)}
      autocomplete="email"
      inputMode="email"
      required
    />
    <Input
      label="Phone"
      name="guestPhone"
      type="tel"
      value={bookingState.phone}
      onChange={(v) => bookingActions.setGuestField('phone', v)}
      autocomplete="tel"
      inputMode="tel"
      required
    />
    <div style={actionsStyle}>
      <Button
        fill
        color="#888"
        onClick={bookingActions.backToDetails}
        disabled={bookingState.busy}
      >
        Back
      </Button>
      <Button
        fill
        color="#27ae60"
        onClick={bookingActions.submitGuest}
        disabled={bookingState.busy}
      >
        {bookingState.busy ? 'Please wait...' : 'Continue to payment'}
      </Button>
    </div>
  </>
)

const holdUntil = () =>
  bookingState.heldUntil
    ? new Date(bookingState.heldUntil).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : ''

const PayStep = () => (
  <>
    <div style={holdNoteStyle}>
      We're holding this time for you until {holdUntil()}.
    </div>
    <PaymentPlaceholder
      amountCents={bookingState.amountCents}
      available={bookingState.day?.paymentsAvailable ?? false}
      busy={bookingState.busy}
      onPay={bookingActions.payAsGuest}
      onBack={bookingActions.closeDialog}
    />
  </>
)

const DoorCodeBox = () => (
  <Show
    when={bookingState.doorCode}
    fallback={
      <div style={noCodeStyle}>
        {creditsActions.isPlayer()
          ? "Your door code isn't ready yet. It will appear in My Bookings."
          : "Your door code isn't ready yet. Please contact the club before your booking."}
      </div>
    }
  >
    {(door) => (
      <div style={codeBoxStyle}>
        <div style={codeLabelStyle}>Door code</div>
        <div style={codeStyle}>{door().code}</div>
        <div style={codeLabelStyle}>Works {door().window}</div>
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
    <button style={linkButtonStyle} onClick={open}>
      My Bookings
    </button>
  )
}

const DoneStep = () => (
  <>
    <div style={doneStyle}>You're booked!</div>
    <DoorCodeBox />
    <Show when={creditsActions.isPlayer() && bookingState.bookedCredits > 0}>
      <div style={balanceNoteStyle}>
        {formatCredits(bookingState.bookedCredits)} credits used. Your balance
        is {formatCredits(creditsState.balance ?? 0)} credits.
      </div>
    </Show>
    <Show when={bookingState.receiptSentTo}>
      <div style={balanceNoteStyle}>
        A receipt has been sent to {bookingState.receiptSentTo}.
      </div>
    </Show>
    <Show when={creditsActions.isPlayer()}>
      <div style={balanceNoteStyle}>
        Your code and receipt are always in <MyBookingsLink />.
      </div>
    </Show>
    <div style={actionsStyle}>
      <Button color="#27ae60" onClick={bookingActions.closeDialog}>
        Done
      </Button>
    </div>
  </>
)

// ==================== styles ====================

const codeBoxStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  gap: '6px',
  padding: '14px',
  margin: '4px 0 12px',
  'background-color': '#f0f4f8',
  'border-radius': '10px',
}

const codeLabelStyle: JSX.CSSProperties = { 'font-size': '13px', color: '#666' }

const codeStyle: JSX.CSSProperties = {
  'font-size': '32px',
  'font-weight': 700,
  'letter-spacing': '6px',
  color: '#2c3e50',
  'font-variant-numeric': 'tabular-nums',
}

const noCodeStyle: JSX.CSSProperties = {
  'font-size': '14px',
  color: '#e67e22',
  'text-align': 'center',
  margin: '4px 0 12px',
}

const SLOT_HEIGHT = 40

const containerStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  'min-height': '100vh',
}

const contentStyle: JSX.CSSProperties = {
  padding: '16px',
  width: '100%',
  'max-width': '760px',
  margin: '0 auto',
  'box-sizing': 'border-box',
}

const titleStyle: JSX.CSSProperties = {
  'font-size': '2rem',
  'font-weight': 700,
  margin: '0 0 8px',
  color: '#333',
  'text-align': 'left',
}

const hintStyle: JSX.CSSProperties = {
  'font-size': '14px',
  color: '#666',
  margin: '0 0 12px',
  'text-align': 'left',
}

const balanceRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '12px',
  'font-size': '15px',
  color: '#333',
  'margin-bottom': '12px',
}

const weekRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '6px',
  'margin-bottom': '12px',
}

const arrowButtonStyle = (disabled: boolean): JSX.CSSProperties => ({
  width: '32px',
  height: '32px',
  'box-sizing': 'border-box',
  padding: 0,
  flex: 'none',
  display: 'grid',
  'place-items': 'center',
  'border-radius': '50%',
  border: '1px solid #ddd',
  'background-color': '#fff',
  color: disabled ? '#ccc' : '#333',
  'font-size': '20px',
  'line-height': 1,
  cursor: disabled ? 'default' : 'pointer',
})

const daysStyle: JSX.CSSProperties = {
  display: 'grid',
  'grid-template-columns': 'repeat(7, minmax(0, 1fr))',
  gap: '4px',
  flex: '1 1 auto',
  'min-width': 0,
}

const dayButtonStyle = (selected: boolean): JSX.CSSProperties => ({
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  gap: '2px',
  padding: '6px 0',
  'box-sizing': 'border-box',
  'min-width': 0,
  border: selected ? '2px solid #2185d0' : '1px solid #ddd',
  'border-radius': '8px',
  'background-color': selected ? '#2185d0' : '#fff',
  color: selected ? '#fff' : '#333',
  cursor: 'pointer',
})

const dayNameStyle: JSX.CSSProperties = {
  'font-size': '11px',
  'white-space': 'nowrap',
}

const dayNumberStyle: JSX.CSSProperties = {
  'font-size': '18px',
  'font-weight': 700,
  'line-height': 1.1,
}

const dayCardStyle: JSX.CSSProperties = {
  border: '1px solid #e5e7eb',
  'border-radius': '10px',
  padding: '12px',
  'background-color': '#fff',
}

const dayHeadingStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'space-between',
  'align-items': 'baseline',
  'font-weight': 700,
  'font-size': '16px',
  color: '#333',
  'margin-bottom': '10px',
}

const loadingStyle: JSX.CSSProperties = {
  'font-weight': 400,
  'font-size': '13px',
  color: '#888',
}

const gridStyle = (courts: number): JSX.CSSProperties => ({
  display: 'grid',
  'grid-template-columns': `72px repeat(${courts}, minmax(0, 1fr))`,
  'grid-auto-rows': `${SLOT_HEIGHT}px`,
  gap: '3px 6px',
})

const courtHeadStyle = (col: number): JSX.CSSProperties => ({
  'grid-row': '1',
  'grid-column': String(col),
  'font-weight': 700,
  'font-size': '13px',
  color: '#333',
  'align-self': 'end',
  'text-align': 'center',
})

const timeCellStyle = (row: number): JSX.CSSProperties => ({
  'grid-row': String(row),
  'grid-column': '1',
  'font-size': '12px',
  color: '#666',
  'align-self': 'center',
  'text-align': 'right',
  'padding-right': '4px',
  'white-space': 'nowrap',
})

const slotColors = {
  loading: { bg: '#fafafa', border: '#f0f0f0', color: '#bbb' },
  free: { bg: '#eafaf1', border: '#bfe9d0', color: '#1e8449' },
  past: { bg: '#f7f7f7', border: '#eee', color: '#bbb' },
  tooLate: { bg: '#f7f7f7', border: '#eee', color: '#bbb' },
  taken: { bg: '#e5e7eb', border: '#d1d5db', color: '#555' },
}

const slotStyle = (
  row: number,
  col: number,
  status: keyof typeof slotColors,
): JSX.CSSProperties => ({
  'grid-row': String(row),
  'grid-column': String(col),
  'background-color': slotColors[status].bg,
  border: `1px solid ${slotColors[status].border}`,
  color: slotColors[status].color,
  'border-radius': '6px',
  'font-size': '12px',
  cursor: status === 'free' ? 'pointer' : 'default',
  padding: 0,
})

const bookedStyle = (
  row: number,
  span: number,
  col: number,
  mine: boolean,
): JSX.CSSProperties => ({
  'grid-row': `${row} / span ${span}`,
  'grid-column': String(col),
  'background-color': mine ? '#d6eaf8' : '#e5e7eb',
  'border-left': `4px solid ${mine ? '#2185d0' : '#9ca3af'}`,
  'border-radius': '6px',
  padding: '6px 10px',
  display: 'flex',
  'flex-direction': 'column',
  'justify-content': 'center',
  gap: '2px',
  'font-size': '13px',
  color: '#333',
  overflow: 'hidden',
  'box-sizing': 'border-box',
})

const legendStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-wrap': 'wrap',
  gap: '16px',
  'margin-top': '12px',
  'font-size': '12px',
  color: '#666',
}

const legendItemStyle: JSX.CSSProperties = {
  display: 'inline-flex',
  'align-items': 'center',
  gap: '6px',
}

const swatchStyle = (bg: string, border: string): JSX.CSSProperties => ({
  width: '14px',
  height: '14px',
  'box-sizing': 'border-box',
  flex: 'none',
  'border-radius': '3px',
  'background-color': bg,
  border: `1px solid ${border}`,
})

const errorStyle: JSX.CSSProperties = {
  color: '#e74c3c',
  'font-size': '14px',
  'margin-bottom': '12px',
}

const overlayStyle: JSX.CSSProperties = {
  position: 'fixed',
  inset: 0,
  'background-color': 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'z-index': 1000,
  padding: '16px',
}

const dialogStyle: JSX.CSSProperties = {
  'background-color': '#fff',
  'border-radius': '12px',
  padding: '24px',
  width: '100%',
  'max-width': '400px',
  'max-height': '100%',
  'overflow-y': 'auto',
  'box-sizing': 'border-box',
  'box-shadow': '0 8px 32px rgba(0, 0, 0, 0.2)',
  'text-align': 'left',
}

const dialogTitleStyle: JSX.CSSProperties = {
  'font-size': '20px',
  'font-weight': 700,
  color: '#333',
  margin: '0 0 8px',
  'text-align': 'center',
}

const whenStyle: JSX.CSSProperties = {
  'text-align': 'center',
  'font-size': '15px',
  color: '#444',
  'margin-bottom': '16px',
  'line-height': 1.5,
}

const priceRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'space-between',
  'align-items': 'baseline',
  'font-size': '16px',
  color: '#333',
  padding: '10px 0',
  'border-top': '1px solid #eee',
}

const balanceNoteStyle: JSX.CSSProperties = {
  'font-size': '14px',
  color: '#666',
}

const shortStyle: JSX.CSSProperties = {
  'font-size': '14px',
  color: '#e67e22',
  'margin-top': '8px',
}

const holdNoteStyle: JSX.CSSProperties = {
  'font-size': '14px',
  color: '#666',
  'margin-bottom': '12px',
  'text-align': 'center',
}

const doneStyle: JSX.CSSProperties = {
  'font-size': '18px',
  'font-weight': 700,
  color: '#27ae60',
  'text-align': 'center',
  'margin-bottom': '8px',
}

const linkButtonStyle: JSX.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: '#2185d0',
  'font-size': 'inherit',
  'text-decoration': 'underline',
  cursor: 'pointer',
}

const actionsStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'center',
  'align-items': 'stretch',
  gap: '12px',
  'margin-top': '16px',
}

const dialogErrorStyle: JSX.CSSProperties = {
  color: '#e74c3c',
  'font-size': '14px',
  'text-align': 'center',
  'margin-top': '10px',
}

export default Booking
