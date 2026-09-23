import { Show, For, onMount, type JSX } from 'solid-js'
import { Header } from '../components/Header'
import Button from '../components/Button'
import Input from '../components/Input'
import TablePickerDialog from '../components/TablePickerDialog'
import { customConfirm } from '../stores/confirmDialogStore'
import { authState } from '../stores/authStore'
import { umpireState, umpireActions, type Umpire } from '../stores/umpireStore'

const Umpires = () => {
  onMount(() => {
    if (!authState.isAdmin) return
    void umpireActions.fetchUmpires()
  })

  return (
    <div style={containerStyle}>
      <Header />
      <Show when={authState.isAdmin}>
        <div style={contentStyle}>
          <div style={titleRowStyle}>
            <h3 style={titleStyle}>Umpires</h3>
            <Button onClick={() => umpireActions.startAdding()}>
              Add Umpire
            </Button>
          </div>
          <Show when={umpireState.error}>
            <div style={errorStyle}>{umpireState.error}</div>
          </Show>
          <UmpireList />
        </div>
      </Show>
      <Show when={umpireState.draft}>
        <UmpireDialog />
      </Show>
      <Show when={umpireState.assigningId}>
        <TablePickerDialog
          title="Assign a table for today"
          isDisabled={umpireActions.isTableFull}
          onPick={(n) => void umpireActions.assignTable(n)}
          onClose={() => umpireActions.cancelAssigning()}
        />
      </Show>
    </div>
  )
}

export default Umpires

// Already sorted by the server: assigned tables first in table order, then
// everyone else by name.
const UmpireList = () => (
  <Show
    when={umpireState.data.length > 0}
    fallback={<div style={emptyStyle}>No umpires yet.</div>}
  >
    <div style={listStyle}>
      <For each={umpireState.data}>{(u) => <UmpireRow umpire={u} />}</For>
    </div>
  </Show>
)

const UmpireRow = (props: { umpire: Umpire }) => {
  const handleDelete = async () => {
    const name = umpireActions.getUmpireName(props.umpire)
    if (await customConfirm(`Remove ${name} from the umpire list?`)) {
      void umpireActions.deleteUmpire(props.umpire._id)
    }
  }

  return (
    <div style={rowStyle}>
      <div style={tableBadgeStyle(props.umpire.assignedTable != null)}>
        {props.umpire.assignedTable ?? '—'}
      </div>
      <div style={nameColumnStyle}>
        <div style={nameStyle}>{umpireActions.getUmpireName(props.umpire)}</div>
        <Show when={props.umpire.umpireId || props.umpire.phone || props.umpire.email}>
          <div style={detailStyle}>
            {[props.umpire.umpireId, props.umpire.phone, props.umpire.email]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </Show>
      </div>
      <div style={actionsStyle}>
        <IconButton
          label="Assign a table for today"
          onClick={() => void umpireActions.startAssigning(props.umpire._id)}
        >
          🏓
        </IconButton>
        <Show when={props.umpire.assignedTable != null}>
          <IconButton
            label="Unassign"
            onClick={() => void umpireActions.unassign(props.umpire._id)}
          >
            ✕
          </IconButton>
        </Show>
        <IconButton
          label="Edit"
          onClick={() => umpireActions.startEditing(props.umpire)}
        >
          ✎
        </IconButton>
        <IconButton label="Delete" onClick={() => void handleDelete()}>
          🗑
        </IconButton>
      </div>
    </div>
  )
}

const UmpireDialog = () => {
  const draft = () => umpireState.draft!
  const canSave = () =>
    !!draft().firstName.trim() && !!draft().lastName.trim() && !umpireState.saving

  return (
    <div style={overlayStyle} onClick={() => umpireActions.cancelDraft()}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={dialogTitleStyle}>
          {draft()._id ? 'Edit Umpire' : 'Add Umpire'}
        </div>
        <Input
          label="First Name"
          name="firstName"
          value={draft().firstName}
          onChange={(v) => umpireActions.setDraftField('firstName', v)}
        />
        <Input
          label="Last Name"
          name="lastName"
          value={draft().lastName}
          onChange={(v) => umpireActions.setDraftField('lastName', v)}
        />
        <Input
          label="ID"
          name="umpireId"
          value={draft().umpireId}
          onChange={(v) => umpireActions.setDraftField('umpireId', v)}
        />
        <Input
          label="Phone"
          name="phone"
          value={draft().phone}
          onChange={(v) => umpireActions.setDraftField('phone', v)}
        />
        <Input
          label="Email"
          name="email"
          value={draft().email}
          onChange={(v) => umpireActions.setDraftField('email', v)}
        />
        <div style={dialogButtonsStyle}>
          <Button color="#95a5a6" onClick={() => umpireActions.cancelDraft()}>
            Cancel
          </Button>
          <Button
            onClick={() => void umpireActions.saveDraft()}
            disabled={!canSave()}
          >
            {umpireState.saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}

const IconButton = (props: {
  label: string
  onClick: () => void
  children: JSX.Element
}) => (
  <button
    type="button"
    aria-label={props.label}
    title={props.label}
    style={iconButtonStyle}
    onClick={props.onClick}
  >
    {props.children}
  </button>
)

// ==================== STYLES ====================

const containerStyle: JSX.CSSProperties = {
  'min-height': '100vh',
  'background-color': '#f5f6fa',
}

const contentStyle: JSX.CSSProperties = {
  'max-width': '720px',
  margin: '0 auto',
  padding: '24px',
  display: 'flex',
  'flex-direction': 'column',
  gap: '16px',
  'text-align': 'left',
}

const titleRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  gap: '12px',
}

const titleStyle: JSX.CSSProperties = {
  margin: 0,
  'font-size': '20px',
  color: '#2c3e50',
}

const errorStyle: JSX.CSSProperties = {
  padding: '10px 14px',
  'border-radius': '8px',
  'background-color': '#fdecea',
  color: '#c0392b',
  'font-size': '14px',
  'white-space': 'pre-line',
}

const emptyStyle: JSX.CSSProperties = {
  padding: '24px',
  'text-align': 'center',
  color: '#7f8c8d',
  'font-size': '14px',
}

const listStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '8px',
}

const rowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '12px',
  padding: '12px 14px',
  background: '#fff',
  border: '1px solid #e1e4e8',
  'border-radius': '10px',
}

const tableBadgeStyle = (assigned: boolean): JSX.CSSProperties => ({
  width: '36px',
  height: '36px',
  'box-sizing': 'border-box',
  padding: 0,
  flex: 'none',
  display: 'grid',
  'place-items': 'center',
  'border-radius': '8px',
  'font-weight': 700,
  'font-size': '15px',
  color: assigned ? '#fff' : '#b0b8c1',
  'background-color': assigned ? '#2185d0' : '#f0f2f5',
})

const nameColumnStyle: JSX.CSSProperties = {
  flex: 1,
  'min-width': 0,
}

const nameStyle: JSX.CSSProperties = {
  'font-size': '15px',
  'font-weight': 600,
  color: '#2c3e50',
}

const detailStyle: JSX.CSSProperties = {
  'font-size': '12px',
  color: '#7f8c8d',
  'white-space': 'nowrap',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
}

const actionsStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '6px',
  flex: 'none',
}

const iconButtonStyle: JSX.CSSProperties = {
  width: '34px',
  height: '34px',
  'box-sizing': 'border-box',
  padding: 0,
  flex: 'none',
  display: 'grid',
  'place-items': 'center',
  'border-radius': '50%',
  border: '1px solid #e1e4e8',
  background: '#fff',
  cursor: 'pointer',
  'font-size': '15px',
}

const overlayStyle: JSX.CSSProperties = {
  position: 'fixed',
  inset: '0',
  'background-color': 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'z-index': '2000',
  padding: '16px',
}

const dialogStyle: JSX.CSSProperties = {
  background: '#fff',
  'border-radius': '12px',
  padding: '20px',
  width: '100%',
  'max-width': '360px',
  display: 'flex',
  'flex-direction': 'column',
  gap: '10px',
  'text-align': 'left',
}

const dialogTitleStyle: JSX.CSSProperties = {
  'font-size': '18px',
  'font-weight': 700,
  color: '#2c3e50',
}

const dialogButtonsStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'flex-end',
  gap: '10px',
  'margin-top': '6px',
}
