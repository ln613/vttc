import type { Event, Stage, Group, TournamentType } from '../../shared/types/Tournament'
import { apiGet, apiPost } from '../utils/api'
import { createStore, createAsyncState, type AsyncState } from './createStore'

interface EventManageState extends AsyncState<Event> {
  selectedEventId: string | null
  activeStageTab: 'group' | 'knockout'
  generatingGroups: boolean
}

const createInitialState = (): EventManageState => ({
  ...createAsyncState<Event>(),
  selectedEventId: null,
  activeStageTab: 'group',
  generatingGroups: false,
})

const eventManageStore = createStore<EventManageState>(createInitialState())

export const {
  useStore: useEventManageStore,
  useSelector: useEventManageSelector,
  getState: getEventManageState,
} = eventManageStore

export const eventManageActions = {
  selectEvent: async (eventId: string | null) => {
    setSelectedEventId(eventId)
    if (!eventId) {
      clearEventData()
      return
    }
    await fetchEvent(eventId)
  },

  setActiveStageTab: (tab: 'group' | 'knockout') => {
    eventManageStore.setState({ activeStageTab: tab })
  },

  generateGroups: async () => {
    const state = eventManageStore.getState()
    if (!state.selectedEventId) return

    setGeneratingGroups(true)
    try {
      await apiPost<Group[]>('generateGroups', { _id: state.selectedEventId })
      await fetchEvent(state.selectedEventId)
    } catch (err) {
      setErrorState(err)
    } finally {
      setGeneratingGroups(false)
    }
  },

  getEventStages: (): Stage[] => {
    const state = eventManageStore.getState()
    return state.data?.eventStages || []
  },

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

  getEventType: (): TournamentType | undefined => {
    const state = eventManageStore.getState()
    return state.data?.type
  },

  getPlayerColumnTitle: (): string => {
    const eventType = eventManageActions.getEventType()
    if (eventType === 'Double') return 'Players'
    if (eventType === 'Team') return 'Team'
    return 'Player'
  },

  reset: () => {
    eventManageStore.setState(createInitialState())
  },
}

const setSelectedEventId = (eventId: string | null) =>
  eventManageStore.setState({ selectedEventId: eventId })

const clearEventData = () =>
  eventManageStore.setState({ data: null, loading: false, error: null })

const fetchEvent = async (eventId: string) => {
  setLoadingState()
  try {
    const data = await apiGet<Event>('event', { _id: eventId })
    setSuccessState(data)
  } catch (err) {
    setErrorState(err)
  }
}

const setLoadingState = () =>
  eventManageStore.setState({ loading: true, error: null })

const setSuccessState = (data: Event) =>
  eventManageStore.setState({ data, loading: false, error: null })

const setErrorState = (err: unknown) =>
  eventManageStore.setState({
    loading: false,
    error: err instanceof Error ? err.message : 'Failed to fetch event',
  })

const setGeneratingGroups = (generating: boolean) =>
  eventManageStore.setState({ generatingGroups: generating })
