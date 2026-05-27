import { createStore } from 'solid-js/store'
import type { EventOption } from './eventStore'
import { eventState, eventActions } from './eventStore'
import { authState } from './authStore'
import { apiPost } from '../utils/api'
import { parseLocalDate } from '../utils/date'

export interface UnpaidFeeInfo {
  _id: string
  eventName: string
  date: string
  time?: string
  registrationFee: number
  eventSeries?: string
}

interface EventListState {
  loading: boolean
  error: string | null
  myEventsOnly: boolean
  registering: boolean
  registerError: string | null
  showFeeDialog: boolean
  unpaidFees: UnpaidFeeInfo[]
  registeredEventName: string
}

const getInitialState = (): EventListState => ({
  loading: false,
  error: null,
  myEventsOnly: false,
  registering: false,
  registerError: null,
  showFeeDialog: false,
  unpaidFees: [],
  registeredEventName: '',
})

const [eventListState, setEventListState] =
  createStore<EventListState>(getInitialState())

export { eventListState }

const sortedEvents = (): EventOption[] => {
  if (!eventState.data) return []
  const events = eventListState.myEventsOnly
    ? filterMyEvents(eventState.data)
    : eventState.data
  return [...events].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )
}

const filterMyEvents = (events: EventOption[]): EventOption[] => {
  const userId = authState.user?._id
  if (!userId) return []
  return events.filter((event) => isPlayerInEvent(event, userId))
}

const isPlayerInEvent = (event: EventOption, playerId: string): boolean =>
  event.participants?.some((participant) =>
    participant.players?.some(
      (player) => player._id.toString() === playerId.toString(),
    ),
  ) ?? false

const isEventFull = (event: EventOption): boolean =>
  event.maxParticipants > 0 &&
  event.participants.length >= event.maxParticipants

const isEventStarted = (event: EventOption): boolean => {
  if (!event.date) return false
  const now = new Date()
  const eventDate = parseLocalDate(event.date)
  if (event.time) {
    const timeParts = parseTime(event.time)
    if (timeParts) {
      eventDate.setHours(timeParts.hours, timeParts.minutes, 0, 0)
    }
  }
  return now >= eventDate
}

const parseTime = (
  timeStr: string,
): { hours: number; minutes: number } | null => {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return null
  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const period = match[3].toUpperCase()
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0
  return { hours, minutes }
}

const canRegister = (event: EventOption): boolean =>
  !isEventFull(event) && !isEventStarted(event)

const isPlayerRegistered = (event: EventOption): boolean => {
  const userId = authState.user?._id
  if (!userId) return false
  return isPlayerInEvent(event, userId)
}

const getParticipantCountText = (event: EventOption): string => {
  const count = event.participants?.length || 0
  const max =
    event.maxParticipants > 0 ? String(event.maxParticipants) : 'unlimited'
  return `${count}/${max}`
}

const toggleMyEvents = () => {
  setEventListState('myEventsOnly', !eventListState.myEventsOnly)
}

const fetchEvents = async () => {
  setEventListState({ loading: true, error: null })
  try {
    await eventActions.fetchEvents()
    setEventListState({ loading: false })
  } catch (err) {
    setEventListState({
      loading: false,
      error: err instanceof Error ? err.message : 'Failed to fetch events',
    })
  }
}

interface RegisterResponse {
  participant: unknown
  unpaidFees: UnpaidFeeInfo[]
}

const registerForEvent = async (event: EventOption) => {
  const playerId = authState.user?._id
  if (!playerId) return

  setEventListState({ registering: true, registerError: null })
  try {
    const result = await apiPost<RegisterResponse>('registerForEvent', {
      _id: event._id,
      playerId,
    })
    await eventActions.refreshEvents()
    setEventListState({
      registering: false,
      showFeeDialog: true,
      unpaidFees: result.unpaidFees,
      registeredEventName: event.eventName,
    })
  } catch (err) {
    setEventListState({
      registering: false,
      registerError:
        err instanceof Error ? err.message : 'Failed to register',
    })
  }
}

const closeFeeDialog = () => {
  setEventListState({
    showFeeDialog: false,
    unpaidFees: [],
    registeredEventName: '',
  })
}

const getPlayerName = (): string => {
  const user = authState.user
  if (!user) return ''
  return `${user.firstName} ${user.lastName}`
}

const buildFeeInfoText = (): string => {
  const fees = eventListState.unpaidFees
  if (fees.length === 0) return ''
  const lines: string[] = []
  const playerName = getPlayerName()
  if (playerName) lines.push(playerName)
  for (const f of fees) {
    lines.push(`${f.eventName} (${f.date}) - $${f.registrationFee}`)
  }
  const total = fees.reduce((sum, f) => sum + (f.registrationFee || 0), 0)
  lines.push(`Total: $${total}`)
  return lines.join('\n')
}

export const eventListActions = {
  fetchEvents,
  sortedEvents,
  toggleMyEvents,
  canRegister,
  isPlayerRegistered,
  getParticipantCountText,
  registerForEvent,
  closeFeeDialog,
  buildFeeInfoText,
  reset: () => setEventListState(getInitialState()),
}
