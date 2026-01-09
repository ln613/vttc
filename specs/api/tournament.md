# Tournament APIs

## Create tournament

### input

- name *
- date *
- max participants = unlimited
- a pre-defined format (merge the input from that format) *

### derived input

- nop (from the format)

### Prerequisite

- no tournament with the same name and date exists

### Action

- create a tournament (stages come from the format)
- save to db

### Output

return the new tournament


## Add participant

Add a participant (1 player or 1 team) to a tournament

### input

- tournament id *
- a list of player ids *
- team name

### Prerequisite

- tournament exists
- player(s) exist
- no deplicate players in the input
- the number of players in the input = nop of tournament
- the number of existing participants < max participants
- if tournament is a rated event, the player/team rating must meet the rating requirement
- if tournament is a age event, all players must meet the age requirement

### Action

- create a participant with id, player list
- save to db

### Output

return the new participant

## Delete participant

Delete a participant from a tournament

### input

- tournament id *
- participant id *

### Prerequisite

- tournament exists
- participant exist in the tournament
- tournament not started (no groups and no schedules)

### Action

- delete the participant from the tournament
- save to db

### Output

return the deleted participant

## Generate groups

### input

- tournament id *

### Prerequisite

- tournament exists
- the first stage of the tournament must be group stage
- number of participants >= 4
- tournament not started (no groups and no schedules)

### Action

- generate groups and the match schedule of all matches in all groups
- save to db

### Output

return the generated groups

## Generate knockout

### input

- tournament id *

### Prerequisite

- tournament exists
- the last stage of the tournament must be knockout stage
- number of participants >= 4
- all matches before the knockout stage are all finished
- if the current round of the knockout stage > 1, all matches before the current round in the knockout stage must be finished
- the current round is not the final round (only 2 participants left)

### Action

- generate the next knockout round and the match schedule of all matches in that round
- save to db

### Output

return the generated knockout round

## Finish a match

### input

- tournament id *
- match id *
- match result (result of each game in the match) *

### Prerequisite

- tournament exists
- match exists
- match is not finished (doesn't have a result)

### Action

- attach the result to the match
- save to db

### Output

return the updated match
