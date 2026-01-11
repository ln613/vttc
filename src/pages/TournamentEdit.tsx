import React, { useEffect } from 'react'
import { Header } from '../components/Header'
import Input from '../components/Input'
import SingleSelectTags from '../components/SingleSelectTags'
import Select from '../components/Select'
import Button from '../components/Button'
import Toggle from '../components/Toggle'
import {
  useTournamentEditStore,
  tournamentEditActions,
  generateTopPlayersCountOptions,
  type TournamentEditFormData,
} from '../stores/tournamentEditStore'
import type {
  ParticipantSex,
  TournamentType,
  TournamentRestriction,
  StagesType,
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
  for (let i = 100; i <= 6000; i += 50) {
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
  const { formData } = useTournamentEditStore()

  useEffect(() => {
    tournamentEditActions.initForm(initialData)
    return () => tournamentEditActions.resetForm()
  }, [])

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
          value={formData.name}
          onChange={(value) => tournamentEditActions.setField('name', value)}
          required
        />
        <SingleSelectTags
          label="Sex"
          options={SEX_OPTIONS}
          selectedValue={formData.sex}
          onChange={(value) =>
            tournamentEditActions.setField('sex', value as ParticipantSex)
          }
        />
        <SingleSelectTags
          label="Type"
          options={TYPE_OPTIONS}
          selectedValue={formData.type}
          onChange={(value) =>
            tournamentEditActions.setField('type', value as TournamentType)
          }
        />
        {formData.type === 'Team' && (
          <SingleSelectTags
            label="Team Size"
            options={TEAM_SIZE_OPTIONS}
            selectedValue={formData.teamSize || '3'}
            onChange={(value) =>
              tournamentEditActions.setField('teamSize', value)
            }
          />
        )}
        <SingleSelectTags
          label="Restriction"
          options={RESTRICTION_OPTIONS}
          selectedValue={formData.restriction}
          onChange={(value) =>
            tournamentEditActions.setField(
              'restriction',
              value as TournamentRestriction,
            )
          }
        />
        <RatingSection formData={formData} />
        <AgeSection formData={formData} />
        <StagesSection formData={formData} />
        <div style={buttonContainerStyle}>
          <Button color="#e74c3c" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            color="#27ae60"
            onClick={() => tournamentEditActions.saveTournament(onSave)}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

interface RatingSectionProps {
  formData: TournamentEditFormData
}

const RatingSection: React.FC<RatingSectionProps> = ({ formData }) => {
  if (formData.restriction !== 'Rated') return null

  return (
    <>
      <h3 style={sectionTitleStyle}>Rating</h3>
      <div style={inlineRowMiddleNoMarginStyle}>
        <span style={{ fontWeight: 500 }}>Under</span>
        <Select
          label=""
          name="ratingLimit"
          value={formData.ratingLimit}
          onChange={(value) =>
            tournamentEditActions.setField('ratingLimit', value)
          }
          options={RATING_OPTIONS}
          noMargin
        />
      </div>
      {formData.type === 'Team' && (
        <TopPlayersRatingSection formData={formData} />
      )}
    </>
  )
}

interface TopPlayersRatingSectionProps {
  formData: TournamentEditFormData
}

const TopPlayersRatingSection: React.FC<TopPlayersRatingSectionProps> = ({
  formData,
}) => (
  <>
    <h3 style={sectionTitleStyle}>Top Players Rating</h3>
    <div style={inlineRowMiddleNoMarginStyle}>
      <Toggle
        label=""
        value={formData.topPlayersRatingEnabled}
        onChange={(value) =>
          tournamentEditActions.setField('topPlayersRatingEnabled', value)
        }
        noMargin
      />
      {formData.topPlayersRatingEnabled && (
        <>
          <span style={{ fontWeight: 500 }}>
            The combined rating of the top
          </span>
          <Select
            label=""
            name="topPlayersCount"
            value={formData.topPlayersCount}
            onChange={(value) =>
              tournamentEditActions.setField('topPlayersCount', value)
            }
            options={generateTopPlayersCountOptions(formData.teamSize)}
            noMargin
          />
          <span style={{ fontWeight: 500 }}>players must be under</span>
          <Select
            label=""
            name="topPlayersRatingLimit"
            value={formData.topPlayersRatingLimit}
            onChange={(value) =>
              tournamentEditActions.setField('topPlayersRatingLimit', value)
            }
            options={RATING_OPTIONS}
            noMargin
          />
        </>
      )}
    </div>
  </>
)

interface AgeSectionProps {
  formData: TournamentEditFormData
}

const AgeSection: React.FC<AgeSectionProps> = ({ formData }) => {
  if (formData.restriction !== 'Age') return null

  return (
    <div style={inlineRowStyle}>
      <SingleSelectTags
        label="Age"
        options={['Under', 'Over']}
        selectedValue={formData.ageLimitType === 'U' ? 'Under' : 'Over'}
        onChange={(value) =>
          tournamentEditActions.setField(
            'ageLimitType',
            value === 'Under' ? 'U' : 'O',
          )
        }
      />
      <Select
        label=""
        name="ageLimit"
        value={formData.ageLimit}
        onChange={(value) => tournamentEditActions.setField('ageLimit', value)}
        options={AGE_OPTIONS}
      />
    </div>
  )
}

interface StagesSectionProps {
  formData: TournamentEditFormData
}

const StagesSection: React.FC<StagesSectionProps> = ({ formData }) => (
  <div style={formData.restriction === 'Rated' ? { marginTop: '24px' } : undefined}>
    <SingleSelectTags
      label="Stages"
      options={STAGES_OPTIONS}
      selectedValue={formData.stages}
      onChange={(value) =>
        tournamentEditActions.setField('stages', value as StagesType)
      }
    />
  </div>
)

export default TournamentEdit
