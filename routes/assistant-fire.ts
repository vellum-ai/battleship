/**
 * Assistant fire route — the assistant fires at the player's board.
 *
 *   POST /x/plugins/battleship/assistant-fire
 *   Body: { "row": 3, "col": 5 } or { "coordinate": "D6" }
 *
 * This route is called by the `battleship-fire` tool that the assistant
 * invokes during conversation. It returns the result (hit/miss/sunk)
 * and a sanitized view of the player's board (no ship positions).
 *
 * The route also auto-passes the turn back to the player after firing.
 */

import {
  allShipsSunk,
  fireAtBoard,
  formatCoordinate,
  parseCoordinate,
  assistantViewOfPlayer,
} from "../src/game-logic.js";
import { loadGame, saveGame } from "../src/state-store.js";

export const description = "Assistant fires at the player's fleet (called by the battleship-fire tool)";

function httpError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const game = loadGame();
  if (!game) {
    return httpError("NO_GAME", "No active game.", 404);
  }

  if (game.status !== "playing") {
    return httpError("GAME_OVER", `Game is over: ${game.status}`, 400);
  }

  if (game.turn !== "assistant") {
    return httpError(
      "NOT_YOUR_TURN",
      "It's the player's turn. The assistant must wait.",
      400,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return httpError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  let row: number | undefined;
  let col: number | undefined;

  if (typeof body.coordinate === "string") {
    const parsed = parseCoordinate(body.coordinate);
    if (!parsed) {
      return httpError(
        "INVALID_COORDINATE",
        `Invalid coordinate: "${body.coordinate}". Use A1 through J10.`,
        400,
      );
    }
    row = parsed.row;
    col = parsed.col;
  } else if (typeof body.row === "number" && typeof body.col === "number") {
    row = body.row;
    col = body.col;
  } else {
    return httpError(
      "BAD_REQUEST",
      'Body must contain "coordinate" (e.g. "A5") or "row" and "col" numbers.',
      400,
    );
  }

  const result = fireAtBoard(game.playerBoard, row, col);

  if (result.result === "already") {
    return httpError(
      "ALREADY_FIRED",
      `Already fired at ${formatCoordinate(row, col)}. Try a different coordinate.`,
      400,
    );
  }

  // Record the assistant's shot
  game.assistantShots.push({ row, col, result: result.result });

  // Check for win
  if (allShipsSunk(game.playerBoard)) {
    game.status = "assistant_won";
  } else {
    // Pass turn back to player
    game.turn = "player";
  }

  saveGame(game);

  // Return only what the assistant should know: its own shots + results
  const view = assistantViewOfPlayer(game);

  return Response.json({
    result: result.result,
    sunkShip: result.sunkShip,
    coordinate: formatCoordinate(row, col),
    gameStatus: game.status,
    turn: game.turn,
    // Sanitized grid — the assistant sees hits and misses, not ships
    targetingGrid: view.grid,
    yourShots: view.shots,
    remainingEnemyShips: view.remainingShips,
    message: formatAssistantMessage(result.result, result.sunkShip, game.status),
  });
}

function formatAssistantMessage(
  result: string,
  sunkShip: string | undefined,
  gameStatus: string,
): string {
  if (gameStatus === "assistant_won") {
    return "Victory! All enemy ships have been sunk!";
  }
  switch (result) {
    case "hit":
      return "Hit! The enemy fleet is damaged.";
    case "miss":
      return "Miss. The waters are empty there.";
    case "sunk":
      return `Direct hit and sunk! The enemy's ${sunkShip} is gone.`;
    default:
      return result;
  }
}
