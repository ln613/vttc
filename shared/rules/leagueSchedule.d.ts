// Types for leagueSchedule.js. The implementation is plain JavaScript so the
// Netlify functions and the browser can share one copy; this file is what
// the TypeScript side sees.
import type {
  LeagueFormat,
  LeagueRoundPlan,
  LeagueRoundSelection,
} from '../types/League'

/** A round of pairings as 1-based team numbers, before ids are attached. */
export interface RawRound {
  pairs: [number, number][]
  bye?: number
}

export declare const getRoundsPerPhase: (teamCount: number) => number

export declare const getTotalRounds: (
  teamCount: number,
  phases: number,
) => number

export declare const generatePhasePairings: (
  teamCount: number,
  fixedTeam?: number,
) => RawRound[]

export declare const assignHomeAway: (
  rounds: RawRound[],
  teamCount: number,
  fixedTeam?: number,
) => RawRound[]

export declare const assignTables: (
  rounds: RawRound[],
  tables: number[],
  roundsPerPhase: number,
) => (number | undefined)[][]

export declare const addWeeks: (date: string, weeks: number) => string

export declare const generateLeagueSchedule: (input: {
  participantIds: string[]
  phases: number
  tables: number[]
  startDate: string
}) => LeagueRoundPlan[]

export declare const LEAGUE_FORMATS: LeagueFormat[]

export declare const getRoundRobinSinglesLineup: (
  teamSize: number,
) => { homeSlots: number[]; awaySlots: number[] }[]

export declare const getLeagueSubMatchCount: (
  format: LeagueFormat,
  teamSize: number,
) => number

export declare const getLeagueMatchesLabel: (
  format: LeagueFormat,
  teamSize: number,
) => string

export declare const getSupportedTeamSizes: (format: LeagueFormat) => string[]

export declare const ratingAtDate: (
  history: { periodId: number; period: string; rating: number }[] | undefined,
  onDate: string | undefined,
) => number | undefined

export declare const isRoundSelectionComplete: (
  selections: LeagueRoundSelection[],
  playingParticipantIds: string[],
  teamSize: number,
) => boolean

export declare const findDoubleBookedPlayers: (
  selections: LeagueRoundSelection[],
) => string[]

export declare const isRosterOpen: (
  currentRoundIndex: number,
  rosterOpenUntilRound: number | undefined,
  totalRounds: number,
) => boolean
