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

### Knockout

empty

### interaction

- on Generate Groups click: call generate groups API
