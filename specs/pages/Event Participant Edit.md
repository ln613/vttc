# Event Participant Edit Page

## Layout

Vertical

- shared header
- title row
  - "Edit Event Participants" (h1, align left)
  - Add Participant button (align right)
- section title "List of participants - {number of participants}", if max participants is not unlimited, followed by " / {max participants}"
- Table of participants (alternate bg color - white, lavender)

## Single Participant

- table columns (align left) - Player, Rating, "Delete" icon| "Payment" icon
- order by Rating desc
- admin only, show player in red if payment has not been received
- "Payment" icon should be hidden if the player has paid

## Double/Team Participant

- table columns (align left) - Players, Rating, Combined Rating,  "Edit" icon | "Delete" icon | "Payment" icon
- each participant consists of multiple rows, 1 player per row (order by Rating desc), no divider between rows. The cells in Combined Rating and "Delete" icon columns are merged, and center aligned vertically
- For team participant, if topPlayersRatingEnabled, add a column "Top {topPlayersCount} Combined"
- order by Combined Rating desc
- admin only, show individual player in all teams in red if payment has not been received
- "Payment" icon should be hidden if whole team has paid

## interaction

- on load: call get players API to populate the players dropdown
- Add Participant button should be disabled if number of paid participants reach max participants
- on Add Participant button click: show the Add Participant Dialog
- delete column should be hidden if event has schedule
- on delete icon click
  - for team event, if the team contains more than 1 player, show a dialog with each player in the team, each with a delete button to delete a single player in the team, and at the bottom "Delete All" button to delete the whole team 
  - confirm and call delete participant API
- on edit icon click: show the Participant Dialog in edit mode
- on payment icon click:
  - show a dialog listing all players (with fees) in the team, each one with a "Confirm" button
  - a "Confirm All" button at bottom (only for team/double event)
  - all buttons should confirm before calling API
  - call payment received API to mark the player(s) have paid for the event
  - Dialog should be dismissed automatically if no more unpaid players in the team

## Participant Dialog

- title
- list of (number of rows = nop):
  - "Player {n}: " + dropdown (all players ("{name} - {rating}", filter out players not qualified for the event due to rating and sex), order by name)
- button "Cancel" (red)
- button "Save" (green)

### interaction

- on save: call add participant API
  - show result in toast notification, close on success, stay on fail
  - update and re-order the list