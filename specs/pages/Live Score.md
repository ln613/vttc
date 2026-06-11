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
---------

The bottom row is the Match Queue, which can be expanded or collapsed, when expanded, open up from bottom with animation, stops when taking 90% of the screen height.

The tables section can be scrolled/swiped horizontally to show other tables. Show an indicator (transparent) to let user know it can be scrolled left/right. Swipe up anywhere to expand the match queue, swipe down to collapse.

## Table section

Each table will show:
- if no match assigned
  - green bg
  - big table number (yellow) at center
- match assigned
  - bg color
    - match not started: red bg, flashing yellow border
    - match in progress: blue (#2980b9) bg
    - match finished but not confirmed: blue (#2980b9) bg, flashing yellow border
  - table number (yellow, big, top-center)
  - event name
  - stage ("Group {n}", "Semifinal"...)
  - for team sub-match, "Team Match {n} - BC vs YZ"
  - space
  - player1 of the match (or for team, player1/player2), followed by the game score
  - score
    - match not started: "vs"
    - match in progress: scores of each game, current game on right most, "11:7, 4:8...", highlight the winning number and flash the most recent point    
  - player2 of the match (or for team, player3/player4), followed by the game score
  - for team sub-match, player name followed by " ({order})"
  - table number (yellow, big, top-center)
  - action button, admin on mobile only
    - match not started: "Postpone" button
    - match in progress: "Cancel" button

## Match Queue section

- title row
  - "Match Queue"
  - for logged in player, "My Matches" check box
- The match that is not playable at the moment because some players in the match are playing on other tables, the players not available should be in red
- for desktop only, Match Queue should auto scroll (medium to low speed) in a loop, when it reaches the end, jump back to top

## Interactions

- on page load, retrieve the Match Queue and table assignment
- use websocket to get real-time update
- on match postpone
  - show a dialog with a list of buttons, 5 Minutes, 10 Minutes, 30 Minutes, 1 Hour
  - on select, remove the match from the table and the queue, and set the time selected on the match to mark it not available for queuing. when the time is reached, it becomes available for queuing again.
  - when postpone a team sub match, all remaining sub matches from the same parent match should also be postponed (for the same duration), since the sub match order must be kept
  - a postponed match (or sub matches) doesn't have to come back the same table
- on match cancel: confirm and reset the match and put it back to the end of the queue
- 1 min heartbeat (admin only) to allow event auto-start