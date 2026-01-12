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
- current point
  - huge white number
  - red bg for the serving side, blue for the other
- "+" and "-" button

### interaction

- switch serving every 2 points
- on + button or anywhere in the score box click: add 1 point
- on "-" button click: deduct 1 point (min 0)
