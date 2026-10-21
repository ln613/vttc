import { Show, For, onMount, type JSX } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { Header } from '../components/Header'
import { authState } from '../stores/authStore'
import { settingsState, settingsActions } from '../stores/settingsStore'
import type { AppSettings } from '../stores/settingsStore'
import clubConfig from 'club-config'
import { modulesActions } from '../stores/modulesStore'
import Select from '../components/Select'
import Input from '../components/Input'
import DatePicker from '../components/DatePicker'
import {
  bookingRules,
  toMinutes,
  toTimeOfDay,
  WEEK_DAYS,
} from '../../shared/rules/booking'
import type { OneTimeRate } from '../../shared/rules/bookingRates'
import {
  bookingRatesState,
  bookingRatesActions,
} from '../stores/bookingRatesStore'
import { priceGroups } from '../site/pricing'
import { parseLocalDate } from '../utils/date'
import ThemeButton from '../components/ThemeButton'
import { langActions, langState } from '../stores/langStore'
import { hasSiteLook, loadSiteFonts } from '../site/siteContent'
import { pointsModel } from '../i18n/wallet'
import type { TopUpOption } from '../../shared/rules/wallet'
import { themed } from '../site/themed'
import './booking.css'

// A club with its own website shows Settings in its site's look (heading
// band, cards, site buttons — booking.css) and in its languages.
const t = langActions.t

const Settings = () => {
  onMount(() => {
    loadSiteFonts()
    if (!authState.isAdmin) return
    void loadSettingsAndPrices()
  })

  return (
    <div {...themed(containerStyle, 'bk bk-site')}>
      <Header />
      <Show when={authState.isAdmin}>
        <Show when={hasSiteLook()}>
          <header class="bk-head">
            <div class="bk-head-inner bk-head-row">
              <div>
                <p class="bk-kicker">{t('settings.kicker')}</p>
                <h1 class="bk-title">{t('settings.title')}</h1>
              </div>
              <EditIcons />
            </div>
          </header>
        </Show>
        <div {...themed(contentStyle, 'bk-wrap')}>
          <Show when={!hasSiteLook()}>
            <TitleRow />
          </Show>
          <Show when={settingsState.error}>
            <div style={errorStyle}>{settingsState.error}</div>
          </Show>
          {/* Each section follows its module (specs/rules/modules.md). */}
          <Show when={modulesActions.on('tournament')}>
            <EventSettingSection />
          </Show>
          <Show when={modulesActions.on('booking')}>
            <BookingSection />
            <CourtPricesSection />
          </Show>
          {/* Points model only (specs/rules/wallet.md). */}
          <Show when={pointsModel && modulesActions.on('credit')}>
            <RewardsSection />
          </Show>
          {/* Only where the club records who umpired — otherwise there is
              no roster to keep. */}
          <Show
            when={
              modulesActions.on('gamePlay') &&
              settingsState.settings.saveUmpireInfo
            }
          >
            <UmpireSection />
          </Show>
          <Show when={modulesActions.on('tournament')}>
            <RevenueSection />
          </Show>
          {/* Only for a club that actually uses the app's rating system —
              see enableUpdateRating in clubs/<slug>/config.json. */}
          <Show
            when={
              modulesActions.on('tournament') && clubConfig.enableUpdateRating
            }
          >
            <UpdateSection />
          </Show>
          <Show when={authState.isSuperAdmin}>
            <ModulesSection />
          </Show>
        </div>
      </Show>
    </div>
  )
}

// The price form starts within the opening hours, so it waits for them.
const loadSettingsAndPrices = async () => {
  await Promise.all([
    settingsActions.fetchSettings(),
    bookingRatesActions.fetchRates(),
  ])
  bookingRatesActions.resetForm()
}

const UmpireSection = () => {
  const navigate = useNavigate()
  return (
    <div {...themed(sectionStyle, 'bk-card')}>
      <h4 {...themed(sectionHeaderStyle, 'bk-section-title')}>
        {t('settings.umpires')}
      </h4>
      <div {...themed(linkColumnStyle, 'bk-links')}>
        <button
          type="button"
          {...themed(linkButtonStyle, 'bk-link')}
          onClick={() => navigate('/umpires')}
        >
          {t('settings.umpires')}
        </button>
      </div>
    </div>
  )
}

// Super admin only: which parts of the app this club uses.
const ModulesSection = () => {
  const navigate = useNavigate()
  return (
    <div {...themed(sectionStyle, 'bk-card')}>
      <h4 {...themed(sectionHeaderStyle, 'bk-section-title')}>
        {t('settings.modules')}
      </h4>
      <div {...themed(linkColumnStyle, 'bk-links')}>
        <button
          type="button"
          {...themed(linkButtonStyle, 'bk-link')}
          onClick={() => navigate('/modules')}
        >
          {t('settings.modules')}
        </button>
      </div>
    </div>
  )
}

const RevenueSection = () => {
  const navigate = useNavigate()
  return (
    <div {...themed(sectionStyle, 'bk-card')}>
      <h4 {...themed(sectionHeaderStyle, 'bk-section-title')}>
        {t('settings.revenue')}
      </h4>
      <div {...themed(linkColumnStyle, 'bk-links')}>
        <button
          type="button"
          {...themed(linkButtonStyle, 'bk-link')}
          onClick={() => navigate('/revenue')}
        >
          {t('settings.revenue')}
        </button>
        <button
          type="button"
          {...themed(linkButtonStyle, 'bk-link')}
          onClick={() => navigate('/revenue-calculator')}
        >
          {t('settings.revenueCalculator')}
        </button>
      </div>
    </div>
  )
}

const UpdateSection = () => (
  <div {...themed(sectionStyle, 'bk-card')}>
    <h4 {...themed(sectionHeaderStyle, 'bk-section-title')}>
      {t('settings.update')}
    </h4>
    <Show
      when={hasSiteLook()}
      fallback={
        <button
          type="button"
          style={updateButtonStyle}
          disabled={settingsState.updatingRating}
          onClick={() => void settingsActions.updateRatings()}
        >
          {settingsState.updatingRating
            ? t('settings.updating')
            : t('settings.updateRating')}
        </button>
      }
    >
      <ThemeButton
        variant="accent"
        small
        disabled={settingsState.updatingRating}
        onClick={() => void settingsActions.updateRatings()}
      >
        {settingsState.updatingRating
          ? t('settings.updating')
          : t('settings.updateRating')}
      </ThemeButton>
    </Show>
    <Show when={settingsState.ratingResult}>
      <div {...themed(ratingResultStyle, 'bk-success')}>
        {settingsState.ratingResult}
      </div>
    </Show>
  </div>
)

const TitleRow = () => (
  <div style={titleRowStyle}>
    <h3 style={titleStyle}>{t('settings.title')}</h3>
    <EditIcons />
  </div>
)

// Edit, then Cancel and Save, beside the page title.
const EditIcons = () => (
  <>
    <div style={actionIconsStyle}>
      <Show when={settingsState.saving}>
        <SpinnerIcon />
      </Show>
      <Show
        when={settingsState.editing}
        fallback={
          <Show when={authState.isAdmin && !settingsState.saving}>
            <IconButton
              label={t('common.edit')}
              onClick={() => settingsActions.startEditing()}
            >
              <EditGlyph />
            </IconButton>
          </Show>
        }
      >
        <Show when={!settingsState.saving}>
          <IconButton
            label={t('common.cancel')}
            onClick={() => settingsActions.cancelEditing()}
          >
            <CancelGlyph />
          </IconButton>
          <IconButton
            label={t('common.save')}
            onClick={() => void settingsActions.save()}
          >
            <SaveGlyph />
          </IconButton>
        </Show>
      </Show>
    </div>
  </>
)

const EventSettingSection = () => (
  <div {...themed(sectionStyle, 'bk-card')}>
    <h4 {...themed(sectionHeaderStyle, 'bk-section-title')}>
      {t('settings.eventSetting')}
    </h4>
    <SettingCheckbox
      field="ignoreUnpaidInGeneration"
      label={t('settings.ignoreUnpaid')}
    />
    <SettingCheckbox
      field="tabletMirrorEnabled"
      label={t('settings.tabletMirror')}
    />
    <SettingCheckbox
      field="allowPublicUmpire"
      label={t('settings.publicUmpire')}
    />
    <SettingCheckbox
      field="saveUmpireInfo"
      label={t('settings.saveUmpireInfo')}
    />
    <Show when={settingsValue('saveUmpireInfo')}>
      <SettingNumber
        field="maxUmpiresPerTable"
        label={t('settings.maxUmpires')}
        min={1}
        max={4}
      />
    </Show>
  </div>
)

// Court booking hours: every half hour of the day. Closing can be as late as
// midnight, and offers only times that leave room for the shortest booking.
const bookingSlotRules = bookingRules(clubConfig.booking)

const timeOption = (minutes: number) => ({
  value: toTimeOfDay(minutes),
  label:
    minutes === 24 * 60
      ? t('common.midnight', { time: langActions.clock(minutes) })
      : langActions.clock(minutes),
})

const timesBetween = (from: number, to: number) => {
  const out = []
  for (let t = from; t <= to; t += bookingSlotRules.slotMinutes)
    out.push(timeOption(t))
  return out
}

const openTimeOptions = () =>
  timesBetween(0, 24 * 60 - bookingSlotRules.minMinutes)

const closeTimeOptions = () =>
  timesBetween(
    toMinutes(settingsValue('bookingOpenTime')) + bookingSlotRules.minMinutes,
    24 * 60,
  )

// A later opening can leave closing too soon after it; closing moves with it.
const setBookingOpenTime = (openTime: string) => {
  settingsActions.setDraft('bookingOpenTime', openTime)
  const earliestClose = toMinutes(openTime) + bookingSlotRules.minMinutes
  if (toMinutes(settingsValue('bookingCloseTime')) < earliestClose) {
    settingsActions.setDraft('bookingCloseTime', toTimeOfDay(earliestClose))
  }
}

const BookingSection = () => (
  <div {...themed(sectionStyle, 'bk-card')}>
    <h4 {...themed(sectionHeaderStyle, 'bk-section-title')}>
      {t('settings.courtBooking')}
    </h4>
    <div style={hoursRowStyle}>
      <Select
        label={t('settings.opensAt')}
        name="bookingOpenTime"
        value={settingsValue('bookingOpenTime')}
        onChange={setBookingOpenTime}
        options={openTimeOptions()}
        disabled={!settingsState.editing}
        noPlaceholder
      />
      <Select
        label={t('settings.closesAt')}
        name="bookingCloseTime"
        value={settingsValue('bookingCloseTime')}
        onChange={(v) => settingsActions.setDraft('bookingCloseTime', v)}
        options={closeTimeOptions()}
        disabled={!settingsState.editing}
        noPlaceholder
      />
    </div>
  </div>
)

// ==================== court prices ====================
//
// What booking charges, and a form to set a price: weekly (on the chosen
// days) or one-time (one date, shown on the Pricing page as a promotion).
// Saved on its own, apart from the page's Edit/Save. See
// specs/rules/booking.md ("Price").

const CourtPricesSection = () => (
  <div {...themed(sectionStyle, 'bk-card')}>
    <h4 {...themed(sectionHeaderStyle, 'bk-section-title')}>
      {t('settings.courtPrices')}
    </h4>
    <Show when={bookingRatesState.error}>
      <div style={errorStyle}>{bookingRatesState.error}</div>
    </Show>
    <WeeklyPrices />
    <OneTimePrices />
    <RateForm />
  </div>
)

const WeeklyPrices = () => (
  <div class="rt-list">
    <span class="rt-list-title">{t('settings.weeklyPrices')}</span>
    <For each={priceGroups(langState.lang)}>
      {(group) => (
        <div class="rt-group">
          <span class="rt-days">{group.days}</span>
          <div class="rt-rows">
            <For each={group.rows}>
              {(row) => (
                <div class="rt-row">
                  <span>{row.time}</span>
                  <b>
                    ${row.price}
                    {t('booking.perHour')}
                  </b>
                </div>
              )}
            </For>
          </div>
        </div>
      )}
    </For>
  </div>
)

const oneTimeDate = (date: string) =>
  langActions.date(date, { weekday: 'short', month: 'short', day: 'numeric' })

const oneTimeTime = (rate: OneTimeRate) =>
  `${langActions.clock(toMinutes(rate.from))} – ${langActions.clock(toMinutes(rate.to))}`

const OneTimePrices = () => (
  <Show when={bookingRatesState.oneTime.length > 0}>
    <div class="rt-list">
      <span class="rt-list-title">{t('settings.oneTimePrices')}</span>
      <For each={bookingRatesState.oneTime}>
        {(rate) => (
          <div class="rt-group">
            <span class="rt-days">{oneTimeDate(rate.date)}</span>
            <div class="rt-row">
              <span>{oneTimeTime(rate)}</span>
              <b>
                ${rate.dollarsPerHour}
                {t('booking.perHour')}
              </b>
            </div>
            <button
              type="button"
              class="rt-remove"
              aria-label={t('settings.removePrice')}
              title={t('settings.removePrice')}
              disabled={bookingRatesActions.isRemoving(rate)}
              onClick={() => void bookingRatesActions.removeOneTime(rate)}
            >
              ×
            </button>
          </div>
        )}
      </For>
    </div>
  </Show>
)

const isOneTime = () => bookingRatesState.form.repeat === 'once'

// "Weekly [switch] One-time": off is weekly, on is one-time.
const RepeatSwitch = () => (
  <label class="rt-switch">
    <span class={isOneTime() ? 'rt-switch-side' : 'rt-switch-side is-on'}>
      {t('settings.weekly')}
    </span>
    <input
      type="checkbox"
      role="switch"
      class="rt-switch-input"
      checked={isOneTime()}
      onChange={(e) => bookingRatesActions.setOneTime(e.currentTarget.checked)}
    />
    <span class="rt-switch-track" aria-hidden="true">
      <span class="rt-switch-thumb" />
    </span>
    <span class={isOneTime() ? 'rt-switch-side is-on' : 'rt-switch-side'}>
      {t('settings.oneTime')}
    </span>
  </label>
)

const DayChecks = () => (
  <div class="rt-days-pick">
    <For each={WEEK_DAYS}>
      {(day) => (
        <label class="rt-day">
          <input
            type="checkbox"
            checked={bookingRatesActions.isDayChosen(day)}
            onChange={() => bookingRatesActions.toggleDay(day)}
          />
          <span>{t(`days.${day}`)}</span>
        </label>
      )}
    </For>
  </div>
)

const RateForm = () => (
  <div class="rt-form">
    <span class="rt-list-title">{t('settings.setPrice')}</span>
    <RepeatSwitch />
    <Show
      when={isOneTime()}
      fallback={<DayChecks />}
    >
      <DatePicker
        label={t('settings.priceDate')}
        value={
          bookingRatesState.form.date
            ? parseLocalDate(bookingRatesState.form.date)
            : null
        }
        onChange={bookingRatesActions.setDate}
        minYear={new Date().getFullYear()}
        maxYear={new Date().getFullYear() + 2}
      />
    </Show>
    <div style={hoursRowStyle}>
      <Select
        label={t('settings.priceFrom')}
        name="rateFrom"
        value={bookingRatesState.form.from}
        onChange={bookingRatesActions.setFrom}
        options={bookingRatesActions.startOptions()}
        noPlaceholder
      />
      <Select
        label={t('settings.priceTo')}
        name="rateTo"
        value={bookingRatesState.form.to}
        onChange={bookingRatesActions.setTo}
        options={bookingRatesActions.endOptions()}
        noPlaceholder
      />
    </div>
    <div style={{ 'max-width': '232px' }}>
      <Input
        label={t('settings.hourlyRate')}
        name="rateDollars"
        value={bookingRatesState.form.dollars}
        onChange={bookingRatesActions.setDollars}
        inputMode="numeric"
      />
    </div>
    <Show when={bookingRatesState.formError}>
      <div style={errorStyle}>{bookingRatesState.formError}</div>
    </Show>
    <Show when={bookingRatesState.saved}>
      <div {...themed(ratingResultStyle, 'bk-success')}>
        {t('settings.priceSaved')}
      </div>
    </Show>
    <div>
      <ThemeButton
        variant="primary"
        disabled={bookingRatesState.saving}
        onClick={() => void bookingRatesActions.save()}
      >
        {bookingRatesState.saving
          ? t('common.saving')
          : t('settings.savePrice')}
      </ThemeButton>
    </div>
  </div>
)

// Points model: the top-up amounts on offer with their reward points
// (edited with the rest of the page), and the rewards pages.
const RewardsSection = () => {
  const navigate = useNavigate()
  return (
    <div {...themed(sectionStyle, 'bk-card')}>
      <h4 {...themed(sectionHeaderStyle, 'bk-section-title')}>
        {t('settings.rewards')}
      </h4>
      <TopUpOptionsEditor />
      <div style={{ 'margin-top': '16px' }}>
        <div {...themed(linkColumnStyle, 'bk-links')}>
          <button
            type="button"
            {...themed(linkButtonStyle, 'bk-link')}
            onClick={() => navigate('/gifts')}
          >
            {t('settings.gifts')}
          </button>
          <button
            type="button"
            {...themed(linkButtonStyle, 'bk-link')}
            onClick={() => navigate('/redemptions')}
          >
            {t('settings.redemptions')}
          </button>
        </div>
      </div>
    </div>
  )
}

const topUpOptions = (): TopUpOption[] => settingsValue('topUpOptions') ?? []

const setTopUpOption = (
  index: number,
  field: keyof TopUpOption,
  value: string,
) =>
  settingsActions.setDraft(
    'topUpOptions',
    topUpOptions().map((o, i) =>
      i === index ? { ...o, [field]: Number(value.replace(/[^\d]/g, '')) } : o,
    ),
  )

const removeTopUpOption = (index: number) =>
  settingsActions.setDraft(
    'topUpOptions',
    topUpOptions().filter((_, i) => i !== index),
  )

const addTopUpOption = () =>
  settingsActions.setDraft('topUpOptions', [
    ...topUpOptions(),
    { dollars: 0, points: 0 },
  ])

const TopUpOptionsEditor = () => (
  <div style={topUpEditorStyle}>
    <span style={checkboxLabelStyle}>
      <strong>{t('settings.topUpOptions')}</strong> — {t('settings.topUpHint')}
    </span>
    <div class="rw-topup-row rw-topup-head">
      <span>{t('settings.topUpDollars')}</span>
      <span>{t('settings.topUpPoints')}</span>
      <span style={{ width: '32px' }} />
    </div>
    <For each={topUpOptions()}>
      {(option, i) => (
        <div class="rw-topup-row">
          <input
            inputMode="numeric"
            aria-label={t('settings.topUpDollars')}
            value={String(option.dollars)}
            disabled={!settingsState.editing}
            onChange={(e) =>
              setTopUpOption(i(), 'dollars', e.currentTarget.value)
            }
          />
          <input
            inputMode="numeric"
            aria-label={t('settings.topUpPoints')}
            value={String(option.points)}
            disabled={!settingsState.editing}
            onChange={(e) =>
              setTopUpOption(i(), 'points', e.currentTarget.value)
            }
          />
          <Show when={settingsState.editing} fallback={<span style={{ width: '32px' }} />}>
            <button
              type="button"
              class="rw-remove"
              aria-label={t('settings.removeTopUp')}
              title={t('settings.removeTopUp')}
              onClick={() => removeTopUpOption(i())}
            >
              ×
            </button>
          </Show>
        </div>
      )}
    </For>
    <Show when={settingsState.editing}>
      <div>
        <button
          type="button"
          {...themed(linkButtonStyle, 'bk-link')}
          onClick={addTopUpOption}
        >
          + {t('settings.addTopUp')}
        </button>
      </div>
    </Show>
  </div>
)

const topUpEditorStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '8px',
  'max-width': '420px',
}

const hoursRowStyle: JSX.CSSProperties = {
  display: 'grid',
  'grid-template-columns': 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: '0 16px',
  'max-width': '480px',
}

const settingsValue = <K extends keyof AppSettings>(
  field: K,
): AppSettings[K] =>
  settingsState.editing
    ? settingsState.draft[field]
    : settingsState.settings[field]

const SettingNumber = (props: {
  field: keyof AppSettings
  label: string
  min: number
  max: number
}) => (
  <label {...themed(checkboxRowStyle, 'bk-row')}>
    <input
      type="number"
      min={props.min}
      max={props.max}
      value={String(settingsValue(props.field))}
      disabled={!settingsState.editing}
      onChange={(e) => {
        const n = Number((e.target as HTMLInputElement).value)
        if (Number.isFinite(n)) {
          settingsActions.setDraft(
            props.field,
            Math.min(props.max, Math.max(props.min, Math.round(n))) as never,
          )
        }
      }}
      style={numberInputStyle}
    />
    <span style={checkboxLabelStyle}>{props.label}</span>
  </label>
)

const SettingCheckbox = (props: {
  field: keyof AppSettings
  label: string
}) => {
  return (
    <label {...themed(checkboxRowStyle, 'bk-row')}>
      <input
        type="checkbox"
        checked={!!settingsValue(props.field)}
        disabled={!settingsState.editing}
        onChange={(e) =>
          settingsActions.setDraft(
            props.field,
            (e.target as HTMLInputElement).checked,
          )
        }
        style={checkboxStyle}
      />
      <span style={checkboxLabelStyle}>{props.label}</span>
    </label>
  )
}

const IconButton = (props: {
  label: string
  onClick: () => void
  children: JSX.Element
}) => (
  <button
    type="button"
    aria-label={props.label}
    title={props.label}
    {...themed(iconButtonStyle, 'bk-icon-btn')}
    onClick={props.onClick}
  >
    {props.children}
  </button>
)

const EditGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
  </svg>
)

const CancelGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
)

const SaveGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
  </svg>
)

const SpinnerIcon = () => (
  <div style={spinnerStyle} aria-label="Saving">
    <div style={spinnerInnerStyle} />
  </div>
)

const containerStyle: JSX.CSSProperties = {
  'min-height': '100vh',
  'background-color': '#f5f6fa',
}

const contentStyle: JSX.CSSProperties = {
  'max-width': '720px',
  margin: '0 auto',
  padding: '24px',
  display: 'flex',
  'flex-direction': 'column',
  gap: '20px',
}

const titleRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  gap: '12px',
}

const titleStyle: JSX.CSSProperties = {
  margin: 0,
  'font-size': '20px',
  'font-weight': 700,
  color: '#2c3e50',
  'text-align': 'left',
}

const actionIconsStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
}

const iconButtonStyle: JSX.CSSProperties = {
  display: 'inline-flex',
  'align-items': 'center',
  'justify-content': 'center',
  width: '36px',
  height: '36px',
  border: '1px solid #d0d7de',
  'border-radius': '8px',
  background: '#fff',
  color: '#2c3e50',
  cursor: 'pointer',
  padding: 0,
}

const sectionStyle: JSX.CSSProperties = {
  background: '#fff',
  border: '1px solid #e1e4e8',
  'border-radius': '10px',
  padding: '16px 20px',
}

const sectionHeaderStyle: JSX.CSSProperties = {
  margin: '0 0 12px',
  'font-size': '15px',
  'font-weight': 700,
  color: '#2c3e50',
}

const checkboxRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'flex-start',
  gap: '10px',
  cursor: 'pointer',
}

const checkboxStyle: JSX.CSSProperties = {
  width: '18px',
  height: '18px',
  'margin-top': '2px',
  'flex-shrink': 0,
}

const checkboxLabelStyle: JSX.CSSProperties = {
  'font-size': '14px',
  color: '#333',
  'line-height': '1.4',
  // #root centres everything (App.css, from the Vite template), which
  // would otherwise centre a wrapped label under its own first line. The
  // section header above keeps the inherited centring.
  'text-align': 'left',
}

const updateButtonStyle: JSX.CSSProperties = {
  padding: '10px 18px',
  'border-radius': '8px',
  border: 'none',
  background: '#3498db',
  color: '#fff',
  'font-size': '14px',
  'font-weight': 600,
  cursor: 'pointer',
}

const ratingResultStyle: JSX.CSSProperties = {
  'margin-top': '10px',
  'font-size': '13px',
  color: '#27ae60',
  'font-weight': 600,
}

const linkColumnStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'flex-start',
  gap: '10px',
}

const linkButtonStyle: JSX.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: '#3498db',
  'font-size': '14px',
  'font-weight': 600,
  cursor: 'pointer',
  'text-decoration': 'underline',
}

const errorStyle: JSX.CSSProperties = {
  padding: '10px 14px',
  background: '#fdecea',
  color: '#c0392b',
  'border-radius': '8px',
  'font-size': '13px',
}

const spinnerStyle: JSX.CSSProperties = {
  width: '20px',
  height: '20px',
  display: 'inline-flex',
  'align-items': 'center',
  'justify-content': 'center',
}

const spinnerInnerStyle: JSX.CSSProperties = {
  width: '16px',
  height: '16px',
  border: '2px solid #bdc3c7',
  'border-top-color': '#3498db',
  'border-radius': '50%',
  animation: 'spin 0.8s linear infinite',
}

export default Settings

const numberInputStyle: JSX.CSSProperties = {
  width: '64px',
  padding: '4px 8px',
  'border-radius': '6px',
  border: '1px solid #cbd5e0',
  'font-size': '14px',
  'flex-shrink': 0,
}
