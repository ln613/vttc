import React, { useState } from 'react'
import { Header } from '../components/Header'
import Input from '../components/Input'
import SingleSelectTags from '../components/SingleSelectTags'
import Select from '../components/Select'
import Button from '../components/Button'
import Toggle from '../components/Toggle'
import { apiPost } from '../utils/api'
import type {
  ParticipantSex,
  TournamentType,
  TournamentRestriction,
  StagesType,
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

const generateTopPlayersCountOptions = (teamSize: string | null) => {
  const options = []
  const maxCount = teamSize ? parseInt(teamSize, 10) : 3
  for (let i = 1; i <= maxCount; i++) {
    options.push({ value: String(i), label: String(i) })
  }
  return options
}

const RATING_OPTIONS = generateRatingOptions()
const AGE_OPTIONS = generateAgeOptions()

interface TournamentEditFormData {
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

interface TournamentEditProps {
  isEdit?: boolean
  initialData?: Partial<TournamentEditFormData>
  onSave?: (data: TournamentEditFormData) => void
  onCancel?: () => void
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
  const [topPlayersRatingEnabled, setTopPlayersRatingEnabled] = useState(
    initialData?.topPlayersRatingEnabled || false,
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

  const inlineRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '12px',
    marginBottom: '16px',
  }

  const inlineRowMiddleNoMarginStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  }

  const validateForm = (): boolean => {
    return !!name.trim()
  }

  const handleSave = async () => {
    if (!validateForm()) {
      return
    }

    const confirmed = window.confirm('Are you sure you want to save this tournament?')
    if (!confirmed) {
      return
    }

    const data: TournamentEditFormData = {
      id: initialData?.id,
      name,
      sex,
      type,
      teamSize: type === 'Team' ? teamSize : null,
      restriction,
      ratingLimit: restriction === 'Rated' ? ratingLimit : '1500',
      topPlayersRatingEnabled:
        restriction === 'Rated' && type === 'Team' ? topPlayersRatingEnabled : false,
      topPlayersCount:
        restriction === 'Rated' && type === 'Team' && topPlayersRatingEnabled ? topPlayersCount : '2',
      topPlayersRatingLimit:
        restriction === 'Rated' && type === 'Team' && topPlayersRatingEnabled ? topPlayersRatingLimit : '2500',
      ageLimitType: restriction === 'Age' ? ageLimitType : 'U',
      ageLimit: restriction === 'Age' ? ageLimit : '20',
      stages,
    }

    try {
      await apiPost('saveTournament', {
        id: data.id,
        name: data.name,
        sex: data.sex,
        type: data.type,
        teamSize: data.teamSize ? parseInt(data.teamSize, 10) : undefined,
        restriction: data.restriction,
        ratingLimit: data.restriction === 'Rated' ? parseInt(data.ratingLimit, 10) : undefined,
        topPlayersRatingEnabled: data.topPlayersRatingEnabled,
        topPlayersCount: data.topPlayersRatingEnabled ? parseInt(data.topPlayersCount, 10) : undefined,
        topPlayersRatingLimit: data.topPlayersRatingEnabled ? parseInt(data.topPlayersRatingLimit, 10) : undefined,
        ageLimitType: data.restriction === 'Age' ? data.ageLimitType : undefined,
        ageLimit: data.restriction === 'Age' ? parseInt(data.ageLimit, 10) : undefined,
        stages: data.stages,
      })
      onSave?.(data)
    } catch (error) {
      console.error('Failed to save tournament:', error)
    }
  }

  const handleCancel = () => {
    onCancel?.()
  }

  const renderRatingSection = () => {
    if (restriction !== 'Rated') return null

    return (
      <>
        <h3 style={sectionTitleStyle}>Rating</h3>
        <div style={inlineRowMiddleNoMarginStyle}>
          <span style={{ fontWeight: 500 }}>Under</span>
          <Select
            label=""
            name="ratingLimit"
            value={ratingLimit}
            onChange={setRatingLimit}
            options={RATING_OPTIONS}
            noMargin
          />
        </div>
        {type === 'Team' && (
          <>
            <h3 style={sectionTitleStyle}>Top Players Rating</h3>
            <div style={inlineRowMiddleNoMarginStyle}>
              <Toggle
                label=""
                value={topPlayersRatingEnabled}
                onChange={setTopPlayersRatingEnabled}
                noMargin
              />
              {topPlayersRatingEnabled && (
                <>
                  <span style={{ fontWeight: 500 }}>
                    The combined rating of the top
                  </span>
                  <Select
                    label=""
                    name="topPlayersCount"
                    value={topPlayersCount}
                    onChange={(value) => {
                      const maxCount = teamSize ? parseInt(teamSize, 10) : 3
                      if (parseInt(value, 10) <= maxCount) {
                        setTopPlayersCount(value)
                      }
                    }}
                    options={generateTopPlayersCountOptions(teamSize)}
                    noMargin
                  />
                  <span style={{ fontWeight: 500 }}>
                    players must be under
                  </span>
                  <Select
                    label=""
                    name="topPlayersRatingLimit"
                    value={topPlayersRatingLimit}
                    onChange={setTopPlayersRatingLimit}
                    options={RATING_OPTIONS}
                    noMargin
                  />
                </>
              )}
            </div>
          </>
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
    <div style={restriction === 'Rated' ? { marginTop: '24px' } : undefined}>
      <SingleSelectTags
        label="Stages"
        options={STAGES_OPTIONS}
        selectedValue={stages}
        onChange={(value) => setStages(value as StagesType)}
      />
    </div>
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
            onChange={(newTeamSize) => {
              setTeamSize(newTeamSize)
              const newTeamSizeNum = parseInt(newTeamSize, 10)
              const currentTopPlayersCount = parseInt(topPlayersCount, 10)
              if (currentTopPlayersCount > newTeamSizeNum) {
                setTopPlayersCount(newTeamSize)
              }
            }}
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

export default TournamentEdit
