import { createStore } from 'solid-js/store'
import type {
  Event,
  Stage,
  TournamentType,
  BestOfOption,
  Group,
  KnockoutStage,
  KnockoutRound,
  Participant,
} from '../../shared/types/Tournament'
import type { Match } from '../../shared/types/Match'
import type { MatchPreview } from '../components/MatchConfirmDialog'
import { apiGet, apiPost } from '../utils/api'
import { waitForPendingSave } from './gamePlayStore'
import { subscribeToEventUpdates, type EventSubscription } from '../utils/pusher'
import { eventState, eventActions } from './eventStore'
import { authState } from './authStore'
import { getProvisionalMatchResult } from '../../shared/rules/matchRules'

export type StageTab = 'group' | 'knockout' | 'bracket'

interface EventDetailState {
  data: Event | null
  loading: boolean
  error: string | null
  eventId: string | null
  activeStageTab: StageTab
  generatingGroups: boolean
  generatingNextRound: boolean
  expandedMatchSchedules: Record<number, boolean>
  scrollPosition: number
  confirmingMatchId: string | null
  showConfirmDialog: boolean
  confirmDialogMatchId: string | null
  confirmDialogEventId: string | null
  // Set Order dialog for a parent team match.
  showOrderDialog: boolean
  orderDialogMatchId: string | null
  orderDialogEventId: string | null
  savingOrderSide: 1 | 2 | null
  // Assign-to-table dialog for a queued match (admin only).
  showAssignDialog: boolean
  assignDialogMatchId: string | null
  assignDialogEventId: string | null
  assigningTableNumber: number | null
  resettingMatchId: string | null
  resettingEvent: boolean
  toastMessage: ToastMessage | null
}

interface ToastMessage {
  type: 'success' | 'error'
  text: string
}

const getInitialState = (): EventDetailState => ({
  data: null,
  loading: false,
  error: null,
  eventId: null,
  activeStageTab: 'group',
  generatingGroups: false,
  generatingNextRound: false,
  expandedMatchSchedules: {},
  scrollPosition: 0,
  confirmingMatchId: null,
  showConfirmDialog: false,
  confirmDialogMatchId: null,
  confirmDialogEventId: null,
  showOrderDialog: false,
  orderDialogMatchId: null,
  orderDialogEventId: null,
  savingOrderSide: null,
  showAssignDialog: false,
  assignDialogMatchId: null,
  assignDialogEventId: null,
  assigningTableNumber: null,
  resettingMatchId: null,
  toastMessage: null,
  resettingEvent: false,
})

const [eventDetailState, setEventDetailState] =
  createStore<EventDetailState>(getInitialState())

export { eventDetailState }

let currentSubscription: EventSubscription | null = null

const unsubscribeCurrent = () => {
  if (currentSubscription) {
    currentSubscription.unsubscribe()
    currentSubscription = null
  }
}

const subscribeForEvent = (eventId: string) => {
  unsubscribeCurrent()
  currentSubscription = subscribeToEventUpdates(eventId, () => {
    if (eventDetailState.eventId === eventId) {
      void fetchEvent(eventId, true)
    }
  })
}

const showToast = (type: 'success' | 'error', text: string) => {
  setEventDetailState({ toastMessage: { type, text } })
  setTimeout(() => setEventDetailState({ toastMessage: null }), 3000)
}

const simulateGames = (
  numberOfGames: number,
  targetPoints: number,
): { score1: number; score2: number }[] => {
  const needed = Math.ceil(numberOfGames / 2)
  const games: { score1: number; score2: number }[] = []
  let won1 = 0
  let won2 = 0
  while (won1 < needed && won2 < needed) {
    const side1Wins = Math.random() < 0.5
    const loserScore = Math.floor(Math.random() * (targetPoints - 1))
    if (side1Wins) {
      games.push({ score1: targetPoints, score2: loserScore })
      won1++
    } else {
      games.push({ score1: loserScore, score2: targetPoints })
      won2++
    }
  }
  return games
}

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
      subscribeForEvent(eventId)
    }
    // Wait for any in-flight game save to complete before fetching
    await waitForPendingSave()
    await fetchEvent(eventId, isSameEvent && eventDetailState.data !== null)
  },

  setActiveStageTab: (tab: StageTab) => {
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
      showToast(
        'error',
        err instanceof Error ? err.message : 'Failed to generate groups',
      )
    } finally {
      setEventDetailState({ generatingGroups: false })
    }
  },

  dismissToast: () => {
    setEventDetailState({ toastMessage: null })
  },

  simulateMatch: async (
    matchId: string,
    match: {
      config?: {
        numberOfGames?: number
        gameConfig?: { targetPoints?: number }
      }
    },
    sourceEventId?: string,
  ) => {
    const eventId = sourceEventId ?? eventDetailState.eventId
    if (!eventId) return
    const numberOfGames = match.config?.numberOfGames ?? 5
    const targetPoints = match.config?.gameConfig?.targetPoints ?? 11
    const games = simulateGames(numberOfGames, targetPoints)
    try {
      await apiPost('finishMatch', {
        _id: eventId,
        matchId,
        confirmed: true,
        result: games,
      })
      if (eventDetailState.eventId === eventId) {
        await fetchEvent(eventId, true)
      }
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'Failed to simulate match',
      )
    }
  },

  getEventStages: (): Stage[] => eventDetailState.data?.eventStages || [],

  getGroupStage: () => {
    const stages = eventDetailActions.getEventStages()
    return stages.find(
      (s): s is Extract<Stage, { type: 'group' }> => s.type === 'group',
    )
  },

  getKnockoutStage: (): KnockoutStage | undefined => {
    const stages = eventDetailActions.getEventStages()
    return stages.find(
      (s): s is Extract<Stage, { type: 'knockout' }> => s.type === 'knockout',
    )
  },

  hasGroups: (): boolean => {
    const groupStage = eventDetailActions.getGroupStage()
    return (groupStage?.groups?.length ?? 0) > 0
  },

  hasKnockoutRounds: (): boolean => {
    const knockoutStage = eventDetailActions.getKnockoutStage()
    return (knockoutStage?.rounds?.length ?? 0) > 0
  },

  getVisibleTabs: (): StageTab[] => {
    const event = eventDetailState.data
    if (!event) return []
    const stagesArray = event.stages || []
    const tabs: StageTab[] = []
    if (stagesArray.includes('group')) tabs.push('group')
    if (stagesArray.includes('knockout')) {
      tabs.push('knockout')
      tabs.push('bracket')
    }
    return tabs
  },

  getDefaultTab: (): StageTab => {
    const tabs = eventDetailActions.getVisibleTabs()
    return tabs.length > 0 ? tabs[0] : 'group'
  },

  /**
   * Check if the "Generate Next Round" button should be visible in knockout tab.
   * Visible when: previous round/groups are complete AND current round has no matches yet.
   */
  canGenerateNextRound: (): boolean => {
    const knockoutStage = eventDetailActions.getKnockoutStage()
    if (!knockoutStage) return false

    const groupStage = eventDetailActions.getGroupStage()
    const isGroupStageComplete = groupStage
      ? groupStage.groups.length > 0 &&
        groupStage.groups.every((g) => g.isComplete)
      : true

    // No rounds yet: check if group stage is complete
    if (knockoutStage.rounds.length === 0) {
      if (groupStage) {
        return isGroupStageComplete
      }
      // Knockout-only: always can generate first round if participants exist
      return (eventDetailState.data?.participants?.length ?? 0) >= 4
    }

    // Find the first empty placeholder round.
    const emptyRoundIdx = knockoutStage.rounds.findIndex(
      (r) => r.matches.length === 0,
    )
    if (emptyRoundIdx === -1) return false

    // First round: require group stage complete (or no group stage).
    if (emptyRoundIdx === 0) {
      return isGroupStageComplete
    }

    // Otherwise: previous round must have all matches finished + confirmed.
    const prevRound = knockoutStage.rounds[emptyRoundIdx - 1]
    return (
      prevRound.matches.length > 0 &&
      prevRound.matches.every(
        (m) =>
          m.match?.winningSide != null && m.match?.confirmed === true,
      )
    )
  },

  generateNextRound: async () => {
    const { eventId } = eventDetailState
    if (!eventId) return

    setEventDetailState({ generatingNextRound: true })
    try {
      await apiPost('generateKnockout', { _id: eventId })
      await fetchEvent(eventId, false)
    } catch (err) {
      setEventDetailState({
        error:
          err instanceof Error ? err.message : 'Failed to generate next round',
      })
    } finally {
      setEventDetailState({ generatingNextRound: false })
    }
  },

  getKnockoutRounds: (): KnockoutRound[] => {
    const knockoutStage = eventDetailActions.getKnockoutStage()
    return knockoutStage?.rounds || []
  },

  getEventType: (): TournamentType | undefined =>
    eventDetailState.data?.type,

  getPlayerColumnTitle: (): string => {
    const eventType = eventDetailActions.getEventType()
    if (eventType === 'Double') return 'Players'
    if (eventType === 'Team') return 'Team'
    return 'Player'
  },

  showConfirmDialog: (matchId: string, eventId?: string) => {
    setEventDetailState({
      showConfirmDialog: true,
      confirmDialogMatchId: matchId,
      confirmDialogEventId: eventId ?? eventDetailState.eventId,
    })
  },

  cancelConfirmDialog: () => {
    setEventDetailState({
      showConfirmDialog: false,
      confirmDialogMatchId: null,
      confirmDialogEventId: null,
    })
  },

  openOrderDialog: (matchId: string, eventId?: string) => {
    const resolvedEventId = eventId ?? eventDetailState.eventId
    setEventDetailState({
      showOrderDialog: true,
      orderDialogMatchId: matchId,
      orderDialogEventId: resolvedEventId,
    })
    if (authState.isAdmin) return
    // Players: tell the server we've opened the dialog so admins can
    // see that the side is being handled by a player.
    const match = eventDetailActions.getOrderDialogMatch()
    if (!match || !resolvedEventId) return
    const uid = authState.user?._id?.toString()
    if (!uid) return
    const side =
      (match.side1 || []).some((p) => p._id?.toString() === uid)
        ? 1
        : (match.side2 || []).some((p) => p._id?.toString() === uid)
          ? 2
          : undefined
    if (!side) return
    void apiPost('markTeamMatchSideOpened', {
      _id: resolvedEventId,
      matchId,
      side,
    }).catch(() => {})
  },

  closeOrderDialog: () => {
    setEventDetailState({
      showOrderDialog: false,
      orderDialogMatchId: null,
      orderDialogEventId: null,
      savingOrderSide: null,
    })
  },

  openAssignDialog: (matchId: string, eventId?: string) => {
    setEventDetailState({
      showAssignDialog: true,
      assignDialogMatchId: matchId,
      assignDialogEventId: eventId ?? eventDetailState.eventId,
    })
  },

  closeAssignDialog: () => {
    setEventDetailState({
      showAssignDialog: false,
      assignDialogMatchId: null,
      assignDialogEventId: null,
      assigningTableNumber: null,
    })
  },

  assignMatchToTable: async (tableNumber: number) => {
    const matchId = eventDetailState.assignDialogMatchId
    const eventId =
      eventDetailState.assignDialogEventId ?? eventDetailState.eventId
    if (!matchId || !eventId) return
    setEventDetailState({ assigningTableNumber: tableNumber })
    try {
      await apiPost('assignMatchToTable', {
        _id: eventId,
        matchId,
        tableNumber,
      })
      if (eventDetailState.eventId === eventId) {
        await fetchEvent(eventId, true)
      }
    } catch (err) {
      setEventDetailState({
        error:
          err instanceof Error ? err.message : 'Failed to assign match to table',
      })
    } finally {
      setEventDetailState({
        showAssignDialog: false,
        assignDialogMatchId: null,
        assignDialogEventId: null,
        assigningTableNumber: null,
      })
    }
  },

  getOrderDialogMatch: (): Match | undefined => {
    const matchId = eventDetailState.orderDialogMatchId
    if (!matchId) return undefined
    if (eventDetailState.data) {
      const m = findMatchById(eventDetailState.data, matchId)
      if (m) return m
    }
    for (const event of eventState.data || []) {
      const m = findMatchById(event, matchId)
      if (m) return m
    }
    return undefined
  },

  saveOrderForSide: async (side: 1 | 2, assignmentIds: string[]) => {
    const matchId = eventDetailState.orderDialogMatchId
    const eventId =
      eventDetailState.orderDialogEventId ?? eventDetailState.eventId
    if (!matchId || !eventId) return
    setEventDetailState({ savingOrderSide: side })
    try {
      await apiPost('saveTeamMatchAssignment', {
        _id: eventId,
        matchId,
        side,
        assignmentIds,
      })
      if (eventDetailState.eventId === eventId) {
        await fetchEvent(eventId, true)
      }
    } catch (err) {
      setEventDetailState({
        error:
          err instanceof Error
            ? err.message
            : 'Failed to save team match order',
      })
    } finally {
      setEventDetailState({ savingOrderSide: null })
    }
  },

  getConfirmDialogMatch: (): Match | undefined => {
    const matchId = eventDetailState.confirmDialogMatchId
    if (!matchId) return undefined
    if (eventDetailState.data) {
      const m = findMatchById(eventDetailState.data, matchId)
      if (m) return m
    }
    for (const event of eventState.data || []) {
      const m = findMatchById(event, matchId)
      if (m) return m
    }
    return undefined
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
    const eventId =
      eventDetailState.confirmDialogEventId ?? eventDetailState.eventId
    if (!eventId || !matchId) return

    setEventDetailState({ confirmingMatchId: matchId })
    try {
      await apiPost('confirmMatch', { _id: eventId, matchId })
      if (eventDetailState.eventId === eventId) {
        await fetchEvent(eventId, true)
      }
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
        confirmDialogEventId: null,
      })
    }
  },

  /**
   * Check if a match can be reset (only for admin).
   * A match can be reset if it is finished and confirmed,
   * and no match in the next round has started/finished.
   */
  canResetMatch: (
    matchId: string,
    stage: 'group' | 'knockout',
    groupIndex: number,
    sourceEventId?: string,
  ): boolean => {
    // Look up the event from the EventDetail page first, then fall back
    // to the shared events list so this works from Schedule too (where
    // eventDetailState.data is null).
    const event = resolveEventForMatch(matchId, sourceEventId)
    if (!event) return false

    if (stage === 'group') {
      return canResetGroupMatch(event, matchId)
    }
    return canResetKnockoutMatch(event, matchId, groupIndex)
  },

  resetMatch: async (matchId: string, sourceEventId?: string) => {
    const eventId = sourceEventId ?? eventDetailState.eventId
    if (!eventId || !matchId) return

    setEventDetailState({ resettingMatchId: matchId })
    try {
      await apiPost('resetMatch', { _id: eventId, matchId })
      if (eventDetailState.eventId === eventId) {
        await fetchEvent(eventId, true)
      }
      // Refresh the shared events list too so consumers that read
      // from eventState (Schedule, EventList) update immediately
      // instead of waiting for the pusher live-score ping.
      void eventActions.refreshEvents()
    } catch (err) {
      setEventDetailState({
        error:
          err instanceof Error ? err.message : 'Failed to reset match',
      })
    } finally {
      setEventDetailState({ resettingMatchId: null })
    }
  },

  getEventSummary: (): string => {
    const event = eventDetailState.data
    if (!event) return ''
    return buildEventSummary(event)
  },

  resetEvent: async () => {
    const { eventId } = eventDetailState
    if (!eventId) return

    setEventDetailState({ resettingEvent: true })
    try {
      await apiPost('resetEvent', { _id: eventId })
      await fetchEvent(eventId, false)
    } catch (err) {
      setEventDetailState({
        error:
          err instanceof Error ? err.message : 'Failed to reset event',
      })
    } finally {
      setEventDetailState({ resettingEvent: false })
    }
  },

  getParticipants: (): Participant[] =>
    [...(eventDetailState.data?.participants || [])].sort(
      (a, b) => (b.rating || 0) - (a.rating || 0),
    ),

  invalidateData: () => {
    setEventDetailState({ data: null })
  },

  reset: () => {
    unsubscribeCurrent()
    setEventDetailState(getInitialState())
  },
}

// Find an event that contains the given match. Tries the EventDetail
// page's loaded event first, then the shared events list (used by
// Schedule). sourceEventId narrows the search when provided.
const resolveEventForMatch = (
  matchId: string,
  sourceEventId?: string,
): { eventStages?: Stage[] } | undefined => {
  if (sourceEventId && eventDetailState.data?._id === sourceEventId) {
    return eventDetailState.data
  }
  if (sourceEventId) {
    const evt = (eventState.data || []).find((e) => e._id === sourceEventId)
    if (evt) return evt
  }
  if (eventDetailState.data) {
    const found = findMatchById(eventDetailState.data, matchId)
    if (found) return eventDetailState.data
  }
  for (const evt of eventState.data || []) {
    const found = findMatchById(evt, matchId)
    if (found) return evt
  }
  return undefined
}

const canResetGroupMatch = (event: { eventStages?: Stage[] }, matchId: string): boolean => {
  const groupStage = event.eventStages?.find(
    (s): s is Extract<Stage, { type: 'group' }> => s.type === 'group',
  )
  if (!groupStage) return false

  // Find the match in any group
  for (const group of groupStage.groups) {
    const match = group.matches.find((m) => m._id === matchId)
    if (!match) continue
    if (match.winningSide == null || !match.confirmed) return false

    // Check if any knockout round match has started
    const knockoutStage = event.eventStages?.find(
      (s): s is Extract<Stage, { type: 'knockout' }> => s.type === 'knockout',
    )
    if (!knockoutStage || knockoutStage.rounds.length === 0) return true

    const firstRound = knockoutStage.rounds[0]
    const anyFinished = firstRound.matches.some(
      (m) => m.match && m.match.winningSide != null,
    )
    return !anyFinished
  }

  return false
}

const canResetKnockoutMatch = (
  event: { eventStages?: Stage[] },
  matchId: string,
  roundIndex: number,
): boolean => {
  const knockoutStage = event.eventStages?.find(
    (s): s is Extract<Stage, { type: 'knockout' }> => s.type === 'knockout',
  )
  if (!knockoutStage) return false

  // Find the match
  for (const round of knockoutStage.rounds) {
    const km = round.matches.find((m) => m.match?._id === matchId)
    if (!km) continue
    if (!km.match || km.match.winningSide == null || !km.match.confirmed) return false

    // Check if next round has any started matches
    const nextRoundIndex = round.index + 1
    if (nextRoundIndex >= knockoutStage.rounds.length) return true

    const nextRound = knockoutStage.rounds[nextRoundIndex]
    if (!nextRound.matches || nextRound.matches.length === 0) return true

    const anyFinished = nextRound.matches.some(
      (m) => m.match && m.match.winningSide != null,
    )
    return !anyFinished
  }

  return false
}

const findMatchById = (
  event: { eventStages?: Event['eventStages'] },
  matchId: string,
): Match | undefined => {
  for (const stage of event.eventStages || []) {
    if (stage.type === 'group') {
      for (const group of stage.groups) {
        const found = findInMatchList(group.matches, matchId)
        if (found) return found
      }
    }
    if (stage.type === 'knockout') {
      for (const round of stage.rounds) {
        for (const km of round.matches) {
          if (!km.match) continue
          const found = findInMatchList([km.match], matchId)
          if (found) return found
        }
      }
    }
  }
  return undefined
}

// Search top-level matches AND any team match's subMatches[] so that
// sub-match-driven flows (Confirm/Reset dialogs on a team sub-match row)
// can locate the right Match.
const findInMatchList = (matches: Match[], matchId: string): Match | undefined => {
  for (const m of matches) {
    if (m._id === matchId) return m
    if (m.subMatches && m.subMatches.length > 0) {
      const sub = findInMatchList(m.subMatches, matchId)
      if (sub) return sub
    }
  }
  return undefined
}

const buildMatchPreview = (match: Match): MatchPreview => {
  const provisional = getProvisionalMatchResult(match)
  return {
    gamesWon1: provisional.gamesWon1,
    gamesWon2: provisional.gamesWon2,
    games: match.games.map((g) => ({
      score1: g.score1,
      score2: g.score2,
      winningSide: g.winningSide,
    })),
  }
}

const isKnockoutBestOf3Before = (knockoutGames: BestOfOption): boolean =>
  knockoutGames === 'Best of 3 before Semifinal' ||
  knockoutGames === 'Best of 3 before Quarterfinal'

const buildEventSummary = (event: Event): string => {
  const parts: string[] = []
  const hasGroup = event.stages?.includes('group')
  const hasKnockout = event.stages?.includes('knockout')
  const knockoutIsBestOf3Before =
    hasKnockout && isKnockoutBestOf3Before(event.knockoutGames)

  if (knockoutIsBestOf3Before) {
    // "Best of 3 before Semifinal/Quarterfinal" already covers group (Best of 3)
    parts.push(event.knockoutGames)
  } else {
    if (hasGroup) {
      parts.push(`${event.groupGames} in group`)
    }
    if (hasKnockout) {
      parts.push(`${event.knockoutGames} in knockout`)
    }
  }

  if (event.handicapEnabled) {
    parts.push(`Handicap (${event.handicapDifference})`)
  }

  return parts.join(', ')
}
