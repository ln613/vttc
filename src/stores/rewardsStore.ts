import { createStore } from 'solid-js/store'
import { apiGet, apiPost } from '../utils/api'
import { authState } from './authStore'
import { creditsActions } from './creditsStore'
import { langActions } from './langStore'
import { customAlert } from './confirmDialogStore'
import {
  MAX_REDEEM_QUANTITY,
  redemptionPoints,
} from '../../shared/rules/wallet'
import { formatPoints } from '../i18n/wallet'

// The Rewards page: the club's gifts and what each takes in points, and —
// for an admin — redeeming one for a member. See specs/pages/Rewards.md and
// specs/rules/wallet.md.

export interface Gift {
  _id: string
  name: string
  description: string
  image: string
  points: number
}

export interface RewardMember {
  _id: string
  name: string
  clubId: string
  points: number
}

interface RewardsState {
  gifts: Gift[]
  loading: boolean
  error: string | null
  // The redeem dialog (admin).
  redeemGift: Gift | null
  quantity: number
  members: RewardMember[]
  memberId: string
  busy: boolean
  redeemError: string | null
}

const getInitialState = (): RewardsState => ({
  gifts: [],
  loading: false,
  error: null,
  redeemGift: null,
  quantity: 1,
  members: [],
  memberId: '',
  busy: false,
  redeemError: null,
})

const [rewardsState, setRewardsState] =
  createStore<RewardsState>(getInitialState())

export { rewardsState }

const t = langActions.t

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback

// ==================== the gifts ====================

const loadGifts = async () => {
  setRewardsState({ loading: true, error: null })
  try {
    const gifts = await apiGet<Gift[]>('gifts')
    setRewardsState({ gifts, loading: false })
  } catch (err) {
    setRewardsState({
      loading: false,
      error: errorMessage(err, t('rewards.loadFailed')),
    })
  }
}

// The page opens with the gifts, the signed-in member's own points, and —
// for an admin — the members a gift can be redeemed for.
const init = () => {
  void loadGifts()
  if (creditsActions.isPlayer()) void creditsActions.fetchBalance()
  if (authState.isAdmin) void loadMembers()
}

// ==================== redeeming (admin) ====================

const loadMembers = async () => {
  try {
    setRewardsState({ members: await apiGet<RewardMember[]>('rewardMembers') })
  } catch (err) {
    setRewardsState({ redeemError: errorMessage(err, t('rewards.loadFailed')) })
  }
}

const openRedeem = (gift: Gift) =>
  setRewardsState({
    redeemGift: gift,
    quantity: 1,
    memberId: '',
    busy: false,
    redeemError: null,
  })

const closeRedeem = () =>
  setRewardsState({ redeemGift: null, redeemError: null, busy: false })

const clampQuantity = (n: number) =>
  Math.min(MAX_REDEEM_QUANTITY, Math.max(1, n))

const fewer = () => setRewardsState('quantity', (q) => clampQuantity(q - 1))
const more = () => setRewardsState('quantity', (q) => clampQuantity(q + 1))

const chooseMember = (memberId: string) =>
  setRewardsState({ memberId, redeemError: null })

const selectedMember = (): RewardMember | undefined =>
  rewardsState.members.find((m) => m._id === rewardsState.memberId)

const pointsNeeded = (): number =>
  rewardsState.redeemGift
    ? redemptionPoints(rewardsState.redeemGift.points, rewardsState.quantity)
    : 0

const hasEnoughPoints = (): boolean =>
  (selectedMember()?.points ?? 0) >= pointsNeeded()

const canConfirm = (): boolean =>
  !!selectedMember() && hasEnoughPoints() && !rewardsState.busy

// "Ann Lee (A1B2C3) — 1,250 points", for the member dropdown.
const memberOptions = () =>
  rewardsState.members.map((m) => ({
    value: m._id,
    label: `${m.name} (${m.clubId})`,
  }))

const confirmRedeem = async () => {
  const gift = rewardsState.redeemGift
  const member = selectedMember()
  if (!gift || !member || !canConfirm()) return
  setRewardsState({ busy: true, redeemError: null })
  try {
    const result = await apiPost<{ points: number }>('redeemGift', {
      giftId: gift._id,
      playerId: member._id,
      quantity: rewardsState.quantity,
    })
    setRewardsState(
      'members',
      (m) => m._id === member._id,
      'points',
      result.points,
    )
    const done = t('rewards.redeemed', {
      quantity: rewardsState.quantity,
      gift: gift.name,
      name: member.name,
      points: formatPoints(result.points),
    })
    setRewardsState({ redeemGift: null, busy: false })
    // What happened, in a dialog the admin dismisses.
    void customAlert(done)
    // The admin may be redeeming for themselves.
    if (creditsActions.isPlayer()) void creditsActions.fetchBalance()
  } catch (err) {
    setRewardsState({
      busy: false,
      redeemError: errorMessage(err, t('rewards.notEnough')),
    })
  }
}

const reset = () => setRewardsState(getInitialState())

export const rewardsActions = {
  init,
  loadGifts,
  openRedeem,
  closeRedeem,
  fewer,
  more,
  chooseMember,
  selectedMember,
  pointsNeeded,
  hasEnoughPoints,
  canConfirm,
  memberOptions,
  confirmRedeem,
  reset,
}
