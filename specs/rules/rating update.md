# Rating Update Logic

How the rating calculation updates player ratings from match results. Ratings are integers.

There will be different versions of rating rules. Each ## section represent 1 version. Each club/event will be configured to use a specific version.

Club VTTC is going to use version TT-CAN-1.

## TT-CAN-1

### Rating tables

Two fixed lookup tables drive the rating change. They encode a table-tennis style rating system where the size of the change depends on the rating gap between winner and loser.

#### `rdelta` — rating-gap thresholds (14 entries)

```
[401, 301, 201, 151, 101, 51, 26, -24, -49, -99, -149, -199, -299, -399]
```

#### `rdiff` — [winner gain, loser loss] per index (15 entries)

```
index  gain  loss
  0      3     0
  1      5    -2
  2      8    -5
  3     10    -7
  4     13    -9
  5     15   -11
  6     18   -14
  7     20   -16
  8     25   -21
  9     30   -26
 10     35   -31
 11     40   -36
 12     45   -41
 13     50   -45
 14     55   -50
```

Interpretation: when the winner's rating is much higher than the loser's (a large positive gap, expected result), the winner gains little and the loser loses nothing/little. When the winner's rating is much lower (a large negative gap, an upset), the winner gains a lot and the loser loses a lot.

### Mapping a rating gap to a change

`findRatingDeltaIndex(d)` maps a rating gap `d` (winner rating − loser rating) to an index into `rdiff`:

- Walk `rdelta` from index 0; return the first index `i` where `d >= rdelta[i]`.
- If `d` is below every threshold (`d < -399`), it belongs in the last bucket, index `rdelta.length` = 14.

The 14 thresholds define 15 buckets — one per `rdiff` row. Intended mapping:

| Gap `d`        | index | gain / loss |
| -------------- | ----- | ----------- |
| `>= 401`       | 0     | +3 / 0      |
| `301 … 400`    | 1     | +5 / −2     |
| `201 … 300`    | 2     | +8 / −5     |
| `151 … 200`    | 3     | +10 / −7    |
| `101 … 150`    | 4     | +13 / −9    |
| `51 … 100`     | 5     | +15 / −11   |
| `26 … 50`      | 6     | +18 / −14   |
| `-24 … 25`     | 7     | +20 / −16   |
| `-49 … -25`    | 8     | +25 / −21   |
| `-99 … -50`    | 9     | +30 / −26   |
| `-149 … -100`  | 10    | +35 / −31   |
| `-199 … -150`  | 11    | +40 / −36   |
| `-299 … -200`  | 12    | +45 / −41   |
| `-399 … -300`  | 13    | +50 / −45   |
| `<= -400`      | 14    | +55 / −50   |

### Update logic

Each player starts from their current rating. Match results are applied sequentially, each reading and updating the players' running ratings:

- If the match is a tie, skip it (no rating change).
- Identify winner and loser and read their running ratings. If either player is unknown, skip the match.
- Compute the gap `d = winnerRating − loserRating`.
- Look up `[winnerGain, loserLoss]` via `findRatingDeltaIndex(d)`.
- New winner rating = `winnerRating + winnerGain`; new loser rating = `loserRating + loserLoss`.
- These updates persist, so later matches in the same run use them.

Each player's final rating is the value left after all matches are applied.

Notes:

- Ratings update **cumulatively within one run** — a player who wins two matches has both changes applied in sequence, and the second match uses the post-first-match rating.
- Matches are processed in the order of confirmed time.
- A player not appearing in any match keeps their original rating.
- Rating update does not include test/simulated events

### Interaction: expected win, small gap

Given player `A` rated 1000 beats player `B` rated 990 (gap `d = 10`, index 7):

- `A` gains +20 → 1020
- `B` loses −16 → 974

### Interaction: upset, large negative gap

Given player `A` rated 800 beats player `B` rated 1500 (gap `d = -700`, index 14):

- `A` gains +55 → 855
- `B` loses −50 → 1450

(Note: the current code hits the fallback bug and instead applies index 13, `+50 / −45`, giving 850 / 1455.)

### Interaction: tie produces no change

Given a match where both players won the same number of games, no rating change is applied to either player.

### Interaction: cumulative updates within a run

Given player `A` rated 1000 who plays two matches in the same result set:

- Match 1: `A` beats `B` (990) → `A` becomes 1020 (gap 10, +20)
- Match 2: `A` beats `C` (1000) → uses `A`'s rating of 1020, gap `20`, index 7, +20 → `A` becomes 1040

The final rating for `A` is 1040.

### Interaction: unknown player in a match is skipped

If a match references a player not in the player list, that match is skipped and no other match is affected.
