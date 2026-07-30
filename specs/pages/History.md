# History Page

List the history of matches for a player, ordered desc by confirmed date.

## Layout

Vertical

- shared header
- title row
  - "History - {name} ({rating})" (h1, align left)
- History Table

## History Table

- Date
- Event: "{event series name} - {event name}"
- Winner (bold font): "{name} ({rating before the match} {+/-} {rating change} = {rating after the match})"
- Result: list of loser points of each game. e.g., 11:5, 12:14, 12:10 -> 5,12,10. bold the game where the winner wins, so 5 and 10 will be bold
- Loser: same format as Winner