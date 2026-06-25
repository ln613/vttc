import { createStore } from 'solid-js/store'
import { apiGet } from '../utils/api'

// Per-event revenue figures (computed server-side). One row per past event.
export interface EventRevenue {
  _id: string
  eventName: string
  date: string
  eventSeries: string | null
  participantCount: number
  registrationFee: number
  prize: number
  revenue: number
}

// A series group (collapsible) or a standalone event (series === null).
export interface RevenueGroup {
  key: string
  series: string | null
  date: string // series → earliest event date; standalone → the event date
  totalRevenue: number
  events: EventRevenue[]
}

interface RevenueState {
  events: EventRevenue[]
  loading: boolean
  error: string | null
  collapsed: Record<string, boolean>
}

const getInitialState = (): RevenueState => ({
  events: [],
  loading: false,
  error: null,
  collapsed: {},
})

const [revenueState, setRevenueState] = createStore<RevenueState>(
  getInitialState(),
)

export { revenueState }

const round2 = (n: number): number => Math.round(n * 100) / 100

// Newest first. Event dates are ISO (YYYY-MM-DD), so string compare orders
// them chronologically.
const byDateDesc = <T extends { date: string }>(a: T, b: T): number =>
  a.date < b.date ? 1 : a.date > b.date ? -1 : 0

const buildSeriesGroup = (
  seriesName: string,
  events: EventRevenue[],
): RevenueGroup => {
  const sorted = [...events].sort(byDateDesc)
  const earliest = events.reduce(
    (min, e) => (e.date < min ? e.date : min),
    events[0].date,
  )
  return {
    key: `series:${seriesName}`,
    series: seriesName,
    date: earliest,
    totalRevenue: round2(sorted.reduce((sum, e) => sum + e.revenue, 0)),
    events: sorted,
  }
}

const buildStandaloneGroup = (event: EventRevenue): RevenueGroup => ({
  key: `event:${event._id}`,
  series: null,
  date: event.date,
  totalRevenue: event.revenue,
  events: [event],
})

export const revenueActions = {
  init: async () => {
    setRevenueState({ loading: true, error: null })
    try {
      const events = await apiGet<EventRevenue[]>('revenue')
      setRevenueState({ events, loading: false })
    } catch (err) {
      setRevenueState({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load revenue',
      })
    }
  },

  // Series groups + standalone events, all sorted by date desc (series by
  // their earliest event date).
  groups: (): RevenueGroup[] => {
    const series = new Map<string, EventRevenue[]>()
    const standalone: EventRevenue[] = []
    for (const e of revenueState.events) {
      if (e.eventSeries) {
        const list = series.get(e.eventSeries) || []
        list.push(e)
        series.set(e.eventSeries, list)
      } else {
        standalone.push(e)
      }
    }
    const groups: RevenueGroup[] = []
    for (const [name, events] of series) groups.push(buildSeriesGroup(name, events))
    for (const event of standalone) groups.push(buildStandaloneGroup(event))
    return groups.sort(byDateDesc)
  },

  toggle: (key: string) => setRevenueState('collapsed', key, (c) => !c),

  isCollapsed: (key: string): boolean => !!revenueState.collapsed[key],
}
