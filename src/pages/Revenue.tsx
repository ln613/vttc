import { Show, For, onMount, type JSX } from 'solid-js'
import { Header } from '../components/Header'
import { authState } from '../stores/authStore'
import {
  revenueActions,
  type RevenueGroup,
  type EventRevenue,
} from '../stores/revenueStore'

const money = (n: number): string => `$${n.toFixed(2)}`

const Revenue = () => {
  onMount(() => {
    if (!authState.isSuperAdmin) return
    void revenueActions.init()
  })

  return (
    <div style={containerStyle}>
      <Header />
      <Show when={authState.isSuperAdmin}>
        <div style={contentStyle}>
          <h1 style={titleStyle}>Revenue</h1>
          <EventList />
        </div>
      </Show>
    </div>
  )
}

const EventList = () => (
  <div style={listStyle}>
    <For each={revenueActions.groups()}>
      {(group) => (
        <Show when={group.series} fallback={<StandaloneEvent group={group} />}>
          <SeriesGroup group={group} />
        </Show>
      )}
    </For>
  </div>
)

const SeriesGroup = (props: { group: RevenueGroup }) => (
  <div style={groupStyle}>
    <button
      type="button"
      style={groupHeaderStyle}
      onClick={() => revenueActions.toggle(props.group.key)}
    >
      <span style={groupHeaderLeftStyle}>
        <span style={caretStyle}>
          {revenueActions.isCollapsed(props.group.key) ? '▶' : '▼'}
        </span>
        {props.group.series}
      </span>
      <span style={groupTotalStyle}>{money(props.group.totalRevenue)}</span>
    </button>
    <Show when={!revenueActions.isCollapsed(props.group.key)}>
      <div style={groupBodyStyle}>
        <For each={props.group.events}>
          {(event) => <EventRow event={event} />}
        </For>
      </div>
    </Show>
  </div>
)

const StandaloneEvent = (props: { group: RevenueGroup }) => (
  <div style={groupStyle}>
    <EventRow event={props.group.events[0]} />
  </div>
)

const EventRow = (props: { event: EventRevenue }) => (
  <div style={eventRowStyle}>
    <div style={eventHeadStyle}>
      <span style={eventNameStyle}>{props.event.eventName}</span>
      <span style={eventDateStyle}>{props.event.date}</span>
    </div>
    <div style={eventFiguresStyle}>
      <Figure label="Participants" value={String(props.event.participantCount)} />
      <Figure label="Registration Fee" value={money(props.event.registrationFee)} />
      <Figure label="Prize" value={money(props.event.prize)} />
      <Figure label="Revenue" value={money(props.event.revenue)} strong />
    </div>
  </div>
)

const Figure = (props: { label: string; value: string; strong?: boolean }) => (
  <div style={figureStyle}>
    <span style={figureLabelStyle}>{props.label}</span>
    <span style={props.strong ? figureValueStrongStyle : figureValueStyle}>
      {props.value}
    </span>
  </div>
)

const containerStyle: JSX.CSSProperties = {
  'min-height': '100vh',
  'background-color': '#f5f6fa',
}

const contentStyle: JSX.CSSProperties = {
  'max-width': '820px',
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

const groupStyle: JSX.CSSProperties = {
  background: '#fff',
  border: '1px solid #e1e4e8',
  'border-radius': '10px',
  overflow: 'hidden',
}

const groupHeaderStyle: JSX.CSSProperties = {
  width: '100%',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  gap: '12px',
  padding: '14px 18px',
  background: '#f0f3f7',
  border: 'none',
  cursor: 'pointer',
  'font-size': '16px',
  'font-weight': 700,
  color: '#2c3e50',
  'text-align': 'left',
}

const groupHeaderLeftStyle: JSX.CSSProperties = {
  display: 'inline-flex',
  'align-items': 'center',
  gap: '10px',
}

const caretStyle: JSX.CSSProperties = {
  'font-size': '11px',
  color: '#7f8c8d',
}

const groupTotalStyle: JSX.CSSProperties = {
  color: '#27ae60',
  'font-weight': 700,
}

const groupBodyStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
}

const eventRowStyle: JSX.CSSProperties = {
  padding: '14px 18px',
  'border-top': '1px solid #eef1f4',
  display: 'flex',
  'flex-direction': 'column',
  gap: '10px',
}

const eventHeadStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'baseline',
  'justify-content': 'space-between',
  gap: '12px',
}

const eventNameStyle: JSX.CSSProperties = {
  'font-size': '15px',
  'font-weight': 600,
  color: '#2c3e50',
}

const eventDateStyle: JSX.CSSProperties = {
  'font-size': '13px',
  color: '#7f8c8d',
}

const eventFiguresStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-wrap': 'wrap',
  gap: '20px',
}

const figureStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '2px',
}

const figureLabelStyle: JSX.CSSProperties = {
  'font-size': '11px',
  'text-transform': 'uppercase',
  'letter-spacing': '0.04em',
  color: '#95a5a6',
}

const figureValueStyle: JSX.CSSProperties = {
  'font-size': '15px',
  color: '#2c3e50',
}

const figureValueStrongStyle: JSX.CSSProperties = {
  'font-size': '15px',
  'font-weight': 700,
  color: '#27ae60',
}

export default Revenue
