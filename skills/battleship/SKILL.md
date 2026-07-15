---
name: battleship
description: Play Battleship against your assistant. The user fires from the app UI; you fire by calling the assistant-fire route. Use this skill when the user asks to play Battleship, when it's your turn to fire, or when the user asks about the game state.
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
game API), and this skill (your instructions for taking your turn).

## How the Game Works

- 10x10 grid, standard ships: Carrier (5), Battleship (4), Cruiser (3), Submarine (3), Destroyer (2)
- Ships are randomly placed at game start
- Players alternate turns: user fires from the app, you fire by calling a route
- First to sink all 5 enemy ships wins
- Coordinates: A1 (top-left) through J10 (bottom-right), letter = row, number = column

## Your Scripts

You interact with the game through HTTP routes served at `/x/plugins/battleship/`.
Use `bash` with `curl` to call them. The base URL when calling from inside the
assistant is `http://localhost:<port>/x/plugins/battleship/` but since you run
in the workspace, you can resolve the port from the `VELLUM_RUNTIME_PORT` env
var or just use the route path directly via curl to localhost.

### Check game state

```bash
curl -s http://localhost:${VELLUM_RUNTIME_PORT:-3274}/x/plugins/battleship/game
```

Returns the current game state including:
- `status`: "playing", "player_won", "assistant_won", or "no_game"
- `turn`: "player" or "assistant"
- `enemyWaters`: your targeting grid (hits and misses only, ship positions hidden)
- `yourShips`: your fleet status (which ships are sunk)

### Fire a shot (your turn)

```bash
curl -s -X POST http://localhost:${VELLUM_RUNTIME_PORT:-3274}/x/plugins/battleship/assistant-fire \
  -H "Content-Type: application/json" \
  -d '{"coordinate": "A5"}'
```

Returns:
- `result`: "hit", "miss", "sunk", or "already"
- `sunkShip`: ship name (when sunk)
- `coordinate`: what you fired at
- `targetingGrid`: your updated targeting grid (H=hit, M=miss, .=unknown)
- `remainingEnemyShips`: how many ships left
- `gameStatus`: "playing" or "assistant_won"
- `turn`: whose turn is next

### Start a new game

```bash
curl -s -X POST "http://localhost:${VELLUM_RUNTIME_PORT:-3274}/x/plugins/battleship/game?action=new"
```

## Strategy

1. **Start with a search pattern.** Fire at every other cell in a checkerboard
   pattern to find ships efficiently (since the smallest ship is 2 cells, a
   checkerboard guarantees you'll hit every ship).

2. **After a hit, sweep adjacent cells.** Once you get a hit, fire at the four
   adjacent cells (up, down, left, right) to determine the ship's orientation.

3. **Once orientation is known, follow the line.** If two hits are in a row,
   continue along that row/column until you sink the ship.

4. **Track your shots mentally.** Read the targeting grid from each response
   to avoid repeating shots and to plan your next move.

5. **Call game state before your first shot** to see the current board and
   confirm it's your turn.

## Taking Your Turn

When the user tells you it's your turn (or the game route triggers you):

1. Call the game state route to see your targeting grid
2. Pick a coordinate based on your strategy
3. Call the assistant-fire route with that coordinate
4. Report the result to the user (hit, miss, sunk)
5. If you won, celebrate. If not, tell the user it's their turn

## Opening the App

If the user wants to see the board, open the app:

```
app_open(app_id="plugins~battleship~battleship")
```
