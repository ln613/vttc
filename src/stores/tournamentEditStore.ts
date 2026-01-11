import type {
  ParticipantSex,
  TournamentType,
  TournamentRestriction,
  StagesType,
  AgeLimitType,
} from '../../shared/types'
import { apiPost } from '../utils/api'
import { createStore } from './createStore'

export interface TournamentEditFormData {
  id?: string
  name: string
  sex: ParticipantSex
  type: TournamentType
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

const tournamentEditStore = createStore<TournamentEditState>({
  formData: { ...defaultFormData },
  saving: false,
  error: null,
})

export const {
  useStore: useTournamentEditStore,
  useSelector: useTournamentEditSelector,
} = tournamentEditStore

export const tournamentEditActions = {
  initForm: (initialData?: Partial<TournamentEditFormData>) => {
    tournamentEditStore.setState({
      formData: { ...defaultFormData, ...initialData },
      saving: false,
      error: null,
    })
  },

  setField: <K extends keyof TournamentEditFormData>(
    field: K,
    value: TournamentEditFormData[K],
  ) => {
    const { formData } = tournamentEditStore.getState()
    const newFormData = { ...formData, [field]: value }

    if (field === 'type') {
      handleTypeChange(newFormData, value as TournamentType)
    }

    if (field === 'teamSize') {
      handleTeamSizeChange(newFormData, value as string)
    }

    tournamentEditStore.setState({ formData: newFormData })
  },

  saveTournament: async (onSuccess?: (data: TournamentEditFormData) => void) => {
    const { formData } = tournamentEditStore.getState()

    if (!validateForm(formData)) {
      tournamentEditStore.setState({ error: 'Please fill all required fields' })
      return
    }

    const confirmed = window.confirm('Are you sure you want to save this tournament?')
    if (!confirmed) return

    tournamentEditStore.setState({ saving: true, error: null })

    try {
      const payload = buildSavePayload(formData)
      await apiPost('saveTournament', payload)
      tournamentEditStore.setState({ saving: false })
      onSuccess?.(formData)
    } catch (err) {
      tournamentEditStore.setState({
        saving: false,
        error: err instanceof Error ? err.message : 'Failed to save tournament',
      })
    }
  },

  resetForm: () => {
    tournamentEditStore.setState({
      formData: { ...defaultFormData },
      saving: false,
      error: null,
    })
  },
}

const handleTypeChange = (
  formData: TournamentEditFormData,
  newType: TournamentType,
) => {
  if (newType === 'Team' && !formData.teamSize) {
    formData.teamSize = '3'
  }
  if (newType !== 'Team') {
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

const validateForm = (formData: TournamentEditFormData): boolean => {
  return !!formData.name.trim()
}

const buildSavePayload = (formData: TournamentEditFormData) => {
  const isRated = formData.restriction === 'Rated'
  const isAge = formData.restriction === 'Age'
  const isTeam = formData.type === 'Team'
  const hasTopPlayersRating = isRated && isTeam && formData.topPlayersRatingEnabled

  return {
    id: formData.id,
    name: formData.name,
    sex: formData.sex,
    type: formData.type,
    teamSize: isTeam ? parseInt(formData.teamSize!, 10) : undefined,
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
