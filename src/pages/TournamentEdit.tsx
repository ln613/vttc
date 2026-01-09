import React, { useState } from 'react'
import { Header } from '../components/Header'
import Input from '../components/Input'
import SingleSelectTags from '../components/SingleSelectTags'
import Select from '../components/Select'
import DatePicker from '../components/DatePicker'
import MediaUpload from '../components/MediaUpload'
import Button from '../components/Button'

interface TournamentEditProps {
  isEdit?: boolean
  initialData?: {
    name: string
    type: string
    singleFormat: string | null
    ratingType: string | null
    ratingValue: string | null
    ageType: string | null
    ageValue: string | null
    stages: string | null
    teamSize: string | null
    groupGames: string | null
    knockoutGames: string | null
    numberOfMatches: string | null
    date: Date | null
    cover: File | string | null
  }
  onSave?: (data: {
    name: string
    type: string
    singleFormat: string | null
    ratingType: string | null
    ratingValue: string | null
    ageType: string | null
    ageValue: string | null
    stages: string | null
    teamSize: string | null
    groupGames: string | null
    knockoutGames: string | null
    numberOfMatches: string | null
    date: Date | null
    cover: File | string | null
  }) => void
  onCancel?: () => void
}

const SINGLE_FORMAT_OPTIONS = ['Open Single', 'Rated Single', 'Age Single']
const STAGES_OPTIONS = [
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

const RATING_OPTIONS = generateRatingOptions()
const AGE_OPTIONS = generateAgeOptions()

const hasGroupStage = (stages: string | null): boolean => {
  return (
    stages === 'Group + Knockout' || stages === 'Group Only (Big Round Robin)'
  )
}

const hasKnockoutStage = (stages: string | null): boolean => {
  return stages === 'Group + Knockout' || stages === 'Knockout Only'
}

const TournamentEdit: React.FC<TournamentEditProps> = ({
  isEdit = false,
  initialData,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(initialData?.name || '')
  const [type, setType] = useState(initialData?.type || 'Single')
  const [singleFormat, setSingleFormat] = useState<string | null>(
    initialData?.singleFormat || 'Open Single',
  )
  const [ratingType, setRatingType] = useState<string | null>(
    initialData?.ratingType || 'Under',
  )
  const [ratingValue, setRatingValue] = useState<string | null>(
    initialData?.ratingValue || '1500',
  )
  const [ageType, setAgeType] = useState<string | null>(
    initialData?.ageType || 'Under',
  )
  const [ageValue, setAgeValue] = useState<string | null>(
    initialData?.ageValue || '18',
  )
  const [stages, setStages] = useState<string | null>(
    initialData?.stages || 'Group + Knockout',
  )
  const [teamSize, setTeamSize] = useState<string | null>(
    initialData?.teamSize || null,
  )
  const [groupGames, setGroupGames] = useState<string | null>(
    initialData?.groupGames || 'Best of 3',
  )
  const [knockoutGames, setKnockoutGames] = useState<string | null>(
    initialData?.knockoutGames || 'Best of 3 before Semifinal',
  )
  const [numberOfMatches, setNumberOfMatches] = useState<string | null>(
    initialData?.numberOfMatches || 'Best of 3',
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
    if (!name.trim()) {
      return false
    }
    return true
  }

  const handleSave = () => {
    if (!validateForm()) {
      return
    }
    onSave?.({
      name,
      type,
      singleFormat: type === 'Single' ? singleFormat : null,
      ratingType: singleFormat === 'Rated Single' ? ratingType : null,
      ratingValue: singleFormat === 'Rated Single' ? ratingValue : null,
      ageType: singleFormat === 'Age Single' ? ageType : null,
      ageValue: singleFormat === 'Age Single' ? ageValue : null,
      stages,
      teamSize: type === 'Team' ? teamSize : null,
      groupGames: hasGroupStage(stages) ? groupGames : null,
      knockoutGames: hasKnockoutStage(stages) ? knockoutGames : null,
      numberOfMatches: type === 'Team' ? numberOfMatches : null,
      date,
      cover,
    })
  }

  const handleCancel = () => {
    onCancel?.()
  }

  const renderStagesSection = () => (
    <SingleSelectTags
      label="Stages"
      options={STAGES_OPTIONS}
      selectedValue={stages || 'Group + Knockout'}
      onChange={setStages}
    />
  )

  const renderNumberOfGamesSection = () => (
    <>
      {hasGroupStage(stages) && (
        <SingleSelectTags
          label="Group Stage"
          options={GROUP_GAMES_OPTIONS}
          selectedValue={groupGames || 'Best of 3'}
          onChange={setGroupGames}
        />
      )}
      {hasKnockoutStage(stages) && (
        <SingleSelectTags
          label="Knockout Stage"
          options={KNOCKOUT_GAMES_OPTIONS}
          selectedValue={knockoutGames || 'Best of 3 before Semifinal'}
          onChange={setKnockoutGames}
        />
      )}
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
          label="Type"
          options={['Single', 'Team']}
          selectedValue={type}
          onChange={(value) => {
            setType(value)
            if (value === 'Single') {
              setTeamSize(null)
              if (!stages) {
                setStages('Group + Knockout')
              }
            } else {
              if (!teamSize) {
                setTeamSize('2')
              }
              if (!stages) {
                setStages('Group + Knockout')
              }
            }
          }}
        />
        {type === 'Single' && (
          <>
            <SingleSelectTags
              label="Type"
              options={SINGLE_FORMAT_OPTIONS}
              selectedValue={singleFormat || 'Open Single'}
              onChange={setSingleFormat}
            />
            {singleFormat === 'Rated Single' && (
              <div style={inlineRowStyle}>
                <SingleSelectTags
                  label="Rating"
                  options={['Under', 'Over']}
                  selectedValue={ratingType || 'Under'}
                  onChange={setRatingType}
                />
                <Select
                  label=""
                  name="ratingValue"
                  value={ratingValue || '1500'}
                  onChange={setRatingValue}
                  options={RATING_OPTIONS}
                />
              </div>
            )}
            {singleFormat === 'Age Single' && (
              <div style={inlineRowStyle}>
                <SingleSelectTags
                  label="Age"
                  options={['Under', 'Over']}
                  selectedValue={ageType || 'Under'}
                  onChange={setAgeType}
                />
                <Select
                  label=""
                  name="ageValue"
                  value={ageValue || '18'}
                  onChange={setAgeValue}
                  options={AGE_OPTIONS}
                />
              </div>
            )}
            {renderStagesSection()}
            {renderNumberOfGamesSection()}
          </>
        )}
        {type === 'Team' && (
          <>
            <SingleSelectTags
              label="Team Size"
              options={['2', '3', '4']}
              selectedValue={teamSize || '2'}
              onChange={setTeamSize}
            />
            {renderStagesSection()}
            <SingleSelectTags
              label="Number of Matches"
              options={GROUP_GAMES_OPTIONS}
              selectedValue={numberOfMatches || 'Best of 3'}
              onChange={setNumberOfMatches}
            />
            {renderNumberOfGamesSection()}
          </>
        )}
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
