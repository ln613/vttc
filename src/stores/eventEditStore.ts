import { createStore } from 'solid-js/store'
import type {
  BestOfOption,
  QualifiersCount,
  Event,
  EventType,
  LeagueFormat,
} from '../../shared/types'
import {
  getLeagueSubMatchCount,
  getSupportedTeamSizes,
} from '../../shared/rules/leagueRules'
import { apiGet, apiPost } from '../utils/api'
import { parseLocalDate, formatLocalDate } from '../utils/date'
import { tournamentActions, type Tournament } from './tournamentStore'

export interface EventEditFormData {
  _id?: string
  eventType: EventType
  eventSeries: string
  tournamentId: string
  date: Date | null
  time: string
  maxParticipants: string
  registrationFee: string
  prize1: string
  prize2: string
  prize3: string
  prize4: string
  name: string
  groupGames: BestOfOption
  knockoutGames: BestOfOption
  groupMatches: BestOfOption
  knockoutMatches: BestOfOption
  qualifiers: QualifiersCount
  handicapEnabled: boolean
  handicapDifference: string
  handicapMaxPoints: string
  // ----- League only -----
  format: LeagueFormat
  dayOfWeek: string
  startDate: Date | null
  teamSize: string
  numOfPhases: string
  allowPlayerSharing: boolean
  roundGames: BestOfOption
  rated: boolean
  ratingLimit: string
  topPlayersRatingEnabled: boolean
  topPlayersCount: string
  topPlayersRatingLimit: string
}

interface EventEditState {
  formData: EventEditFormData
  initialFormData: EventEditFormData
  eventSeriesList: string[]
  saving: boolean
  saved: boolean
  error: string | null
}

const defaultFormData: EventEditFormData = {
  eventType: 'tournament',
  eventSeries: '',
  tournamentId: '',
  date: null,
  time: '',
  maxParticipants: 'Unlimited',
  registrationFee: '',
  prize1: '',
  prize2: '',
  prize3: '',
  prize4: '',
  name: '',
  groupGames: 'Best of 3',
  knockoutGames: 'Best of 3 before Semifinal',
  groupMatches: 'Best of 5',
  knockoutMatches: 'Best of 5',
  qualifiers: 'Top 2',
  handicapEnabled: false,
  handicapDifference: '200',
  handicapMaxPoints: '5',
  format: 'RR Singles',
  dayOfWeek: '',
  startDate: null,
  teamSize: '3',
  numOfPhases: '1',
  allowPlayerSharing: false,
  roundGames: 'Best of 5',
  rated: false,
  ratingLimit: '1500',
  topPlayersRatingEnabled: false,
  topPlayersCount: '1',
  topPlayersRatingLimit: '2500',
}

const getInitialState = (): EventEditState => ({
  formData: { ...defaultFormData },
  initialFormData: { ...defaultFormData },
  eventSeriesList: [],
  saving: false,
  saved: false,
  error: null,
})

const [eventEditState, setEventEditState] =
  createStore<EventEditState>(getInitialState())

export { eventEditState }

const mapEventToFormData = (event: Event): EventEditFormData => ({
  ...defaultFormData,
  _id: event._id,
  eventType: event.eventType || 'tournament',
  eventSeries: event.eventSeries || '',
  tournamentId: event.tournamentId,
  date: event.date ? parseLocalDate(event.date) : null,
  time: event.time || '',
  maxParticipants:
    event.maxParticipants === 0 ? 'Unlimited' : String(event.maxParticipants),
  registrationFee: event.registrationFee ? String(event.registrationFee) : '',
  prize1: event.prizes?.first ? String(event.prizes.first) : '',
  prize2: event.prizes?.second ? String(event.prizes.second) : '',
  prize3: event.prizes?.third ? String(event.prizes.third) : '',
  prize4: event.prizes?.fourth ? String(event.prizes.fourth) : '',
  name: event.eventName || '',
  groupGames: event.groupGames || 'Best of 3',
  knockoutGames: event.knockoutGames || 'Best of 3 before Semifinal',
  groupMatches: event.groupMatches || 'Best of 5',
  knockoutMatches: event.knockoutMatches || 'Best of 5',
  qualifiers: event.qualifiers || 'Top 2',
  handicapEnabled: event.handicapEnabled || false,
  handicapDifference: String(event.handicapDifference || 200),
  handicapMaxPoints: String(event.handicapMaxPoints || 5),
  // A league round carries the whole league's config, so editing any round
  // edits the league.
  ...(event.eventType === 'league' ? mapLeagueToFormData(event) : {}),
})

const mapLeagueToFormData = (event: Event): Partial<EventEditFormData> => ({
  name: event.leagueName || event.eventName || '',
  format: event.league?.format || 'RR Singles',
  dayOfWeek: event.league ? String(event.league.dayOfWeek) : '',
  startDate: event.league?.startDate
    ? parseLocalDate(event.league.startDate)
    : null,
  teamSize: String(event.nop || 3),
  numOfPhases: String(event.league?.numOfPhases || 1),
  allowPlayerSharing: !!event.league?.allowPlayerSharing,
  roundGames: event.league?.roundGames || 'Best of 5',
  rated: event.restriction === 'Rated',
  ratingLimit: String(event.ratingLimit || 1500),
  topPlayersRatingEnabled: !!event.topPlayersRatingEnabled,
  topPlayersCount: String(event.topPlayersCount || 1),
  topPlayersRatingLimit: String(event.topPlayersRatingLimit || 2500),
})

export const eventEditActions = {
  initForm: (initialData?: Partial<EventEditFormData>) => {
    const formData = { ...defaultFormData, ...initialData }
    setEventEditState({
      formData,
      initialFormData: { ...formData },
      saving: false,
      saved: false,
      error: null,
    })
  },

  fetchEventSeries: async () => {
    try {
      const series = await apiGet<string[]>('eventSeries')
      setEventEditState({ eventSeriesList: series })
    } catch {
      // Non-critical - just use empty list
      setEventEditState({ eventSeriesList: [] })
    }
  },

  loadEvent: async (eventId: string) => {
    setEventEditState({ saving: false, saved: false, error: null })
    try {
      const event = await apiGet<Event>('event', { _id: eventId })
      const formData = mapEventToFormData(event)
      setEventEditState({ formData, initialFormData: { ...formData } })
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

    if (field === 'tournamentId') {
      const updatedName = generateEventName(newFormData.tournamentId)
      if (updatedName) {
        newFormData.name = updatedName
      }
    }

    // Not every format has a schedule for every team size, and the top-N
    // dropdown can't ask for more players than a team fields.
    if (field === 'format' || field === 'teamSize') {
      const sizes = getSupportedTeamSizes(newFormData.format)
      if (!sizes.includes(newFormData.teamSize)) {
        newFormData.teamSize = sizes[sizes.length - 1]
      }
      if (Number(newFormData.topPlayersCount) > Number(newFormData.teamSize)) {
        newFormData.topPlayersCount = newFormData.teamSize
      }
    }

    // The start date has to fall on the league day of the week.
    if (field === 'dayOfWeek' && newFormData.startDate) {
      if (newFormData.startDate.getDay() !== Number(newFormData.dayOfWeek)) {
        newFormData.startDate = null
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

    setEventEditState({ saving: true, error: null })

    try {
      await apiPost('saveEvent', buildSavePayload(formData))
      setEventEditState({ saving: false, saved: true })
      setTimeout(() => {
        onSuccess?.(formData)
      }, 1500)
    } catch (err) {
      setEventEditState({
        saving: false,
        error: err instanceof Error ? err.message : 'Failed to save event',
      })
    }
  },

  hasChanges: (): boolean => {
    const { formData, initialFormData } = eventEditState
    return JSON.stringify(formData) !== JSON.stringify(initialFormData)
  },

  resetForm: () => setEventEditState(getInitialState()),

  getSelectedTournament: (): Tournament | undefined =>
    tournamentActions.getTournamentById(eventEditState.formData.tournamentId),
}

const validateForm = (formData: EventEditFormData): boolean =>
  formData.eventType === 'league'
    ? validateLeagueForm(formData)
    : !!formData.tournamentId && !!formData.date && !!formData.name.trim()

const validateLeagueForm = (formData: EventEditFormData): boolean =>
  !!formData.name.trim() &&
  !!formData.format &&
  formData.dayOfWeek !== '' &&
  !!formData.time &&
  !!formData.startDate &&
  !!formData.teamSize &&
  formData.startDate.getDay() === Number(formData.dayOfWeek)

const generateEventName = (tournamentId: string): string | null => {
  if (!tournamentId) return null
  const tournament = tournamentActions.getTournamentById(tournamentId)
  if (!tournament) return null
  return tournament.name
}

const parsePrize = (value: string): number | undefined =>
  value ? parseInt(value, 10) : undefined

const buildSavePayload = (formData: EventEditFormData) =>
  formData.eventType === 'league'
    ? buildLeaguePayload(formData)
    : buildTournamentPayload(formData)

const buildLeaguePayload = (formData: EventEditFormData) => ({
  _id: formData._id,
  eventType: 'league',
  eventSeries: formData.eventSeries || undefined,
  name: formData.name,
  format: formData.format,
  dayOfWeek: Number(formData.dayOfWeek),
  time: formData.time,
  startDate: formData.startDate
    ? formatLocalDate(formData.startDate)
    : undefined,
  teamSize: parseInt(formData.teamSize, 10),
  numOfPhases: parseInt(formData.numOfPhases, 10),
  allowPlayerSharing: formData.allowPlayerSharing,
  roundGames: formData.roundGames,
  ratingLimit: formData.rated ? parseInt(formData.ratingLimit, 10) : undefined,
  topPlayersRatingEnabled: formData.rated && formData.topPlayersRatingEnabled,
  topPlayersCount:
    formData.rated && formData.topPlayersRatingEnabled
      ? parseInt(formData.topPlayersCount, 10)
      : undefined,
  topPlayersRatingLimit:
    formData.rated && formData.topPlayersRatingEnabled
      ? parseInt(formData.topPlayersRatingLimit, 10)
      : undefined,
  maxParticipants:
    formData.maxParticipants === 'Unlimited'
      ? 0
      : parseInt(formData.maxParticipants, 10),
  registrationFee: formData.registrationFee
    ? parseInt(formData.registrationFee, 10)
    : undefined,
  prizes: {
    first: parsePrize(formData.prize1),
    second: parsePrize(formData.prize2),
    third: parsePrize(formData.prize3),
    fourth: parsePrize(formData.prize4),
  },
  handicapEnabled: formData.handicapEnabled,
  handicapDifference: parseInt(formData.handicapDifference, 10),
  handicapMaxPoints: parseInt(formData.handicapMaxPoints, 10),
})

const buildTournamentPayload = (formData: EventEditFormData) => ({
  _id: formData._id,
  eventSeries: formData.eventSeries || undefined,
  tournamentId: formData.tournamentId,
  date: formData.date ? formatLocalDate(formData.date) : undefined,
  time: formData.time || '',
  maxParticipants:
    formData.maxParticipants === 'Unlimited'
      ? 0
      : parseInt(formData.maxParticipants, 10),
  registrationFee: formData.registrationFee
    ? parseInt(formData.registrationFee, 10)
    : undefined,
  prizes: {
    first: parsePrize(formData.prize1),
    second: parsePrize(formData.prize2),
    third: parsePrize(formData.prize3),
    fourth: parsePrize(formData.prize4),
  },
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

/** "Best of 9", "Best of 5"… derived from the league's format and team size. */
export const getLeagueMatchesText = (formData: EventEditFormData): string =>
  `Best of ${getLeagueSubMatchCount(
    formData.format,
    parseInt(formData.teamSize, 10) || 3,
  )}`

export const hasGroupStage = (stages: ('group' | 'knockout')[]): boolean =>
  stages.includes('group')

export const hasKnockoutStage = (stages: ('group' | 'knockout')[]): boolean =>
  stages.includes('knockout')
