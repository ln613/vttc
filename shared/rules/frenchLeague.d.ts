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

export declare const FRENCH_LEAGUE_WIN_POINTS: number
export declare const FRENCH_LEAGUE_LOSS_POINTS: number
export declare const FRENCH_LEAGUE_FORFEIT_POINTS: number

export declare const isFrenchLeagueLeagueTie: (
  match: { teamMatchType?: string; playAllMatches?: boolean } | null | undefined,
) => boolean

type ScoredSub = { winningSide?: number | null; forfeitedSide?: number | null }

export declare const getFrenchLeagueSubPoints: (
  sub: ScoredSub | null | undefined,
) => [number, number] | null

export declare const getFrenchLeagueTiePoints: (
  subs: ScoredSub[] | null | undefined,
) => [number, number]

export declare const FRENCH_TOWNS: string[]
export declare const simulatedFrenchTeamNames: (count: number, random?: () => number) => string[]
