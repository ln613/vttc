# Tournament APIs

## Save tournament

### input

- tournament id = null
- name *
- sex = all
- type = single
- teamSize = null (required if type = team)
- restriction = open
- ratingLimit = null (required if restriction = rated)
- topPlayersRatingEnabled = false
- topPlayersCount = null (required if topPlayersRatingEnabled = true)
- topPlayersRatingLimit = null (required if topPlayersRatingEnabled = true)
- ageLimitType = null (required if restriction = age)
- ageLimit = null (required if restriction = age)
- stages = group + knockout

### derived input

- isEdit (tournament id != null)
- nop (1 if type = single, 2 if type = double, team size if type = team)

### Prerequisite

- if !isEdit, no tournament with the same name exists
- if IsEdit, tournament with id exists

### Action

- create the tournament
- save to db

### Output

return the new tournament

## Save event

An event is a tournament on a specific date with specific max participants.

### input

- event id = null
- tournament id *
- date *
- max participants = unlimited
- name = {tournament name} - {date}
- groupGames = best of 3
- knockoutGames = best of 3 before semifinal
- groupMatches = best of 3
- knockoutMatches = best of 3 before semifinal
- qualifiers = 2
- handicapEnabled = false
- handicapDifference = 200
- handicapMaxPoints = 5

### derived input

- isEdit (event id != null)

### Prerequisite

- if !isEdit, no event with the same name and date exists
- if IsEdit
  - event with id exists
  - no schedules have been created

### Action

- event is a sub class of tournament, copy the tournament fields (ecept id and name) to the new event object
- save to db

### Output

return the new event

## Add participant

Add a participant (1 player or a pair of players or 1 team) to a event

### input

- event id *
- a list of player ids *
- team name

### Prerequisite

- event exists
- player(s) exist
- no deplicate players in the input
- the number of players in the input = nop of event
- the number of existing participants < max participants
- if event is a rated event:
  - single event: the player rating must meet the rating requirement
  - double event: the combined rating of the pair must meet the rating requirement
  - team event:
    - the combined rating of the team must meet the rating requirement
    - if topPlayersRatingEnabled, the combined rating of the top {topPlayersCount} players in the team must meet the {topPlayersRatingLimit} requirement
- if event is a age event, all players must meet the age requirement

### Action

- create a participant with id, player list
- save to db

### Output

return the new participant

## Delete participant

Delete a participant from a event

### input

- event id *
- participant id *

### Prerequisite

- event exists
- participant exist in the event
- event not started (no groups and no schedules)

### Action

- delete the participant from the event
- save to db

### Output

return the deleted participant

## Generate groups

### input

- event id *

### Prerequisite

- event exists
- the first stage of the event must be group stage
- number of participants >= 4
- event not started (no groups and no schedules)

### Action

- generate groups and the match schedule of all matches in all groups
- save to db

### Output

return the generated groups

## Generate knockout

### input

- event id *

### Prerequisite

- event exists
- the last stage of the event must be knockout stage
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

- event id *
- match id *
- match result (result of each game in the match) *

### Prerequisite

- event exists
- match exists
- match is not finished (doesn't have a result)

### Action

- attach the result to the match
- save to db

### Output

return the updated match
