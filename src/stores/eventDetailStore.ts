import { createStore } from 'solid-js/store'
import type { Event, Stage, TournamentType } from '../../shared/types/Tournament'
import type { Group } from '../../shared/types/Tournament'
import { apiGet, apiPost } from '../utils/api'

interface EventDetailState {
  data: Event | null
  loading: boolean
  error: string | null
  eventId: string | null
  activeStageTab: 'group' | 'knockout'
  generatingGroups: boolean
}

const getInitialState = (): EventDetailState => ({
  data: null,
  loading: false,
  error: null,
  eventId: null,
  activeStageTab: 'group',
  generatingGroups: false,
})

const [eventDetailState, setEventDetailState] =
  createStore<EventDetailState>(getInitialState())

export { eventDetailState }

const fetchEvent = async (eventId: string) => {
  setEventDetailState({ loading: true, error: null })
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
    setEventDetailState({ eventId })
    await fetchEvent(eventId)
  },

  setActiveStageTab: (tab: 'group' | 'knockout') => {
    setEventDetailState({ activeStageTab: tab })
  },

  generateGroups: async () => {
    const { eventId } = eventDetailState
    if (!eventId) return

    setEventDetailState({ generatingGroups: true })
    try {
      await apiPost<Group[]>('generateGroups', { _id: eventId })
      await fetchEvent(eventId)
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

  reset: () => setEventDetailState(getInitialState()),
}
