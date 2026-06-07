import { Show, onMount, onCleanup, type JSX } from 'solid-js'
import { useParams, useNavigate } from '@solidjs/router'
import { Header } from '../components/Header'
import Input from '../components/Input'
import InputDropdown from '../components/InputDropdown'
import Select from '../components/Select'
import DatePicker from '../components/DatePicker'
import SingleSelectTags from '../components/SingleSelectTags'
import Toggle from '../components/Toggle'
import Button from '../components/Button'
import { tournamentState, tournamentActions } from '../stores/tournamentStore'
import {
  eventEditState,
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

const generateTimeOptions = () => {
  const options = []
  for (let hour = 8; hour <= 18; hour++) {
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour > 12 ? hour - 12 : hour
    options.push({
      value: `${displayHour}:00 ${period}`,
      label: `${displayHour}:00 ${period}`,
    })
    if (hour < 18) {
      options.push({
        value: `${displayHour}:30 ${period}`,
        label: `${displayHour}:30 ${period}`,
      })
    }
  }
  return options
}

const TIME_OPTIONS = generateTimeOptions()

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

const generateRegistrationFeeOptions = () => {
  const options = [{ value: '', label: '' }]
  for (let i = 10; i <= 100; i += 5) {
    options.push({ value: String(i), label: `$${i}` })
  }
  return options
}

const HANDICAP_DIFFERENCE_OPTIONS = generateHandicapDifferenceOptions()
const MAX_POINTS_GIVEN_OPTIONS = generateMaxPointsGivenOptions()
const MAX_PARTICIPANTS_OPTIONS = generateMaxParticipantsOptions()
const REGISTRATION_FEE_OPTIONS = generateRegistrationFeeOptions()

interface EventEditProps {
  isEdit?: boolean
  initialData?: Partial<EventEditFormData>
  onSave?: (data: EventEditFormData) => void
  onCancel?: () => void
}

const containerStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  'min-height': '100vh',
  position: 'relative',
}

const contentStyle: JSX.CSSProperties = {
  padding: '16px 24px 24px',
}

const overlayStyle: JSX.CSSProperties = {
  position: 'fixed',
  top: '0',
  left: '0',
  right: '0',
  bottom: '0',
  'background-color': 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'z-index': '1000',
}

const overlayMessageStyle: JSX.CSSProperties = {
  'background-color': '#fff',
  padding: '32px 48px',
  'border-radius': '12px',
  'font-size': '18px',
  'font-weight': 600,
  color: '#333',
  'box-shadow': '0 4px 20px rgba(0, 0, 0, 0.15)',
  'text-align': 'center',
}

const savedMessageStyle: JSX.CSSProperties = {
  ...overlayMessageStyle,
  color: '#27ae60',
}

const errorMessageStyle: JSX.CSSProperties = {
  color: '#e74c3c',
  'font-size': '14px',
  'font-weight': 500,
  'margin-top': '16px',
  'text-align': 'left',
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

const EventEdit = (props: EventEditProps) => {
  const params = useParams<{ id?: string }>()
  const navigate = useNavigate()

  onMount(async () => {
    await Promise.all([
      tournamentActions.fetchTournaments(),
      eventEditActions.fetchEventSeries(),
    ])
    if (props.isEdit && params.id) {
      await eventEditActions.loadEvent(params.id)
    } else {
      eventEditActions.initForm(props.initialData)
    }
  })

  onCleanup(() => {
    eventEditActions.resetForm()
  })

  const tournamentOptions = () =>
    (tournamentState.data || []).map((t) => ({
      value: t._id,
      label: t.name,
    }))

  const handleCancel = (e?: MouseEvent) => {
    e?.stopPropagation()
    e?.preventDefault()
    if (props.onCancel) {
      props.onCancel()
      return
    }
    if (eventEditActions.hasChanges()) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to cancel?')
      if (!confirmed) return
    }
    navigate('/events')
  }

  return (
    <div style={containerStyle}>
      <Header />
      <Show when={eventEditState.saving}>
        <div style={overlayStyle}>
          <div style={overlayMessageStyle}>Saving...</div>
        </div>
      </Show>
      <Show when={eventEditState.saved}>
        <div style={overlayStyle}>
          <div style={savedMessageStyle}>Saved!</div>
        </div>
      </Show>
      <div style={contentStyle}>
        <h1 style={titleStyle}>{props.isEdit ? 'Edit Event' : 'Add Event'}</h1>
        <InputDropdown
          label="Event Series"
          name="eventSeries"
          value={eventEditState.formData.eventSeries}
          onChange={(value) => eventEditActions.setField('eventSeries', value)}
          options={eventEditState.eventSeriesList}
          placeholder="Select or enter new series"
        />
        <Select
          label="Tournament"
          name="tournament"
          value={eventEditState.formData.tournamentId}
          onChange={(value) => eventEditActions.setField('tournamentId', value)}
          options={tournamentOptions()}
        />
        <DatePicker
          label="Date"
          value={eventEditState.formData.date}
          onChange={(value) => eventEditActions.setField('date', value)}
          minYear={new Date().getFullYear() - 5}
          maxYear={new Date().getFullYear() + 5}
        />
        <Select
          label="Time"
          name="time"
          value={eventEditState.formData.time}
          onChange={(value) => eventEditActions.setField('time', value)}
          options={TIME_OPTIONS}
        />
        <Input
          label="Name"
          name="name"
          value={eventEditState.formData.name}
          onChange={(value) => eventEditActions.setField('name', value)}
          required
        />
        <Select
          label="Max Participants"
          name="maxParticipants"
          value={eventEditState.formData.maxParticipants}
          onChange={(value) =>
            eventEditActions.setField('maxParticipants', value)
          }
          options={MAX_PARTICIPANTS_OPTIONS}
        />
        <Select
          label="Registration Fee"
          name="registrationFee"
          value={eventEditState.formData.registrationFee}
          onChange={(value) =>
            eventEditActions.setField('registrationFee', value)
          }
          options={REGISTRATION_FEE_OPTIONS}
        />
        <NumberOfMatchesSection />
        <NumberOfGamesSection />
        <QualifiersSection />
        <HandicapSection />
        <Show when={eventEditState.error}>
          <div style={errorMessageStyle}>{eventEditState.error}</div>
        </Show>
        <div style={buttonContainerStyle}>
          <Button color="#e74c3c" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            color="#27ae60"
            onClick={() => eventEditActions.saveEvent(props.onSave || (() => navigate(-1)))}
            disabled={eventEditState.saving}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

const NumberOfGamesSection = () => {
  const tournament = () => eventEditActions.getSelectedTournament()

  return (
    <Show when={tournament()}>
      {(t) => (
        <>
          <h3 style={sectionTitleStyle}>Number of Games</h3>
          <Show when={hasGroupStage(t().stages)}>
            <SingleSelectTags
              label="Group Stage"
              options={GROUP_GAMES_OPTIONS}
              selectedValue={eventEditState.formData.groupGames}
              onChange={(value) =>
                eventEditActions.setField('groupGames', value as BestOfOption)
              }
            />
          </Show>
          <Show when={hasKnockoutStage(t().stages)}>
            <SingleSelectTags
              label="Knockout Stage"
              options={KNOCKOUT_GAMES_OPTIONS}
              selectedValue={eventEditState.formData.knockoutGames}
              onChange={(value) =>
                eventEditActions.setField('knockoutGames', value as BestOfOption)
              }
            />
          </Show>
        </>
      )}
    </Show>
  )
}

const NumberOfMatchesSection = () => {
  const tournament = () => eventEditActions.getSelectedTournament()

  return (
    <Show when={tournament()?.type === 'Team' && tournament()}>
      {(t) => (
        <>
          <h3 style={sectionTitleStyle}>Number of Matches</h3>
          <Show when={hasGroupStage(t().stages)}>
            <SingleSelectTags
              label="Group Stage"
              options={GROUP_GAMES_OPTIONS}
              selectedValue={eventEditState.formData.groupMatches}
              onChange={(value) =>
                eventEditActions.setField('groupMatches', value as BestOfOption)
              }
            />
          </Show>
          <Show when={hasKnockoutStage(t().stages)}>
            <SingleSelectTags
              label="Knockout Stage"
              options={KNOCKOUT_GAMES_OPTIONS}
              selectedValue={eventEditState.formData.knockoutMatches}
              onChange={(value) =>
                eventEditActions.setField(
                  'knockoutMatches',
                  value as BestOfOption,
                )
              }
            />
          </Show>
        </>
      )}
    </Show>
  )
}

const QualifiersSection = () => {
  const tournament = () => eventEditActions.getSelectedTournament()

  return (
    <Show when={tournament() && hasGroupStage(tournament()!.stages)}>
      <SingleSelectTags
        label="Number of Qualifiers"
        options={QUALIFIERS_OPTIONS}
        selectedValue={eventEditState.formData.qualifiers}
        onChange={(value) =>
          eventEditActions.setField('qualifiers', value as QualifiersCount)
        }
      />
    </Show>
  )
}

const inlineRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '12px',
  'margin-bottom': '16px',
}

const HandicapSection = () => (
  <>
    <h3 style={sectionTitleStyle}>Handicap</h3>
    <div style={inlineRowStyle}>
      <Toggle
        label=""
        value={eventEditState.formData.handicapEnabled}
        onChange={(value) =>
          eventEditActions.setField('handicapEnabled', value)
        }
        noMargin
      />
      <Show when={eventEditState.formData.handicapEnabled}>
        <span style={{ 'font-weight': '500' }}>Difference:</span>
        <Select
          label=""
          name="handicapDifference"
          value={eventEditState.formData.handicapDifference}
          onChange={(value) =>
            eventEditActions.setField('handicapDifference', value)
          }
          options={HANDICAP_DIFFERENCE_OPTIONS}
          noMargin
        />
        <span style={{ 'font-weight': '500' }}>Max Points Given:</span>
        <Select
          label=""
          name="handicapMaxPoints"
          value={eventEditState.formData.handicapMaxPoints}
          onChange={(value) =>
            eventEditActions.setField('handicapMaxPoints', value)
          }
          options={MAX_POINTS_GIVEN_OPTIONS}
          noMargin
        />
      </Show>
    </div>
  </>
)

export default EventEdit
