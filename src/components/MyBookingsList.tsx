import { Show, For, type JSX } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import clubConfig from 'club-config'
import Button from './Button'
import { parseLocalDate } from '../utils/date'
import {
  myBookingsState,
  myBookingsActions,
  type MyBooking,
} from '../stores/myBookingsStore'
import {
  formatClock,
  formatCredits,
  formatDollars,
} from '../../shared/rules/booking'

// The signed-in player's court bookings, in the Account page's My Bookings
// section: upcoming, then past, each with its door code and receipt. The
// list is loaded when the section opens (accountSectionsStore).
const MyBookingsList = () => {
  const navigate = useNavigate()
  return (
    <>
      <Show when={myBookingsState.error}>
        <div style={errorStyle}>{myBookingsState.error}</div>
      </Show>
      <Show
        when={!myBookingsState.loading}
        fallback={<div style={emptyStyle}>Loading...</div>}
      >
        <Show
          when={myBookingsState.bookings.length > 0}
          fallback={<div style={emptyStyle}>You have no bookings yet.</div>}
        >
          <BookingList
            title="Upcoming"
            bookings={myBookingsActions.upcoming()}
          />
          <BookingList title="Past" bookings={myBookingsActions.past()} />
        </Show>
      </Show>
      <div style={actionsStyle}>
        <Button color="#27ae60" onClick={() => navigate('/booking')}>
          Book a Court
        </Button>
      </div>
    </>
  )
}

const BookingList = (props: { title: string; bookings: MyBooking[] }) => (
  <Show when={props.bookings.length > 0}>
    <h3 style={sectionTitleStyle}>{props.title}</h3>
    <div style={listStyle}>
      <For each={props.bookings}>{(b) => <BookingCard booking={b} />}</For>
    </div>
  </Show>
)

const longDate = (date: string) =>
  parseLocalDate(date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

const courtName = (court: number) => {
  const label = clubConfig.booking?.courtLabel || 'Court'
  return clubConfig.tables.all.length > 1 ? `${label} ${court}` : label
}

const BookingCard = (props: { booking: MyBooking }) => (
  <div style={cardStyle}>
    <div style={rowStyle}>
      <div style={rowMainStyle}>
        <strong>{longDate(props.booking.date)}</strong>
        <span>
          {formatClock(props.booking.start)} –{' '}
          {formatClock(props.booking.start + props.booking.minutes)} ·{' '}
          {courtName(props.booking.court)}
        </span>
      </div>
      <span style={creditsStyle}>
        {props.booking.paidWith === 'card'
          ? formatDollars(props.booking.amountCents ?? 0)
          : `${formatCredits(props.booking.credits ?? 0)} credits`}
      </span>
    </div>
    <DoorCodeLine booking={props.booking} />
    <button
      style={receiptToggleStyle}
      onClick={() => myBookingsActions.toggleReceipt(props.booking._id)}
      aria-expanded={myBookingsActions.isReceiptOpen(props.booking._id)}
    >
      {myBookingsActions.isReceiptOpen(props.booking._id)
        ? 'Hide receipt'
        : 'Receipt'}
    </button>
    <Show when={myBookingsActions.isReceiptOpen(props.booking._id)}>
      <Receipt booking={props.booking} />
    </Show>
  </div>
)

const DoorCodeLine = (props: { booking: MyBooking }) => (
  <Show
    when={props.booking.doorCode}
    fallback={
      <Show when={!myBookingsActions.isPast(props.booking)}>
        <div style={noCodeStyle}>
          Door code not ready yet. Please check back, or contact the club.
        </div>
      </Show>
    }
  >
    {(door) => (
      <div style={codeRowStyle(myBookingsActions.isCodeExpired(props.booking))}>
        <span style={codeLabelStyle}>Door code</span>
        <span style={codeStyle}>{door().code}</span>
        <span style={codeLabelStyle}>
          {myBookingsActions.isCodeExpired(props.booking)
            ? 'Expired'
            : `Works ${door().window}`}
        </span>
      </div>
    )}
  </Show>
)

const Receipt = (props: { booking: MyBooking }) => (
  <div style={receiptStyle}>
    <div style={receiptTitleStyle}>{props.booking.receipt.title}</div>
    <For each={props.booking.receipt.lines}>
      {(line) => (
        <div style={receiptLineStyle}>
          <span style={receiptLabelStyle}>{line.label}</span>
          <strong>{line.value}</strong>
        </div>
      )}
    </For>
  </div>
)

const sectionTitleStyle: JSX.CSSProperties = {
  'font-size': '15px',
  'font-weight': 700,
  color: '#555',
  margin: '4px 0 8px',
  'text-align': 'left',
}

const listStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '10px',
}

const cardStyle: JSX.CSSProperties = {
  padding: '12px 14px',
  'background-color': '#f5f7fa',
  'border-radius': '10px',
  'font-size': '14px',
  color: '#333',
  'text-align': 'left',
}

const rowStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'space-between',
  'align-items': 'center',
  gap: '12px',
}

const rowMainStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '2px',
  'min-width': 0,
}

const creditsStyle: JSX.CSSProperties = {
  color: '#666',
  'white-space': 'nowrap',
}

const codeRowStyle = (expired: boolean): JSX.CSSProperties => ({
  display: 'flex',
  'flex-wrap': 'wrap',
  'align-items': 'baseline',
  gap: '4px 12px',
  'margin-top': '10px',
  padding: '8px 12px',
  'background-color': '#fff',
  'border-radius': '8px',
  border: '1px solid #e5e7eb',
  opacity: expired ? 0.55 : 1,
})

const codeLabelStyle: JSX.CSSProperties = { 'font-size': '13px', color: '#666' }

const codeStyle: JSX.CSSProperties = {
  'font-size': '22px',
  'font-weight': 700,
  'letter-spacing': '4px',
  color: '#2c3e50',
  'font-variant-numeric': 'tabular-nums',
}

const noCodeStyle: JSX.CSSProperties = {
  'margin-top': '10px',
  'font-size': '13px',
  color: '#e67e22',
}

const receiptToggleStyle: JSX.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  'margin-top': '10px',
  color: '#2185d0',
  'font-size': '14px',
  'text-decoration': 'underline',
  cursor: 'pointer',
}

const receiptStyle: JSX.CSSProperties = {
  'margin-top': '10px',
  padding: '12px',
  'background-color': '#fff',
  'border-radius': '8px',
  border: '1px solid #e5e7eb',
}

const receiptTitleStyle: JSX.CSSProperties = {
  'font-weight': 700,
  'margin-bottom': '8px',
}

const receiptLineStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'space-between',
  gap: '12px',
  padding: '4px 0',
  'border-bottom': '1px solid #f0f0f0',
}

const receiptLabelStyle: JSX.CSSProperties = { color: '#666' }

const emptyStyle: JSX.CSSProperties = {
  padding: '24px',
  color: '#888',
  'text-align': 'center',
}

const errorStyle: JSX.CSSProperties = {
  color: '#e74c3c',
  'font-size': '14px',
  'margin-bottom': '12px',
}

const actionsStyle: JSX.CSSProperties = { 'margin-top': '16px' }

export default MyBookingsList
