# Table Rules

Before each match can be started, a table has to be assigned to the match.

## Tables

There are 8 tables totally, arranged like this:

5 6 7 8
1 2 3 4

### Table Order

The table is ordered based on court condition for high quality matches

6 > 7 > 2 = 3 > 5 > 4 > 1 > 8

## Table Assigning Rules

Rule listed below are based on priority. A rule with lower priority cannot violate any rules with higher priority.

1. Table 8 should never be used for knockout matches
2. For the following events (low level events)
  - single event with rating limit 1000 and below
  - team event with combined rating limit 2000 and below
  - single event with max age 13 and below
  apply the following rules:
  - any table can be used for any stage
  - table preference order: 1, 4, 8, 2, 3, 5, 7, 6
  - for semifinal and final, prefer using table 2 or 3
3. For any other events, table 8 should not be used at all
4. For the following events (high level events)
  - open singles
  - single event with rating limit 1500 and above
  - team event with combined rating limit 2500 and above
  - single event with max age 15 and above
  - single event with min age 40 and above
  apply the following rules:
  - do not use table 1 and 4 at all
  - table preference order: 6, 7, 2, 3, 5
  - final should be on table 6
  - semi final should not be on table 5
5. For group of 3 (single or team), assign a single table for the group, and assign each match in the group to that table one at a time, until all matches in that group are finished.
6. For group of 4 or more (single or team), no fixed table for the group, all matches in the group will be placed in the main match queue

## Match Queue

The Match Queue will be re-built every time a match is confirmed (after finish) or reset.

The Match Queue will also be re-built when a schedule (at any stage) is generated for an event.

When building the match queue:

- for all events that have already started (based on the event date/time), determine the priority of the event:
  - if the current stage/round of the events (group, quarterfinal, semifinal...) are the same, the event with earlier start date/time has higher priority
  - the event with later stage (knockout is later than group, semifinal is later than quarterfinal...) has higher priority  
- sort the events based on the priority (high to low), and take all the current remaining matches (keep the order in the schedule) of each event, and form the match queue
- e.g., event A (1pm, group), B (2pm, quarterfinal), C (3pm, group), D (4pm, not started yet), now is 3:30pm, the match queue would be [...remaining quarterfinal matches in B, ...remaining group matches in A, ...remaining group matches in C]
- A group of 3 (single or team), will be treated as a single match in the Match Queue

## Assign a Table for the next Match

do the following until either no available tables or reach the end of match queue:
- take the next match in the Match Queue
- if any player in that match is currently playing on another table, skip the match. For group of 3, that means any player in that group
- try to find a table for the match based on the Table Assigning Rules, if found, assign the table to the match and remove the match from the queue

This process will be triggered when
- a match is finished and confirmed, or reset
- when a request to retrieve the Match Queue is received, if
  - the Match Queue is empty, and
  - all tables are available, and
  - there is an event already started (today's event, the current time passed the event's start time)
  then start the assigning process (if an already started event doesn't have groups, generate the groups, if it doesn't have schedule for the current stage/round, generate the schedule. and if there are more than 1 event with the same start time, do the higher tier event first)

## Team Events

for team events
- generate team match schedule, add to queue and assign tables for each team match just like singles, e.g., nan/bill vs tom/jack on table 6
- a team match needs to start by both sides/teams, e.g., nan or bill needs to start, and tom or jack also needs to start
- when start, each team needs to select the order of play
  - for home team, who is A, B, C...
  - for away team, who is X, Y, Z...
- after both sides select the order, generate the sub-matches of the current team match (refer to #### Team Match Schedules in match.md), e.g., A vs Y, B vs X, AB vs XY...
- put the sub-matches into the queue, and mark them current table only, and have the highest priority on that table
- delete the current team match on the table
- if one side/team reaches the "Team Match" winning score, e.g., reaches 2 for best of 3, reaches 3 for best of 5, finish the team match and delete the remaining sub-matches in queue
