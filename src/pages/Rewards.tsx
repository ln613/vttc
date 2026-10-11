import { Show, For, onMount, onCleanup } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { Header } from '../components/Header'
import PageHead from '../components/PageHead'
import GiftImage from '../components/GiftImage'
import Select from '../components/Select'
import { authState, authActions } from '../stores/authStore'
import { creditsState, creditsActions } from '../stores/creditsStore'
import { rewardsState, rewardsActions, type Gift } from '../stores/rewardsStore'
import { langActions } from '../stores/langStore'
import { clubIdOf, MAX_REDEEM_QUANTITY } from '../../shared/rules/wallet'
import { formatPoints } from '../i18n/wallet'
import { hasSite, loadSiteFonts } from '../site/siteContent'
import './booking.css'

// The club's gifts and the points each takes. Members look; an admin
// redeems one for a member at the desk. See specs/pages/Rewards.md.

const t = langActions.t

const Rewards = () => {
  onMount(() => {
    loadSiteFonts()
    rewardsActions.init()
  })
  onCleanup(() => rewardsActions.reset())

  return (
    <div class={hasSite() ? 'bk bk-site' : 'bk'}>
      <Header />
      <PageHead kicker={t('rewards.kicker')} title={t('rewards.title')} />
      <div class="bk-wrap">
        <p class="bk-hint">{t('rewards.intro')}</p>
        <PointsCard />
        <Show when={rewardsState.error}>
          <div class="bk-error">{rewardsState.error}</div>
        </Show>
        <GiftGrid />
      </div>
      <RedeemDialog />
    </div>
  )
}

// ==================== who is looking ====================

const PointsCard = () => (
  <div class="bk-card">
    <Show when={authState.isAdmin} fallback={<MemberPoints />}>
      <AdminLinks />
    </Show>
  </div>
)

const MemberPoints = () => {
  const navigate = useNavigate()
  return (
    <>
      <Show
        when={creditsActions.isPlayer()}
        fallback={
          <p class="bk-note">
            <button
              type="button"
              class="bk-link"
              onClick={() => authActions.showSignInDialog()}
            >
              {t('booking.signIn')}
            </button>{' '}
            — {t('rewards.signInForPoints')}
          </p>
        }
      >
        <div class="rw-points">
          <span>
            {t('rewards.yourPoints')}:{' '}
            <strong>{formatPoints(creditsState.points ?? 0)}</strong>
          </span>
          <span class="rw-meta">
            {t('rewards.clubId')}: {clubIdOf(authState.user?._id)}
          </span>
        </div>
        <button
          type="button"
          class="bk-link"
          style={{ 'margin-top': '8px' }}
          onClick={() => navigate('/redemptions')}
        >
          {t('rewards.history')}
        </button>
      </Show>
      <p class="bk-note" style={{ 'margin-top': '10px' }}>
        {t('rewards.atClub')}
      </p>
    </>
  )
}

const AdminLinks = () => {
  const navigate = useNavigate()
  return (
    <div
      class="bk-links"
      style={{ display: 'flex', gap: '16px', 'flex-wrap': 'wrap' }}
    >
      <button type="button" class="bk-link" onClick={() => navigate('/gifts')}>
        {t('rewards.manageGifts')}
      </button>
      <button
        type="button"
        class="bk-link"
        onClick={() => navigate('/redemptions')}
      >
        {t('rewards.history')}
      </button>
    </div>
  )
}

// ==================== the gifts ====================

const GiftGrid = () => (
  <Show
    when={!rewardsState.loading}
    fallback={<p class="bk-loading">{t('common.loading')}</p>}
  >
    <Show
      when={rewardsState.gifts.length > 0}
      fallback={<p class="bk-hint">{t('rewards.none')}</p>}
    >
      <div class="rw-grid">
        <For each={rewardsState.gifts}>
          {(gift) => <GiftCard gift={gift} />}
        </For>
      </div>
    </Show>
  </Show>
)

const GiftCard = (props: { gift: Gift }) => (
  <div class="rw-gift">
    <GiftImage gift={props.gift} />
    <div class="rw-gift-body">
      <h3 class="rw-gift-name">{props.gift.name}</h3>
      <Show when={props.gift.description}>
        <p class="rw-gift-desc">{props.gift.description}</p>
      </Show>
      <div class="rw-gift-foot">
        <span class="rw-gift-points">
          {t('rewards.points', { points: formatPoints(props.gift.points) })}
        </span>
        <Show when={authState.isAdmin}>
          <button
            type="button"
            class="bk-btn bk-btn-primary bk-btn-small"
            onClick={() => rewardsActions.openRedeem(props.gift)}
          >
            {t('rewards.redeem')}
          </button>
        </Show>
      </div>
    </div>
  </div>
)

// ==================== redeeming (admin) ====================

const RedeemDialog = () => (
  <Show when={rewardsState.redeemGift}>
    {(gift) => (
      <div class="bk-overlay" onClick={() => rewardsActions.closeRedeem()}>
        <div class="bk-dialog" onClick={(e) => e.stopPropagation()}>
          <div class="bk-dialog-head">
            <h2 class="bk-dialog-title">
              {t('rewards.redeemTitle', { gift: gift().name })}
            </h2>
          </div>
          <div class="bk-dialog-body">
            <RedeemGiftSummary gift={gift()} />
            <QuantityPicker />
            <Select
              label={t('rewards.member')}
              name="redeemMember"
              value={rewardsState.memberId}
              onChange={rewardsActions.chooseMember}
              options={rewardsActions.memberOptions()}
              placeholder={t('rewards.chooseMember')}
              noMargin
            />
            <MemberBalance />
            <div class="bk-price-row">
              <span>{t('rewards.needed')}</span>
              <span class="bk-price">
                {formatPoints(rewardsActions.pointsNeeded())}
              </span>
            </div>
            <Show
              when={
                rewardsActions.selectedMember() &&
                !rewardsActions.hasEnoughPoints()
              }
            >
              <p class="bk-warn">{t('rewards.notEnough')}</p>
            </Show>
            <Show when={rewardsState.redeemError}>
              <p class="bk-error">{rewardsState.redeemError}</p>
            </Show>
            <div class="bk-actions">
              <button
                type="button"
                class="bk-btn bk-btn-secondary bk-btn-fill"
                onClick={() => rewardsActions.closeRedeem()}
                disabled={rewardsState.busy}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                class="bk-btn bk-btn-primary bk-btn-fill"
                onClick={() => void rewardsActions.confirmRedeem()}
                disabled={!rewardsActions.canConfirm()}
              >
                {rewardsState.busy
                  ? t('rewards.redeeming')
                  : t('rewards.confirm')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </Show>
)

// What is being redeemed: the gift's picture and what one costs.
const RedeemGiftSummary = (props: { gift: Gift }) => (
  <div class="rw-redeem-gift">
    <GiftImage gift={props.gift} />
    <div class="rw-row-main">
      <strong>{props.gift.name}</strong>
      <span class="rw-gift-points">
        {t('rewards.pointsEach', { points: formatPoints(props.gift.points) })}
      </span>
    </div>
  </div>
)

const QuantityPicker = () => (
  <div>
    <span class="rw-label">{t('rewards.quantity')}</span>
    <div class="rw-qty">
      <button
        type="button"
        class="rw-qty-btn"
        aria-label={t('rewards.fewer')}
        onClick={() => rewardsActions.fewer()}
        disabled={rewardsState.quantity <= 1}
      >
        −
      </button>
      <span class="rw-qty-value" aria-live="polite">
        {rewardsState.quantity}
      </span>
      <button
        type="button"
        class="rw-qty-btn"
        aria-label={t('rewards.more')}
        onClick={() => rewardsActions.more()}
        disabled={rewardsState.quantity >= MAX_REDEEM_QUANTITY}
      >
        +
      </button>
    </div>
  </div>
)

const MemberBalance = () => (
  <Show when={rewardsActions.selectedMember()}>
    {(member) => (
      <p class="bk-note">
        {t('rewards.memberPoints', {
          name: member().name,
          points: formatPoints(member().points),
        })}
      </p>
    )}
  </Show>
)

export default Rewards
