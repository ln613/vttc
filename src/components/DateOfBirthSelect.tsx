import type { JSX } from 'solid-js'
import Select from './Select'
import { daysInMonth, type DatePart } from '../utils/date'

// A date of birth as three dropdowns rather than a calendar: nobody wants to
// page back forty years one month at a time to find their birthday.
//
// Controlled: the parts live in the caller's store, and this only draws them.
// A part is '' until chosen.

interface DateOfBirthSelectProps {
  year: string
  month: string
  day: string
  onChange: (part: DatePart, value: string) => void
}

// Short names: three dropdowns share one row on a phone, and a full
// "September" leaves the year too narrow to read.
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const OLDEST_AGE = 100

const yearOptions = () => {
  const thisYear = new Date().getFullYear()
  return Array.from({ length: OLDEST_AGE + 1 }, (_, i) => {
    const y = String(thisYear - i)
    return { value: y, label: y }
  })
}

const monthOptions = MONTHS.map((label, i) => ({ value: String(i + 1), label }))

const dayOptions = (month: string, year: string) => {
  const count = month ? daysInMonth(Number(month), Number(year) || undefined) : 31
  return Array.from({ length: count }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  }))
}

const DateOfBirthSelect = (props: DateOfBirthSelectProps) => (
  <div style={rowStyle}>
    <div style={yearCellStyle}>
      <Select
        label="Year"
        name="dobYear"
        value={props.year}
        onChange={(v) => props.onChange('year', v)}
        options={yearOptions()}
        placeholder="—"
        noMargin
      />
    </div>
    <div style={monthCellStyle}>
      <Select
        label="Month"
        name="dobMonth"
        value={props.month}
        onChange={(v) => props.onChange('month', v)}
        options={monthOptions}
        placeholder="—"
        noMargin
      />
    </div>
    <div style={dayCellStyle}>
      <Select
        label="Day"
        name="dobDay"
        value={props.day}
        onChange={(v) => props.onChange('day', v)}
        options={dayOptions(props.month, props.year)}
        placeholder="—"
        noMargin
      />
    </div>
  </div>
)

const rowStyle: JSX.CSSProperties = {
  display: 'flex',
  gap: '8px',
  'margin-bottom': '16px',
}

const yearCellStyle: JSX.CSSProperties = { flex: '1.15 1 0', 'min-width': 0 }
const monthCellStyle: JSX.CSSProperties = { flex: '1 1 0', 'min-width': 0 }
const dayCellStyle: JSX.CSSProperties = { flex: '0.95 1 0', 'min-width': 0 }

export default DateOfBirthSelect
