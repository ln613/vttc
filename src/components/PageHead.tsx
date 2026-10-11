import { Show, type JSX } from 'solid-js'
import { hasSite } from '../site/siteContent'
import '../pages/booking.css'

// A page's heading in booking.css's look: the site's coloured band for a club
// with its own website, a plain title otherwise. `actions` sit beside it.
const PageHead = (props: {
  kicker: string
  title: string
  actions?: JSX.Element
}) => (
  <Show
    when={hasSite()}
    fallback={
      <div class="bk-wrap" style={{ 'padding-bottom': 0 }}>
        <div class="bk-head-row" style={plainRowStyle}>
          <h1 class="bk-title">{props.title}</h1>
          {props.actions}
        </div>
      </div>
    }
  >
    <header class="bk-head">
      <div class="bk-head-inner bk-head-row">
        <div>
          <p class="bk-kicker">{props.kicker}</p>
          <h1 class="bk-title">{props.title}</h1>
        </div>
        {props.actions}
      </div>
    </header>
  </Show>
)

const plainRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  gap: '12px',
  'flex-wrap': 'wrap',
}

export default PageHead
