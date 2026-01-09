import React, { useState, useRef, useEffect } from 'react'

interface DatePickerProps {
  label?: string
  value: Date | null
  onChange: (date: Date | null) => void
  className?: string
}

const DatePicker: React.FC<DatePickerProps> = ({
  label,
  value,
  onChange,
  className = '',
}) => {
  const [showCalendar, setShowCalendar] = useState(false)
  const [showYearDropdown, setShowYearDropdown] = useState(false)
  const [viewDate, setViewDate] = useState(value || new Date())
  const containerRef = useRef<HTMLDivElement>(null)
  const yearDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowCalendar(false)
        setShowYearDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const formatDate = (date: Date | null): string => {
    if (!date) return ''
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
  }

  const handleDateBoxClick = () => {
    setShowCalendar(!showCalendar)
    setShowYearDropdown(false)
  }

  const handleDayClick = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day)
    onChange(newDate)
    setShowCalendar(false)
  }

  const handlePrevMonth = () => {
    setViewDate(
      new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1),
    )
  }

  const handleNextMonth = () => {
    setViewDate(
      new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1),
    )
  }

  const handleYearClick = () => {
    setShowYearDropdown(!showYearDropdown)
  }

  const handleYearSelect = (year: number) => {
    setViewDate(new Date(year, viewDate.getMonth(), 1))
    setShowYearDropdown(false)
  }

  const getDaysInMonth = (year: number, month: number): number => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (year: number, month: number): number => {
    return new Date(year, month, 1).getDay()
  }

  const renderCalendarDays = () => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const daysInMonth = getDaysInMonth(year, month)
    const firstDay = getFirstDayOfMonth(year, month)
    const days: React.ReactNode[] = []

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} style={dayStyle} />)
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected =
        value &&
        value.getDate() === day &&
        value.getMonth() === month &&
        value.getFullYear() === year

      days.push(
        <div
          key={day}
          style={{
            ...dayStyle,
            ...dayButtonStyle,
            ...(isSelected ? selectedDayStyle : {}),
          }}
          onClick={() => handleDayClick(day)}
        >
          {day}
        </div>,
      )
    }

    return days
  }

  const renderYearDropdown = () => {
    const currentYear = new Date().getFullYear()
    const years: number[] = []
    for (let year = currentYear - 50; year <= currentYear + 10; year++) {
      years.push(year)
    }

    return (
      <div ref={yearDropdownRef} style={yearDropdownStyle}>
        {years.map((year) => (
          <div
            key={year}
            style={{
              ...yearOptionStyle,
              ...(year === viewDate.getFullYear() ? selectedYearStyle : {}),
            }}
            onClick={() => handleYearSelect(year)}
          >
            {year}
          </div>
        ))}
      </div>
    )
  }

  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    marginBottom: '16px',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontWeight: 700,
    fontSize: '14px',
    marginBottom: '8px',
    color: '#333',
    textAlign: 'left',
  }

  const dateBoxStyle: React.CSSProperties = {
    padding: '12px 16px',
    fontSize: '14px',
    border: '2px solid #3498db',
    borderRadius: '4px',
    backgroundColor: '#fff',
    color: '#333',
    cursor: 'pointer',
    minWidth: '150px',
    userSelect: 'none',
  }

  const calendarStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    zIndex: 1000,
    padding: '12px',
    marginTop: '4px',
    width: '280px',
  }

  const yearHeaderStyle: React.CSSProperties = {
    textAlign: 'center',
    marginBottom: '8px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    color: '#3498db',
    position: 'relative',
  }

  const monthHeaderStyle: React.CSSProperties = {
    textAlign: 'center',
    marginBottom: '12px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#333',
  }

  const weekdaysStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    marginBottom: '8px',
  }

  const weekdayStyle: React.CSSProperties = {
    textAlign: 'center',
    fontSize: '12px',
    fontWeight: 600,
    color: '#666',
    padding: '4px',
  }

  const daysGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '2px',
  }

  const dayStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '8px',
    fontSize: '14px',
  }

  const dayButtonStyle: React.CSSProperties = {
    cursor: 'pointer',
    borderRadius: '4px',
    transition: 'background-color 0.2s',
  }

  const selectedDayStyle: React.CSSProperties = {
    backgroundColor: '#3498db',
    color: '#fff',
  }

  const navigationStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '12px',
    borderTop: '1px solid #eee',
    paddingTop: '12px',
  }

  const navButtonStyle: React.CSSProperties = {
    padding: '6px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#333',
    transition: 'background-color 0.2s',
  }

  const yearDropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '4px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    maxHeight: '200px',
    overflowY: 'auto',
    zIndex: 1001,
    width: '100px',
  }

  const yearOptionStyle: React.CSSProperties = {
    padding: '8px 12px',
    cursor: 'pointer',
    textAlign: 'center',
    fontSize: '14px',
    transition: 'background-color 0.2s',
  }

  const selectedYearStyle: React.CSSProperties = {
    backgroundColor: '#3498db',
    color: '#fff',
  }

  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  return (
    <div ref={containerRef} style={containerStyle} className={className}>
      {label && <label style={labelStyle}>{label}</label>}
      <div style={dateBoxStyle} onClick={handleDateBoxClick}>
        {formatDate(value) || 'Select date'}
      </div>
      {showCalendar && (
        <div style={calendarStyle}>
          <div style={{ position: 'relative' }}>
            <div style={yearHeaderStyle} onClick={handleYearClick}>
              {viewDate.getFullYear()}
            </div>
            {showYearDropdown && renderYearDropdown()}
          </div>
          <div style={monthHeaderStyle}>{months[viewDate.getMonth()]}</div>
          <div style={weekdaysStyle}>
            {weekdays.map((day) => (
              <div key={day} style={weekdayStyle}>
                {day}
              </div>
            ))}
          </div>
          <div style={daysGridStyle}>{renderCalendarDays()}</div>
          <div style={navigationStyle}>
            <button
              type="button"
              style={navButtonStyle}
              onClick={handlePrevMonth}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#f5f5f5'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#fff'
              }}
            >
              ← Prev
            </button>
            <button
              type="button"
              style={navButtonStyle}
              onClick={handleNextMonth}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#f5f5f5'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#fff'
              }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DatePicker
