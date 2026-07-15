# battleship

A Vellum plugin that lets you play Battleship against your assistant.

This plugin demonstrates two plugin surfaces working together:

- **Routes** — File-based HTTP endpoints (`routes/`) serve the game API.
  The app UI calls these to fire shots and check game state.
- **Tools** — The assistant uses `battleship-fire` and `battleship-status`
  tools to take its turns during conversation.

Since plugins cannot yet directly contribute apps, the `init` hook
programmatically creates a workspace-level app (writing the manifest +
HTML into `data/apps/battleship/`) when the plugin loads. The app is a
single-file HTML game board that renders both your fleet and the enemy
waters, and communicates with the plugin's routes via the Vellum fetch
proxy.

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
     |                                    |
     |                    battleship-fire tool
     |                    fires at player's board
     |                    routes/assistant-fire.ts
     |                    turn passes back to player
     |                                    |
     | GET /game (polling)                |
     |<-------- updated state             |
```

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
  package.json          # Plugin manifest (name, peerDependencies)
  tsconfig.json
  hooks/
    init.ts             # Creates the workspace app on plugin load
  tools/
    battleship-fire.ts  # Assistant fires at player's fleet
    battleship-status.ts # Assistant checks game state
  routes/
    game.ts             # Player-facing game API (GET state, POST fire/new)
    assistant-fire.ts   # Assistant-facing fire endpoint
  src/
    game-logic.ts       # Core game logic (shared by routes + tools)
    state-store.ts      # File-based game state persistence
  app/
    index.html          # The game board UI (written to data/apps/ by init)
```

## Installation

```bash
assistant plugins install https://github.com/vellum-ai/battleship
```

After installation, restart the assistant (or let hot-reload pick it up).
The init hook creates the Battleship app automatically. Open it from the
workspace app panel, or the assistant can open it with `app_open`.

## Playing

1. Open the Battleship app from your workspace
2. Click "New Game" to start (ships are randomly placed)
3. Click cells on the "Enemy Waters" grid to fire
4. The assistant takes its turn in the conversation, reasoning about
   where your ships might be based on its hits and misses
5. First to sink all 5 enemy ships wins!
