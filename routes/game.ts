/**
 * Game state route — serves the current game state and accepts player moves.
 *
 *   GET  /x/plugins/battleship/game          → current game state (player view)
 *   POST /x/plugins/battleship/game          → player fires a shot
 *   POST /x/plugins/battleship/game?action=new → start a new game
 *
 * The player view never exposes the assistant's ship positions — only
 * hits and misses on the targeting grid.
 */

import {
  allShipsSunk,
  createNewGame,
  fireAtBoard,
  formatCoordinate,
  parseCoordinate,
  playerViewOfAssistant,
  playerViewOfSelf,
  type GameState,
} from "../src/game-logic.js";
import { loadGame, saveGame } from "../src/state-store.js";
import { runConversationTurn } from "@vellumai/plugin-api";

export const description = "Battleship game state and player moves";

/** HTTP error helper — matches the assistant's standard error envelope. */
function httpError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

/** GET — return the current game state from the player's perspective. */
export async function GET(): Promise<Response> {
  const game = loadGame();
  if (!game) {
    return Response.json({
      status: "no_game",
      message: "No active game. POST to /x/plugins/battleship/game?action=new to start one.",
    });
  }

  return Response.json(projectPlayerView(game));
}

/**
 * POST — either start a new game (?action=new) or fire a shot.
 *
 * Body for firing: { "coordinate": "A5" } or { "row": 0, "col": 4 }
 */
export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (action === "new") {
    return startNewGame();
  }

  return fireShot(request);
}

// ─── Handlers ────────────────────────────────────────────────────────────────

function startNewGame(): Response {
  const game = createNewGame();
  saveGame(game);
  return Response.json({
    ...projectPlayerView(game),
    message: "New game started! Your ships have been placed. Fire away!",
  });
}

async function fireShot(request: Request): Promise<Response> {
  const game = loadGame();
  if (!game) {
    return httpError(
      "NO_GAME",
      "No active game. Start one first with POST /x/plugins/battleship/game?action=new",
      404,
    );
  }

  if (game.status !== "playing") {
    return httpError(
      "GAME_OVER",
      `Game is already over. Status: ${game.status}`,
      400,
    );
  }

  if (game.turn !== "player") {
    return httpError(
      "NOT_YOUR_TURN",
      "It's the assistant's turn. Wait for the assistant to fire.",
      400,
    );
  }

  // Parse the shot from the request body
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
  } else if (
    typeof body.row === "number" &&
    typeof body.col === "number"
  ) {
    row = body.row;
    col = body.col;
  } else {
    return httpError(
      "BAD_REQUEST",
      'Body must contain "coordinate" (e.g. "A5") or "row" and "col" numbers.',
      400,
    );
  }

  // Fire at the assistant's board
  const result = fireAtBoard(game.assistantBoard, row, col);

  if (result.result === "already") {
    return httpError(
      "ALREADY_FIRED",
      `You already fired at ${formatCoordinate(row, col)}.`,
      400,
    );
  }

  // Record the shot
  game.playerShots.push({
    row,
    col,
    result: result.result,
  });

  // Check for win
  if (allShipsSunk(game.assistantBoard)) {
    game.status = "player_won";
  } else {
    // Pass turn to assistant
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

  // If it's now the assistant's turn, trigger a conversation turn so the
  // assistant takes its shot automatically. The skill instructions tell it
  // how to fire via the assistant-fire route.
  if (game.turn === "assistant" && game.status === "playing") {
    triggerAssistantTurn().catch(() => {
      // Non-fatal — the player can prompt the assistant manually
    });
  }

  return response;
}

// ─── View projection ─────────────────────────────────────────────────────────

function projectPlayerView(game: GameState) {
  const targetView = playerViewOfAssistant(game);
  const selfView = playerViewOfSelf(game);

  return {
    gameId: game.gameId,
    status: game.status,
    turn: game.turn,
    createdAt: game.createdAt,
    // Your fleet — full visibility
    yourBoard: {
      grid: selfView.grid,
      remainingShips: selfView.remainingShips,
      enemyShots: selfView.shots,
    },
    // Enemy waters — only hits/misses, no ship positions
    enemyWaters: {
      grid: targetView.grid,
      remainingShips: targetView.remainingShips,
      yourShots: targetView.shots,
    },
    // Ship placement summary for your fleet
    yourShips: game.playerBoard.ships.map((s) => ({
      name: s.name,
      size: s.size,
      sunk: s.hits.every((h) => h),
    })),
  };
}

function formatShotMessage(result: string, sunkShip?: string): string {
  switch (result) {
    case "hit":
      return "Direct hit!";
    case "miss":
      return "Miss! Splash.";
    case "sunk":
      return `You sank the enemy's ${sunkShip}!`;
    default:
      return result;
  }
}

/**
 * Trigger the assistant to take its Battleship turn by posting a message
 * into the active conversation. The assistant's skill instructions tell it
 * to check the game state and fire via the assistant-fire route.
 */
async function triggerAssistantTurn(): Promise<void> {
  await runConversationTurn({
    content: [
      {
        type: "text",
        text: "It's your turn in Battleship. Check the game state and fire your shot using the assistant-fire route. The Battleship skill has your instructions.",
      },
    ],
  });
}
