import { Show, For, createSignal, onMount, onCleanup, type JSX } from 'solid-js'
import { subscribeToLiveScoreUpdates } from '../utils/pusher'
import { Header } from '../components/Header'
import ToggleButton from '../components/ToggleButton'
import { eventState, eventActions, type EventOption } from '../stores/eventStore'
import { liveScoreState, liveScoreActions } from '../stores/liveScoreStore'
import { authState } from '../stores/authStore'
import { MatchRow, ConfirmMatchDialog } from './EventDetail'
import { eventDetailState } from '../stores/eventDetailStore'
import type { Match } from '../../shared/types/Match'
import type { Stage, GroupStage, KnockoutStage } from '../../shared/types/Tournament'

interface MatchEntry {
  match: Match
  groupIndex: number
  stage: 'group' | 'knockout'
  eventId: string
  eventName: string
  stageLabel: string
  // For team-event sub-matches: the parent team match and the
  // sub-match's index within parent.subMatches[].
  parent?: Match
  subMatchIndex?: number
}

const Schedule = () => {
  const [myMatchesOnly, setMyMatchesOnly] = createSignal(false)

  let subscription: { unsubscribe: () => void } | null = null

  onMount(() => {
    eventActions.fetchEvents()
    liveScoreActions.fetchLiveScore()
    // Refetch events whenever the live-score channel pings; liveScoreActions
    // already maintains its own subscription that refreshes table/queue state.
    subscription = subscribeToLiveScoreUpdates(() => {
      void eventActions.fetchEvents()
    })
  })

  onCleanup(() => {
    subscription?.unsubscribe()
  })

  return (
    <div style={containerStyle}>
      <Header />
      <div style={contentStyle}>
        <div style={titleRowStyle}>
          <h1 style={titleStyle}>Schedule</h1>
          <ToggleButton
            label="My Matches"
            value={myMatchesOnly()}
            onChange={(v) => setMyMatchesOnly(v)}
          />
        </div>
        <ScheduleContent myMatchesOnly={myMatchesOnly()} />
      </div>
      <Show when={eventDetailState.showConfirmDialog}>
        <ConfirmMatchDialog />
      </Show>
    </div>
  )
}

const ScheduleContent = (props: { myMatchesOnly: boolean }) => {
  const data = () => buildScheduleData(props.myMatchesOnly)
  return (
    <div style={listStyle}>
      <Section
        title="On Tables"
        empty="No matches currently on tables"
        entries={data().onTables}
      />
      <Section
        title="In Queue"
        empty="No matches in queue"
        entries={data().inQueue}
        hideQueueBadge
        markUnavailablePlayers
      />
      <Section
        title="Finished"
        empty="No finished matches"
        entries={data().finished}
      />
    </div>
  )
}

const Section = (props: {
  title: string
  empty: string
  entries: MatchEntry[]
  hideQueueBadge?: boolean
  markUnavailablePlayers?: boolean
}) => (
  <div style={sectionStyle}>
    <h2 style={sectionTitleStyle}>{props.title}</h2>
    <Show
      when={props.entries.length > 0}
      fallback={<div style={emptyStyle}>{props.empty}</div>}
    >
      <div style={rowsStyle}>
        <For each={props.entries}>
          {(e) => (
            <div style={rowWrapperStyle}>
              <div style={rowMetaStyle}>
                <span style={eventNameStyle}>{e.eventName}</span>
                <span style={stageLabelStyle}>{e.stageLabel}</span>
              </div>
              <Show when={subMatchTitle(e)}>
                {(label) => (
                  <div style={subMatchTitleStyle}>{label()}</div>
                )}
              </Show>
              <MatchRow
                match={e.match}
                groupIndex={e.groupIndex}
                stage={e.stage}
                eventId={e.eventId}
                hideQueueBadge={props.hideQueueBadge}
                markUnavailablePlayers={props.markUnavailablePlayers}
              />
            </div>
          )}
        </For>
      </div>
    </Show>
  </div>
)

const buildScheduleData = (myMatchesOnly: boolean) => {
  const events = eventState.data || []
  const activeSeries = collectActiveSeries(events)
  const relevantEvents = events.filter((e) =>
    isEventRelevant(e, activeSeries),
  )

  const allEntries: MatchEntry[] = []
  for (const event of relevantEvents) {
    for (const entry of extractMatches(event)) {
      if (myMatchesOnly && !isUserInEntry(entry)) continue
      allEntries.push(entry)
    }
  }

  return {
    onTables: sortByTable(
      allEntries.filter((e) => liveScoreActions.getTableForMatch(e.match._id) !== undefined),
    ),
    inQueue: allEntries.filter(
      (e) =>
        liveScoreActions.getTableForMatch(e.match._id) === undefined &&
        liveScoreActions.isMatchInQueue(e.match._id),
    ),
    finished: allEntries
      .filter(
        (e) =>
          e.match.winningSide != null &&
          e.match.confirmed === true,
      )
      .sort((a, b) => {
        const ta = matchFinishedTime(a.match)
        const tb = matchFinishedTime(b.match)
        if (tb !== ta) return tb - ta
        return finishedFallbackRank(b) - finishedFallbackRank(a)
      }),
  }
}

const finishedFallbackRank = (entry: MatchEntry): number => {
  const stageRank = entry.stage === 'knockout' ? 1000 : 0
  return stageRank + entry.groupIndex
}

const matchFinishedTime = (match: Match): number => {
  const v =
    (match as unknown as { confirmedAt?: string; updatedAt?: string })
      .confirmedAt ||
    (match as unknown as { confirmedAt?: string; updatedAt?: string })
      .updatedAt
  return v ? new Date(v).getTime() : 0
}

const sortByTable = (entries: MatchEntry[]): MatchEntry[] =>
  [...entries].sort((a, b) => {
    const ta = liveScoreActions.getTableForMatch(a.match._id) ?? 0
    const tb = liveScoreActions.getTableForMatch(b.match._id) ?? 0
    return ta - tb
  })

const collectActiveSeries = (events: EventOption[]): Set<string> => {
  const activeMatchIds = new Set<string>()
  for (const t of liveScoreState.tables) {
    if (t.status === 'assigned' && t.match?.matchId) {
      activeMatchIds.add(t.match.matchId.toString())
    }
  }
  for (const item of liveScoreState.matchQueue) {
    if (item.matchId) activeMatchIds.add(item.matchId.toString())
  }
  const series = new Set<string>()
  for (const event of events) {
    if (eventHasAnyMatchId(event, activeMatchIds)) {
      if (event.eventSeries) series.add(event.eventSeries)
    }
  }
  return series
}

const eventHasAnyMatchId = (
  event: EventOption,
  matchIds: Set<string>,
): boolean => {
  for (const entry of extractMatches(event)) {
    if (matchIds.has(entry.match._id.toString())) return true
  }
  return false
}

const isEventRelevant = (event: EventOption, series: Set<string>): boolean => {
  if (event.eventSeries && series.has(event.eventSeries)) return true
  // Always include events that themselves have on-table or queued matches.
  for (const entry of extractMatches(event)) {
    if (
      liveScoreActions.getTableForMatch(entry.match._id) !== undefined ||
      liveScoreActions.isMatchInQueue(entry.match._id)
    ) {
      return true
    }
  }
  return false
}

const extractMatches = (event: EventOption): MatchEntry[] => {
  const entries: MatchEntry[] = []
  for (const stage of event.eventStages || []) {
    if (stage.type === 'group') {
      extractFromGroup(event, stage, entries)
    } else if (stage.type === 'knockout') {
      extractFromKnockout(event, stage, entries)
    }
  }
  return entries
}

const extractFromGroup = (
  event: EventOption,
  stage: Stage & GroupStage,
  entries: MatchEntry[],
) => {
  for (const group of stage.groups || []) {
    for (const match of group.matches || []) {
      pushTeamAwareEntries(entries, match, {
        groupIndex: group.index,
        stage: 'group',
        eventId: event._id,
        eventName: event.eventName,
        stageLabel: `Group ${group.index + 1}`,
      })
    }
  }
}

const extractFromKnockout = (
  event: EventOption,
  stage: Stage & KnockoutStage,
  entries: MatchEntry[],
) => {
  for (const round of stage.rounds || []) {
    for (const km of round.matches || []) {
      if (km.isBye1 || km.isBye2 || !km.match) continue
      pushTeamAwareEntries(entries, km.match, {
        groupIndex: round.index,
        stage: 'knockout',
        eventId: event._id,
        eventName: event.eventName,
        stageLabel: round.name,
      })
    }
  }
}

// For team matches: emit the parent when the team match is finalized
// (so finished views show the team-level score) and emit the live
// sub-matches otherwise (so queue/onTables views show who's actually
// playing). Plain matches pass through unchanged.
const pushTeamAwareEntries = (
  entries: MatchEntry[],
  match: Match,
  ctx: Omit<MatchEntry, 'match'>,
) => {
  const isTeam = !!match.isTeamMatch
  const hasSubs =
    Array.isArray(match.subMatches) && match.subMatches.length > 0
  const finalised = match.winningSide != null && match.confirmed === true

  if (isTeam && hasSubs && !finalised) {
    match.subMatches!.forEach((sub, idx) => {
      if (sub.cancelledAt) return
      entries.push({
        ...ctx,
        match: sub,
        parent: match,
        subMatchIndex: idx,
      })
    })
    return
  }
  entries.push({ ...ctx, match })
}

// Lineup position labels per team-match type. Kept in sync with the JS
// helper in netlify/functions/utils/eventHandlers.js (getTeamMatchLineupJS).
const TEAM_SUB_MATCH_LABELS: Record<string, { home: string; away: string }[]> = {
  type1: [
    { home: 'A', away: 'Y' },
    { home: 'B', away: 'X' },
    { home: 'AB', away: 'XY' },
  ],
  type2: [
    { home: 'A', away: 'Y' },
    { home: 'B', away: 'X' },
    { home: 'AB', away: 'XY' },
    { home: 'A', away: 'X' },
    { home: 'B', away: 'Y' },
  ],
  type3: [
    { home: 'BC', away: 'YZ' },
    { home: 'A', away: 'X' },
    { home: 'C', away: 'Z' },
    { home: 'A', away: 'Y' },
    { home: 'B', away: 'X' },
  ],
}

const subMatchTitle = (entry: MatchEntry): string | undefined => {
  const parent = entry.parent
  const idx = entry.subMatchIndex
  if (!parent || idx == null) return undefined
  const type =
    (parent.teamMatchType as keyof typeof TEAM_SUB_MATCH_LABELS | undefined) ||
    deriveTeamMatchType(parent)
  const pair = type ? TEAM_SUB_MATCH_LABELS[type]?.[idx] : undefined
  if (!pair) return `Team Match ${idx + 1}`
  return `Team Match ${idx + 1} - ${pair.home} vs ${pair.away}`
}

// Pre-existing team matches may not have teamMatchType set. Fall back
// to the closest defined type based on the roster size.
const deriveTeamMatchType = (
  parent: Match,
): keyof typeof TEAM_SUB_MATCH_LABELS | undefined => {
  const nop = (parent.side1 || []).length
  const matches = parent.numberOfMatches || 5
  if (nop === 2 && matches === 3) return 'type1'
  if (nop === 2) return 'type2'
  if (nop === 3) return 'type3'
  return undefined
}

const isUserInEntry = (entry: MatchEntry): boolean => {
  const uid = authState.user?._id?.toString()
  if (!uid) return false
  const ids = new Set<string>()
  for (const p of entry.match.side1 || []) collectIds(p, ids)
  for (const p of entry.match.side2 || []) collectIds(p, ids)
  return ids.has(uid)
}

const collectIds = (entity: unknown, ids: Set<string>) => {
  const obj = entity as { _id?: unknown; players?: unknown }
  if (obj?._id != null) ids.add(String(obj._id))
  if (Array.isArray(obj?.players)) {
    for (const p of obj.players as { _id?: unknown }[]) {
      if (p?._id != null) ids.add(String(p._id))
    }
  }
}

const containerStyle: JSX.CSSProperties = {
  'min-height': '100vh',
  'background-color': '#f5f5f5',
}

const contentStyle: JSX.CSSProperties = {
  'max-width': '1000px',
  margin: '0 auto',
  padding: '16px 20px 20px',
}

const titleRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'space-between',
  'align-items': 'center',
  'margin-bottom': '20px',
  gap: '12px',
}

const titleStyle: JSX.CSSProperties = {
  'text-align': 'left',
  'font-size': '28px',
  'font-weight': 700,
  color: '#333',
  margin: 0,
}

const listStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '24px',
}

const sectionStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '10px',
}

const sectionTitleStyle: JSX.CSSProperties = {
  'font-size': '18px',
  'font-weight': 700,
  color: '#333',
  margin: 0,
}

const emptyStyle: JSX.CSSProperties = {
  'font-size': '14px',
  color: '#888',
  padding: '8px 4px',
}

const rowsStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '10px',
}

const rowWrapperStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '4px',
}

const rowMetaStyle: JSX.CSSProperties = {
  display: 'flex',
  gap: '8px',
  'font-size': '12px',
  'align-items': 'center',
}

const eventNameStyle: JSX.CSSProperties = {
  'font-weight': 600,
  color: '#2c3e50',
}

const stageLabelStyle: JSX.CSSProperties = {
  color: '#888',
}

const subMatchTitleStyle: JSX.CSSProperties = {
  'font-size': '12px',
  'font-weight': 600,
  color: '#3498db',
  'margin-top': '-6px',
  'text-align': 'left',
}

export default Schedule
