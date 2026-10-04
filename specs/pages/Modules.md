# Modules Page

Route `/modules`. Super admin only (empty page for anyone else), linked from the Settings page ("Modules" section, super admin only). See rules/modules.md.

## Layout

Vertical

- shared header
- title row: "Modules"; "Edit" button (read only) or "Cancel" and "Save" (editing)
- "Turn off the parts of the site this club doesn't use. A module that is off disappears from the menus, and its pages are no longer available."
- a card per first-level module: its checkbox (bold), then its second-level modules' checkboxes, indented
- beside a checkbox that can't be changed, why:
  - "Always on"
  - "Required while Booking is on" (My Booking)
  - "Off while {parent} is off" (a second-level module whose first-level module is off; dimmed)

### Interaction

- checkboxes change only in edit mode
- the locks apply as you tick: turning Booking on ticks My Booking
- Save: saves (the server applies the locks again) and the menus update at once
- Cancel: back to the saved switches
