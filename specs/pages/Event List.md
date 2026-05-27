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
    - fee icon
      - if already registered but not paid
      - on click, show the fee info dialog
    - edit icon (admin only): goes to Event Edit page for that event
    - multi-user icon (admin only): goes to Event Participant Edit page

### interaction

- on Event click: go to the Event Detail page
- when "My Events" checked, only show events that the current player participates
- on Register click
  - if not logged in, show Sign in dialog
  - confirm the user wants to register for the event, then
    - for team event, ask the player to select teammates
      - show a dialog with a list of all partial teams of the event (e.g., for team of 3, teams with 1 or 2 players are partial teams)
      - filter out partial teams which would exceed the combined rating limit/combined top {n} players limit if the current player is added
      - if no partial teams available to be selected, don't show the dialog
      - the title of the dialog "Select your teammate"
      - the desc "If your teammate has not registered for the event, skip this step and ask your teammate to select you as teammate when registering"
      - the list contains player name(s) of the partial teams, combined rating (including the current player), combined top {n}
      - the "Confirm" and "Skip" buttons
    - call API to register the player for the event (if a partial team selected, add the player to the team)
    - the API will return fees for all events (with the same event series, if available) the player registered but not paid (for team event, fee = team fee / number of players per team)
    - show the fee info dialog with all events and fee info, tell the user to either go to the club to pay the fee or send e-transfer to vttc@vttc.ca and copy the name/event info to the comment box (provide a copy button)
