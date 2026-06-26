import { Show, For, onMount, type JSX } from 'solid-js'
import { Header } from '../components/Header'
import Select from '../components/Select'
import Button from '../components/Button'
import { authState } from '../stores/authStore'
import { eventState } from '../stores/eventStore'
import { REGISTRATION_FEE_OPTIONS, PRIZE_OPTIONS } from '../utils/eventOptions'
import {
  revenueCalculatorState,
  revenueCalculatorActions,
  type CalcItem,
  type RevenueTemplate,
} from '../stores/revenueCalculatorStore'

const money = (n: number): string => `$${n.toFixed(2)}`

const PARTICIPANTS_VALUES = [5, 8, 10, 12, 15, 20, 25, 30, 40, 50]
const PARTICIPANTS_OPTIONS = [
  { value: '', label: '' },
  ...PARTICIPANTS_VALUES.map((v) => ({ value: String(v), label: String(v) })),
]

const eventOptions = () => [
  { value: '', label: '' },
  ...(eventState.data || []).map((e) => ({
    value: e._id,
    label: e.eventSeries ? `${e.eventSeries} - ${e.eventName}` : e.eventName,
  })),
]

const RevenueCalculator = () => {
  onMount(() => {
    if (!authState.isSuperAdmin) return
    revenueCalculatorActions.init()
  })

  return (
    <div style={containerStyle}>
      <Header />
      <Show when={authState.isSuperAdmin}>
        <div style={contentStyle}>
          <h1 style={titleStyle}>Revenue Calculator</h1>
          <ItemList />
          <GrandTotals />
          <Actions />
        </div>
        <Show when={revenueCalculatorState.showLoadDialog}>
          <LoadTemplateDialog />
        </Show>
      </Show>
    </div>
  )
}

const ItemList = () => (
  <div style={listStyle}>
    <For each={revenueCalculatorState.items}>{(item) => <ItemRow item={item} />}</For>
    <Button color="#3498db" onClick={() => revenueCalculatorActions.addItem()}>
      Add Event
    </Button>
  </div>
)

const ItemRow = (props: { item: CalcItem }) => {
  const set = (field: keyof CalcItem) => (value: string) =>
    revenueCalculatorActions.setItemField(props.item.id, field, value)
  return (
    <div style={itemStyle}>
      <div style={eventRowStyle}>
        <Select
          label="Event"
          name="event"
          value={props.item.eventId}
          onChange={(value) =>
            revenueCalculatorActions.selectEvent(props.item.id, value)
          }
          options={eventOptions()}
          noMargin
        />
      </div>
      <div style={fieldsStyle}>
        <Select
          label="Participants"
          name="participants"
          value={props.item.participants}
          onChange={set('participants')}
          options={PARTICIPANTS_OPTIONS}
          noMargin
        />
        <Select
          label="Registration Fee"
          name="registrationFee"
          value={props.item.registrationFee}
          onChange={set('registrationFee')}
          options={REGISTRATION_FEE_OPTIONS}
          noMargin
        />
        <Select
          label="1st Place"
          name="prize1"
          value={props.item.prize1}
          onChange={set('prize1')}
          options={PRIZE_OPTIONS}
          noMargin
        />
        <Select
          label="2nd Place"
          name="prize2"
          value={props.item.prize2}
          onChange={set('prize2')}
          options={PRIZE_OPTIONS}
          noMargin
        />
        <Select
          label="3rd Place"
          name="prize3"
          value={props.item.prize3}
          onChange={set('prize3')}
          options={PRIZE_OPTIONS}
          noMargin
        />
        <Select
          label="4th Place"
          name="prize4"
          value={props.item.prize4}
          onChange={set('prize4')}
          options={PRIZE_OPTIONS}
          noMargin
        />
      </div>
      <div style={itemFooterStyle}>
        <div style={itemTotalsStyle}>
          <span style={itemTotalStyle}>
            Registration Fee:{' '}
            {money(revenueCalculatorActions.itemRegistrationFee(props.item))}
          </span>
          <span style={itemRevenueStyle}>
            Revenue: {money(revenueCalculatorActions.itemRevenue(props.item))}
          </span>
        </div>
        <button
          type="button"
          style={deleteButtonStyle}
          onClick={() => revenueCalculatorActions.removeItem(props.item.id)}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

const GrandTotals = () => (
  <div style={grandTotalsStyle}>
    <span>
      Total Registration Fee:{' '}
      <strong>{money(revenueCalculatorActions.totalRegistrationFee())}</strong>
    </span>
    <span style={grandRevenueStyle}>
      Total Revenue:{' '}
      <strong>{money(revenueCalculatorActions.totalRevenue())}</strong>
    </span>
  </div>
)

const Actions = () => (
  <div style={actionsStyle}>
    <Button color="#27ae60" onClick={() => revenueCalculatorActions.saveTemplate()}>
      Save as Template
    </Button>
    <Button color="#3498db" onClick={() => revenueCalculatorActions.openLoadDialog()}>
      Load Template
    </Button>
  </div>
)

const LoadTemplateDialog = () => (
  <div style={overlayStyle} onClick={() => revenueCalculatorActions.closeLoadDialog()}>
    <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
      <h3 style={dialogTitleStyle}>Load Template</h3>
      <Show
        when={revenueCalculatorState.templates.length > 0}
        fallback={<div style={emptyStyle}>No templates saved.</div>}
      >
        <div style={templateListStyle}>
          <For each={revenueCalculatorState.templates}>
            {(template: RevenueTemplate) => (
              <button
                type="button"
                style={templateButtonStyle}
                onClick={() => revenueCalculatorActions.loadTemplate(template)}
              >
                {template.name}
              </button>
            )}
          </For>
        </div>
      </Show>
      <div style={dialogFooterStyle}>
        <Button color="#95a5a6" onClick={() => revenueCalculatorActions.closeLoadDialog()}>
          Cancel
        </Button>
      </div>
    </div>
  </div>
)

const containerStyle: JSX.CSSProperties = {
  'min-height': '100vh',
  'background-color': '#f5f6fa',
}

const contentStyle: JSX.CSSProperties = {
  'max-width': '1000px',
  margin: '0 auto',
  padding: '24px',
  display: 'flex',
  'flex-direction': 'column',
  gap: '16px',
}

const titleStyle: JSX.CSSProperties = {
  margin: 0,
  'font-size': '28px',
  'font-weight': 700,
  color: '#2c3e50',
  'text-align': 'left',
}

const listStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '12px',
}

const itemStyle: JSX.CSSProperties = {
  background: '#fff',
  border: '1px solid #e1e4e8',
  'border-radius': '10px',
  padding: '16px',
  display: 'flex',
  'flex-direction': 'column',
  gap: '12px',
}

const eventRowStyle: JSX.CSSProperties = {
  width: '100%',
}

const fieldsStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-wrap': 'wrap',
  gap: '12px',
}

const itemFooterStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  gap: '12px',
  'border-top': '1px solid #eef1f4',
  'padding-top': '10px',
}

const itemTotalsStyle: JSX.CSSProperties = {
  display: 'flex',
  gap: '20px',
  'font-size': '14px',
  color: '#2c3e50',
}

const itemTotalStyle: JSX.CSSProperties = {
  'font-weight': 600,
}

const itemRevenueStyle: JSX.CSSProperties = {
  'font-weight': 700,
  color: '#27ae60',
}

const deleteButtonStyle: JSX.CSSProperties = {
  background: 'none',
  border: '1px solid #e74c3c',
  color: '#e74c3c',
  'border-radius': '6px',
  padding: '6px 12px',
  cursor: 'pointer',
  'font-size': '13px',
  'font-weight': 600,
}

const grandTotalsStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'flex-end',
  gap: '28px',
  padding: '14px 18px',
  background: '#fff',
  border: '1px solid #e1e4e8',
  'border-radius': '10px',
  'font-size': '16px',
  color: '#2c3e50',
}

const grandRevenueStyle: JSX.CSSProperties = {
  color: '#27ae60',
}

const actionsStyle: JSX.CSSProperties = {
  display: 'flex',
  gap: '12px',
}

const overlayStyle: JSX.CSSProperties = {
  position: 'fixed',
  inset: '0',
  'background-color': 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'z-index': 1000,
}

const dialogStyle: JSX.CSSProperties = {
  background: '#fff',
  'border-radius': '12px',
  padding: '24px',
  'min-width': '320px',
  'max-width': '90vw',
  'max-height': '80vh',
  overflow: 'auto',
  display: 'flex',
  'flex-direction': 'column',
  gap: '16px',
}

const dialogTitleStyle: JSX.CSSProperties = {
  margin: 0,
  'font-size': '18px',
  'font-weight': 700,
  color: '#2c3e50',
}

const templateListStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '8px',
}

const templateButtonStyle: JSX.CSSProperties = {
  'text-align': 'left',
  padding: '12px 14px',
  background: '#f0f3f7',
  border: '1px solid #d0d7de',
  'border-radius': '8px',
  cursor: 'pointer',
  'font-size': '14px',
  'font-weight': 600,
  color: '#2c3e50',
}

const emptyStyle: JSX.CSSProperties = {
  color: '#7f8c8d',
  'font-size': '14px',
}

const dialogFooterStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'flex-end',
}

export default RevenueCalculator
