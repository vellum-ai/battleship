/**
 * Submit turn route — the player fires a shot at the assistant's fleet.
 *
 *   POST /x/plugins/battleship/games/fire
 *   Body: { "gameId": "<id>", "coordinate": "A5" }
 *         or { "gameId": "<id>", "row": 0, "col": 4 }
 *
 * Returns the shot result and updated game state. If the turn passes to
 * the assistant, triggers runConversationTurn so the assistant takes its
 * turn automatically.
 */

import {
  allShipsSunk,
  fireAtBoard,
  formatCoordinate,
  parseCoordinate,
  playerViewOfAssistant,
  playerViewOfSelf,
  type GameState,
} from "../../src/game-logic.js";
import { loadGame, saveGame } from "../../src/state-store.js";
import { runConversationTurn } from "@vellumai/plugin-api";

export const description = "Submit a player's turn (fire at assistant's fleet)";

function httpError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return httpError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const gameId = body.gameId as string | undefined;
  if (!gameId) {
    return httpError("BAD_REQUEST", 'Body must contain "gameId"', 400);
  }

  const game = loadGame(gameId);
  if (!game) {
    return httpError("NOT_FOUND", `Game not found: ${gameId}`, 404);
  }

  if (game.status !== "playing") {
    return httpError("GAME_OVER", `Game is over. Status: ${game.status}`, 400);
  }

  if (game.turn !== "player") {
    return httpError("NOT_YOUR_TURN", "It's the assistant's turn. Wait for the assistant to fire.", 400);
  }

  // Parse the shot
  let row: number | undefined;
  let col: number | undefined;

  if (typeof body.coordinate === "string") {
    const parsed = parseCoordinate(body.coordinate);
    if (!parsed) {
      return httpError("INVALID_COORDINATE", `Invalid coordinate: "${body.coordinate}". Use A1 through J10.`, 400);
    }
    row = parsed.row;
    col = parsed.col;
  } else if (typeof body.row === "number" && typeof body.col === "number") {
    row = body.row;
    col = body.col;
  } else {
    return httpError("BAD_REQUEST", 'Body must contain "coordinate" (e.g. "A5") or "row" and "col" numbers.', 400);
  }

  const result = fireAtBoard(game.assistantBoard, row, col);

  if (result.result === "already") {
    return httpError("ALREADY_FIRED", `Already fired at ${formatCoordinate(row, col)}.`, 400);
  }

  game.playerShots.push({ row, col, result: result.result });

  if (allShipsSunk(game.assistantBoard)) {
    game.status = "player_won";
  } else {
    game.turn = "assistant";
  }

  saveGame(game);

  const view = projectPlayerView(game);
  const response = Response.json({
    ...view,
    lastShot: {
      coordinate: formatCoordinate(row, col),
      result: result.result,
      sunkShip: result.sunkShip,
    },
    message: formatShotMessage(result.result, result.sunkShip),
  });

  // Trigger the assistant's turn automatically
  if (game.turn === "assistant" && game.status === "playing") {
    triggerAssistantTurn(gameId).catch(() => {
      // Non-fatal — the player can prompt the assistant manually
    });
  }

  return response;
}

function projectPlayerView(game: GameState) {
  const targetView = playerViewOfAssistant(game);
  const selfView = playerViewOfSelf(game);
  return {
    gameId: game.gameId,
    status: game.status,
    turn: game.turn,
    createdAt: game.createdAt,
    yourBoard: {
      grid: selfView.grid,
      shipGrid: selfView.shipGrid,
      remainingShips: selfView.remainingShips,
      enemyShots: selfView.shots,
    },
    enemyWaters: {
      grid: targetView.grid,
      remainingShips: targetView.remainingShips,
      yourShots: targetView.shots,
    },
    yourShips: game.playerBoard.ships.map((s) => ({
      name: s.name,
      size: s.size,
      sunk: s.hits.every((h) => h),
    })),
  };
}

function formatShotMessage(result: string, sunkShip?: string): string {
  switch (result) {
    case "hit": return "Direct hit!";
    case "miss": return "Miss! Splash.";
    case "sunk": return `You sank the enemy's ${sunkShip}!`;
    default: return result;
  }
}

async function triggerAssistantTurn(gameId: string): Promise<void> {
  // Derive the plugin root from this module's URL so the assistant
  // gets an exact `bun` command instead of having to discover it.
  const moduleUrl = new URL(import.meta.url);
  const pluginRoot = moduleUrl.pathname
    .replace(/\/routes\/games\/fire\.ts$/, "");

  await runConversationTurn({
    content: [
      {
        type: "text",
        text: [
          `It's your turn in Battleship (game ${gameId}).`,
          ``,
          `1. Check the board: bun ${pluginRoot}/skills/battleship/scripts/battleship.ts status --game ${gameId}`,
          `2. Pick a coordinate using your checkerboard strategy.`,
          `3. Fire: bun ${pluginRoot}/skills/battleship/scripts/battleship.ts fire <coordinate> --game ${gameId}`,
        ].join("\n"),
      },
    ],
  });
}
