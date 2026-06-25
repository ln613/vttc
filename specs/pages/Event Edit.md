# Event Edit Page

## Layout

Vertical

- shared header
- title "Add Event" or "Edit Event" (h1, align left)
- Event Series: input dropdown with all existing Event Series from all events, user can select or enter new
- Tournament: dropdown (all tournaments)
- date picker
- Time: dropdown (From 8AM to 6PM, half hour interval)
- Name: input (initial value after tournament is selected = tournament name) *
- Max Participants: dropdown (Unlimited, 4 to 128, default Unlimited)
- Registration Fee: dropdown (10 to 100, interval 5)
- Prize section
- Number of Matches section
- Number of Games section
- Number of Qualifiers section
- Handicap Section
- button "Cancel" (red)
- button "Save" (green)

## Prize Section

- 1st Place prize dropdown
- 2nd Place prize dropdown
- 3rd Place prize dropdown
- 4th Place prize dropdown
- each prize dropdown (300, 250, 200, 180, 175, 150, 125, 120, 100, then 5 interval to 5)

## Number of Games Section

The number of games in each match.

- section header, align left
- Group Stage (if selected stages contain Group): single select tags "Best of 3" (default), "Best of 5"
- Knockout Stage (if selected stages contain Knockout): single select tags "Best of 3", "Best of 3 before Quarterfinal", "Best of 3 before Semifinal" (default), "Best of 5"

## Number of Matches Section

Same as Number of Games Section, but indicate the number of matches in each team match, only visible if selected type is Team. For both group and knockout stage, default is "Best of 5"

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