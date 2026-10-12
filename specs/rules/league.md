# League Rules

A league is a multi-week or recurring tournament format where players or teams play a series of matches against each other over time to accumulate points on a standings table.

## Length of league
n = Number of Teams
T = Number of Tables
R = Rounds/Weeks per phase
P = Number of phases
L = R * P

For now, assume T = n/2 or T = (n-1)/2, so at most 1 team has a buy each week, so

R = n is even ? n - 1 : n

E.g., 12 teams, 2 phases, then total 22 rounds/weeks

## Scheduling

Use the Geometric Circle Method (Rotating Clockwise) in each phase. The scheduling in each phase is identical.

E.g., 6 teams, 5 rounds

R1  R2  R3  R4  R5
1—6 1—5 1—4 1—3 1—2
2—5 6—4 5—3 4—2 3—6
3—4 2—3 6—2 5—6 4—5

General formula when team t (where t in {1, 2,..., n}) is placed at the fixed position

- Index Mapping (Excluding Team t): Remove Team t from the list of teams and map the remaining n-1 teams to zero-based indices 0, 1,..., n-2 in their natural order. Index 0 -> Team 1, Index 1 -> Team 2,..., Index t-2 -> Team t-1, Index t-1 -> Team t+1, Index t -> Team t+2,..., Index n-2 -> Team n.  
- In round r (where r in {0, 1,..., n-2})
  - Fixed Team Match: Team t plays the team at index: k = (n - 2 - r) (mod n - 1), e.g., n=6, r=2, t=1, then k=(6-2-2) (mod 5)=2, index 2 -> team 4, so team 1 plays team 4 in round 3
  - Non-Fixed Matches: Pair indices a and b (a!=b) such that (a+b) (mod n-1) = 2k (mod n-1), e.g., same example from above, k=2 from the fixed team calculation, 2k (mod n-1) = 4, so a+b = 4, 2 pairs: [a=0, b=4], [a=1, b=3], so team 2 vs team 6 and team 3 vs team 5 in round 3

By default, team 1 is at the fixed position.

Home - Away assignment rules
- If n is odd, every team should play m Home matches and m away matches in a phase
- If n is even, every team should play n/2 Home matches and n/2 - 1 away matches, or n/2 - 1 Home matches and n/2 away matches
- No team should play more than 2 consecutive Home or Away matches. 

Table assignment
Teams should rotate on tables every week.
- No team should play on the same table as last week
- No team should play on the same table more than 2 times per phase

A French League fixture is played on 2 tables: the club's tables are taken two by two, neighbours in its order ([5, 6], [7, 8], [1, 2], [3, 4]…), and each fixture gets a pair. The rotation rules above apply to the pairs. n teams then need 2 × floor(n/2) tables. The fixture shows both ("5 & 6"); Switch Table moves it to the pair holding the picked table, swapping with the fixture there, before and after the week's matches are generated. A league scheduled before fixtures took two tables gets them when read: each fixture takes the pair holding its table, or the next free pair.

## Format

1. RR Singles
All sub matches are singles. Every player in team 1 plays every player in team 2. The schedule of the team match for team of 2 (Home team AB, away team XY):

A vs X
B vs Y
A vs Y
B vs X

For team of 3 (Home team ABC, away team XYZ):

A vs X
B vs Y
C vs Z
A vs Y
B vs Z
C vs X
A vs Z
B vs X
C vs Y

2. Singles and Doubles
Same format as the team matches in tournaments

3. French League
Team of 4 only. Same team match as a French League tournament (match.md, "French League"): 14 sub matches, 6 singles, 2 doubles, then 6 singles; every player plays 3 singles and 1 doubles. Each team match uses its fixture's 2 tables at once, the same way as the tournament (Home team ABCD, away team XYZW; table 1 / table 2 of the pair):

| # | Match | Table |
|---|---|---|
| 1 | A vs Y | 1 |
| 2 | B vs X | 2 |
| 3 | C vs W | 1 |
| 4 | D vs Z | 2 |
| 5 | B vs W | 1 |
| 6 | A vs Z | 2 |
| 7 | AC vs XZ | 1 |
| 8 | BD vs WY | 2 |
| 9 | C vs X | 1 |
| 10 | D vs Y | 2 |
| 11 | A vs W | 1 |
| 12 | B vs Z | 2 |
| 13 | C vs Y | 1 |
| 14 | D vs X | 2 |

- each table plays its own matches in order
- the doubles don't start until all of the first 6 singles are finished, and the 2 doubles start at the same time; the last 6 singles follow once the doubles are done
- a match whose player is still playing on the other table waits on its table (the tablet shows who it is waiting for) and starts when they are free

The 4 singles pairings not played are A vs X, B vs Y, C vs Z, D vs W.

For now the order of play is generated, not picked: when the matches of a round are generated, each team's selection order is its order of play (first selected is A / X, then B / Y, C / Z, D / W), and the 14 sub matches are created straight away.

## Players

Team Size = n, and team of {n} means n players from each team will play on a given match day, but each team can have more than n players on the roster.

A player can be on multiple team's roster (shared player), but can only play for 1 team on a given match day.

The playering members of each team will be selected before the match start time on a match day. When all playering members are selected for all teams, the match schedule of that match day can be generated.

New players can be added to team roster until round/week {r} starts. By default, r is the last round, whihc means new players can be added at any time.