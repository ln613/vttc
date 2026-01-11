import React, { useState, useEffect } from 'react'
import { Header } from '../components/Header'
import Input from '../components/Input'
import Select from '../components/Select'
import DatePicker from '../components/DatePicker'
import SingleSelectTags from '../components/SingleSelectTags'
import Toggle from '../components/Toggle'
import Button from '../components/Button'
import { apiGet, apiPost } from '../utils/api'
import type {
  StagesType,
  QualifiersCount,
  TournamentType,
  BestOfOption,
} from '../../shared/types'

interface Tournament {
  id: string
  name: string
  type: TournamentType
  stages: ('group' | 'knockout')[]
  stagesType: StagesType
}

const GROUP_GAMES_OPTIONS: BestOfOption[] = ['Best of 3', 'Best of 5']
const KNOCKOUT_GAMES_OPTIONS: BestOfOption[] = [
  'Best of 3',
  'Best of 3 before Quarterfinal',
  'Best of 3 before Semifinal',
  'Best of 5',
]
const QUALIFIERS_OPTIONS: QualifiersCount[] = ['Top 1', 'Top 2', 'Top 3', 'All']

const generateHandicapDifferenceOptions = () => {
  const options = []
  for (let i = 100; i <= 400; i += 50) {
    options.push({ value: String(i), label: String(i) })
  }
  return options
}

const generateMaxPointsGivenOptions = () => {
  const options = []
  for (let i = 1; i <= 10; i++) {
    options.push({ value: String(i), label: String(i) })
  }
  return options
}

const HANDICAP_DIFFERENCE_OPTIONS = generateHandicapDifferenceOptions()
const MAX_POINTS_GIVEN_OPTIONS = generateMaxPointsGivenOptions()

interface EventEditFormData {
  eventId?: string
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

interface EventEditProps {
  isEdit?: boolean
  initialData?: Partial<EventEditFormData>
  onSave?: (data: EventEditFormData) => void
  onCancel?: () => void
}

const hasGroupStage = (stages: ('group' | 'knockout')[]): boolean => {
  return stages.includes('group')
}

const hasKnockoutStage = (stages: ('group' | 'knockout')[]): boolean => {
  return stages.includes('knockout')
}

const EventEdit: React.FC<EventEditProps> = ({
  isEdit = false,
  initialData,
  onSave,
  onCancel,
}) => {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const [tournamentId, setTournamentId] = useState(initialData?.tournamentId || '')
  const [date, setDate] = useState<Date | null>(initialData?.date || null)
  const [maxParticipants, setMaxParticipants] = useState(
    initialData?.maxParticipants || '',
  )
  const [name, setName] = useState(initialData?.name || '')
  const [groupGames, setGroupGames] = useState<BestOfOption>(
    initialData?.groupGames || 'Best of 3',
  )
  const [knockoutGames, setKnockoutGames] = useState<BestOfOption>(
    initialData?.knockoutGames || 'Best of 3 before Semifinal',
  )
  const [groupMatches, setGroupMatches] = useState<BestOfOption>(
    initialData?.groupMatches || 'Best of 3',
  )
  const [knockoutMatches, setKnockoutMatches] = useState<BestOfOption>(
    initialData?.knockoutMatches || 'Best of 3 before Semifinal',
  )
  const [qualifiers, setQualifiers] = useState<QualifiersCount>(
    initialData?.qualifiers || 'Top 2',
  )
  const [handicapEnabled, setHandicapEnabled] = useState(
    initialData?.handicapEnabled || false,
  )
  const [handicapDifference, setHandicapDifference] = useState(
    initialData?.handicapDifference || '200',
  )
  const [handicapMaxPoints, setHandicapMaxPoints] = useState(
    initialData?.handicapMaxPoints || '5',
  )

  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        const data = await apiGet<Tournament[]>('tournaments')
        setTournaments(data)
      } catch (error) {
        console.error('Failed to fetch tournaments:', error)
      }
    }
    fetchTournaments()
  }, [])

  useEffect(() => {
    if (tournamentId) {
      const tournament = tournaments.find((t) => t.id === tournamentId)
      setSelectedTournament(tournament || null)
    }
  }, [tournamentId, tournaments])

  useEffect(() => {
    if (selectedTournament && date) {
      const dateStr = date.toISOString().split('T')[0]
      setName(`${selectedTournament.name} - ${dateStr}`)
    }
  }, [selectedTournament, date])

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  }

  const contentStyle: React.CSSProperties = {
    padding: '24px',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '2rem',
    fontWeight: 700,
    textAlign: 'left',
    marginBottom: '24px',
    color: '#333',
  }

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 700,
    marginTop: '24px',
    marginBottom: '8px',
    color: '#333',
    textAlign: 'left',
  }

  const buttonContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '16px',
    marginTop: '24px',
  }

  const tournamentOptions = tournaments.map((t) => ({
    value: t.id,
    label: t.name,
  }))

  const validateForm = (): boolean => {
    return !!tournamentId && !!date && !!name.trim()
  }

  const handleSave = async () => {
    if (!validateForm()) {
      return
    }

    const data: EventEditFormData = {
      eventId: initialData?.eventId,
      tournamentId,
      date,
      maxParticipants,
      name,
      groupGames,
      knockoutGames,
      groupMatches,
      knockoutMatches,
      qualifiers,
      handicapEnabled,
      handicapDifference,
      handicapMaxPoints,
    }

    try {
      await apiPost('saveEvent', {
        eventId: data.eventId,
        tournamentId: data.tournamentId,
        date: data.date?.toISOString().split('T')[0],
        maxParticipants: data.maxParticipants ? parseInt(data.maxParticipants, 10) : 0,
        name: data.name,
        groupGames: data.groupGames,
        knockoutGames: data.knockoutGames,
        groupMatches: data.groupMatches,
        knockoutMatches: data.knockoutMatches,
        qualifiers: data.qualifiers,
      })
      onSave?.(data)
    } catch (error) {
      console.error('Failed to save event:', error)
    }
  }

  const handleCancel = () => {
    onCancel?.()
  }

  const renderNumberOfGamesSection = () => {
    if (!selectedTournament) return null

    return (
      <>
        <h3 style={sectionTitleStyle}>Number of Games</h3>
        {hasGroupStage(selectedTournament.stages) && (
          <SingleSelectTags
            label="Group Stage"
            options={GROUP_GAMES_OPTIONS}
            selectedValue={groupGames}
            onChange={(value) => setGroupGames(value as BestOfOption)}
          />
        )}
        {hasKnockoutStage(selectedTournament.stages) && (
          <SingleSelectTags
            label="Knockout Stage"
            options={KNOCKOUT_GAMES_OPTIONS}
            selectedValue={knockoutGames}
            onChange={(value) => setKnockoutGames(value as BestOfOption)}
          />
        )}
      </>
    )
  }

  const renderNumberOfMatchesSection = () => {
    if (!selectedTournament || selectedTournament.type !== 'Team') return null

    return (
      <>
        <h3 style={sectionTitleStyle}>Number of Matches</h3>
        {hasGroupStage(selectedTournament.stages) && (
          <SingleSelectTags
            label="Group Stage"
            options={GROUP_GAMES_OPTIONS}
            selectedValue={groupMatches}
            onChange={(value) => setGroupMatches(value as BestOfOption)}
          />
        )}
        {hasKnockoutStage(selectedTournament.stages) && (
          <SingleSelectTags
            label="Knockout Stage"
            options={KNOCKOUT_GAMES_OPTIONS}
            selectedValue={knockoutMatches}
            onChange={(value) => setKnockoutMatches(value as BestOfOption)}
          />
        )}
      </>
    )
  }

  const renderQualifiersSection = () => {
    if (!selectedTournament || !hasGroupStage(selectedTournament.stages)) return null

    return (
      <SingleSelectTags
        label="Number of Qualifiers"
        options={QUALIFIERS_OPTIONS}
        selectedValue={qualifiers}
        onChange={(value) => setQualifiers(value as QualifiersCount)}
      />
    )
  }

  const renderHandicapSection = () => (
    <>
      <h3 style={sectionTitleStyle}>Handicap</h3>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}
      >
        <Toggle
          label=""
          value={handicapEnabled}
          onChange={setHandicapEnabled}
          noMargin
        />
        {handicapEnabled && (
          <>
            <span style={{ fontWeight: 500 }}>Difference:</span>
            <Select
              label=""
              name="handicapDifference"
              value={handicapDifference}
              onChange={setHandicapDifference}
              options={HANDICAP_DIFFERENCE_OPTIONS}
              noMargin
            />
            <span style={{ fontWeight: 500 }}>Max Points Given:</span>
            <Select
              label=""
              name="handicapMaxPoints"
              value={handicapMaxPoints}
              onChange={setHandicapMaxPoints}
              options={MAX_POINTS_GIVEN_OPTIONS}
              noMargin
            />
          </>
        )}
      </div>
    </>
  )

  return (
    <div style={containerStyle}>
      <Header />
      <div style={contentStyle}>
        <h1 style={titleStyle}>{isEdit ? 'Edit Event' : 'Add Event'}</h1>
        <Select
          label="Tournament"
          name="tournament"
          value={tournamentId}
          onChange={setTournamentId}
          options={[{ value: '', label: 'Select a tournament' }, ...tournamentOptions]}
        />
        <DatePicker label="Date" value={date} onChange={setDate} />
        <Input
          label="Name"
          name="name"
          value={name}
          onChange={setName}
          required
        />
        <Input
          label="Max Participants"
          name="maxParticipants"
          value={maxParticipants}
          onChange={setMaxParticipants}
          placeholder="Leave empty for unlimited"
        />
        {renderNumberOfMatchesSection()}
        {renderNumberOfGamesSection()}
        {renderQualifiersSection()}
        {renderHandicapSection()}
        <div style={buttonContainerStyle}>
          <Button color="#e74c3c" onClick={handleCancel}>
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

export default EventEdit
