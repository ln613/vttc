export declare const FRENCH_LEAGUE: 'French League'

export declare const FRENCH_LEAGUE_TEAM_SIZE: number

export declare const FRENCH_LEAGUE_MATCH_TYPE: string

export declare const FRENCH_LEAGUE_MATCH_COUNT: number

export declare const FRENCH_LEAGUE_TABLES: number

export declare const getFrenchLeagueLineup: () => {
  homeSlots: number[]
  awaySlots: number[]
  phase: number
  lane: number
  startTogether: boolean
}[]

export declare const isFrenchLeagueTournament: (
  tournament: { type?: string; teamFormat?: string } | null | undefined,
) => boolean

export declare const teamSubMatchesUnderWay: (
  match:
    | {
        subMatches?: {
          winningSide?: number | null
          games?: unknown[]
          initialServingSide?: number | null
          leftSide?: number | null
        }[]
        autoScheduled?: boolean
      }
    | null
    | undefined,
) => boolean
