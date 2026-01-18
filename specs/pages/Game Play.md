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

### interaction

- switch serving every 2 points
- click on "+" button or anywhere in the point box: add 1 point
- click on "-" button: deduct 1 point (min 0)
- when score change, call the update game API (debounce for 3 secs)

## Init Dialog (show on load)

- Who serves first: single select tags (participant 1, participant 2, vertical)
- Who is on left: single select tags (participant 1, participant 2, vertical)
- OK button

### interaction

- on who is on left changed: change the participant on the left score box accordingly