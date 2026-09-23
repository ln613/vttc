import { createStore } from 'solid-js/store'
import { apiGet, apiPost } from '../utils/api'

/** A human umpire on the club's roster — see specs/rules/umpires.md. */
export interface Umpire {
  _id: string
  firstName: string
  lastName: string
  umpireId?: string | null
  phone?: string | null
  email?: string | null
  /** Today's table, or null. An older day's assignment never comes back. */
  assignedTable?: number | null
}

export interface UmpireDraft {
  _id?: string
  firstName: string
  lastName: string
  umpireId: string
  phone: string
  email: string
}

interface UmpireState {
  data: Umpire[]
  loading: boolean
  error: string | null
  saving: boolean
  // The Add / Edit dialog, and the table picker behind "Assign Table".
  draft: UmpireDraft | null
  assigningId: string | null
  tableCounts: Record<number, number>
  maxPerTable: number
}

const emptyDraft = (): UmpireDraft => ({
  firstName: '',
  lastName: '',
  umpireId: '',
  phone: '',
  email: '',
})

const getInitialState = (): UmpireState => ({
  data: [],
  loading: false,
  error: null,
  saving: false,
  draft: null,
  assigningId: null,
  tableCounts: {},
  maxPerTable: 1,
})

const [umpireState, setUmpireState] = createStore<UmpireState>(getInitialState())

export { umpireState }

const umpireName = (u: Umpire) => `${u.firstName} ${u.lastName}`.trim()

const fail = (err: unknown, fallback: string) =>
  setUmpireState({
    saving: false,
    error: err instanceof Error ? err.message : fallback,
  })

export const umpireActions = {
  fetchUmpires: async () => {
    setUmpireState({ loading: true, error: null })
    try {
      const data = await apiGet<Umpire[]>('umpires')
      setUmpireState({ data: data || [], loading: false })
    } catch (err) {
      setUmpireState({ loading: false })
      fail(err, 'Failed to load umpires')
    }
  },

  getUmpireName: umpireName,

  // ---- the Add / Edit dialog ----
  startAdding: () => setUmpireState({ draft: emptyDraft(), error: null }),

  startEditing: (umpire: Umpire) =>
    setUmpireState({
      error: null,
      draft: {
        _id: umpire._id,
        firstName: umpire.firstName,
        lastName: umpire.lastName,
        umpireId: umpire.umpireId ?? '',
        phone: umpire.phone ?? '',
        email: umpire.email ?? '',
      },
    }),

  cancelDraft: () => setUmpireState({ draft: null, error: null }),

  setDraftField: (field: keyof UmpireDraft, value: string) =>
    setUmpireState('draft', field, value),

  saveDraft: async () => {
    const draft = umpireState.draft
    if (!draft) return
    setUmpireState({ saving: true, error: null })
    try {
      await apiPost('saveUmpire', draft)
      setUmpireState({ saving: false, draft: null })
      await umpireActions.fetchUmpires()
    } catch (err) {
      fail(err, 'Failed to save umpire')
    }
  },

  deleteUmpire: async (_id: string) => {
    setUmpireState({ error: null })
    try {
      await apiPost('deleteUmpire', { _id })
      await umpireActions.fetchUmpires()
    } catch (err) {
      fail(err, 'Failed to delete umpire')
    }
  },

  // ---- today's table ----
  startAssigning: async (_id: string) => {
    setUmpireState({ error: null })
    try {
      const { counts, maxUmpiresPerTable } = await apiGet<{
        counts: Record<number, number>
        maxUmpiresPerTable: number
      }>('umpireTableCounts')
      setUmpireState({
        assigningId: _id,
        tableCounts: counts || {},
        maxPerTable: maxUmpiresPerTable ?? 1,
      })
    } catch (err) {
      fail(err, 'Failed to read table assignments')
    }
  },

  cancelAssigning: () => setUmpireState({ assigningId: null }),

  // A table the umpire being assigned already holds is not full to them.
  isTableFull: (tableNumber: number): boolean => {
    const held = umpireState.data.find((u) => u._id === umpireState.assigningId)
    if (held?.assignedTable === tableNumber) return false
    return (umpireState.tableCounts[tableNumber] ?? 0) >= umpireState.maxPerTable
  },

  assignTable: async (tableNumber: number) => {
    const _id = umpireState.assigningId
    if (!_id) return
    setUmpireState({ assigningId: null, error: null })
    try {
      await apiPost('assignUmpireTable', { _id, tableNumber })
      await umpireActions.fetchUmpires()
    } catch (err) {
      fail(err, 'Failed to assign the table')
    }
  },

  unassign: async (_id: string) => {
    setUmpireState({ error: null })
    try {
      await apiPost('unassignUmpire', { _id })
      await umpireActions.fetchUmpires()
    } catch (err) {
      fail(err, 'Failed to unassign')
    }
  },

  reset: () => setUmpireState(getInitialState()),
}
