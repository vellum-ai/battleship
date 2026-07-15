#!/usr/bin/env bun
/**
 * Battleship CLI script with subcommands for gameplay.
 *
 * Subcommands:
 *   fire <coordinate>    Fire at the player's fleet (e.g. "fire A5")
 *   status               Show current game state and targeting grid
 *
 * Run with --help for usage.
 */

import {
  allShipsSunk,
  fireAtBoard,
  formatCoordinate,
  parseCoordinate,
  assistantViewOfPlayer,
} from "../../../src/game-logic.js";
import { loadGame, saveGame } from "../../../src/state-store.js";

function printUsage(): void {
  console.log(`Usage: battleship.ts <subcommand> [options]

Subcommands:
  fire <coordinate>    Fire at the player's fleet (e.g. "fire A5")
  status               Show current game state and your targeting grid

Coordinates: A1 (top-left) through J10 (bottom-right).
Letters A-J for rows, numbers 1-10 for columns.`);
}

function formatGridAsText(grid: string[][]): string {
  const header =
    "   " +
    Array.from({ length: 10 }, (_, i) => `${i + 1}`.padStart(2)).join(" ");
  const rows = grid.map((row, r) => {
    const letter = String.fromCharCode(65 + r);
    const cells = row
      .map((c) => {
        if (c === "hit") return " H";
        if (c === "miss") return " M";
        return " .";
      })
      .join("");
    return ` ${letter} ${cells}`;
  });
  return [header, ...rows].join("\n");
}

// ─── fire ────────────────────────────────────────────────────────────────────

async function fire(args: string[]): Promise<void> {
  const coordinate = args[0];

  if (!coordinate || coordinate === "--help" || coordinate === "-h") {
    console.log("Usage: battleship.ts fire <coordinate>");
    console.log('Example: battleship.ts fire A5');
    return;
  }

  const game = loadGame();
  if (!game) {
    console.error(
      "No active Battleship game. Ask the player to start one by clicking New Game in the Battleship app.",
    );
    process.exit(1);
  }

  if (game.status !== "playing") {
    console.error(`Game is already over. Status: ${game.status}`);
    process.exit(1);
  }

  if (game.turn !== "assistant") {
    console.error("It's not your turn yet. Wait for the player to fire first.");
    process.exit(1);
  }

  const parsed = parseCoordinate(coordinate);
  if (!parsed) {
    console.error(
      `Invalid coordinate: "${coordinate}". Use A1 through J10.`,
    );
    process.exit(1);
  }

  const result = fireAtBoard(game.playerBoard, parsed.row, parsed.col);

  if (result.result === "already") {
    console.error(
      `Already fired at ${formatCoordinate(parsed.row, parsed.col)}. Pick a different coordinate.`,
    );
    process.exit(1);
  }

  // Record the shot
  game.assistantShots.push({
    row: parsed.row,
    col: parsed.col,
    result: result.result,
  });

  // Check for win
  if (allShipsSunk(game.playerBoard)) {
    game.status = "assistant_won";
  } else {
    game.turn = "player";
  }

  saveGame(game);

  const view = assistantViewOfPlayer(game);

  // Format result message
  let message: string;
  if (game.status === "assistant_won") {
    message = `You fired at ${formatCoordinate(parsed.row, parsed.col)} and SUNK the last enemy ship! Victory!`;
  } else if (result.result === "sunk") {
    message = `You fired at ${formatCoordinate(parsed.row, parsed.col)} and SUNK the enemy's ${result.sunkShip}! ${view.remainingShips} ship(s) remaining.`;
  } else if (result.result === "hit") {
    message = `You fired at ${formatCoordinate(parsed.row, parsed.col)} — HIT! ${view.remainingShips} ship(s) remaining.`;
  } else {
    message = `You fired at ${formatCoordinate(parsed.row, parsed.col)} — Miss. ${view.remainingShips} ship(s) remaining.`;
  }

  const shotsList = view.shots
    .map((s) => `  ${formatCoordinate(s.row, s.col)}: ${s.result}`)
    .join("\n");

  console.log(
    `${message}\n\n` +
      `Your targeting grid (H=hit, M=miss, .=unknown):\n${formatGridAsText(view.grid)}\n\n` +
      `All your shots:\n${shotsList}\n\n` +
      `Turn: ${game.turn === "player" ? "Player's turn" : "Your turn"} | Game status: ${game.status}`,
  );
}

// ─── status ──────────────────────────────────────────────────────────────────

async function status(): Promise<void> {
  const game = loadGame();
  if (!game) {
    console.log(
      "No active Battleship game. The player needs to start one from the app.",
    );
    return;
  }

  if (game.status !== "playing") {
    console.log(
      `Battleship game is over. Status: ${game.status}. ` +
        (game.status === "player_won"
          ? "The player sank all your ships!"
          : "You sank all the player's ships!"),
    );
    return;
  }

  const view = assistantViewOfPlayer(game);
  const shotsList = view.shots
    .map((s) => `  ${formatCoordinate(s.row, s.col)}: ${s.result}`)
    .join("\n");

  console.log(
    `Battleship game in progress.\n` +
      `Turn: ${game.turn === "assistant" ? "Your turn to fire" : "Player's turn"}\n` +
      `Enemy ships remaining: ${view.remainingShips}/5\n` +
      `Your shots fired: ${view.shots.length}\n\n` +
      `Your targeting grid (H=hit, M=miss, .=unknown):\n${formatGridAsText(view.grid)}\n\n` +
      `All your shots:\n${shotsList}`,
  );
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const command = process.argv[2];

  if (!command || command === "--help" || command === "-h") {
    printUsage();
    return;
  }

  switch (command) {
    case "fire":
      await fire(process.argv.slice(3));
      break;
    case "status":
      await status();
      break;
    default:
      console.error(`Unknown subcommand: ${command}. Use --help for usage.`);
      process.exit(1);
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
