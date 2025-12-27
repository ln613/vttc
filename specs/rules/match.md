# Game/Match rules

## Games

- A game is between 2 sides, each side can have 1 or more players
- Alternate serves every 2 points
- Whoever reachs 11 points and leads by 2 or more points wins the game
- If the game is tied at 10:10, then alternate serves every 1 point. The side who leads by 2 first wins the game

There are some variations of the game.

### Golden Game

No need to win by 2 after 10:10, whoever reachs 11 points wins the game

### Short Game

- Plays to 7 points
- Alternate serves every 1 point after 6:6, must win by 2
- Golden short game: no need to win by 2 after 6:6, whoever reachs 7 points wins the game

### long Game

- Plays to 21 points
- Alternate serves every 1 point after 20:20, must win by 2
- Golden long game: no need to win by 2 after 20:20, whoever reachs 21 points wins the game

### Handicap Game

- The player(s) with higher rating/combined rating will give points to the other side
- Gives 1 point every D in rating difference, D = 200 by default
- Max points given is 5
- Handicap game cannot be short or long game
- Handicap game can be golden game

For example, a game between A (1521) and B (907) will start from 0:3

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
- input params when starting the team match:
  - which team is home team
  - who is A
  - who is X
- the system can derive the rest 

##### Team of 3 (nop = 3)

- home team: A,B,C
- away team: X,Y,Z
- input params when starting the team match:
  - which team is home team
  - who is A,B
  - who is X,Y
- the system can derive the rest 

##### Team of 4 (nop = 4)

- home team: A,B,C,D
- away team: X,Y,Z,W
- input params when starting the team match:
  - which team is home team
  - who is A,B,C
  - who is X,Y,Z
- the system can derive the rest 

#### Team Match Types

##### Type 1

- team of 2
- 3 matches:
  - 1st: single match A vs X
  - 2nd: single match B vs Y
  - 3rd: double match AB vs XY

#### Type 2

- team of 2
- 5 matches:
  - 1st: single match A vs X
  - 2nd: single match B vs Y
  - 3rd: double match AB vs XY
  - 4th: single match A vs Y
  - 5th: single match B vs X

#### Type 3

- team of 3
- 5 matches:
  - 1st: double match BC vs YZ
  - 2nd: single match A vs X
  - 3rd: single match C vs Z
  - 4th: single match A vs Y
  - 5th: single match B vs X
