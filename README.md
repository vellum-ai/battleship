# battleship

A Vellum plugin that lets you play Battleship against your assistant.

This plugin demonstrates three plugin surfaces working together:

- **Apps** — The `apps/battleship/` directory ships a single-file HTML game
  board. The assistant discovers it natively as a plugin-bundled app (id:
  `plugins~battleship~battleship`) and serves it in the workspace panel.
- **Routes** — File-based HTTP endpoints (`routes/`) serve the game API.
  The app UI calls these to fire shots and check game state. After the
  player fires, the game route triggers the assistant's turn automatically
  via `runConversationTurn` from the plugin API.
- **Skills** — The `skills/battleship/SKILL.md` instructs the assistant on
  how to play: which routes to call, how to read the targeting grid, and
  strategy for picking shots. The assistant uses `curl` via bash to fire.

## How It Works

```
Player (app UI)                     Assistant (conversation)
     |                                    |
     | POST /game?action=new              |
     |--------> routes/game.ts            |
     |<-------- new game state            |
     |                                    |
     | POST /game { coordinate: "A5" }    |
     |--------> routes/game.ts            |
     |<-------- hit/miss/sunk result      |
     |        turn passes to assistant    |
     |        runConversationTurn()       |
     |                                    |
     |                    skill activates, assistant reads SKILL.md
     |                    curl POST /assistant-fire { coordinate }
     |                    turn passes back to player
     |                                    |
     | GET /game (polling)                |
     |<-------- updated state             |
```

## Hidden Information

The key Battleship mechanic is hidden information. Both the app UI and the
assistant's skill receive sanitized views: hits and misses are visible, but
unhit ship cells are projected as `"empty"`. The assistant genuinely has to
guess where ships are, making the game fair.

## Game Rules

Standard Battleship on a 10x10 grid:

- 5 ships: Carrier (5), Battleship (4), Cruiser (3), Submarine (3), Destroyer (2)
- Ships are randomly placed at game start
- Players alternate turns firing one shot
- First to sink all enemy ships wins
- Coordinates: A1 (top-left) through J10 (bottom-right)

## Structure

```
battleship/
  package.json              # Plugin manifest (peer dep @vellumai/plugin-api ^0.10.9)
  tsconfig.json
  skills/
    battleship/
      SKILL.md              # Instructions for the assistant on how to play
  routes/
    game.ts                 # Player-facing game API (GET state, POST fire/new)
    assistant-fire.ts       # Assistant-facing fire endpoint
  src/
    game-logic.ts           # Core game logic (shared by routes)
    state-store.ts          # File-based game state persistence
  apps/
    battleship/
      index.html            # Game board UI (served as a plugin-bundled app)
```

## Installation

```bash
assistant plugins install https://github.com/vellum-ai/battleship
```

After installation, the Battleship app appears in the workspace app library
automatically. Open it from the Library, or the assistant can open it with:

```
app_open(app_id="plugins~battleship~battleship")
```

## Playing

1. Open the Battleship app from your workspace Library
2. Click "New Game" to start (ships are randomly placed)
3. Click cells on the "Enemy Waters" grid to fire
4. The assistant is automatically triggered to take its turn — it reads
   the targeting grid, picks a coordinate strategically, and fires back
5. First to sink all 5 enemy ships wins!
