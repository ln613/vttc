import { Show, For, Index, type Component, type JSX } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import Input from './Input'
import Button from './Button'
import PasswordRules from './PasswordRules'
import DateOfBirthSelect from './DateOfBirthSelect'
import GoogleSignInIcon, { GoogleSignInStatus } from './GoogleSignInIcon'
import { EmailIcon, PhoneIcon, IconButton, iconRowStyle } from './SignInIcons'
import {
  signUpState,
  signUpActions,
  TOTAL_STEPS,
  type WizardStep,
} from '../stores/signUpStore'
import { formatPhone } from '../../shared/rules/contact'

// The self sign-up wizard (specs/shared/header.md). One screen per step, all
// state and every decision in signUpStore; this file only draws.

// ==================== shared pieces ====================

const Heading = (props: { children: JSX.Element; center?: boolean }) => (
  <h2 style={props.center ? { ...headingStyle, 'text-align': 'center' } : headingStyle}>
    {props.children}
  </h2>
)

const Hint = (props: { children: JSX.Element }) => (
  <p style={hintStyle}>{props.children}</p>
)

const StepError = () => (
  <Show when={signUpState.error}>
    <div style={errorStyle}>{signUpState.error}</div>
  </Show>
)

const BackButton = () => (
  <Show when={signUpActions.canGoBack()}>
    <Button color="#888" onClick={signUpActions.back} disabled={signUpState.loading}>
      Back
    </Button>
  </Show>
)

// A step's fields and its buttons. Being a form, Enter submits it — the
// primary button is the only submit button; Back and the rest are plain
// buttons.
const StepForm = (props: {
  onSubmit: () => void
  submitLabel: string
  submitDisabled?: boolean
  children: JSX.Element
}) => {
  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault()
    if (!signUpState.loading) props.onSubmit()
  }
  return (
    <form onSubmit={handleSubmit} novalidate>
      {props.children}
      <StepError />
      <div style={actionsStyle}>
        <BackButton />
        <Button
          type="submit"
          color="#27ae60"
          disabled={signUpState.loading || props.submitDisabled}
        >
          {signUpState.loading ? 'Please wait...' : props.submitLabel}
        </Button>
      </div>
    </form>
  )
}

// ==================== progress ====================

const StepProgress = () => (
  <div style={progressStyle}>
    <div style={progressDotsStyle}>
      <Index each={Array.from({ length: TOTAL_STEPS })}>
        {(_, i) => <div style={progressDotStyle(i + 1, signUpActions.stepNumber())} />}
      </Index>
    </div>
    <div style={progressLabelStyle}>
      Step {signUpActions.stepNumber()} of {TOTAL_STEPS}
    </div>
  </div>
)

// ==================== step 1 ====================

// The ways in, as a row of bare icons: email, then Google. Phone joins them
// only when it is offered (phoneAvailable in signUpStore) — not for now.
const MethodStep = () => (
  <>
    <Heading center>How would you like to sign up?</Heading>
    <div style={iconRowStyle}>
      <IconButton label="Sign up with email" onClick={() => signUpActions.chooseMethod('email')}>
        <EmailIcon />
      </IconButton>
      <Show when={signUpActions.phoneAvailable()}>
        <IconButton label="Sign up with phone" onClick={() => signUpActions.chooseMethod('phone')}>
          <PhoneIcon />
        </IconButton>
      </Show>
      <GoogleSignInIcon />
    </div>
    <GoogleSignInStatus />
  </>
)

// ==================== step 2 ====================

const ContactStep = () => (
  <StepForm onSubmit={signUpActions.submitContact} submitLabel="Send code">
    <Show
      when={signUpActions.isPhone()}
      fallback={
        <>
          <Heading>What's your email?</Heading>
          <Input
            label="Email"
            name="signUpEmail"
            type="email"
            value={signUpState.contact}
            onChange={signUpActions.setContact}
            autocomplete="email"
            inputMode="email"
            autofocus
          />
        </>
      }
    >
      <Heading>What's your phone number?</Heading>
      <Input
        label="Phone"
        name="signUpPhone"
        type="tel"
        value={signUpState.contact}
        onChange={signUpActions.setContact}
        placeholder="604-555-1234"
        autocomplete="tel-national"
        inputMode="tel"
        autofocus
      />
      <Hint>Canadian or US number. We'll text you a code.</Hint>
    </Show>
  </StepForm>
)

// ==================== step 3 ====================

const contactLabel = () =>
  signUpActions.isPhone() ? formatPhone(signUpState.contact) : signUpState.contact.trim()

const ResendLink = () => {
  const waiting = () => signUpState.resendCountdown > 0 || signUpState.loading
  return (
    <span
      style={{ ...linkStyle, opacity: waiting() ? 0.5 : 1, cursor: waiting() ? 'default' : 'pointer' }}
      onClick={signUpActions.resendCode}
    >
      {signUpState.resendCountdown > 0
        ? `Resend code in ${signUpState.resendCountdown}s`
        : 'Resend code'}
    </span>
  )
}

const CodeStep = () => (
  <StepForm onSubmit={signUpActions.submitCode} submitLabel="Verify">
    <Heading>Enter the code</Heading>
    <Hint>
      We sent a 6-digit code to <strong>{contactLabel()}</strong>.
    </Hint>
    <Input
      label="Verification code"
      name="signUpCode"
      value={signUpState.code}
      onChange={signUpActions.setCode}
      autocomplete="one-time-code"
      inputMode="numeric"
      maxLength={6}
      autofocus
    />
    <div style={resendRowStyle}>
      <ResendLink />
    </div>
  </StepForm>
)

const AccountExistsStep = () => (
  <StepForm onSubmit={signUpActions.goToSignIn} submitLabel="Sign in">
    <Heading>You already have an account</Heading>
    <div style={infoMsgStyle}>
      <strong>{contactLabel()}</strong> is already signed up. Please sign in instead.
    </div>
  </StepForm>
)

// ==================== step 4 ====================

const NameStep = () => (
  <StepForm onSubmit={signUpActions.submitName} submitLabel="Continue">
    <Heading>What's your name?</Heading>
    <Input
      label="First name"
      name="signUpFirstName"
      value={signUpState.firstName}
      onChange={signUpActions.setFirstName}
      autocomplete="given-name"
      autofocus
    />
    <Input
      label="Last name"
      name="signUpLastName"
      value={signUpState.lastName}
      onChange={signUpActions.setLastName}
      autocomplete="family-name"
    />
  </StepForm>
)

const ratingLabel = (rating: number) => (rating > 0 ? String(rating) : 'Unrated')

const sexLabel = (sex: string) => {
  const s = sex.trim().toUpperCase()
  if (s === 'M' || s === 'MALE') return 'Male'
  if (s === 'F' || s === 'FEMALE') return 'Female'
  return ''
}

const SimilarPlayerRow = (props: {
  player: { _id: string; firstName: string; lastName: string; sex: string; rating: number }
}) => {
  const selected = () => signUpState.selectedPlayerId === props.player._id
  const select = () => signUpActions.selectSimilarPlayer(props.player._id)
  return (
    <label style={matchRowStyle(selected())}>
      <input type="radio" name="similarPlayer" checked={selected()} onChange={select} style={radioStyle} />
      <span style={matchNameStyle}>
        {props.player.firstName} {props.player.lastName}
      </span>
      <span style={matchMetaStyle}>
        {[sexLabel(props.player.sex), ratingLabel(props.player.rating)].filter(Boolean).join(' · ')}
      </span>
    </label>
  )
}

const MatchStep = () => (
  <StepForm
    onSubmit={signUpActions.confirmSimilarPlayer}
    submitLabel="This is me"
    submitDisabled={!signUpState.selectedPlayerId}
  >
    <Heading>Is one of these you?</Heading>
    <Hint>
      We found players with a similar name. If one is you, select it so your
      results and rating stay with you.
    </Hint>
    <div style={matchListStyle}>
      <For each={signUpState.similarPlayers}>
        {(player) => <SimilarPlayerRow player={player} />}
      </For>
    </div>
    <div style={secondaryLinkRowStyle}>
      <span style={linkStyle} onClick={signUpActions.chooseNewPlayer}>
        None of these is me — I'm new
      </span>
    </div>
  </StepForm>
)

// ==================== step 5 ====================

const SexStep = () => (
  <>
    <Heading>Male or female?</Heading>
    <Hint>Used to enter men's and women's events.</Hint>
    <div style={choicesStyle}>
      <button
        type="button"
        style={choiceStyle(signUpState.sex === 'male')}
        onClick={() => signUpActions.chooseSex('male')}
      >
        Male
      </button>
      <button
        type="button"
        style={choiceStyle(signUpState.sex === 'female')}
        onClick={() => signUpActions.chooseSex('female')}
      >
        Female
      </button>
    </div>
    <StepError />
    <div style={actionsStyle}>
      <BackButton />
    </div>
  </>
)

// ==================== step 6 ====================

// Skip is a link, not a third button: it is the lesser choice, and three
// buttons do not fit one row on a phone.
const DobStep = () => (
  <StepForm onSubmit={signUpActions.submitDob} submitLabel="Continue">
    <Heading>Date of birth</Heading>
    <Hint>Optional — only needed to enter age-restricted events.</Hint>
    <DateOfBirthSelect
      year={signUpState.dobYear}
      month={signUpState.dobMonth}
      day={signUpState.dobDay}
      onChange={signUpActions.setDobPart}
    />
    <div style={secondaryLinkRowStyle}>
      <span style={linkStyle} onClick={signUpActions.skipDob}>
        Skip for now
      </span>
    </div>
  </StepForm>
)

// ==================== step 7 ====================

const PasswordStep = () => (
  <StepForm onSubmit={signUpActions.submitSignUp} submitLabel="Sign up">
    <Show when={signUpActions.isPasswordOptional()} fallback={<Heading>Create a password</Heading>}>
      <Heading>Create a password (optional)</Heading>
      <Hint>
        You'll sign in with Google. A password also lets you sign in with your
        email and password.
      </Hint>
    </Show>
    <Input
      label="Password"
      name="signUpPassword"
      type="password"
      value={signUpState.password}
      onChange={signUpActions.setPassword}
      autocomplete="new-password"
      autofocus
    />
    <PasswordRules password={signUpState.password} />
  </StepForm>
)

// ==================== the wizard ====================

const STEP_SCREENS: Record<WizardStep, Component> = {
  method: MethodStep,
  contact: ContactStep,
  code: CodeStep,
  accountExists: AccountExistsStep,
  name: NameStep,
  match: MatchStep,
  sex: SexStep,
  dob: DobStep,
  password: PasswordStep,
}

// Offered until the address is proved. After that, the person is part-way
// into making the account, and sign-in is not what they want. Not on the
// "already have an account" screen either, where signing in is already the
// main button.
const BEFORE_VERIFICATION: WizardStep[] = ['method', 'contact', 'code']

const SignInLink = () => (
  <Show when={BEFORE_VERIFICATION.includes(signUpState.step)}>
    <div style={signInRowStyle}>
      Already have an account?{' '}
      <span style={linkStyle} onClick={signUpActions.goToSignIn}>
        Sign in
      </span>
    </div>
  </Show>
)

const SignUpWizard = () => (
  <>
    <StepProgress />
    <Dynamic component={STEP_SCREENS[signUpState.step]} />
    <SignInLink />
  </>
)

export default SignUpWizard

// ==================== styles ====================

const headingStyle: JSX.CSSProperties = {
  'font-size': '18px',
  'font-weight': 700,
  color: '#333',
  margin: '0 0 12px',
  'text-align': 'left',
}

const hintStyle: JSX.CSSProperties = {
  'font-size': '14px',
  color: '#666',
  margin: '0 0 16px',
  'text-align': 'left',
  'line-height': 1.4,
}

const errorStyle: JSX.CSSProperties = {
  color: '#e74c3c',
  'font-size': '14px',
  'margin-top': '4px',
  'text-align': 'center',
}

const actionsStyle: JSX.CSSProperties = {
  'margin-top': '20px',
  display: 'flex',
  'justify-content': 'center',
  gap: '12px',
  'flex-wrap': 'wrap',
}

const progressStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  gap: '6px',
  'margin-bottom': '20px',
}

const progressDotsStyle: JSX.CSSProperties = {
  display: 'flex',
  gap: '8px',
  'align-items': 'center',
}

// Circles, per the house rule: equal width and height, no padding, never
// shrunk by the flex row.
const progressDotStyle = (n: number, current: number): JSX.CSSProperties => ({
  width: '10px',
  height: '10px',
  'box-sizing': 'border-box',
  padding: 0,
  flex: 'none',
  'border-radius': '50%',
  'background-color': n < current ? '#27ae60' : n === current ? '#2185d0' : '#ddd',
  transform: n === current ? 'scale(1.3)' : 'none',
  transition: 'background-color 0.2s ease, transform 0.2s ease',
})

const progressLabelStyle: JSX.CSSProperties = {
  'font-size': '12px',
  color: '#888',
}

const choicesStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '12px',
  'margin-bottom': '8px',
}

const choiceStyle = (selected: boolean, disabled = false): JSX.CSSProperties => ({
  width: '100%',
  padding: '16px',
  'font-size': '16px',
  'font-weight': 600,
  'border-radius': '10px',
  border: `2px solid ${selected ? '#2185d0' : '#ddd'}`,
  'background-color': selected ? '#eaf3fb' : '#fff',
  color: disabled ? '#aaa' : '#333',
  cursor: disabled ? 'not-allowed' : 'pointer',
  'box-sizing': 'border-box',
})

const linkStyle: JSX.CSSProperties = {
  color: '#2185d0',
  'font-size': '14px',
  cursor: 'pointer',
  'text-decoration': 'underline',
}

const resendRowStyle: JSX.CSSProperties = {
  'margin-top': '-8px',
  'text-align': 'left',
}

const infoMsgStyle: JSX.CSSProperties = {
  color: '#e67e22',
  'font-size': '14px',
  'text-align': 'center',
  padding: '10px 12px',
  'background-color': '#fef9e7',
  'border-radius': '6px',
  border: '1px solid #f9e79f',
}

const matchListStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '6px',
  'max-height': '260px',
  'overflow-y': 'auto',
}

const matchRowStyle = (selected: boolean): JSX.CSSProperties => ({
  display: 'flex',
  'align-items': 'center',
  gap: '10px',
  padding: '10px 12px',
  'border-radius': '8px',
  border: `1px solid ${selected ? '#27ae60' : '#e5e5e5'}`,
  'background-color': selected ? '#e8f5e9' : '#fff',
  cursor: 'pointer',
})

const radioStyle: JSX.CSSProperties = {
  width: '18px',
  height: '18px',
  margin: 0,
  flex: 'none',
  cursor: 'pointer',
}

const matchNameStyle: JSX.CSSProperties = {
  flex: 1,
  'font-size': '15px',
  'font-weight': 600,
  color: '#333',
  'text-align': 'left',
}

const matchMetaStyle: JSX.CSSProperties = {
  'font-size': '13px',
  color: '#777',
  'white-space': 'nowrap',
}

const secondaryLinkRowStyle: JSX.CSSProperties = {
  'margin-top': '4px',
  'text-align': 'center',
}

const signInRowStyle: JSX.CSSProperties = {
  'margin-top': '16px',
  'text-align': 'center',
  'font-size': '14px',
  color: '#666',
}
