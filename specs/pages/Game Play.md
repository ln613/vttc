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

### interaction

- switch serving every 2 points
- click on "+" button or anywhere in the point box: add 1 point
- click on "-" button: deduct 1 point (min 0)
