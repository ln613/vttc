import { createStore } from 'solid-js/store'
import type { Participant } from '../../shared/types/Tournament'
import type { Player } from '../../shared/types/Player'
import { apiPost } from '../utils/api'
import { eventActions, type EventOption } from './eventStore'
import { playerActions } from './playerStore'

interface ToastMessage {
  type: 'success' | 'error'
  text: string
}

interface EventParticipantEditState {
  selectedEventId: string
  showParticipantDialog: boolean
  editingParticipant: Participant | null
  showPaymentDialog: boolean
  paymentParticipant: Participant | null
  showDeleteDialog: boolean
  deleteParticipant: Participant | null
  toastMessage: ToastMessage | null
  saving: boolean
}

const getInitialState = (): EventParticipantEditState => ({
  selectedEventId: '',
  showParticipantDialog: false,
  editingParticipant: null,
  showPaymentDialog: false,
  paymentParticipant: null,
  showDeleteDialog: false,
  deleteParticipant: null,
  toastMessage: null,
  saving: false,
})

const [eventParticipantEditState, setEventParticipantEditState] =
  createStore<EventParticipantEditState>(getInitialState())

export { eventParticipantEditState }

export const eventParticipantEditActions = {
  init: (eventId?: string) => {
    if (eventId) {
      setEventParticipantEditState({ selectedEventId: eventId })
    }
    eventActions.fetchEvents()
    playerActions.fetchPlayers()
  },

  openAddDialog: () => {
    setEventParticipantEditState({
      showParticipantDialog: true,
      editingParticipant: null,
    })
  },

  openEditDialog: (participant: Participant) => {
    setEventParticipantEditState({
      showParticipantDialog: true,
      editingParticipant: participant,
    })
  },

  closeParticipantDialog: () => {
    setEventParticipantEditState({
      showParticipantDialog: false,
      editingParticipant: null,
    })
  },

  openPaymentDialog: (participant: Participant) => {
    setEventParticipantEditState({
      showPaymentDialog: true,
      paymentParticipant: participant,
    })
  },

  closePaymentDialog: () => {
    setEventParticipantEditState({
      showPaymentDialog: false,
      paymentParticipant: null,
    })
  },

  showToast: (type: 'success' | 'error', text: string) => {
    setEventParticipantEditState({ toastMessage: { type, text } })
    setTimeout(() => {
      setEventParticipantEditState({ toastMessage: null })
    }, 3000)
  },

  addParticipant: async (playerIds: string[]) => {
    const { selectedEventId } = eventParticipantEditState
    const selectedEvent = eventActions.getEventById(selectedEventId)
    if (!selectedEvent) return

    setEventParticipantEditState({ saving: true })

    try {
      await apiPost('addParticipant', {
        _id: selectedEvent._id,
        playerIds,
      })
      eventParticipantEditActions.showToast(
        'success',
        'Participant added successfully',
      )
      setEventParticipantEditState({
        showParticipantDialog: false,
        editingParticipant: null,
        saving: false,
      })
      await eventActions.refreshEvents()
    } catch (error) {
      eventParticipantEditActions.showToast(
        'error',
        error instanceof Error ? error.message : 'Failed to add participant',
      )
      setEventParticipantEditState({ saving: false })
    }
  },

  editParticipant: async (participantId: string, playerIds: string[]) => {
    const { selectedEventId } = eventParticipantEditState
    const selectedEvent = eventActions.getEventById(selectedEventId)
    if (!selectedEvent) return

    setEventParticipantEditState({ saving: true })

    try {
      await apiPost('editParticipant', {
        _id: selectedEvent._id,
        participantId,
        playerIds,
      })
      eventParticipantEditActions.showToast(
        'success',
        'Participant updated successfully',
      )
      setEventParticipantEditState({
        showParticipantDialog: false,
        editingParticipant: null,
        saving: false,
      })
      await eventActions.refreshEvents()
    } catch (error) {
      eventParticipantEditActions.showToast(
        'error',
        error instanceof Error ? error.message : 'Failed to update participant',
      )
      setEventParticipantEditState({ saving: false })
    }
  },

  openDeleteDialog: (participant: Participant) => {
    setEventParticipantEditState({
      showDeleteDialog: true,
      deleteParticipant: participant,
    })
  },

  closeDeleteDialog: () => {
    setEventParticipantEditState({
      showDeleteDialog: false,
      deleteParticipant: null,
    })
  },

  handleDeleteClick: (participant: Participant) => {
    const { selectedEventId } = eventParticipantEditState
    const selectedEvent = eventActions.getEventById(selectedEventId)
    if (!selectedEvent) return

    const isTeamEvent = selectedEvent.nop > 1
    const hasMultiplePlayers = participant.players.length > 1

    if (isTeamEvent && hasMultiplePlayers) {
      eventParticipantEditActions.openDeleteDialog(participant)
    } else {
      eventParticipantEditActions.deleteWholeParticipant(participant._id)
    }
  },

  deleteWholeParticipant: async (participantId: string) => {
    const { selectedEventId } = eventParticipantEditState
    const selectedEvent = eventActions.getEventById(selectedEventId)
    if (!selectedEvent) return

    const confirmed = window.confirm(
      'Are you sure you want to delete this participant?',
    )
    if (!confirmed) return

    try {
      await apiPost('deleteParticipant', {
        _id: selectedEvent._id,
        participantId,
      })
      eventParticipantEditActions.showToast(
        'success',
        'Participant deleted successfully',
      )
      eventParticipantEditActions.closeDeleteDialog()
      await eventActions.refreshEvents()
    } catch (error) {
      eventParticipantEditActions.showToast(
        'error',
        error instanceof Error ? error.message : 'Failed to delete participant',
      )
    }
  },

  deletePlayerFromTeam: async (participantId: string, playerId: string) => {
    const { selectedEventId } = eventParticipantEditState
    const selectedEvent = eventActions.getEventById(selectedEventId)
    if (!selectedEvent) return

    const confirmed = window.confirm(
      'Are you sure you want to remove this player from the team?',
    )
    if (!confirmed) return

    try {
      await apiPost('deletePlayerFromTeam', {
        _id: selectedEvent._id,
        participantId,
        playerId,
      })
      eventParticipantEditActions.showToast(
        'success',
        'Player removed from team successfully',
      )
      eventParticipantEditActions.closeDeleteDialog()
      await eventActions.refreshEvents()
    } catch (error) {
      eventParticipantEditActions.showToast(
        'error',
        error instanceof Error
          ? error.message
          : 'Failed to remove player from team',
      )
    }
  },

  paymentReceived: async (playerId: string) => {
    const { selectedEventId } = eventParticipantEditState
    const selectedEvent = eventActions.getEventById(selectedEventId)
    if (!selectedEvent) return

    try {
      await apiPost('paymentReceived', {
        _id: selectedEvent._id,
        playerId,
      })
      eventParticipantEditActions.showToast(
        'success',
        'Payment marked as received',
      )
      await eventActions.refreshEvents()
    } catch (error) {
      eventParticipantEditActions.showToast(
        'error',
        error instanceof Error
          ? error.message
          : 'Failed to mark payment received',
      )
    }
  },

  paymentReceivedForTeamPlayer: async (playerId: string) => {
    const confirmed = window.confirm(
      'Confirm payment received for this player?',
    )
    if (!confirmed) return
    await eventParticipantEditActions.paymentReceived(playerId)
    eventParticipantEditActions.closePaymentDialogIfFullyPaid()
  },

  paymentReceivedForAllTeamPlayers: async (playerIds: string[]) => {
    const confirmed = window.confirm(
      'Confirm payment received for all players in this team?',
    )
    if (!confirmed) return

    for (const playerId of playerIds) {
      await eventParticipantEditActions.paymentReceived(playerId)
    }
    eventParticipantEditActions.closePaymentDialogIfFullyPaid()
  },

  closePaymentDialogIfFullyPaid: () => {
    const { paymentParticipant, selectedEventId } = eventParticipantEditState
    if (!paymentParticipant) return
    const event = eventActions.getEventById(selectedEventId)
    if (!event) return
    const hasUnpaid = paymentParticipant.players.some(
      (player) => !isPlayerPaid(event, player._id),
    )
    if (!hasUnpaid) eventParticipantEditActions.closePaymentDialog()
  },

  getSelectedEvent: (): EventOption | undefined =>
    eventActions.getEventById(eventParticipantEditState.selectedEventId),

  reset: () => setEventParticipantEditState(getInitialState()),
}

export const canShowDeleteColumn = (event: EventOption): boolean =>
  !event.hasSchedule

const countPaidParticipants = (event: EventOption): number => {
  const paidIds = event.paidPlayerIds || []
  return event.participants.filter(
    (p) =>
      p.players.length > 0 &&
      p.players.every((pl) => paidIds.includes(pl._id.toString())),
  ).length
}

export const isAddDisabled = (event: EventOption | undefined): boolean => {
  if (!event) return true
  return (
    event.maxParticipants > 0 &&
    countPaidParticipants(event) >= event.maxParticipants
  )
}

export const getParticipantsCountText = (event: EventOption): string => {
  const count = event.participants.length
  const paidCount = countPaidParticipants(event)
  let text = `Registered: ${count}, Paid: ${paidCount}`
  if (event.maxParticipants > 0) text += `, Max: ${event.maxParticipants}`
  return text
}

export const calculateCombinedRating = (participant: Participant): number =>
  participant.players.reduce((sum, p) => sum + (p.rating || 0), 0)

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

export const isPlayerPaid = (
  event: EventOption,
  playerId: string,
): boolean => {
  const paidIds = event.paidPlayerIds || []
  return paidIds.includes(playerId)
}

const normalizedSex = (sex: string | undefined): 'male' | 'female' | '' => {
  const v = (sex ?? '').trim().toLowerCase()
  if (v === 'm' || v === 'male') return 'male'
  if (v === 'f' || v === 'female') return 'female'
  return ''
}

const meetsEventSexRequirement = (
  event: EventOption,
  player: Player,
): boolean => {
  if (!event.sex || event.sex === 'All' || event.sex === 'Mixed') return true
  const sex = normalizedSex(player.sex)
  if (event.sex === 'Man') return sex === 'male'
  if (event.sex === 'Woman') return sex === 'female'
  return true
}

const meetsEventRatingRequirement = (
  event: EventOption,
  player: Player,
): boolean => {
  if (event.restriction !== 'Rated' || !event.ratingLimit) return true
  return (player.rating ?? 0) <= event.ratingLimit
}

export const isPlayerQualifiedForEvent = (
  event: EventOption,
  player: Player,
): boolean =>
  meetsEventSexRequirement(event, player) &&
  meetsEventRatingRequirement(event, player)
