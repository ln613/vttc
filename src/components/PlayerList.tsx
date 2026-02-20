import { Show, For, onMount } from 'solid-js'
import type { Player } from '../../shared/types/Player'
import { playerState, playerActions } from '../stores/playerStore'

export const PlayerList = () => {
  onMount(() => {
    if (!playerState.data && !playerState.loading) {
      playerActions.fetchPlayers()
    }
  })

  return (
    <Show when={!playerState.loading} fallback={<div>Loading...</div>}>
      <Show when={!playerState.error} fallback={<div>Error: {playerState.error}</div>}>
        <Show when={playerState.data}>
          <ul>
            <For each={playerState.data}>
              {(player) => <PlayerItem player={player} />}
            </For>
          </ul>
        </Show>
      </Show>
    </Show>
  )
}

const PlayerItem = (props: { player: Player }) => (
  <li>
    {props.player.firstName} {props.player.lastName} - {props.player.rating}
  </li>
)
