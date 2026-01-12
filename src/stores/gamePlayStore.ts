import type { Event, BestOfOption } from '../../shared/types/Tournament'
import type { Match } from '../../shared/types/Match'
import type { Player } from '../../shared/types/Player'
import { apiGet } from '../utils/api'
import { createStore, createAsyncState, type AsyncState } from './createStore'

interface GamePlayState extends AsyncState<Event> {
  eventId: string | null
  stage: 'group' | 'knockout'
  groupIndex: number
  matchId: string | null
  currentGameIndex: number
  score1: number
  score2: number
  servingSide: 1 | 2
  initialServingSide: 1 | 2
}

const createInitialState = (): GamePlayState => ({
  ...createAsyncState<Event>(),
  eventId: null,
  stage: 'group',
  groupIndex: 0,
  matchId: null,
  currentGameIndex: 0,
  score1: 0,
  score2: 0,
  servingSide: 1,
  initialServingSide: 1,
})

const gamePlayStore = createStore<GamePlayState>(createInitialState())

export const {
  useStore: useGamePlayStore,
  useSelector: useGamePlaySelector,
  getState: getGamePlayState,
} = gamePlayStore

export const gamePlayActions = {
  initializeFromUrl: async (params: URLSearchParams) => {
    const eventId = params.get('eventId')
    const stage = params.get('stage') as 'group' | 'knockout'
    const groupIndex = parseInt(params.get('groupIndex') || '0', 10)
    const matchId = params.get('matchId')

    validateParams(eventId, matchId)

    gamePlayStore.setState({
      eventId,
      stage,
      groupIndex,
      matchId,
      currentGameIndex: 0,
      score1: 0,
      score2: 0,
      servingSide: 1,
      initialServingSide: 1,
    })

    await fetchEvent(eventId!)
  },

  addPointToSide: (side: 1 | 2) => {
    const state = gamePlayStore.getState()
    const newScore1 = side === 1 ? state.score1 + 1 : state.score1
    const newScore2 = side === 2 ? state.score2 + 1 : state.score2
    const newServingSide = calculateServingSide(
      newScore1,
      newScore2,
      state.initialServingSide,
    )

    gamePlayStore.setState({
      score1: newScore1,
      score2: newScore2,
      servingSide: newServingSide,
    })
  },

  deductPointFromSide: (side: 1 | 2) => {
    const state = gamePlayStore.getState()
    const newScore1 = side === 1 ? Math.max(0, state.score1 - 1) : state.score1
    const newScore2 = side === 2 ? Math.max(0, state.score2 - 1) : state.score2
    const newServingSide = calculateServingSide(
      newScore1,
      newScore2,
      state.initialServingSide,
    )

    gamePlayStore.setState({
      score1: newScore1,
      score2: newScore2,
      servingSide: newServingSide,
    })
  },

  getCurrentMatch: (): Match | undefined => {
    const state = gamePlayStore.getState()
    if (!state.data || !state.matchId) return undefined

    const stages = state.data.eventStages || []
    const groupStage = stages.find((s) => s.type === 'group')
    if (!groupStage || groupStage.type !== 'group') return undefined

    const group = groupStage.groups.find((g) => g.index === state.groupIndex)
    if (!group) return undefined

    return group.matches.find((m) => m._id === state.matchId)
  },

  getSide1Players: (): Player[] => {
    const match = gamePlayActions.getCurrentMatch()
    return match?.side1 || []
  },

  getSide2Players: (): Player[] => {
    const match = gamePlayActions.getCurrentMatch()
    return match?.side2 || []
  },

  getStageName: (): string => {
    const state = gamePlayStore.getState()
    if (state.stage === 'group') {
      return `Group ${state.groupIndex + 1}`
    }
    // For knockout, we would need more info to determine round name
    return 'Knockout'
  },

  getNumberOfGames: (): number => {
    const state = gamePlayStore.getState()
    if (!state.data) return 5

    const bestOf =
      state.stage === 'group'
        ? state.data.groupGames
        : state.data.knockoutGames

    return parseBestOfOption(bestOf)
  },

  reset: () => {
    gamePlayStore.setState(createInitialState())
  },
}

const validateParams = (eventId: string | null, matchId: string | null) => {
  if (!eventId) throw new Error('Event ID is required')
  if (!matchId) throw new Error('Match ID is required')
}

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
  gamePlayStore.setState({ loading: true, error: null })

const setSuccessState = (data: Event) =>
  gamePlayStore.setState({ data, loading: false, error: null })

const setErrorState = (err: unknown) =>
  gamePlayStore.setState({
    loading: false,
    error: err instanceof Error ? err.message : 'Failed to fetch event',
  })

const calculateServingSide = (
  score1: number,
  score2: number,
  initialServingSide: 1 | 2,
): 1 | 2 => {
  const totalPoints = score1 + score2
  const serveBlocks = Math.floor(totalPoints / 2)
  const shouldSwitch = serveBlocks % 2 === 1
  return shouldSwitch
    ? initialServingSide === 1
      ? 2
      : 1
    : initialServingSide
}

const parseBestOfOption = (bestOf: BestOfOption | undefined): number => {
  if (!bestOf) return 5
  if (bestOf.includes('3')) return 3
  if (bestOf.includes('5')) return 5
  return 5
}
