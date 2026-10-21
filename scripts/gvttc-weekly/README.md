# GVTTC weekly reports

Turns a week's six paper scorecards into the two reports for the league admin: a web page of the scorecards (with TTCan ids and ratings from the gvttc players table) and the "Match Details" Excel file.

1. Transcribe the sheets into `wkNdata.mjs` (copy the previous week's file; the comments explain each field: tables by 台 number, home = A/B/C side, `queries` for unclear figures, `pairs` only when a sheet's rows don't follow the printed order, `'H'`/`'A'` for a match recorded without game scores, `inferred` for names matched to the roster).
2. Look up unfamiliar names: `node --env-file=.env scripts/gvttc-weekly/who.mjs '[["first","last"]]'` (regexes, read-only).
3. Build, from the repo root:

   ```sh
   G=scripts/gvttc-weekly
   node --env-file=.env $G/gen.mjs $G/wkNdata.mjs        # checks every game and each sheet's final, writes gvttc-weekN.html
   node --env-file=.env $G/tojson.mjs $G/wkNdata.mjs     # writes wk.json
   python3 $G/xlsx.py N                                  # writes the Excel into ~/Documents/t/gvttc/week N/
   cp $G/gvttc-weekN.html "$HOME/Documents/t/gvttc/week N/GVTTC 2026 Fall - Week N Scorecards.html"
   ```

`gen.mjs` refuses to write the page if a game score is impossible (unless queried) or a sheet's matches don't add up to its final.

These scripts were rebuilt on 2026-10-15; regenerating week 6 with them matched the delivered files exactly.
