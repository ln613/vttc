import { Show, For } from 'solid-js'
import type { JSX } from 'solid-js'
import Button from './Button'
import { eventListState, eventListActions } from '../stores/eventListStore'
import type { PartialTeamInfo } from '../stores/eventListStore'

const TeammateSelectDialog = () => (
  <Show when={eventListState.showTeammateDialog}>
    <div style={overlayStyle} onClick={() => eventListActions.closeTeammateDialog()}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <DialogHeader />
        <PartialTeamList />
        <DialogFooter />
      </div>
    </div>
  </Show>
)

const DialogHeader = () => (
  <>
    <h2 style={titleStyle}>Select your teammate</h2>
    <p style={descStyle}>
      If your teammate has not registered for the event, skip this step and ask
      your teammate to select you as teammate when registering
    </p>
  </>
)

const PartialTeamList = () => (
  <div style={listStyle}>
    <For each={eventListState.partialTeams}>
      {(team) => <PartialTeamItem team={team} />}
    </For>
  </div>
)

const PartialTeamItem = (props: { team: PartialTeamInfo }) => {
  const isSelected = () =>
    eventListState.selectedPartialTeamId === props.team.participantId

  return (
    <div
      style={{
        ...itemStyle,
        ...(isSelected() ? selectedItemStyle : {}),
      }}
      onClick={() => eventListActions.selectPartialTeam(props.team.participantId)}
    >
      <div style={itemContentStyle}>
        <div style={playerNamesStyle}>{props.team.playerNames.join(', ')}</div>
        <div style={ratingInfoStyle}>
          <span>Combined Rating: {props.team.combinedRating}</span>
          <Show when={props.team.topN !== null}>
            <span style={topNStyle}>
              Top {props.team.topPlayersCount}: {props.team.topN}
            </span>
          </Show>
        </div>
      </div>
      <Show when={isSelected()}>
        <div style={checkmarkStyle}>✓</div>
      </Show>
    </div>
  )
}

const DialogFooter = () => (
  <div style={footerStyle}>
    <Button color="#888" onClick={() => eventListActions.skipTeammateSelection()}>
      Skip
    </Button>
    <Button
      color="#27ae60"
      onClick={() => eventListActions.confirmTeammateSelection()}
      disabled={!eventListState.selectedPartialTeamId}
    >
      Confirm
    </Button>
  </div>
)

// Styles

const overlayStyle: JSX.CSSProperties = {
  position: 'fixed',
  top: '0',
  left: '0',
  right: '0',
  bottom: '0',
  'background-color': 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'z-index': '1000',
}

const dialogStyle: JSX.CSSProperties = {
  'background-color': '#fff',
  padding: '24px 32px',
  'border-radius': '12px',
  'max-width': '520px',
  width: '90%',
  'max-height': '80vh',
  overflow: 'auto',
  'box-shadow': '0 4px 20px rgba(0, 0, 0, 0.15)',
}

const titleStyle: JSX.CSSProperties = {
  'font-size': '20px',
  'font-weight': '700',
  color: '#2c3e50',
  'margin-top': '0',
  'margin-bottom': '8px',
}

const descStyle: JSX.CSSProperties = {
  'font-size': '13px',
  color: '#888',
  'line-height': '1.5',
  'margin-bottom': '16px',
}

const listStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '8px',
  'margin-bottom': '16px',
}

const itemStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  padding: '12px 16px',
  border: '1px solid #e8e8e8',
  'border-radius': '8px',
  cursor: 'pointer',
  transition: 'border-color 0.2s ease, background-color 0.2s ease',
}

const selectedItemStyle: JSX.CSSProperties = {
  'border-color': '#27ae60',
  'background-color': '#f0faf4',
}

const itemContentStyle: JSX.CSSProperties = {
  flex: '1',
}

const playerNamesStyle: JSX.CSSProperties = {
  'font-size': '15px',
  'font-weight': '600',
  color: '#2c3e50',
  'margin-bottom': '4px',
}

const ratingInfoStyle: JSX.CSSProperties = {
  'font-size': '13px',
  color: '#666',
  display: 'flex',
  gap: '12px',
}

const topNStyle: JSX.CSSProperties = {
  color: '#888',
}

const checkmarkStyle: JSX.CSSProperties = {
  color: '#27ae60',
  'font-size': '20px',
  'font-weight': '700',
  'margin-left': '8px',
}

const footerStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'flex-end',
  gap: '12px',
  'margin-top': '8px',
}

export default TeammateSelectDialog
