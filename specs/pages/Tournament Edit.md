# Tournament Edit Page

## Layout

Vertical

- shared header
- title "Add Tournament" or "Edit Tournament" (h1, align left)
- Name: input *
- Sex: single select tags "All", "Man", "Woman", "Mixed"
- Type: single select tags "Single", "Double", "Team"
- Team Size (visible if selected type is Team): single select tags "2", "3", "4" 
- Restriction: single select tags "Open", "Rated", "Age"
- Rating section 
- Age section 
- Stages section
- Number of Matches section
- Number of Games section
- Number of Qualifiers section
- Handicap section
- date picker
- image upload "cover"
- button "Cancel" (red)
- button "Save" (blue)

## Rating Section

Visible if the selected Restriction is Rated

- Rating: "Under" + dropdown (100 to 3000, every 50, default 1500, align bottom)
- Top Players Rating (visible if selected type is Team): "The combined rating of the top" + dropdown (1 to 5) + "Players must be under" + dropdown (100 to 3000, every 50, default 2500, align bottom)

## Age Section

Visible if the selected Restriction is Age

- Age: single select tags "Under", "Over" followed by dropdown (10 to 80, default 20, align bottom)

## Stages Section

- Stages: single select tags "Group + Knockout", "Group Only (Big Round Robin)", "Knockout Only"

## Number of Games Section

The number of games in each match.

- section header, align left
- Group Stage (if selected stages contain Group): single select tags "Best of 3" (default), "Best of 5"
- Knockout Stage (if selected stages contain Knockout): single select tags "Best of 3", "Best of 3 before Quarterfinal", "Best of 3 before Semifinal" (default), "Best of 5"

## Number of Matches Section

Same as Number of Games Section, but indicate the number of matches in each team match, only visible if selected type is Team.

## Number of Qualifiers Section

Select the number of participants who will advance from the group stage, only visible if selected stages contain Group.

- Number of Qualifiers: single select tags "Top 1", "Top 2", "Top 3", "All"

## Handicap Section

- toggle (default false, align left), Difference: dropdown (100 to 400, every 50, default 200, visible if toggle is true, align middle), Max Points Given: (1 to 10, default 5, visible if toggle is true, align middle)
