# Game Play Page

## Layout

Vertical

- shared header (desktop mode only)
- event name
- stage name:
  - for group stage: "Group {n}"
  - for knockout stage: "Round of 16", "Quarterfinal", "Semifinal"...
- "Game {n} / {number of games}", align center
- score box for participant 1, score box for participant 2, each is half width of the screen

## Score Box

- participant names
- "+" button (above the box, full width, dark red for the serving side, dark blue for the other)
- current point
  - huge white number
  - red bg for the serving side, blue for the other
- "-" button (under the point box, full width, dark red for the serving side, dark blue for the other)

### interaction

- switch serving every 2 points
- click on "+" button or anywhere in the point box: add 1 point
- click on "-" button: deduct 1 point (min 0)
