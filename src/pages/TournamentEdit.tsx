import React, { useState } from 'react'
import { Header } from '../components/Header'
import Input from '../components/Input'
import SingleSelectTags from '../components/SingleSelectTags'
import Select from '../components/Select'
import DatePicker from '../components/DatePicker'
import MediaUpload from '../components/MediaUpload'
import Button from '../components/Button'
import Toggle from '../components/Toggle'
import type {
  ParticipantSex,
  TournamentType,
  TournamentRestriction,
  StagesType,
  QualifiersCount,
  AgeLimitType,
} from '../../shared/types'

const SEX_OPTIONS: ParticipantSex[] = ['All', 'Man', 'Woman', 'Mixed']
const TYPE_OPTIONS: TournamentType[] = ['Single', 'Double', 'Team']
const TEAM_SIZE_OPTIONS = ['2', '3', '4']
const RESTRICTION_OPTIONS: TournamentRestriction[] = ['Open', 'Rated', 'Age']
const STAGES_OPTIONS: StagesType[] = [
  'Group + Knockout',
  'Group Only (Big Round Robin)',
  'Knockout Only',
]
const GROUP_GAMES_OPTIONS = ['Best of 3', 'Best of 5']
const KNOCKOUT_GAMES_OPTIONS = [
  'Best of 3',
  'Best of 3 before Quarterfinal',
  'Best of 3 before Semifinal',
  'Best of 5',
]
const QUALIFIERS_OPTIONS: QualifiersCount[] = ['Top 1', 'Top 2', 'Top 3', 'All']
const AGE_LIMIT_TYPE_OPTIONS: AgeLimitType[] = ['U', 'O']

const generateRatingOptions = () => {
  const options = []
  for (let i = 100; i <= 3000; i += 50) {
    options.push({ value: String(i), label: String(i) })
  }
  return options
}

const generateAgeOptions = () => {
  const options = []
  for (let i = 10; i <= 80; i++) {
    options.push({ value: String(i), label: String(i) })
  }
  return options
}

const generateTopPlayersCountOptions = () => {
  const options = []
  for (let i = 1; i <= 5; i++) {
    options.push({ value: String(i), label: String(i) })
  }
  return options
}

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

const RATING_OPTIONS = generateRatingOptions()
const AGE_OPTIONS = generateAgeOptions()
const TOP_PLAYERS_COUNT_OPTIONS = generateTopPlayersCountOptions()
const HANDICAP_DIFFERENCE_OPTIONS = generateHandicapDifferenceOptions()
const MAX_POINTS_GIVEN_OPTIONS = generateMaxPointsGivenOptions()

interface TournamentEditFormData {
  name: string
  sex: ParticipantSex
  type: TournamentType
  teamSize: string | null
  restriction: TournamentRestriction
  ratingLimit: string
  topPlayersCount: string
  topPlayersRatingLimit: string
  ageLimitType: AgeLimitType
  ageLimit: string
  stages: StagesType
  groupGames: string
  knockoutGames: string
  groupMatches: string
  knockoutMatches: string
  qualifiers: QualifiersCount
  handicapEnabled: boolean
  handicapDifference: string
  handicapMaxPoints: string
  date: Date | null
  cover: File | string | null
}

interface TournamentEditProps {
  isEdit?: boolean
  initialData?: Partial<TournamentEditFormData>
  onSave?: (data: TournamentEditFormData) => void
  onCancel?: () => void
}

const hasGroupStage = (stages: StagesType): boolean => {
  return stages === 'Group + Knockout' || stages === 'Group Only (Big Round Robin)'
}

const hasKnockoutStage = (stages: StagesType): boolean => {
  return stages === 'Group + Knockout' || stages === 'Knockout Only'
}

const TournamentEdit: React.FC<TournamentEditProps> = ({
  isEdit = false,
  initialData,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(initialData?.name || '')
  const [sex, setSex] = useState<ParticipantSex>(initialData?.sex || 'All')
  const [type, setType] = useState<TournamentType>(initialData?.type || 'Single')
  const [teamSize, setTeamSize] = useState<string | null>(
    initialData?.teamSize || null,
  )
  const [restriction, setRestriction] = useState<TournamentRestriction>(
    initialData?.restriction || 'Open',
  )
  const [ratingLimit, setRatingLimit] = useState(
    initialData?.ratingLimit || '1500',
  )
  const [topPlayersCount, setTopPlayersCount] = useState(
    initialData?.topPlayersCount || '2',
  )
  const [topPlayersRatingLimit, setTopPlayersRatingLimit] = useState(
    initialData?.topPlayersRatingLimit || '2500',
  )
  const [ageLimitType, setAgeLimitType] = useState<AgeLimitType>(
    initialData?.ageLimitType || 'U',
  )
  const [ageLimit, setAgeLimit] = useState(initialData?.ageLimit || '20')
  const [stages, setStages] = useState<StagesType>(
    initialData?.stages || 'Group + Knockout',
  )
  const [groupGames, setGroupGames] = useState(
    initialData?.groupGames || 'Best of 3',
  )
  const [knockoutGames, setKnockoutGames] = useState(
    initialData?.knockoutGames || 'Best of 3 before Semifinal',
  )
  const [groupMatches, setGroupMatches] = useState(
    initialData?.groupMatches || 'Best of 3',
  )
  const [knockoutMatches, setKnockoutMatches] = useState(
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
  const [date, setDate] = useState<Date | null>(initialData?.date || null)
  const [cover, setCover] = useState<File | string | null>(
    initialData?.cover || null,
  )

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  }

  const contentStyle: React.CSSProperties = {
    padding: '24px',
    maxWidth: '600px',
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

  const inlineRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '12px',
    marginBottom: '16px',
  }

  const validateForm = (): boolean => {
    return !!name.trim()
  }

  const handleSave = () => {
    if (!validateForm()) {
      return
    }
    onSave?.({
      name,
      sex,
      type,
      teamSize: type === 'Team' ? teamSize : null,
      restriction,
      ratingLimit: restriction === 'Rated' ? ratingLimit : '1500',
      topPlayersCount:
        restriction === 'Rated' && type === 'Team' ? topPlayersCount : '2',
      topPlayersRatingLimit:
        restriction === 'Rated' && type === 'Team' ? topPlayersRatingLimit : '2500',
      ageLimitType: restriction === 'Age' ? ageLimitType : 'U',
      ageLimit: restriction === 'Age' ? ageLimit : '20',
      stages,
      groupGames: hasGroupStage(stages) ? groupGames : 'Best of 3',
      knockoutGames: hasKnockoutStage(stages) ? knockoutGames : 'Best of 3 before Semifinal',
      groupMatches: type === 'Team' && hasGroupStage(stages) ? groupMatches : 'Best of 3',
      knockoutMatches:
        type === 'Team' && hasKnockoutStage(stages)
          ? knockoutMatches
          : 'Best of 3 before Semifinal',
      qualifiers: hasGroupStage(stages) ? qualifiers : 'Top 2',
      handicapEnabled,
      handicapDifference: handicapEnabled ? handicapDifference : '200',
      handicapMaxPoints: handicapEnabled ? handicapMaxPoints : '5',
      date,
      cover,
    })
  }

  const handleCancel = () => {
    onCancel?.()
  }

  const renderRatingSection = () => {
    if (restriction !== 'Rated') return null

    return (
      <>
        <div style={inlineRowStyle}>
          <span style={{ fontWeight: 500, marginBottom: '8px' }}>Rating: Under</span>
          <Select
            label=""
            name="ratingLimit"
            value={ratingLimit}
            onChange={setRatingLimit}
            options={RATING_OPTIONS}
          />
        </div>
        {type === 'Team' && (
          <div style={inlineRowStyle}>
            <span style={{ fontWeight: 500, marginBottom: '8px' }}>
              The combined rating of the top
            </span>
            <Select
              label=""
              name="topPlayersCount"
              value={topPlayersCount}
              onChange={setTopPlayersCount}
              options={TOP_PLAYERS_COUNT_OPTIONS}
            />
            <span style={{ fontWeight: 500, marginBottom: '8px' }}>
              players must be under
            </span>
            <Select
              label=""
              name="topPlayersRatingLimit"
              value={topPlayersRatingLimit}
              onChange={setTopPlayersRatingLimit}
              options={RATING_OPTIONS}
            />
          </div>
        )}
      </>
    )
  }

  const renderAgeSection = () => {
    if (restriction !== 'Age') return null

    return (
      <div style={inlineRowStyle}>
        <SingleSelectTags
          label="Age"
          options={['Under', 'Over']}
          selectedValue={ageLimitType === 'U' ? 'Under' : 'Over'}
          onChange={(value) => setAgeLimitType(value === 'Under' ? 'U' : 'O')}
        />
        <Select
          label=""
          name="ageLimit"
          value={ageLimit}
          onChange={setAgeLimit}
          options={AGE_OPTIONS}
        />
      </div>
    )
  }

  const renderStagesSection = () => (
    <SingleSelectTags
      label="Stages"
      options={STAGES_OPTIONS}
      selectedValue={stages}
      onChange={(value) => setStages(value as StagesType)}
    />
  )

  const renderNumberOfGamesSection = () => (
    <>
      <h3 style={sectionTitleStyle}>Number of Games</h3>
      {hasGroupStage(stages) && (
        <SingleSelectTags
          label="Group Stage"
          options={GROUP_GAMES_OPTIONS}
          selectedValue={groupGames}
          onChange={setGroupGames}
        />
      )}
      {hasKnockoutStage(stages) && (
        <SingleSelectTags
          label="Knockout Stage"
          options={KNOCKOUT_GAMES_OPTIONS}
          selectedValue={knockoutGames}
          onChange={setKnockoutGames}
        />
      )}
    </>
  )

  const renderNumberOfMatchesSection = () => {
    if (type !== 'Team') return null

    return (
      <>
        <h3 style={sectionTitleStyle}>Number of Matches</h3>
        {hasGroupStage(stages) && (
          <SingleSelectTags
            label="Group Stage"
            options={GROUP_GAMES_OPTIONS}
            selectedValue={groupMatches}
            onChange={setGroupMatches}
          />
        )}
        {hasKnockoutStage(stages) && (
          <SingleSelectTags
            label="Knockout Stage"
            options={KNOCKOUT_GAMES_OPTIONS}
            selectedValue={knockoutMatches}
            onChange={setKnockoutMatches}
          />
        )}
      </>
    )
  }

  const renderQualifiersSection = () => {
    if (!hasGroupStage(stages)) return null

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
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
        <h1 style={titleStyle}>
          {isEdit ? 'Edit Tournament' : 'Add Tournament'}
        </h1>
        <Input
          label="Name"
          name="name"
          value={name}
          onChange={setName}
          required
        />
        <SingleSelectTags
          label="Sex"
          options={SEX_OPTIONS}
          selectedValue={sex}
          onChange={(value) => setSex(value as ParticipantSex)}
        />
        <SingleSelectTags
          label="Type"
          options={TYPE_OPTIONS}
          selectedValue={type}
          onChange={(value) => {
            const newType = value as TournamentType
            setType(newType)
            if (newType === 'Team' && !teamSize) {
              setTeamSize('3')
            }
            if (newType !== 'Team') {
              setTeamSize(null)
            }
          }}
        />
        {type === 'Team' && (
          <SingleSelectTags
            label="Team Size"
            options={TEAM_SIZE_OPTIONS}
            selectedValue={teamSize || '3'}
            onChange={setTeamSize}
          />
        )}
        <SingleSelectTags
          label="Restriction"
          options={RESTRICTION_OPTIONS}
          selectedValue={restriction}
          onChange={(value) => setRestriction(value as TournamentRestriction)}
        />
        {renderRatingSection()}
        {renderAgeSection()}
        {renderStagesSection()}
        {renderNumberOfMatchesSection()}
        {renderNumberOfGamesSection()}
        {renderQualifiersSection()}
        {renderHandicapSection()}
        <DatePicker label="Date" value={date} onChange={setDate} />
        <MediaUpload label="Cover" value={cover} onChange={setCover} />
        <div style={buttonContainerStyle}>
          <Button color="#e74c3c" onClick={handleCancel}>
            Cancel
          </Button>
          <Button color="#3498db" onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

export default TournamentEdit
