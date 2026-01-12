# Event Manage Page

## Layout

Vertical

- shared header
- title "Manage Event" (h1, align left)
- Event: dropdown (all events)
- (display after selecting an event):
  - stage tabs (Group, Knockout...)

## Group Stage Tab

- Generate Groups button (if no groups)
- list of groups

### Group

- title "Group {n}"
- the group table, e.g.,

| Rank | Player | Total | W | L | +/- | Win % | MW | ML | GW | GL |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Eric Huang | 3 | 3 | 0 | +3 | 100.0% | 3 | 0 | 6 | 0 |
| 2 | Nan Li | 3 | 2 | 1 | +1 | 66.7% | 2 | 1 | 4 | 2 |
| 3 | Leo Chang | 3 | 1 | 2 | -1 | 33.3% | 1 | 2 | 2 | 5 |
| 4 | Karim Maanaki | 3 | 0 | 3 | -3 | 0.0% | 0 | 3 | 1 | 6 |

The player column title is "Players" for double event and "Team" for team event, and the column content will show all player (order by rating desc) names joined by " / ".

- match schedule table (collapsible), where each match row:
  - names and result, like "Eric Huang 2 : 1 Nan Li", the winning participant and number (Eric Huang and 2 in this case) are bold. when no result, show 0 : 0, no bold. The row should be center aligned with ":" right in the middle.
  - results of each game: "11 : 6, 10 : 12, ...", left side represents the left participant (Eric in this case), the winning numbers are bold.
  - Start button (if not started yet, align right, green, small)

### Knockout

empty

### interaction

- on Generate Groups click: call generate groups API
- on Start button click: go to Game Play page with the selected event, stage and match, start with Game 1