import { createSignal, onMount, onCleanup, Show, For, type JSX } from 'solid-js'

interface DatePickerProps {
  label?: string
  value: Date | null
  onChange: (date: Date | null) => void
  class?: string
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const shortMonths = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const formatDate = (date: Date | null): string => {
  if (!date) return ''
  return `${shortMonths[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

const getDaysInMonth = (year: number, month: number): number =>
  new Date(year, month + 1, 0).getDate()

const getFirstDayOfMonth = (year: number, month: number): number =>
  new Date(year, month, 1).getDay()

const containerStyle: JSX.CSSProperties = {
  position: 'relative',
  'margin-bottom': '16px',
}

const labelStyle: JSX.CSSProperties = {
  display: 'block',
  'font-weight': 700,
  'font-size': '14px',
  'margin-bottom': '8px',
  color: '#333',
  'text-align': 'left',
}

const dateBoxStyle: JSX.CSSProperties = {
  padding: '12px 16px',
  'font-size': '14px',
  border: '2px solid #3498db',
  'border-radius': '4px',
  'background-color': '#fff',
  color: '#333',
  cursor: 'pointer',
  'min-width': '150px',
  'user-select': 'none',
}

const calendarStyle: JSX.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: '0',
  'background-color': '#fff',
  border: '1px solid #ddd',
  'border-radius': '8px',
  'box-shadow': '0 4px 12px rgba(0, 0, 0, 0.15)',
  'z-index': 1000,
  padding: '12px',
  'margin-top': '4px',
  width: '280px',
}

const yearHeaderStyle: JSX.CSSProperties = {
  'text-align': 'center',
  'margin-bottom': '8px',
  'font-size': '16px',
  'font-weight': 600,
  cursor: 'pointer',
  color: '#3498db',
  position: 'relative',
}

const monthHeaderStyle: JSX.CSSProperties = {
  'text-align': 'center',
  'margin-bottom': '12px',
  'font-size': '14px',
  'font-weight': 500,
  color: '#333',
}

const weekdaysStyle: JSX.CSSProperties = {
  display: 'grid',
  'grid-template-columns': 'repeat(7, 1fr)',
  'margin-bottom': '8px',
}

const weekdayStyle: JSX.CSSProperties = {
  'text-align': 'center',
  'font-size': '12px',
  'font-weight': 600,
  color: '#666',
  padding: '4px',
}

const daysGridStyle: JSX.CSSProperties = {
  display: 'grid',
  'grid-template-columns': 'repeat(7, 1fr)',
  gap: '2px',
}

const dayStyle: JSX.CSSProperties = {
  'text-align': 'center',
  padding: '8px',
  'font-size': '14px',
}

const dayButtonStyle: JSX.CSSProperties = {
  cursor: 'pointer',
  'border-radius': '4px',
  transition: 'background-color 0.2s',
}

const selectedDayStyle: JSX.CSSProperties = {
  'background-color': '#3498db',
  color: '#fff',
}

const navigationStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'space-between',
  'margin-top': '12px',
  'border-top': '1px solid #eee',
  'padding-top': '12px',
}

const navButtonStyle: JSX.CSSProperties = {
  padding: '6px 12px',
  border: '1px solid #ddd',
  'border-radius': '4px',
  'background-color': '#fff',
  cursor: 'pointer',
  'font-size': '14px',
  color: '#333',
  transition: 'background-color 0.2s',
}

const yearDropdownStyle: JSX.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: '50%',
  transform: 'translateX(-50%)',
  'background-color': '#fff',
  border: '1px solid #ddd',
  'border-radius': '4px',
  'box-shadow': '0 4px 12px rgba(0, 0, 0, 0.15)',
  'max-height': '200px',
  'overflow-y': 'auto',
  'z-index': 1001,
  width: '100px',
}

const yearOptionStyle: JSX.CSSProperties = {
  padding: '8px 12px',
  cursor: 'pointer',
  'text-align': 'center',
  'font-size': '14px',
  transition: 'background-color 0.2s',
}

const selectedYearStyle: JSX.CSSProperties = {
  'background-color': '#3498db',
  color: '#fff',
}

const DatePicker = (props: DatePickerProps) => {
  const [showCalendar, setShowCalendar] = createSignal(false)
  const [showYearDropdown, setShowYearDropdown] = createSignal(false)
  const [viewDate, setViewDate] = createSignal(props.value || new Date())

  let containerRef: HTMLDivElement | undefined

  const handleClickOutside = (event: MouseEvent) => {
    if (containerRef && !containerRef.contains(event.target as Node)) {
      setShowCalendar(false)
      setShowYearDropdown(false)
    }
  }

  onMount(() => {
    document.addEventListener('mousedown', handleClickOutside)
  })

  onCleanup(() => {
    document.removeEventListener('mousedown', handleClickOutside)
  })

  const handleDateBoxClick = () => {
    setShowCalendar(!showCalendar())
    setShowYearDropdown(false)
  }

  const handleDayClick = (day: number) => {
    const newDate = new Date(viewDate().getFullYear(), viewDate().getMonth(), day)
    props.onChange(newDate)
    setShowCalendar(false)
  }

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate().getFullYear(), viewDate().getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate().getFullYear(), viewDate().getMonth() + 1, 1))
  }

  const handleYearClick = () => {
    setShowYearDropdown(!showYearDropdown())
  }

  const handleYearSelect = (year: number) => {
    setViewDate(new Date(year, viewDate().getMonth(), 1))
    setShowYearDropdown(false)
  }

  const getCalendarDays = () => {
    const year = viewDate().getFullYear()
    const month = viewDate().getMonth()
    const daysInMonth = getDaysInMonth(year, month)
    const firstDay = getFirstDayOfMonth(year, month)
    const days: { day: number; isEmpty: boolean }[] = []

    for (let i = 0; i < firstDay; i++) {
      days.push({ day: 0, isEmpty: true })
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push({ day, isEmpty: false })
    }

    return days
  }

  const isSelectedDay = (day: number): boolean => {
    const val = props.value
    if (!val) return false
    return (
      val.getDate() === day &&
      val.getMonth() === viewDate().getMonth() &&
      val.getFullYear() === viewDate().getFullYear()
    )
  }

  const getYears = () => {
    const currentYear = new Date().getFullYear()
    const years: number[] = []
    for (let year = currentYear - 50; year <= currentYear + 10; year++) {
      years.push(year)
    }
    return years
  }

  const handleNavMouseOver = (e: MouseEvent) => {
    (e.currentTarget as HTMLElement).style.backgroundColor = '#f5f5f5'
  }

  const handleNavMouseOut = (e: MouseEvent) => {
    (e.currentTarget as HTMLElement).style.backgroundColor = '#fff'
  }

  return (
    <div ref={containerRef} style={containerStyle} class={props.class ?? ''}>
      <Show when={props.label}>
        <label style={labelStyle}>{props.label}</label>
      </Show>
      <div style={dateBoxStyle} onClick={handleDateBoxClick}>
        {formatDate(props.value) || 'Select date'}
      </div>
      <Show when={showCalendar()}>
        <div style={calendarStyle}>
          <div style={{ position: 'relative' }}>
            <div style={yearHeaderStyle} onClick={handleYearClick}>
              {viewDate().getFullYear()}
            </div>
            <Show when={showYearDropdown()}>
              <div style={yearDropdownStyle}>
                <For each={getYears()}>
                  {(year) => (
                    <div
                      style={{
                        ...yearOptionStyle,
                        ...(year === viewDate().getFullYear() ? selectedYearStyle : {}),
                      }}
                      onClick={() => handleYearSelect(year)}
                    >
                      {year}
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
          <div style={monthHeaderStyle}>{months[viewDate().getMonth()]}</div>
          <div style={weekdaysStyle}>
            <For each={weekdays}>
              {(day) => <div style={weekdayStyle}>{day}</div>}
            </For>
          </div>
          <div style={daysGridStyle}>
            <For each={getCalendarDays()}>
              {(item) => (
                <Show
                  when={!item.isEmpty}
                  fallback={<div style={dayStyle} />}
                >
                  <div
                    style={{
                      ...dayStyle,
                      ...dayButtonStyle,
                      ...(isSelectedDay(item.day) ? selectedDayStyle : {}),
                    }}
                    onClick={() => handleDayClick(item.day)}
                  >
                    {item.day}
                  </div>
                </Show>
              )}
            </For>
          </div>
          <div style={navigationStyle}>
            <button
              type="button"
              style={navButtonStyle}
              onClick={handlePrevMonth}
              onMouseOver={handleNavMouseOver}
              onMouseOut={handleNavMouseOut}
            >
              ← Prev
            </button>
            <button
              type="button"
              style={navButtonStyle}
              onClick={handleNextMonth}
              onMouseOver={handleNavMouseOver}
              onMouseOut={handleNavMouseOut}
            >
              Next →
            </button>
          </div>
        </div>
      </Show>
    </div>
  )
}

export default DatePicker
