/**
 * Start a new game route — creates a new Battleship game.
 *
 *   POST /x/plugins/battleship/games/new
 *
 * Returns the full game state from the player's perspective.
 */

import {
  createNewGame,
  playerViewOfAssistant,
  playerViewOfSelf,
  type GameState,
} from "../../src/game-logic.js";
import { saveGame } from "../../src/state-store.js";

export const description = "Start a new Battleship game";

export async function POST(): Promise<Response> {
  const game = createNewGame();
  saveGame(game);

  return Response.json({
    ...projectPlayerView(game),
    message: "New game started! Your ships have been placed. Fire away!",
  });
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
