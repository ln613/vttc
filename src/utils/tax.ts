import clubConfig from 'club-config'
import { clubTaxes, taxLabel, type TaxLine } from '../../shared/rules/tax'

// The club's sales tax on card payments (shared/rules/tax.js).
const taxes = clubTaxes(clubConfig.booking)

/** "GST (5%)", or '' for a club that charges no tax. */
export const clubTaxNote = (): string => taxes.map(taxLabel).join(' + ')

export type { TaxLine }
