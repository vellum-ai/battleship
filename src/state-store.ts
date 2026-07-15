/**
 * File-based game state persistence with multi-game support.
 *
 * Games are stored as individual JSON files in the plugin's data directory:
 *   <workspace>/plugins/battleship/data/games/<gameId>.json
 *
 * An index file tracks game metadata for listing:
 *   <workspace>/plugins/battleship/data/games-index.json
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import type { GameState } from "./game-logic.js";

function dataDir(): string {
  const workspaceDir =
    process.env.VELLUM_WORKSPACE_DIR ||
    join(process.env.HOME || "~", ".vellum");
  return join(workspaceDir, "plugins", "battleship", "data");
}

function gamesDir(): string {
  return join(dataDir(), "games");
}

function gamePath(gameId: string): string {
  return join(gamesDir(), `${gameId}.json`);
}

/** Ensure the data/games directory exists. */
export function ensureDataDir(): void {
  mkdirSync(gamesDir(), { recursive: true });
}

/** Save a game state to disk. */
export function saveGame(state: GameState): void {
  ensureDataDir();
  writeFileSync(gamePath(state.gameId), JSON.stringify(state, null, 2), "utf-8");
}

/** Load a specific game by ID. Returns null if not found. */
export function loadGame(gameId: string): GameState | null {
  const path = gamePath(gameId);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

/** Load the most recent active game. Returns null if none exists. */
export function loadActiveGame(): GameState | null {
  const games = listGames();
  if (games.length === 0) return null;
  // Return the most recently created game
  const latest = games[games.length - 1];
  return loadGame(latest.gameId);
}

export interface GameSummary {
  gameId: string;
  status: string;
  turn: string;
  createdAt: string;
  playerShots: number;
  assistantShots: number;
  playerShipsRemaining: number;
  assistantShipsRemaining: number;
}

/** List all games, oldest first. */
export function listGames(): GameSummary[] {
  const dir = gamesDir();
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const summaries: GameSummary[] = [];

  for (const file of files) {
    try {
      const raw = readFileSync(join(dir, file), "utf-8");
      const game = JSON.parse(raw) as GameState;
      summaries.push({
        gameId: game.gameId,
        status: game.status,
        turn: game.turn,
        createdAt: game.createdAt,
        playerShots: game.playerShots.length,
        assistantShots: game.assistantShots.length,
        playerShipsRemaining: countRemainingShips(game.playerBoard),
        assistantShipsRemaining: countRemainingShips(game.assistantBoard),
      });
    } catch {
      // skip malformed files
    }
  }

  // Sort by createdAt ascending (oldest first)
  summaries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return summaries;
}

/** Delete a game by ID. */
export function deleteGame(gameId: string): void {
  const path = gamePath(gameId);
  if (existsSync(path)) {
    try {
      unlinkSync(path);
    } catch {
      // ignore
    }
  }
}

function countRemainingShips(board: { ships: Array<{ hits: boolean[] }> }): number {
  return board.ships.filter((s) => !s.hits.every((h) => h)).length;
}
