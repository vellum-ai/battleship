---
name: battleship
description: Play Battleship against your assistant. The user fires from the app UI; you fire by running the battleship script. Use this skill when the user asks to play Battleship, when it's your turn to fire, or when the user asks about the game state.
metadata:
  emoji: "naval_jack"
  vellum:
    display-name: "Battleship"
    category: "games"
    activation-hints:
      - "User asks to play Battleship or wants to fire a shot"
      - "User says it's your turn or asks you to take your turn"
      - "User asks about the current Battleship game state"
    avoid-when:
      - "No active game and user hasn't asked to start one"
---

# Battleship

You are playing Battleship against the user. The game runs as a plugin with
three surfaces: an app (the board UI the user interacts with), routes (the
game API for the app UI only), and this skill (your script for taking your turn).

## How the Game Works

- 10x10 grid, standard ships: Carrier (5), Battleship (4), Cruiser (3), Submarine (3), Destroyer (2)
- Ships are randomly placed at game start
- Players alternate turns: user fires from the app, you fire by running the script
- First to sink all 5 enemy ships wins
- Coordinates: A1 (top-left) through J10 (bottom-right), letter = row, number = column

## Multi-Game Support

Multiple games can exist simultaneously. The script defaults to the most
recent active game, but you can target a specific game with `--game <id>`.

## Your Script

You interact with the game through a script at `skills/battleship/scripts/battleship.ts`.
Run it with `bun` from the plugin directory.

### Check game state

```bash
bun skills/battleship/scripts/battleship.ts status
```

Returns whose turn it is, your targeting grid (H=hit, M=miss, .=unknown),
how many enemy ships remain, and all your past shots. Uses the most recent
active game.

To check a specific game:

```bash
bun skills/battleship/scripts/battleship.ts status --game <gameId>
```

### Fire a shot

```bash
bun skills/battleship/scripts/battleship.ts fire A5
```

Fires at the given coordinate. Returns the result (hit, miss, sunk), your
updated targeting grid, remaining enemy ships, and whose turn is next.

To fire in a specific game:

```bash
bun skills/battleship/scripts/battleship.ts fire A5 --game <gameId>
```

## Strategy

1. **Start with a search pattern.** Fire at every other cell in a checkerboard
   pattern to find ships efficiently (since the smallest ship is 2 cells, a
   checkerboard guarantees you'll hit every ship).

2. **After a hit, sweep adjacent cells.** Once you get a hit, fire at the four
   adjacent cells (up, down, left, right) to determine the ship's orientation.

3. **Once orientation is known, follow the line.** If two hits are in a row,
   continue along that row/column until you sink the ship.

4. **Read the targeting grid from each response** to avoid repeating shots
   and to plan your next move.

5. **Run status before your first shot** to see the current board and confirm
   it's your turn.

## Taking Your Turn

When the user tells you it's your turn (or the game triggers you automatically):

1. Run `bun skills/battleship/scripts/battleship.ts status` to see your targeting grid
2. Pick a coordinate based on your strategy
3. Run `bun skills/battleship/scripts/battleship.ts fire <coordinate>` to fire
4. Report the result to the user (hit, miss, sunk)
5. If you won, celebrate. If not, tell the user it's their turn

## Opening the App

If the user wants to see the board, open the app:

```
app_open(app_id="plugins~battleship~battleship")
```
