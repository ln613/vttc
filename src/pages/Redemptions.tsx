import { Show, For, onMount, onCleanup } from 'solid-js'
import { Header } from '../components/Header'
import PageHead from '../components/PageHead'
import { authActions } from '../stores/authStore'
import {
  redemptionsState,
  redemptionsActions,
  type Redemption,
} from '../stores/redemptionsStore'
import { langActions } from '../stores/langStore'
import { formatPoints } from '../i18n/wallet'
import { hasSiteLook, loadSiteFonts } from '../site/siteContent'
import './booking.css'

// What has been redeemed: a member's own gifts, or — for an admin — every
// member's, newest first. See specs/pages/Redemptions.md.

const t = langActions.t

const Redemptions = () => {
  onMount(() => {
    loadSiteFonts()
    if (authActions.isSignedIn()) void redemptionsActions.load()
  })
  onCleanup(() => redemptionsActions.reset())

  return (
    <div class={hasSiteLook() ? 'bk bk-site' : 'bk'}>
      <Header />
      <PageHead
        kicker={t('redemptions.kicker')}
        title={
          redemptionsActions.showsAll()
            ? t('redemptions.allTitle')
            : t('redemptions.title')
        }
      />
      <div class="bk-wrap">
        <Show
          when={authActions.isSignedIn()}
          fallback={<p class="bk-hint">{t('rewards.signInForPoints')}</p>}
        >
          <Show when={redemptionsState.points !== null}>
            <p class="bk-hint">
              {t('rewards.yourPoints')}:{' '}
              <strong>{formatPoints(redemptionsState.points ?? 0)}</strong>
            </p>
          </Show>
          <Show when={redemptionsActions.showsAll()}>
            <input
              class="rw-search"
              type="search"
              placeholder={t('redemptions.search')}
              value={redemptionsState.search}
              onInput={(e) =>
                redemptionsActions.setSearch(e.currentTarget.value)
              }
            />
          </Show>
          <Show when={redemptionsState.error}>
            <div class="bk-error">{redemptionsState.error}</div>
          </Show>
          <RedemptionList />
        </Show>
      </div>
    </div>
  )
}

const RedemptionList = () => (
  <Show
    when={!redemptionsState.loading}
    fallback={<p class="bk-loading">{t('common.loading')}</p>}
  >
    <Show
      when={redemptionsActions.shown().length > 0}
      fallback={<p class="bk-hint">{t('redemptions.none')}</p>}
    >
      <div class="rw-list">
        <For each={redemptionsActions.shown()}>
          {(r) => <RedemptionRow redemption={r} />}
        </For>
      </div>
    </Show>
  </Show>
)

const RedemptionRow = (props: { redemption: Redemption }) => (
  <div class="rw-row">
    <div class="rw-row-main">
      <strong>
        {t('redemptions.item', {
          quantity: props.redemption.quantity,
          gift: props.redemption.giftName,
        })}
      </strong>
      <Show when={redemptionsActions.showsAll()}>
        <span>
          {props.redemption.playerName} ({props.redemption.clubId})
        </span>
      </Show>
      <span class="rw-meta">
        {langActions.instant(props.redemption.createdAt)}
      </span>
      <Show when={redemptionsActions.showsAll()}>
        <span class="rw-meta">
          {t('redemptions.by', { name: props.redemption.redeemedBy })}
        </span>
      </Show>
    </div>
    <div class="rw-row-side">
      <strong>
        {t('redemptions.points', {
          points: formatPoints(props.redemption.points),
        })}
      </strong>
      <span class="rw-meta">
        {t('redemptions.pointsLeft', {
          points: formatPoints(props.redemption.pointsAfter),
        })}
      </span>
    </div>
  </div>
)

export default Redemptions
