import { Show, For, onMount, type JSX } from 'solid-js'
import { Header } from '../components/Header'
import Button from '../components/Button'
import { authState } from '../stores/authStore'
import { modulesState, modulesActions } from '../stores/modulesStore'
import {
  MODULES,
  type ModuleDefinition,
  type ModuleKey,
} from '../../shared/rules/modules'

// Super admin only: which parts of the app this club uses. See
// specs/pages/Modules.md and specs/rules/modules.md.
const Modules = () => {
  onMount(() => void modulesActions.load())
  return (
    <div style={containerStyle}>
      <Header />
      <Show when={authState.isSuperAdmin}>
        <div style={contentStyle}>
          <TitleRow />
          <p style={introStyle}>
            Turn off the parts of the site this club doesn't use. A module that
            is off disappears from the menus, and its pages are no longer
            available.
          </p>
          <Show when={modulesState.error}>
            <div style={errorStyle}>{modulesState.error}</div>
          </Show>
          <For each={MODULES}>{(top) => <ModuleCard module={top} />}</For>
        </div>
      </Show>
    </div>
  )
}

const TitleRow = () => (
  <div style={titleRowStyle}>
    <h3 style={titleStyle}>Modules</h3>
    <Show
      when={modulesState.editing}
      fallback={
        <Button
          size="small"
          color="#3498db"
          onClick={modulesActions.startEditing}
        >
          Edit
        </Button>
      }
    >
      <div style={actionsStyle}>
        <Button
          size="small"
          color="#888"
          onClick={modulesActions.cancelEditing}
          disabled={modulesState.saving}
        >
          Cancel
        </Button>
        <Button
          size="small"
          color="#27ae60"
          onClick={() => void modulesActions.save()}
          disabled={modulesState.saving}
        >
          {modulesState.saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </Show>
  </div>
)

const ModuleCard = (props: { module: ModuleDefinition }) => (
  <div style={sectionStyle}>
    <ModuleSwitch module={props.module} />
    <div style={childrenStyle}>
      <For each={props.module.children}>
        {(child) => <ModuleSwitch module={child} parent={props.module.key} />}
      </For>
    </div>
  </div>
)

const isParentOff = (parent?: ModuleKey) =>
  !!parent && !modulesActions.shown()[parent]

// Why the box can't be changed: locked by the rules, or its section is off.
// A section that is off outranks a lock: Events is "always on" only while
// Tournament is.
const switchNote = (key: ModuleKey, parent?: ModuleKey) => {
  if (isParentOff(parent)) {
    const parentLabel = MODULES.find((m) => m.key === parent)?.label
    return `Off while ${parentLabel} is off`
  }
  return modulesActions.lockReason(key)
}

const ModuleSwitch = (props: {
  module: ModuleDefinition
  parent?: ModuleKey
}) => (
  <label style={rowStyle(!props.parent)}>
    <input
      type="checkbox"
      name={`module-${props.module.key}`}
      checked={modulesActions.shown()[props.module.key]}
      disabled={
        !modulesState.editing ||
        !!modulesActions.lockReason(props.module.key) ||
        isParentOff(props.parent)
      }
      onChange={(e) =>
        modulesActions.setDraft(
          props.module.key,
          (e.target as HTMLInputElement).checked,
        )
      }
      style={checkboxStyle}
    />
    <span style={labelStyle(isParentOff(props.parent))}>
      {props.module.label}
    </span>
    <Show when={switchNote(props.module.key, props.parent)}>
      <span style={noteStyle}>
        {switchNote(props.module.key, props.parent)}
      </span>
    </Show>
  </label>
)

const containerStyle: JSX.CSSProperties = {
  'min-height': '100vh',
  'background-color': '#f5f6fa',
}

const contentStyle: JSX.CSSProperties = {
  'max-width': '720px',
  margin: '0 auto',
  padding: '24px 16px',
  display: 'flex',
  'flex-direction': 'column',
  gap: '16px',
  'box-sizing': 'border-box',
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
  'font-weight': 700,
  color: '#2c3e50',
}

const actionsStyle: JSX.CSSProperties = { display: 'flex', gap: '8px' }

const introStyle: JSX.CSSProperties = {
  margin: 0,
  'font-size': '14px',
  color: '#666',
  'line-height': 1.5,
}

const sectionStyle: JSX.CSSProperties = {
  background: '#fff',
  border: '1px solid #e1e4e8',
  'border-radius': '10px',
  padding: '14px 18px',
}

const childrenStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '10px',
  'margin-top': '12px',
  'padding-left': '28px',
}

const rowStyle = (top: boolean): JSX.CSSProperties => ({
  display: 'flex',
  'flex-wrap': 'wrap',
  'align-items': 'center',
  gap: '4px 10px',
  cursor: 'pointer',
  'font-size': top ? '16px' : '14px',
  'font-weight': top ? 700 : 400,
  color: '#2c3e50',
})

const checkboxStyle: JSX.CSSProperties = {
  width: '18px',
  height: '18px',
  margin: 0,
  flex: 'none',
}

const labelStyle = (dimmed: boolean): JSX.CSSProperties => ({
  color: dimmed ? '#aaa' : 'inherit',
})

const noteStyle: JSX.CSSProperties = {
  'font-size': '12px',
  'font-weight': 400,
  color: '#999',
}

const errorStyle: JSX.CSSProperties = { color: '#e74c3c', 'font-size': '14px' }

export default Modules
