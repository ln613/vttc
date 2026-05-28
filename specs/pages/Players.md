# Players Page

## Layout

Vertical

- shared header
- title row
  - "Players" (h1, align left)
  - search box (align right, filter on type, on first name or last name)
- Player Table

## Player Table

- All players with first name, last name, sex, rating
- columns only for admin and above
  - email
  - phone
  - payment icon
    - if the player has unpaid events
    - show the payment confirm dialog
- sort by rating desc

## Payment Confirm Dialog

- list all events (with fees) the player registered but not paid, each with a confirm button
- "Confirm All" button
- Dialog should be dismissed automatically if no more unpaid events for the player.