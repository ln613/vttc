# Event Edit Page

## Layout

Vertical

- shared header
- title "Add Event" or "Edit Event" (h1, align left)
- Event Type (hidden when edit): single select tags, Tournament or League

for tournament:
- Event Series: input dropdown with all existing Event Series from all events, user can select or enter new
- Tournament: dropdown (all tournaments)
- date picker
- Time: dropdown (From 6AM to 10PM, half hour interval)
- Name: input (initial value after tournament is selected = tournament name) *

for league:
- Name: input *
- On: Monday, Tuesday...Sunday (single select tags) *
- Time: dropdown (From 6AM to 10PM, half hour interval) *
- Start Date: date picker (must match "On", if "On" Sunday, Start Date must be a future Sunday)
- Team Size: 2,3,4 (single select tags, default 3)
- Format: dropdown, from the format section in rules/league.md *
- Number of Phases: 1,2,3 (single select tags, default 1)
- Allow Player Sharing: checkbox (default unchecked) with note "Players can represent multiple teams, but a player can only play for 1 team on a match day"
- Rated: checkbox (default unchecked). If checked 
  - the Rating Section in pages/Tournament Edit.md

- Max Participants: dropdown (Unlimited, 4 to 128, default Unlimited)
- Registration Fee: dropdown (10 to 100, interval 5, then 120, 125, 150, 175, 180, 200, then 50 interval to 500)
- Prize section
- Number of Matches section (tournament only)
- Number of Games section
- Number of Qualifiers section (tournament only)
- Handicap Section
- button "Cancel" (red)
- button "Save" (green)

## Prize Section

- 1st Place prize dropdown
- 2nd Place prize dropdown
- 3rd Place prize dropdown
- 4th Place prize dropdown
- each prize dropdown (from 1000, 50 interval to 200, then 180, 175, 150, 125, 120, 100, then 5 interval to 5)

## Number of Games Section

The number of games in each match.

- section header, align left
- for tournament:
  - Group Stage (if selected stages contain Group): single select tags "Best of 3" (default), "Best of 5"
  - Knockout Stage (if selected stages contain Knockout): single select tags "Best of 3", "Best of 3 before Quarterfinal", "Best of 3 before Semifinal" (default), "Best of 5"
- for league: single select tags "Best of 3", "Best of 5" (default)

## Number of Matches Section

Same as Number of Games Section, but indicate the number of matches in each team match, only visible if selected type is Team. For both group and knockout stage, default is "Best of 5"

For league, determined by the format. E.g., RR singles with team of 3, total 9 matches, so best of 9. Singles and Doubles with team of 2, best of 5 matches (A-Y, B-X, AB-XY, A-X, B-Y)

## Number of Qualifiers Section

Select the number of participants who will advance from the group stage, only visible if selected stages contain Group.

- Number of Qualifiers: single select tags "Top 1", "Top 2", "Top 3", "All"

## Handicap Section

- toggle (default false, align left), Difference: dropdown (100 to 400, every 50, default 200, visible if toggle is true, align middle), Max Points Given: (1 to 10, default 5, visible if toggle is true, align middle)

## interaction

- on load: call get tournaments API to populate the tournaments dropdown
- on save
  - call save event API
  - show loading indicator and dim the screen while saving
  - on success: show saved message and go back
  - on fail: show err msg
- on cancel: confirm cancel if there are changes