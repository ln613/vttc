import { createStore } from 'solid-js/store'
import type { Event, Stage, TournamentType } from '../../shared/types/Tournament'
import type { Group } from '../../shared/types/Tournament'
import type { Match } from '../../shared/types/Match'
import type { MatchPreview } from '../components/MatchConfirmDialog'
import { apiGet, apiPost } from '../utils/api'
import { waitForPendingSave } from './gamePlayStore'

interface EventDetailState {
  data: Event | null
  loading: boolean
  error: string | null
  eventId: string | null
  activeStageTab: 'group' | 'knockout'
  generatingGroups: boolean
  expandedMatchSchedules: Record<number, boolean>
  scrollPosition: number
  confirmingMatchId: string | null
  showConfirmDialog: boolean
  confirmDialogMatchId: string | null
}

const getInitialState = (): EventDetailState => ({
  data: null,
  loading: false,
  error: null,
  eventId: null,
  activeStageTab: 'group',
  generatingGroups: false,
  expandedMatchSchedules: {},
  scrollPosition: 0,
  confirmingMatchId: null,
  showConfirmDialog: false,
  confirmDialogMatchId: null,
})

const [eventDetailState, setEventDetailState] =
  createStore<EventDetailState>(getInitialState())

export { eventDetailState }

const fetchEvent = async (eventId: string, silent: boolean) => {
  if (!silent) {
    setEventDetailState({ loading: true, error: null })
  }
  try {
    const data = await apiGet<Event>('event', { _id: eventId })
    setEventDetailState({ data, loading: false, error: null })
  } catch (err) {
    setEventDetailState({
      loading: false,
      error: err instanceof Error ? err.message : 'Failed to fetch event',
    })
  }
}

export const eventDetailActions = {
  loadEvent: async (eventId: string) => {
    const isSameEvent = eventDetailState.eventId === eventId
    if (!isSameEvent) {
      setEventDetailState({
        ...getInitialState(),
        eventId,
      })
    }
    // Wait for any in-flight game save to complete before fetching
    await waitForPendingSave()
    await fetchEvent(eventId, isSameEvent && eventDetailState.data !== null)
  },

  setActiveStageTab: (tab: 'group' | 'knockout') => {
    setEventDetailState({ activeStageTab: tab })
  },

  toggleMatchSchedule: (groupIndex: number) => {
    const current = eventDetailState.expandedMatchSchedules[groupIndex] ?? false
    setEventDetailState('expandedMatchSchedules', groupIndex, !current)
  },

  isMatchScheduleExpanded: (groupIndex: number): boolean =>
    eventDetailState.expandedMatchSchedules[groupIndex] ?? false,

  saveScrollPosition: (position: number) => {
    setEventDetailState({ scrollPosition: position })
  },

  generateGroups: async () => {
    const { eventId } = eventDetailState
    if (!eventId) return

    setEventDetailState({ generatingGroups: true })
    try {
      await apiPost<Group[]>('generateGroups', { _id: eventId })
      await fetchEvent(eventId, false)
    } catch (err) {
      setEventDetailState({
        error:
          err instanceof Error ? err.message : 'Failed to generate groups',
      })
    } finally {
      setEventDetailState({ generatingGroups: false })
    }
  },

  getEventStages: (): Stage[] => eventDetailState.data?.eventStages || [],

  getGroupStage: () => {
    const stages = eventDetailActions.getEventStages()
    return stages.find(
      (s): s is Extract<Stage, { type: 'group' }> => s.type === 'group',
    )
  },

  getKnockoutStage: () => {
    const stages = eventDetailActions.getEventStages()
    return stages.find(
      (s): s is Extract<Stage, { type: 'knockout' }> => s.type === 'knockout',
    )
  },

  hasGroups: (): boolean => {
    const groupStage = eventDetailActions.getGroupStage()
    return (groupStage?.groups?.length ?? 0) > 0
  },

  getEventType: (): TournamentType | undefined =>
    eventDetailState.data?.type,

  getPlayerColumnTitle: (): string => {
    const eventType = eventDetailActions.getEventType()
    if (eventType === 'Double') return 'Players'
    if (eventType === 'Team') return 'Team'
    return 'Player'
  },

  showConfirmDialog: (matchId: string) => {
    setEventDetailState({
      showConfirmDialog: true,
      confirmDialogMatchId: matchId,
    })
  },

  cancelConfirmDialog: () => {
    setEventDetailState({
      showConfirmDialog: false,
      confirmDialogMatchId: null,
    })
  },

  getConfirmDialogMatch: (): Match | undefined => {
    const matchId = eventDetailState.confirmDialogMatchId
    if (!matchId || !eventDetailState.data) return undefined
    return findMatchById(eventDetailState.data, matchId)
  },

  getConfirmDialogPreview: (): MatchPreview | undefined => {
    const match = eventDetailActions.getConfirmDialogMatch()
    if (!match) return undefined
    return buildMatchPreview(match)
  },

  getConfirmDialogParticipantName: (side: 1 | 2): string => {
    const match = eventDetailActions.getConfirmDialogMatch()
    if (!match) return 'Player'
    const players = side === 1 ? match.side1 : match.side2
    if (!players || players.length === 0) return 'Player'
    return players.map((p) => `${p.firstName} ${p.lastName}`).join(' / ')
  },

  confirmMatch: async () => {
    const matchId = eventDetailState.confirmDialogMatchId
    const { eventId } = eventDetailState
    if (!eventId || !matchId) return

    setEventDetailState({ confirmingMatchId: matchId })
    try {
      await apiPost('confirmMatch', { _id: eventId, matchId })
      await fetchEvent(eventId, true)
    } catch (err) {
      setEventDetailState({
        error:
          err instanceof Error ? err.message : 'Failed to confirm match',
      })
    } finally {
      setEventDetailState({
        confirmingMatchId: null,
        showConfirmDialog: false,
        confirmDialogMatchId: null,
      })
    }
  },

  invalidateData: () => {
    setEventDetailState({ data: null })
  },

  reset: () => setEventDetailState(getInitialState()),
}

const findMatchById = (event: Event, matchId: string): Match | undefined => {
  for (const stage of event.eventStages || []) {
    if (stage.type === 'group') {
      for (const group of stage.groups) {
        const match = group.matches.find((m) => m._id === matchId)
        if (match) return match
      }
    }
    if (stage.type === 'knockout') {
      for (const round of stage.rounds) {
        const km = round.matches.find((m) => m.match?._id === matchId)
        if (km?.match) return km.match
      }
    }
  }
  return undefined
}

const buildMatchPreview = (match: Match): MatchPreview => ({
  gamesWon1: match.gamesWon1,
  gamesWon2: match.gamesWon2,
  games: match.games.map((g) => ({
    score1: g.score1,
    score2: g.score2,
    winningSide: g.winningSide,
  })),
})
