# Live Score Page

## Layout

desktop:

-----------------------
|   |   |   |   |     |
| 5 | 6 | 7 | 8 |     |
|   |   |   |   |     |
|---|---|---|---|     |
|   |   |   |   |     |
| 1 | 2 | 3 | 4 |     |
|   |   |   |   |     |
-----------------------

The right column is the Match Queue.

mobile:

---------
|   |   |
| 5 | 6 |
|   |   |
|---|---|
|   |   |
| 1 | 2 |
|   |   |
|-------|
|       |
|       |
---------

The bottom column is the Match Queue.

The tables section can be scrolled/swiped horizontally to show other tables.

## Table section

Each table will show:
- if no match assigned
  - green bg
  - big table number (yellow) at center
- match assigned
  - bg color
    - match not started: red bg, flashing yellow border
    - match in progress: blue (#2980b9) bg
  - table number (yellow, big, top-center)
  - event name
  - stage ("Group {n}", "Semifinal"...)
  - "Best of {n}"
  - player1 of the match (or for team, player1/player2), followed by the game score
  - score
    - match not started: "vs"
    - match in progress: scores of each game, current game on right most, "11:7, 4:8...", highlight the winning number and flash the most recent point    
  - player2 of the match (or for team, player3/player4), followed by the game score
  - table number (yellow, big, top-center)

## Interactions

- on page load, retrieve the Match Queue and table assignment
- use websocket to get real-time update
