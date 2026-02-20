import { createStore } from 'solid-js/store'
import type { Event, BestOfOption } from '../../shared/types/Tournament'
import type { Match } from '../../shared/types/Match'
import type { Player } from '../../shared/types/Player'
import { apiGet, apiPost } from '../utils/api'

interface GamePlayState {
  data: Event | null
  loading: boolean
  error: string | null
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
  timeout1: boolean
  timeout2: boolean
}

const getInitialState = (): GamePlayState => ({
  data: null,
  loading: false,
  error: null,
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
  timeout1: false,
  timeout2: false,
})

const [gamePlayState, setGamePlayState] =
  createStore<GamePlayState>(getInitialState())

// Debounce timer reference
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null
const SAVE_DEBOUNCE_MS = 3000

export { gamePlayState }

const validateParams = (eventId: string | null, matchId: string | null) => {
  if (!eventId) throw new Error('Event ID is required')
  if (!matchId) throw new Error('Match ID is required')
}

const fetchEvent = async (eventId: string) => {
  setGamePlayState({ loading: true, error: null })
  try {
    const data = await apiGet<Event>('event', { _id: eventId })
    setGamePlayState({ data, loading: false, error: null })
  } catch (err) {
    setGamePlayState({
      loading: false,
      error: err instanceof Error ? err.message : 'Failed to fetch event',
    })
  }
}

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

export const gamePlayActions = {
  initializeFromUrl: async (params: URLSearchParams) => {
    const eventId = params.get('eventId')
    const stage = params.get('stage') as 'group' | 'knockout'
    const groupIndex = parseInt(params.get('groupIndex') || '0', 10)
    const matchId = params.get('matchId')

    validateParams(eventId, matchId)

    setGamePlayState({
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
    setGamePlayState({
      initialServingSide: side,
      servingSide: side,
    })
  },

  setLeftSide: (side: 1 | 2) => {
    setGamePlayState({ leftSide: side })
  },

  toggleTimeout: (side: 1 | 2) => {
    if (side === 1) {
      setGamePlayState({ timeout1: !gamePlayState.timeout1 })
    } else {
      setGamePlayState({ timeout2: !gamePlayState.timeout2 })
    }
  },

  confirmInitDialog: () => {
    setGamePlayState({ showInitDialog: false })
  },

  addPointToSide: (side: 1 | 2) => {
    const newScore1 = side === 1 ? gamePlayState.score1 + 1 : gamePlayState.score1
    const newScore2 = side === 2 ? gamePlayState.score2 + 1 : gamePlayState.score2
    const newServingSide = calculateServingSide(
      newScore1,
      newScore2,
      gamePlayState.initialServingSide,
    )

    setGamePlayState({
      score1: newScore1,
      score2: newScore2,
      servingSide: newServingSide,
    })

    debouncedSaveGame()
  },

  deductPointFromSide: (side: 1 | 2) => {
    const newScore1 = side === 1 ? Math.max(0, gamePlayState.score1 - 1) : gamePlayState.score1
    const newScore2 = side === 2 ? Math.max(0, gamePlayState.score2 - 1) : gamePlayState.score2
    const newServingSide = calculateServingSide(
      newScore1,
      newScore2,
      gamePlayState.initialServingSide,
    )

    setGamePlayState({
      score1: newScore1,
      score2: newScore2,
      servingSide: newServingSide,
    })

    debouncedSaveGame()
  },

  getCurrentMatch: (): Match | undefined => {
    if (!gamePlayState.data || !gamePlayState.matchId) return undefined

    const stages = gamePlayState.data.eventStages || []

    // Check group stage
    const groupStage = stages.find((s) => s.type === 'group')
    if (groupStage && groupStage.type === 'group') {
      const group = groupStage.groups.find((g) => g.index === gamePlayState.groupIndex)
      if (group) {
        const match = group.matches.find((m) => m._id === gamePlayState.matchId)
        if (match) return match
      }
    }

    // Check knockout stage
    const knockoutStage = stages.find((s) => s.type === 'knockout')
    if (knockoutStage && knockoutStage.type === 'knockout') {
      for (const round of knockoutStage.rounds) {
        const knockoutMatch = round.matches.find((m) => m.match?._id === gamePlayState.matchId)
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

  getLeftSidePlayers: (): Player[] =>
    gamePlayState.leftSide === 1
      ? gamePlayActions.getSide1Players()
      : gamePlayActions.getSide2Players(),

  getRightSidePlayers: (): Player[] =>
    gamePlayState.leftSide === 1
      ? gamePlayActions.getSide2Players()
      : gamePlayActions.getSide1Players(),

  getStageName: (): string => {
    if (gamePlayState.stage === 'group') {
      return `Group ${gamePlayState.groupIndex + 1}`
    }
    // For knockout, we would need more info to determine round name
    return 'Knockout'
  },

  getNumberOfGames: (): number => {
    if (!gamePlayState.data) return 5

    const bestOf =
      gamePlayState.stage === 'group'
        ? gamePlayState.data.groupGames
        : gamePlayState.data.knockoutGames

    return parseBestOfOption(bestOf)
  },

  getParticipantName: (side: 1 | 2): string => {
    const players =
      side === 1
        ? gamePlayActions.getSide1Players()
        : gamePlayActions.getSide2Players()
    return formatPlayerNames(players)
  },

  saveGame: async () => {
    if (!gamePlayState.eventId || !gamePlayState.matchId) return

    setGamePlayState({ isSaving: true, saveError: null })

    try {
      await apiPost('updateGame', {
        _id: gamePlayState.eventId,
        matchId: gamePlayState.matchId,
        gameNumber: gamePlayState.currentGameIndex + 1,
        score: {
          score1: gamePlayState.score1,
          score2: gamePlayState.score2,
        },
      })
      setGamePlayState({ isSaving: false })
    } catch (err) {
      setGamePlayState({
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
    setGamePlayState(getInitialState())
  },
}
