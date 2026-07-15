/**
 * File-based game state persistence.
 *
 * Stores the active game as JSON in the plugin's data directory.
 * The init hook receives `pluginStorageDir` via InitContext; we resolve
 * the data path at runtime from the workspace env var as a fallback.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import type { GameState } from "./game-logic.js";

const STATE_FILE = "game-state.json";

function dataDir(): string {
  const workspaceDir =
    process.env.VELLUM_WORKSPACE_DIR ||
    join(process.env.HOME || "~", ".vellum");
  return join(workspaceDir, "plugins", "battleship", "data");
}

function statePath(): string {
  return join(dataDir(), STATE_FILE);
}

/** Ensure the data directory exists. */
export function ensureDataDir(): void {
  mkdirSync(dataDir(), { recursive: true });
}

/** Load the active game state. Returns null if no game exists. */
export function loadGame(): GameState | null {
  const path = statePath();
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

/** Save the game state to disk. */
export function saveGame(state: GameState): void {
  ensureDataDir();
  writeFileSync(statePath(), JSON.stringify(state, null, 2), "utf-8");
}

/** Delete the game state file (end game / reset). */
export function deleteGame(): void {
  const path = statePath();
  if (existsSync(path)) {
    try {
      unlinkSync(path);
    } catch {
      // ignore
    }
  }
}
