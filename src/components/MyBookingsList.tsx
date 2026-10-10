import { Show, For, type JSX } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import clubConfig from 'club-config'
import ThemeButton from './ThemeButton'
import {
  myBookingsState,
  myBookingsActions,
  type MyBooking,
} from '../stores/myBookingsStore'
import { langActions } from '../stores/langStore'
import { themed } from '../site/themed'
import { formatCredits, formatDollars } from '../../shared/rules/booking'

// The signed-in player's court bookings, in the Account page's My Bookings
// section: upcoming, then past, each with its door code and receipt. The
// list is loaded when the section opens (accountSectionsStore). Everything
// shown follows the current language; the receipt is put together here from
// the booking itself, so it does too (the emailed one is English).

const t = langActions.t

const MyBookingsList = () => {
  const navigate = useNavigate()
  return (
    <>
      <Show when={myBookingsState.error}>
        <div style={errorStyle}>{myBookingsState.error}</div>
      </Show>
      <Show
        when={!myBookingsState.loading}
        fallback={<div style={emptyStyle}>{t('common.loading')}</div>}
      >
        <Show
          when={myBookingsState.bookings.length > 0}
          fallback={<div style={emptyStyle}>{t('myBookings.none')}</div>}
        >
          <BookingList
            title={t('myBookings.upcoming')}
            bookings={myBookingsActions.upcoming()}
          />
          <BookingList
            title={t('myBookings.past')}
            bookings={myBookingsActions.past()}
          />
        </Show>
      </Show>
      <div style={actionsStyle}>
        <ThemeButton variant="primary" onClick={() => navigate('/booking')}>
          {t('myBookings.bookCourt')}
        </ThemeButton>
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
  langActions.date(date, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

const courtName = (court: number) => {
  const label = langActions.courtName()
  return clubConfig.tables.all.length > 1 ? `${label} ${court}` : label
}

const timeRange = (b: MyBooking) =>
  `${langActions.clock(b.start)} – ${langActions.clock(b.start + b.minutes)}`

const paidText = (b: MyBooking) =>
  b.paidWith === 'card'
    ? t('myBookings.paidCard', { amount: formatDollars(b.amountCents ?? 0) })
    : t('myBookings.paidCredits', { credits: formatCredits(b.credits ?? 0) })

const BookingCard = (props: { booking: MyBooking }) => (
  <div {...themed(cardStyle, 'mb-card')}>
    <div style={rowStyle}>
      <div style={rowMainStyle}>
        <strong>{longDate(props.booking.date)}</strong>
        <span>
          {timeRange(props.booking)} · {courtName(props.booking.court)}
        </span>
      </div>
      <span style={creditsStyle}>{paidText(props.booking)}</span>
    </div>
    <DoorCodeLine booking={props.booking} />
    <button
      {...themed(receiptToggleStyle, 'bk-link mb-toggle')}
      onClick={() => myBookingsActions.toggleReceipt(props.booking._id)}
      aria-expanded={myBookingsActions.isReceiptOpen(props.booking._id)}
    >
      {myBookingsActions.isReceiptOpen(props.booking._id)
        ? t('myBookings.hideReceipt')
        : t('myBookings.receipt')}
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
        <div style={noCodeStyle}>{t('myBookings.notReady')}</div>
      </Show>
    }
  >
    {(door) => (
      <div
        {...themed(
          codeRowStyle(myBookingsActions.isCodeExpired(props.booking)),
          myBookingsActions.isCodeExpired(props.booking)
            ? 'mb-code is-expired'
            : 'mb-code',
        )}
      >
        <span style={codeLabelStyle}>{t('myBookings.doorCode')}</span>
        <span class="mb-code-digits" style={codeStyle}>
          {door().code}
        </span>
        <span style={codeLabelStyle}>
          {myBookingsActions.isCodeExpired(props.booking)
            ? t('myBookings.expired')
            : t('myBookings.works', { window: langActions.doorWindow(door()) })}
        </span>
      </div>
    )}
  </Show>
)

// The same lines as the emailed receipt (bookingReceipt.js), in the shown
// language.
const receiptLines = (b: MyBooking) => [
  [t('myBookings.ref'), b.receipt.ref],
  [t('myBookings.name'), b.name],
  [
    t('myBookings.date'),
    langActions.date(b.date, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
  ],
  [t('myBookings.time'), timeRange(b)],
  [t('myBookings.length'), langActions.length(b.minutes)],
  [t('myBookings.court'), courtName(b.court)],
  [t('myBookings.paid'), paidText(b)],
  ...(b.paidWith !== 'card' && b.balanceAfter != null
    ? [
        [
          t('myBookings.balanceAfter'),
          t('myBookings.paidCredits', {
            credits: formatCredits(b.balanceAfter),
          }),
        ],
      ]
    : []),
  [t('myBookings.bookedOn'), langActions.instant(b.paidAt)],
]

const Receipt = (props: { booking: MyBooking }) => (
  <div {...themed(receiptStyle, 'mb-receipt')}>
    <div style={receiptTitleStyle}>
      {clubConfig.name} — {t('myBookings.receiptTitle')}
    </div>
    <For each={receiptLines(props.booking)}>
      {([label, value]) => (
        <div style={receiptLineStyle}>
          <span style={receiptLabelStyle}>{label}</span>
          <strong>{value}</strong>
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

const codeLabelStyle: JSX.CSSProperties = { 'font-size': '13px', opacity: 0.75 }

const codeStyle: JSX.CSSProperties = {
  'font-size': '22px',
  'font-weight': 700,
  'letter-spacing': '4px',
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
  'border-bottom': '1px solid rgba(0, 0, 0, 0.06)',
}

const receiptLabelStyle: JSX.CSSProperties = { opacity: 0.7 }

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
