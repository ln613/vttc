# Game Play Page

## Layout

- header
  - if screen width > 640px:
    - stage name, event name, game info
  - otherwise:
    - event name (align left)
    - stage name, game info
- score box for participant 1, score box for participant 2, each is half width of the screen

## Stage Name

- for group stage: "Group {n}"
- for knockout stage: "Round of 16", "Quarterfinal", "Semifinal"...
- align left

## event name

- text-overflow: ellipsis

## Game Info 

- "Game {n} / {number of games}"
- align right

## Score Box

- participant names
- "+" button (above the box, full width, dark red for the serving side, dark blue for the other)
- current point
  - huge white number
  - red bg for the serving side, blue for the other
- "-" button (under the point box, full width, dark red for the serving side, dark blue for the other)
- show the number of games won at the top-right corner for the left score box, or the top-left corner for the right score box (it will cover part of the "+" button and part of the big point box)
- show "T" at the top-left corner for the right score box, or the top-right corner for the left score box

### interaction

- switch serving every 2 points
- click on "+" button or anywhere in the point box: add 1 point
- click on "-" button: deduct 1 point (min 0)
- when score change, call the update game API (debounce for 3 secs)
- if one side reach game winning point, show the winning number in yellow, and disable the "add point" action. Also show the "Next Game" button or "Finish" button (green bg) depending on whether the match is finished. The button will be under the "-" button and covers both score boxes. Both the "-" buttons are still visible but only the one on the winning side is clickable/enabled, if clicked, the "Next Game"/"Finish" button will disapear
- click on "T" toggles the style of "T" (dark bg white text or white bg black text), the dark bg means the timeout has been called by the player(s) on that side 

## Init Dialog (show on load)

- Who serves first: single select tags (participant 1, participant 2, vertical)
- Who is on umpire's left: single select tags (participant 1, participant 2, vertical)
- OK button

### interaction

- on who is on left changed: change the participant on the left score box accordingly