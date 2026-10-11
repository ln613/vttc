import clubConfig from 'club-config'
import { langActions } from '../stores/langStore'
import {
  bookingRules,
  formatCredits,
  formatDollars,
} from '../../shared/rules/booking'
import { balanceCents, isPointsModel } from '../../shared/rules/wallet'

// How this club's balance reads — specs/rules/wallet.md. A credits club
// shows "3,000 credits"; a points club keeps its balance in dollars
// ("$30.00") and its reward points apart. The wording that differs lives
// under wallet.credits.* and wallet.points.* in the language files.

export const pointsModel = isPointsModel(clubConfig)

const creditsPerDollar = bookingRules(clubConfig.booking).creditsPerDollar

/** A balance (stored credits) as this club shows it. */
export const formatBalance = (credits: number): string =>
  pointsModel
    ? formatDollars(balanceCents(credits, creditsPerDollar))
    : langActions.t('wallet.credits.amount', {
        credits: formatCredits(credits),
      })

/** The model's own wording for `key`, e.g. walletT('notEnough'). */
export const walletT = (key: string, vars?: Record<string, string | number>) =>
  langActions.t(`wallet.${pointsModel ? 'points' : 'credits'}.${key}`, vars)

export const formatPoints = (points: number): string =>
  points.toLocaleString('en-US')
