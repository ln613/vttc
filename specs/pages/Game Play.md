# Game Play Page

## Layout

Portrait:

- header
  - hamburger menu
  - if screen width > 640px:
    - stage name, event name, game info
  - otherwise:
    - event name (align left)
    - stage name, game info
- score box for participant 1, score box for participant 2, each is half width of the screen

Landscape:

- score box for participant 1
- info box (vertical, align center)
  - same as the table section in live score page
  - show game scores:
    11:7
    3:5
    ...
    highlight the winning/leading side
  - no hamburger menu
  - transparent bg
- score box for participant 2

## Hamburger Menu

hamburger icon, show/hide the following menu:
  - Reset Game
    - reset the current game
    - show confirm window, "Are you sure you want to reset the current game?"
  - Reset Match
    - reset the whole match
    - show confirm window, "Are you sure you want to reset the whole match?"
    - if match is finished and submitted, the Reset Match menu will be disabled
  - Exit: go back to the previous page

## Stage Name

- align left
- for group stage: "Group {n}"
- for knockout stage: "Round of 16", "Quarterfinal", "Semifinal"...
- for team sub-match, followed by " - Team Match {n}"

## event name

- text-overflow: ellipsis

## Game Info 

- "Game {n} / {number of games}"
- align right

## Score Box

- "+" button (above the box, full width, dark red for the serving side, dark blue for the other)
- point box
  - participant names
    - for team sub-match, name followed by " ({order})"
    - for double matches, each player per row
  - current point
    - huge white number
    - red bg for the serving side, blue for the other
- "-" button (under the point box, full width, dark red for the serving side, dark blue for the other)
- show the number of games won at the top-right corner for the left score box, or the top-left corner for the right score box (it will cover part of the "+" button and part of the big point box)
- show "T" at the top-left corner for the right score box, or the top-right corner for the left score box

## No Match Assigned Screen

When there is no match assigned, just show the big table number at screen center

### interaction

- switch serving every 2 points
- click on "+" button or anywhere in the point box: add 1 point
- click on "-" button: deduct 1 point (min 0)
- when score change, call the update game API (debounce for 3 secs)
- if one side reach game winning point, show the winning number in yellow, and disable the "add point" action. Also show the "Next Game" button or "Finish" button (green bg) depending on whether the match is finished. The button will be under the "-" button and covers both score boxes. Both the "-" buttons are still visible but only the one on the winning side is clickable/enabled, if clicked, the "Next Game"/"Finish" button will disapear
- click on "Next Game": start the next game 0:0 (or the starting score if handicap), update match score, update the serving side (alternate first serve side after each game), switch player side
- click on "Finish", show a confirm dialog:
  - "Show the match result to both sides and confirm the result with them"
  - the updated match result with each game's result (just update in memory, do not actually update and send to db before confirm)
  - cancel and confirm buttons
    - on confirm, clear game score, update match score, go back to event detail page and update the ranking table
- click on "T" toggles the style of "T" (dark bg white text or white bg black text), the dark bg means the timeout has been called by the player(s) on that side 

## Init screen

- event name (align left)
- stage name
  - for team sub-matches, followed by " - Team Match {n} - {A} vs {X}"
- game init setting (3 columns)
  - column 1
    - empty
    - participant 1
    - participant 2
  - column 2
    - "Serve First"
    - serve icon (in assets folder, default gray-scale)
    - serve icon (default gray-scale)
  - column 3
    - "Umpire's Left"
    - table icon (in assets folder, default gray-scale)
    - table icon (default gray-scale)
- Start button (full width, align bottom)

### interaction

- click on 1 serve/table icon, make it color icon, gray-scale the other
- on who is on left changed: change the participant on the left score box accordingly
- Start button only enabled if both "Serve First" and "Umpire's Left" are selected
- on Start button clicked, save the info to the match to DB, so when coming back to the match (when the continue button is clicked), no need to show the init screen again
- whenever the first side reaches the switching point in the last game, confirm with players ("Switch sides?") then switch side
- if already switched and points get deducted by pressing "-", whenever the last side reaches the switching point - 1, inform the players to switch back