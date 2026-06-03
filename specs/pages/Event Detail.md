# Event Detail Page

## Layout

Vertical

- shared header
- Title row
  - Event name (h1, align left)
  - Reset Event button (red bg, only for super admin)
- Date
- Time
- Summary
  - "Best of 3 in group, Best of 5 in knockout, Handicap (200)"...
  - if knockout stage is Best of 3 before Semifinal/Quarterfinal, then there is no need to show "Best of 3 in group"
- Group, Knockout, bracket (tab visibility based on stages type)

## Group Stage Tab

- Generate Groups button (if no groups, only for admin)
  - exlude participants that are not qualified
- list of groups
- if no groups, list of participants (sort by rating/combined rating desc). for admin, show unpaid participants in red

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

"Player in match" definition: 
- any player in the match
- if group stage, any player in the group

- match schedule table (collapsible), where each match row (the Match Component):
  - style 1:
    - names and result, like "Eric Huang 2 : 1 Nan Li", the winning participant and number (Eric Huang and 2 in this case) are bold. when no result, show 0 : 0, no bold. The row should be center aligned with ":" right in the middle.
    - results of each game: "11 : 6, 10 : 12, ...", left side represents the left participant (Eric in this case), the winning numbers are bold.
  - style 2:
    - default style
    - each player/team is 1 row (name, game score, match score, align right)
          Nan Li   7  11   3   1
      Eric Huang  11   9   6   2
    - match score use bigger font and different color
    - flash the latest score
    - highlight the winning side
  - match not started, no table assigned, but in queue
    - light green bg
    - big "Q" (left aligned)
  - match not started, but table assigned
    - light red bg
    - big table number (left aligned)
    - Start/Umpire button
      - green bg
      - visible to admin and Player in match
      - Show "Start" for any play who's actually in the match, show "Umpire" otherwise
  - match in progress
    - light blue bg
    - big table number (left aligned)
    - Continue/Umpire button
      - orange bg
      - if already started but not finished
      - visible to admin and Player in match
      - Show "Continue" for any play who's actually in the match, show "Umpire" otherwise
    - Reset button, admin only
  - match finished
    - white bg
    - Confirm button
      - if finished but not confirmed
      - red bg
      - visible to admin and Player in match
    - Reset button
      - red bg
      - admin only
      - only visible if no match in the next round has finished
      - confirm with the user before reset
      - delete all games and info related to the match
      - reset the complete flag on the group if needed
      - delete the next round schedule if exist
      - if the game play page for that match is opened somewhere, pop up msg saying the match has been reset, then go back (if cannot go back, go to Schedule page)
  - if admin and SIMULATION=1, show "Simulate" button (only for matches already assigned a table), which will simulate the match and submit the results
  - button row align right, if there are multiple buttons, place them in one row

### interaction

- on Generate Groups click: call generate groups API
- on Start button click: go to Game Play page with the selected event, stage and match, start with Game 1
- only 1 game play page per match can be opened at the same time
  - for player, if game play page for that match already opened somewhere, then Start or Continue button disabled
  - if the opened game play page has no activity for over 5 mins, mark it as closed
  - for admin, if click Start or Continue, the currently opened game play page will show msg that admin took over and close (go back, disable the whole game play page as well in case go back doesn't work)
- on Reset Event button click: delete all schedules, matches and groups, keep the participants. confirm before reset
- the detail page should use websocket to receive update, such as grouping/schedule generated, score changed, and update the page

## Knockout Stage Tab

- Generate Next Round button (if previous round/groups already complete, and current round is still not generated, only for admin)
  - if the knockout stage is the first stage in an event, when generating the first round, exlude participants that are not qualified
- list of rounds

### Round

- title "Round of {n}" (n = 16, 32...), or "Quarterfinals", "Semifinals", "Final"
- the match schedule of the round

## Bracket Tab

- Shows the bracket of the knockout stage
