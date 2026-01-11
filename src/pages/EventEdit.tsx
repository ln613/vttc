import React, { useEffect } from 'react'
import { Header } from '../components/Header'
import Input from '../components/Input'
import Select from '../components/Select'
import DatePicker from '../components/DatePicker'
import SingleSelectTags from '../components/SingleSelectTags'
import Toggle from '../components/Toggle'
import Button from '../components/Button'
import {
  useTournamentStore,
  tournamentActions,
} from '../stores/tournamentStore'
import {
  useEventEditStore,
  eventEditActions,
  hasGroupStage,
  hasKnockoutStage,
  type EventEditFormData,
} from '../stores/eventEditStore'
import type { BestOfOption, QualifiersCount } from '../../shared/types'

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

const generateMaxParticipantsOptions = () => {
  const options = [{ value: 'Unlimited', label: 'Unlimited' }]
  for (let i = 4; i <= 128; i++) {
    options.push({ value: String(i), label: String(i) })
  }
  return options
}

const HANDICAP_DIFFERENCE_OPTIONS = generateHandicapDifferenceOptions()
const MAX_POINTS_GIVEN_OPTIONS = generateMaxPointsGivenOptions()
const MAX_PARTICIPANTS_OPTIONS = generateMaxParticipantsOptions()

interface EventEditProps {
  isEdit?: boolean
  initialData?: Partial<EventEditFormData>
  onSave?: (data: EventEditFormData) => void
  onCancel?: () => void
}

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

const EventEdit: React.FC<EventEditProps> = ({
  isEdit = false,
  initialData,
  onSave,
  onCancel,
}) => {
  const { data: tournaments } = useTournamentStore()
  const { formData } = useEventEditStore()
  const selectedTournament = eventEditActions.getSelectedTournament()

  useEffect(() => {
    tournamentActions.fetchTournaments()
    eventEditActions.initForm(initialData)
    return () => eventEditActions.resetForm()
  }, [])

  const tournamentOptions = (tournaments || []).map((t) => ({
    value: t.id,
    label: t.name,
  }))

  return (
    <div style={containerStyle}>
      <Header />
      <div style={contentStyle}>
        <h1 style={titleStyle}>{isEdit ? 'Edit Event' : 'Add Event'}</h1>
        <Select
          label="Tournament"
          name="tournament"
          value={formData.tournamentId}
          onChange={(value) => eventEditActions.setField('tournamentId', value)}
          options={tournamentOptions}
        />
        <DatePicker
          label="Date"
          value={formData.date}
          onChange={(value) => eventEditActions.setField('date', value)}
        />
        <Input
          label="Name"
          name="name"
          value={formData.name}
          onChange={(value) => eventEditActions.setField('name', value)}
          required
        />
        <Select
          label="Max Participants"
          name="maxParticipants"
          value={formData.maxParticipants}
          onChange={(value) =>
            eventEditActions.setField('maxParticipants', value)
          }
          options={MAX_PARTICIPANTS_OPTIONS}
        />
        <NumberOfMatchesSection
          tournament={selectedTournament}
          groupMatches={formData.groupMatches}
          knockoutMatches={formData.knockoutMatches}
        />
        <NumberOfGamesSection
          tournament={selectedTournament}
          groupGames={formData.groupGames}
          knockoutGames={formData.knockoutGames}
        />
        <QualifiersSection
          tournament={selectedTournament}
          qualifiers={formData.qualifiers}
        />
        <HandicapSection
          handicapEnabled={formData.handicapEnabled}
          handicapDifference={formData.handicapDifference}
          handicapMaxPoints={formData.handicapMaxPoints}
        />
        <div style={buttonContainerStyle}>
          <Button color="#e74c3c" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            color="#27ae60"
            onClick={() => eventEditActions.saveEvent(onSave)}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

interface Tournament {
  id: string
  name: string
  type: string
  stages: ('group' | 'knockout')[]
}

interface NumberOfGamesSectionProps {
  tournament: Tournament | undefined
  groupGames: BestOfOption
  knockoutGames: BestOfOption
}

const NumberOfGamesSection: React.FC<NumberOfGamesSectionProps> = ({
  tournament,
  groupGames,
  knockoutGames,
}) => {
  if (!tournament) return null

  return (
    <>
      <h3 style={sectionTitleStyle}>Number of Games</h3>
      {hasGroupStage(tournament.stages) && (
        <SingleSelectTags
          label="Group Stage"
          options={GROUP_GAMES_OPTIONS}
          selectedValue={groupGames}
          onChange={(value) =>
            eventEditActions.setField('groupGames', value as BestOfOption)
          }
        />
      )}
      {hasKnockoutStage(tournament.stages) && (
        <SingleSelectTags
          label="Knockout Stage"
          options={KNOCKOUT_GAMES_OPTIONS}
          selectedValue={knockoutGames}
          onChange={(value) =>
            eventEditActions.setField('knockoutGames', value as BestOfOption)
          }
        />
      )}
    </>
  )
}

interface NumberOfMatchesSectionProps {
  tournament: Tournament | undefined
  groupMatches: BestOfOption
  knockoutMatches: BestOfOption
}

const NumberOfMatchesSection: React.FC<NumberOfMatchesSectionProps> = ({
  tournament,
  groupMatches,
  knockoutMatches,
}) => {
  if (!tournament || tournament.type !== 'Team') return null

  return (
    <>
      <h3 style={sectionTitleStyle}>Number of Matches</h3>
      {hasGroupStage(tournament.stages) && (
        <SingleSelectTags
          label="Group Stage"
          options={GROUP_GAMES_OPTIONS}
          selectedValue={groupMatches}
          onChange={(value) =>
            eventEditActions.setField('groupMatches', value as BestOfOption)
          }
        />
      )}
      {hasKnockoutStage(tournament.stages) && (
        <SingleSelectTags
          label="Knockout Stage"
          options={KNOCKOUT_GAMES_OPTIONS}
          selectedValue={knockoutMatches}
          onChange={(value) =>
            eventEditActions.setField('knockoutMatches', value as BestOfOption)
          }
        />
      )}
    </>
  )
}

interface QualifiersSectionProps {
  tournament: Tournament | undefined
  qualifiers: QualifiersCount
}

const QualifiersSection: React.FC<QualifiersSectionProps> = ({
  tournament,
  qualifiers,
}) => {
  if (!tournament || !hasGroupStage(tournament.stages)) return null

  return (
    <SingleSelectTags
      label="Number of Qualifiers"
      options={QUALIFIERS_OPTIONS}
      selectedValue={qualifiers}
      onChange={(value) =>
        eventEditActions.setField('qualifiers', value as QualifiersCount)
      }
    />
  )
}

interface HandicapSectionProps {
  handicapEnabled: boolean
  handicapDifference: string
  handicapMaxPoints: string
}

const HandicapSection: React.FC<HandicapSectionProps> = ({
  handicapEnabled,
  handicapDifference,
  handicapMaxPoints,
}) => (
  <>
    <h3 style={sectionTitleStyle}>Handicap</h3>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px',
      }}
    >
      <Toggle
        label=""
        value={handicapEnabled}
        onChange={(value) => eventEditActions.setField('handicapEnabled', value)}
        noMargin
      />
      {handicapEnabled && (
        <>
          <span style={{ fontWeight: 500 }}>Difference:</span>
          <Select
            label=""
            name="handicapDifference"
            value={handicapDifference}
            onChange={(value) =>
              eventEditActions.setField('handicapDifference', value)
            }
            options={HANDICAP_DIFFERENCE_OPTIONS}
            noMargin
          />
          <span style={{ fontWeight: 500 }}>Max Points Given:</span>
          <Select
            label=""
            name="handicapMaxPoints"
            value={handicapMaxPoints}
            onChange={(value) =>
              eventEditActions.setField('handicapMaxPoints', value)
            }
            options={MAX_POINTS_GIVEN_OPTIONS}
            noMargin
          />
        </>
      )}
    </div>
  </>
)

export default EventEdit
