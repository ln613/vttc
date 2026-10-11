import { createStore } from 'solid-js/store'
import { apiGet, apiPost } from '../utils/api'
import { langActions } from './langStore'
import { customConfirm } from './confirmDialogStore'
import { shrinkImage } from '../utils/image'
import type { Gift } from './rewardsStore'

// The admin Gifts page: add, edit and remove the gifts members can redeem
// their points for. See specs/pages/Gifts.md.

interface GiftForm {
  _id?: string
  name: string
  description: string
  image: string
  points: string
}

interface GiftsAdminState {
  gifts: Gift[]
  loading: boolean
  error: string | null
  // The add/edit dialog; null while closed.
  form: GiftForm | null
  saving: boolean
  formError: string | null
}

const emptyForm = (): GiftForm => ({
  name: '',
  description: '',
  image: '',
  points: '',
})

const getInitialState = (): GiftsAdminState => ({
  gifts: [],
  loading: false,
  error: null,
  form: null,
  saving: false,
  formError: null,
})

const [giftsAdminState, setGiftsAdminState] =
  createStore<GiftsAdminState>(getInitialState())

export { giftsAdminState }

const t = langActions.t

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback

const load = async () => {
  setGiftsAdminState({ loading: true, error: null })
  try {
    setGiftsAdminState({ gifts: await apiGet<Gift[]>('gifts'), loading: false })
  } catch (err) {
    setGiftsAdminState({
      loading: false,
      error: errorMessage(err, t('gifts.loadFailed')),
    })
  }
}

// ==================== the form ====================

const startAdd = () =>
  setGiftsAdminState({ form: emptyForm(), formError: null })

const startEdit = (gift: Gift) =>
  setGiftsAdminState({
    form: {
      _id: gift._id,
      name: gift.name,
      description: gift.description,
      image: gift.image,
      points: String(gift.points),
    },
    formError: null,
  })

const closeForm = () => setGiftsAdminState({ form: null, formError: null })

const setField = (field: keyof GiftForm, value: string) =>
  setGiftsAdminState('form', (f) => (f ? { ...f, [field]: value } : f))

const setPoints = (value: string) =>
  setField('points', value.replace(/[^\d]/g, ''))

const chooseImage = async (file: File | undefined) => {
  if (!file) return
  try {
    setField('image', await shrinkImage(file))
  } catch {
    setGiftsAdminState({ formError: t('gifts.imageFailed') })
  }
}

const removeImage = () => setField('image', '')

const save = async () => {
  const form = giftsAdminState.form
  if (!form) return
  setGiftsAdminState({ saving: true, formError: null })
  try {
    await apiPost('saveGift', { ...form, points: Number(form.points) })
    setGiftsAdminState({ saving: false, form: null })
    await load()
  } catch (err) {
    setGiftsAdminState({
      saving: false,
      formError: errorMessage(err, t('gifts.loadFailed')),
    })
  }
}

const remove = async (gift: Gift) => {
  const ok = await customConfirm(
    t('gifts.confirmDelete', { name: gift.name }),
    {
      confirmColor: '#e74c3c',
    },
  )
  if (!ok) return
  try {
    await apiPost('deleteGift', { _id: gift._id })
    await load()
  } catch (err) {
    setGiftsAdminState({ error: errorMessage(err, t('gifts.loadFailed')) })
  }
}

const reset = () => setGiftsAdminState(getInitialState())

export const giftsAdminActions = {
  load,
  startAdd,
  startEdit,
  closeForm,
  setField,
  setPoints,
  chooseImage,
  removeImage,
  save,
  remove,
  reset,
}
