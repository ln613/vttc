import { Show, For } from 'solid-js'
import type { JSX } from 'solid-js'
import Button from './Button'
import { eventListState, eventListActions } from '../stores/eventListStore'
import type { UnpaidFeeInfo } from '../stores/eventListStore'
import { parseLocalDate } from '../utils/date'

const FeeInfoDialog = () => (
  <Show when={eventListState.showFeeDialog}>
    <div style={overlayStyle} onClick={() => eventListActions.closeFeeDialog()}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={dialogTitleStyle}>Registration Successful</h2>
        <p style={dialogDescStyle}>
          You have registered for{' '}
          <strong>{eventListState.registeredEventName}</strong>.
        </p>
        <Show when={eventListState.unpaidFees.length > 0}>
          <p style={dialogDescStyle}>
            Please pay the registration fee(s) below. You can either go to the
            club to pay or send an e-transfer to{' '}
            <strong>vttc@vttc.ca</strong> and copy the name/event info to the
            comment box.
          </p>
          <FeeTable fees={eventListState.unpaidFees} />
          <TotalRow fees={eventListState.unpaidFees} />
          <CopyButton />
        </Show>
        <div style={dialogButtonsStyle}>
          <Button
            color="#27ae60"
            onClick={() => eventListActions.closeFeeDialog()}
          >
            OK
          </Button>
        </div>
      </div>
    </div>
  </Show>
)

const FeeTable = (props: { fees: UnpaidFeeInfo[] }) => (
  <div style={feeTableStyle}>
    <div style={feeHeaderRowStyle}>
      <span style={feeHeaderCellStyle}>Event</span>
      <span style={feeHeaderCellStyle}>Date</span>
      <span style={feeHeaderCellRightStyle}>Fee</span>
    </div>
    <For each={props.fees}>{(fee) => <FeeRow fee={fee} />}</For>
  </div>
)

const FeeRow = (props: { fee: UnpaidFeeInfo }) => (
  <div style={feeRowStyle}>
    <span style={feeCellStyle}>{props.fee.eventName}</span>
    <span style={feeCellStyle}>{formatFeeDate(props.fee.date)}</span>
    <span style={feeCellRightStyle}>${props.fee.registrationFee}</span>
  </div>
)

const TotalRow = (props: { fees: UnpaidFeeInfo[] }) => {
  const total = () =>
    props.fees.reduce((sum, f) => sum + (f.registrationFee || 0), 0)

  return (
    <div style={totalRowStyle}>
      <span style={totalLabelStyle}>Total</span>
      <span style={totalValueStyle}>${total()}</span>
    </div>
  )
}

const copyToClipboard = (text: string) => {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text))
  } else {
    fallbackCopy(text)
  }
}

const fallbackCopy = (text: string) => {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

const CopyButton = () => {
  const handleCopy = () => {
    const text = eventListActions.buildFeeInfoText()
    copyToClipboard(text)
  }

  return (
    <div style={copyContainerStyle}>
      <Button color="#2196F3" onClick={handleCopy}>
        📋 Copy Info
      </Button>
    </div>
  )
}

const formatFeeDate = (date: string): string => {
  if (!date) return ''
  const d = parseLocalDate(date)
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

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

const dialogTitleStyle: JSX.CSSProperties = {
  'font-size': '20px',
  'font-weight': 700,
  color: '#27ae60',
  'margin-top': '0',
  'margin-bottom': '12px',
}

const dialogDescStyle: JSX.CSSProperties = {
  'font-size': '14px',
  color: '#555',
  'line-height': '1.5',
  'margin-bottom': '16px',
}

const feeTableStyle: JSX.CSSProperties = {
  'border': '1px solid #e8e8e8',
  'border-radius': '8px',
  overflow: 'hidden',
  'margin-bottom': '8px',
}

const feeHeaderRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'background-color': '#f5f5f5',
  padding: '8px 12px',
  'font-weight': 600,
  'font-size': '13px',
  color: '#555',
}

const feeHeaderCellStyle: JSX.CSSProperties = {
  flex: '1',
}

const feeHeaderCellRightStyle: JSX.CSSProperties = {
  width: '60px',
  'text-align': 'right',
}

const feeRowStyle: JSX.CSSProperties = {
  display: 'flex',
  padding: '8px 12px',
  'font-size': '13px',
  color: '#333',
  'border-top': '1px solid #f0f0f0',
}

const feeCellStyle: JSX.CSSProperties = {
  flex: '1',
}

const feeCellRightStyle: JSX.CSSProperties = {
  width: '60px',
  'text-align': 'right',
}

const totalRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'flex-end',
  padding: '8px 12px',
  'font-weight': 700,
  'font-size': '14px',
  color: '#333',
}

const totalLabelStyle: JSX.CSSProperties = {
  'margin-right': '12px',
}

const totalValueStyle: JSX.CSSProperties = {
  width: '60px',
  'text-align': 'right',
}

const copyContainerStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'flex-end',
  'margin-top': '8px',
  'margin-bottom': '16px',
}

const dialogButtonsStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'flex-end',
  'margin-top': '16px',
}

export default FeeInfoDialog
