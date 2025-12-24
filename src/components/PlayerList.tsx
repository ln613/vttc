import { useEffect, useState } from 'react'
import type { Player } from '../../shared/types/Player'
import { api } from '../utils/api'

export const PlayerList = () => {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPlayers()
  }, [])

  const fetchPlayers = async () => {
    try {
      setLoading(true)
      const data = await api<Player[]>('players')
      setPlayers(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch players')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <ul>
      {players.map((player) => (
        <PlayerItem key={player.id} player={player} />
      ))}
    </ul>
  )
}

const PlayerItem = ({ player }: { player: Player }) => (
  <li>
    {player.firstName} {player.lastName} - {player.rating}
  </li>
)
