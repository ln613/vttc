# Tournament rules

A tournament has the following fields:

- name
- date: a tournament is a single day event
- nop: number of players per team
- type (derived): single (nop = 1), team (nop > 1)
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

#### Seeding

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

