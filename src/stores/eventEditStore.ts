import { createStore } from 'solid-js/store'
import type { BestOfOption, QualifiersCount, Event } from '../../shared/types'
import { apiGet, apiPost } from '../utils/api'
import { tournamentActions, type Tournament } from './tournamentStore'

export interface EventEditFormData {
  _id?: string
  tournamentId: string
  date: Date | null
  maxParticipants: string
  name: string
  groupGames: BestOfOption
  knockoutGames: BestOfOption
  groupMatches: BestOfOption
  knockoutMatches: BestOfOption
  qualifiers: QualifiersCount
  handicapEnabled: boolean
  handicapDifference: string
  handicapMaxPoints: string
}

interface EventEditState {
  formData: EventEditFormData
  saving: boolean
  error: string | null
}

const defaultFormData: EventEditFormData = {
  tournamentId: '',
  date: null,
  maxParticipants: 'Unlimited',
  name: '',
  groupGames: 'Best of 3',
  knockoutGames: 'Best of 3 before Semifinal',
  groupMatches: 'Best of 3',
  knockoutMatches: 'Best of 3 before Semifinal',
  qualifiers: 'Top 2',
  handicapEnabled: false,
  handicapDifference: '200',
  handicapMaxPoints: '5',
}

const getInitialState = (): EventEditState => ({
  formData: { ...defaultFormData },
  saving: false,
  error: null,
})

const [eventEditState, setEventEditState] =
  createStore<EventEditState>(getInitialState())

export { eventEditState }

const mapEventToFormData = (event: Event): EventEditFormData => ({
  _id: event._id,
  tournamentId: event.tournamentId,
  date: event.date ? new Date(event.date) : null,
  maxParticipants:
    event.maxParticipants === 0 ? 'Unlimited' : String(event.maxParticipants),
  name: event.eventName || '',
  groupGames: event.groupGames || 'Best of 3',
  knockoutGames: event.knockoutGames || 'Best of 3 before Semifinal',
  groupMatches: event.groupMatches || 'Best of 3',
  knockoutMatches: event.knockoutMatches || 'Best of 3 before Semifinal',
  qualifiers: event.qualifiers || 'Top 2',
  handicapEnabled: event.handicapEnabled || false,
  handicapDifference: String(event.handicapDifference || 200),
  handicapMaxPoints: String(event.handicapMaxPoints || 5),
})

export const eventEditActions = {
  initForm: (initialData?: Partial<EventEditFormData>) => {
    setEventEditState({
      formData: { ...defaultFormData, ...initialData },
      saving: false,
      error: null,
    })
  },

  loadEvent: async (eventId: string) => {
    setEventEditState({ saving: false, error: null })
    try {
      const event = await apiGet<Event>('event', { _id: eventId })
      const formData = mapEventToFormData(event)
      setEventEditState({ formData })
    } catch (err) {
      setEventEditState({
        error: err instanceof Error ? err.message : 'Failed to load event',
      })
    }
  },

  setField: <K extends keyof EventEditFormData>(
    field: K,
    value: EventEditFormData[K],
  ) => {
    const newFormData = { ...eventEditState.formData, [field]: value }

    if (field === 'tournamentId' || field === 'date') {
      const updatedName = generateEventName(
        newFormData.tournamentId,
        newFormData.date,
      )
      if (updatedName) {
        newFormData.name = updatedName
      }
    }

    setEventEditState({ formData: newFormData })
  },

  saveEvent: async (onSuccess?: (data: EventEditFormData) => void) => {
    const { formData } = eventEditState

    if (!validateForm(formData)) {
      setEventEditState({ error: 'Please fill all required fields' })
      return
    }

    const confirmed = window.confirm('Are you sure you want to save this event?')
    if (!confirmed) return

    setEventEditState({ saving: true, error: null })

    try {
      await apiPost('saveEvent', buildSavePayload(formData))
      setEventEditState({ saving: false })
      onSuccess?.(formData)
    } catch (err) {
      setEventEditState({
        saving: false,
        error: err instanceof Error ? err.message : 'Failed to save event',
      })
    }
  },

  resetForm: () => setEventEditState(getInitialState()),

  getSelectedTournament: (): Tournament | undefined =>
    tournamentActions.getTournamentById(eventEditState.formData.tournamentId),
}

const validateForm = (formData: EventEditFormData): boolean =>
  !!formData.tournamentId && !!formData.date && !!formData.name.trim()

const generateEventName = (
  tournamentId: string,
  date: Date | null,
): string | null => {
  if (!tournamentId || !date) return null
  const tournament = tournamentActions.getTournamentById(tournamentId)
  if (!tournament) return null
  const dateStr = date.toISOString().split('T')[0]
  return `${tournament.name} - ${dateStr}`
}

const buildSavePayload = (formData: EventEditFormData) => ({
  _id: formData._id,
  tournamentId: formData.tournamentId,
  date: formData.date?.toISOString().split('T')[0],
  maxParticipants:
    formData.maxParticipants === 'Unlimited'
      ? 0
      : parseInt(formData.maxParticipants, 10),
  name: formData.name,
  groupGames: formData.groupGames,
  knockoutGames: formData.knockoutGames,
  groupMatches: formData.groupMatches,
  knockoutMatches: formData.knockoutMatches,
  qualifiers: formData.qualifiers,
  handicapEnabled: formData.handicapEnabled,
  handicapDifference: parseInt(formData.handicapDifference, 10),
  handicapMaxPoints: parseInt(formData.handicapMaxPoints, 10),
})

export const hasGroupStage = (stages: ('group' | 'knockout')[]): boolean =>
  stages.includes('group')

export const hasKnockoutStage = (stages: ('group' | 'knockout')[]): boolean =>
  stages.includes('knockout')
