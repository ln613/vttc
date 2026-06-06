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
    - hide for players who are host ('host' field = true)
  - register icon
    - if the player has email but not registered yet
    - on click
      - open the sign up dialog with this player selected
      - no need to verify email
      - auto-generate a password
      - when click sign up
        - send the password to the email, ask the player to log in
        - mark the player account as pending 
- sort by rating desc
- for admin, on player row click, go to player account page
 
## Payment Confirm Dialog

- list all events (with fees) the player registered but not paid, each with a confirm button
- "Confirm All" button
- Dialog should be dismissed automatically if no more unpaid events for the player.
