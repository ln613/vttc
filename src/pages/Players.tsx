import { Show, For, onMount } from 'solid-js'
import type { JSX } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { Header } from '../components/Header'
import Button from '../components/Button'
import type { Player } from '../../shared/types/Player'
import { playerState, playerActions, getPerPlayerFee } from '../stores/playerStore'
import { authState, authActions } from '../stores/authStore'
import { signUpActions } from '../stores/signUpStore'
import { customConfirm } from '../stores/confirmDialogStore'

const Players = () => {
  onMount(() => {
    playerActions.init()
  })

  return (
    <div style={containerStyle}>
      <Header />
      <div style={contentStyle}>
        <TitleRow />
        <PlayersContent />
      </div>
      <Show when={playerState.paymentPlayer}>
        {(player) => <PaymentConfirmDialog player={player()} />}
      </Show>
      <Show when={playerState.toastMessage}>
        {(toast) => (
          <div style={toastStyle(toast().type)}>{toast().text}</div>
        )}
      </Show>
    </div>
  )
}

const TitleRow = () => (
  <div style={titleRowStyle}>
    <h1 style={titleStyle}>Players</h1>
    <input
      type="text"
      placeholder="Search players..."
      value={playerState.search}
      onInput={(e) => playerActions.setSearch(e.currentTarget.value)}
      style={searchBoxStyle}
    />
  </div>
)

const PlayersContent = () => (
  <Show when={!playerState.loading} fallback={<div>Loading...</div>}>
    <Show
      when={!playerState.error}
      fallback={<div>{playerState.error}</div>}
    >
      <PlayerTable />
    </Show>
  </Show>
)

const PlayerTable = () => {
  const isAdmin = () => authState.isAdmin || authState.isSuperAdmin

  return (
    <Show when={isAdmin()} fallback={<PublicPlayerTable />}>
      <AdminPlayerTable />
    </Show>
  )
}

const PublicPlayerTable = () => (
  <div style={publicTableContainerStyle}>
    <table style={publicTableFixedStyle}>
      <colgroup>
        <col style={{ width: '35%' }} />
        <col style={{ width: '35%' }} />
        <col style={{ width: '10%' }} />
        <col style={{ width: '20%' }} />
      </colgroup>
      <thead>
        <tr>
          <th style={publicThStyle}>First Name</th>
          <th style={publicThStyle}>Last Name</th>
          <th style={publicThStyle}>Sex</th>
          <th style={publicThStyle}>Rating</th>
        </tr>
      </thead>
      <tbody>
        <For each={playerActions.filteredPlayers()}>
          {(player) => (
            <tr style={trStyle}>
              <td style={publicTdStyle}>{player.firstName}</td>
              <td style={publicTdStyle}>{player.lastName}</td>
              <td style={publicTdStyle}>{formatSex(player.sex)}</td>
              <td style={publicTdStyle}>{player.rating}</td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  </div>
)

const AdminPlayerTable = () => {
  const navigate = useNavigate()
  return (
    <div style={adminTableContainerStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={adminThStyle}>First Name</th>
            <th style={adminThStyle}>Last Name</th>
            <th style={adminThStyle}>Sex</th>
            <th style={adminThStyle}>Rating</th>
            <th style={adminThStyle}>Email</th>
            <th style={adminThStyle}>Phone</th>
            <th style={adminThStyle}>Action</th>
          </tr>
        </thead>
        <tbody>
          <For each={playerActions.filteredPlayers()}>
            {(player) => (
              <tr
                style={trClickableStyle}
                onClick={() => navigate(`/account/${player._id}`)}
              >
                <td style={adminTdStyle}>{player.firstName}</td>
                <td style={adminTdStyle}>{player.lastName}</td>
                <td style={adminTdStyle}>{formatSex(player.sex)}</td>
                <td style={adminTdStyle}>{player.rating}</td>
                <td style={adminTdStyle}>{player.email || ''}</td>
                <td style={adminTdStyle}>{player.phone || ''}</td>
                <td style={adminTdStyle} onClick={(e) => e.stopPropagation()}>
                  <div style={actionCellStyle}>
                    <Show when={playerActions.hasUnpaidEvents(player._id)}>
                      <span
                        class="vttc-tap"
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          playerActions.openPaymentDialog(player)
                        }}
                      >
                        <PaymentIcon onClick={() => undefined} />
                      </span>
                    </Show>
                    <Show when={needsRegistration(player)}>
                      <span
                        class="vttc-tap"
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          handleRegisterClick(player)
                        }}
                      >
                        <RegisterIcon onClick={() => undefined} />
                      </span>
                    </Show>
                  </div>
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  )
}

const needsRegistration = (player: Player): boolean =>
  !!player.email && !player.hasAccount

const handleRegisterClick = (player: Player) => {
  signUpActions.openAdminRegister(player)
  authActions.showSignUpDialog()
}

const RegisterIcon = (props: { onClick: () => void }) => (
  <svg
    style={registerIconStyle}
    onClick={props.onClick}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <line x1="20" y1="8" x2="20" y2="14" />
    <line x1="23" y1="11" x2="17" y2="11" />
  </svg>
)

const PaymentIcon = (props: { onClick: () => void }) => (
  <svg
    style={paymentIconStyle}
    onClick={props.onClick}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 0 1 0 4H8" />
    <line x1="12" y1="18" x2="12" y2="6" />
  </svg>
)

const PaymentConfirmDialog = (props: { player: Player }) => {
  const unpaidEvents = () => playerActions.unpaidEvents(props.player._id)

  return (
    <div style={dialogOverlayStyle}>
      <div style={dialogStyle}>
        <h2 style={dialogTitleStyle}>
          Unpaid Events - {props.player.firstName} {props.player.lastName}
        </h2>
        <For each={unpaidEvents()}>
          {(event) => (
            <div style={eventRowStyle}>
              <span style={eventNameStyle}>{event.eventName}</span>
              <span style={eventFeeStyle}>${getPerPlayerFee(event)}</span>
              <Button
                color="#27ae60"
                size="small"
                onClick={async (e) => {
                  e?.stopPropagation()
                  e?.preventDefault()
                  if (
                    !(await customConfirm(
                      'Confirm payment received for this event?',
                    ))
                  )
                    return
                  void playerActions.confirmPayment(event._id, props.player._id)
                }}
              >
                Confirm
              </Button>
            </div>
          )}
        </For>
        <div style={buttonContainerStyle}>
          <Show when={unpaidEvents().length > 0}>
            <Button
              color="#27ae60"
              onClick={async (e) => {
                e?.stopPropagation()
                e?.preventDefault()
                if (
                  !(await customConfirm(
                    'Confirm payment received for all events?',
                  ))
                )
                  return
                void playerActions.confirmAllPayments(props.player._id)
              }}
            >
              Confirm All
            </Button>
          </Show>
          <Button color="#e74c3c" onClick={playerActions.closePaymentDialog}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

const formatSex = (sex?: string): string => {
  if (!sex) return ''
  return sex
}

// Styles
const containerStyle: JSX.CSSProperties = {
  'min-height': '100vh',
  'background-color': '#f5f5f5',
  'overflow-x': 'hidden',
}

const contentStyle: JSX.CSSProperties = {
  'max-width': '1200px',
  width: '100%',
  margin: '0 auto',
  padding: '16px 12px 12px',
}

const titleRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'space-between',
  'align-items': 'center',
  'margin-bottom': '20px',
  gap: '12px',
}

const titleStyle: JSX.CSSProperties = {
  'text-align': 'left',
  'font-size': '28px',
  'font-weight': 700,
  color: '#333',
  margin: '0',
}

const searchBoxStyle: JSX.CSSProperties = {
  padding: '8px 12px',
  'font-size': '14px',
  border: '1px solid #ddd',
  'border-radius': '6px',
  outline: 'none',
  'min-width': '0',
  flex: '1',
  'max-width': '220px',
}

const baseTableContainerStyle: JSX.CSSProperties = {
  'background-color': '#fff',
  'border-radius': '10px',
  'box-shadow': '0 2px 6px rgba(0, 0, 0, 0.06)',
  border: '1px solid #e8e8e8',
}

const publicTableContainerStyle: JSX.CSSProperties = {
  ...baseTableContainerStyle,
  'overflow-x': 'auto',
}

const adminTableContainerStyle: JSX.CSSProperties = {
  ...baseTableContainerStyle,
  'overflow-x': 'auto',
}

const tableStyle: JSX.CSSProperties = {
  width: '100%',
  'border-collapse': 'collapse',
}

const publicTableFixedStyle: JSX.CSSProperties = {
  width: '100%',
  'border-collapse': 'collapse',
  'table-layout': 'fixed',
}

const baseThStyle: JSX.CSSProperties = {
  'text-align': 'left',
  'font-size': '13px',
  'font-weight': 600,
  color: '#fff',
  'background-color': '#2185d0',
}

const publicThStyle: JSX.CSSProperties = {
  ...baseThStyle,
  padding: '4px 0px 4px 8px',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'white-space': 'nowrap',
}

const adminThStyle: JSX.CSSProperties = {
  ...baseThStyle,
  padding: '12px 16px',
  'white-space': 'nowrap',
}

const baseTdStyle: JSX.CSSProperties = {
  'text-align': 'left',
  'font-size': '14px',
  color: '#333',
  'border-bottom': '1px solid #f0f0f0',
}

const publicTdStyle: JSX.CSSProperties = {
  ...baseTdStyle,
  padding: '4px 0px 4px 8px',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'white-space': 'nowrap',
}

const adminTdStyle: JSX.CSSProperties = {
  ...baseTdStyle,
  padding: '10px 16px',
  'white-space': 'nowrap',
}

const trStyle: JSX.CSSProperties = {
  transition: 'background-color 0.15s ease',
}

const trClickableStyle: JSX.CSSProperties = {
  ...trStyle,
  cursor: 'pointer',
}

const paymentIconStyle: JSX.CSSProperties = {
  cursor: 'pointer',
  width: '20px',
  height: '20px',
  color: '#e74c3c',
}

const registerIconStyle: JSX.CSSProperties = {
  cursor: 'pointer',
  width: '20px',
  height: '20px',
  color: '#27ae60',
}

const actionCellStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '12px',
}

const dialogOverlayStyle: JSX.CSSProperties = {
  position: 'fixed',
  top: '0',
  left: '0',
  right: '0',
  bottom: '0',
  'background-color': 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'z-index': 1000,
}

const dialogStyle: JSX.CSSProperties = {
  'background-color': 'white',
  'border-radius': '8px',
  padding: '24px',
  'min-width': '400px',
  'max-width': '500px',
}

const dialogTitleStyle: JSX.CSSProperties = {
  'font-size': '1.5rem',
  'font-weight': 700,
  'margin-bottom': '24px',
  color: '#333',
}

const eventRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '12px',
  padding: '12px 0',
  'border-bottom': '1px solid #eee',
}

const eventNameStyle: JSX.CSSProperties = {
  flex: '1',
  'text-align': 'left',
}

const eventFeeStyle: JSX.CSSProperties = {
  'font-weight': 600,
  color: '#333',
}

const buttonContainerStyle: JSX.CSSProperties = {
  display: 'flex',
  gap: '16px',
  'margin-top': '24px',
  'justify-content': 'flex-end',
}

const toastStyle = (type: 'success' | 'error'): JSX.CSSProperties => ({
  position: 'fixed',
  top: '20px',
  right: '20px',
  padding: '16px 24px',
  'border-radius': '8px',
  color: 'white',
  'font-weight': '500',
  'z-index': 1001,
  'background-color': type === 'success' ? '#27ae60' : '#e74c3c',
})

export default Players
