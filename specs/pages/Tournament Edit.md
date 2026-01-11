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
- button "Cancel" (red)
- button "Save" (green)

## Rating Section

Visible if the selected Restriction is Rated

- Rating: "Under" + dropdown (100 to 3000, every 50, default 1500, align middle)
- Top Players Rating (visible if selected type is Team): toggle (default false) + "The combined rating of the top" + dropdown (1 to the selected team size, align middle) + "Players must be under" + dropdown (100 to 3000, every 50, default 2500, align middle)

## Age Section

Visible if the selected Restriction is Age

- Age: single select tags "Under", "Over" followed by dropdown (10 to 80, default 20, align bottom)

## Stages Section

- Stages: single select tags "Group + Knockout", "Group Only (Big Round Robin)", "Knockout Only"

## interaction

- on save: confirm and call save tournament API