// Shared dropdown options for event registration fee and place prizes, used
// by both the Event Edit page and the Revenue Calculator.

export interface NumberOption {
  value: string
  label: string
}

const generateRegistrationFeeOptions = (): NumberOption[] => {
  const options: NumberOption[] = [{ value: '', label: '' }]
  for (let i = 10; i <= 100; i += 5) {
    options.push({ value: String(i), label: `$${i}` })
  }
  return options
}

const generatePrizeOptions = (): NumberOption[] => {
  const options: NumberOption[] = [{ value: '', label: '' }]
  const fixed = [300, 250, 200, 180, 175, 150, 125, 120, 100]
  for (const v of fixed) options.push({ value: String(v), label: `$${v}` })
  for (let i = 95; i >= 5; i -= 5) {
    options.push({ value: String(i), label: `$${i}` })
  }
  return options
}

export const REGISTRATION_FEE_OPTIONS = generateRegistrationFeeOptions()
export const PRIZE_OPTIONS = generatePrizeOptions()
