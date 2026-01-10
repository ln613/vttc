# Tournament Edit Page

## Layout

Vertical

- shared header
- title "Add Tournament" or "Edit Tournament" (h1, align left)
- input "Name" *
- single select tags "Single", "Team"
- if "Single" selected, show single section
- if "Team" selected, show team section
- date picker
- image upload "cover"
- button "Cancel" (red)
- button "Save" (blue)

## Single Section

- Format: single select tags (the pre-defined Single formats)
- Rating (if "Rated Single" seleceted): single select tags "Under", "Over" followed by dropdown (100 to 3000, every 50, align bottom)
- Age (if "Age Single" seleceted): single select tags "Under", "Over" followed by dropdown (10 to 80, align bottom) 
- Stages
- Number of Games section
- Handicap: toggle (default false)

## Team Section

- Team Size: single select tags "2", "3", "4" 
- Stages
- Number of Matches section
- Number of Games section

## Stages Section

- Stages: single select tags "Group + Knockout", "Group Only (Big Round Robin)", "Knockout Only"

## Number of Matches Section

- section header, align left
- Group Stage (if selected stages contains Group): single select tags "Best of 3" (default), "Best of 5"
- Knockout Stage (if selected stages contains Knockout): single select tags "Best of 3", "Best of 3 before Quarterfinal", "Best of 3 before Semifinal" (default), "Best of 5"

## Number of Games Section

Same as Number of Matches Section, but indicate the number of games in each match