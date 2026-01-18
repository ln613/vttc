import type { Event, BestOfOption } from '../../shared/types/Tournament'
import type { Match } from '../../shared/types/Match'
import type { Player } from '../../shared/types/Player'
import { apiGet, apiPost } from '../utils/api'
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
  leftSide: 1 | 2
  showInitDialog: boolean
  isSaving: boolean
  saveError: string | null
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
  leftSide: 1,
  showInitDialog: true,
  isSaving: false,
  saveError: null,
})

const gamePlayStore = createStore<GamePlayState>(createInitialState())

// Debounce timer reference
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null
const SAVE_DEBOUNCE_MS = 3000

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
      leftSide: 1,
      showInitDialog: true,
      isSaving: false,
      saveError: null,
    })

    await fetchEvent(eventId!)
  },

  setInitialServingSide: (side: 1 | 2) => {
    gamePlayStore.setState({
      initialServingSide: side,
      servingSide: side,
    })
  },

  setLeftSide: (side: 1 | 2) => {
    gamePlayStore.setState({ leftSide: side })
  },

  confirmInitDialog: () => {
    gamePlayStore.setState({ showInitDialog: false })
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

    debouncedSaveGame()
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

    debouncedSaveGame()
  },

  getCurrentMatch: (): Match | undefined => {
    const state = gamePlayStore.getState()
    if (!state.data || !state.matchId) return undefined

    const stages = state.data.eventStages || []
    
    // Check group stage
    const groupStage = stages.find((s) => s.type === 'group')
    if (groupStage && groupStage.type === 'group') {
      const group = groupStage.groups.find((g) => g.index === state.groupIndex)
      if (group) {
        const match = group.matches.find((m) => m._id === state.matchId)
        if (match) return match
      }
    }

    // Check knockout stage
    const knockoutStage = stages.find((s) => s.type === 'knockout')
    if (knockoutStage && knockoutStage.type === 'knockout') {
      for (const round of knockoutStage.rounds) {
        const knockoutMatch = round.matches.find((m) => m.match?._id === state.matchId)
        if (knockoutMatch?.match) return knockoutMatch.match
      }
    }

    return undefined
  },

  getSide1Players: (): Player[] => {
    const match = gamePlayActions.getCurrentMatch()
    return match?.side1 || []
  },

  getSide2Players: (): Player[] => {
    const match = gamePlayActions.getCurrentMatch()
    return match?.side2 || []
  },

  getLeftSidePlayers: (): Player[] => {
    const state = gamePlayStore.getState()
    return state.leftSide === 1
      ? gamePlayActions.getSide1Players()
      : gamePlayActions.getSide2Players()
  },

  getRightSidePlayers: (): Player[] => {
    const state = gamePlayStore.getState()
    return state.leftSide === 1
      ? gamePlayActions.getSide2Players()
      : gamePlayActions.getSide1Players()
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

  getParticipantName: (side: 1 | 2): string => {
    const players = side === 1
      ? gamePlayActions.getSide1Players()
      : gamePlayActions.getSide2Players()
    return formatPlayerNames(players)
  },

  saveGame: async () => {
    const state = gamePlayStore.getState()
    if (!state.eventId || !state.matchId) return

    gamePlayStore.setState({ isSaving: true, saveError: null })

    try {
      await apiPost('updateGame', {
        _id: state.eventId,
        matchId: state.matchId,
        gameNumber: state.currentGameIndex + 1,
        score: {
          score1: state.score1,
          score2: state.score2,
        },
      })
      gamePlayStore.setState({ isSaving: false })
    } catch (err) {
      gamePlayStore.setState({
        isSaving: false,
        saveError: err instanceof Error ? err.message : 'Failed to save game',
      })
    }
  },

  reset: () => {
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer)
      saveDebounceTimer = null
    }
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

const formatPlayerNames = (players: Player[]): string => {
  if (!players || players.length === 0) return 'Player'
  return players.map((p) => `${p.firstName} ${p.lastName}`).join(' / ')
}

const debouncedSaveGame = () => {
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer)
  }
  saveDebounceTimer = setTimeout(() => {
    gamePlayActions.saveGame()
    saveDebounceTimer = null
  }, SAVE_DEBOUNCE_MS)
}
