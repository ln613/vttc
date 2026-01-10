# Tournament rules

A tournament has the following fields:

- name
- date: a tournament is a single day event
- nop: number of players per team
- type: single (nop = 1), double (nop = 2), team (nop > 1)
- stages: 

## Stage

There are different types of stages.

### Group Stage

Teams/Players are grouped into a number of groups, and play round robin in each group.

#### Number of groups

The number of groups are determined by the total number of Teams/Players (N):

- N < 6: 1 group
- N = 16: 4 groups
- N = 32: 8 groups 
- otherwise, Math.floor(N / 3) groups

#### Seeding (Rating based seeding, RBS)

- nop = 1: the player's rating
- nop = 2 or 3: the combined rating of the 2 or 3 players in the team
- nop > 3: the combined rating of the top 3 players in the team

#### Form the groups

The groups will be formed using the "snake seeding" method.

For example, if there are totally 11 players/teams, then based on the seeding:

G1    G2    G3
s1    s2    s3
s6    s5    s4
s7    s8    s9
      s11   s10

#### Match schedule

Group of 3:
- the 1st match is between seed 2 and seed 3
- the 2nd match is between seed 1 and seed 3
- the 3rd match is between seed 1 and seed 2

Group of 4:
- the 1st match is between seed 1 and seed 4
- the 2nd match is between seed 2 and seed 3
- the 3rd match is between seed 1 and seed 3
- the 4th match is between seed 2 and seed 4
- the 5th match is between seed 3 and seed 4
- the 6th match is between seed 1 and seed 2

#### Ranking

The ranking of the teams/players in a group is determined based on the following order:

1. Number of matches won (MW)
2. When MW is tied
  - if tied between 2 teams/players, who wins the head-to-head match ranks higher
  - if 3-way (or more than 3) tie, then apply the following rules among the tied players:
    a. Number of total games won - Number of total games lost (Game Difference, GD)
    b. Number of total games won (GW)
    c. Number of total points won - Number of total points lost (Point Difference, PD, in all games in all matches)
    d. Number of total points won PW

#### Advancement

- The top T players/teams in each group advance to the next stage. T = 2 by default unless specified otherwise.
- The advanced players/teams will be marked with their group and ranking G1 - R1, G1 - R2, G2 - R1 ...


### Knockout Stage

- Elimination stage. Winner of each match goes to the next round. Loser will be eliminated.
- Knockout Stage is always the last stage in a tournament event.
- Knockout Stage can be the first stage in an event (Elimination, EE), or preceded by a group stage (Group event, GE).

#### The number of participants (N)

For GE, the participants will be the players/teams advanced from the previous group stage.

#### Rounds

The elimination stage consists of several rounds. The number of rounds (R) is determined by:

R = Math.ceil(Math.log2(N))

#### Remaining participants in each round

- N is the 1st round remaining participants.
- Starting from the 2nd round, the number of remaining participants is always a power of 2.
- Starting from the 3rd round, the number of remaining participants is always half of the previous round.
- the number of remaining participants in the 2nd round (N2) is:
  - N / 2, if N is a power of 2
  - Math.pow(2, Math.floor(Math.log2(N)))

#### Name of the round

- find n, where:
  - if the number of participants in that round is a power of 2, n = the number of participants
  - otherwise n = Math.pow(2, Math.floor(Math.log2(N)) + 1)
- when n > 8, name = "Round of {n}", short name = "R{n}"
- when n = 8, name = "Quarterfinal", short name = "QF"
- when n = 4, name = "Semifinal", short name = "SF"
- when n = 8, name = "Final", short name = "F"

#### 1st round Seeding

- For EE, seeding is rating based (RBS), just like the group stage seeding
- For GE, seeding is determined by the "snake ranking"

For example, John - 1500, Peter - 1400, Tony - 1300, Sam - 1200, Joe - 1100, Tom - 1000, Phil - 900, Frank - 800, Glen - 700, and the group result/ranking is:

    G1    G2    G3
R1  Tom   Joe   Tony
R2  John  Frank Glen
R3  Phil  Peter Sam

First 2 from each group advance, and 1st round seeding for the knockout stage is Tom, Joe, Tony, Glen, Frank, John. 

#### Bye in the first round

If N is NOT power of 2, the top 2 * N2 - N participants in the 1st round seeding list will have a bye.

#### Matches (1st and subsequent rounds)

After removing the participants who have a bye from the seeding list, pair participants to form matches in the following way:

- take 1 from top, 1 from bottom
- if they were in the same group (they are already marked with their previous group and ranking), replace the one from bottom with the 2nd from bottom, and so on...
- if no match found after reaching the top, keep the current match even if they were from the same group
- take these 2 out of the seeding list, form a match, and keep doing the same to the remaining seeding list until the list is empty

In the previous example, in the first round, Tom and Joe will have a bye, Tony vs John, Glen vs Frank 

#### Subsequent round Seeding

- start with the previous round seeding list
- for each bye participant from the previous round, keep their seeding
- for each match from the previous round, whoever wins the match will take the seeding position of the higher seed participant between the 2 participants in that match, and remove the loser from the seeding list
- if there are still duplicates in the seeding list, keep the highest seed for each participant

In the previous example, if John beat Tony and Glen beat Frank in the first round, then the 2nd round seeding is Tom, Joe, John, Glen, and the 2nd round matches will be Tom vs Glen, Joe vs John.

## Participant Sex

- All: No restriction, both men and women can participate
- Man: Only for men
- Woman: Only for women
- Mixed:
  - For single tournament, same as All.
  - For double tournament, each participant must be 1 man + 1 woman.
  - For team tournament, each participant must have at least 1 woman.

## Tournament Restriction

- Open: no rating limit, no age limit
- Rated:
  1. the rating of:
    - any participant in single event
    - the combined rating of any pair in double event
    - the combined rating of all players in any team in team event
    must be under (<=) the rating limit (RL)
  2. for team event with nop > 2, the combined rating of the top N (default 2) players in any team must be under (<=) the top players rating limit (TPRL)
- Age: the age of any participant must be under (<=) or over (>=) the age limit, e.g., U19, under 19-year old, O40, over 40-year old
