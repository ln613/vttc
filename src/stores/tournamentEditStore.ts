import { createStore } from 'solid-js/store'
import type {
  ParticipantSex,
  TournamentType,
  TournamentRestriction,
  StagesType,
  AgeLimitType,
} from '../../shared/types'
import { apiPost } from '../utils/api'
import { tournamentActions } from './tournamentStore'
import {
  FRENCH_LEAGUE,
  FRENCH_LEAGUE_TEAM_SIZE,
  isFrenchLeagueTournament,
} from '../../shared/rules/frenchLeague'

/**
 * The Type choices on the form. French League is a Team tournament with its
 * own format, stored as type Team + teamFormat, but picked as a type of its
 * own.
 */
export type TournamentTypeOption = TournamentType | typeof FRENCH_LEAGUE

export const TOURNAMENT_TYPE_OPTIONS: TournamentTypeOption[] = [
  'Single',
  'Double',
  'Team',
  FRENCH_LEAGUE,
]

export const isTeamOption = (type: TournamentTypeOption) =>
  type === 'Team' || type === FRENCH_LEAGUE

export interface TournamentEditFormData {
  _id?: string
  name: string
  sex: ParticipantSex
  type: TournamentTypeOption
  teamSize: string | null
  restriction: TournamentRestriction
  ratingLimit: string
  topPlayersRatingEnabled: boolean
  topPlayersCount: string
  topPlayersRatingLimit: string
  ageLimitType: AgeLimitType
  ageLimit: string
  stages: StagesType
}

interface TournamentEditState {
  formData: TournamentEditFormData
  saving: boolean
  error: string | null
}

const defaultFormData: TournamentEditFormData = {
  name: '',
  sex: 'All',
  type: 'Single',
  teamSize: null,
  restriction: 'Open',
  ratingLimit: '1500',
  topPlayersRatingEnabled: false,
  topPlayersCount: '2',
  topPlayersRatingLimit: '2500',
  ageLimitType: 'U',
  ageLimit: '20',
  stages: 'Group + Knockout',
}

const getInitialState = (): TournamentEditState => ({
  formData: { ...defaultFormData },
  saving: false,
  error: null,
})

const [tournamentEditState, setTournamentEditState] =
  createStore<TournamentEditState>(getInitialState())

export { tournamentEditState }

export const tournamentEditActions = {
  initForm: (
    initialData?: Partial<TournamentEditFormData> & { teamFormat?: string },
  ) => {
    setTournamentEditState({
      formData: { ...defaultFormData, ...withTypeOption(initialData) },
      saving: false,
      error: null,
    })
  },

  setField: <K extends keyof TournamentEditFormData>(
    field: K,
    value: TournamentEditFormData[K],
  ) => {
    const newFormData = { ...tournamentEditState.formData, [field]: value }

    if (field === 'type') {
      handleTypeChange(newFormData, value as TournamentTypeOption)
    }

    if (field === 'teamSize') {
      handleTeamSizeChange(newFormData, value as string)
    }

    setTournamentEditState({ formData: newFormData })
  },

  saveTournament: async (onSuccess?: (data: TournamentEditFormData) => void) => {
    const { formData } = tournamentEditState

    if (!validateForm(formData)) {
      setTournamentEditState({ error: 'Please fill all required fields' })
      return
    }

    setTournamentEditState({ saving: true, error: null })

    try {
      const payload = buildSavePayload(formData)
      await apiPost('saveTournament', payload)
      // The tournament list is fetched once and kept; drop it so Add Event
      // fetches it again and offers the one just saved.
      tournamentActions.reset()
      setTournamentEditState({ saving: false })
      onSuccess?.(formData)
    } catch (err) {
      setTournamentEditState({
        saving: false,
        error: err instanceof Error ? err.message : 'Failed to save tournament',
      })
    }
  },

  resetForm: () => setTournamentEditState(getInitialState()),
}

// A saved French League comes back as type Team + teamFormat; show it as the
// French League choice.
const withTypeOption = (
  data?: Partial<TournamentEditFormData> & { teamFormat?: string },
) =>
  data && isFrenchLeagueTournament(data)
    ? { ...data, type: FRENCH_LEAGUE as TournamentTypeOption }
    : data

const handleTypeChange = (
  formData: TournamentEditFormData,
  newType: TournamentTypeOption,
) => {
  if (newType === FRENCH_LEAGUE) {
    formData.teamSize = String(FRENCH_LEAGUE_TEAM_SIZE)
  }
  if (newType === 'Team' && !formData.teamSize) {
    formData.teamSize = '3'
  }
  if (!isTeamOption(newType)) {
    formData.teamSize = null
  }
}

const handleTeamSizeChange = (
  formData: TournamentEditFormData,
  newTeamSize: string,
) => {
  const newTeamSizeNum = parseInt(newTeamSize, 10)
  const currentTopPlayersCount = parseInt(formData.topPlayersCount, 10)
  if (currentTopPlayersCount > newTeamSizeNum) {
    formData.topPlayersCount = newTeamSize
  }
}

const validateForm = (formData: TournamentEditFormData): boolean =>
  !!formData.name.trim()

const buildSavePayload = (formData: TournamentEditFormData) => {
  const isRated = formData.restriction === 'Rated'
  const isAge = formData.restriction === 'Age'
  const isTeam = isTeamOption(formData.type)
  const isFrenchLeague = formData.type === FRENCH_LEAGUE
  const hasTopPlayersRating = isRated && isTeam && formData.topPlayersRatingEnabled

  return {
    _id: formData._id,
    name: formData.name,
    sex: formData.sex,
    type: isTeam ? 'Team' : formData.type,
    teamFormat: isFrenchLeague ? FRENCH_LEAGUE : undefined,
    teamSize: isFrenchLeague
      ? FRENCH_LEAGUE_TEAM_SIZE
      : isTeam
        ? parseInt(formData.teamSize!, 10)
        : undefined,
    restriction: formData.restriction,
    ratingLimit: isRated ? parseInt(formData.ratingLimit, 10) : undefined,
    topPlayersRatingEnabled: hasTopPlayersRating,
    topPlayersCount: hasTopPlayersRating
      ? parseInt(formData.topPlayersCount, 10)
      : undefined,
    topPlayersRatingLimit: hasTopPlayersRating
      ? parseInt(formData.topPlayersRatingLimit, 10)
      : undefined,
    ageLimitType: isAge ? formData.ageLimitType : undefined,
    ageLimit: isAge ? parseInt(formData.ageLimit, 10) : undefined,
    stages: formData.stages,
  }
}

export const generateTopPlayersCountOptions = (teamSize: string | null) => {
  const options = []
  const maxCount = teamSize ? parseInt(teamSize, 10) : 3
  for (let i = 1; i <= maxCount; i++) {
    options.push({ value: String(i), label: String(i) })
  }
  return options
}
