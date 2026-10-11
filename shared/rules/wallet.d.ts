export type CreditModel = 'credits' | 'points'

export interface TopUpOption {
  dollars: number
  points: number
}

export declare const CREDIT_MODELS: CreditModel[]

export declare const creditModelOf: (
  config: { creditModel?: string } | null | undefined,
) => CreditModel

export declare const isPointsModel: (
  config: { creditModel?: string } | null | undefined,
) => boolean

export declare const DEFAULT_TOP_UP_OPTIONS: TopUpOption[]

export declare const topUpOptionsError: (options: unknown) => string | null

export declare const sortTopUpOptions: (
  options: { dollars: number | string; points: number | string }[],
) => TopUpOption[]

export declare const findTopUpOption: (
  options: TopUpOption[] | null | undefined,
  dollars: number | string,
) => TopUpOption | undefined

export declare const balanceCents: (
  credits: number,
  creditsPerDollar: number,
) => number

export declare const MAX_REDEEM_QUANTITY: number

export declare const redemptionPoints: (
  giftPoints: number,
  quantity: number,
) => number

export declare const isValidRedeemQuantity: (quantity: number) => boolean

export declare const clubIdOf: (playerId: string | null | undefined) => string
