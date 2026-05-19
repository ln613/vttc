import { createStore } from 'solid-js/store'
import type { Event, BestOfOption } from '../../shared/types/Tournament'
import type { Match, GameConfig, HandicapParams } from '../../shared/types/Match'
import { DEFAULT_GAME_CONFIG } from '../../shared/types/Match'
import type { Player } from '../../shared/types/Player'
import { apiGet, apiPost } from '../utils/api'
import {
  validateGameScore,
  determineGameWinner,
  gamesNeededToWin,
  getHandicapStartingScore,
  createHandicapGameConfig,
} from '../../shared/rules/matchRules'

interface GameResult {
  score1: number
  score2: number
  winningSide?: 1 | 2
}

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
  menuOpen: boolean
  matchSubmitted: boolean
  showFinishDialog: boolean
  gameHistory: GameResult[]
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
  menuOpen: false,
  matchSubmitted: false,
  showFinishDialog: false,
  gameHistory: [],
})

const [gamePlayState, setGamePlayState] =
  createStore<GamePlayState>(getInitialState())

// Debounce timer reference
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null
const SAVE_DEBOUNCE_MS = 3000

// Track in-flight save promise so other stores can wait for it
let pendingSavePromise: Promise<void> | null = null

export const waitForPendingSave = (): Promise<void> =>
  pendingSavePromise ?? Promise.resolve()

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
  const isNewGame = !currentGame

  // If this is a new game (no game data in DB yet), use handicap starting scores
  const startingScores = isNewGame ? getStartingScores() : { score1: 0, score2: 0 }
  const score1 = currentGame?.score1 ?? startingScores.score1
  const score2 = currentGame?.score2 ?? startingScores.score2
  const gameFirstServeSide = getGameFirstServeSide(
    match.initialServingSide as 1 | 2,
    currentGameIndex,
  )
  const servingSide = calculateServingSide(score1, score2, gameFirstServeSide)

  const matchSubmitted = match.winningSide != null

  // Restore game history from completed games
  const gameHistory: GameResult[] = match.games
    .filter((g) => g.winningSide)
    .map((g) => ({
      score1: g.score1,
      score2: g.score2,
      winningSide: g.winningSide,
    }))

  setGamePlayState({
    currentGameIndex,
    score1,
    score2,
    gamesWon1,
    gamesWon2,
    servingSide,
    matchSubmitted,
    gameHistory,
  })
}

const findCurrentGameIndex = (match: Match): number => {
  if (match.games.length === 0) return 0

  // Find the first game without a winner
  const unfinishedIndex = match.games.findIndex((g) => !g.winningSide)
  if (unfinishedIndex !== -1) return unfinishedIndex

  // All games have winners - if match not finished, advance to next game
  if (!match.winningSide) return match.games.length

  // Match is finished - show the last game
  return match.games.length - 1
}

const getOpposingSide = (side: 1 | 2): 1 | 2 => (side === 1 ? 2 : 1)

const getGameFirstServeSide = (
  initialServingSide: 1 | 2,
  gameIndex: number,
): 1 | 2 =>
  gameIndex % 2 === 0 ? initialServingSide : getOpposingSide(initialServingSide)

const calculateServingSide = (
  score1: number,
  score2: number,
  gameFirstServeSide: 1 | 2,
): 1 | 2 => {
  const totalPoints = score1 + score2
  const serveBlocks = Math.floor(totalPoints / 2)
  const shouldSwitch = serveBlocks % 2 === 1
  return shouldSwitch ? getOpposingSide(gameFirstServeSide) : gameFirstServeSide
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

const isHandicapEnabled = (): boolean => {
  return gamePlayState.data?.handicapEnabled === true
}

const getEventHandicapParams = (): HandicapParams | undefined => {
  const event = gamePlayState.data
  if (!event || !event.handicapEnabled) return undefined
  return {
    divisor: event.handicapDifference,
    maxPoints: event.handicapMaxPoints,
  }
}

const getStartingScores = (): { score1: number; score2: number } => {
  if (!isHandicapEnabled()) return { score1: 0, score2: 0 }

  const match = gamePlayActions.getCurrentMatch()
  if (!match) return { score1: 0, score2: 0 }

  const handicapParams = getEventHandicapParams()
  if (!handicapParams) return { score1: 0, score2: 0 }

  return getHandicapStartingScore(match.side1, match.side2, handicapParams)
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

const cancelPendingSave = () => {
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer)
    saveDebounceTimer = null
  }
}

const flushPendingSave = (): Promise<void> | undefined => {
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer)
    saveDebounceTimer = null
    return gamePlayActions.saveGame()
  }
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
      menuOpen: false,
      matchSubmitted: false,
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

  toggleMenu: () => {
    setGamePlayState({ menuOpen: !gamePlayState.menuOpen })
  },

  closeMenu: () => {
    setGamePlayState({ menuOpen: false })
  },

  resetCurrentGame: () => {
    cancelPendingSave()
    const newServingSide = getGameFirstServeSide(
      gamePlayState.initialServingSide,
      gamePlayState.currentGameIndex,
    )
    const startingScores = getStartingScores()

    setGamePlayState({
      score1: startingScores.score1,
      score2: startingScores.score2,
      servingSide: newServingSide,
      timeout1: false,
      timeout2: false,
      menuOpen: false,
    })

    debouncedSaveGame()
  },

  resetWholeMatch: async () => {
    if (gamePlayState.matchSubmitted) return
    cancelPendingSave()

    setGamePlayState({ menuOpen: false })

    // Call API to reset match in DB
    if (gamePlayState.eventId && gamePlayState.matchId) {
      try {
        await apiPost('resetMatch', {
          _id: gamePlayState.eventId,
          matchId: gamePlayState.matchId,
        })
      } catch {
        // Silently fail
      }
    }

    const startingScores = getStartingScores()

    setGamePlayState({
      currentGameIndex: 0,
      score1: startingScores.score1,
      score2: startingScores.score2,
      gamesWon1: 0,
      gamesWon2: 0,
      servingSide: gamePlayState.initialServingSide,
      timeout1: false,
      timeout2: false,
      matchSubmitted: false,
      gameHistory: [],
    })
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

    const gameFirstServeSide = getGameFirstServeSide(
      gamePlayState.initialServingSide,
      gamePlayState.currentGameIndex,
    )
    const newServingSide = calculateServingSide(
      newScore1,
      newScore2,
      gameFirstServeSide,
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
    const gameFirstServeSide = getGameFirstServeSide(
      gamePlayState.initialServingSide,
      gamePlayState.currentGameIndex,
    )
    const newServingSide = calculateServingSide(
      newScore1,
      newScore2,
      gameFirstServeSide,
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
    if (!isHandicapEnabled()) return { ...DEFAULT_GAME_CONFIG }

    const match = gamePlayActions.getCurrentMatch()
    if (!match) return { ...DEFAULT_GAME_CONFIG }

    const handicapParams = getEventHandicapParams()
    if (!handicapParams) return { ...DEFAULT_GAME_CONFIG }

    return createHandicapGameConfig(
      match.side1,
      match.side2,
      false,
      handicapParams,
    )
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
    cancelPendingSave()
    const numberOfGames = gamePlayActions.getNumberOfGames()
    const nextIndex = gamePlayState.currentGameIndex + 1
    if (nextIndex >= numberOfGames) return

    const winningSide = gamePlayActions.getGameWinningSide()
    const newGamesWon1 = gamePlayState.gamesWon1 + (winningSide === 1 ? 1 : 0)
    const newGamesWon2 = gamePlayState.gamesWon2 + (winningSide === 2 ? 1 : 0)

    // Record current game in history
    const newGameHistory = [
      ...gamePlayState.gameHistory,
      {
        score1: gamePlayState.score1,
        score2: gamePlayState.score2,
        winningSide,
      },
    ]

    // Save the current game score before moving to next game
    gamePlayActions.saveGame()

    // Alternate first serve side after each game
    const nextGameFirstServeSide = getGameFirstServeSide(
      gamePlayState.initialServingSide,
      nextIndex,
    )

    const startingScores = getStartingScores()

    setGamePlayState({
      currentGameIndex: nextIndex,
      score1: startingScores.score1,
      score2: startingScores.score2,
      gamesWon1: newGamesWon1,
      gamesWon2: newGamesWon2,
      servingSide: nextGameFirstServeSide,
      timeout1: false,
      timeout2: false,
      gameHistory: newGameHistory,
    })
  },

  finishMatch: () => {
    // Show the confirm dialog with match result preview (do not save to db yet)
    setGamePlayState({ showFinishDialog: true })
  },

  cancelFinishMatch: () => {
    setGamePlayState({ showFinishDialog: false })
  },

  getFinishMatchPreview: (): {
    gamesWon1: number
    gamesWon2: number
    games: GameResult[]
  } => {
    const winningSide = gamePlayActions.getGameWinningSide()
    const currentGameResult: GameResult = {
      score1: gamePlayState.score1,
      score2: gamePlayState.score2,
      winningSide,
    }
    const allGames = [...gamePlayState.gameHistory, currentGameResult]
    const gamesWon1 =
      gamePlayState.gamesWon1 + (winningSide === 1 ? 1 : 0)
    const gamesWon2 =
      gamePlayState.gamesWon2 + (winningSide === 2 ? 1 : 0)

    return { gamesWon1, gamesWon2, games: allGames }
  },

  confirmFinishMatch: async () => {
    // Cancel any pending debounced save - finishMatch will set the final result
    cancelPendingSave()

    const preview = gamePlayActions.getFinishMatchPreview()

    // Call finishMatch API with the full result and confirm in one call
    if (gamePlayState.eventId && gamePlayState.matchId) {
      try {
        await apiPost('finishMatch', {
          _id: gamePlayState.eventId,
          matchId: gamePlayState.matchId,
          confirmed: true,
          result: preview.games.map((g) => ({
            score1: g.score1,
            score2: g.score2,
          })),
        })
      } catch {
        // Silently fail
      }
    }

    setGamePlayState({
      matchSubmitted: true,
      showFinishDialog: false,
      score1: 0,
      score2: 0,
      gamesWon1: preview.gamesWon1,
      gamesWon2: preview.gamesWon2,
    })
  },

  saveGame: async () => {
    if (!gamePlayState.eventId || !gamePlayState.matchId) return

    setGamePlayState({ isSaving: true, saveError: null })

    const savePromise = apiPost('updateGame', {
      _id: gamePlayState.eventId,
      matchId: gamePlayState.matchId,
      gameNumber: gamePlayState.currentGameIndex + 1,
      score: {
        score1: gamePlayState.score1,
        score2: gamePlayState.score2,
      },
    })

    pendingSavePromise = savePromise.then(
      () => { pendingSavePromise = null },
      () => { pendingSavePromise = null },
    )

    try {
      await savePromise
      setGamePlayState({ isSaving: false })
    } catch (err) {
      setGamePlayState({
        isSaving: false,
        saveError: err instanceof Error ? err.message : 'Failed to save game',
      })
    }
  },

  exitAndFlush: async () => {
    await flushPendingSave()
  },

  reset: () => {
    flushPendingSave()
    setGamePlayState(getInitialState())
  },
}
