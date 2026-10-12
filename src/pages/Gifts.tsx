import { Show, For, onMount, onCleanup } from 'solid-js'
import { Header } from '../components/Header'
import PageHead from '../components/PageHead'
import Input from '../components/Input'
import GiftImage from '../components/GiftImage'
import { authState } from '../stores/authStore'
import { giftsAdminState, giftsAdminActions } from '../stores/giftsAdminStore'
import type { Gift } from '../stores/rewardsStore'
import { langActions } from '../stores/langStore'
import { formatPoints } from '../i18n/wallet'
import { hasSiteLook, loadSiteFonts } from '../site/siteContent'
import './booking.css'

// Admin: the gifts members can redeem their points for — name, description,
// image and the points each takes. See specs/pages/Gifts.md.

const t = langActions.t

const Gifts = () => {
  onMount(() => {
    loadSiteFonts()
    if (authState.isAdmin) void giftsAdminActions.load()
  })
  onCleanup(() => giftsAdminActions.reset())

  return (
    <div class={hasSiteLook() ? 'bk bk-site' : 'bk'}>
      <Header />
      <Show when={authState.isAdmin}>
        <PageHead
          kicker={t('gifts.kicker')}
          title={t('gifts.title')}
          actions={
            <button
              type="button"
              class="bk-btn bk-btn-primary bk-btn-small"
              onClick={() => giftsAdminActions.startAdd()}
            >
              {t('gifts.add')}
            </button>
          }
        />
        <div class="bk-wrap">
          <Show when={giftsAdminState.error}>
            <div class="bk-error">{giftsAdminState.error}</div>
          </Show>
          <GiftList />
        </div>
        <GiftFormDialog />
      </Show>
    </div>
  )
}

const GiftList = () => (
  <Show
    when={!giftsAdminState.loading}
    fallback={<p class="bk-loading">{t('common.loading')}</p>}
  >
    <Show
      when={giftsAdminState.gifts.length > 0}
      fallback={<p class="bk-hint">{t('gifts.none')}</p>}
    >
      <div class="rw-grid">
        <For each={giftsAdminState.gifts}>
          {(gift) => <AdminGiftCard gift={gift} />}
        </For>
      </div>
    </Show>
  </Show>
)

const AdminGiftCard = (props: { gift: Gift }) => (
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
        <span style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            class="bk-link"
            onClick={() => giftsAdminActions.startEdit(props.gift)}
          >
            {t('gifts.edit')}
          </button>
          <button
            type="button"
            class="bk-link"
            style={{ color: '#c0392b' }}
            onClick={() => void giftsAdminActions.remove(props.gift)}
          >
            {t('gifts.delete')}
          </button>
        </span>
      </div>
    </div>
  </div>
)

// ==================== add / edit ====================

const GiftFormDialog = () => (
  <Show when={giftsAdminState.form}>
    {(form) => (
      <div class="bk-overlay" onClick={() => giftsAdminActions.closeForm()}>
        <div class="bk-dialog" onClick={(e) => e.stopPropagation()}>
          <div class="bk-dialog-head">
            <h2 class="bk-dialog-title">
              {form()._id ? t('gifts.editTitle') : t('gifts.addTitle')}
            </h2>
          </div>
          <div class="bk-dialog-body">
            <Input
              label={t('gifts.name')}
              name="giftName"
              value={form().name}
              onChange={(v) => giftsAdminActions.setField('name', v)}
              maxLength={80}
              required
            />
            <Input
              label={t('gifts.description')}
              name="giftDescription"
              value={form().description}
              onChange={(v) => giftsAdminActions.setField('description', v)}
              multiline
              rows={3}
              maxLength={500}
            />
            <ImageField image={form().image} />
            <Input
              label={t('gifts.points')}
              name="giftPoints"
              value={form().points}
              onChange={giftsAdminActions.setPoints}
              inputMode="numeric"
              required
            />
            <Show when={giftsAdminState.formError}>
              <p class="bk-error">{giftsAdminState.formError}</p>
            </Show>
            <div class="bk-actions">
              <button
                type="button"
                class="bk-btn bk-btn-secondary bk-btn-fill"
                onClick={() => giftsAdminActions.closeForm()}
                disabled={giftsAdminState.saving}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                class="bk-btn bk-btn-primary bk-btn-fill"
                onClick={() => void giftsAdminActions.save()}
                disabled={giftsAdminState.saving}
              >
                {giftsAdminState.saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </Show>
)

const ImageField = (props: { image: string }) => (
  <div>
    <span class="rw-label">{t('gifts.image')}</span>
    <div class="rw-file-row">
      <Show when={props.image}>
        <img class="rw-image-preview" src={props.image} alt="" />
      </Show>
      <label class="bk-btn bk-btn-secondary bk-btn-small">
        {props.image ? t('gifts.changeImage') : t('gifts.chooseImage')}
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void giftsAdminActions.chooseImage(e.currentTarget.files?.[0])
            e.currentTarget.value = ''
          }}
        />
      </label>
      <Show when={props.image}>
        <button
          type="button"
          class="bk-link"
          onClick={() => giftsAdminActions.removeImage()}
        >
          {t('gifts.removeImage')}
        </button>
      </Show>
    </div>
  </div>
)

export default Gifts
