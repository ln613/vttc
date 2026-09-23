import { createStore } from 'solid-js/store'
import { createEffect, createRoot } from 'solid-js'
import type { Event } from '../../shared/types/Tournament'
import type { Match, GameConfig, HandicapParams } from '../../shared/types/Match'
import { DEFAULT_GAME_CONFIG } from '../../shared/types/Match'
import type { Player } from '../../shared/types/Player'
import { apiGet, apiPost, getUmpireId } from '../utils/api'
import { authState } from './authStore'
import { customAlert, customConfirm } from './confirmDialogStore'
import { liveScoreActions } from './liveScoreStore'
import { getTeamPlayerOrderLabel } from '../pages/EventDetail'
import {
  subscribeToLiveScoreUpdates,
  joinTableChannel,
  type EventSubscription,
  type TablePairing,
  type TabletMirrorState,
} from '../utils/pusher'
import { createJitteredRefetch } from '../utils/refetch'
import {
  getDeviceId,
  readLocal,
  writeLocal,
  removeLocal,
} from '../utils/device'
import {
  validateGameScore,
  determineGameWinner,
  gamesNeededToWin,
  getHandicapStartingScore,
  createHandicapGameConfig,
} from '../../shared/rules/matchRules'
import { getGroupName } from '../../shared/rules/tournamentRules'

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
  // Tablet/Umpire mode: table picked from the picker dialog. When
  // matchId is null but tableNumber is set, GamePlay renders the
  // "no match assigned" screen with just the big table number.
  tableNumber: number | null
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
  // Whether the "switch sides" prompt has been shown in the current
  // last-game (so it doesn't repeat).
  lastGameSwitchPrompted: boolean
  // Whether the umpire actually accepted the side switch. Only when
  // this is true can a later deduction trigger the "switch back"
  // notice. Resets when a new game starts.
  lastGameSideSwitched: boolean
  sessionId: string | null
  sessionTakenOver: boolean
  sessionError: string | null
  matchReset: boolean
  // ---- Tablet Mirror (specs/rules/tablet mirror.md) ----
  // null on every table not running a pair, which is every table while the
  // setting is off. Nothing about scoring changes while it is null.
  tabletRole: TabletRole | null
  // The first tablet on a table picks; the second gets the other role.
  showRoleDialog: boolean
  roleChoices: TabletRole[]
  // Whether the other half of the pair is on the table's channel.
  sisterPresent: boolean
  // Whether the umpire has pressed Start on this match — the moment the
  // serving side and the ends are settled. On a Mirror it arrives with the
  // Scorer's snapshot; nothing is named before it.
  setupConfirmed: boolean
}

export type TabletRole = 'scorer' | 'mirror'

const getInitialState = (): GamePlayState => ({
  data: null,
  // Start in the loading state so the GamePlay page shows its spinner
  // immediately instead of a brief flash of empty score boxes while
  // initializeFromUrl → fetchEvent kicks off.
  loading: true,
  error: null,
  eventId: null,
  stage: 'group',
  groupIndex: 0,
  matchId: null,
  tableNumber: null,
  currentGameIndex: 0,
  score1: 0,
  score2: 0,
  gamesWon1: 0,
  gamesWon2: 0,
  servingSide: 1,
  initialServingSide: 1,
  leftSide: 1,
  // Start hidden — we flip it to true only after fetchEvent confirms
  // the match has NO saved initialServingSide/leftSide. Defaulting to
  // true caused a brief flash of the dialog on reload of an already-
  // started match while data was loading.
  showInitDialog: false,
  isSaving: false,
  saveError: null,
  timeout1: false,
  timeout2: false,
  menuOpen: false,
  matchSubmitted: false,
  showFinishDialog: false,
  gameHistory: [],
  lastScoredSide: null,
  lastGameSwitchPrompted: false,
  lastGameSideSwitched: false,
  sessionId: null,
  sessionTakenOver: false,
  matchReset: false,
  sessionError: null,
  tabletRole: null,
  showRoleDialog: false,
  roleChoices: [],
  sisterPresent: false,
  setupConfirmed: false,
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
    if (!result.takenOver) return
    // The heartbeat was for (matchId, sessionId) we captured at the
    // start; if the page has moved on since (e.g. tablet flow cleared
    // the parent and loaded a sub-match), ignore the stale result so
    // we don't flag the new session as taken-over.
    if (
      gamePlayState.matchId !== matchId ||
      gamePlayState.sessionId !== sessionId
    ) {
      return
    }
    setGamePlayState({ sessionTakenOver: true })
    stopHeartbeat()
    unsubscribeLiveScore()
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

// A team match still waiting on its order of play has no local scoring
// state to lose, so it is safe to refresh from a broadcast. Once play
// starts we deliberately leave the page alone: the score is client-owned
// until it saves, and refetching under it would fight the debounced save.
const isAwaitingTeamOrder = (): boolean => {
  const match = gamePlayActions.getCurrentMatch()
  if (!match?.isTeamMatch) return false
  return !match.side1Assignment || !match.side2Assignment
}

const refetchWhileSettingUp = createJitteredRefetch(() => {
  const { eventId } = gamePlayState
  if (!eventId) return undefined
  return fetchEvent(eventId, true)
})

const subscribeLiveScore = () => {
  unsubscribeLiveScore()
  liveScoreSubscription = subscribeToLiveScoreUpdates(() => {
    void checkSessionOnce()
    // The other side — or an admin on Event Detail — may have just set the
    // order. Without this the tablet sits on the order screen for ever,
    // because nothing else refetches the match here.
    if (isAwaitingTeamOrder()) refetchWhileSettingUp()
  })
}

// A tablet's role is a fact about where it is standing, so it belongs to
// the table rather than to any one match. Remembering it is what stops the
// question being asked again every time a table's match is replaced by the
// next one — and it survives a reload, which a session cannot when the
// match has changed underneath it.
const roleStorageKey = (tableNumber: number) => `vttc.tabletRole.${tableNumber}`

const rememberedRole = (tableNumber: number | null): TabletRole | undefined => {
  if (tableNumber == null) return undefined
  const stored = readLocal(roleStorageKey(tableNumber))
  return stored === 'scorer' || stored === 'mirror' ? stored : undefined
}

const rememberRole = (tableNumber: number | null, role: TabletRole) => {
  if (tableNumber == null) return
  writeLocal(roleStorageKey(tableNumber), role)
}

// Leaving the page forgets it, so picking the table again asks afresh.
// Finishing a match and moving to the table's next one does not.
const forgetRole = (tableNumber: number | null) => {
  if (tableNumber == null) return
  removeLocal(roleStorageKey(tableNumber))
}

interface AcquireResult {
  sessionId?: string
  role?: TabletRole
  needsRole?: boolean
  availableRoles?: TabletRole[]
}

const acquireSession = async (matchId: string, role?: TabletRole) => {
  // An umpire working from the match-day password has no account, so they
  // hold the session under a per-visit id instead.
  const userId = authState.user?._id ?? getUmpireId()
  if (!userId) {
    setGamePlayState({ sessionError: 'You must be signed in to play.' })
    return false
  }

  const { tableNumber } = gamePlayState
  const wanted = role ?? rememberedRole(tableNumber)
  const sessionId = generateSessionId()
  try {
    // The server decides whether this table runs a pair, by reading the
    // event: live-score data is a cache and can be a rebuild behind, and a
    // wrong answer would quietly close the table to its second tablet.
    const result = await apiPost<AcquireResult>('acquireMatchSession', {
      matchId,
      eventId: gamePlayState.eventId,
      userId,
      // Both tablets on a table share one account, so the device is what
      // separates them — and what lets this one reclaim its own role after
      // a reload without being asked again.
      deviceId: getDeviceId(),
      sessionId,
      role: wanted,
      asAdmin: authState.isAdmin,
    })

    // Both roles free: the first tablet on the table says which it is.
    if (result.needsRole) {
      setGamePlayState({
        showRoleDialog: true,
        roleChoices: result.availableRoles ?? [],
      })
      return false
    }

    const assigned = result.role ?? null
    if (assigned) rememberRole(tableNumber, assigned)
    setGamePlayState({
      sessionId,
      // The server only names a role when the event runs a pair, so a lone
      // tablet behaves exactly as it always did.
      tabletRole: assigned,
      showRoleDialog: false,
      roleChoices: [],
      sessionTakenOver: false,
      sessionError: null,
      // The first tablet on a table is asked its role only after the event
      // has loaded, so a setup screen may already be up behind the dialog.
      // A Mirror is never the device that sets a match up.
      ...(assigned === 'mirror' ? { showInitDialog: false } : {}),
    })
    startHeartbeat()
    subscribeLiveScore()
    joinPairing()
    return true
  } catch (err) {
    // The remembered role may have been taken by the other tablet while
    // this one was between matches. Forget it and let the server decide,
    // which either hands over the free role or asks.
    if (!role && wanted) {
      forgetRole(tableNumber)
      return acquireSession(matchId)
    }
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
  leavePairing()
  const { matchId, sessionId } = gamePlayState
  setGamePlayState({ tabletRole: null, showRoleDialog: false, roleChoices: [] })
  if (!matchId || !sessionId) return
  // Fire-and-forget; never block teardown on the release call.
  apiPost('releaseMatchSession', { matchId, sessionId }).catch(() => {})
  setGamePlayState({ sessionId: null })
}

// ==================== Paired tablets ====================
//
// The Scorer publishes its whole scoring state to the Mirror as a Pusher
// client event — device to device, never through the API. A point therefore
// costs no invocation, no write and no broadcast. The Mirror only listens.

let pairing: TablePairing | null = null

const leavePairing = () => {
  pairing?.unsubscribe()
  pairing = null
  setGamePlayState({ sisterPresent: false })
}

const joinPairing = () => {
  leavePairing()
  const { tableNumber, tabletRole } = gamePlayState
  // A table is the unit of pairing; an admin reaching Game Play from a match
  // row has no table and scores alone.
  if (!tableNumber || !tabletRole) return

  pairing = joinTableChannel(tableNumber, {
    onSisterChange: (present) => {
      setGamePlayState({ sisterPresent: present })
      // A Mirror that just arrived has nothing to draw until the next
      // point, which could be a minute away.
      if (present) publishMirrorState()
    },
    onHello: () => publishMirrorState(),
    onState: applyMirrorState,
  })

  if (tabletRole === 'mirror') pairing.publishHello()
}

const mirrorSnapshot = (): TabletMirrorState | null => {
  const { matchId } = gamePlayState
  if (!matchId) return null
  return {
    matchId,
    currentGameIndex: gamePlayState.currentGameIndex,
    score1: gamePlayState.score1,
    score2: gamePlayState.score2,
    gamesWon1: gamePlayState.gamesWon1,
    gamesWon2: gamePlayState.gamesWon2,
    servingSide: gamePlayState.servingSide,
    leftSide: gamePlayState.leftSide,
    timeout1: gamePlayState.timeout1,
    timeout2: gamePlayState.timeout2,
    lastScoredSide: gamePlayState.lastScoredSide,
    matchSubmitted: gamePlayState.matchSubmitted,
    setupConfirmed: gamePlayState.setupConfirmed,
  }
}

const publishMirrorState = () => {
  if (gamePlayState.tabletRole !== 'scorer') return
  const snapshot = mirrorSnapshot()
  if (snapshot) pairing?.publishState(snapshot)
}

// A snapshot is the whole picture, so one that arrives late or out of order
// is still correct, and one that is dropped costs only a moment.
const applyMirrorState = (state: TabletMirrorState) => {
  if (gamePlayState.tabletRole !== 'mirror') return
  // The Mirror resolves its own match from the table; until the two agree,
  // the snapshot is about a match it is not showing.
  if (!state?.matchId || state.matchId !== gamePlayState.matchId) return

  // Nothing in a snapshot means anything until the umpire presses Start.
  // The Scorer publishes from the moment it opens the match, and while the
  // umpire is still on the setup screen its `leftSide` swings about with
  // every tap of the side buttons — mirroring that would have the players
  // watching the board flip under them before the match had begun.
  if (!state.setupConfirmed) {
    setGamePlayState({ setupConfirmed: false, showInitDialog: false })
    return
  }

  setGamePlayState({
    currentGameIndex: state.currentGameIndex,
    score1: state.score1,
    score2: state.score2,
    gamesWon1: state.gamesWon1,
    gamesWon2: state.gamesWon2,
    servingSide: state.servingSide,
    leftSide: state.leftSide,
    timeout1: state.timeout1,
    timeout2: state.timeout2,
    lastScoredSide: state.lastScoredSide,
    matchSubmitted: state.matchSubmitted,
    setupConfirmed: !!state.setupConfirmed,
    // A Mirror is never the one being asked to set up a match.
    showInitDialog: false,
  })
}

// An effect rather than a call at each mutation site: there are a dozen ways
// a score changes — a point, an undo, a timeout, a new game, a side switch —
// and missing one would leave the Mirror quietly stale.
createRoot(() => {
  createEffect(() => {
    const snapshot = mirrorSnapshot()
    if (!snapshot) return
    if (gamePlayState.tabletRole !== 'scorer') return
    pairing?.publishState(snapshot)
  })
})

// Track in-flight save promise so other stores can wait for it
let pendingSavePromise: Promise<void> | null = null

export const waitForPendingSave = (): Promise<void> =>
  pendingSavePromise ?? Promise.resolve()

export { gamePlayState }

const fetchEvent = async (eventId: string, silent = false) => {
  if (!silent) setGamePlayState({ loading: true, error: null })
  try {
    const data = await apiGet<Event>('event', { _id: eventId })
    // Silent refetches don't touch the loading flag at all — the
    // caller may be holding the spinner up for a longer transition.
    setGamePlayState(silent ? { data, error: null } : { data, loading: false, error: null })
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
      // Already started, whoever started it — a Mirror joining now can name
      // both ends straight away.
      setupConfirmed: true,
    })
    restoreGameProgress(match)
    return
  }
  // Team match parent: show the init screen too — the team-init
  // variant lets the umpire set both side orders before starting.
  // Skip when both orders are already saved (sub-matches will be
  // generated and we auto-hop into one).
  if (match.isTeamMatch) {
    if (!match.side1Assignment || !match.side2Assignment) {
      setGamePlayState({ showInitDialog: !isMirror() })
    }
    return
  }
  setGamePlayState({ showInitDialog: !isMirror() })
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
  const servingSide = calculateServingSide(
    score1,
    score2,
    gameFirstServeSide,
    currentGame?.config?.targetPoints ?? 11,
  )

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

// In the last game of the match, when one side first reaches the
// switching point (half-way through the target — 5 of 11, 3 of 7,
// 10 of 21) ask the umpire to confirm with the players ("Switch
// sides?"). The switch always happens, but only after the umpire
// dismisses the prompt — so the players have a chance to physically
// move first.
const maybePromptLastGameSwitch = (
  score1: number,
  score2: number,
  gameConfig: GameConfig,
) => {
  if (gamePlayState.lastGameSwitchPrompted) return
  const lastGameIndex = gamePlayActions.getNumberOfGames() - 1
  if (gamePlayState.currentGameIndex !== lastGameIndex) return
  const switchingPoint = Math.floor((gameConfig.targetPoints - 1) / 2)
  if (score1 < switchingPoint && score2 < switchingPoint) return

  setGamePlayState({ lastGameSwitchPrompted: true })
  void customConfirm('Switch sides?', {
    confirmLabel: 'Yes',
    cancelLabel: 'No',
    modal: true,
  }).then((confirmed) => {
    if (!confirmed) return
    const flipped: 1 | 2 = gamePlayState.leftSide === 1 ? 2 : 1
    setGamePlayState({
      leftSide: flipped,
      lastGameSideSwitched: true,
    })
  })
}

// Counterpart to maybePromptLastGameSwitch: if the umpire deducts
// points after a switch and both scores drop back below the
// switching point, inform the players to switch back (single OK
// button — no confirm) and flip leftSide automatically. Clearing the
// flag means a later climb back to the switching point will re-fire
// the forward-switch prompt.
const maybePromptLastGameSwitchBack = (
  score1: number,
  score2: number,
  gameConfig: GameConfig,
) => {
  if (!gamePlayState.lastGameSwitchPrompted) return
  const lastGameIndex = gamePlayActions.getNumberOfGames() - 1
  if (gamePlayState.currentGameIndex !== lastGameIndex) return
  const switchingPoint = Math.floor((gameConfig.targetPoints - 1) / 2)
  if (score1 >= switchingPoint || score2 >= switchingPoint) return

  // Reset the "prompted" flag so the forward prompt can fire again if
  // a side climbs back to the switching point.
  if (!gamePlayState.lastGameSideSwitched) {
    setGamePlayState({ lastGameSwitchPrompted: false })
    return
  }

  // Forward switch had actually been accepted — undo it and inform.
  const flipped: 1 | 2 = gamePlayState.leftSide === 1 ? 2 : 1
  setGamePlayState({
    leftSide: flipped,
    lastGameSideSwitched: false,
    lastGameSwitchPrompted: false,
  })
  void customAlert(
    'Scores dropped below the switching point\nplease switch back.',
    { modal: true },
  )
}

const calculateServingSide = (
  score1: number,
  score2: number,
  gameFirstServeSide: 1 | 2,
  targetPoints: number,
): 1 | 2 => {
  const totalPoints = score1 + score2
  const deuceThreshold = targetPoints - 1
  // After both sides reach (targetPoints - 1) — e.g. 10:10 in a
  // standard game — serves alternate every 1 point instead of every
  // 2. Up to that moment serves still alternate every 2 points; we
  // collapse both eras into a "serve block count" and use its parity
  // to decide whether to switch from the game's first server.
  const inDeuce = score1 >= deuceThreshold && score2 >= deuceThreshold
  const preDeuceBlocks = inDeuce
    ? deuceThreshold
    : Math.floor(totalPoints / 2)
  const postDeuceBlocks = inDeuce
    ? totalPoints - 2 * deuceThreshold
    : 0
  const shouldSwitch = (preDeuceBlocks + postDeuceBlocks) % 2 === 1
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

const isLeagueEvent = (): boolean =>
  gamePlayState.data?.eventType === 'league'

// A league week is identified by who is playing, not by the event or the
// group it is stored in.
const getTeamsLabel = (): string | undefined => {
  if (!isLeagueEvent()) return undefined
  // On the setup screen the current match IS the team match; once it has
  // been expanded the sub-match points back at its parent.
  const parent =
    getCurrentParentMatch() ?? gamePlayActions.getCurrentMatch()
  const ids = parent?.participantIds
  if (!ids) return undefined
  const name = (participantId: string): string => {
    const participant = gamePlayState.data?.participants?.find(
      (p) => p._id === participantId,
    )
    if (!participant) return 'Unknown'
    return (
      participant.teamName ||
      participant.players
        .map((pl) => `${pl.firstName} ${pl.lastName}`)
        .join('/')
    )
  }
  return `${name(ids.side1)} vs ${name(ids.side2)}`
}

const getSubMatchSuffix = (): string | undefined => {
  const parent = getCurrentParentMatch()
  if (!parent) return undefined
  const subMatches = parent.subMatches || []
  const cur = gamePlayState.matchId
  const idx = subMatches.findIndex((s) => s._id === cur)
  if (idx === -1) return undefined
  // Everything in a league is a team match, so "Team" says nothing.
  return `${isLeagueEvent() ? 'Match' : 'Team Match'} ${idx + 1}`
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

const isMirror = () => gamePlayState.tabletRole === 'mirror'

const saveMatchSetup = async () => {
  if (isMirror()) return
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
  if (isMirror()) return
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
    const tableNumberRaw = getStringParam(params.tableNumber)
    const tableNumber = tableNumberRaw ? parseInt(tableNumberRaw, 10) : null

    // Tablet mode allows entry with just a tableNumber (no event/match
    // assigned yet). Everyone else still requires both.
    if (!matchId || !eventId) {
      if (tableNumber == null) {
        throw new Error('Match ID and Event ID are required')
      }
    }

    setGamePlayState({
      eventId,
      stage,
      groupIndex,
      matchId,
      tableNumber,
      currentGameIndex: 0,
      score1: 0,
      score2: 0,
      servingSide: 1,
      initialServingSide: 1,
      leftSide: 1,
      // Stays hidden until restoreMatchSetupIfExists determines the
      // match has no saved init data.
      showInitDialog: false,
      isSaving: false,
      saveError: null,
      menuOpen: false,
      matchSubmitted: false,
      lastGameSwitchPrompted: false,
      lastGameSideSwitched: false,
      sessionId: null,
      sessionTakenOver: false,
      sessionError: null,
      matchReset: false,
      setupConfirmed: false,
      // Tablet entry without a match has nothing to load — drop the
      // loading flag immediately so the "No match assigned" screen
      // shows instead of the spinner.
      loading: !!eventId,
    })

    if (matchId) await acquireSession(matchId)
    if (eventId) await fetchEvent(eventId)
  },

  notifyMatchReset: (matchId: string) => {
    if (!gamePlayState.matchId || gamePlayState.matchId !== matchId) return
    cancelPendingSave()
    // Tablet sessions are pinned to a table, not a specific match.
    // For a regular reset the table still holds the same match id,
    // so clearMatchForTable + auto-load re-fetches it fresh. For
    // Reset Team the table now holds the parent. In both cases the
    // live-score-update pusher may still be in flight — refresh it
    // first so the auto-load effect doesn't briefly re-load the
    // just-cleared sub-match from stale tableState (which is what
    // caused the team-init flash on the way in).
    if (authState.isTablet) {
      void (async () => {
        await liveScoreActions.fetchLiveScore()
        await gamePlayActions.clearMatchForTable()
      })()
      return
    }
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
    // The very first game of a fresh match has to start on the handicap
    // score. Every other entry point already does this — restoreGameProgress
    // on reload, nextGame, resetGame, resetWholeMatch — but this one left the
    // umpire scoring from 0:0 in a handicap event until the page was
    // reloaded. Serving is derived from the spotted score exactly as
    // restoreGameProgress derives it, so a reload shows the same thing.
    const startingScores = getStartingScores()
    const gameFirstServeSide = getGameFirstServeSide(
      gamePlayState.initialServingSide,
      gamePlayState.currentGameIndex,
    )

    setGamePlayState({
      showInitDialog: false,
      setupConfirmed: true,
      score1: startingScores.score1,
      score2: startingScores.score2,
      servingSide: calculateServingSide(
        startingScores.score1,
        startingScores.score2,
        gameFirstServeSide,
        11,
      ),
    })
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

  /**
   * Whoever is running this table: an admin, the tablet, or someone who came
   * in with the match-day password. They act for both sides — a player only
   * ever acts for their own.
   */
  canUmpire: (): boolean =>
    authState.isAdmin || authState.isTablet || getUmpireId() != null,

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
    // An umpire has no account, so they start the side under their
    // per-visit id; the endpoint only uses this to check roster membership,
    // which an umpire never has.
    const uid = authState.user?._id?.toString() ?? getUmpireId()
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

  // Flip the page into the loading spinner state until the
  // post-set-order transition (saves → live-score swap → auto-load
  // of the first sub-match) resolves. Without this the team-init
  // body sits visible for the whole round trip.
  beginSetOrderTransition: () => {
    setGamePlayState({ loading: true })
  },

  // Tablet recovery after an admin takeover: the GamePlay page
  // observes that the matchId no longer has an active session
  // (admin released), so we drop the overlay, acquire a fresh
  // session, and refetch the event to pick up any state the admin
  // wrote while in control.
  recoverTabletSession: async () => {
    const { matchId, eventId } = gamePlayState
    if (!matchId || !eventId) return
    setGamePlayState({
      sessionTakenOver: false,
      sessionError: null,
      matchReset: false,
    })
    const ok = await acquireSession(matchId)
    if (!ok) {
      // Acquire failed (server still says match is busy) — flip the
      // overlay back on so the recovery effect retries next time
      // activeSessionMatchIds changes.
      setGamePlayState({ sessionTakenOver: true })
      return
    }
    await fetchEvent(eventId, true)
  },

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
      // Silent refetch: stay on the team-init screen instead of
      // flashing the loading spinner between the two side saves.
      await fetchEvent(eventId, true)
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
      gameConfig.targetPoints,
    )

    setGamePlayState({
      score1: newScore1,
      score2: newScore2,
      servingSide: newServingSide,
      lastScoredSide: side,
    })

    debouncedSaveGame()
    maybePromptLastGameSwitch(newScore1, newScore2, gameConfig)
  },

  deductPointFromSide: (side: 1 | 2) => {
    const newScore1 = side === 1 ? Math.max(0, gamePlayState.score1 - 1) : gamePlayState.score1
    const newScore2 = side === 2 ? Math.max(0, gamePlayState.score2 - 1) : gamePlayState.score2
    const gameFirstServeSide = getGameFirstServeSide(
      gamePlayState.initialServingSide,
      gamePlayState.currentGameIndex,
    )
    const gameConfig = gamePlayActions.getCurrentGameConfig()
    const newServingSide = calculateServingSide(
      newScore1,
      newScore2,
      gameFirstServeSide,
      gameConfig.targetPoints,
    )

    setGamePlayState({
      score1: newScore1,
      score2: newScore2,
      servingSide: newServingSide,
    })

    debouncedSaveGame()
    maybePromptLastGameSwitchBack(newScore1, newScore2, gameConfig)
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

  // Which side the screen shows on the left. The Scorer *tablet* is mounted
  // facing the umpire, across the table from the players, so its left is
  // their right. An admin or a public umpire holding their own device is
  // not mounted anywhere and keeps the view everyone had before any of
  // this, even while they hold the Scorer seat. `leftSide` itself stays one
  // shared, persisted value.
  displayLeftSide: (): 1 | 2 => {
    const { leftSide, tabletRole } = gamePlayState
    if (tabletRole !== 'scorer' || !authState.isTablet) return leftSide
    return leftSide === 1 ? 2 : 1
  },

  isMirror: (): boolean => gamePlayState.tabletRole === 'mirror',

  // Until the umpire presses Start, which end each player is at has not
  // been decided, and naming them would put the wrong name in front of the
  // wrong player. A Mirror shows the score boxes with no names until then.
  showParticipantNames: (): boolean =>
    gamePlayState.tabletRole !== 'mirror' || gamePlayState.setupConfirmed,

  // Who is serving is decided at Start along with the ends, so a Mirror
  // marks nobody until then rather than highlighting a side by default.
  showServingSide: (): boolean =>
    gamePlayState.tabletRole !== 'mirror' || gamePlayState.setupConfirmed,

  isScorer: (): boolean => gamePlayState.tabletRole === 'scorer',

  // The first tablet on a table chooses; the second is given the other role.
  chooseTabletRole: async (role: TabletRole) => {
    const { matchId } = gamePlayState
    setGamePlayState({ showRoleDialog: false })
    if (!matchId) return
    await acquireSession(matchId, role)
  },

  getLeftSidePlayers: (): Player[] =>
    gamePlayActions.displayLeftSide() === 1
      ? gamePlayActions.getSide1Players()
      : gamePlayActions.getSide2Players(),

  getRightSidePlayers: (): Player[] =>
    gamePlayActions.displayLeftSide() === 1
      ? gamePlayActions.getSide2Players()
      : gamePlayActions.getSide1Players(),

  isLeagueEvent,

  getStageName: (): string => {
    const base =
      getTeamsLabel() ??
      (gamePlayState.stage === 'group'
        ? getGroupName(gamePlayState.groupIndex)
        : (getKnockoutRoundName() ?? 'Knockout'))
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

  // One entry per player. Used by the in-score-box name display so
  // doubles render with each player on their own line.
  getParticipantNameLines: (side: 1 | 2): string[] => {
    const players =
      side === 1
        ? gamePlayActions.getSide1Players()
        : gamePlayActions.getSide2Players()
    if (!players || players.length === 0) return ['Player']
    const parent = getCurrentParentMatch()
    return players.map((p) => {
      const base = `${p.firstName} ${p.lastName}`
      // Rating always; in a team sub-match the order-of-play slot leads, so
      // the umpire can tie the name back to the A/B/X/Y lineup:
      //   team sub-match -> "Nan Li (A, 1703)"
      //   anything else  -> "Nan Li (1703)"
      const label = parent
        ? getTeamPlayerOrderLabel(parent, p._id?.toString())
        : undefined
      const detail = [label, p.rating != null ? String(p.rating) : undefined]
        .filter(Boolean)
        .join(', ')
      return detail ? `${base} (${detail})` : base
    })
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

    // Players switch sides after every game (table tennis convention),
    // so flip leftSide for the new game.
    const flippedLeftSide: 1 | 2 = gamePlayState.leftSide === 1 ? 2 : 1

    setGamePlayState({
      currentGameIndex: nextIndex,
      score1: startingScores.score1,
      score2: startingScores.score2,
      gamesWon1: newGamesWon1,
      gamesWon2: newGamesWon2,
      servingSide: nextGameFirstServeSide,
      leftSide: flippedLeftSide,
      timeout1: false,
      timeout2: false,
      gameHistory: newGameHistory,
      lastScoredSide: null,
      lastGameSwitchPrompted: false,
      lastGameSideSwitched: false,
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

  // Tablet mode: drop the current match (after finishing or after
  // expanding a team-match parent) so the page falls back to the
  // "No Match Assigned" screen on this table. The live-score effect
  // will auto-load whatever match gets queued next on this table.
  clearMatchForTable: async () => {
    await flushPendingSave()
    releaseSession()
    setGamePlayState({
      matchId: null,
      eventId: null,
      data: null,
      setupConfirmed: false,
      currentGameIndex: 0,
      score1: 0,
      score2: 0,
      gamesWon1: 0,
      gamesWon2: 0,
      servingSide: 1,
      initialServingSide: 1,
      leftSide: 1,
      showInitDialog: false,
      showFinishDialog: false,
      menuOpen: false,
      matchSubmitted: false,
      gameHistory: [],
      lastScoredSide: null,
      lastGameSwitchPrompted: false,
      lastGameSideSwitched: false,
      loading: false,
    })
  },

  reset: () => {
    flushPendingSave()
    releaseSession()
    // Leaving the page gives up the tablet's place at the table, so the
    // role goes with it and the next visit asks again. Read before the
    // state is cleared, while the table is still known. Hopping to the
    // table's next match does not come through here, so a role survives
    // that — see clearMatchForTable.
    forgetRole(gamePlayState.tableNumber)
    setGamePlayState(getInitialState())
  },
}
