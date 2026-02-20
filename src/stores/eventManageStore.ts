import { createStore } from 'solid-js/store'
import type { Event, Stage, Group, TournamentType } from '../../shared/types/Tournament'
import { apiGet, apiPost } from '../utils/api'

interface EventManageState {
  data: Event | null
  loading: boolean
  error: string | null
  selectedEventId: string | null
  activeStageTab: 'group' | 'knockout'
  generatingGroups: boolean
}

const getInitialState = (): EventManageState => ({
  data: null,
  loading: false,
  error: null,
  selectedEventId: null,
  activeStageTab: 'group',
  generatingGroups: false,
})

const [eventManageState, setEventManageState] =
  createStore<EventManageState>(getInitialState())

export { eventManageState }

const fetchEvent = async (eventId: string) => {
  setEventManageState({ loading: true, error: null })
  try {
    const data = await apiGet<Event>('event', { _id: eventId })
    setEventManageState({ data, loading: false, error: null })
  } catch (err) {
    setEventManageState({
      loading: false,
      error: err instanceof Error ? err.message : 'Failed to fetch event',
    })
  }
}

export const eventManageActions = {
  selectEvent: async (eventId: string | null) => {
    setEventManageState({ selectedEventId: eventId })
    if (!eventId) {
      setEventManageState({ data: null, loading: false, error: null })
      return
    }
    await fetchEvent(eventId)
  },

  setActiveStageTab: (tab: 'group' | 'knockout') => {
    setEventManageState({ activeStageTab: tab })
  },

  generateGroups: async () => {
    const { selectedEventId } = eventManageState
    if (!selectedEventId) return

    setEventManageState({ generatingGroups: true })
    try {
      await apiPost<Group[]>('generateGroups', { _id: selectedEventId })
      await fetchEvent(selectedEventId)
    } catch (err) {
      setEventManageState({
        error: err instanceof Error ? err.message : 'Failed to generate groups',
      })
    } finally {
      setEventManageState({ generatingGroups: false })
    }
  },

  getEventStages: (): Stage[] => eventManageState.data?.eventStages || [],

  getGroupStage: () => {
    const stages = eventManageActions.getEventStages()
    return stages.find((s): s is Extract<Stage, { type: 'group' }> => s.type === 'group')
  },

  getKnockoutStage: () => {
    const stages = eventManageActions.getEventStages()
    return stages.find(
      (s): s is Extract<Stage, { type: 'knockout' }> => s.type === 'knockout',
    )
  },

  hasGroups: (): boolean => {
    const groupStage = eventManageActions.getGroupStage()
    return (groupStage?.groups?.length ?? 0) > 0
  },

  getEventType: (): TournamentType | undefined => eventManageState.data?.type,

  getPlayerColumnTitle: (): string => {
    const eventType = eventManageActions.getEventType()
    if (eventType === 'Double') return 'Players'
    if (eventType === 'Team') return 'Team'
    return 'Player'
  },

  reset: () => setEventManageState(getInitialState()),
}
