import { Show, For, type JSX } from 'solid-js'
import { langActions } from '../stores/langStore'

// Labels are resource keys (src/i18n), shown in the current language.
const RULES: { key: string; check: (pwd: string) => boolean }[] = [
  { key: 'password.min8', check: (p) => p.length >= 8 },
  { key: 'password.number', check: (p) => /[0-9]/.test(p) },
  { key: 'password.upper', check: (p) => /[A-Z]/.test(p) },
  { key: 'password.lower', check: (p) => /[a-z]/.test(p) },
]

const PasswordRules = (props: { password: string }) => (
  <Show when={props.password.length > 0}>
    <div style={containerStyle}>
      <For each={RULES}>
        {(rule) => (
          <PasswordRule
            met={rule.check(props.password)}
            label={langActions.t(rule.key)}
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
