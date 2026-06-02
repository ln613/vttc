import { Show, For, type JSX } from 'solid-js'

const RULES: { label: string; check: (pwd: string) => boolean }[] = [
  { label: 'At least 8 characters', check: (p) => p.length >= 8 },
  { label: 'Contains at least 1 number', check: (p) => /[0-9]/.test(p) },
  { label: 'Contains at least 1 uppercase', check: (p) => /[A-Z]/.test(p) },
  { label: 'Contains at least 1 lowercase', check: (p) => /[a-z]/.test(p) },
]

const PasswordRules = (props: { password: string }) => (
  <Show when={props.password.length > 0}>
    <div style={containerStyle}>
      <For each={RULES}>
        {(rule) => (
          <PasswordRule
            met={rule.check(props.password)}
            label={rule.label}
          />
        )}
      </For>
    </div>
  </Show>
)

const PasswordRule = (props: { met: boolean; label: string }) => (
  <div
    style={{
      ...ruleStyle,
      color: props.met ? '#27ae60' : '#e74c3c',
    }}
  >
    <span>{props.met ? '✓' : '✗'}</span>
    <span>{props.label}</span>
  </div>
)

const containerStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '2px',
  'margin-top': '-8px',
  'margin-bottom': '8px',
}

const ruleStyle: JSX.CSSProperties = {
  'font-size': '12px',
  display: 'flex',
  'align-items': 'center',
  gap: '6px',
}

export default PasswordRules
