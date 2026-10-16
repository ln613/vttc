export interface ClubTax {
  name: string
  rate: number // percent
}

export interface TaxLine extends ClubTax {
  cents: number
}

export interface Taxed {
  subtotalCents: number
  taxes: TaxLine[]
  totalCents: number
}

export declare const clubTaxes: (
  bookingConfig: { taxes?: ClubTax[] } | null | undefined,
) => ClubTax[]

export declare const withTaxes: (taxes: ClubTax[], subtotalCents: number) => Taxed

export declare const taxLabel: (tax: ClubTax) => string
