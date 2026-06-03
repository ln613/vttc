import { Show, For, Switch, Match as MatchCase, onMount, onCleanup, type JSX } from 'solid-js'
import { useNavigate, useParams } from '@solidjs/router'
import { Header } from '../components/Header'
import Button from '../components/Button'
import MatchConfirmDialog from '../components/MatchConfirmDialog'
import { eventDetailState, eventDetailActions } from '../stores/eventDetailStore'
import type { StageTab } from '../stores/eventDetailStore'
import { authState } from '../stores/authStore'
import { liveScoreActions } from '../stores/liveScoreStore'
import type { Group, GroupParticipant, Participant, KnockoutRound, KnockoutMatch as KnockoutMatchType, Stage } from '../../shared/types/Tournament'
import type { Player } from '../../shared/types/Player'
import { getProvisionalMatchResult } from '../../shared/rules/matchRules'
import type { Match, Game } from '../../shared/types/Match'
import { parseLocalDate } from '../utils/date'

const EventDetail = () => {
  const params = useParams()
  let lastScrollY = eventDetailState.scrollPosition
  let isUnmounting = false

  onMount(() => {
    if (params.id) {
      eventDetailActions.loadEvent(params.id)
    }
    liveScoreActions.fetchLiveScore()
    restoreScrollPosition()
  })

  const restoreScrollPosition = () => {
    const savedPosition = eventDetailState.scrollPosition
    if (savedPosition > 0) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo(0, savedPosition)
        })
      })
      setTimeout(() => {
        window.scrollTo(0, savedPosition)
      }, 100)
    }
  }

  const handleScroll = () => {
    if (!isUnmounting) {
      lastScrollY = window.scrollY
    }
  }

  onMount(() => {
    window.addEventListener('scroll', handleScroll)
  })

  onCleanup(() => {
    isUnmounting = true
    window.removeEventListener('scroll', handleScroll)
    eventDetailActions.saveScrollPosition(lastScrollY)
    liveScoreActions.stopUpdates()
  })

  return (
    <div style={containerStyle}>
      <Header />
      <div style={contentStyle}>
        <EventHeader />
        <EventContent />
      </div>
      <Show when={eventDetailState.showConfirmDialog}>
        <ConfirmMatchDialog />
      </Show>
      <Show when={eventDetailState.toastMessage}>
        {(toast) => (
          <div style={toastStyle(toast().type)}>{toast().text}</div>
        )}
      </Show>
    </div>
  )
}

const toastStyle = (type: 'success' | 'error'): JSX.CSSProperties => ({
  position: 'fixed',
  top: '20px',
  right: '20px',
  padding: '16px 24px',
  'border-radius': '8px',
  color: '#fff',
  'font-weight': 500,
  'z-index': 1001,
  'background-color': type === 'success' ? '#27ae60' : '#e74c3c',
  'box-shadow': '0 4px 12px rgba(0, 0, 0, 0.15)',
  'max-width': '480px',
})

export const ConfirmMatchDialog = () => {
  const preview = () => eventDetailActions.getConfirmDialogPreview()
  const participant1Name = () =>
    eventDetailActions.getConfirmDialogParticipantName(1)
  const participant2Name = () =>
    eventDetailActions.getConfirmDialogParticipantName(2)

  return (
    <Show when={preview()}>
      {(p) => (
        <MatchConfirmDialog
          preview={p()}
          participant1Name={participant1Name()}
          participant2Name={participant2Name()}
          onCancel={() => eventDetailActions.cancelConfirmDialog()}
          onConfirm={() => eventDetailActions.confirmMatch()}
        />
      )}
    </Show>
  )
}

const EventHeader = () => {
  const eventName = () => eventDetailState.data?.eventName || ''
  const dateDisplay = () => formatDate(eventDetailState.data?.date)
  const timeDisplay = () => eventDetailState.data?.time || ''
  const summary = () => eventDetailActions.getEventSummary()

  const handleResetEvent = () => {
    if (
      confirm(
        'Are you sure you want to reset this event? All schedules, matches and groups will be deleted. Participants will be kept.',
      )
    ) {
      eventDetailActions.resetEvent()
    }
  }

  return (
    <Show when={eventDetailState.data}>
      <div style={titleRowStyle}>
        <h1 style={eventNameStyle}>{eventName()}</h1>
        <Show when={authState.isSuperAdmin}>
          <Button
            onClick={handleResetEvent}
            color="#e74c3c"
            size="small"
            disabled={eventDetailState.resettingEvent}
          >
            {eventDetailState.resettingEvent ? 'Resetting...' : 'Reset Event'}
          </Button>
        </Show>
      </div>
      <div style={dateStyle}>{dateDisplay()}</div>
      <Show when={timeDisplay()}>
        <div style={timeStyle}>{timeDisplay()}</div>
      </Show>
      <Show when={summary()}>
        <div style={summaryStyle}>{summary()}</div>
      </Show>
    </Show>
  )
}

const formatDate = (date?: string): string => {
  if (!date) return ''
  const d = parseLocalDate(date)
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const EventContent = () => (
  <Show when={!eventDetailState.loading} fallback={<div>Loading...</div>}>
    <Show when={eventDetailState.data}>
      <div style={eventContentStyle}>
        <StageTabs />
        <StageContent />
      </div>
    </Show>
  </Show>
)

const TAB_LABELS: Record<StageTab, string> = {
  group: 'Group',
  knockout: 'Knockout',
  bracket: 'Bracket',
}

const StageTabs = () => {
  const tabs = () => eventDetailActions.getVisibleTabs()

  return (
    <Show when={tabs().length > 0}>
      <div style={tabsContainerStyle}>
        <For each={tabs()}>
          {(tab, index) => (
            <TabButton
              label={TAB_LABELS[tab]}
              isActive={eventDetailState.activeStageTab === tab}
              isFirst={index() === 0}
              isLast={index() === tabs().length - 1}
              onClick={() => eventDetailActions.setActiveStageTab(tab)}
            />
          )}
        </For>
      </div>
    </Show>
  )
}

interface TabButtonProps {
  label: string
  isActive: boolean
  isFirst: boolean
  isLast: boolean
  onClick: () => void
}

const TabButton = (props: TabButtonProps) => {
  const borderRadius = (): string => {
    if (props.isFirst) return '8px 0 0 8px'
    if (props.isLast) return '0 8px 8px 0'
    return '0'
  }

  const tabStyle = (): JSX.CSSProperties => ({
    flex: '1',
    padding: '12px 24px',
    border: 'none',
    'border-right': props.isLast ? 'none' : '1px solid #ddd',
    'border-radius': borderRadius(),
    'background-color': props.isActive ? '#2185d0' : 'transparent',
    cursor: 'pointer',
    'font-weight': props.isActive ? 700 : 400,
    'font-size': '16px',
    color: props.isActive ? 'white' : '#333',
    transition: 'all 0.2s ease',
  })

  return (
    <button style={tabStyle()} onClick={props.onClick}>
      {props.label}
    </button>
  )
}

const StageContent = () => (
  <Switch fallback={<GroupStageContent />}>
    <MatchCase when={eventDetailState.activeStageTab === 'group'}>
      <GroupStageContent />
    </MatchCase>
    <MatchCase when={eventDetailState.activeStageTab === 'knockout'}>
      <KnockoutStageContent />
    </MatchCase>
    <MatchCase when={eventDetailState.activeStageTab === 'bracket'}>
      <BracketContent />
    </MatchCase>
  </Switch>
)

const GroupStageContent = () => {
  const hasGroups = () => eventDetailActions.hasGroups()
  const groupStage = () => eventDetailActions.getGroupStage()

  return (
    <Show when={hasGroups()} fallback={<NoGroupsSection />}>
      <div style={groupsListStyle}>
        <For each={groupStage()?.groups}>
          {(group) => <GroupDisplay group={group} />}
        </For>
      </div>
    </Show>
  )
}

const NoGroupsSection = () => (
  <div>
    <GenerateGroupsButton />
    <ParticipantsList />
  </div>
)

const GenerateGroupsButton = () => {
  const handleGenerateGroups = () => {
    eventDetailActions.generateGroups()
  }

  return (
    <Show when={authState.isAdmin}>
      <div style={generateGroupsStyle}>
        <Button
          onClick={handleGenerateGroups}
          disabled={eventDetailState.generatingGroups}
        >
          {eventDetailState.generatingGroups
            ? 'Generating...'
            : 'Generate Groups'}
        </Button>
      </div>
    </Show>
  )
}

const ParticipantsList = () => {
  const participants = () => eventDetailActions.getParticipants()

  return (
    <Show when={participants().length > 0}>
      <div style={participantsListContainerStyle}>
        <h3 style={participantsListTitleStyle}>Participants</h3>
        <div style={participantsListStyle}>
          <For each={participants()}>
            {(participant, index) => (
              <ParticipantRow participant={participant} index={index() + 1} />
            )}
          </For>
        </div>
      </div>
    </Show>
  )
}

interface ParticipantRowProps {
  participant: Participant
  index: number
}

const isParticipantUnpaid = (participant: Participant): boolean => {
  const event = eventDetailState.data
  const paidIds = event?.paidPlayerIds || []
  const nop = event?.nop ?? 1
  if (!participant.players?.length || participant.players.length !== nop) {
    return true
  }
  return !participant.players.every((p) => paidIds.includes(p._id.toString()))
}

const ParticipantRow = (props: ParticipantRowProps) => {
  const displayName = () => getParticipantDisplayName(props.participant)
  const rowBg = () => (props.index % 2 === 0 ? '#f8f9fa' : '#fff')
  const showUnpaid = () =>
    authState.isAdmin && isParticipantUnpaid(props.participant)
  const unpaidColor = (): JSX.CSSProperties =>
    showUnpaid() ? { color: '#e74c3c' } : {}

  return (
    <div
      style={{
        ...participantRowStyle,
        'background-color': rowBg(),
      }}
    >
      <span style={participantIndexStyle}>{props.index}</span>
      <span style={{ ...participantNameStyle, ...unpaidColor() }}>
        {displayName()}
      </span>
      <span style={participantRatingStyle}>{props.participant.rating}</span>
    </div>
  )
}

const getParticipantDisplayName = (participant: Participant): string => {
  if (!participant.players || participant.players.length === 0) return 'Unknown'
  if (participant.teamName) return participant.teamName
  const sorted = [...participant.players].sort(
    (a, b) => (b.rating || 0) - (a.rating || 0),
  )
  return sorted.map((p) => `${p.firstName} ${p.lastName}`).join(' / ')
}

interface GroupDisplayProps {
  group: Group
}

const GroupDisplay = (props: GroupDisplayProps) => {
  const playerColumnTitle = () => eventDetailActions.getPlayerColumnTitle()
  const rankedParticipants = () =>
    getRankedParticipants(props.group.participants)
  const titleStyle = () =>
    props.group.isComplete ? groupTitleCompleteStyle : groupTitleStyle

  return (
    <div style={groupContainerStyle}>
      <h3 style={titleStyle()}>Group {props.group.index + 1}</h3>
      <GroupTable
        participants={rankedParticipants()}
        playerColumnTitle={playerColumnTitle()}
      />
      <MatchSchedule
        matches={props.group.matches}
        groupIndex={props.group.index}
        stage="group"
      />
    </div>
  )
}

interface MatchScheduleProps {
  matches: Match[]
  groupIndex: number
  stage: 'group' | 'knockout'
}

const MatchSchedule = (props: MatchScheduleProps) => {
  const isExpanded = () => eventDetailActions.isMatchScheduleExpanded(props.groupIndex)

  return (
    <Show when={props.matches && props.matches.length > 0}>
      <div style={matchScheduleContainerStyle}>
        <CollapsibleHeader
          title="Match Schedule"
          isExpanded={isExpanded()}
          onToggle={() => eventDetailActions.toggleMatchSchedule(props.groupIndex)}
        />
        <Show when={isExpanded()}>
          <div style={matchScheduleContentStyle}>
            <For each={props.matches}>
              {(match) => (
                <MatchRow match={match} groupIndex={props.groupIndex} stage={props.stage} />
              )}
            </For>
          </div>
        </Show>
      </div>
    </Show>
  )
}

interface CollapsibleHeaderProps {
  title: string
  isExpanded: boolean
  onToggle: () => void
}

const CollapsibleHeader = (props: CollapsibleHeaderProps) => (
  <button style={collapsibleHeaderStyle} onClick={props.onToggle}>
    <span>{props.isExpanded ? '▼' : '▶'}</span>
    <span style={collapsibleTitleStyle}>{props.title}</span>
  </button>
)

export interface MatchRowProps {
  match: Match
  groupIndex: number
  stage: 'group' | 'knockout'
  hideQueueBadge?: boolean
  eventId?: string
}

const collectPlayerIds = (entity: unknown, ids: Set<string>) => {
  const obj = entity as { _id?: unknown; players?: unknown }
  if (obj?._id != null) ids.add(String(obj._id))
  if (Array.isArray(obj?.players)) {
    for (const p of obj.players as { _id?: unknown }[]) {
      if (p?._id != null) ids.add(String(p._id))
    }
  }
}

const isUserInMatch = (match: { side1?: unknown[]; side2?: unknown[] }): boolean => {
  const uid = authState.user?._id?.toString()
  if (!uid) return false
  const ids = new Set<string>()
  for (const p of match.side1 || []) collectPlayerIds(p, ids)
  for (const p of match.side2 || []) collectPlayerIds(p, ids)
  return ids.has(uid)
}

const isUserInGroup = (groupIndex: number): boolean => {
  const uid = authState.user?._id?.toString()
  if (!uid) return false
  const groupStage = eventDetailState.data?.eventStages?.find(
    (s): s is Extract<Stage, { type: 'group' }> => s.type === 'group',
  )
  const group = groupStage?.groups[groupIndex]
  if (!group) return false
  const ids = new Set<string>()
  for (const gp of group.participants) collectPlayerIds(gp.participant, ids)
  return ids.has(uid)
}

export const MatchRow = (props: MatchRowProps) => {
  const navigate = useNavigate()
  const side1Players = () => getMatchSidePlayers(props.match.side1)
  const side2Players = () => getMatchSidePlayers(props.match.side2)
  const hasResult = () =>
    props.match.winningSide !== undefined && props.match.winningSide !== null
  const isConfirmed = () => props.match.confirmed === true
  const hasStarted = () =>
    hasResult() ||
    (props.match.games && props.match.games.length > 0) ||
    (props.match.initialServingSide != null && props.match.leftSide != null)
  const isConfirming = () =>
    eventDetailState.confirmingMatchId === props.match._id
  const isResetting = () =>
    eventDetailState.resettingMatchId === props.match._id
  const canReset = () =>
    authState.isAdmin &&
    isConfirmed() &&
    eventDetailActions.canResetMatch(props.match._id, props.stage, props.groupIndex)
  const assignedTable = () =>
    liveScoreActions.getTableForMatch(props.match._id)
  const inQueue = () => liveScoreActions.isMatchInQueue(props.match._id)
  const provisional = () => getProvisionalMatchResult(props.match)
  const sessionActive = () =>
    liveScoreActions.isMatchSessionActive(props.match._id)
  const startContinueDisabled = () =>
    !authState.isAdmin && sessionActive()
  const phase = (): 'not_started' | 'in_progress' | 'finished' => {
    if (hasResult()) return 'finished'
    if (hasStarted()) return 'in_progress'
    return 'not_started'
  }
  const canStartOrContinue = () =>
    authState.isAdmin ||
    isUserInMatch(props.match) ||
    (props.stage === 'group' && isUserInGroup(props.groupIndex))

  const handleStartClick = () => {
    const eventId = props.eventId ?? eventDetailState.eventId
    if (eventId) {
      navigate(
        `/game-play?eventId=${eventId}&stage=${props.stage}&groupIndex=${props.groupIndex}&matchId=${props.match._id}`,
      )
    }
  }

  const handleConfirmClick = () => {
    const eventId = props.eventId ?? eventDetailState.eventId ?? undefined
    eventDetailActions.showConfirmDialog(props.match._id, eventId)
  }

  const handleResetClick = () => {
    if (confirm('Are you sure you want to reset this match? All game data will be deleted.')) {
      eventDetailActions.resetMatch(props.match._id)
    }
  }

  const handleSimulateClick = () => {
    eventDetailActions.simulateMatch(props.match._id, props.match)
  }

  return (
    <div
      style={getMatchRowStyle(
        phase(),
        assignedTable() !== undefined,
        inQueue(),
      )}
    >
      <Show when={assignedTable() !== undefined}>
        <div style={matchRowTableNumberStyle}>{assignedTable()}</div>
      </Show>
      <Show
        when={
          !props.hideQueueBadge &&
          assignedTable() === undefined &&
          inQueue() &&
          phase() === 'not_started'
        }
      >
        <div style={matchRowTableNumberStyle}>Q</div>
      </Show>
      <div style={matchContentContainerStyle}>
        <MatchResultDisplay
          side1Players={side1Players()}
          side2Players={side2Players()}
          gamesWon1={provisional().gamesWon1}
          gamesWon2={provisional().gamesWon2}
          winningSide={provisional().winningSide}
        />
        <GameScoresDisplay games={props.match.games} />
      </div>
      <div style={matchRowActionsStyle}>
        <Show
          when={
            !hasStarted() &&
            assignedTable() !== undefined &&
            canStartOrContinue()
          }
        >
          <Button
            onClick={handleStartClick}
            color="#27ae60"
            size="small"
            disabled={startContinueDisabled()}
          >
            {isUserInMatch(props.match) ? 'Start' : 'Umpire'}
          </Button>
        </Show>
        <Show
          when={
            hasStarted() &&
            !hasResult() &&
            !provisional().winningSide &&
            assignedTable() !== undefined &&
            canStartOrContinue()
          }
        >
          <Button
            onClick={handleStartClick}
            color="#e67e22"
            size="small"
            disabled={startContinueDisabled()}
          >
            {isUserInMatch(props.match) ? 'Continue' : 'Umpire'}
          </Button>
        </Show>
        <Show
          when={
            (hasResult() || provisional().winningSide) &&
            !isConfirmed() &&
            canStartOrContinue()
          }
        >
          <Button
            onClick={handleConfirmClick}
            color="#e74c3c"
            size="small"
            disabled={isConfirming()}
          >
            {isConfirming() ? 'Confirming...' : 'Confirm'}
          </Button>
        </Show>
        <Show when={canReset()}>
          <Button
            onClick={handleResetClick}
            color="#e74c3c"
            size="small"
            disabled={isResetting()}
          >
            {isResetting() ? 'Resetting...' : 'Reset'}
          </Button>
        </Show>
        <Show
          when={
            authState.isAdmin &&
            isSimulationEnabled() &&
            !hasResult() &&
            !provisional().winningSide &&
            liveScoreActions.getAssignedMatchIds().has(props.match._id)
          }
        >
          <Button onClick={handleSimulateClick} color="#9b59b6" size="small">
            Simulate
          </Button>
        </Show>
      </div>
    </div>
  )
}

const isSimulationEnabled = (): boolean =>
  import.meta.env.VITE_SIMULATION === '1'

interface SidePlayer {
  firstName: string
  lastName: string
}

const getMatchSidePlayers = (side: Player[]): SidePlayer[] => {
  if (!side || side.length === 0) return [{ firstName: 'Unknown', lastName: '' }]
  return side.map((p) => ({ firstName: p.firstName, lastName: p.lastName }))
}

interface MatchResultDisplayProps {
  side1Players: SidePlayer[]
  side2Players: SidePlayer[]
  gamesWon1: number
  gamesWon2: number
  winningSide?: 1 | 2
}

const MatchResultDisplay = (props: MatchResultDisplayProps) => {
  const side1IsWinner = () => props.winningSide === 1
  const side2IsWinner = () => props.winningSide === 2

  return (
    <div style={matchResultStyle}>
      <div style={matchLeftSideStyle}>
        <PlayerNameDisplay
          players={props.side1Players}
          align="right"
          isWinner={side1IsWinner()}
        />
        <span
          style={side1IsWinner() ? winningScoreStyle : losingScoreStyle}
        >
          {props.gamesWon1}
        </span>
      </div>
      <span style={scoreSeparatorStyle}>:</span>
      <div style={matchRightSideStyle}>
        <span
          style={side2IsWinner() ? winningScoreStyle : losingScoreStyle}
        >
          {props.gamesWon2}
        </span>
        <PlayerNameDisplay
          players={props.side2Players}
          align="left"
          isWinner={side2IsWinner()}
        />
      </div>
    </div>
  )
}

interface PlayerNameDisplayProps {
  players: SidePlayer[]
  align: 'left' | 'right'
  isWinner: boolean
}

const PlayerNameDisplay = (props: PlayerNameDisplayProps) => (
  <div
    style={{
      display: 'flex',
      'flex-direction': 'column',
      'align-items': props.align === 'right' ? 'flex-end' : 'flex-start',
    }}
  >
    <For each={props.players}>
      {(player, index) => (
        <>
          <Show when={index() > 0}>
            <span style={playerSeparatorStyle}>/</span>
          </Show>
          <span
            style={{
              'font-size': '15px',
              'font-weight': props.isWinner ? 700 : 400,
              color: props.isWinner ? '#2c3e50' : '#555',
              'line-height': '1.2',
            }}
          >
            {player.firstName}
          </span>
          <span
            style={{
              'font-size': '13px',
              'font-weight': props.isWinner ? 600 : 400,
              color: props.isWinner ? '#34495e' : '#888',
              'line-height': '1.2',
            }}
          >
            {player.lastName}
          </span>
        </>
      )}
    </For>
  </div>
)

interface GameScoresDisplayProps {
  games: Game[]
}

const GameScoresDisplay = (props: GameScoresDisplayProps) => (
  <Show when={props.games && props.games.length > 0}>
    <div style={gameScoresStyle}>
      <For each={props.games}>
        {(game, index) => (
          <GameScoreDisplay
            game={game}
            isLast={index() === props.games.length - 1}
          />
        )}
      </For>
    </div>
  </Show>
)

interface GameScoreDisplayProps {
  game: Game
  isLast: boolean
}

const GameScoreDisplay = (props: GameScoreDisplayProps) => {
  const side1IsBold = () => props.game.winningSide === 1
  const side2IsBold = () => props.game.winningSide === 2

  return (
    <span>
      <span style={side1IsBold() ? boldScoreStyle : normalScoreStyle}>
        {props.game.score1}
      </span>
      <span style={gameScoreSeparatorStyle}>:</span>
      <span style={side2IsBold() ? boldScoreStyle : normalScoreStyle}>
        {props.game.score2}
      </span>
      <Show when={!props.isLast}>
        <span style={gameDelimiterStyle}>,</span>
      </Show>
    </span>
  )
}

const getRankedParticipants = (
  participants: GroupParticipant[],
): GroupParticipant[] =>
  [...participants].sort((a, b) => {
    // Use server-computed ranking when available
    if (a.ranking != null && b.ranking != null) {
      return a.ranking - b.ranking
    }
    // Fallback: MW descending, then ML ascending (lower is better),
    // then GD, GW, PD, PW
    if (b.stats.matchesWon !== a.stats.matchesWon) {
      return b.stats.matchesWon - a.stats.matchesWon
    }
    if (a.stats.matchesLost !== b.stats.matchesLost) {
      return a.stats.matchesLost - b.stats.matchesLost
    }
    if (b.stats.gameDifference !== a.stats.gameDifference) {
      return b.stats.gameDifference - a.stats.gameDifference
    }
    if (b.stats.gamesWon !== a.stats.gamesWon) {
      return b.stats.gamesWon - a.stats.gamesWon
    }
    if (b.stats.pointDifference !== a.stats.pointDifference) {
      return b.stats.pointDifference - a.stats.pointDifference
    }
    return b.stats.pointsWon - a.stats.pointsWon
  })

interface GroupTableProps {
  participants: GroupParticipant[]
  playerColumnTitle: string
}

const GroupTable = (props: GroupTableProps) => (
  <div style={tableWrapperStyle}>
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>Rank</th>
          <th style={{ ...thStyle, 'text-align': 'left' }}>
            {props.playerColumnTitle}
          </th>
          <th style={thStyle}>Total</th>
          <th style={thStyle}>W</th>
          <th style={thStyle}>L</th>
          <th style={thStyle}>+/-</th>
          <th style={thStyle}>GW</th>
          <th style={thStyle}>GL</th>
          <th style={thStyle}>G+/-</th>
          <th style={thStyle}>PW</th>
          <th style={thStyle}>PL</th>
          <th style={thStyle}>P+/-</th>
        </tr>
      </thead>
      <tbody>
        <For each={props.participants}>
          {(gp, index) => (
            <GroupTableRow participant={gp} rank={index() + 1} />
          )}
        </For>
      </tbody>
    </table>
  </div>
)

interface GroupTableRowProps {
  participant: GroupParticipant
  rank: number
}

const GroupTableRow = (props: GroupTableRowProps) => {
  const stats = () => props.participant.stats
  const total = () => stats().matchesWon + stats().matchesLost
  const playerDisplay = () => getPlayerDisplay(props.participant)
  const matchDifference = () => stats().matchesWon - stats().matchesLost
  const matchDifferenceDisplay = () =>
    formatDifference(matchDifference())
  const gameDifferenceDisplay = () =>
    formatDifference(stats().gameDifference)
  const pointDifferenceDisplay = () =>
    formatDifference(stats().pointDifference)

  const rowBg = () => (props.rank % 2 === 0 ? '#f8f9fa' : '#fff')
  const cellStyle = (): JSX.CSSProperties => ({
    ...tdStyle,
    'background-color': rowBg(),
  })

  return (
    <tr>
      <td style={cellStyle()}>{props.rank}</td>
      <td
        style={{ ...cellStyle(), 'text-align': 'left', 'font-weight': 500 }}
      >
        {playerDisplay()}
      </td>
      <td style={cellStyle()}>{total()}</td>
      <td style={{ ...cellStyle(), 'font-weight': 600, color: '#27ae60' }}>
        {stats().matchesWon}
      </td>
      <td style={{ ...cellStyle(), color: '#e74c3c' }}>
        {stats().matchesLost}
      </td>
      <td style={cellStyle()}>{matchDifferenceDisplay()}</td>
      <td style={cellStyle()}>{stats().gamesWon}</td>
      <td style={cellStyle()}>{stats().gamesLost}</td>
      <td style={cellStyle()}>{gameDifferenceDisplay()}</td>
      <td style={cellStyle()}>{stats().pointsWon}</td>
      <td style={cellStyle()}>{stats().pointsLost}</td>
      <td style={cellStyle()}>{pointDifferenceDisplay()}</td>
    </tr>
  )
}

const formatDifference = (value: number): string =>
  value >= 0 ? `+${value}` : String(value)

const getPlayerDisplay = (gp: GroupParticipant): string => {
  const participant = gp.participant

  if ('players' in participant && Array.isArray(participant.players)) {
    const sortedPlayers = [...participant.players].sort(
      (a, b) => (b.rating || 0) - (a.rating || 0),
    )
    return sortedPlayers
      .map((p) => `${p.firstName} ${p.lastName}`)
      .join(' / ')
  }

  if ('firstName' in participant && 'lastName' in participant) {
    return `${participant.firstName} ${participant.lastName}`
  }

  return 'Unknown'
}

// ==================== KNOCKOUT STAGE ====================

const KnockoutStageContent = () => {
  const canGenerate = () => eventDetailActions.canGenerateNextRound()
  const rounds = () => eventDetailActions.getKnockoutRounds()

  return (
    <div>
      <Show when={canGenerate() && authState.isAdmin}>
        <GenerateNextRoundSection />
      </Show>
      <Show when={rounds().length > 0}>
        <div style={groupsListStyle}>
          <For each={rounds()}>
            {(round) => <KnockoutRoundDisplay round={round} />}
          </For>
        </div>
      </Show>
    </div>
  )
}

const GenerateNextRoundSection = () => {
  const handleClick = () => {
    eventDetailActions.generateNextRound()
  }

  return (
    <div style={generateGroupsStyle}>
      <Button
        onClick={handleClick}
        disabled={eventDetailState.generatingNextRound}
      >
        {eventDetailState.generatingNextRound
          ? 'Generating...'
          : 'Generate Next Round'}
      </Button>
    </div>
  )
}

interface KnockoutRoundDisplayProps {
  round: KnockoutRound
}

const KnockoutRoundDisplay = (props: KnockoutRoundDisplayProps) => {
  const roundMatches = () =>
    props.round.matches
      .filter((km) => km.match != null)
      .map((km) => km.match!)

  // Use a unique index offset so knockout round schedules don't collide with group indexes
  const scheduleIndex = () => 1000 + props.round.index

  return (
    <div style={groupContainerStyle}>
      <h3 style={knockoutRoundTitleStyle}>{props.round.name}</h3>
      <div style={knockoutMatchesContainerStyle}>
        <For each={props.round.matches}>
          {(km) => <KnockoutMatchDisplay knockoutMatch={km} roundIndex={props.round.index} />}
        </For>
      </div>
    </div>
  )
}

interface KnockoutMatchDisplayProps {
  knockoutMatch: KnockoutMatchType
  roundIndex: number
}

const KnockoutMatchDisplay = (props: KnockoutMatchDisplayProps) => {
  const navigate = useNavigate()
  const isBye = () => props.knockoutMatch.isBye2 || props.knockoutMatch.isBye1
  const match = () => props.knockoutMatch.match

  const participant1Name = () =>
    getKnockoutParticipantName(props.knockoutMatch.participant1)
  const participant2Name = () =>
    props.knockoutMatch.isBye2
      ? 'BYE'
      : getKnockoutParticipantName(props.knockoutMatch.participant2)

  return (
    <Show
      when={!isBye()}
      fallback={
        <div style={knockoutByeRowStyle}>
          <span style={knockoutByeNameStyle}>{participant1Name()}</span>
          <span style={knockoutByeLabelStyle}>BYE</span>
        </div>
      }
    >
      <Show when={match()}>
        {(m) => (
          <MatchRow
            match={m()}
            groupIndex={props.roundIndex}
            stage="knockout"
          />
        )}
      </Show>
    </Show>
  )
}

const getKnockoutParticipantName = (participant?: {
  participant?: { players?: Player[]; firstName?: string; lastName?: string; name?: string }
}): string => {
  if (!participant) return 'TBD'
  const p = participant.participant
  if (!p) return 'TBD'

  if ('players' in p && Array.isArray(p.players) && p.players.length > 0) {
    return p.players
      .map((pl: Player) => `${pl.firstName} ${pl.lastName}`)
      .join(' / ')
  }

  if ('firstName' in p && p.firstName) {
    return `${p.firstName} ${p.lastName || ''}`
  }

  if ('name' in p && p.name) {
    return p.name as string
  }

  return 'TBD'
}

// ==================== BRACKET TAB ====================

const BracketContent = () => {
  const rounds = () => eventDetailActions.getKnockoutRounds()

  return (
    <Show
      when={rounds().length > 0}
      fallback={<div style={emptyContentStyle}>No bracket data available</div>}
    >
      <div style={bracketContainerStyle}>
        <For each={rounds()}>
          {(round, roundIndex) => (
            <>
              <div style={bracketRoundColumnStyle}>
                <div style={bracketRoundHeaderStyle}>{round.name}</div>
                <div style={bracketRoundMatchesStyle}>
                  <For each={round.matches}>
                    {(km) => (
                      <div style={bracketMatchSlotStyle}>
                        <BracketMatchCard knockoutMatch={km} />
                      </div>
                    )}
                  </For>
                </div>
              </div>
              <Show when={roundIndex() < rounds().length - 1}>
                <BracketRoundConnector matchCount={round.matches.length} />
              </Show>
            </>
          )}
        </For>
      </div>
    </Show>
  )
}

interface BracketRoundConnectorProps {
  matchCount: number
}

const BracketRoundConnector = (props: BracketRoundConnectorProps) => {
  const pairCount = () => Math.floor(props.matchCount / 2)

  return (
    <div style={connectorColumnStyle}>
      <div style={connectorHeaderSpacerStyle} />
      <div style={connectorMatchesAreaStyle}>
        <For each={Array.from({ length: pairCount() })}>
          {() => <ConnectorPair />}
        </For>
      </div>
    </div>
  )
}

const ConnectorPair = () => (
  <div style={connectorPairStyle}>
    {/* Left half: bracket shape ┐┘ */}
    <div style={connectorLeftHalfStyle}>
      {/* Top match-aligned slot */}
      <div style={connectorSlotStyle}>
        <div style={connectorSlotSpacerStyle} />
        <div style={connectorSlotCornerTopStyle} />
      </div>
      {/* Bottom match-aligned slot */}
      <div style={connectorSlotStyle}>
        <div style={connectorSlotCornerBottomStyle} />
        <div style={connectorSlotSpacerStyle} />
      </div>
    </div>
    {/* Right half: horizontal line from merge point to next round */}
    <div style={connectorRightHalfStyle}>
      <div style={connectorMergeLineStyle} />
    </div>
  </div>
)

interface BracketMatchCardProps {
  knockoutMatch: KnockoutMatchType
}

const BracketMatchCard = (props: BracketMatchCardProps) => {
  const isBye = () => props.knockoutMatch.isBye2 || props.knockoutMatch.isBye1
  const p1Name = () => getKnockoutParticipantName(props.knockoutMatch.participant1)
  const p2Name = () =>
    isBye() ? 'BYE' : getKnockoutParticipantName(props.knockoutMatch.participant2)
  const match = () => props.knockoutMatch.match
  const isFinished = () => match()?.winningSide != null
  const p1IsWinner = () => match()?.winningSide === 1
  const p2IsWinner = () => match()?.winningSide === 2 && !isBye()
  const p1IsLeading = () =>
    !isFinished() && match() != null && match()!.gamesWon1 > match()!.gamesWon2
  const p2IsLeading = () =>
    !isFinished() && !isBye() && match() != null && match()!.gamesWon2 > match()!.gamesWon1

  const p1BgColor = () => {
    if (p1IsWinner()) return '#e8f5e9'
    if (p1IsLeading()) return '#f5f5eb'
    return '#fff'
  }
  const p2BgColor = () => {
    if (p2IsWinner()) return '#e8f5e9'
    if (p2IsLeading()) return '#f5f5eb'
    if (isBye()) return '#f5f5f5'
    return '#fff'
  }

  return (
    <div style={bracketMatchCardStyle}>
      <div
        style={{
          ...bracketMatchPlayerStyle,
          'font-weight': p1IsWinner() || p1IsLeading() ? 700 : 400,
          'background-color': p1BgColor(),
        }}
      >
        <span style={bracketPlayerNameStyle}>{p1Name()}</span>
        <Show when={match()}>
          <span style={bracketScoreStyle}>{match()!.gamesWon1}</span>
        </Show>
      </div>
      <div
        style={{
          ...bracketMatchPlayerStyle,
          'font-weight': p2IsWinner() || p2IsLeading() ? 700 : 400,
          'background-color': p2BgColor(),
          'border-top': '1px solid #e0e0e0',
        }}
      >
        <span
          style={{
            ...bracketPlayerNameStyle,
            color: isBye() ? '#999' : '#333',
            'font-style': isBye() ? 'italic' : 'normal',
          }}
        >
          {p2Name()}
        </span>
        <Show when={match() && !isBye()}>
          <span style={bracketScoreStyle}>{match()!.gamesWon2}</span>
        </Show>
      </div>
    </div>
  )
}

// ==================== STYLES ====================

const containerStyle: JSX.CSSProperties = {
  'min-height': '100vh',
  'background-color': '#f5f5f5',
}

const contentStyle: JSX.CSSProperties = {
  'max-width': '1200px',
  margin: '0 auto',
  padding: '16px 20px 20px',
}

const titleRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  gap: '16px',
}

const eventNameStyle: JSX.CSSProperties = {
  'text-align': 'left',
  'font-size': '28px',
  'font-weight': 700,
  color: '#333',
  'margin-top': '0',
  'margin-bottom': '4px',
}

const dateStyle: JSX.CSSProperties = {
  'text-align': 'left',
  'font-size': '18px',
  'font-weight': 400,
  color: '#555',
  'margin-bottom': '2px',
}

const timeStyle: JSX.CSSProperties = {
  'text-align': 'left',
  'font-size': '16px',
  'font-weight': 400,
  color: '#555',
  'margin-bottom': '2px',
}

const summaryStyle: JSX.CSSProperties = {
  'text-align': 'left',
  'font-size': '14px',
  'font-weight': 400,
  color: '#777',
  'margin-bottom': '20px',
}

const eventContentStyle: JSX.CSSProperties = {
  'margin-top': '20px',
}

const tabsContainerStyle: JSX.CSSProperties = {
  display: 'flex',
  border: '1px solid #ddd',
  'border-radius': '8px',
  'margin-bottom': '20px',
  'background-color': '#fff',
}

const groupsListStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '24px',
}

const generateGroupsStyle: JSX.CSSProperties = {
  padding: '40px',
  'text-align': 'center',
}

const participantsListContainerStyle: JSX.CSSProperties = {
  'background-color': '#fff',
  'border-radius': '12px',
  'box-shadow': '0 2px 8px rgba(0, 0, 0, 0.08)',
  overflow: 'hidden',
  border: '1px solid #e8e8e8',
  margin: '0 20px 20px',
}

const participantsListTitleStyle: JSX.CSSProperties = {
  'font-size': '16px',
  'font-weight': 700,
  color: '#fff',
  margin: '0',
  padding: '14px 20px',
  background: 'linear-gradient(135deg, #2c3e50, #34495e)',
  'letter-spacing': '0.5px',
}

const participantsListStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
}

const participantRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  padding: '10px 20px',
  'border-bottom': '1px solid #f0f0f0',
  gap: '12px',
}

const participantIndexStyle: JSX.CSSProperties = {
  'font-size': '13px',
  color: '#999',
  'min-width': '24px',
  'text-align': 'center',
}

const participantNameStyle: JSX.CSSProperties = {
  'font-size': '15px',
  'font-weight': 500,
  color: '#333',
  flex: '1',
}

const participantRatingStyle: JSX.CSSProperties = {
  'font-size': '13px',
  color: '#888',
  'min-width': '40px',
  'text-align': 'right',
}

const groupContainerStyle: JSX.CSSProperties = {
  'background-color': '#fff',
  'border-radius': '12px',
  padding: '0',
  'box-shadow': '0 2px 8px rgba(0, 0, 0, 0.08)',
  overflow: 'hidden',
  border: '1px solid #e8e8e8',
}

const groupTitleStyle: JSX.CSSProperties = {
  'font-size': '16px',
  'font-weight': 700,
  color: '#fff',
  margin: '0',
  padding: '14px 20px',
  background: 'linear-gradient(135deg, #2c3e50, #34495e)',
  'letter-spacing': '0.5px',
}

const groupTitleCompleteStyle: JSX.CSSProperties = {
  'font-size': '16px',
  'font-weight': 700,
  color: '#fff',
  margin: '0',
  padding: '14px 20px',
  background: 'linear-gradient(135deg, #1e7e34, #27ae60)',
  'letter-spacing': '0.5px',
}

const knockoutRoundTitleStyle: JSX.CSSProperties = {
  'font-size': '16px',
  'font-weight': 700,
  color: '#fff',
  margin: '0',
  padding: '14px 20px',
  background: 'linear-gradient(135deg, #8e44ad, #9b59b6)',
  'letter-spacing': '0.5px',
}

const knockoutMatchesContainerStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '10px',
  padding: '16px 20px',
}

const knockoutByeRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  padding: '12px 16px',
  'background-color': '#f8f9fa',
  'border-radius': '8px',
  border: '1px dashed #ddd',
}

const knockoutByeNameStyle: JSX.CSSProperties = {
  'font-weight': 600,
  color: '#333',
}

const knockoutByeLabelStyle: JSX.CSSProperties = {
  'font-style': 'italic',
  color: '#999',
  'font-size': '14px',
}

const tableWrapperStyle: JSX.CSSProperties = {
  'overflow-x': 'auto',
  '-webkit-overflow-scrolling': 'touch',
}

const tableStyle: JSX.CSSProperties = {
  width: '100%',
  'border-collapse': 'collapse',
  'font-size': '13px',
  'min-width': '600px',
}

const thStyle: JSX.CSSProperties = {
  padding: '10px 8px',
  'text-align': 'center',
  'border-bottom': '2px solid #e67e22',
  'background-color': '#fafafa',
  'font-weight': 700,
  'font-size': '12px',
  color: '#666',
  'text-transform': 'uppercase',
  'letter-spacing': '0.5px',
}

const tdStyle: JSX.CSSProperties = {
  padding: '10px 8px',
  'text-align': 'center',
  'border-bottom': '1px solid #f0f0f0',
  color: '#444',
}

const emptyContentStyle: JSX.CSSProperties = {
  padding: '40px',
  'text-align': 'center',
  color: '#666',
}

const matchScheduleContainerStyle: JSX.CSSProperties = {
  'margin-top': '0',
  padding: '16px 20px',
  'background-color': '#fafafa',
  'border-top': '1px solid #f0f0f0',
}

const collapsibleHeaderStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '8px 0',
  'font-size': '15px',
  color: '#1a1a2e',
  width: '100%',
}

const collapsibleTitleStyle: JSX.CSSProperties = {
  'font-weight': 700,
  'letter-spacing': '0.3px',
}

const matchScheduleContentStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '10px',
  'margin-top': '12px',
  padding: '12px',
  'background-color': '#f0f2f5',
  'border-radius': '8px',
}

const getMatchRowStyle = (
  phase: 'not_started' | 'in_progress' | 'finished',
  hasTable: boolean,
  inQueue: boolean,
): JSX.CSSProperties => ({
  position: 'relative',
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  gap: '10px',
  padding: '14px 16px',
  'background-color':
    phase === 'in_progress'
      ? '#e3f2fd'
      : hasTable && phase === 'not_started'
        ? '#fdecea'
        : inQueue && phase === 'not_started'
          ? '#e8f5e9'
          : '#fff',
  'border-radius': '10px',
  'box-shadow': '0 1px 4px rgba(0, 0, 0, 0.08)',
})

const matchRowTableNumberStyle: JSX.CSSProperties = {
  position: 'absolute',
  left: '16px',
  top: '50%',
  transform: 'translateY(-50%)',
  'font-size': '48px',
  'font-weight': 900,
  color: '#f1c40f',
  'line-height': 1,
  'pointer-events': 'none',
}

const matchContentContainerStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  gap: '6px',
  width: '100%',
}

const matchRowActionsStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'row',
  'flex-wrap': 'wrap',
  'align-items': 'center',
  'justify-content': 'center',
  gap: '8px',
}

const matchResultStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  width: '100%',
}

const matchLeftSideStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'flex-end',
  gap: '12px',
  flex: '1',
}

const matchRightSideStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'flex-start',
  gap: '12px',
  flex: '1',
}

const scoreSeparatorStyle: JSX.CSSProperties = {
  color: '#999',
  padding: '0 6px',
  'font-size': '20px',
  'font-weight': 300,
}

const winningScoreStyle: JSX.CSSProperties = {
  'font-weight': 800,
  'font-size': '28px',
  color: '#e67e22',
}

const losingScoreStyle: JSX.CSSProperties = {
  'font-weight': 400,
  'font-size': '28px',
  color: '#666',
}

const playerSeparatorStyle: JSX.CSSProperties = {
  'font-size': '11px',
  color: '#aaa',
  margin: '2px 0',
}

const boldScoreStyle: JSX.CSSProperties = {
  'font-weight': 700,
  color: '#d35400',
}

const normalScoreStyle: JSX.CSSProperties = {
  'font-weight': 400,
  color: '#555',
}

const gameScoresStyle: JSX.CSSProperties = {
  'font-size': '13px',
  color: '#555',
  'background-color': '#f8f8f8',
  padding: '4px 10px',
  'border-radius': '12px',
}

const gameScoreSeparatorStyle: JSX.CSSProperties = {
  margin: '0 2px',
}

const gameDelimiterStyle: JSX.CSSProperties = {
  'margin-right': '8px',
}

// Bracket styles
const bracketContainerStyle: JSX.CSSProperties = {
  display: 'flex',
  'overflow-x': 'auto',
  padding: '16px 0',
  '-webkit-overflow-scrolling': 'touch',
  'align-items': 'stretch',
}

const bracketRoundColumnStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  'min-width': '220px',
  gap: '8px',
}

const bracketRoundHeaderStyle: JSX.CSSProperties = {
  'font-size': '14px',
  'font-weight': 700,
  color: '#555',
  'text-align': 'center',
  padding: '8px',
  'background-color': '#f0f0f0',
  'border-radius': '8px',
  'text-transform': 'uppercase',
  'letter-spacing': '0.5px',
}

const bracketRoundMatchesStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  flex: '1',
}

const bracketMatchSlotStyle: JSX.CSSProperties = {
  flex: '1',
  display: 'flex',
  'align-items': 'center',
  padding: '6px 0',
}

const bracketMatchCardStyle: JSX.CSSProperties = {
  'border-radius': '8px',
  overflow: 'hidden',
  border: '1px solid #e0e0e0',
  'box-shadow': '0 1px 3px rgba(0,0,0,0.08)',
  width: '100%',
}

const bracketMatchPlayerStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'space-between',
  'align-items': 'center',
  padding: '8px 12px',
  'font-size': '13px',
}

const bracketPlayerNameStyle: JSX.CSSProperties = {
  color: '#333',
  'white-space': 'nowrap',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'max-width': '160px',
}

const bracketScoreStyle: JSX.CSSProperties = {
  'font-weight': 700,
  'font-size': '14px',
  color: '#e67e22',
  'min-width': '20px',
  'text-align': 'center',
}

// Bracket connector styles
const connectorColumnStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  width: '40px',
  'flex-shrink': '0',
}

const connectorHeaderSpacerStyle: JSX.CSSProperties = {
  height: '40px', // match the round header height (padding 8px*2 + font ~14px + gap 8px)
}

const connectorMatchesAreaStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  flex: '1',
}

const connectorPairStyle: JSX.CSSProperties = {
  flex: '1',
  display: 'flex',
}

const connectorLeftHalfStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  width: '50%',
}

const connectorSlotStyle: JSX.CSSProperties = {
  flex: '1',
  display: 'flex',
  'flex-direction': 'column',
}

const connectorSlotSpacerStyle: JSX.CSSProperties = {
  flex: '1',
}

const connectorSlotCornerTopStyle: JSX.CSSProperties = {
  flex: '1',
  'border-right': '2px solid #ccc',
  'border-top': '2px solid #ccc',
}

const connectorSlotCornerBottomStyle: JSX.CSSProperties = {
  flex: '1',
  'border-right': '2px solid #ccc',
  'border-bottom': '2px solid #ccc',
}

const connectorRightHalfStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  width: '50%',
}

const connectorMergeLineStyle: JSX.CSSProperties = {
  height: '2px',
  width: '100%',
  'background-color': '#ccc',
}

export default EventDetail
