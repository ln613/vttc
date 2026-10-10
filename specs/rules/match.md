# Game/Match rules

## Games

- A game is between 2 sides, each side can have 1 or more players
- Alternate serves every 2 points
- Whoever reachs 11 points and leads by 2 or more points wins the game
- If the game is tied at 10:10, then alternate serves every 1 point. The side who leads by 2 first wins the game
- In the last game of the match (3rd game for best of 3, 5th game for best of 5), when one side reaches the switching point 5, players switch side

There are some variations of the game.

### Golden Game

No need to win by 2 after 10:10, whoever reachs 11 points wins the game

### Short Game

- Plays to 7 points
- Alternate serves every 1 point after 6:6, must win by 2
- Golden short game: no need to win by 2 after 6:6, whoever reachs 7 points wins the game
- switching point is 3

### long Game

- Plays to 21 points
- Alternate serves every 1 point after 20:20, must win by 2
- Golden long game: no need to win by 2 after 20:20, whoever reachs 21 points wins the game

### Handicap Game

- The player(s) with higher rating/combined rating will give points to the other side
- Gives 1 point every D in rating difference, D = 200 by default
- Max points given, MP = 5 by default
- Handicap game cannot be short or long game
- Handicap game can be golden game

For example:
- a single game between A (1521) and B (907) will start from 0:3
- a double game between A (312) + B (966) and X (1023) + Y (982) with D = 100 and MP = 6 will start from 6:0

## Matches

- A match consists of 1, 3, 5 or 7 games (GS), also known as Best of 3, Best of 5...
- A sudden death match stops when one side has won Math.ceil(GS / 2) games
- A non sudden death match will play all games
- Single Match: 1 player on each side
- Double Match: 2 players on each side
- The winner of a match is the side who wins more games
- By default, a match in the Semifinal or Final round in the knockout stage is best of 5, otherwise, best of 3

### Team Match

A team match is a series of matches (MS) between 2 teams with 2 or more players each. A team match is always sudden death on matches, whoever wins Math.ceil(MS / 2) matches first wins the team match.

#### Team Members

##### Team of 2 (nop = 2)

- home team: A,B
- away team: X,Y
- input params when generating the team match schedule:
  - which team is home team
  - who is A
  - who is X
- the system can derive the rest 

##### Team of 3 (nop = 3)

- home team: A,B,C
- away team: X,Y,Z
- input params when generating the team match schedule:
  - which team is home team
  - who is A,B
  - who is X,Y
- the system can derive the rest 

##### Team of 4 (nop = 4)

- home team: A,B,C,D
- away team: X,Y,Z,W
- input params when generating the team match schedule:
  - which team is home team
  - who is A,B,C
  - who is X,Y,Z
- the system can derive the rest 

#### Team Match Schedules

##### Team of 2, Best of 3 Matches

- team of 2
- 3 matches:
  - 1st: single match A vs Y
  - 2nd: single match B vs X
  - 3rd: double match AB vs XY

#### Team of 2, Best of 5 Matches

- team of 2
- 5 matches:
  - 1st: single match A vs Y
  - 2nd: single match B vs X
  - 3rd: double match AB vs XY
  - 4th: single match A vs X
  - 5th: single match B vs Y

#### Team of 3, Best of 5 Matches

- team of 3
- 5 matches:
  - 1st: double match BC vs YZ
  - 2nd: single match A vs X
  - 3rd: single match C vs Z
  - 4th: single match A vs Y
  - 5th: single match B vs X

#### French League

- team of 4 (home ABCD, away XYZW)
- each team match is played on 2 tables at the same time
- 14 matches: 6 singles, then 2 doubles, then 6 singles. Every player plays 3 singles and 1 doubles. Odd matches are on the team match's 1st table, even ones on its 2nd:

| Table 1 | Table 2 |
|---|---|
| 1st: single A vs Y | 2nd: single B vs X |
| 3rd: single C vs W | 4th: single D vs Z |
| 5th: single B vs W | 6th: single A vs Z |
| 7th: double AC vs XZ | 8th: double BD vs WY |
| 9th: single C vs X | 10th: single D vs Y |
| 11th: single A vs W | 12th: single B vs Z |
| 13th: single C vs Y | 14th: single D vs X |

- the doubles don't start until all of the first 6 singles are finished, and the 2 doubles start at the same time, one on each table. The last 6 singles start after both doubles are finished
- each table plays its own matches in order; a match whose player is still playing on the other table waits on its table for them
- the 4 singles pairings not played are A vs X, B vs Y, C vs Z, D vs W
- with 2 tables nobody can always rest between singles: W (3rd, 5th) and Z (4th, 6th) play twice in a row, each on the same table, and everyone goes from the singles straight into the doubles
- a league plays French League on its fixture's one table: the same 14 matches in the same order, one at a time
- for now the order of play is generated, not picked: each team plays in rating order, the order the team is listed in (highest rated is A / X, then B / Y, C / Z, D / W; a league uses its selection order instead, see league.md), and the 14 matches are created together with the team match, so the schedule shows who plays whom before it starts. Having these matches doesn't mean the team match has started; only playing one does
