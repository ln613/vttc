import { Show, onMount, onCleanup, type JSX } from 'solid-js'
import { Header } from '../components/Header'
import Input from '../components/Input'
import SingleSelectTags from '../components/SingleSelectTags'
import Select from '../components/Select'
import Button from '../components/Button'
import Toggle from '../components/Toggle'
import { customConfirm } from '../stores/confirmDialogStore'
import {
  tournamentEditState,
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

const containerStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  'min-height': '100vh',
}

const contentStyle: JSX.CSSProperties = {
  padding: '16px 24px 24px',
}

const titleStyle: JSX.CSSProperties = {
  'font-size': '2rem',
  'font-weight': 700,
  'text-align': 'left',
  'margin-top': '0',
  'margin-bottom': '24px',
  color: '#333',
}

const sectionTitleStyle: JSX.CSSProperties = {
  'font-size': '14px',
  'font-weight': 700,
  'margin-top': '24px',
  'margin-bottom': '8px',
  color: '#333',
  'text-align': 'left',
}

const buttonContainerStyle: JSX.CSSProperties = {
  display: 'flex',
  gap: '16px',
  'margin-top': '24px',
}

const inlineRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'flex-end',
  gap: '12px',
  'margin-bottom': '16px',
}

const inlineRowMiddleNoMarginStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '12px',
}

interface TournamentEditProps {
  isEdit?: boolean
  initialData?: Partial<TournamentEditFormData>
  onSave?: (data: TournamentEditFormData) => void
  onCancel?: () => void
}

const TournamentEdit = (props: TournamentEditProps) => {
  onMount(() => {
    tournamentEditActions.initForm(props.initialData)
  })

  onCleanup(() => {
    tournamentEditActions.resetForm()
  })

  return (
    <div style={containerStyle}>
      <Header />
      <div style={contentStyle}>
        <h1 style={titleStyle}>
          {props.isEdit ? 'Edit Tournament' : 'Add Tournament'}
        </h1>
        <Input
          label="Name"
          name="name"
          value={tournamentEditState.formData.name}
          onChange={(value) => tournamentEditActions.setField('name', value)}
          required
        />
        <SingleSelectTags
          label="Sex"
          options={SEX_OPTIONS}
          selectedValue={tournamentEditState.formData.sex}
          onChange={(value) =>
            tournamentEditActions.setField('sex', value as ParticipantSex)
          }
        />
        <SingleSelectTags
          label="Type"
          options={TYPE_OPTIONS}
          selectedValue={tournamentEditState.formData.type}
          onChange={(value) =>
            tournamentEditActions.setField('type', value as TournamentType)
          }
        />
        <Show when={tournamentEditState.formData.type === 'Team'}>
          <SingleSelectTags
            label="Team Size"
            options={TEAM_SIZE_OPTIONS}
            selectedValue={tournamentEditState.formData.teamSize || '3'}
            onChange={(value) =>
              tournamentEditActions.setField('teamSize', value)
            }
          />
        </Show>
        <SingleSelectTags
          label="Restriction"
          options={RESTRICTION_OPTIONS}
          selectedValue={tournamentEditState.formData.restriction}
          onChange={(value) =>
            tournamentEditActions.setField(
              'restriction',
              value as TournamentRestriction,
            )
          }
        />
        <RatingSection />
        <AgeSection />
        <StagesSection />
        <div style={buttonContainerStyle}>
          <Button color="#e74c3c" onClick={props.onCancel}>
            Cancel
          </Button>
          <Button
            color="#27ae60"
            onClick={async (e) => {
              e?.stopPropagation()
              e?.preventDefault()
              if (
                !(await customConfirm(
                  'Are you sure you want to save this tournament?',
                ))
              )
                return
              void tournamentEditActions.saveTournament(props.onSave)
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

const RatingSection = () => (
  <Show when={tournamentEditState.formData.restriction === 'Rated'}>
    <h3 style={sectionTitleStyle}>Rating</h3>
    <div style={inlineRowMiddleNoMarginStyle}>
      <span style={{ 'font-weight': 500 }}>Under</span>
      <Select
        label=""
        name="ratingLimit"
        value={tournamentEditState.formData.ratingLimit}
        onChange={(value) =>
          tournamentEditActions.setField('ratingLimit', value)
        }
        options={RATING_OPTIONS}
        noMargin
      />
    </div>
    <Show when={tournamentEditState.formData.type === 'Team'}>
      <TopPlayersRatingSection />
    </Show>
  </Show>
)

const TopPlayersRatingSection = () => (
  <>
    <h3 style={sectionTitleStyle}>Top Players Rating</h3>
    <div style={inlineRowMiddleNoMarginStyle}>
      <Toggle
        label=""
        value={tournamentEditState.formData.topPlayersRatingEnabled}
        onChange={(value) =>
          tournamentEditActions.setField('topPlayersRatingEnabled', value)
        }
        noMargin
      />
      <Show when={tournamentEditState.formData.topPlayersRatingEnabled}>
        <span style={{ 'font-weight': 500 }}>
          The combined rating of the top
        </span>
        <Select
          label=""
          name="topPlayersCount"
          value={tournamentEditState.formData.topPlayersCount}
          onChange={(value) =>
            tournamentEditActions.setField('topPlayersCount', value)
          }
          options={generateTopPlayersCountOptions(
            tournamentEditState.formData.teamSize,
          )}
          noMargin
        />
        <span style={{ 'font-weight': 500 }}>players must be under</span>
        <Select
          label=""
          name="topPlayersRatingLimit"
          value={tournamentEditState.formData.topPlayersRatingLimit}
          onChange={(value) =>
            tournamentEditActions.setField('topPlayersRatingLimit', value)
          }
          options={RATING_OPTIONS}
          noMargin
        />
      </Show>
    </div>
  </>
)

const AgeSection = () => (
  <Show when={tournamentEditState.formData.restriction === 'Age'}>
    <div style={inlineRowStyle}>
      <SingleSelectTags
        label="Age"
        options={['Under', 'Over']}
        selectedValue={
          tournamentEditState.formData.ageLimitType === 'U' ? 'Under' : 'Over'
        }
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
        value={tournamentEditState.formData.ageLimit}
        onChange={(value) => tournamentEditActions.setField('ageLimit', value)}
        options={AGE_OPTIONS}
      />
    </div>
  </Show>
)

const StagesSection = () => (
  <div
    style={
      tournamentEditState.formData.restriction === 'Rated'
        ? { 'margin-top': '24px' }
        : undefined
    }
  >
    <SingleSelectTags
      label="Stages"
      options={STAGES_OPTIONS}
      selectedValue={tournamentEditState.formData.stages}
      onChange={(value) =>
        tournamentEditActions.setField('stages', value as StagesType)
      }
    />
  </div>
)

export default TournamentEdit
