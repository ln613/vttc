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
  - Event Series (if available), 2nd row
  - date and time on bottom (1 row)
  - sorted by date/time desc
  - action icons (align right)
    - "{number of participants}/{number of max participants or 'unlimited'}"
    - register icon
      - for player or non-login user
      - only if before the event start date/time
      - only if event not full
    - edit icon (admin only): goes to Event Edit page for that event
    - multi-user icon (admin only): goes to Event Participant Edit page

### interaction

- on Event click: go to the Event Detail page
- when "My Events" checked, only show events that the current player participates
- on Register click
  - if not logged in, show Sign in dialog
  - confirm the user wants to register for the event, then
    - call API to register the player for the event
    - the API will return fees for all events (with the same event series, if available) the player registered but not paid
    - show a dialog with all events and fee info, tell the user to either go to the club to pay the fee or send e-transfer to vttc@vttc.ca and copy the name/event info to the comment box (provide a copy button)
