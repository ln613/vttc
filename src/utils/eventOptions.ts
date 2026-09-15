// Shared dropdown options for event registration fee and place prizes, used
// by both the Event Edit page and the Revenue Calculator.

export interface NumberOption {
  value: string
  label: string
}

const toOptions = (amounts: number[]): NumberOption[] => [
  { value: '', label: '' },
  ...amounts.map((v) => ({ value: String(v), label: `$${v}` })),
]

// 10 to 100 every 5, the odd amounts in between, then 50 apart up to 500.
const generateRegistrationFeeOptions = (): NumberOption[] => {
  const amounts: number[] = []
  for (let i = 10; i <= 100; i += 5) amounts.push(i)
  amounts.push(120, 125, 150, 175, 180, 200)
  for (let i = 250; i <= 500; i += 50) amounts.push(i)
  return toOptions(amounts)
}

// 1000 down to 200 every 50, the odd amounts in between, then 5 apart to 5.
const generatePrizeOptions = (): NumberOption[] => {
  const amounts: number[] = []
  for (let i = 1000; i >= 200; i -= 50) amounts.push(i)
  amounts.push(180, 175, 150, 125, 120, 100)
  for (let i = 95; i >= 5; i -= 5) amounts.push(i)
  return toOptions(amounts)
}

export const REGISTRATION_FEE_OPTIONS = generateRegistrationFeeOptions()
export const PRIZE_OPTIONS = generatePrizeOptions()
