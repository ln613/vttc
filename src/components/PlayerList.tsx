import type { Player } from '../../shared/types/Player'
import { usePlayerStore, playerActions } from '../stores/playerStore'

export const PlayerList = () => {
  const { data: players, loading, error } = usePlayerStore()

  if (!players && !loading) {
    playerActions.fetchPlayers()
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  if (!players) return null

  return (
    <ul>
      {players.map((player) => (
        <PlayerItem key={player._id} player={player} />
      ))}
    </ul>
  )
}

const PlayerItem = ({ player }: { player: Player }) => (
  <li>
    {player.firstName} {player.lastName} - {player.rating}
  </li>
)
