// Sales tax on what a club charges by card — specs/rules/booking.md ("Tax").
//
// A club lists its taxes in its config, `booking.taxes`, e.g. Timing Sports
// in BC: [{ "name": "GST", "rate": 5 }] (rate in percent). A club without
// the list charges no tax. Tax is added on top of the price: a guest's card
// booking and a top-up are charged subtotal + tax. A booking paid from the
// balance adds none — its tax was paid when the balance was topped up.
//
// Plain JavaScript, shared by the Netlify functions and the browser.

/** The club's taxes, ignoring incomplete entries. */
export const clubTaxes = (bookingConfig) =>
  (bookingConfig?.taxes || []).filter(
    (t) => t && typeof t.name === 'string' && t.name && Number(t.rate) > 0,
  )

/**
 * A subtotal with its taxes: { subtotalCents, taxes: [{ name, rate, cents }],
 * totalCents }. Each tax is rounded to the cent on its own, as a receipt
 * shows it.
 */
export const withTaxes = (taxes, subtotalCents) => {
  if (!Number.isInteger(subtotalCents) || subtotalCents < 0) {
    throw new Error('Invalid subtotal')
  }
  const lines = (taxes || []).map((t) => ({
    name: t.name,
    rate: Number(t.rate),
    cents: Math.round((subtotalCents * Number(t.rate)) / 100),
  }))
  return {
    subtotalCents,
    taxes: lines,
    totalCents: subtotalCents + lines.reduce((sum, t) => sum + t.cents, 0),
  }
}

/** "GST (5%)" */
export const taxLabel = (tax) => `${tax.name} (${tax.rate}%)`
