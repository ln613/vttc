import { createStore } from 'solid-js/store'
import type { Event, BestOfOption } from '../../shared/types/Tournament'
import type { Match, GameConfig } from '../../shared/types/Match'
import { DEFAULT_GAME_CONFIG } from '../../shared/types/Match'
import type { Player } from '../../shared/types/Player'
import { apiGet, apiPost } from '../utils/api'
import {
  validateGameScore,
  determineGameWinner,
  gamesNeededToWin,
} from '../../shared/rules/matchRules'

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
  gamesWon1: number
  gamesWon2: number
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
  gamesWon1: 0,
  gamesWon2: 0,
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
    restoreMatchSetupIfExists()
  } catch (err) {
    setGamePlayState({
      loading: false,
      error: err instanceof Error ? err.message : 'Failed to fetch event',
    })
  }
}

const restoreMatchSetupIfExists = () => {
  const match = gamePlayActions.getCurrentMatch()
  if (!match) return
  if (match.initialServingSide && match.leftSide) {
    setGamePlayState({
      initialServingSide: match.initialServingSide,
      leftSide: match.leftSide,
      showInitDialog: false,
    })
    restoreGameProgress(match)
  }
}

const restoreGameProgress = (match: Match) => {
  const gamesWon1 = match.games.filter((g) => g.winningSide === 1).length
  const gamesWon2 = match.games.filter((g) => g.winningSide === 2).length

  // Find the current game: latest game without a winner, or the next game index
  const currentGameIndex = findCurrentGameIndex(match)
  const currentGame = match.games[currentGameIndex]

  const score1 = currentGame?.score1 ?? 0
  const score2 = currentGame?.score2 ?? 0
  const servingSide = calculateServingSide(
    score1,
    score2,
    match.initialServingSide as 1 | 2,
  )

  setGamePlayState({
    currentGameIndex,
    score1,
    score2,
    gamesWon1,
    gamesWon2,
    servingSide,
  })
}

const findCurrentGameIndex = (match: Match): number => {
  if (match.games.length === 0) return 0

  // Find the first game without a winner
  const unfinishedIndex = match.games.findIndex((g) => !g.winningSide)
  if (unfinishedIndex !== -1) return unfinishedIndex

  // All games have winners - show the last game
  return match.games.length - 1
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

const saveMatchSetup = async () => {
  if (!gamePlayState.eventId || !gamePlayState.matchId) return
  try {
    await apiPost('saveMatchSetup', {
      _id: gamePlayState.eventId,
      matchId: gamePlayState.matchId,
      initialServingSide: gamePlayState.initialServingSide,
      leftSide: gamePlayState.leftSide,
    })
  } catch {
    // Silently fail - setup save is not critical
  }
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

type SearchParamValue = string | string[] | undefined
type SearchParams = Partial<Record<string, SearchParamValue>>

const getStringParam = (value: SearchParamValue): string | null => {
  if (value === undefined) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

export const gamePlayActions = {
  initializeFromUrl: async (params: SearchParams) => {
    const eventId = getStringParam(params.eventId)
    const stage = (getStringParam(params.stage) as 'group' | 'knockout') ?? 'group'
    const groupIndex = parseInt(getStringParam(params.groupIndex) || '0', 10)
    const matchId = getStringParam(params.matchId)

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
    saveMatchSetup()
  },

  addPointToSide: (side: 1 | 2) => {
    // Disable add point if game is already won
    if (gamePlayActions.getGameWinningSide()) return

    const newScore1 = side === 1 ? gamePlayState.score1 + 1 : gamePlayState.score1
    const newScore2 = side === 2 ? gamePlayState.score2 + 1 : gamePlayState.score2

    // Validate score before updating
    const gameConfig = gamePlayActions.getCurrentGameConfig()
    const errors = validateGameScore(newScore1, newScore2, gameConfig)
    if (errors.length > 0) {
      return // Don't update if score is invalid
    }

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

  getCurrentGameConfig: (): GameConfig => {
    return { ...DEFAULT_GAME_CONFIG }
  },

  getGameWinningSide: (): 1 | 2 | undefined => {
    const config = gamePlayActions.getCurrentGameConfig()
    return determineGameWinner(gamePlayState.score1, gamePlayState.score2, config)
  },

  isMatchFinished: (): boolean => {
    const numberOfGames = gamePlayActions.getNumberOfGames()
    const needed = gamesNeededToWin(numberOfGames)
    const winningSide = gamePlayActions.getGameWinningSide()
    const gamesWon1 = gamePlayState.gamesWon1 + (winningSide === 1 ? 1 : 0)
    const gamesWon2 = gamePlayState.gamesWon2 + (winningSide === 2 ? 1 : 0)
    return gamesWon1 >= needed || gamesWon2 >= needed
  },

  getGamesWon: (side: 1 | 2): number => {
    return side === 1 ? gamePlayState.gamesWon1 : gamePlayState.gamesWon2
  },

  nextGame: () => {
    const numberOfGames = gamePlayActions.getNumberOfGames()
    const nextIndex = gamePlayState.currentGameIndex + 1
    if (nextIndex >= numberOfGames) return

    const winningSide = gamePlayActions.getGameWinningSide()
    const newGamesWon1 = gamePlayState.gamesWon1 + (winningSide === 1 ? 1 : 0)
    const newGamesWon2 = gamePlayState.gamesWon2 + (winningSide === 2 ? 1 : 0)

    setGamePlayState({
      currentGameIndex: nextIndex,
      score1: 0,
      score2: 0,
      gamesWon1: newGamesWon1,
      gamesWon2: newGamesWon2,
      servingSide: gamePlayState.initialServingSide,
      timeout1: false,
      timeout2: false,
    })
  },

  finishMatch: () => {
    // Save the final game score immediately, then could navigate away
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer)
      saveDebounceTimer = null
    }
    gamePlayActions.saveGame()
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
