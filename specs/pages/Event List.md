# Event List Page

## Layout

Vertical

- shared header
- page header row
  - title "Event List" (h1, align left)
  - tools section, align right
    - if logged in, show "My Events" checkbox
    - for admin, "+" button (new event), green bg
- the list of events
  - name on top
  - date and time on bottom (1 row)
  - sorted by date/time desc
  - action icons (align right, admin only)
    - edit icon: goes to Event Edit page for that event
    - multi-user icon: goes to Event Participant Edit page

### interaction

- on Event click: go to the Event Detail page
- when "My Events" checked, only show events that the current player participates
