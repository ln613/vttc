import { Show, createEffect, on } from 'solid-js'
import DialogFrame from './DialogFrame'
import WaiverContent from './WaiverContent'
import ThemeButton from './ThemeButton'
import { authState } from '../stores/authStore'
import { waiverState, waiverActions } from '../stores/waiverStore'
import { langActions } from '../stores/langStore'
import { hasSiteLook } from '../site/siteContent'
import '../pages/booking.css'

// The club's liability waiver (specs/rules/waiver.md). Checked whenever who
// is signed in changes — after signing up, signing in (with a password or
// Google) and on opening the app — and, while the member hasn't accepted
// the current version, shown over everything with no way to close it except
// accepting or signing out.
const WaiverGate = () => {
  createEffect(
    on(
      () => authState.user?._id,
      (playerId) => void waiverActions.check(playerId),
    ),
  )
  return (
    <Show when={waiverState.mustAccept && waiverActions.text()}>
      {(text) => (
        <div class="waiver-layer">
          <DialogFrame title={text().title}>
            <WaiverContent
              text={text()}
              agreed={waiverState.agreed}
              onAgree={waiverActions.setAgreed}
            />
            <Show when={waiverState.error}>
              <p class="bk-error">{waiverState.error}</p>
            </Show>
            <div class="waiver-actions">
              <ThemeButton
                variant="primary"
                fill={hasSiteLook()}
                onClick={() => void waiverActions.accept()}
                disabled={!waiverState.agreed || waiverState.saving}
              >
                {waiverState.saving
                  ? langActions.t('common.pleaseWait')
                  : langActions.t('waiver.accept')}
              </ThemeButton>
              <button
                type="button"
                class="bk-link waiver-decline"
                onClick={() => waiverActions.decline()}
              >
                {langActions.t('waiver.decline')}
              </button>
            </div>
          </DialogFrame>
        </div>
      )}
    </Show>
  )
}

export default WaiverGate
