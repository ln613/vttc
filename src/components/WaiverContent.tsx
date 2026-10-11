import { For } from 'solid-js'
import type { WaiverText } from '../stores/waiverStore'
import '../pages/booking.css'

// The waiver's text, in a scrolling box, and the box to tick to agree. Used
// where a member accepts it (WaiverGate) and where a guest does, before
// paying for a booking.
const WaiverContent = (props: {
  text: WaiverText
  agreed: boolean
  onAgree: (agreed: boolean) => void
}) => (
  <>
    <p class="waiver-intro">{props.text.intro}</p>
    <div class="waiver-text" tabindex="0">
      <For each={props.text.sections}>
        {(section) => (
          <section>
            <h3>{section.heading}</h3>
            <p>{section.body}</p>
          </section>
        )}
      </For>
    </div>
    <label class="waiver-agree">
      <input
        type="checkbox"
        checked={props.agreed}
        onChange={(e) => props.onAgree(e.currentTarget.checked)}
      />
      <span>{props.text.agree}</span>
    </label>
  </>
)

export default WaiverContent
