# battleship

A Vellum plugin that lets you play Battleship against your assistant.

This plugin demonstrates three plugin surfaces working together:

- **Apps** — The `apps/battleship/` directory ships a single-file HTML game
  board. The assistant discovers it natively as a plugin-bundled app (id:
  `plugins~battleship~battleship`) and serves it in the workspace panel.
- **Routes** — File-based HTTP endpoints (`routes/`) serve the game API for
  the app UI. The guardian fires shots and checks game state through these.
  After the player fires, the game route triggers the assistant's turn
  automatically via `runConversationTurn` from the plugin API.
- **Skills** — The `skills/battleship/SKILL.md` instructs the assistant on
  how to play. A script at `skills/battleship/scripts/battleship.ts` provides
  `fire` and `status` subcommands that import the shared game logic directly.

## Architecture: Routes vs Skill Scripts

Routes and skill scripts serve different actors:

- **Routes** (`routes/`) are for the **guardian** (the app UI). The player
  fires shots and reads game state through HTTP endpoints.
- **Skill scripts** (`skills/battleship/scripts/`) are for the **assistant**.
  They import `src/game-logic.ts` directly and execute in-process.

Both share the same game logic module (`src/game-logic.ts`) and the same
file-based state store (`src/state-store.ts`), so the game stays consistent
regardless of which actor makes a move.

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
     |                    battleship.ts status (reads game state)
     |                    battleship.ts fire A5 (imports game-logic.ts)
     |                    turn passes back to player
     |                                    |
     | GET /game (polling)                |
     |<-------- updated state             |
```

## Hidden Information

The key Battleship mechanic is hidden information. Both the app UI and the
assistant's script receive sanitized views: hits and misses are visible, but
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
      scripts/
        battleship.ts       # fire <coordinate> and status subcommands
  routes/
    game.ts                 # Guardian-facing game API (GET state, POST fire/new)
  src/
    game-logic.ts           # Core game logic (shared by routes + skill scripts)
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
4. The assistant is automatically triggered to take its turn — it runs
   the battleship script to read the board, pick a coordinate
   strategically, and fire back
5. First to sink all 5 enemy ships wins!
