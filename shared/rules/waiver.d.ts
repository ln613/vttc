export interface WaiverAcceptance {
  version: string
  acceptedAt: string | Date
}

export declare const requiredWaiver: (
  config: { liabilityWaiver?: { required?: boolean; version: string } } | null | undefined,
) => { version: string } | null

export declare const hasAcceptedWaiver: (
  config: { liabilityWaiver?: { required?: boolean; version: string } } | null | undefined,
  player: { waiver?: WaiverAcceptance | null } | null | undefined,
) => boolean
