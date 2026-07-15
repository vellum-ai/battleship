/**
 * Game state route — fetch a specific game's state.
 *
 *   GET /x/plugins/battleship/game-state?gameId=<id>
 *
 * Returns the full game state from the player's perspective, including
 * the targeting grid (enemy waters) and the player's own fleet.
 */

import {
  playerViewOfAssistant,
  playerViewOfSelf,
} from "../src/game-logic.js";
import { loadGame } from "../src/state-store.js";

export const description = "Fetch a Battleship game state";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const gameId = url.searchParams.get("gameId");

  if (!gameId) {
    return Response.json(
      { error: { code: "BAD_REQUEST", message: "Missing gameId query parameter" } },
      { status: 400 },
    );
  }

  const game = loadGame(gameId);
  if (!game) {
    return Response.json(
      { error: { code: "NOT_FOUND", message: `Game not found: ${gameId}` } },
      { status: 404 },
    );
  }

  const targetView = playerViewOfAssistant(game);
  const selfView = playerViewOfSelf(game);

  return Response.json({
    gameId: game.gameId,
    status: game.status,
    turn: game.turn,
    createdAt: game.createdAt,
    conversationId: game.conversationId,
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
  });
}
