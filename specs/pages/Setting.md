# Setting Page

Admin only, show empty page for non-admin.

## Layout

Vertical

- shared header
- title row
  - "Settings" (h3, align left)
  - action icons (align right)
    - read only mode: Edit Icon (enter edit mode)
    - edit mode: "Cancel" and "Save" icons (exit edit mode)
    - saving indicator (spinning circle, while saving)
- Event Setting Section
- Revenue Section

## Event Setting Section

- checkbox: "Ignore unpaid players when generating groups, RR or first round knockout if no group stage", default checked. If unchecked, include the unpaid players.
- checkbox: "Enable Tablet Mirror", defaulting to the club config's
  `tabletMirrorEnabled`. When checked, a table can be run by two tablets —
  one facing the umpire, one facing the players. The value is copied onto
  each event when that event starts, so changing it affects every event
  that has not started yet. See `specs/rules/tablet mirror.md`.

### Interaction

- on save click: save the settings to db

## Revenue Section

- link to revenue page
- link to revenue calculator page
- admin only

## Update Section

- Update Rating button
- shown only when the club config sets `enableUpdateRating`. Absent =
  hidden, because `rating.js` carries VTTC's rating tables: running it for
  a club that has not opted in would rate their players against rules that
  are not theirs. The endpoint refuses on the same test, so hiding the
  button is a courtesy rather than the whole control