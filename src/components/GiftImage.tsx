import { Show } from 'solid-js'
import type { Gift } from '../stores/rewardsStore'
import '../pages/booking.css'

// A gift's photo, or a placeholder when it has none.
const GiftImage = (props: { gift: Gift }) => (
  <Show
    when={props.gift.image}
    fallback={<div class="rw-gift-image rw-gift-noimage">🎁</div>}
  >
    <img class="rw-gift-image" src={props.gift.image} alt={props.gift.name} />
  </Show>
)

export default GiftImage
