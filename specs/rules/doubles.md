# Doubles: who serves and who receives

In doubles it is not enough to know which side is serving — the umpire has
to know which of the two is on the ball, and which of the other two is
taking it. Both are chosen once, at the start, and everything after follows
from the score.

## Choosing, at match setup

Below the serve / umpire's-left grid, and clearly separated from it, a
four-column grid appears once a serving side has been picked:

| | Serve | Receive | |
| --- | --- | --- | --- |
| serving player 1 | serve icon | receive icon | receiving player 1 |
| serving player 2 | serve icon | receive icon | receiving player 2 |

Tapping an icon names that player; the chosen icon shows in colour and the
others stay grey. **Start is refused until both are chosen.** A singles
match has nobody to choose between and is unaffected.

The receive icon is the serve icon without the ball — the same paddle, to
say "this one is receiving it". It was produced by putting `serve.png`
through the image model named by `OPENAI_IMAGE_MODEL`, asking it to take
the ball out, and is checked in at `src/assets/receive.png`.

`ball.png` is the ball on its own, cut straight out of `serve.png` — it is
a plain circle, so the source is exact and matches the serve icon pixel for
pixel.

All four icons — `serve`, `receive`, `ball`, `table` — are 64x64, the size
they are drawn at.

## The rotation

A game is a cycle of four. With A serving first to X, service passes

    A → X → B → Y → A …

and the receiver is always the next player in that cycle: A serves to X, X
serves to B, and so on. Service changes every two points, and every point
once both sides reach one short of the target.

Two things reshape the cycle, and **both are permanent** — the sequence
carries on from the new arrangement rather than snapping back.

### A new game

Every game after the first asks **only who is serving**: the side is
already settled by the rotation, so only that pair's two players are
offered.

The first receiver is then whoever served to that player in the previous
game. If game 1 ran A→X→B→Y and X serves game 2, then X serves to A, and
game 2 runs

    X → A → Y → B → X …

Had Y served game 2 instead, Y would serve to B, because B served to Y in
game 1.

### The deciding game

When the players change ends at the half-way point (5 of 11, 3 of 7), the
receiving pair swap who is taking the serve — **and stay swapped**. A→X
becomes A→Y, and the cycle carries on from there:

    A → Y → B → X → A …

Whoever is mid-serve keeps the ball; it is the pair receiving at that
moment who exchange places.

The score alone cannot say when the change of ends happened, so the total
points played at that moment is recorded on the match.

## On the score box

The two players on the ball are named outright:

- the server: a ball, then "{name} - Serving"
- the receiver: the receive paddle, then "{name} - Receiving"

Each in its own colour. Everyone else is drawn as before.
