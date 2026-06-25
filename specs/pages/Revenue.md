# Revenue Page

## Layout

Vertical

- shared header
- title "Revenue" (h1, align left)
- Event List

## Event List

- show only past events
- grouped by series
  - series name as group header
  - group can be opened and collapsed
  - show group total revenue in header
  - if no series, standalone event
- sort by date desc (for series, use the date of the earliest event)
- sort by date desc in each group
- each event
  - name
  - date
  - number of participants
  - total registration fee
    - exclude host
    - include all players who were assigned a group/match (including players who were defaulted), whether marked paid or not
  - total prize
  - total revenue