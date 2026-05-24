# Event Participant Edit Page

## Layout

Vertical

- shared header
- title "Edit Event Participants" (h1, align left)
- Add Participant button
- section title "List of participants - {number of participants}", if max participants is not unlimited, followed by " / {max participants}"
- Table of participants (alternate bg color - white, lavender)

## Single Participant

- table columns (align left) - Player, Rating, "Delete" icon
- order by Rating desc

## Double/Team Participant

- table columns (align left) - Players, Rating, Combined Rating, "Delete" icon
- each participant consists of multiple rows, 1 player per row (order by Rating desc), no divider between rows. The cells in Combined Rating and "Delete" icon columns are merged, and center aligned vertically
- For team participant, if topPlayersRatingEnabled, add a column "Top {topPlayersCount} Combined"
- order by Combined Rating desc

## interaction

- on load: call get players API to populate the players dropdown
- Add Participant button should be disabled if number of participants reach max participants
- on Add Participant button click: show the Add Participant Dialog
- delete column should be hidden if event has schedule or pass the start date
- on delete icon click: confirm and call delete participant API

## Add Participant Dialog

- title
- list of (number of rows = nop):
  - "Player {n}: " + dropdown (all players ("{name} - {rating}"), order by name)
- button "Cancel" (red)
- button "Save" (green)

### interaction

- on save: call add participant API
  - show result in toast notification, close on success, stay on fail
  - update and re-order the list