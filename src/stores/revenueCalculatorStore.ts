import { createStore } from 'solid-js/store'
import { apiGet, apiPost } from '../utils/api'
import { customConfirm } from './confirmDialogStore'
import { eventState, eventActions } from './eventStore'

// One row in the calculator. All selections are dropdown string values.
export interface CalcItem {
  id: string
  eventId: string
  participants: string
  registrationFee: string
  prize1: string
  prize2: string
  prize3: string
  prize4: string
}

// Persisted item shape (no local id).
export interface TemplateItem {
  eventId: string
  participants: string
  registrationFee: string
  prize1: string
  prize2: string
  prize3: string
  prize4: string
}

export interface RevenueTemplate {
  _id: string
  name: string
  items: TemplateItem[]
}

interface RevenueCalculatorState {
  items: CalcItem[]
  templates: RevenueTemplate[]
  loading: boolean
  error: string | null
  showLoadDialog: boolean
}

let nextId = 1
const newId = (): string => `item-${nextId++}`

const emptyItem = (): CalcItem => ({
  id: newId(),
  eventId: '',
  participants: '',
  registrationFee: '',
  prize1: '',
  prize2: '',
  prize3: '',
  prize4: '',
})

const getInitialState = (): RevenueCalculatorState => ({
  items: [],
  templates: [],
  loading: false,
  error: null,
  showLoadDialog: false,
})

const [revenueCalculatorState, setRevenueCalculatorState] =
  createStore<RevenueCalculatorState>(getInitialState())

export { revenueCalculatorState }

const num = (s: string): number => {
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

const round2 = (n: number): number => Math.round(n * 100) / 100

const findItemIndex = (id: string): number =>
  revenueCalculatorState.items.findIndex((it) => it.id === id)

const toTemplateItem = (item: CalcItem): TemplateItem => ({
  eventId: item.eventId,
  participants: item.participants,
  registrationFee: item.registrationFee,
  prize1: item.prize1,
  prize2: item.prize2,
  prize3: item.prize3,
  prize4: item.prize4,
})

const fromTemplateItem = (item: TemplateItem): CalcItem => ({
  id: newId(),
  eventId: item.eventId || '',
  participants: item.participants || '',
  registrationFee: item.registrationFee || '',
  prize1: item.prize1 || '',
  prize2: item.prize2 || '',
  prize3: item.prize3 || '',
  prize4: item.prize4 || '',
})

export const revenueCalculatorActions = {
  init: () => {
    void eventActions.fetchEvents()
    void revenueCalculatorActions.fetchTemplates()
    if (revenueCalculatorState.items.length === 0) {
      setRevenueCalculatorState('items', [emptyItem()])
    }
  },

  fetchTemplates: async () => {
    try {
      const templates = await apiGet<RevenueTemplate[]>('revenueTemplates')
      setRevenueCalculatorState({ templates })
    } catch (err) {
      setRevenueCalculatorState({
        error: err instanceof Error ? err.message : 'Failed to load templates',
      })
    }
  },

  addItem: () =>
    setRevenueCalculatorState('items', (items) => [...items, emptyItem()]),

  removeItem: async (id: string) => {
    const ok = await customConfirm('Delete this item?', {
      confirmColor: '#e74c3c',
    })
    if (!ok) return
    setRevenueCalculatorState('items', (items) =>
      items.filter((it) => it.id !== id),
    )
  },

  setItemField: (id: string, field: keyof CalcItem, value: string) => {
    const index = findItemIndex(id)
    if (index === -1) return
    setRevenueCalculatorState('items', index, field, value)
  },

  // Selecting an event auto-fills the registration fee and prize dropdowns
  // from that event's stored values (when available).
  selectEvent: (id: string, eventId: string) => {
    const index = findItemIndex(id)
    if (index === -1) return
    const event = (eventState.data || []).find((e) => e._id === eventId)
    const patch: Partial<CalcItem> = { eventId }
    if (event) {
      patch.registrationFee = event.registrationFee
        ? String(event.registrationFee)
        : ''
      patch.prize1 = event.prizes?.first ? String(event.prizes.first) : ''
      patch.prize2 = event.prizes?.second ? String(event.prizes.second) : ''
      patch.prize3 = event.prizes?.third ? String(event.prizes.third) : ''
      patch.prize4 = event.prizes?.fourth ? String(event.prizes.fourth) : ''
    }
    setRevenueCalculatorState('items', index, patch)
  },

  saveTemplate: async () => {
    const name = window.prompt('Template name')
    if (!name) return
    const exists = revenueCalculatorState.templates.some((t) => t.name === name)
    if (exists) {
      const overwrite = await customConfirm(
        `A template named "${name}" already exists. Overwrite it?`,
      )
      if (!overwrite) return
    }
    try {
      await apiPost('saveRevenueTemplate', {
        name,
        items: revenueCalculatorState.items.map(toTemplateItem),
      })
      await revenueCalculatorActions.fetchTemplates()
    } catch (err) {
      setRevenueCalculatorState({
        error: err instanceof Error ? err.message : 'Failed to save template',
      })
    }
  },

  openLoadDialog: () => setRevenueCalculatorState({ showLoadDialog: true }),
  closeLoadDialog: () => setRevenueCalculatorState({ showLoadDialog: false }),

  loadTemplate: (template: RevenueTemplate) => {
    setRevenueCalculatorState({
      items: template.items.map(fromTemplateItem),
      showLoadDialog: false,
    })
  },

  // ---- derived totals (called in JSX to create tracking scopes) ----

  itemRegistrationFee: (item: CalcItem): number =>
    round2(num(item.participants) * num(item.registrationFee)),

  itemPrize: (item: CalcItem): number =>
    num(item.prize1) + num(item.prize2) + num(item.prize3) + num(item.prize4),

  itemRevenue: (item: CalcItem): number =>
    round2(
      revenueCalculatorActions.itemRegistrationFee(item) -
        revenueCalculatorActions.itemPrize(item),
    ),

  totalRegistrationFee: (): number =>
    round2(
      revenueCalculatorState.items.reduce(
        (sum, it) => sum + revenueCalculatorActions.itemRegistrationFee(it),
        0,
      ),
    ),

  totalRevenue: (): number =>
    round2(
      revenueCalculatorState.items.reduce(
        (sum, it) => sum + revenueCalculatorActions.itemRevenue(it),
        0,
      ),
    ),
}
