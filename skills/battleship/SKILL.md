---
name: battleship
description: Play Battleship against your assistant. The user fires from the app UI; you fire by responding with a coordinate when prompted. Use this skill when the user asks to play Battleship or when it's your turn to fire.
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
two surfaces: an app (the board UI the user interacts with) and routes (the
game API). When it's your turn, the game route sends you a prompt with your
targeting grid and asks you to respond with a coordinate.

## How the Game Works

- 10x10 grid, standard ships: Carrier (5), Battleship (4), Cruiser (3), Submarine (3), Destroyer (2)
- Ships are randomly placed at game start
- Players alternate turns: user fires from the app, you fire by responding with a coordinate
- First to sink all 5 enemy ships wins
- Coordinates: A1 (top-left) through J10 (bottom-right), letter = row, number = column

## Taking Your Turn

When the game route prompts you, you'll receive:

- Your targeting grid (10x10, H=hit, M=miss, .=unknown)
- How many enemy ships remain
- A request to respond with ONLY a coordinate

**Important:** Do not run any scripts or tools. Just reply with the coordinate
you want to fire at, e.g. `B7`.

## Strategy

1. **Start with a search pattern.** Fire at every other cell in a checkerboard
   pattern to find ships efficiently (since the smallest ship is 2 cells, a
   checkerboard guarantees you'll hit every ship).

2. **After a hit, sweep adjacent cells.** Once you get a hit, fire at the four
   adjacent cells (up, down, left, right) to determine the ship's orientation.

3. **Once orientation is known, follow the line.** If two hits are in a row,
   continue along that row/column until you sink the ship.

4. **Read the targeting grid from the prompt** to avoid repeating shots
   and to plan your next move.

## Opening the App

If the user wants to see the board, open the app:

```
app_open(app_id="plugins~battleship~battleship")
```
