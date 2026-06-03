import { createStore } from 'solid-js/store'
import type { Participant } from '../../shared/types/Tournament'
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

export interface PartialTeamInfo {
  participantId: string
  playerNames: string[]
  combinedRating: number
  topN: number | null
  topPlayersCount: number
  disabled: boolean
  exceedsCombinedRating: boolean
  exceedsTopN: boolean
  sexViolationReason?: string
}

export type FeeDialogMode = 'registration' | 'feeInfo'

export type TeammateDialogMode = 'registration' | 'manage'

interface EventListState {
  loading: boolean
  error: string | null
  myEventsOnly: boolean
  todayOnly: boolean
  registering: boolean
  registerError: string | null
  showFeeDialog: boolean
  feeDialogMode: FeeDialogMode
  unpaidFees: UnpaidFeeInfo[]
  registeredEventName: string
  showTeammateDialog: boolean
  teammateDialogMode: TeammateDialogMode
  partialTeams: PartialTeamInfo[]
  selectedPartialTeamId: string | null
  pendingRegistrationEvent: EventOption | null
  loadingPartialTeams: boolean
}

const getInitialState = (): EventListState => ({
  loading: false,
  error: null,
  myEventsOnly: false,
  todayOnly: false,
  registering: false,
  registerError: null,
  showFeeDialog: false,
  feeDialogMode: 'registration',
  unpaidFees: [],
  registeredEventName: '',
  showTeammateDialog: false,
  teammateDialogMode: 'registration',
  partialTeams: [],
  selectedPartialTeamId: null,
  pendingRegistrationEvent: null,
  loadingPartialTeams: false,
})

const [eventListState, setEventListState] =
  createStore<EventListState>(getInitialState())

export { eventListState }

const sortedEvents = (): EventOption[] => {
  if (!eventState.data) return []
  let events = eventState.data
  if (eventListState.myEventsOnly) events = filterMyEvents(events)
  if (eventListState.todayOnly) events = events.filter(isToday)
  return [...events].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )
}

const isToday = (event: EventOption): boolean => {
  if (!event.date) return false
  const d = parseLocalDate(event.date.slice(0, 10))
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
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

const isParticipantPaid = (event: EventOption, participant: Participant): boolean => {
  const paidIds = event.paidPlayerIds || []
  return (
    participant.players.length === event.nop &&
    participant.players.every((p) => paidIds.includes(p._id.toString()))
  )
}

const countPaidParticipants = (event: EventOption): number =>
  event.participants.filter((p) => isParticipantPaid(event, p)).length

const isEventFull = (event: EventOption): boolean =>
  event.maxParticipants > 0 &&
  countPaidParticipants(event) >= event.maxParticipants

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

const isEventFinished = (event: EventOption): boolean => {
  const stages = event.eventStages
  if (!stages || stages.length === 0) return false
  const knockout = stages.find((s) => s.type === 'knockout')
  if (knockout) {
    if (knockout.rounds.length === 0) return false
    const lastRound = knockout.rounds[knockout.rounds.length - 1]
    return lastRound.isComplete && lastRound.participantCount === 2
  }
  const group = stages.find((s) => s.type === 'group')
  if (group) {
    return group.groups.length > 0 && group.groups.every((g) => g.isComplete)
  }
  return false
}

const isPastDay = (event: EventOption): boolean => {
  if (!event.date) return false
  const eventDate = parseLocalDate(event.date.slice(0, 10))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return eventDate.getTime() < today.getTime()
}

const isPastEvent = (event: EventOption): boolean =>
  isPastDay(event) || isEventFinished(event)

const isMyUpcomingEvent = (event: EventOption): boolean => {
  const userId = authState.user?._id
  if (!userId) return false
  if (!isPlayerInEvent(event, userId)) return false
  return !isPastEvent(event)
}

const getEventRowColor = (event: EventOption): string => {
  if (isPastEvent(event)) return '#f0f0f0'
  if (isMyUpcomingEvent(event)) return '#e8f5e9'
  return '#fff'
}

const calculateAge = (dateOfBirth: string, referenceDate: string): number => {
  const dob = parseLocalDate(dateOfBirth.slice(0, 10))
  const ref = parseLocalDate(referenceDate.slice(0, 10))
  let age = ref.getFullYear() - dob.getFullYear()
  const monthDiff = ref.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < dob.getDate())) age--
  return age
}

const getRatingBlockReason = (event: EventOption): string | null => {
  if (event.restriction !== 'Rated' || !event.ratingLimit) return null
  const rating = authState.user?.rating ?? 0
  if (rating > event.ratingLimit) {
    return `Your rating (${rating}) exceeds the event limit (${event.ratingLimit}).`
  }
  return null
}

const getAgeBlockReason = (event: EventOption): string | null => {
  if (event.restriction !== 'Age' || !event.ageLimitType || !event.ageLimit) {
    return null
  }
  const dateOfBirth = authState.user?.dateOfBirth
  if (!dateOfBirth) {
    return 'Your birth date is required to register for this age-restricted event. Please add it on your account page.'
  }
  const age = calculateAge(dateOfBirth, event.date)
  if (event.ageLimitType === 'U' && age > event.ageLimit) {
    return `This event is for players under ${event.ageLimit} years old.`
  }
  if (event.ageLimitType === 'O' && age < event.ageLimit) {
    return `This event is for players over ${event.ageLimit} years old.`
  }
  return null
}

const getRegisterBlockReason = (event: EventOption): string | null => {
  if (!authState.user) return null
  if (isEventFull(event)) return 'This event is full.'
  return getRatingBlockReason(event) || getAgeBlockReason(event)
}

const isPlayerRegistered = (event: EventOption): boolean => {
  const userId = authState.user?._id
  if (!userId) return false
  return isPlayerInEvent(event, userId)
}

const getParticipantCountText = (event: EventOption): string => {
  const count = event.participants?.length || 0
  const paidCount = countPaidParticipants(event)
  let text = `Registered: ${count}, Paid: ${paidCount}`
  if (event.maxParticipants > 0) text += `, Max: ${event.maxParticipants}`
  return text
}

const toggleMyEvents = () => {
  setEventListState('myEventsOnly', !eventListState.myEventsOnly)
}

const toggleTodayEvents = () => {
  setEventListState('todayOnly', !eventListState.todayOnly)
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

const isTeamEvent = (event: EventOption): boolean => event.nop > 1

const registerForEvent = async (event: EventOption) => {
  const playerId = authState.user?._id
  if (!playerId) return

  if (isTeamEvent(event)) {
    await handleTeamEventRegistration(event, playerId)
  } else {
    await doRegister(event)
  }
}

const handleTeamEventRegistration = async (
  event: EventOption,
  playerId: string,
) => {
  setEventListState({ loadingPartialTeams: true })
  try {
    const partialTeams = await apiPost<PartialTeamInfo[]>('getPartialTeams', {
      _id: event._id,
      playerId,
    })
    if (partialTeams.length > 0) {
      setEventListState({
        loadingPartialTeams: false,
        showTeammateDialog: true,
        teammateDialogMode: 'registration',
        partialTeams,
        selectedPartialTeamId: null,
        pendingRegistrationEvent: event,
      })
    } else {
      setEventListState({ loadingPartialTeams: false })
      await doRegister(event)
    }
  } catch {
    setEventListState({ loadingPartialTeams: false })
    await doRegister(event)
  }
}

const isPartialTeamDisabled = (participantId: string): boolean => {
  const team = eventListState.partialTeams.find(
    (t) => t.participantId === participantId,
  )
  return team?.disabled ?? false
}

const selectPartialTeam = (participantId: string) => {
  if (isPartialTeamDisabled(participantId)) return
  setEventListState('selectedPartialTeamId', participantId)
}

const confirmTeammateSelection = async () => {
  const event = eventListState.pendingRegistrationEvent
  if (!event) return
  const participantId = eventListState.selectedPartialTeamId

  if (eventListState.teammateDialogMode === 'manage') {
    await confirmManageTeammate(event, participantId ?? undefined)
  } else {
    closeTeammateDialog()
    await doRegister(event, participantId ?? undefined)
  }
}

const confirmManageTeammate = async (
  event: EventOption,
  targetParticipantId?: string,
) => {
  const playerId = authState.user?._id
  if (!playerId || !targetParticipantId) return

  closeTeammateDialog()
  setEventListState({ registering: true, registerError: null })
  try {
    await apiPost('changeTeam', {
      _id: event._id,
      playerId,
      participantId: targetParticipantId,
    })
    await eventActions.refreshEvents()
    setEventListState({ registering: false })
  } catch (err) {
    setEventListState({
      registering: false,
      registerError:
        err instanceof Error ? err.message : 'Failed to change team',
    })
  }
}

const skipTeammateSelection = async () => {
  const event = eventListState.pendingRegistrationEvent
  if (!event) return
  closeTeammateDialog()
  await doRegister(event)
}

const closeTeammateDialog = () => {
  setEventListState({
    showTeammateDialog: false,
    teammateDialogMode: 'registration',
    partialTeams: [],
    selectedPartialTeamId: null,
    pendingRegistrationEvent: null,
  })
}

const doRegister = async (
  event: EventOption,
  participantId?: string,
) => {
  const playerId = authState.user?._id
  if (!playerId) return

  setEventListState({ registering: true, registerError: null })
  try {
    const result = await apiPost<RegisterResponse>('registerForEvent', {
      _id: event._id,
      playerId,
      ...(participantId && { participantId }),
    })
    await eventActions.refreshEvents()
    setEventListState({
      registering: false,
      showFeeDialog: true,
      feeDialogMode: 'registration',
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

const showFeeInfo = async (event: EventOption) => {
  const playerId = authState.user?._id
  if (!playerId) return

  try {
    const unpaidFees = await apiPost<UnpaidFeeInfo[]>('getPlayerUnpaidFees', {
      _id: event._id,
      playerId,
    })
    setEventListState({
      showFeeDialog: true,
      feeDialogMode: 'feeInfo',
      unpaidFees,
      registeredEventName: event.eventName,
    })
  } catch (err) {
    // silently fail
  }
}

const isPlayerUnpaid = (event: EventOption): boolean => {
  const userId = authState.user?._id
  if (!userId) return false
  if (!isPlayerInEvent(event, userId)) return false
  const paidIds = event.paidPlayerIds || []
  return !paidIds.includes(userId)
}

const isPlayerInPartialTeam = (event: EventOption): boolean => {
  const userId = authState.user?._id
  if (!userId) return false
  if (!isTeamEvent(event)) return false
  return event.participants?.some(
    (p) =>
      p.players.length < event.nop &&
      p.players.some((pl) => pl._id.toString() === userId.toString()),
  ) ?? false
}

const showTeammateDialogForManage = async (event: EventOption) => {
  const playerId = authState.user?._id
  if (!playerId) return

  setEventListState({ loadingPartialTeams: true })
  try {
    const partialTeams = await apiPost<PartialTeamInfo[]>('getPartialTeams', {
      _id: event._id,
      playerId,
    })
    setEventListState({
      loadingPartialTeams: false,
      showTeammateDialog: true,
      teammateDialogMode: 'manage',
      partialTeams,
      selectedPartialTeamId: null,
      pendingRegistrationEvent: event,
    })
  } catch {
    setEventListState({ loadingPartialTeams: false })
  }
}

const closeFeeDialog = () => {
  setEventListState({
    showFeeDialog: false,
    feeDialogMode: 'registration',
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
  toggleTodayEvents,
  getEventRowColor,
  isEventStarted,
  getRegisterBlockReason,
  isPlayerRegistered,
  isPlayerUnpaid,
  isPlayerInPartialTeam,
  getParticipantCountText,
  registerForEvent,
  selectPartialTeam,
  confirmTeammateSelection,
  skipTeammateSelection,
  closeTeammateDialog,
  showFeeInfo,
  closeFeeDialog,
  buildFeeInfoText,
  showTeammateDialogForManage,
  reset: () => setEventListState(getInitialState()),
}
