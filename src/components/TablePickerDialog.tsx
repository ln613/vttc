import { For, type JSX } from 'solid-js'
import clubConfig from 'club-config'

// The club's tables, laid out as they stand in the hall: the back row
// first, so the grid on screen matches what someone looking at the room
// sees. Taken from the club config rather than hardcoded.
const TABLE_GRID_ORDER = [...(clubConfig.tables.rows ?? [])]
  .reverse()
  .flat()

export type TableCellStatus = 'available' | 'not_started' | 'in_progress'

interface TablePickerDialogProps {
  title?: string
  /** Colour of each cell. Defaults to every table looking free. */
  statusFor?: (tableNumber: number) => TableCellStatus
  /** A table that cannot be picked is greyed out rather than hidden. */
  isDisabled?: (tableNumber: number) => boolean
  onPick: (tableNumber: number) => void
  onClose: () => void
}

/**
 * Pick a table. Shared by the tablet/umpire flow in the header and by
 * assigning a human umpire to a table for the day — same grid, same
 * colours, different rules about which cells can be pressed.
 */
const TablePickerDialog = (props: TablePickerDialogProps) => {
  const statusFor = (n: number): TableCellStatus =>
    props.statusFor ? props.statusFor(n) : 'available'
  const disabled = (n: number) => !!props.isDisabled?.(n)

  const handleClick = (n: number) => {
    if (disabled(n)) return
    props.onPick(n)
  }

  return (
    <div style={overlayStyle} onClick={props.onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={titleStyle}>{props.title ?? 'Pick a table'}</div>
        <div style={gridStyle}>
          <For each={TABLE_GRID_ORDER}>
            {(n) => (
              <button
                type="button"
                style={cellStyle(statusFor(n), disabled(n))}
                onClick={() => handleClick(n)}
                disabled={disabled(n)}
              >
                {n}
              </button>
            )}
          </For>
        </div>
      </div>
    </div>
  )
}

export default TablePickerDialog

const overlayStyle: JSX.CSSProperties = {
  position: 'fixed',
  top: '0',
  left: '0',
  right: '0',
  bottom: '0',
  'background-color': 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'z-index': '2000',
  padding: '16px',
}

const dialogStyle: JSX.CSSProperties = {
  'background-color': '#fff',
  'border-radius': '12px',
  padding: '20px',
  width: 'auto',
  'max-width': '360px',
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  gap: '14px',
  'box-shadow': '0 4px 20px rgba(0, 0, 0, 0.15)',
}

const titleStyle: JSX.CSSProperties = {
  'font-size': '18px',
  'font-weight': 700,
  color: '#2c3e50',
  'text-align': 'center',
}

const gridStyle: JSX.CSSProperties = {
  display: 'grid',
  'grid-template-columns': `repeat(${
    clubConfig.tables.rows?.[0]?.length ?? 4
  }, 64px)`,
  'grid-auto-rows': '64px',
  gap: '8px',
}

const cellStyle = (
  status: TableCellStatus,
  disabled: boolean,
): JSX.CSSProperties => {
  const bg =
    status === 'available'
      ? '#27ae60'
      : status === 'not_started'
        ? '#c0392b'
        : '#2980b9'
  return {
    width: '64px',
    height: '64px',
    'box-sizing': 'border-box',
    'border-radius': '10px',
    'font-size': '24px',
    'font-weight': 900,
    color: '#f1c40f',
    'background-color': bg,
    border: '3px solid transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    'text-shadow': '2px 2px 4px rgba(0,0,0,0.3)',
    padding: 0,
    flex: 'none',
    opacity: disabled ? 0.4 : 1,
  }
}
