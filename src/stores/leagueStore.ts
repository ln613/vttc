import { createStore } from 'solid-js/store'
import type {
  Event,
  LeagueConfig,
  LeaguePairing,
  LeagueRoundSelection,
  LeagueStandingRow,
  Participant,
  Player,
  TournamentRestriction,
} from '../../shared/types'
import type { Match } from '../../shared/types/Match'
import {
  computeLeagueStandings,
  isRoundSelectionComplete,
} from '../../shared/rules/leagueRules'
import { apiGet, apiPost } from '../utils/api'
import { formatLocalDate } from '../utils/date'
import {
  subscribeToLiveScoreUpdates,
  type EventSubscription,
} from '../utils/pusher'
import { createJitteredRefetch } from '../utils/refetch'
import { countCall } from '../utils/counters' // TEMP diagnostic

/** One round/week, as the league endpoint returns it. */
export interface LeagueRoundView {
  _id: string
  roundIndex: number
  date: string
  time: string
  pairings: LeaguePairing[]
  byeParticipantId?: string
  selections: LeagueRoundSelection[]
  matches: Match[]
}

export interface LeagueView {
  leagueId: string
  leagueName: string
  league: LeagueConfig
  simulated: boolean
  teamSize: number
  restriction?: TournamentRestriction
  ratingLimit?: number
  topPlayersRatingEnabled: boolean
  topPlayersCount?: number
  topPlayersRatingLimit?: number
  participants: Participant[]
  paidPlayerIds: string[]
  // playerId -> rating on the league's start date. A league judges its
  // rating limits against the squad as it stood when the season began.
  leagueRatings: Record<string, number>
  rounds: LeagueRoundView[]
}

interface LeagueState {
  data: LeagueView | null
  leagueId: string | null
  loading: boolean
  error: string | null
  selectedRoundIndex: number
  generatingSchedule: boolean
  generatingMatches: boolean
  savingSelection: boolean
  resettingRound: boolean
  selectDialogParticipantId: string | null
  selectionError: string | null
}

const getInitialState = (): LeagueState => ({
  data: null,
  leagueId: null,
  loading: false,
  error: null,
  selectedRoundIndex: 0,
  generatingSchedule: false,
  generatingMatches: false,
  savingSelection: false,
  resettingRound: false,
  selectDialogParticipantId: null,
  selectionError: null,
})

const [leagueState, setLeagueState] =
  createStore<LeagueState>(getInitialState())

export { leagueState }

let subscription: EventSubscription | null = null

const unsubscribeLeague = () => {
  if (!subscription) return
  subscription.unsubscribe()
  subscription = null
}

// The league's rounds change whenever one of its matches does, so they ride
// the same broadcast every other live view uses — jittered and
// de-duplicated. Chaining the fetch onto fetchEvent instead meant a full
// getLeague (every round, every match) went out with *each* event refetch,
// doubling the request count and the bytes for data that mostly hadn't
// changed.
const subscribeForLeague = (leagueId: string) => {
  unsubscribeLeague()
  const refetch = createJitteredRefetch(() => fetchLeague(leagueId))
  subscription = subscribeToLiveScoreUpdates(() => {
    countCall('broadcast→league') // TEMP diagnostic
    if (leagueState.leagueId !== leagueId) return
    refetch()
  })
}

const fetchLeague = async (leagueId: string) => {
  countCall('fetchLeague') // TEMP diagnostic
  const data = await apiGet<LeagueView>('league', { leagueId })
  setLeagueState({ data, loading: false, error: null })
  return data
}

const withBusy = async (
  flag:
    | 'generatingSchedule'
    | 'generatingMatches'
    | 'savingSelection'
    | 'resettingRound',
  run: () => Promise<unknown>,
): Promise<boolean> => {
  setLeagueState({ [flag]: true, error: null } as Partial<LeagueState>)
  try {
    await run()
    const { leagueId } = leagueState
    if (leagueId) await fetchLeague(leagueId)
    return true
  } catch (err) {
    setLeagueState({
      error: err instanceof Error ? err.message : 'Something went wrong',
    })
    return false
  } finally {
    setLeagueState({ [flag]: false } as Partial<LeagueState>)
  }
}

export const leagueActions = {
  // Every round carries the league's id, so any round event can open it.
  load: async (event: Event | null) => {
    if (event?.eventType !== 'league') return
    const leagueId = event.leagueId || event._id
    const isSameLeague = leagueState.leagueId === leagueId
    // Already tracking this league — the subscription keeps it current, so
    // there is nothing to fetch here.
    if (isSameLeague && leagueState.data) return
    setLeagueState({ leagueId, loading: !isSameLeague })
    subscribeForLeague(leagueId)
    try {
      const data = await fetchLeague(leagueId)
      // Only on first open: a week the admin has since picked by hand stays
      // picked when the league refreshes.
      if (!isSameLeague) {
        setLeagueState({ selectedRoundIndex: upcomingRoundIndex(data) })
      }
    } catch (err) {
      setLeagueState({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load the league',
      })
    }
  },

  setSelectedRound: (roundIndex: number) =>
    setLeagueState({ selectedRoundIndex: roundIndex, selectionError: null }),

  openSelectDialog: (participantId: string) =>
    setLeagueState({
      selectDialogParticipantId: participantId,
      selectionError: null,
    }),

  closeSelectDialog: () =>
    setLeagueState({ selectDialogParticipantId: null, selectionError: null }),

  generateSchedule: async (): Promise<boolean> => {
    const round = leagueActions.getSelectedRound()
    if (!round) return false
    return withBusy('generatingSchedule', () =>
      apiPost('generateLeagueSchedule', { _id: round._id }),
    )
  },

  saveSelection: async (
    participantId: string,
    playerIds: string[],
  ): Promise<boolean> => {
    const round = leagueActions.getSelectedRound()
    if (!round) return false
    setLeagueState({ selectionError: null })
    const ok = await withBusy('savingSelection', () =>
      apiPost('saveLeagueRoundPlayers', {
        _id: round._id,
        participantId,
        playerIds,
      }),
    )
    if (ok) setLeagueState({ selectDialogParticipantId: null })
    else setLeagueState({ selectionError: leagueState.error })
    return ok
  },

  // Before a week is generated the table belongs to the fixture, so this is
  // the swap; once matches exist, switchMatchTables handles it.
  switchFixtureTable: async (
    homeParticipantId: string,
    tableNumber: number,
  ): Promise<boolean> => {
    const round = leagueActions.getSelectedRound()
    if (!round) return false
    return withBusy('savingSelection', () =>
      apiPost('switchLeagueFixtureTable', {
        _id: round._id,
        homeParticipantId,
        tableNumber,
      }),
    )
  },

  getFixtureTable: (homeParticipantId: string): number | undefined =>
    leagueActions
      .getSelectedRound()
      ?.pairings.find((p) => p.homeParticipantId === homeParticipantId)
      ?.tableNumber,

  // Simulated leagues only — fills in every team's line-up at once.
  autoSelectPlayers: async (): Promise<boolean> => {
    const round = leagueActions.getSelectedRound()
    if (!round) return false
    return withBusy('savingSelection', () =>
      apiPost('autoSelectLeagueRoundPlayers', { _id: round._id }),
    )
  },

  generateRoundMatches: async (): Promise<boolean> => {
    const round = leagueActions.getSelectedRound()
    if (!round) return false
    return withBusy('generatingMatches', () =>
      apiPost('generateLeagueRoundMatches', { _id: round._id }),
    )
  },

  resetRound: async (): Promise<boolean> => {
    const round = leagueActions.getSelectedRound()
    if (!round) return false
    return withBusy('resettingRound', () =>
      apiPost('resetLeagueRound', { _id: round._id }),
    )
  },

  // ----- Derived -----

  // The season exists once there is more than the first week, or once that
  // week has fixtures.
  isScheduleGenerated: (): boolean => {
    const rounds = leagueState.data?.rounds || []
    return rounds.length > 1 || (rounds[0]?.pairings?.length ?? 0) > 0
  },

  getRounds: (): LeagueRoundView[] => leagueState.data?.rounds || [],

  getSelectedRound: (): LeagueRoundView | undefined =>
    leagueActions
      .getRounds()
      .find((r) => r.roundIndex === leagueState.selectedRoundIndex) ||
    leagueActions.getRounds()[0],

  getParticipants: (): Participant[] => leagueState.data?.participants || [],

  getParticipant: (participantId: string): Participant | undefined =>
    leagueActions.getParticipants().find((p) => p._id === participantId),

  getTeamName: (participantId: string): string => {
    const participant = leagueActions.getParticipant(participantId)
    if (!participant) return ''
    return participant.teamName || describeTeam(participant.players)
  },

  /** The players a team fields in the selected round, in the order picked. */
  getSelectedPlayers: (participantId: string): Player[] => {
    const round = leagueActions.getSelectedRound()
    const participant = leagueActions.getParticipant(participantId)
    if (!round || !participant) return []
    const ids =
      round.selections.find((s) => s.participantId === participantId)
        ?.playerIds || []
    const byId = new Map(participant.players.map((p) => [p._id, p]))
    return ids.map((id) => byId.get(id)).filter((p): p is Player => !!p)
  },

  /** Teams with a fixture this week, home team first. */
  getPlayingParticipantIds: (): string[] => {
    const round = leagueActions.getSelectedRound()
    if (!round) return []
    return round.pairings.flatMap((p) => [
      p.homeParticipantId,
      p.awayParticipantId,
    ])
  },

  // What a player was rated when the season started; today's rating is the
  // fallback for anyone who has no period on record from before then.
  getLeagueRating: (player: Player): number =>
    leagueState.data?.leagueRatings?.[player._id?.toString()] ??
    player.rating ??
    0,

  /** Combined rating of the players a team fields this week. */
  getSelectedCombinedRating: (participantId: string): number =>
    leagueActions
      .getSelectedPlayers(participantId)
      .reduce((sum, player) => sum + leagueActions.getLeagueRating(player), 0),

  isSimulated: (): boolean => !!leagueState.data?.simulated,

  hasRoundMatches: (): boolean =>
    (leagueActions.getSelectedRound()?.matches.length ?? 0) > 0,

  canGenerateRoundMatches: (): boolean => {
    const round = leagueActions.getSelectedRound()
    if (!round || round.pairings.length === 0) return false
    return isRoundSelectionComplete(
      round.selections,
      leagueActions.getPlayingParticipantIds(),
      leagueActions.getTeamSize(),
    )
  },

  getTeamSize: (): number => leagueState.data?.teamSize ?? 3,

  getStandings: (): LeagueStandingRow[] =>
    computeLeagueStandings(
      leagueActions.getParticipants(),
      leagueActions.getRounds(),
    ),

  reset: () => {
    unsubscribeLeague()
    setLeagueState(getInitialState())
  },
}

/**
 * The week a league opens on: the next one to be played, by date, and the
 * last week once the season is over. Opening on week 1 every time would mean
 * scrolling past months of finished weeks by November.
 *
 * Dates are YYYY-MM-DD, so a string compare orders them correctly. Today
 * counts as upcoming — a match night should stay on its own week.
 */
const upcomingRoundIndex = (data: LeagueView): number => {
  const rounds = [...data.rounds].sort((a, b) => a.roundIndex - b.roundIndex)
  if (rounds.length === 0) return 0
  const today = formatLocalDate(new Date())
  const upcoming = rounds.find((round) => round.date >= today)
  return (upcoming ?? rounds[rounds.length - 1]).roundIndex
}

export const describeTeam = (players: Player[]): string =>
  players.map((p) => `${p.firstName} ${p.lastName}`).join(' / ')

export const formatRoundLabel = (round: LeagueRoundView): string =>
  `Week ${round.roundIndex + 1}, ${formatRoundDate(round.date)}`

const formatRoundDate = (date: string): string => {
  if (!date) return ''
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
