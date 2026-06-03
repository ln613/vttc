import { createStore } from 'solid-js/store'
import type { Event } from '../../shared/types/Tournament'
import type { Match, GameConfig, HandicapParams } from '../../shared/types/Match'
import { DEFAULT_GAME_CONFIG } from '../../shared/types/Match'
import type { Player } from '../../shared/types/Player'
import { apiGet, apiPost } from '../utils/api'
import { authState } from './authStore'
import { getTeamPlayerOrderLabel } from '../pages/EventDetail'
import {
  subscribeToLiveScoreUpdates,
  type EventSubscription,
} from '../utils/pusher'
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
  lastScoredSide: 1 | 2 | null
  sessionId: string | null
  sessionTakenOver: boolean
  sessionError: string | null
  matchReset: boolean
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
  lastScoredSide: null,
  sessionId: null,
  sessionTakenOver: false,
  matchReset: false,
  sessionError: null,
})

const [gamePlayState, setGamePlayState] =
  createStore<GamePlayState>(getInitialState())

// Debounce timer reference
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null
const SAVE_DEBOUNCE_MS = 1000

// Session heartbeat (1 minute; backend treats sessions idle > 5 min as closed)
const HEARTBEAT_INTERVAL_MS = 60_000
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let liveScoreSubscription: EventSubscription | null = null

const generateSessionId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const stopHeartbeat = () => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

const checkSessionOnce = async () => {
  const matchId = gamePlayState.matchId
  const sessionId = gamePlayState.sessionId
  if (!matchId || !sessionId) return
  try {
    const result = await apiPost<{ takenOver: boolean }>(
      'heartbeatMatchSession',
      { matchId, sessionId },
    )
    if (result.takenOver) {
      setGamePlayState({ sessionTakenOver: true })
      stopHeartbeat()
      unsubscribeLiveScore()
    }
  } catch {
    // Network errors are non-fatal; next heartbeat will retry.
  }
}

const startHeartbeat = () => {
  stopHeartbeat()
  heartbeatTimer = setInterval(checkSessionOnce, HEARTBEAT_INTERVAL_MS)
}

const unsubscribeLiveScore = () => {
  if (liveScoreSubscription) {
    liveScoreSubscription.unsubscribe()
    liveScoreSubscription = null
  }
}

const subscribeLiveScore = () => {
  unsubscribeLiveScore()
  liveScoreSubscription = subscribeToLiveScoreUpdates(() => {
    void checkSessionOnce()
  })
}

const acquireSession = async (matchId: string) => {
  const userId = authState.user?._id
  if (!userId) {
    setGamePlayState({ sessionError: 'You must be signed in to play.' })
    return false
  }
  const sessionId = generateSessionId()
  try {
    await apiPost('acquireMatchSession', {
      matchId,
      userId,
      sessionId,
      asAdmin: authState.isAdmin,
    })
    setGamePlayState({ sessionId, sessionTakenOver: false, sessionError: null })
    startHeartbeat()
    subscribeLiveScore()
    return true
  } catch (err) {
    setGamePlayState({
      sessionError:
        err instanceof Error ? err.message : 'Failed to acquire match session',
    })
    return false
  }
}

const releaseSession = () => {
  stopHeartbeat()
  unsubscribeLiveScore()
  const { matchId, sessionId } = gamePlayState
  if (!matchId || !sessionId) return
  // Fire-and-forget; never block teardown on the release call.
  apiPost('releaseMatchSession', { matchId, sessionId }).catch(() => {})
  setGamePlayState({ sessionId: null })
}

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

const getKnockoutRoundName = (): string | undefined => {
  if (!gamePlayState.data || !gamePlayState.matchId) return undefined
  const stages = gamePlayState.data.eventStages || []
  const knockoutStage = stages.find((s) => s.type === 'knockout')
  if (!knockoutStage || knockoutStage.type !== 'knockout') return undefined
  for (const round of knockoutStage.rounds) {
    const found = round.matches.find((m) => m.match?._id === gamePlayState.matchId)
    if (found) return round.name
  }
  return undefined
}

const formatPlayerNames = (players: Player[]): string => {
  if (!players || players.length === 0) return 'Player'
  return players.map((p) => `${p.firstName} ${p.lastName}`).join(' / ')
}

// Find the team-match parent for the current sub-match by walking the
// event's stages and looking for a parent.subMatches[] that contains us.
const getCurrentParentMatch = (): Match | undefined => {
  const match = gamePlayActions.getCurrentMatch()
  if (!match?.parentMatchId) return undefined
  const stages = gamePlayState.data?.eventStages || []
  const targetId = match.parentMatchId
  const searchInMatches = (matches: Match[] | undefined): Match | undefined => {
    if (!matches) return undefined
    for (const m of matches) {
      if (m._id === targetId) return m
    }
    return undefined
  }
  for (const stage of stages) {
    if (stage.type === 'group') {
      for (const group of stage.groups) {
        const found = searchInMatches(group.matches)
        if (found) return found
      }
    }
    if (stage.type === 'knockout') {
      for (const round of stage.rounds) {
        for (const km of round.matches) {
          if (km.match?._id === targetId) return km.match
        }
      }
    }
  }
  return undefined
}

const getSubMatchSuffix = (): string | undefined => {
  const parent = getCurrentParentMatch()
  if (!parent) return undefined
  const subMatches = parent.subMatches || []
  const cur = gamePlayState.matchId
  const idx = subMatches.findIndex((s) => s._id === cur)
  if (idx === -1) return undefined
  return `Team Match ${idx + 1}`
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
      sessionId: null,
      sessionTakenOver: false,
      sessionError: null,
      matchReset: false,
    })

    if (matchId) await acquireSession(matchId)
    await fetchEvent(eventId!)
  },

  notifyMatchReset: (matchId: string) => {
    if (!gamePlayState.matchId || gamePlayState.matchId !== matchId) return
    cancelPendingSave()
    setGamePlayState({ matchReset: true })
  },

  releaseSession,

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

  isTeamMatch: (): boolean => {
    const match = gamePlayActions.getCurrentMatch()
    return !!match?.isTeamMatch
  },

  bothSidesStarted: (): boolean => {
    const match = gamePlayActions.getCurrentMatch()
    return !!(match?.side1Started && match?.side2Started)
  },

  getUserSideInMatch: (): 1 | 2 | undefined => {
    const uid = authState.user?._id?.toString()
    if (!uid) return undefined
    const match = gamePlayActions.getCurrentMatch()
    if (!match) return undefined
    if ((match.side1 || []).some((p) => p._id?.toString() === uid)) return 1
    if ((match.side2 || []).some((p) => p._id?.toString() === uid)) return 2
    return undefined
  },

  startTeamSide: async (side: 1 | 2) => {
    const { eventId, matchId } = gamePlayState
    const uid = authState.user?._id?.toString()
    if (!eventId || !matchId || !uid) return
    try {
      await apiPost('startTeamMatchSide', {
        _id: eventId,
        matchId,
        side,
        playerId: uid,
      })
      await fetchEvent(eventId)
    } catch (err) {
      setGamePlayState({
        sessionError:
          err instanceof Error ? err.message : 'Failed to start team match',
      })
    }
  },

  hasSideAssignment: (side: 1 | 2): boolean => {
    const match = gamePlayActions.getCurrentMatch()
    return !!(side === 1 ? match?.side1Assignment : match?.side2Assignment)
  },

  bothSidesAssigned: (): boolean =>
    gamePlayActions.hasSideAssignment(1) &&
    gamePlayActions.hasSideAssignment(2),

  saveTeamSideAssignment: async (side: 1 | 2, assignmentIds: string[]) => {
    const { eventId, matchId } = gamePlayState
    if (!eventId || !matchId) return
    try {
      await apiPost('saveTeamMatchAssignment', {
        _id: eventId,
        matchId,
        side,
        assignmentIds,
      })
      await fetchEvent(eventId)
    } catch (err) {
      setGamePlayState({
        sessionError:
          err instanceof Error
            ? err.message
            : 'Failed to save team match order',
      })
    }
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
      lastScoredSide: null,
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
      lastScoredSide: null,
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
      lastScoredSide: side,
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
    const targetId = gamePlayState.matchId

    const findInMatches = (matches: Match[]): Match | undefined => {
      for (const m of matches) {
        if (m._id === targetId) return m
        if (m.subMatches) {
          const sub = m.subMatches.find((s) => s._id === targetId)
          if (sub) return sub
        }
      }
      return undefined
    }

    // Check group stage
    const groupStage = stages.find((s) => s.type === 'group')
    if (groupStage && groupStage.type === 'group') {
      for (const group of groupStage.groups) {
        const found = findInMatches(group.matches)
        if (found) return found
      }
    }

    // Check knockout stage
    const knockoutStage = stages.find((s) => s.type === 'knockout')
    if (knockoutStage && knockoutStage.type === 'knockout') {
      for (const round of knockoutStage.rounds) {
        const flatMatches = round.matches
          .map((m) => m.match)
          .filter((m): m is Match => !!m)
        const found = findInMatches(flatMatches)
        if (found) return found
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
    const base =
      gamePlayState.stage === 'group'
        ? `Group ${gamePlayState.groupIndex + 1}`
        : (getKnockoutRoundName() ?? 'Knockout')
    const sub = getSubMatchSuffix()
    return sub ? `${base} - ${sub}` : base
  },

  getNumberOfGames: (): number => {
    const match = gamePlayActions.getCurrentMatch()
    if (match?.config?.numberOfGames) return match.config.numberOfGames
    return 5
  },

  getCurrentParentMatch: (): Match | undefined => getCurrentParentMatch(),

  getParticipantName: (side: 1 | 2): string => {
    const players =
      side === 1
        ? gamePlayActions.getSide1Players()
        : gamePlayActions.getSide2Players()
    const parent = getCurrentParentMatch()
    if (!parent) return formatPlayerNames(players)
    const decorated = players.map((p) => {
      const label = getTeamPlayerOrderLabel(parent, p._id?.toString())
      return label ? { ...p, lastName: `${p.lastName} (${label})` } : p
    })
    return formatPlayerNames(decorated)
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

  nextGame: async () => {
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

    // Save the current game's final score before moving on
    await gamePlayActions.saveGame()

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
      lastScoredSide: null,
    })

    // Save the new game's starting state so the server advances its
    // currentGameNumber and the match score (gamesWon) updates on live pages.
    await gamePlayActions.saveGame()
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
      lastScoredSide: gamePlayState.lastScoredSide,
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
    releaseSession()
    setGamePlayState(getInitialState())
  },
}
