import type { Player } from './Player'

export interface Team {
  id: string
  name: string
  players: Player[]
}

export interface GroupStage {
  type: 'group'
  groups: (Player | Team)[][]
}

export type Stage = GroupStage

export interface Tournament {
  id: string
  name: string
  date: string
  nop: number
  stages: Stage[]
}
