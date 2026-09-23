import { Show, For, Index, Switch, Match as MatchCase, createSignal, createEffect, onMount, onCleanup, type JSX } from 'solid-js'
import { useNavigate, useParams } from '@solidjs/router'
import { Header } from '../components/Header'
import Button from '../components/Button'
import MatchConfirmDialog from '../components/MatchConfirmDialog'
import PostponeDialog from '../components/PostponeDialog'
import { eventDetailState, eventDetailActions } from '../stores/eventDetailStore'
import type { StageTab, BracketSlot } from '../stores/eventDetailStore'
import { eventState } from '../stores/eventStore'
import { playerState } from '../stores/playerStore'
import { customConfirm } from '../stores/confirmDialogStore'
import { authState } from '../stores/authStore'
import { liveScoreActions, liveScoreState } from '../stores/liveScoreStore'
import type { Group, GroupParticipant, Participant, KnockoutRound, KnockoutMatch as KnockoutMatchType, Stage } from '../../shared/types/Tournament'
import type { Player } from '../../shared/types/Player'
import {
  getProvisionalMatchResult,
  gamesNeededToWin,
  isValidGameScore,
  isValidMatchScore,
} from '../../shared/rules/matchRules'
import { getGroupName, getGroupLetter } from '../../shared/rules/tournamentRules'
import Select from '../components/Select'
import ToggleButton from '../components/ToggleButton'
import SingleSelectTags from '../components/SingleSelectTags'
import { leagueState, leagueActions, describeTeam, formatRoundLabel } from '../stores/leagueStore'
import type { LeagueStandingRow } from '../../shared/types/League'
import { getRoundRobinSinglesLineup } from '../../shared/rules/leagueRules'
import type { Match, Game } from '../../shared/types/Match'
import { parseLocalDate } from '../utils/date'
import clubConfig from 'club-config'

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
      <Show when={eventDetailState.showOrderDialog}>
        <SetOrderDialog />
      </Show>
      <Show when={eventDetailState.showAssignDialog}>
        <AssignTableDialog />
      </Show>
      <Show when={eventDetailState.toastMessage}>
        {(toast) => (
          <div style={toastStyle(toast().type)}>{toast().text}</div>
        )}
      </Show>
    </div>
  )
}

const dialogOverlayStyle: JSX.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  'background-color': 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'z-index': 1000,
  padding: '16px',
}

const dialogContentStyle: JSX.CSSProperties = {
  'background-color': '#fff',
  'border-radius': '12px',
  padding: '24px',
  width: '100%',
  'max-width': '480px',
  'max-height': '90vh',
  overflow: 'auto',
  display: 'flex',
  'flex-direction': 'column',
  gap: '16px',
}

const dialogTitleStyle: JSX.CSSProperties = {
  'font-size': '20px',
  'font-weight': 700,
  color: '#2c3e50',
  'text-align': 'center',
}

const enterScoreCheckboxRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
  'font-size': '14px',
  color: '#2c3e50',
  cursor: 'pointer',
}

const enterScoreGridStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '10px',
}

const enterScoreRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
  // The games belong on one line; the dialog sizes itself to fit them
  // rather than wrapping a game onto a row of its own.
  'flex-wrap': 'nowrap',
}

// Sized to its content instead of a fixed 480px, so a best-of-7 row of
// game dropdowns still fits on one line. Capped at the viewport.
const enterScoreDialogStyle: JSX.CSSProperties = {
  ...dialogContentStyle,
  width: 'max-content',
  'max-width': 'min(95vw, 900px)',
}

const enterScoreResultBlockStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '10px',
}

const enterScoreResultNamesStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
  'white-space': 'nowrap',
}

const enterScoreVsStyle: JSX.CSSProperties = {
  color: '#7f8c8d',
  'font-size': '13px',
}

const enterScoreNameStyle: JSX.CSSProperties = {
  'min-width': '140px',
  'font-weight': 600,
  color: '#2c3e50',
  'white-space': 'nowrap',
}

const enterScoreGameSelectStyle: JSX.CSSProperties = {
  padding: '4px 6px',
  'border-radius': '6px',
  border: '1px solid #d0d7de',
  'font-size': '14px',
  width: '52px',
}

const enterScoreErrorStyle: JSX.CSSProperties = {
  color: '#c0392b',
  'font-size': '13px',
}

const enterScoreButtonRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'flex-end',
  gap: '10px',
}

const orderSidePanelStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '8px',
  padding: '12px',
  border: '1px solid #eee',
  'border-radius': '8px',
}

const orderSideLabelStyle: JSX.CSSProperties = {
  'font-size': '15px',
  'font-weight': 700,
  color: '#2c3e50',
}

const orderSideDoneStyle: JSX.CSSProperties = {
  color: '#27ae60',
  'font-weight': 600,
  'font-size': '14px',
}

const orderSideWaitingStyle: JSX.CSSProperties = {
  color: '#888',
  'font-style': 'italic',
  'font-size': '13px',
}

const orderFormStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '8px',
}

const orderSlotStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '12px',
}

const orderSlotLabelStyle: JSX.CSSProperties = {
  'font-size': '15px',
  'font-weight': 700,
  color: '#3498db',
  'min-width': '24px',
}

const orderSelectStyle: JSX.CSSProperties = {
  flex: 1,
  padding: '8px 12px',
  'font-size': '14px',
  border: '1px solid #ccc',
  'border-radius': '6px',
}

const orderAutoStyle: JSX.CSSProperties = {
  flex: 1,
  'font-size': '14px',
  color: '#888',
  'font-style': 'italic',
}

const orderFormButtonRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'center',
}

const assignDialogContentStyle: JSX.CSSProperties = {
  'background-color': '#fff',
  'border-radius': '12px',
  padding: '20px',
  width: 'auto',
  'max-width': '360px',
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  gap: '14px',
}

const assignDialogTitleStyle: JSX.CSSProperties = {
  'font-size': '18px',
  'font-weight': 700,
  color: '#2c3e50',
  'text-align': 'center',
}

// One flex row per row in clubs/<slug>/config.json, so the dialog matches
// the physical hall. A fixed column count would wrap a 3-wide layout into
// 4s and put table 4 on the wrong row.
const assignDialogGridStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '8px',
}

const assignDialogRowStyle: JSX.CSSProperties = {
  display: 'flex',
  gap: '8px',
}

// Table cells match the live-score palette: green when available, red
// when assigned-but-not-started, blue when in progress. The number is
// always gold per the live-score style.
const assignTableCellStyle = (
  status: 'available' | 'not_started' | 'in_progress',
  assigning: boolean,
  // Whether this table can be picked — not the same as whether it is free.
  // Switching accepts an occupied table, and the pointer has to say so.
  selectable: boolean,
): JSX.CSSProperties => {
  const bg =
    status === 'available'
      ? '#27ae60'
      : status === 'not_started'
        ? '#c0392b'
        : '#2980b9'
  return {
    // Square, and kept square: border-box so the 3px border doesn't grow it,
    // flex: none so a flex row can't shrink it into a rectangle.
    width: '64px',
    height: '64px',
    'box-sizing': 'border-box',
    flex: 'none',
    display: 'grid',
    'place-items': 'center',
    padding: 0,
    'border-radius': '10px',
    'font-size': '24px',
    'font-weight': 900,
    color: '#f1c40f',
    'background-color': bg,
    border: assigning ? '3px solid #f1c40f' : '3px solid transparent',
    cursor: selectable ? 'pointer' : 'not-allowed',
    opacity: assigning ? 0.7 : 1,
    'text-shadow': '2px 2px 4px rgba(0,0,0,0.3)',
  }
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

// Admin-only dialog: manually assign a queued match to a chosen table.
// Layout mirrors the physical table arrangement (5/6/7/8 on top row,
// 1/2/3/4 on bottom) using the dark live-score background.
// Top row first, matching the physical hall.
const TABLE_PICKER_ROWS = clubConfig.tables.rows

export const AssignTableDialog = () => {
  const tables = () => liveScoreState.tables
  const tableState = (n: number) =>
    tables().find((t) => t.tableNumber === n)
  const isAvailable = (n: number) => tableState(n)?.status === 'available'
  const isAssigning = (n: number) =>
    eventDetailState.assigningTableNumber === n
  const isSwitching = () => eventDetailState.assignDialogMode !== 'assign'
  const currentTable = () =>
    eventDetailState.assignDialogCurrentTable ??
    tables().find(
      (t) =>
        t.status === 'assigned' &&
        t.match?.matchId === eventDetailState.assignDialogMatchId,
    )?.tableNumber

  // Assigning needs a free table. Switching takes any table but the one this
  // match is already on — the two matches trade places, in progress or not.
  const isSelectable = (n: number) => {
    if (!isSwitching()) return isAvailable(n)
    return n !== currentTable()
  }
  const tableStatus = (
    n: number,
  ): 'available' | 'not_started' | 'in_progress' => {
    const t = tableState(n)
    if (!t || t.status === 'available') return 'available'
    const status = t.match?.matchStatus
    return status === 'not_started' ? 'not_started' : 'in_progress'
  }

  const confirmText = (n: number) => {
    if (!isSwitching()) return `Assign this match to table ${n}?`
    return isAvailable(n)
      ? `Move this match to table ${n}?`
      : `Switch tables with the match on table ${n}?`
  }

  const handleClick = async (e: MouseEvent, n: number) => {
    e.stopPropagation()
    e.preventDefault()
    if (!isSelectable(n) || eventDetailState.assigningTableNumber != null) return
    if (!(await customConfirm(confirmText(n)))) return
    if (eventDetailState.assignDialogMode === 'fixture') {
      await eventDetailActions.switchFixtureTable(n)
    } else if (isSwitching()) {
      await eventDetailActions.switchMatchTables(n)
    } else {
      await eventDetailActions.assignMatchToTable(n)
    }
  }

  return (
    <div style={dialogOverlayStyle} onClick={() => eventDetailActions.closeAssignDialog()}>
      <div
        style={assignDialogContentStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={assignDialogTitleStyle}>
          {isSwitching() ? 'Switch Table' : 'Assign to Table'}
        </div>
        {/* The hall layout is per club (clubs/<slug>/config.json), top row
            first — not the 8 tables VTTC happens to have. */}
        <div style={assignDialogGridStyle}>
          <For each={TABLE_PICKER_ROWS}>
            {(row) => (
              <div style={assignDialogRowStyle}>
                <For each={row}>
                  {(n) => (
                    <button
                      style={assignTableCellStyle(
                        tableStatus(n),
                        isAssigning(n),
                        isSelectable(n),
                      )}
                      onClick={(e) => handleClick(e, n)}
                      disabled={
                        !isSelectable(n) ||
                        eventDetailState.assigningTableNumber != null
                      }
                    >
                      {n}
                    </button>
                  )}
                </For>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  )
}

// Dialog for picking the order of play on a parent team match. Mounted
// at the page level (EventDetail + Schedule) so it can be triggered
// from any MatchRow's "Set Order" button.
export const SetOrderDialog = () => {
  const match = () => eventDetailActions.getOrderDialogMatch()
  const userId = () => authState.user?._id?.toString()
  const userSide = (): 1 | 2 | undefined => {
    const m = match()
    const uid = userId()
    if (!m || !uid) return undefined
    if ((m.side1 || []).some((p) => p._id?.toString() === uid)) return 1
    if ((m.side2 || []).some((p) => p._id?.toString() === uid)) return 2
    return undefined
  }
  // Default to 1 (side1 = home) for legacy/knockout matches saved without
  // an explicit homeSide; otherwise both sides resolve to "Away" / X-Y.
  const homeSide = () => match()?.homeSide ?? 1
  const side1Done = () => !!match()?.side1Assignment
  const side2Done = () => !!match()?.side2Assignment
  // Both sides finished setting their orders — auto-dismiss the dialog
  // so nobody is left staring at it.
  createEffect(() => {
    if (side1Done() && side2Done()) {
      eventDetailActions.closeOrderDialog()
    }
  })
  const canAct = (side: 1 | 2): boolean => {
    // Players can only act for their own side. Admins can act for any side
    // whose order isn't locked in yet — including one a player started but
    // never finished (which would otherwise be stuck showing "Waiting…").
    if (authState.isAdmin) return true
    return userSide() === side
  }
  const showForm = (side: 1 | 2): boolean => {
    if (side === 1 && side1Done()) return false
    if (side === 2 && side2Done()) return false
    return canAct(side)
  }
  const sideLabel = (side: 1 | 2): string => {
    const name = formatSidePlayers(getMatchSidePlayers((side === 1 ? match()?.side1 : match()?.side2) || []))
    return `${name} (${homeSide() === side ? 'Home' : 'Away'})`
  }

  return (
    <div style={dialogOverlayStyle} onClick={() => eventDetailActions.closeOrderDialog()}>
      <div style={dialogContentStyle} onClick={(e) => e.stopPropagation()}>
        <div style={dialogTitleStyle}>Set Order of Play</div>
        <Show when={match()}>
          <div style={orderSidePanelStyle}>
            <div style={orderSideLabelStyle}>{sideLabel(1)}</div>
            <Show when={side1Done()}>
              <div style={orderSideDoneStyle}>Order locked in ✓</div>
            </Show>
            <Show when={showForm(1)}>
              <SetOrderForm
                side={1}
                players={match()?.side1 || []}
                isHome={homeSide() === 1}
              />
            </Show>
            <Show when={!side1Done() && !showForm(1)}>
              <div style={orderSideWaitingStyle}>Waiting…</div>
            </Show>
          </div>
          <div style={orderSidePanelStyle}>
            <div style={orderSideLabelStyle}>{sideLabel(2)}</div>
            <Show when={side2Done()}>
              <div style={orderSideDoneStyle}>Order locked in ✓</div>
            </Show>
            <Show when={showForm(2)}>
              <SetOrderForm
                side={2}
                players={match()?.side2 || []}
                isHome={homeSide() === 2}
              />
            </Show>
            <Show when={!side2Done() && !showForm(2)}>
              <div style={orderSideWaitingStyle}>Waiting…</div>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  )
}

const SetOrderForm = (props: {
  side: 1 | 2
  players: Player[]
  isHome: boolean
}) => {
  const slotLabels = () => (props.isHome ? ['A', 'B', 'C', 'D'] : ['X', 'Y', 'Z', 'W'])
  const picksCount = () => Math.max(0, props.players.length - 1)
  const [picks, setPicks] = createSignal<string[]>(
    Array.from({ length: picksCount() }, () => ''),
  )

  // Keep picks sized to the roster; re-init only when the set of players
  // actually changes (not on every background refresh), so a stale/empty
  // picks array can't make the auto slot fall back to the first player
  // (which showed both X and Y as the same player).
  let lastRosterKey = ''
  createEffect(() => {
    const key = props.players.map((p) => p._id).join(',')
    if (key === lastRosterKey) return
    lastRosterKey = key
    setPicks(Array.from({ length: picksCount() }, () => ''))
  })

  const optionsForSlot = (slotIndex: number) => {
    const chosen = new Set(
      picks().filter((_, i) => i !== slotIndex && picks()[i]),
    )
    return props.players
      .filter((p) => !chosen.has(p._id))
      .map((p) => ({
        value: p._id,
        label: `${p.firstName} ${p.lastName}`,
      }))
  }

  const handlePick = (slotIndex: number, playerId: string) => {
    const next = [...picks()]
    next[slotIndex] = playerId
    setPicks(next)
  }

  const remainingPlayer = (): Player | undefined => {
    const chosen = new Set(picks().filter(Boolean))
    return props.players.find((p) => !chosen.has(p._id))
  }
  const allPicked = () =>
    picks().length === picksCount() && picks().every(Boolean)
  const remainingLabel = () => {
    if (!allPicked()) return '(auto)'
    const r = remainingPlayer()
    return r ? `${r.firstName} ${r.lastName} (auto)` : '(auto)'
  }

  const isSaving = () => eventDetailState.savingOrderSide === props.side
  const handleSave = () => {
    void eventDetailActions.saveOrderForSide(props.side, picks())
  }

  return (
    <div style={orderFormStyle}>
      <For each={Array.from({ length: picksCount() }, (_, i) => i)}>
        {(slotIndex) => (
          <div style={orderSlotStyle}>
            <span style={orderSlotLabelStyle}>{slotLabels()[slotIndex]}</span>
            <select
              style={orderSelectStyle}
              value={picks()[slotIndex]}
              onChange={(e) =>
                handlePick(slotIndex, (e.target as HTMLSelectElement).value)
              }
            >
              <option value="" disabled>
                -- Select --
              </option>
              <For each={optionsForSlot(slotIndex)}>
                {(opt) => (
                  <option
                    value={opt.value}
                    selected={opt.value === picks()[slotIndex]}
                  >
                    {opt.label}
                  </option>
                )}
              </For>
            </select>
          </div>
        )}
      </For>
      <div style={orderSlotStyle}>
        <span style={orderSlotLabelStyle}>
          {slotLabels()[picksCount()]}
        </span>
        <span style={orderAutoStyle}>{remainingLabel()}</span>
      </div>
      <div style={orderFormButtonRowStyle}>
        <Button onClick={handleSave} disabled={!allPicked() || isSaving()}>
          {isSaving() ? 'Saving…' : 'Save Order'}
        </Button>
      </div>
    </div>
  )
}

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
  const eventName = () =>
    (eventDetailActions.isLeague()
      ? eventDetailState.data?.leagueName
      : eventDetailState.data?.eventName) || ''
  // A league is dated by when it starts, not by the week being viewed.
  const dateDisplay = () =>
    formatDate(
      eventDetailActions.isLeague()
        ? eventDetailState.data?.league?.startDate
        : eventDetailState.data?.date,
    )
  const timeDisplay = () => eventDetailState.data?.time || ''
  const summary = () => eventDetailActions.getEventSummary()

  const handleResetEvent = async (e?: MouseEvent) => {
    e?.stopPropagation()
    e?.preventDefault()
    if (
      await customConfirm(
        'Are you sure you want to reset this event? All schedules, matches and groups will be deleted. Participants will be kept.',
        { confirmColor: '#e74c3c' },
      )
    ) {
      eventDetailActions.resetEvent()
    }
  }

  const handleStartEvent = async (e?: MouseEvent) => {
    e?.stopPropagation()
    e?.preventDefault()
    if (
      await customConfirm(
        'Start this event now? Its matches will join the table queue ahead of the scheduled start time.',
        { confirmColor: '#27ae60' },
      )
    ) {
      eventDetailActions.startEvent()
    }
  }

  return (
    <Show when={eventDetailState.data}>
      <div style={titleRowStyle}>
        <h1 style={eventNameStyle}>{eventName()}</h1>
        <div style={titleActionsStyle}>
          <Show when={authState.isAdmin && eventDetailActions.canStartEvent()}>
            <Button
              onClick={handleStartEvent}
              color="#27ae60"
              size="small"
              disabled={eventDetailState.startingEvent}
            >
              {eventDetailState.startingEvent ? 'Starting...' : 'Start Event'}
            </Button>
          </Show>
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
      </div>
      <div style={dateStyle}>
        <Show when={eventDetailActions.isLeague()}>Start Date: </Show>
        {dateDisplay()}
      </div>
      <Show when={timeDisplay()}>
        <div style={timeStyle}>{timeDisplay()}</div>
      </Show>
      <Show when={!eventDetailActions.isLeague() && summary()}>
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
  matches: 'Matches',
  teams: 'Teams',
  standing: 'Standing',
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
    <MatchCase when={eventDetailState.activeStageTab === 'matches'}>
      <LeagueMatchesContent />
    </MatchCase>
    <MatchCase when={eventDetailState.activeStageTab === 'teams'}>
      <LeagueTeamsContent />
    </MatchCase>
    <MatchCase when={eventDetailState.activeStageTab === 'standing'}>
      <LeagueStandingContent />
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
  // Hosts are always treated as paid.
  return !participant.players.every(
    (p) => isPlayerHostObj(p) || paidIds.includes(p._id.toString()),
  )
}

// Host check that prefers the snapshot on the player object (since
// the global players list might not be loaded on EventDetail mount)
// and falls back to playerState only if the snapshot is missing.
const isPlayerHostObj = (player: { _id?: string; host?: boolean }): boolean => {
  if (player.host) return true
  return isPlayerHost(player._id?.toString())
}

const isPlayerHost = (playerId: string | undefined): boolean => {
  if (!playerId) return false
  const players = playerState.data || []
  return !!players.find(
    (p) => p._id?.toString() === playerId.toString(),
  )?.host
}

const ParticipantRow = (props: ParticipantRowProps) => {
  const rowBg = () => (props.index % 2 === 0 ? '#f8f9fa' : '#fff')
  const event = () => eventDetailState.data
  const paidIds = () => event()?.paidPlayerIds || []
  // Team/doubles (nop > 1): show each player's individual rating
  // alongside their name. Singles (nop = 1) only have one rating
  // and it's already rendered on the right.
  const showPlayerRatings = () => (event()?.nop ?? 1) > 1
  const sortedPlayers = () =>
    [...(props.participant.players || [])].sort(
      (a, b) => (b.rating || 0) - (a.rating || 0),
    )
  const isPlayerInRed = (player: { _id?: string; host?: boolean }): boolean => {
    if (!authState.isAdmin) return false
    const id = player._id?.toString()
    if (!id) return false
    if (isPlayerHostObj(player)) return false
    return !paidIds().includes(id)
  }
  // Team-name display still uses the all-or-nothing red rule, but
  // ignores hosts when deciding.
  const teamUnpaid = () =>
    authState.isAdmin && isParticipantUnpaid(props.participant)
  const teamNameStyle = (): JSX.CSSProperties =>
    teamUnpaid() ? { color: '#e74c3c' } : {}

  return (
    <div
      style={{
        ...participantRowStyle,
        'background-color': rowBg(),
      }}
    >
      <span style={participantIndexStyle}>{props.index}</span>
      <span style={participantNameStyle}>
        <Show
          when={props.participant.teamName}
          fallback={
            <For each={sortedPlayers()}>
              {(player, i) => (
                <>
                  <Show when={i() > 0}>
                    <span> / </span>
                  </Show>
                  <span
                    style={isPlayerInRed(player) ? { color: '#e74c3c' } : {}}
                  >
                    {player.firstName} {player.lastName}
                    <Show when={showPlayerRatings()}>
                      {' '}
                      ({player.rating ?? '—'})
                    </Show>
                  </span>
                </>
              )}
            </For>
          }
        >
          <span style={teamNameStyle()}>{props.participant.teamName}</span>
        </Show>
      </span>
      <span style={participantRatingStyle}>{props.participant.rating}</span>
    </div>
  )
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
      <h3 style={titleStyle()}>{getGroupName(props.group.index)}</h3>
      <GroupTable
        group={props.group}
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
  const items = () => expandMatchesForSchedule(props.matches)

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
            <For each={items()}>
              {(item) => (
                <div style={matchScheduleItemStyle}>
                  <Show when={item.parent && item.subMatchIndex != null}>
                    <div style={subMatchTitleStyle}>
                      {getTeamSubMatchTitle(item.parent!, item.subMatchIndex!)}
                    </div>
                  </Show>
                  <MatchRow
                    match={item.match}
                    groupIndex={props.groupIndex}
                    stage={props.stage}
                    parent={item.parent}
                    markUnavailablePlayers={
                      item.match.winningSide == null &&
                      liveScoreActions.getTableForMatch(item.match._id) ===
                        undefined
                    }
                    adminManage
                  />
                </div>
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
  displayStyle?: 'rows' | 'compact'
  // If true, individual player names render in red when the player is
  // currently on a table (used by the Schedule queue section).
  markUnavailablePlayers?: boolean
  // For team sub-matches: the parent team match (needed to derive each
  // player's order label A/B/C/X/Y/Z).
  parent?: Match
  // Group/Knockout tabs: let admins manage not-started/unfinished matches
  // that aren't on a table (e.g. a past event's leftover matches) — surfaces
  // Enter Score / Set Order / Reset Team without requiring a table.
  adminManage?: boolean
  // League rounds: the two teams, shown above their players.
  teamNames?: { side1?: string; side2?: string }
  // Everything in a league week is a team match, which changes how
  // sub-matches are titled ("Match 1", not "Team Match 1 - A vs Y").
  isLeague?: boolean
  // Sub-matches run on the table their parent holds, so the parent's row
  // carries the number and repeating it on every sub-match is noise.
  hideTableBadge?: boolean
}

// Lineup position labels per team-match type. Kept in sync with the JS
// helper in netlify/functions/utils/eventHandlers.js (getTeamMatchLineupJS).
export const TEAM_SUB_MATCH_LABELS: Record<
  string,
  { home: string; away: string }[]
> = {
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

export const deriveTeamMatchType = (
  parent: Match,
): keyof typeof TEAM_SUB_MATCH_LABELS | undefined => {
  const nop = (parent.side1 || []).length
  const matches = parent.numberOfMatches || 5
  if (nop === 2 && matches === 3) return 'type1'
  if (nop === 2) return 'type2'
  if (nop === 3) return 'type3'
  return undefined
}

export const getTeamSubMatchTitle = (
  parent: Match,
  subMatchIndex: number,
  // A league week is nothing but team matches, so "Team" adds nothing and
  // the lineup pair is already shown against each player's name.
  isLeague = false,
): string => {
  if (isLeague) return `Match ${subMatchIndex + 1}`
  const type =
    (parent.teamMatchType as keyof typeof TEAM_SUB_MATCH_LABELS | undefined) ||
    deriveTeamMatchType(parent)
  const pair = type ? TEAM_SUB_MATCH_LABELS[type]?.[subMatchIndex] : undefined
  if (!pair) return `Team Match ${subMatchIndex + 1}`
  return `Team Match ${subMatchIndex + 1} - ${pair.home} vs ${pair.away}`
}

const HOME_SLOT_LABELS = ['A', 'B', 'C', 'D'] as const
const AWAY_SLOT_LABELS = ['X', 'Y', 'Z', 'W'] as const

/**
 * The order of play a team-match type produces, as slot labels: "A vs X",
 * "B vs Y"…
 *
 * The tournament types are listed in TEAM_SUB_MATCH_LABELS. A league's RR
 * Singles ("rr3") is generated instead — every player meets every opponent,
 * so the list is teamSize² long and grows with the team size rather than
 * being one of a handful of fixed schedules.
 */
export const getTeamMatchLineupLabels = (
  type: string | undefined,
): { home: string; away: string }[] => {
  if (!type) return []
  if (!type.startsWith('rr')) return TEAM_SUB_MATCH_LABELS[type] || []
  const teamSize = Number(type.slice(2))
  if (!Number.isFinite(teamSize) || teamSize < 2) return []
  return getRoundRobinSinglesLineup(teamSize).map((entry) => ({
    home: entry.homeSlots.map((i) => HOME_SLOT_LABELS[i]).join(''),
    away: entry.awaySlots.map((i) => AWAY_SLOT_LABELS[i]).join(''),
  }))
}
const ASSIGNMENT_KEYS: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D']

// Look up the order label (A/B/C or X/Y/Z) for a given player in the
// parent team match's assignment. Returns undefined when the player
// isn't in either assignment or when assignments aren't set yet.
export const getTeamPlayerOrderLabel = (
  parent: Match | undefined,
  playerId: string | undefined,
): string | undefined => {
  if (!parent || !playerId) return undefined
  // Default to 1 (side1 = home) for legacy/knockout matches saved without
  // an explicit homeSide; otherwise neither side matches and every player
  // gets an away (X/Y/Z) label.
  const homeSide = parent.homeSide ?? 1
  const sides: Array<{
    assignment: Match['side1Assignment']
    isHome: boolean
  }> = [
    { assignment: parent.side1Assignment, isHome: homeSide === 1 },
    { assignment: parent.side2Assignment, isHome: homeSide === 2 },
  ]
  for (const { assignment, isHome } of sides) {
    if (!assignment) continue
    const labels = isHome ? HOME_SLOT_LABELS : AWAY_SLOT_LABELS
    const lookup = assignment as unknown as Record<
      string,
      { _id?: unknown } | undefined
    >
    for (let i = 0; i < ASSIGNMENT_KEYS.length; i++) {
      const p = lookup[ASSIGNMENT_KEYS[i]]
      if (p && p._id?.toString() === playerId.toString()) return labels[i]
    }
  }
  return undefined
}

export interface MatchScheduleItem {
  match: Match
  parent?: Match
  subMatchIndex?: number
}

// For each match: emit the sub-matches (in order) when the parent is an
// expanded but not-yet-finalised team match; otherwise emit the parent.
export const expandMatchesForSchedule = (
  matches: Match[],
): MatchScheduleItem[] => {
  const items: MatchScheduleItem[] = []
  for (const m of matches) {
    const isTeam = !!m.isTeamMatch
    const hasSubs = Array.isArray(m.subMatches) && m.subMatches.length > 0
    const finalised = m.winningSide != null && m.confirmed === true
    if (isTeam && hasSubs && !finalised) {
      m.subMatches!.forEach((sub, idx) => {
        if (sub.cancelledAt) return
        items.push({ match: sub, parent: m, subMatchIndex: idx })
      })
      continue
    }
    items.push({ match: m })
  }
  return items
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

const isUserInGroup = (groupIndex: number, eventId?: string): boolean => {
  const uid = authState.user?._id?.toString()
  if (!uid) return false
  const stages = resolveEventStages(eventId)
  const groupStage = stages?.find(
    (s): s is Extract<Stage, { type: 'group' }> => s.type === 'group',
  )
  const group = groupStage?.groups[groupIndex]
  if (!group) return false
  const ids = new Set<string>()
  for (const gp of group.participants) collectPlayerIds(gp.participant, ids)
  return ids.has(uid)
}

const resolveEventStages = (eventId?: string): Stage[] | undefined => {
  if (eventId && eventDetailState.data?._id === eventId) {
    return eventDetailState.data.eventStages
  }
  if (eventId) {
    const evt = (eventState.data || []).find((e) => e._id === eventId)
    if (evt) return evt.eventStages
  }
  return eventDetailState.data?.eventStages
}

export const MatchRow = (props: MatchRowProps) => {
  const navigate = useNavigate()
  const [postponeOpen, setPostponeOpen] = createSignal(false)
  const [enterScoreOpen, setEnterScoreOpen] = createSignal(false)
  const [helpOpen, setHelpOpen] = createSignal(false)
  const side1Players = () => getMatchSidePlayers(props.match.side1)
  const side2Players = () => getMatchSidePlayers(props.match.side2)
  const hasResult = () =>
    props.match.winningSide !== undefined && props.match.winningSide !== null
  const isConfirmed = () => props.match.confirmed === true
  const hasStarted = () =>
    hasResult() ||
    (props.match.games && props.match.games.length > 0) ||
    (props.match.initialServingSide != null && props.match.leftSide != null) ||
    // Team match parent: only the sub-match expansion counts as
    // "started". Opening the order dialog (which sets side1Started /
    // side2Started) shouldn't take the Set Order button away.
    (Array.isArray(props.match.subMatches) && props.match.subMatches.length > 0)
  const isConfirming = () =>
    eventDetailState.confirmingMatchId === props.match._id
  const isResetting = () =>
    eventDetailState.resettingMatchId === props.match._id
  const canReset = () => {
    if (!authState.isAdmin) return false
    if (phase() === 'in_progress') return true
    // A team parent never reports "in_progress", but once its order is set
    // (sub-matches exist) and it hasn't finished, it's safe to reset the
    // whole team match — no next round can exist yet.
    if (
      isTeamParent() &&
      Array.isArray(props.match.subMatches) &&
      props.match.subMatches.length > 0 &&
      !hasResult()
    ) {
      return true
    }
    return (
      isConfirmed() &&
      eventDetailActions.canResetMatch(
        props.match._id,
        props.stage,
        props.groupIndex,
        props.eventId,
      )
    )
  }
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
    // A parent team match used to be replaced by its sub-matches in the
    // schedule, so it never needed a progress state of its own. As a group
    // header it stays on screen throughout, and a tie whose order is set
    // and whose sub-matches exist is plainly under way.
    if (props.match.isTeamMatch) {
      return (props.match.subMatches?.length ?? 0) > 0
        ? 'in_progress'
        : 'not_started'
    }
    if (hasStarted()) return 'in_progress'
    return 'not_started'
  }

  // Only the next pending sub-match is ever queued, but the ones behind it
  // are waiting their turn on the same table — not unscheduled. Colour them
  // as pending rather than leaving them blank.
  const isPendingSubMatch = () =>
    !!props.parent && phase() === 'not_started'

  // RR Singles has no meaningful order — every player meets every opponent —
  // so an admin may pull any pending pairing forward. Singles and Doubles
  // follows the fixed schedule in match.md, where the order is the format.
  const isRoundRobinSubMatch = () =>
    !!props.parent && (props.parent.teamMatchType || '').startsWith('rr')

  const pendingSubMatches = () =>
    (props.parent?.subMatches || []).filter(
      (sub) =>
        !sub.cancelledAt &&
        sub.winningSide == null &&
        (sub.games?.length ?? 0) === 0,
    )

  const currentSubMatch = () => {
    const pending = pendingSubMatches()
    return pending.find((sub) => sub.playNextAt) ?? pending[0]
  }

  const isCurrentSubMatch = () => currentSubMatch()?._id === props.match._id

  // Swapping is only safe while the match holding the table hasn't begun.
  const canPlayNow = () => {
    const current = currentSubMatch()
    if (!current) return false
    return liveScoreActions.getTableForMatch(current._id) !== undefined
  }

  const showPlayNow = () =>
    isRoundRobinSubMatch() &&
    phase() === 'not_started' &&
    !isCurrentSubMatch() &&
    assignedTable() === undefined

  // The table a match holds: the one it is on, or — before the event starts —
  // the one it is pinned to by a league fixture.
  const effectiveTable = () => assignedTable() ?? props.match.lockedTableNumber

  // Any match with a table can be moved, in progress included — a game
  // sometimes has to change table part-way through. Assign is the action for
  // a match that has no table at all.
  const showSwitchTable = () =>
    authState.isAdmin && effectiveTable() !== undefined && !finishedNow()

  const handleSwitchTableClick = (e?: MouseEvent) => {
    e?.stopPropagation()
    e?.preventDefault()
    const eventId = props.eventId ?? eventDetailState.eventId ?? undefined
    eventDetailActions.openSwitchTableDialog(
      props.match._id,
      effectiveTable(),
      eventId,
    )
  }

  const handlePlayNowClick = async (e?: MouseEvent) => {
    e?.stopPropagation()
    e?.preventDefault()
    if (
      !(await customConfirm(
        'Play this match now? The match currently on the table goes back in the queue.',
        { confirmColor: '#f39c12' },
      ))
    ) {
      return
    }
    const eventId = props.eventId ?? eventDetailState.eventId ?? undefined
    void eventDetailActions.playSubMatchNow(props.match._id, eventId)
  }
  const canStartOrContinue = () =>
    authState.isAdmin ||
    isUserInMatch(props.match) ||
    (props.stage === 'group' && isUserInGroup(props.groupIndex, props.eventId))

  const handleStartClick = (e?: MouseEvent) => {
    e?.stopPropagation()
    e?.preventDefault()
    const eventId = props.eventId ?? eventDetailState.eventId
    if (!eventId) return
    // Parent team match: open the Set Order dialog right here instead of
    // navigating to game-play. The picker IS the team-match start.
    if (props.match.isTeamMatch) {
      eventDetailActions.openOrderDialog(props.match._id, eventId)
      return
    }
    navigate(
      `/game-play?eventId=${eventId}&stage=${props.stage}&groupIndex=${props.groupIndex}&matchId=${props.match._id}`,
    )
  }

  const handleConfirmClick = (e?: MouseEvent) => {
    e?.stopPropagation()
    e?.preventDefault()
    const eventId = props.eventId ?? eventDetailState.eventId ?? undefined
    eventDetailActions.showConfirmDialog(props.match._id, eventId)
  }

  const handleResetClick = async (e?: MouseEvent) => {
    e?.stopPropagation()
    e?.preventDefault()
    const message = isTeamParent()
      ? 'Reset the team match? All sub-matches and game data will be deleted.'
      : 'Are you sure you want to reset this match? All game data will be deleted.'
    if (!(await customConfirm(message, { confirmColor: '#e74c3c' }))) {
      return
    }
    const eventId = props.eventId ?? eventDetailState.eventId ?? undefined
    void eventDetailActions.resetMatch(props.match._id, eventId)
  }

  const handleResetTeamClick = async (e?: MouseEvent) => {
    e?.stopPropagation()
    e?.preventDefault()
    if (
      !(await customConfirm(
        'Reset the team match? All sub-matches will be deleted and the parent will go back on the same table for a fresh order.',
        { confirmColor: '#e74c3c' },
      ))
    ) {
      return
    }
    const eventId = props.eventId ?? eventDetailState.eventId ?? undefined
    void eventDetailActions.resetTeamMatch(props.match._id, eventId)
  }

  const handleSimulateClick = (e?: MouseEvent) => {
    e?.stopPropagation()
    e?.preventDefault()
    const eventId = props.eventId ?? eventDetailState.eventId ?? undefined
    eventDetailActions.simulateMatch(props.match._id, props.match, eventId)
  }

  const handlePostponeSelect = (minutes: number) => {
    setPostponeOpen(false)
    const eventId = props.eventId ?? eventDetailState.eventId ?? undefined
    if (!eventId) return
    void liveScoreActions.postponeMatch(eventId, props.match._id, minutes)
  }

  const handleForfeitClick = async (side: 1 | 2) => {
    const players = side === 1 ? side1Players() : side2Players()
    const names = formatSidePlayers(players)
    if (
      !(await customConfirm(
        `Forfeit for ${names}? They will lose the match without scoring a point.`,
        { confirmColor: '#e74c3c' },
      ))
    ) {
      return
    }
    const eventId = props.eventId ?? eventDetailState.eventId ?? undefined
    void eventDetailActions.forfeitMatch(props.match._id, props.match, side, eventId)
  }

  // Parent team match rows only expose the Start button — sub-match
  // rows handle Continue/Confirm/Reset/Simulate via their own MatchRow.
  const isTeamParent = () => !!props.match.isTeamMatch
  const allPlayersAvailable = () => {
    const players = [
      ...(props.match.side1 || []),
      ...(props.match.side2 || []),
    ]
    return players.every(
      (p) => !liveScoreActions.isPlayerOnTable(p._id?.toString()),
    )
  }
  const anyTableAvailable = () =>
    liveScoreActions.getAvailableTables().length > 0
  // A tie queues one sub-match at a time, so the rest are never "in the
  // queue". In RR Singles the order carries no meaning and two pairings with
  // no player in common can run at once, so an admin may still put one on a
  // free table by hand.
  const isAssignableSubMatch = () =>
    inQueue() || (isRoundRobinSubMatch() && phase() === 'not_started')

  const showAssign = () =>
    authState.isAdmin &&
    !hasStarted() &&
    assignedTable() === undefined &&
    isAssignableSubMatch() &&
    allPlayersAvailable() &&
    anyTableAvailable()
  const showStart = () => {
    if (hasStarted()) return false
    const onTable = assignedTable() !== undefined
    if (isTeamParent()) {
      // Set Order: normally on a table; also allowed off-table for admin
      // management of not-started team matches in the Group/Knockout tabs.
      if (!onTable && !(props.adminManage && authState.isAdmin)) return false
      return isUserInMatch(props.match) || authState.isAdmin
    }
    // Regular matches are started on a table only.
    return onTable && canStartOrContinue()
  }
  const showContinue = () =>
    !isTeamParent() &&
    hasStarted() &&
    !hasResult() &&
    !provisional().winningSide &&
    assignedTable() !== undefined &&
    canStartOrContinue()
  const showConfirm = () =>
    !isTeamParent() &&
    (hasResult() || !!provisional().winningSide) &&
    !isConfirmed() &&
    canStartOrContinue()
  // Reset is allowed on parent team matches too (admin-only via canReset).
  const showReset = () => canReset()
  // Reset Team: admin-only, sub-match (parentMatchId set), not
  // started, currently on a table. Queue-only sub-rows don't show
  // it — admin uses the on-table sub-row to reset the whole team.
  // Reset Team lives on the live (Schedule/LiveScore) on-table sub-row —
  // used mid-play to redo the order. In the Event Detail Group/Knockout
  // tabs (adminManage), a not-started sub-match shows only Enter Score.
  const showResetTeam = () =>
    authState.isAdmin &&
    !!props.match.parentMatchId &&
    !hasStarted() &&
    assignedTable() !== undefined &&
    !props.adminManage
  // Forfeit: admin-only, shown per side before the player names while the
  // match is on a table but not yet started (the light-red state).
  const showForfeit = () =>
    authState.isAdmin &&
    !isTeamParent() &&
    !hasStarted() &&
    assignedTable() !== undefined
  // Enter Score: admin-only, while the match is on a table but not yet
  // started — lets the admin record a final result without playing it out.
  const showEnterScore = () =>
    authState.isAdmin &&
    !isTeamParent() &&
    !hasStarted() &&
    (assignedTable() !== undefined || props.adminManage === true)
  // Postpone: admin-only, while the match is on a table but not started
  // (same behaviour as the live score page).
  const canPostpone = () =>
    authState.isAdmin && !hasStarted() && assignedTable() !== undefined
  const showSimulate = () =>
    !isTeamParent() &&
    authState.isAdmin &&
    isSimulationEnabled() &&
    !hasResult() &&
    !provisional().winningSide &&
    liveScoreActions.getAssignedMatchIds().has(props.match._id)
  const handleAssignClick = (e?: MouseEvent) => {
    e?.stopPropagation()
    e?.preventDefault()
    const eventId = props.eventId ?? eventDetailState.eventId ?? undefined
    if (!eventId) return
    eventDetailActions.openAssignDialog(props.match._id, eventId)
  }

  // Non-admins only ever see the buttons they can act on right now.
  const nonAdminHasAction = () =>
    showStart() || showContinue() || showConfirm()

  const finishedNow = () => hasResult() || !!provisional().winningSide

  const resetReason = (): string => {
    if (canReset()) return ''
    if (isTeamParent()) {
      if (!hasStarted()) return 'The team order has not been set'
      if (!isConfirmed()) return 'The team match is still in progress'
      return 'The next round has already started'
    }
    if (!hasStarted() && !finishedNow()) return "Match hasn't started"
    if (finishedNow() && !isConfirmed()) return 'Confirm the match first'
    return 'The next round has already started'
  }

  // Every applicable button for this match type. `enabled` reflects the
  // current status; the visible row renders only enabled ones, while the
  // "?" help dialog lists them all with a description and (when disabled)
  // the reason it's currently unavailable.
  const adminActionButtons = (): {
    key: string
    label: string
    description: string
    color: string
    onClick: (e?: MouseEvent) => void
    enabled: boolean
    busy: boolean
    reason: string
  }[] => {
    const started = hasStarted()
    const finished = finishedNow()
    const onTable = assignedTable() !== undefined
    const openPostpone = (e?: MouseEvent) => {
      e?.stopPropagation()
      e?.preventDefault()
      setPostponeOpen(true)
    }
    const openEnterScore = (e?: MouseEvent) => {
      e?.stopPropagation()
      e?.preventDefault()
      setEnterScoreOpen(true)
    }

    if (isTeamParent()) {
      return [
        {
          key: 'setOrder',
          label: 'Set Order',
          description: 'Set the order of play for both teams.',
          color: '#27ae60',
          onClick: handleStartClick,
          enabled: showStart(),
          busy: false,
          reason: started ? 'The order is already set' : 'Assign a table first',
        },
        {
          key: 'switchTable',
          label: 'Switch Table',
          description:
            'Move this team match to another table, swapping with the match there. Every sub match still to be played moves with it.',
          color: '#16a085',
          onClick: handleSwitchTableClick,
          enabled: showSwitchTable(),
          busy: false,
          reason: finished ? 'Match already finished' : 'Match has no table',
        },
        {
          key: 'reset',
          label: isResetting() ? 'Resetting...' : 'Reset Team',
          description: 'Delete all sub-matches and reset the team match.',
          color: '#e74c3c',
          onClick: handleResetClick,
          enabled: showReset(),
          busy: isResetting(),
          reason: resetReason(),
        },
      ]
    }

    const buttons = [
      {
        key: 'assign',
        label: 'Assign',
        description: 'Assign this match to an available table.',
        color: '#3498db',
        onClick: handleAssignClick,
        enabled: showAssign(),
        busy: false,
        reason: onTable
          ? 'Match is already on a table'
          : started || finished
            ? 'Match already started'
            : !isAssignableSubMatch()
              ? 'Match is not in the queue'
              : !allPlayersAvailable()
                ? 'A player is on another table'
                : 'No table is available',
      },
      {
        key: 'switchTable',
        label: 'Switch Table',
        description:
          'Move this match to another table, swapping with the match there. A team match takes its remaining sub-matches with it.',
        color: '#16a085',
        onClick: handleSwitchTableClick,
        enabled: showSwitchTable(),
        busy: false,
        reason: finished ? 'Match already finished' : 'Match has no table',
      },
      {
        key: 'start',
        label: isUserInMatch(props.match) ? 'Start' : 'Umpire',
        description: 'Open the match and start scoring.',
        color: '#27ae60',
        onClick: handleStartClick,
        enabled: showStart(),
        busy: false,
        reason: finished
          ? 'Match already finished'
          : started
            ? 'Match already started'
            : 'Assign a table first',
      },
      {
        key: 'continue',
        label: isUserInMatch(props.match) ? 'Continue' : 'Umpire',
        description: 'Resume scoring an in-progress match.',
        color: '#e67e22',
        onClick: handleStartClick,
        enabled: showContinue(),
        busy: false,
        reason: !started
          ? 'Match has not started'
          : finished
            ? 'Match already finished'
            : 'Match is not on a table',
      },
      {
        key: 'enterScore',
        label: 'Enter Score',
        description: 'Record a final result without playing the match out.',
        color: '#3498db',
        onClick: openEnterScore,
        enabled: showEnterScore(),
        busy: false,
        reason:
          started || finished ? 'Match already started' : 'Assign a table first',
      },
      {
        key: 'confirm',
        label: isConfirming() ? 'Confirming...' : 'Confirm',
        description: 'Confirm the finished match result.',
        color: '#e74c3c',
        onClick: handleConfirmClick,
        enabled: showConfirm(),
        busy: isConfirming(),
        reason: !finished
          ? 'Match not finished yet'
          : isConfirmed()
            ? 'Match already confirmed'
            : '',
      },
      {
        key: 'reset',
        label: isResetting() ? 'Resetting...' : 'Reset',
        description: 'Delete all game data and reset the match.',
        color: '#e74c3c',
        onClick: handleResetClick,
        enabled: showReset(),
        busy: isResetting(),
        reason: resetReason(),
      },
    ]

    // Reset Team on the live (Schedule/LiveScore) on-table sub-row. Those
    // pages never draw the parent for a tournament tie — the schedule
    // replaces it with its sub-matches — so the sub-row is the only place
    // the action can live. A league round does show the parent, as the
    // group header on the Matches tab, so it belongs there instead.
    if (props.match.parentMatchId && !props.adminManage && !props.isLeague) {
      buttons.push({
        key: 'resetTeam',
        label: isResetting() ? 'Resetting...' : 'Reset Team',
        description:
          'Delete all sub-matches and put the team match back for a fresh order.',
        color: '#c0392b',
        onClick: handleResetTeamClick,
        enabled: showResetTeam(),
        busy: isResetting(),
        reason: started ? 'Sub-match already started' : 'Sub-match is not on a table',
      })
    }

    if (showPlayNow()) {
      buttons.push({
        key: 'playNow',
        label: 'Play Now',
        description:
          'Play this match next. The one on the table goes back in the queue; the listed order does not change.',
        // Postpone's orange is free here: Play Now only appears on a league
        // sub-match, and Postpone is hidden for those.
        color: '#f39c12',
        onClick: (e) => void handlePlayNowClick(e),
        enabled: canPlayNow(),
        busy: false,
        reason: 'The match on the table has already started',
      })
    }

    // A league week is a fixed set of fixtures played on the night — there
    // is no later slot to postpone into.
    if (!props.isLeague) {
      buttons.push({
        key: 'postpone',
        label: 'Postpone',
        description: 'Postpone the match for a set time.',
        color: '#f39c12',
        onClick: openPostpone,
        enabled: canPostpone(),
        busy: false,
        reason: started ? 'Match already started' : 'Match is not on a table',
      })
    }

    // Simulate stays hidden entirely unless SIMULATION is enabled.
    if (isSimulationEnabled()) {
      buttons.push({
        key: 'simulate',
        label: 'Simulate',
        description: 'Auto-simulate the match and submit a result.',
        color: '#9b59b6',
        onClick: handleSimulateClick,
        enabled: showSimulate(),
        busy: false,
        reason: finished ? 'Match already finished' : 'Assign a table first',
      })
    }

    return buttons
  }

  const openHelp = (e?: MouseEvent) => {
    e?.stopPropagation()
    e?.preventDefault()
    setHelpOpen(true)
  }

  // Sub-matches of a team match carry a lockedTableNumber so they can
  // run on the same table sequentially. When the sub-match is waiting
  // in the queue, surface that table number as its badge.
  const lockedTable = () =>
    assignedTable() === undefined ? props.match.lockedTableNumber : undefined
  // Finished rows don't need any table/queue badge — they're history.
  const showAssignedBadge = () =>
    !props.hideTableBadge &&
    assignedTable() !== undefined &&
    phase() !== 'finished'
  const showLockedBadge = () =>
    !props.hideTableBadge &&
    lockedTable() !== undefined &&
    phase() !== 'finished'
  const showQueueBadge = () =>
    !props.hideQueueBadge &&
    !props.hideTableBadge &&
    assignedTable() === undefined &&
    lockedTable() === undefined &&
    inQueue() &&
    phase() === 'not_started'
  const hasBadge = () =>
    showAssignedBadge() || showLockedBadge() || showQueueBadge()
  return (
    <div
      style={getMatchRowStyle(
        phase(),
        assignedTable() !== undefined,
        inQueue() || isPendingSubMatch(),
      )}
    >
      {/* Who ran the match, once it has been played. Pinned to the row's
          bottom-left so it never competes with the score or the actions —
          see specs/rules/umpires.md. */}
      <Show when={props.match.umpiredBy}>
        <div style={umpiredByStyle}>Umpired by {props.match.umpiredBy}</div>
      </Show>
      {/* The row's own header — badge, players, actions. Kept in its own
          positioned box so the table number centres on this and not on the
          expanded sub-match list that follows it. */}
      <div style={matchRowHeaderStyle}>
      <Show when={showAssignedBadge()}>
        <div style={matchRowTableNumberStyle}>{assignedTable()}</div>
      </Show>
      <Show when={showLockedBadge()}>
        <div style={matchRowTableNumberStyle}>{lockedTable()}</div>
      </Show>
      <Show when={showQueueBadge()}>
        <div style={matchRowTableNumberStyle}>Q</div>
      </Show>
      <div
        style={{
          ...matchContentContainerStyle,
          ...(hasBadge() ? matchContentWithBadgeStyle : {}),
        }}
      >
        <Show
          when={props.displayStyle === 'compact'}
          fallback={
            <MatchRowsTable
              side1Players={side1Players()}
              side2Players={side2Players()}
              games={props.match.games}
              gamesWon1={provisional().gamesWon1}
              gamesWon2={provisional().gamesWon2}
              winningSide={provisional().winningSide}
              markUnavailablePlayers={props.markUnavailablePlayers}
              parent={props.parent}
              showForfeit={showForfeit()}
              onForfeit={handleForfeitClick}
              teamNames={props.teamNames}
            />
          }
        >
          <MatchResultDisplay
            side1Players={side1Players()}
            side2Players={side2Players()}
            gamesWon1={provisional().gamesWon1}
            gamesWon2={provisional().gamesWon2}
            winningSide={provisional().winningSide}
          />
          <GameScoresDisplay games={props.match.games} />
        </Show>
      </div>
      <Show
        when={authState.isAdmin}
        fallback={
          <Show when={nonAdminHasAction()}>
            <div style={matchRowActionsStyle}>
              <Show when={showStart()}>
                <Button
                  onClick={handleStartClick}
                  color="#27ae60"
                  size="small"
                  disabled={startContinueDisabled()}
                >
                  {isTeamParent()
                    ? 'Set Order'
                    : isUserInMatch(props.match)
                      ? 'Start'
                      : 'Umpire'}
                </Button>
              </Show>
              <Show when={showContinue()}>
                <Button
                  onClick={handleStartClick}
                  color="#e67e22"
                  size="small"
                  disabled={startContinueDisabled()}
                >
                  {isUserInMatch(props.match) ? 'Continue' : 'Umpire'}
                </Button>
              </Show>
              <Show when={showConfirm()}>
                <Button
                  onClick={handleConfirmClick}
                  color="#e74c3c"
                  size="small"
                  disabled={isConfirming()}
                >
                  {isConfirming() ? 'Confirming...' : 'Confirm'}
                </Button>
              </Show>
            </div>
          </Show>
        }
      >
        {/* Admin: show only the buttons available now, then a "?" that opens
            a dialog explaining every button (and why disabled ones aren't
            available). */}
        <div style={matchRowActionsStyle}>
          <For each={adminActionButtons().filter((b) => b.enabled)}>
            {(btn) => (
              <Button
                onClick={btn.onClick}
                color={btn.color}
                size="small"
                disabled={btn.busy}
              >
                {btn.label}
              </Button>
            )}
          </For>
          <button
            type="button"
            style={adminHelpIconStyle}
            aria-label="What do these buttons do?"
            onClick={openHelp}
          >
            ?
          </button>
        </div>
      </Show>
      </div>
      <Show
        when={
          isTeamParent() &&
          Array.isArray(props.match.subMatches) &&
          props.match.subMatches.length > 0
        }
      >
        <TeamSubMatches
          parent={props.match}
          stage={props.stage}
          groupIndex={props.groupIndex}
          eventId={props.eventId}
          isLeague={props.isLeague}
        />
      </Show>
      <Show when={postponeOpen()}>
        <PostponeDialog
          onSelect={handlePostponeSelect}
          onClose={() => setPostponeOpen(false)}
        />
      </Show>
      <Show when={enterScoreOpen()}>
        <EnterScoreDialog
          match={props.match}
          side1Players={side1Players()}
          side2Players={side2Players()}
          onClose={() => setEnterScoreOpen(false)}
          onSave={(games) => {
            const eventId = props.eventId ?? eventDetailState.eventId ?? undefined
            void eventDetailActions.submitMatchResult(
              props.match._id,
              games,
              eventId,
            )
            setEnterScoreOpen(false)
          }}
        />
      </Show>
      <Show when={helpOpen()}>
        <div style={dialogOverlayStyle} onClick={() => setHelpOpen(false)}>
          <div style={dialogContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={dialogTitleStyle}>Buttons</div>
            <div style={helpListStyle}>
              <For each={adminActionButtons()}>
                {(btn) => (
                  <div
                    style={{
                      ...helpItemStyle,
                      ...(btn.enabled ? {} : helpItemDisabledStyle),
                    }}
                  >
                    <div style={helpItemHeadStyle}>
                      <span
                        style={{
                          ...helpBadgeStyle,
                          'background-color': btn.enabled ? btn.color : '#95a5a6',
                        }}
                      >
                        {btn.label}
                      </span>
                    </div>
                    <div style={helpDescStyle}>{btn.description}</div>
                    <Show when={!btn.enabled && !!btn.reason}>
                      <div style={helpReasonStyle}>
                        Currently unavailable: {btn.reason}
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </div>
            <div style={helpFooterStyle}>
              <Button color="#95a5a6" onClick={() => setHelpOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  )
}

const finishedTeamSubsContainerStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '8px',
  width: '100%',
}

const finishedTeamSubsToggleStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '6px',
  background: 'transparent',
  border: 'none',
  padding: '4px 0',
  color: '#3498db',
  'font-size': '13px',
  'font-weight': 600,
  cursor: 'pointer',
  'align-self': 'flex-start',
}

const finishedTeamSubsListStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '8px',
  width: '100%',
  'padding-left': '16px',
  'border-left': '2px solid #e0e0e0',
}

const finishedSubRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '4px',
}

const finishedSubTitleStyle: JSX.CSSProperties = {
  'font-size': '12px',
  'font-weight': 600,
  color: '#3498db',
}

// Collapsible list of sub-matches shown under a finalised parent team
// match row. Cancelled sub-matches (the ones the tally skipped after
// the team match was decided) are marked but still listed.
// Admin dialog to record a final match result without playing it out.
// Auto mode: pick the match score (games won per side) and valid game
// scores are generated. Manual mode: enter each game's points.
const EnterScoreDialog = (props: {
  match: Match
  side1Players: SidePlayer[]
  side2Players: SidePlayer[]
  onClose: () => void
  onSave: (games: { score1: number; score2: number }[]) => void
}) => {
  const numberOfGames = props.match.config?.numberOfGames ?? 5
  const targetPoints = props.match.config?.gameConfig?.targetPoints ?? 11
  const needed = gamesNeededToWin(numberOfGames)

  const [autoGenerate, setAutoGenerate] = createSignal(true)
  const [matchScore, setMatchScore] = createSignal<[string, string]>(['', ''])
  const [gameScores, setGameScores] = createSignal<[string, string][]>(
    Array.from({ length: numberOfGames }, () => ['', ''] as [string, string]),
  )
  const [error, setError] = createSignal('')

  const gameScoreValues = Array.from({ length: 31 }, (_, i) => i)

  // Every result a best-of-N can end in: the winner always reaches
  // `needed`, the loser anywhere from 0 to needed-1. Listed from a side-1
  // whitewash through to a side-2 one, so the row reads as a spectrum.
  const resultOptions = (): string[] => [
    ...Array.from({ length: needed }, (_, i) => `${needed}:${i}`),
    ...Array.from({ length: needed }, (_, i) => `${needed - 1 - i}:${needed}`),
  ]
  const selectedResult = (): string | null => {
    const [a, b] = matchScore()
    return a === '' || b === '' ? null : `${a}:${b}`
  }
  const pickResult = (value: string) => {
    const [a, b] = value.split(':')
    setMatchScore([a, b])
  }

  const setGame = (gi: number, side: 0 | 1, v: string) =>
    setGameScores((gs) =>
      gs.map((g, i) => (i === gi ? (side === 0 ? [v, g[1]] : [g[0], v]) : g)),
    )

  // Winner takes targetPoints; loser gets a random valid losing score
  // (0..targetPoints-2, e.g. 0–9 for an 11-point game). The last game is
  // won by the match winner (the decider).
  const randomLoserScore = () =>
    Math.floor(Math.random() * (targetPoints - 1))
  const winGame = (winnerSide: 1 | 2) => {
    const lose = randomLoserScore()
    return winnerSide === 1
      ? { score1: targetPoints, score2: lose }
      : { score1: lose, score2: targetPoints }
  }
  const buildAutoGames = (won1: number, won2: number) => {
    const games: { score1: number; score2: number }[] = []
    if (won1 > won2) {
      for (let i = 0; i < won2; i++) games.push(winGame(2))
      for (let i = 0; i < won1; i++) games.push(winGame(1))
    } else {
      for (let i = 0; i < won1; i++) games.push(winGame(1))
      for (let i = 0; i < won2; i++) games.push(winGame(2))
    }
    return games
  }

  const handleSave = () => {
    setError('')
    if (autoGenerate()) {
      const [a, b] = matchScore()
      if (a === '' || b === '') {
        setError('Select both match scores.')
        return
      }
      const won1 = parseInt(a, 10)
      const won2 = parseInt(b, 10)
      if (!isValidMatchScore(won1, won2, numberOfGames)) {
        setError(`Invalid match score for best of ${numberOfGames}.`)
        return
      }
      props.onSave(buildAutoGames(won1, won2))
      return
    }
    // Manual: skip empty/0:0 games, validate the rest, then require the
    // played games to make a complete best-of-N result.
    const played: { score1: number; score2: number }[] = []
    for (const [as, bs] of gameScores()) {
      const s1 = as === '' ? 0 : parseInt(as, 10)
      const s2 = bs === '' ? 0 : parseInt(bs, 10)
      if (s1 === 0 && s2 === 0) continue
      if (!isValidGameScore(s1, s2, targetPoints)) {
        setError(`Invalid game score ${s1}:${s2}.`)
        return
      }
      played.push({ score1: s1, score2: s2 })
    }
    let won1 = 0
    let won2 = 0
    for (const g of played) g.score1 > g.score2 ? won1++ : won2++
    if (!isValidMatchScore(won1, won2, numberOfGames)) {
      setError(`Games entered don't make a complete best of ${numberOfGames} result.`)
      return
    }
    props.onSave(played)
  }

  const NameCell = (p: { players: SidePlayer[] }) => (
    <span style={enterScoreNameStyle}>{formatSidePlayers(p.players)}</span>
  )

  return (
    <div style={dialogOverlayStyle} onClick={props.onClose}>
      <div style={enterScoreDialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={dialogTitleStyle}>Enter Score</div>
        <label style={enterScoreCheckboxRowStyle}>
          <input
            type="checkbox"
            checked={autoGenerate()}
            onChange={(e) => setAutoGenerate(e.currentTarget.checked)}
          />
          <span>Auto Generate Game results</span>
        </label>

        <Show
          when={autoGenerate()}
          fallback={
            <div style={enterScoreGridStyle}>
              <Index each={[props.side1Players, props.side2Players]}>
                {(players, rowIndex) => (
                  <div style={enterScoreRowStyle}>
                    <NameCell players={players()} />
                    <Index each={gameScores()}>
                      {(_g, gi) => (
                        <select
                          style={enterScoreGameSelectStyle}
                          value={gameScores()[gi][rowIndex as 0 | 1]}
                          onChange={(e) =>
                            setGame(gi, rowIndex as 0 | 1, e.currentTarget.value)
                          }
                        >
                          <option value="">-</option>
                          <For each={gameScoreValues}>
                            {(v) => (
                              <option
                                value={String(v)}
                                selected={
                                  String(v) ===
                                  gameScores()[gi][rowIndex as 0 | 1]
                                }
                              >
                                {v}
                              </option>
                            )}
                          </For>
                        </select>
                      )}
                    </Index>
                  </div>
                )}
              </Index>
            </div>
          }
        >
          {/* Auto mode only needs the final result, so offer the handful
              that are possible rather than two independent dropdowns that
              can be combined into impossible scores. */}
          <div style={enterScoreResultBlockStyle}>
            <div style={enterScoreResultNamesStyle}>
              <NameCell players={props.side1Players} />
              <span style={enterScoreVsStyle}>vs</span>
              <NameCell players={props.side2Players} />
            </div>
            <SingleSelectTags
              options={resultOptions()}
              selectedValue={selectedResult()}
              onChange={pickResult}
            />
          </div>
        </Show>

        <Show when={error()}>
          <div style={enterScoreErrorStyle}>{error()}</div>
        </Show>
        <div style={enterScoreButtonRowStyle}>
          <Button color="#95a5a6" onClick={props.onClose}>
            Cancel
          </Button>
          <Button color="#27ae60" onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

const TeamSubMatches = (props: {
  parent: Match
  stage: 'group' | 'knockout'
  groupIndex: number
  eventId?: string
  isLeague?: boolean
}) => {
  // Held in the store, keyed by parent match id: entering a score refetches
  // the event, which replaces every match object and would otherwise
  // collapse the list the moment it is used.
  const expanded = () =>
    eventDetailActions.isTeamSubMatchesExpanded(props.parent._id)
  // Only drop the sub-matches' table badges when the parent's own row is
  // showing one — otherwise the number would disappear entirely.
  const parentShowsTable = () =>
    props.parent.lockedTableNumber != null ||
    liveScoreActions.getTableForMatch(props.parent._id) !== undefined
  // Show every sub-match that's still in play (played + current + pending);
  // cancelled subs (auto-dropped once the team match is decided) are hidden.
  const playedSubs = () =>
    (props.parent.subMatches || [])
      .map((sub, index) => ({ sub, index }))
      .filter(({ sub }) => !sub.cancelledAt)
  return (
    <div style={finishedTeamSubsContainerStyle}>
      <button
        style={finishedTeamSubsToggleStyle}
        onClick={() => eventDetailActions.toggleTeamSubMatches(props.parent._id)}
      >
        <span>{expanded() ? '▼' : '▶'}</span>
        <span>Matches</span>
      </button>
      <Show when={expanded()}>
        <div style={finishedTeamSubsListStyle}>
          <For each={playedSubs()}>
            {(entry) => (
              <SubMatchRow
                parent={props.parent}
                sub={entry.sub}
                index={entry.index}
                stage={props.stage}
                groupIndex={props.groupIndex}
                eventId={props.eventId}
                isLeague={props.isLeague}
                hideTableBadge={parentShowsTable()}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}

// A sub-match shown under a parent team match — rendered as a full MatchRow
// so admins get the same action buttons (Enter Score / Reset / Confirm …)
// as any other match.
const SubMatchRow = (props: {
  parent: Match
  sub: Match
  index: number
  stage: 'group' | 'knockout'
  eventId?: string
  groupIndex: number
  isLeague?: boolean
  hideTableBadge?: boolean
}) => {
  return (
    <div style={finishedSubRowStyle}>
      <div style={finishedSubTitleStyle}>
        {getTeamSubMatchTitle(props.parent, props.index, props.isLeague)}
      </div>
      <MatchRow
        match={props.sub}
        parent={props.parent}
        stage={props.stage}
        groupIndex={props.groupIndex}
        eventId={props.eventId}
        adminManage
        hideQueueBadge
        hideTableBadge={props.hideTableBadge}
        isLeague={props.isLeague}
      />
    </div>
  )
}

const isSimulationEnabled = (): boolean =>
  import.meta.env.VITE_SIMULATION === '1'

interface SidePlayer {
  _id?: string
  firstName: string
  lastName: string
}

const getMatchSidePlayers = (side: Player[]): SidePlayer[] => {
  if (!side || side.length === 0) return [{ firstName: 'Unknown', lastName: '' }]
  return side.map((p) => ({
    _id: p._id?.toString(),
    firstName: p.firstName,
    lastName: p.lastName,
  }))
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

interface MatchRowsTableProps {
  side1Players: SidePlayer[]
  side2Players: SidePlayer[]
  games?: Game[]
  gamesWon1: number
  gamesWon2: number
  winningSide?: 1 | 2
  markUnavailablePlayers?: boolean
  parent?: Match
  showForfeit?: boolean
  onForfeit?: (side: 1 | 2) => void
  teamNames?: { side1?: string; side2?: string }
}

const MatchRowsTable = (props: MatchRowsTableProps) => {
  const games = () => props.games || []
  const side1IsWinner = () => props.winningSide === 1
  const side2IsWinner = () => props.winningSide === 2
  return (
    <div style={matchRowsTableStyle}>
      <MatchScoreKeyframes />
      <MatchSideRow
        players={props.side1Players}
        games={games()}
        gamesWon={props.gamesWon1}
        side={1}
        isWinner={side1IsWinner()}
        markUnavailablePlayers={props.markUnavailablePlayers}
        parent={props.parent}
        showForfeit={props.showForfeit}
        onForfeit={props.onForfeit}
        teamName={props.teamNames?.side1}
      />
      <div style={matchSidesSeparatorStyle} />
      <MatchSideRow
        players={props.side2Players}
        games={games()}
        gamesWon={props.gamesWon2}
        side={2}
        isWinner={side2IsWinner()}
        markUnavailablePlayers={props.markUnavailablePlayers}
        parent={props.parent}
        showForfeit={props.showForfeit}
        onForfeit={props.onForfeit}
        teamName={props.teamNames?.side2}
      />
    </div>
  )
}

interface MatchSideRowProps {
  players: SidePlayer[]
  games: Game[]
  gamesWon: number
  side: 1 | 2
  isWinner: boolean
  markUnavailablePlayers?: boolean
  parent?: Match
  showForfeit?: boolean
  onForfeit?: (side: 1 | 2) => void
  // League matches: the team the players are turning out for, shown on a
  // line of its own above them.
  teamName?: string
}

const MatchSideRow = (props: MatchSideRowProps) => {
  const nameStyle = (): JSX.CSSProperties => ({
    ...matchSideNameStyle,
    'font-weight': props.isWinner ? 700 : 500,
    color: props.isWinner ? '#2c3e50' : '#555',
  })
  const matchScoreStyle = (): JSX.CSSProperties => ({
    ...matchSideTotalStyle,
    'font-weight': props.isWinner ? 900 : 800,
    color: props.isWinner ? '#e6a700' : '#f1c40f',
  })
  const scoresContainerStyle = (): JSX.CSSProperties => matchSideScoresStyle
  const teamNameStyle = (): JSX.CSSProperties => ({
    ...matchSideTeamNameStyle,
    color: props.isWinner ? '#2c3e50' : '#555',
  })
  return (
    <div style={matchSideRowStyle}>
      <div style={matchSideNameCellStyle}>
        <Show when={props.showForfeit}>
          <button
            style={forfeitButtonStyle}
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              props.onForfeit?.(props.side)
            }}
          >
            Forfeit
          </button>
        </Show>
        <div style={matchSideNameStackStyle}>
        <Show when={props.teamName}>
          <span style={teamNameStyle()}>{props.teamName}</span>
        </Show>
        <span style={nameStyle()}>
        <Show
          when={props.markUnavailablePlayers || !!props.parent}
          fallback={formatSidePlayers(props.players)}
        >
          <For each={props.players}>
            {(p, i) => {
              const label = getTeamPlayerOrderLabel(props.parent, p._id)
              return (
                <>
                  <Show when={i() > 0}>
                    <span> / </span>
                  </Show>
                  <span
                    style={
                      props.markUnavailablePlayers &&
                      liveScoreActions.isPlayerOnTable(p._id)
                        ? matchSidePlayerUnavailableStyle
                        : {}
                    }
                  >
                    {p.firstName} {p.lastName}
                    {label ? ` (${label})` : ''}
                  </span>
                </>
              )
            }}
          </For>
        </Show>
        </span>
        </div>
      </div>
      <div style={scoresContainerStyle()}>
        <For each={props.games}>
          {(game, index) => {
            const score = props.side === 1 ? game.score1 : game.score2
            const isGameWinner = game.winningSide === props.side
            const isLatest = index() === props.games.length - 1
            const isLatestScored =
              isLatest &&
              !game.winningSide &&
              game.lastScoredSide === props.side
            const base = isGameWinner
              ? matchSideGameWinnerStyle
              : isLatestScored
                ? matchSideGameLatestScoredStyle
                : matchSideGameLoserStyle
            const cellStyle: JSX.CSSProperties = {
              ...base,
              ...(isLatestScored
                ? { animation: 'scoreFlash 1s ease-in-out infinite alternate' }
                : {}),
            }
            return <span style={cellStyle}>{score}</span>
          }}
        </For>
      </div>
      <span style={matchScoreStyle()}>{props.gamesWon}</span>
    </div>
  )
}

const MatchScoreKeyframes = () => (
  <style>{`
    @keyframes scoreFlash {
      from { opacity: 0.35; }
      to { opacity: 1; }
    }
  `}</style>
)

const formatSidePlayers = (players: SidePlayer[]): string =>
  players.map((p) => `${p.firstName} ${p.lastName}`).join(' / ')

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
    // Defaulted participants always sink to the bottom of the table.
    if (!!a.defaulted !== !!b.defaulted) return a.defaulted ? 1 : -1
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
  group: Group
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
            <GroupTableRow
              group={props.group}
              participant={gp}
              // Defaulted rows carry no rank number; non-defaulted keep
              // their sequential position (they sort above defaulted ones).
              rank={gp.defaulted ? undefined : index() + 1}
            />
          )}
        </For>
      </tbody>
    </table>
  </div>
)

interface GroupTableRowProps {
  group: Group
  participant: GroupParticipant
  rank?: number
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

  const isDefaulted = () => !!props.participant.defaulted
  // Default button: admin only, before the names, while the participant
  // hasn't started any of their group matches and isn't already defaulted.
  const canDefault = () =>
    authState.isAdmin &&
    !isDefaulted() &&
    !participantHasStartedGroupMatch(props.group, props.participant)

  const handleDefaultClick = async () => {
    if (
      !(await customConfirm(
        `Default ${playerDisplay()}? They will stay in the table but be excluded from the ranking, and their matches will no longer count.`,
        { confirmColor: '#e74c3c' },
      ))
    ) {
      return
    }
    void eventDetailActions.defaultParticipant(
      props.group.index,
      (props.participant.participant as { _id?: string })._id ?? '',
    )
  }

  const rowBg = () =>
    isDefaulted() ? '#f0f0f0' : (props.rank ?? 0) % 2 === 0 ? '#f8f9fa' : '#fff'
  const cellStyle = (): JSX.CSSProperties => ({
    ...tdStyle,
    'background-color': rowBg(),
    ...(isDefaulted() ? { color: '#aaa' } : {}),
  })

  return (
    <tr>
      <td style={cellStyle()}>{props.rank ?? '-'}</td>
      <td
        style={{ ...cellStyle(), 'text-align': 'left', 'font-weight': 500 }}
      >
        <Show when={canDefault()}>
          <button style={defaultButtonStyle} onClick={handleDefaultClick}>
            Default
          </button>{' '}
        </Show>
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

const getGroupParticipantPlayerIds = (gp: GroupParticipant): string[] => {
  const p = gp.participant as { players?: Player[]; _id?: string }
  if (Array.isArray(p.players)) {
    return p.players.map((pl) => pl._id).filter((id): id is string => !!id)
  }
  return p._id ? [p._id] : []
}

const groupMatchHasStarted = (match: Match): boolean =>
  match.winningSide != null ||
  (Array.isArray(match.games) && match.games.length > 0) ||
  (match.initialServingSide != null && match.leftSide != null) ||
  (Array.isArray(match.subMatches) && match.subMatches.length > 0)

const participantHasStartedGroupMatch = (
  group: Group,
  gp: GroupParticipant,
): boolean => {
  const ids = new Set(getGroupParticipantPlayerIds(gp))
  if (ids.size === 0) return false
  const onSide = (side?: Player[]) =>
    (side || []).some((p) => p._id && ids.has(p._id))
  return (group.matches || []).some(
    (m) =>
      (onSide(m.side1) || onSide(m.side2)) && groupMatchHasStarted(m),
  )
}

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
            adminManage
          />
        )}
      </Show>
    </Show>
  )
}

const getKnockoutParticipantName = (
  participant?: {
    participant?: { players?: Player[]; firstName?: string; lastName?: string; name?: string }
    groupIndex?: number
    ranking?: number
  },
  options: { showGroupRank?: boolean } = {},
): string => {
  if (!participant) return 'TBD'
  const p = participant.participant
  if (!p) return 'TBD'

  let name: string
  if ('players' in p && Array.isArray(p.players) && p.players.length > 0) {
    name = p.players
      .map((pl: Player) => `${pl.firstName} ${pl.lastName}`)
      .join(' / ')
  } else if ('firstName' in p && p.firstName) {
    name = `${p.firstName} ${p.lastName || ''}`
  } else if ('name' in p && p.name) {
    name = p.name as string
  } else {
    return 'TBD'
  }

  if (
    options.showGroupRank &&
    typeof participant.groupIndex === 'number' &&
    typeof participant.ranking === 'number'
  ) {
    return `${getGroupLetter(participant.groupIndex)}${participant.ranking} - ${name}`
  }
  return name
}

// ==================== BRACKET TAB ====================

const BracketContent = () => {
  const rounds = () => eventDetailActions.getKnockoutRounds()
  // The "B1 Eric ..." group-rank prefix is only meaningful on the
  // round-of-N when there was a preceding group stage — knockout-only
  // events don't have meaningful group letters.
  const hasGroupStage = () =>
    !!eventDetailState.data?.eventStages?.some((s) => s.type === 'group')

  return (
    <Show
      when={rounds().length > 0}
      fallback={<div style={emptyContentStyle}>No bracket data available</div>}
    >
      <Show when={eventDetailActions.canReorderBracket()}>
        <div style={bracketReorderHintStyle}>
          Drag a name onto another to swap their places in the draw. The top
          two seeds stay where they are, and the draw locks once a match has
          started.
        </div>
      </Show>
      <div style={bracketContainerStyle}>
        <For each={rounds()}>
          {(round, roundIndex) => (
            <>
              <div style={bracketRoundColumnStyle}>
                <div style={bracketRoundHeaderStyle}>{round.name}</div>
                <div style={bracketRoundMatchesStyle}>
                  <For each={round.matches}>
                    {(km, matchIndex) => (
                      <div style={bracketMatchSlotStyle}>
                        <BracketMatchCard
                          knockoutMatch={km}
                          showGroupRank={roundIndex() === 0 && hasGroupStage()}
                          matchIndex={roundIndex() === 0 ? matchIndex() : undefined}
                        />
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
  showGroupRank?: boolean
  /** Set on the first round only — the one round that can be reordered. */
  matchIndex?: number
}

const BracketMatchCard = (props: BracketMatchCardProps) => {
  const isBye = () => props.knockoutMatch.isBye2 || props.knockoutMatch.isBye1
  const p1Name = () =>
    getKnockoutParticipantName(props.knockoutMatch.participant1, {
      showGroupRank: props.showGroupRank,
    })
  const p2Name = () =>
    isBye()
      ? 'BYE'
      : getKnockoutParticipantName(props.knockoutMatch.participant2, {
          showGroupRank: props.showGroupRank,
        })
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

  // Only the first round carries a slot, and only then can it be dragged.
  const slotFor = (slot: 1 | 2): BracketSlot | undefined =>
    props.matchIndex === undefined
      ? undefined
      : { matchIndex: props.matchIndex, slot }

  return (
    <div style={bracketMatchCardStyle}>
      <BracketPlayerLine
        name={p1Name()}
        emphasise={p1IsWinner() || p1IsLeading()}
        background={p1BgColor()}
        score={match() ? match()!.gamesWon1 : undefined}
        slot={slotFor(1)}
      />
      <BracketPlayerLine
        name={p2Name()}
        emphasise={p2IsWinner() || p2IsLeading()}
        background={p2BgColor()}
        isBye={isBye()}
        score={match() && !isBye() ? match()!.gamesWon2 : undefined}
        divider
        slot={slotFor(2)}
      />
    </div>
  )
}

interface BracketPlayerLineProps {
  name: string
  background: string
  emphasise: boolean
  isBye?: boolean
  score?: number
  divider?: boolean
  /** Only set on first-round lines; absent elsewhere, so they never drag. */
  slot?: BracketSlot
}

// One name on the bracket. On the first round, before anything is played,
// it is also a drag handle and a drop target — dropping one name on
// another trades their places in the draw.
const BracketPlayerLine = (props: BracketPlayerLineProps) => {
  const movable = () =>
    !!props.slot && eventDetailActions.isBracketSlotMovable(props.slot)
  const dragging = () =>
    !!props.slot && eventDetailActions.isBracketSlotDragging(props.slot)
  const isDropTarget = () =>
    !!props.slot && eventDetailActions.isBracketSlotDropTarget(props.slot)

  const handleDragStart = (e: DragEvent) => {
    if (!props.slot || !movable()) return
    // Firefox starts no drag at all unless the payload is set.
    e.dataTransfer?.setData('text/plain', `${props.slot.matchIndex}`)
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
    eventDetailActions.startBracketDrag(props.slot)
  }

  const handleDragOver = (e: DragEvent) => {
    if (!props.slot || !movable()) return
    if (!eventDetailState.bracketDragFrom) return
    // A drop is refused unless the dragover default is prevented.
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
    eventDetailActions.setBracketDragOver(props.slot)
  }

  const handleDrop = (e: DragEvent) => {
    if (!props.slot) return
    e.preventDefault()
    void eventDetailActions.dropOnBracketSlot(props.slot)
  }

  return (
    <div
      draggable={movable()}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={() => eventDetailActions.setBracketDragOver(null)}
      onDrop={handleDrop}
      onDragEnd={() => eventDetailActions.endBracketDrag()}
      style={{
        ...bracketMatchPlayerStyle,
        'font-weight': props.emphasise ? 700 : 400,
        'background-color': props.background,
        ...(props.divider ? { 'border-top': '1px solid #e0e0e0' } : {}),
        // Every cue below is conditional on the line actually being
        // movable, so a bracket that cannot be reordered — not an admin,
        // a match already started, a fixed seed, a BYE — looks exactly as
        // it did before any of this existed.
        ...(movable()
          ? {
              cursor: 'grab',
              'user-select': 'none' as const,
              'background-color': DRAGGABLE_BG,
            }
          : {}),
        ...(dragging() ? { opacity: 0.4 } : {}),
        ...(isDropTarget()
          ? {
              outline: '2px dashed #2185d0',
              'outline-offset': '-2px',
              'background-color': DROP_TARGET_BG,
            }
          : {}),
      }}
    >
      <Show when={movable()}>
        <GripIcon />
      </Show>
      <span
        style={{
          ...bracketPlayerNameStyle,
          color: props.isBye ? '#999' : '#333',
          'font-style': props.isBye ? 'italic' : 'normal',
        }}
      >
        {props.name}
      </span>
      <Show when={props.score !== undefined}>
        <span style={bracketScoreStyle}>{props.score}</span>
      </Show>
    </div>
  )
}

// The usual two-column grip. Sized explicitly and never allowed to shrink,
// so the flex row can't squash it out of square.
const GripIcon = () => (
  <span style={gripIconStyle} aria-hidden="true">
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
      <circle cx="2.5" cy="2" r="1.4" />
      <circle cx="7.5" cy="2" r="1.4" />
      <circle cx="2.5" cy="7" r="1.4" />
      <circle cx="7.5" cy="7" r="1.4" />
      <circle cx="2.5" cy="12" r="1.4" />
      <circle cx="7.5" cy="12" r="1.4" />
    </svg>
  </span>
)

// ==================== STYLES ====================

// ==================== League tabs ====================

// A league round shows the whole league: every week's fixtures, the teams,
// and the season standings (specs/pages/Event Detail.md).

const LeagueMatchesContent = () => (
  <Show when={!leagueState.loading} fallback={<div>Loading...</div>}>
    <Show when={leagueState.error}>
      <div style={leagueErrorStyle}>{leagueState.error}</div>
    </Show>
    <Show
      when={leagueActions.isScheduleGenerated()}
      fallback={<GenerateLeagueScheduleSection />}
    >
      <RoundPicker />
      <Show
        when={leagueActions.hasRoundMatches()}
        fallback={<RoundPlayerSelection />}
      >
        <RoundMatches />
      </Show>
    </Show>
  </Show>
)

const GenerateLeagueScheduleSection = () => (
  <div>
    <Show when={authState.isAdmin}>
      <div style={generateGroupsStyle}>
        <Button
          onClick={() => void leagueActions.generateSchedule()}
          disabled={leagueState.generatingSchedule}
        >
          {leagueState.generatingSchedule
            ? 'Generating...'
            : 'Generate League Schedule'}
        </Button>
      </div>
    </Show>
    <div style={leagueNoteStyle}>
      {leagueActions.getParticipants().length} team(s) registered. The schedule
      covers every round of every phase.
    </div>
  </div>
)

const RoundPicker = () => {
  const handleReset = async (e?: MouseEvent) => {
    e?.stopPropagation()
    e?.preventDefault()
    // Resetting a week that has been played destroys those results, so say
    // so plainly rather than asking the same mild question either way.
    const hasResults = leagueActions.selectedRoundHasResults()
    const confirmed = await customConfirm(
      hasResults
        ? 'This week has results. Resetting deletes every score already recorded for it, along with the player selections. Continue?'
        : "Clear this week's matches and player selections so it can be built again?",
      { confirmColor: '#e74c3c' },
    )
    if (confirmed) void leagueActions.resetRound()
  }

  return (
    <div style={roundPickerRowStyle}>
      <div style={roundPickerStyle}>
        <Select
          label="Round/Week"
          name="leagueRound"
          value={String(leagueState.selectedRoundIndex)}
          onChange={(value) => leagueActions.setSelectedRound(Number(value))}
          options={leagueActions.getRounds().map((round) => ({
            value: String(round.roundIndex),
            label: formatRoundLabel(round),
          }))}
          noMargin
        />
      </div>
      <Show when={authState.isAdmin && leagueActions.hasRoundMatches()}>
        <Button
          color="#e74c3c"
          size="small"
          onClick={handleReset}
          disabled={leagueState.resettingRound}
        >
          {leagueState.resettingRound ? 'Resetting...' : 'Reset Week'}
        </Button>
      </Show>
    </div>
  )
}

// Before a week is generated, each team picks the players it fields.
// Who plays whom is already fixed by the schedule, so the week reads as its
// fixtures: each side with its line-up, the table between them.
const RoundPlayerSelection = () => {
  const byeTeam = () => leagueActions.getSelectedRound()?.byeParticipantId
  const pairings = () => leagueActions.getSelectedRound()?.pairings || []

  return (
    <div>
      <div style={tableWrapperStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Team 1</th>
              <th style={{ ...thStyle, 'text-align': 'center' }}>Table</th>
              <th style={thStyle}>Team 2</th>
            </tr>
          </thead>
          <tbody>
            <For each={pairings()}>
              {(pairing, index) => (
                <tr style={{ 'background-color': getRowBackground(index()) }}>
                  <td style={fixtureCellStyle}>
                    <FixtureTeam participantId={pairing.homeParticipantId} />
                  </td>
                  <td style={fixtureTableCellStyle}>
                    <div style={fixtureTableNumberStyle}>
                      {leagueActions.getFixtureTable(pairing.homeParticipantId) ??
                        '-'}
                    </div>
                    <Show when={authState.isAdmin}>
                      <Button
                        color="#f39c12"
                        size="small"
                        onClick={() =>
                          eventDetailActions.openFixtureTableDialog(
                            pairing.homeParticipantId,
                            leagueActions.getFixtureTable(
                              pairing.homeParticipantId,
                            ),
                          )
                        }
                      >
                        Switch Table
                      </Button>
                    </Show>
                  </td>
                  <td style={fixtureCellStyle}>
                    <FixtureTeam participantId={pairing.awayParticipantId} />
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
      <Show when={byeTeam()}>
        <div style={leagueNoteStyle}>
          {leagueActions.getTeamName(byeTeam()!)} has a bye this week.
        </div>
      </Show>
      <Show when={authState.isAdmin}>
        <div style={leagueActionsRowStyle}>
          <Show when={leagueActions.isSimulated()}>
            <Button
              color="#8e44ad"
              onClick={() => void leagueActions.autoSelectPlayers()}
              disabled={leagueState.savingSelection}
            >
              {leagueState.savingSelection ? 'Selecting...' : 'Auto Select'}
            </Button>
          </Show>
          <Button
            onClick={() => void leagueActions.generateRoundMatches()}
            disabled={
              !leagueActions.canGenerateRoundMatches() ||
              leagueState.generatingMatches
            }
          >
            {leagueState.generatingMatches
              ? 'Generating...'
              : 'Generate Match Schedule'}
          </Button>
        </div>
      </Show>
      <Show when={leagueState.selectDialogParticipantId}>
        {(participantId) => (
          <SelectPlayersDialog participantId={participantId()} />
        )}
      </Show>
    </div>
  )
}

// One side of a fixture: the team, its line-up once picked, and the button
// to pick it.
const FixtureTeam = (props: { participantId: string }) => {
  const selected = () => leagueActions.getSelectedPlayers(props.participantId)

  return (
    <div style={fixtureTeamStyle}>
      <div style={fixtureTeamNameStyle}>
        {leagueActions.getTeamName(props.participantId)}
        <Show when={selected().length > 0}>
          {' '}
          ({leagueActions.getSelectedCombinedRating(props.participantId)})
        </Show>
      </div>
      <Show
        when={selected().length > 0}
        fallback={<div style={leagueMutedStyle}>None selected</div>}
      >
        <For each={selected()}>
          {(player) => (
            <div style={fixturePlayerStyle}>
              {player.firstName} {player.lastName} (
              {leagueActions.getLeagueRating(player)})
            </div>
          )}
        </For>
      </Show>
      <Show when={authState.isAdmin}>
        <div style={fixtureButtonRowStyle}>
          <Button
            size="small"
            onClick={() =>
              leagueActions.openSelectDialog(props.participantId)
            }
          >
            Select Players
          </Button>
        </div>
      </Show>
    </div>
  )
}

/**
 * Pick this week's players from the team's roster. A team fields exactly
 * `teamSize` of them, and for a rated league the combined rating of the
 * picked line-up has to stay within the limits.
 */
const SelectPlayersDialog = (props: { participantId: string }) => {
  const [picked, setPicked] = createSignal<string[]>(
    leagueActions.getSelectedPlayers(props.participantId).map((p) => p._id),
  )

  const roster = () =>
    [
      ...(leagueActions.getParticipant(props.participantId)?.players || []),
    ].sort((a, b) => (b.rating || 0) - (a.rating || 0))

  const teamSize = () => leagueActions.getTeamSize()
  const isPicked = (playerId: string) => picked().includes(playerId)

  const toggle = (playerId: string) => {
    if (isPicked(playerId)) {
      setPicked(picked().filter((id) => id !== playerId))
      return
    }
    if (picked().length >= teamSize()) return
    setPicked([...picked(), playerId])
  }

  const ratingError = () =>
    describeLineupRatingError(
      picked()
        .map((id) => roster().find((p) => p._id === id))
        .filter((p): p is Player => !!p),
    )

  return (
    <div style={dialogOverlayStyle}>
      <div style={dialogContentStyle}>
        <h2 style={dialogTitleStyle}>
          {leagueActions.getTeamName(props.participantId)} — pick {teamSize()}
        </h2>
        <div style={pickerListStyle}>
          <For each={roster()}>
            {(player) => (
              <ToggleButton
                label={`${player.firstName} ${player.lastName} - ${leagueActions.getLeagueRating(player)}`}
                value={isPicked(player._id)}
                onChange={() => toggle(player._id)}
              />
            )}
          </For>
        </div>
        <Show when={ratingError() || leagueState.selectionError}>
          <div style={leagueErrorStyle}>
            {ratingError() || leagueState.selectionError}
          </div>
        </Show>
        <div style={enterScoreButtonRowStyle}>
          <Button color="#e74c3c" onClick={leagueActions.closeSelectDialog}>
            Cancel
          </Button>
          <Button
            color="#27ae60"
            disabled={!!ratingError() || leagueState.savingSelection}
            onClick={() =>
              void leagueActions.saveSelection(props.participantId, picked())
            }
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

// Only a full line-up can break a rating rule; a partial pick may still
// come good once the rest are chosen.
const describeLineupRatingError = (players: Player[]): string | null => {
  const league = leagueState.data
  if (!league || league.restriction !== 'Rated' || !league.ratingLimit)
    return null
  if (players.length < leagueActions.getTeamSize()) return null

  // Judged on the ratings at the season's start, matching the server.
  const rated = (p: Player) => leagueActions.getLeagueRating(p)
  const combined = players.reduce((sum, p) => sum + rated(p), 0)
  if (combined > league.ratingLimit) {
    return `Combined rating (${combined}) exceeds the limit (${league.ratingLimit})`
  }
  if (
    league.topPlayersRatingEnabled &&
    league.topPlayersCount &&
    league.topPlayersRatingLimit
  ) {
    const top = [...players]
      .sort((a, b) => rated(b) - rated(a))
      .slice(0, league.topPlayersCount)
      .reduce((sum, p) => sum + rated(p), 0)
    if (top > league.topPlayersRatingLimit) {
      return `Top ${league.topPlayersCount} combined rating (${top}) exceeds the limit (${league.topPlayersRatingLimit})`
    }
  }
  return null
}

const RoundMatches = () => {
  const round = () => leagueActions.getSelectedRound()

  return (
    <div style={groupsListStyle}>
      <Show when={round()?.byeParticipantId}>
        <div style={leagueNoteStyle}>
          {leagueActions.getTeamName(round()!.byeParticipantId!)} has a bye this
          week.
        </div>
      </Show>
      {/* One row per fixture. The parent is the group header — it carries
          the teams and the table — and its own "Matches" toggle opens the
          sub-matches beneath it. */}
      <For each={round()?.matches || []}>
        {(match) => (
          <div style={matchScheduleItemStyle}>
            <MatchRow
              match={match}
              groupIndex={0}
              stage="group"
              eventId={round()?._id}
              teamNames={roundTeamNames(match)}
              isLeague
              adminManage
            />
          </div>
        )}
      </For>
    </div>
  )
}

const roundTeamNames = (match: Match) => {
  const ids = match.participantIds
  if (!ids) return undefined
  return {
    side1: leagueActions.getTeamName(ids.side1),
    side2: leagueActions.getTeamName(ids.side2),
  }
}

const LeagueTeamsContent = () => (
  <div style={tableWrapperStyle}>
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>Team</th>
          <th style={thStyle}>Players</th>
        </tr>
      </thead>
      <tbody>
        <For each={leagueActions.getParticipants()}>
          {(participant, index) => (
            <tr style={{ 'background-color': getRowBackground(index()) }}>
              <td style={tdStyle}>
                {participant.teamName || `Team ${index() + 1}`}
              </td>
              <td style={tdStyle}>
                {[...participant.players]
                  .sort((a, b) => (b.rating || 0) - (a.rating || 0))
                  .map((p) => `${p.firstName} ${p.lastName} (${p.rating || 0})`)
                  .join(', ')}
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  </div>
)

type StandingStat = Extract<
  keyof LeagueStandingRow,
  'roundsWon' | 'matchesWon' | 'matchesLost' | 'gamesWon' | 'gamesLost'
>

const STANDING_COLUMNS: { key: StandingStat; label: string }[] = [
  { key: 'roundsWon', label: 'RW' },
  { key: 'matchesWon', label: 'MW' },
  { key: 'matchesLost', label: 'ML' },
  { key: 'gamesWon', label: 'GW' },
  { key: 'gamesLost', label: 'GL' },
]

const LeagueStandingContent = () => (
  <div style={tableWrapperStyle}>
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>#</th>
          <th style={thStyle}>Team</th>
          <For each={STANDING_COLUMNS}>
            {(column) => <th style={thStyle}>{column.label}</th>}
          </For>
        </tr>
      </thead>
      <tbody>
        <For each={leagueActions.getStandings()}>
          {(row, index) => (
            <tr style={{ 'background-color': getRowBackground(index()) }}>
              <td style={tdStyle}>{index() + 1}</td>
              <td style={tdStyle}>
                {row.teamName || describeTeam(row.players)}
              </td>
              <For each={STANDING_COLUMNS}>
                {(column) => <td style={tdStyle}>{row[column.key]}</td>}
              </For>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  </div>
)

// Alternating white / lavender, matching the participants tables.
const getRowBackground = (index: number): string =>
  index % 2 === 0 ? '#ffffff' : '#f3f0ff'

const leagueErrorStyle: JSX.CSSProperties = {
  color: '#e74c3c',
  'font-size': '14px',
  'font-weight': 500,
  margin: '12px 0',
  'text-align': 'left',
}

const leagueNoteStyle: JSX.CSSProperties = {
  'font-size': '13px',
  color: '#666',
  margin: '12px 0',
  'text-align': 'left',
}

const leagueMutedStyle: JSX.CSSProperties = {
  color: '#999',
}

const leagueActionsRowStyle: JSX.CSSProperties = {
  display: 'flex',
  gap: '12px',
  margin: '16px 0',
}

const roundPickerRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'flex-end',
  'justify-content': 'space-between',
  gap: '12px',
  margin: '16px 0',
}

const roundPickerStyle: JSX.CSSProperties = {
  flex: '1 1 auto',
  'max-width': '320px',
}

const pickerListStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-wrap': 'wrap',
  gap: '8px',
  margin: '8px 0 16px',
}

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

// Keeps Start and Reset together on the right of the title row.
const titleActionsStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
  flex: 'none',
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

const fixtureCellStyle: JSX.CSSProperties = {
  ...tdStyle,
  'vertical-align': 'top',
  width: '40%',
}

const fixtureTableCellStyle: JSX.CSSProperties = {
  ...tdStyle,
  'text-align': 'center',
  'vertical-align': 'middle',
  'white-space': 'nowrap',
}

const fixtureTableNumberStyle: JSX.CSSProperties = {
  'font-size': '28px',
  'font-weight': 900,
  color: '#f1c40f',
  'line-height': 1.1,
  'margin-bottom': '6px',
}

// Centred to match the cell's text-align, so the button sits under the team
// name rather than at the edge of a full-width flex row.
const fixtureTeamStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  gap: '2px',
}

const fixtureTeamNameStyle: JSX.CSSProperties = {
  'font-weight': 700,
  color: '#2c3e50',
}

const fixturePlayerStyle: JSX.CSSProperties = {
  'font-size': '13px',
  color: '#555',
}

const fixtureButtonRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'center',
  'margin-top': '6px',
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
}

const matchScheduleItemStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '2px',
}

const subMatchTitleStyle: JSX.CSSProperties = {
  'font-size': '12px',
  'font-weight': 600,
  color: '#3498db',
  'text-align': 'left',
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

// The header box starts at the row's content edge, so the badge sits flush
// against it at left: 0 (it was 16px when positioned against the row itself,
// whose padding box starts one border-width earlier).
const umpiredByStyle: JSX.CSSProperties = {
  position: 'absolute',
  left: '10px',
  bottom: '4px',
  'font-size': '10px',
  color: '#95a5a6',
  'pointer-events': 'none',
  'white-space': 'nowrap',
  'max-width': 'calc(100% - 20px)',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
}

const matchRowHeaderStyle: JSX.CSSProperties = {
  position: 'relative',
  width: '100%',
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  gap: '10px',
}

const matchRowTableNumberStyle: JSX.CSSProperties = {
  position: 'absolute',
  left: '0',
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
  'min-width': 0,
  'box-sizing': 'border-box',
}

// Push the score/buttons content right when a Q or table-number badge
// is rendered on the left so long team rosters don't slide under it.
const matchContentWithBadgeStyle: JSX.CSSProperties = {
  'padding-left': '64px',
}

const matchRowActionsStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'row',
  'flex-wrap': 'wrap',
  'align-items': 'center',
  'justify-content': 'flex-end',
  'align-self': 'stretch',
  gap: '8px',
}

// "?" icon after the visible buttons; opens the help dialog.
const adminHelpIconStyle: JSX.CSSProperties = {
  width: '22px',
  height: '22px',
  'border-radius': '50%',
  border: '1px solid #bdc3c7',
  background: '#fff',
  color: '#7f8c8d',
  'font-size': '13px',
  'font-weight': 700,
  'line-height': '20px',
  'text-align': 'center',
  padding: '0',
  cursor: 'pointer',
  'flex-shrink': 0,
}

const helpListStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '12px',
  'max-height': '60vh',
  overflow: 'auto',
}

const helpItemStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '4px',
  padding: '10px 12px',
  border: '1px solid #eef1f4',
  'border-radius': '8px',
}

const helpItemDisabledStyle: JSX.CSSProperties = {
  opacity: 0.6,
  background: '#f7f9fb',
}

const helpItemHeadStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
}

const helpBadgeStyle: JSX.CSSProperties = {
  display: 'inline-block',
  padding: '3px 10px',
  'border-radius': '6px',
  color: '#fff',
  'font-size': '13px',
  'font-weight': 700,
}

const helpDescStyle: JSX.CSSProperties = {
  'font-size': '14px',
  color: '#2c3e50',
}

const helpReasonStyle: JSX.CSSProperties = {
  'font-size': '13px',
  color: '#c0392b',
}

const helpFooterStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'flex-end',
}

const matchRowsTableStyle: JSX.CSSProperties = {
  display: 'grid',
  'grid-template-columns': 'minmax(0, 1fr) auto auto',
  'column-gap': '12px',
  'row-gap': '4px',
  'align-items': 'center',
  width: '100%',
  'min-width': 0,
}

const matchSideRowStyle: JSX.CSSProperties = {
  display: 'contents',
}

const matchSidesSeparatorStyle: JSX.CSSProperties = {
  'grid-column': '1 / -1',
  height: '1px',
  'background-color': '#e0e0e0',
}

const matchSideNameStyle: JSX.CSSProperties = {
  'font-size': '14px',
  'text-align': 'right',
  'justify-self': 'stretch',
  'word-break': 'break-word',
  'min-width': 0,
}

// Team name over player names, both hard right against the score.
const matchSideNameStackStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'flex-end',
  gap: '2px',
  'min-width': 0,
}

const matchSideTeamNameStyle: JSX.CSSProperties = {
  'font-size': '14px',
  'font-weight': 700,
  'text-align': 'right',
  'word-break': 'break-word',
  'min-width': 0,
}

// Column-1 cell wrapping the optional Forfeit button (left) and the
// right-aligned player name(s).
const matchSideNameCellStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'flex-end',
  gap: '8px',
  'min-width': 0,
}

const forfeitButtonStyle: JSX.CSSProperties = {
  flex: 'none',
  padding: '2px 8px',
  'font-size': '12px',
  'font-weight': 600,
  color: '#fff',
  'background-color': '#e74c3c',
  border: 'none',
  'border-radius': '4px',
  cursor: 'pointer',
  'white-space': 'nowrap',
}

const defaultButtonStyle: JSX.CSSProperties = {
  padding: '1px 6px',
  'font-size': '11px',
  'font-weight': 600,
  color: '#fff',
  'background-color': '#e67e22',
  border: 'none',
  'border-radius': '4px',
  cursor: 'pointer',
  'white-space': 'nowrap',
}

const matchSidePlayerUnavailableStyle: JSX.CSSProperties = {
  color: '#e74c3c',
  'font-weight': 600,
}

const matchSideScoresStyle: JSX.CSSProperties = {
  display: 'flex',
  gap: '6px',
  'align-items': 'center',
}

const matchSideGameWinnerStyle: JSX.CSSProperties = {
  'font-size': '14px',
  'font-weight': 800,
  color: '#f1c40f',
  'min-width': '20px',
  'text-align': 'center',
}

const matchSideGameLoserStyle: JSX.CSSProperties = {
  'font-size': '14px',
  'font-weight': 400,
  color: '#888',
  'min-width': '20px',
  'text-align': 'center',
}

const matchSideGameLatestScoredStyle: JSX.CSSProperties = {
  'font-size': '14px',
  'font-weight': 800,
  color: '#00b8d4',
  'min-width': '20px',
  'text-align': 'center',
}

const matchSideTotalStyle: JSX.CSSProperties = {
  'font-size': '22px',
  'font-weight': 800,
  color: '#f1c40f',
  'min-width': '28px',
  'text-align': 'center',
  'justify-self': 'start',
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
const bracketReorderHintStyle: JSX.CSSProperties = {
  padding: '8px 12px',
  margin: '0 0 12px',
  'background-color': '#f0f6fc',
  border: '1px solid #d6e4f0',
  'border-radius': '4px',
  'font-size': '13px',
  color: '#4a6b8a',
}

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
  'margin-right': 'auto',
}

// A line that can be picked up: tinted, and carrying a grip. Only ever
// applied while the draw is still open to reordering, so it never competes
// with the winner / leading / bye colours, which cannot exist yet.
const DRAGGABLE_BG = '#f2f7fc'
const DROP_TARGET_BG = '#e3f0fb'

const gripIconStyle: JSX.CSSProperties = {
  width: '14px',
  height: '14px',
  'box-sizing': 'border-box',
  padding: 0,
  flex: 'none',
  display: 'grid',
  'place-items': 'center',
  'margin-right': '8px',
  color: '#9bb3c9',
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
