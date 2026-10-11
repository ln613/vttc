import { createStore } from 'solid-js/store'
import clubConfig from 'club-config'
import { apiGet, apiPost } from '../utils/api'
import { authActions } from './authStore'
import { langState, langActions } from './langStore'
import type { SiteLanguage } from '../site/siteContent'
import { requiredWaiver } from '../../shared/rules/waiver'

// The club's liability waiver — see specs/rules/waiver.md. While a signed-in
// member hasn't accepted the current version, the app shows it and nothing
// else can be used until they accept (or sign out).

export interface WaiverText {
  title: string
  intro: string
  sections: { heading: string; body: string }[]
  agree: string
}

// clubs/<slug>/waiver.json: the text in each language the club writes it in.
const waiverFiles = import.meta.glob<Partial<Record<SiteLanguage, WaiverText>>>(
  'club-dir/waiver.json',
  { eager: true, import: 'default' },
)
const waiverByLanguage = Object.values(waiverFiles)[0] ?? {}

interface WaiverState {
  // The member it was checked for, so a different sign-in checks again.
  checkedFor: string | null
  mustAccept: boolean
  version: string
  agreed: boolean
  saving: boolean
  error: string | null
}

const getInitialState = (): WaiverState => ({
  checkedFor: null,
  mustAccept: false,
  version: '',
  agreed: false,
  saving: false,
  error: null,
})

const [waiverState, setWaiverState] = createStore<WaiverState>(getInitialState())

export { waiverState }

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback

/** The waiver in the current language (English when it isn't written in it). */
const text = (): WaiverText | undefined =>
  waiverByLanguage[langState.lang] ?? waiverByLanguage.en

/**
 * Ask the server whether this member still has to accept. Only a member
 * with a player record, at a club that requires a waiver.
 */
const check = async (playerId: string | null | undefined) => {
  if (!playerId || !requiredWaiver(clubConfig) || !authActions.hasPlayerRecord()) {
    return setWaiverState(getInitialState())
  }
  if (waiverState.checkedFor === playerId) return
  setWaiverState({ ...getInitialState(), checkedFor: playerId })
  try {
    const result = await apiGet<{
      required: boolean
      version?: string
      accepted?: boolean
    }>('myWaiver')
    setWaiverState({
      mustAccept: result.required && !result.accepted,
      version: result.version ?? '',
    })
  } catch {
    // Unknown for now: ask again on the next sign-in or page load.
    setWaiverState({ checkedFor: null })
  }
}

const setAgreed = (agreed: boolean) => setWaiverState({ agreed, error: null })

const accept = async () => {
  if (!waiverState.agreed || waiverState.saving) return
  setWaiverState({ saving: true, error: null })
  try {
    await apiPost('acceptWaiver', { version: waiverState.version })
    setWaiverState({ mustAccept: false, saving: false })
  } catch (err) {
    setWaiverState({
      saving: false,
      error: errorMessage(err, langActions.t('waiver.failed')),
    })
  }
}

// Not agreeing means not using the account: sign out.
const decline = () => {
  authActions.signOut()
  setWaiverState(getInitialState())
}

export const waiverActions = { text, check, setAgreed, accept, decline }
