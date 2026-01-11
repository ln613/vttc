import type { Participant } from '../../shared/types/Tournament'
import { apiPost } from '../utils/api'
import { createStore } from './createStore'
import { eventActions, type EventOption } from './eventStore'
import { playerActions } from './playerStore'

interface ToastMessage {
  type: 'success' | 'error'
  text: string
}

interface EventParticipantEditState {
  selectedEventId: string
  showAddDialog: boolean
  toastMessage: ToastMessage | null
  saving: boolean
}

const eventParticipantEditStore = createStore<EventParticipantEditState>({
  selectedEventId: '',
  showAddDialog: false,
  toastMessage: null,
  saving: false,
})

export const {
  useStore: useEventParticipantEditStore,
  useSelector: useEventParticipantEditSelector,
} = eventParticipantEditStore

export const eventParticipantEditActions = {
  init: () => {
    eventActions.fetchEvents()
    playerActions.fetchPlayers()
  },

  setSelectedEventId: (id: string) => {
    eventParticipantEditStore.setState({ selectedEventId: id })
  },

  openAddDialog: () => {
    eventParticipantEditStore.setState({ showAddDialog: true })
  },

  closeAddDialog: () => {
    eventParticipantEditStore.setState({ showAddDialog: false })
  },

  showToast: (type: 'success' | 'error', text: string) => {
    eventParticipantEditStore.setState({ toastMessage: { type, text } })
    setTimeout(() => {
      eventParticipantEditStore.setState({ toastMessage: null })
    }, 3000)
  },

  addParticipant: async (playerIds: string[]) => {
    const { selectedEventId } = eventParticipantEditStore.getState()
    const selectedEvent = eventActions.getEventById(selectedEventId)
    if (!selectedEvent) return

    eventParticipantEditStore.setState({ saving: true })

    try {
      await apiPost('addParticipant', {
        tournamentId: selectedEvent.id,
        playerIds,
      })
      eventParticipantEditActions.showToast('success', 'Participant added successfully')
      eventParticipantEditStore.setState({ showAddDialog: false, saving: false })
      await eventActions.refreshEvents()
    } catch (error) {
      eventParticipantEditActions.showToast(
        'error',
        error instanceof Error ? error.message : 'Failed to add participant',
      )
      eventParticipantEditStore.setState({ saving: false })
    }
  },

  deleteParticipant: async (participantId: string) => {
    const { selectedEventId } = eventParticipantEditStore.getState()
    const selectedEvent = eventActions.getEventById(selectedEventId)
    if (!selectedEvent) return

    const confirmed = window.confirm('Are you sure you want to delete this participant?')
    if (!confirmed) return

    try {
      await apiPost('deleteParticipant', {
        tournamentId: selectedEvent.id,
        participantId,
      })
      eventParticipantEditActions.showToast('success', 'Participant deleted successfully')
      await eventActions.refreshEvents()
    } catch (error) {
      eventParticipantEditActions.showToast(
        'error',
        error instanceof Error ? error.message : 'Failed to delete participant',
      )
    }
  },

  getSelectedEvent: (): EventOption | undefined => {
    const { selectedEventId } = eventParticipantEditStore.getState()
    return eventActions.getEventById(selectedEventId)
  },

  reset: () => {
    eventParticipantEditStore.setState({
      selectedEventId: '',
      showAddDialog: false,
      toastMessage: null,
      saving: false,
    })
  },
}

export const canShowDeleteColumn = (event: EventOption): boolean => {
  const eventDate = new Date(event.date)
  const now = new Date()
  return !event.hasSchedule && eventDate > now
}

export const isAddDisabled = (event: EventOption | undefined): boolean => {
  if (!event) return true
  return (
    event.maxParticipants > 0 &&
    event.participants.length >= event.maxParticipants
  )
}

export const getParticipantsCountText = (event: EventOption): string => {
  const count = event.participants.length
  if (event.maxParticipants === 0) {
    return `List of participants - ${count}`
  }
  return `List of participants - ${count} / ${event.maxParticipants}`
}

export const calculateCombinedRating = (participant: Participant): number => {
  return participant.players.reduce((sum, p) => sum + (p.rating || 0), 0)
}

export const calculateTopNCombinedRating = (
  participant: Participant,
  topN: number,
): number => {
  const sortedPlayers = [...participant.players].sort(
    (a, b) => (b.rating || 0) - (a.rating || 0),
  )
  return sortedPlayers
    .slice(0, topN)
    .reduce((sum, p) => sum + (p.rating || 0), 0)
}
