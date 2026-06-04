# Event List Page

## Layout

Vertical

- shared header
- page header row
  - title "Events" (h1, align left)
  - tools section, align right
    - "Today's Events" toggle button (green bg/white text when on, white bg/black text when off), when checked, show today's events only
    - if logged in (player only), show "My Events" toggle button
    - for admin, "+" button (new event), green bg
    - if admin and simulation, "+" button (purple bg), on click show a dialog with:
      - all available event series, dropdown, select the most recent one by default
      - show all available tournaments, grouped by open singles, rated singles, aged singles and teams, each group with group header, each tournament is a button
      - max participants: dropdown, unlimited, 4 to 128, default 16
      - Save and Cancel button
      - on save
        - create an event:
          - name: "{tournament name} - test"
          - date: today
          - time: now + 1 min
          - fee: 30
        - auto register randomly selected qualified players (age ignored)

- the list of events
  - name on top
  - Event Series (if available), 2nd row
  - date and time on bottom (1 row)
  - "Registered: {number of participants}, Paid: {number of paid participants/teams, for team event, only if the whole team have paid}, if not unlimited, followed by "Max: {number of max participants}"
  - sorted by date/time desc
  - action icons (align right)
    - register icon
      - for player or non-login user
      - hidden after the event start date/time
      - if player logged in, use warning color when
        - event full (paid players/teams reach max)
        - player not qualified
          - for aged event, player doesn't have birth date info or age not qualified
          - for rated event, player's rating not qualified
        - on click, show the msg with reason why the player cannot register
    - fee icon
      - if already registered but not paid
      - on click, show the fee info dialog
    - multi player icon
      - if already registered but still in a partial team
      - on click, show the select teammate dialog (replace the skip button with cancel button)
    - edit icon (admin only): goes to Event Edit page for that event
    - delete icon (super admin only): confirm and delete the event completely 
    - multi-user icon (admin only): goes to Event Participant Edit page
  - for past events (before today or already finished), use light gray bg
  - for my upcoming or unfinished events, use light green bg

### interaction

- on Event click: go to the Event Detail page
- when "My Events" checked, only show events that the current player participates
- on Register click
  - if not logged in, show Sign in dialog
  - confirm the user wants to register for the event, then
    - for team event, ask the player to select teammates
      - show a dialog with a list of all partial teams of the event (e.g., for team of 3, teams with 1 or 2 players are partial teams)
      - disable the partial teams which would exceed the combined rating limit/combined top {n} players limit if the current player is added (show the exceeded rating in red)
      - the title of the dialog "Select your teammate"
      - the desc "If your teammate has not registered for the event, skip this step and ask your teammate to select you as teammate when registering"
      - the list contains player name(s) of the partial teams, combined rating (including the current player), combined top {n}
      - the "Confirm" and "Skip" buttons
    - call API to register the player for the event (if a partial team selected, add the player to the team)
    - the API will return fees for all events (with the same event series, if available) the player registered but not paid (for team event, fee = team fee / number of players per team)
    - show the fee info dialog with all events and fee info, tell the user to either go to the club to pay the fee or send e-transfer to vttc@vttc.ca and copy the name/event info to the comment box (provide a copy button)
