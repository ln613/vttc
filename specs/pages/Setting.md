# Setting Page

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

## Event Setting Section

- checkbox: "Ignore unpaid players when generating groups, RR or first round knockout if no group stage", default checked. If unchecked, include the unpaid players.

### Interaction

- on save click: save the settings to db
- show empty page for non-admin
