# Event Detail Page

## Layout

Vertical

- shared header
- Event name (h1, align left)
- Date
- Time
- Summary
  - "Best of 3 in group, Best of 5 in knockout, Handicap (200)"...
  - if knockout stage is Best of 3 before Semifinal/Quarterfinal, then there is no need to show "Best of 3 in group"
- Group, Knockout, bracket (tab visibility based on stages type)

## Group Stage Tab

- Generate Groups button (if no groups, only for admin)
- list of groups

### Group

- title "Group {n}"
- the group table, e.g.,

| Rank | Player | Total | W | L | +/- | GW | GL | G+/- | PW | PL | P+/-
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Eric Huang | 3 | 3 | 0 | +3 | 6 | 0 | 6 | 66 | 36 | 30
| 2 | Nan Li | 3 | 2 | 1 | +1 | 4 | 2 | 2 | 56 | 46 | 10
| 3 | Leo Chang | 3 | 1 | 2 | -1 | 2 | 5 | -3 | 46 | 56 | -10
| 4 | Karim Maanaki | 3 | 0 | 3 | -3 | 1 | 6 | -5 | 36 | 66 | -30

The player column title is "Players" for double event and "Team" for team event, and the column content will show all player (order by rating desc) names joined by " / ".

The Total column is the total matches played so far.

- match schedule table (collapsible), where each match row:
  - names and result, like "Eric Huang 2 : 1 Nan Li", the winning participant and number (Eric Huang and 2 in this case) are bold. when no result, show 0 : 0, no bold. The row should be center aligned with ":" right in the middle.
  - results of each game: "11 : 6, 10 : 12, ...", left side represents the left participant (Eric in this case), the winning numbers are bold.
  - Start button (if not started yet, align right, green, small)
  - Continue button (if already started but not finished, orange, small)
  - Confirm button (if finished but not confirmed, red, small)
  - Reset button (if finished and confirmed, red, small, only for admin)
    - only visible if no match in the next round has started/finished
    - confirm with the user before reset
    - delete all games and info related to the match
    - reset the complete flag on the group if needed
    - delete the next round schedule if exist
    - after reset, show the start button

### interaction

- on Generate Groups click: call generate groups API
- on Start button click: go to Game Play page with the selected event, stage and match, start with Game 1

## Knockout Stage Tab

- Generate Next Round button (if previous round/groups already complete, and current round is still not generated, only for admin)
- list of rounds

### Round

- title "Round of {n}" (n = 16, 32...), or "Quarterfinals", "Semifinals", "Final"
- the match schedule of the round

## Bracket Tab

- Shows the bracket of the knockout stage
