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
  assistantViewOfPlayer,
  type GameState,
  type Board,
  type CellState,
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
    triggerAssistantTurn(game).catch(() => {
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
    conversationId: game.conversationId,
    assistantError: game.assistantError,
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

async function triggerAssistantTurn(game: GameState): Promise<void> {
  // Build a text-based board representation so the assistant can see
  // its previous shots without needing to run a script.
  const view = assistantViewOfPlayer(game);
  const boardText = formatBoardForAssistant(view.grid, view.shots);
  const remaining = view.remainingShips;

  const promptText = [
    `It's your turn in Battleship (game ${game.gameId}).`,
    ``,
    `Your targeting grid (10x10, rows A-J, cols 1-10):`,
    boardText,
    ``,
    `Enemy ships remaining: ${remaining}`,
    `Your previous shots are marked H (hit) or M (miss) above.`,
    ``,
    `Pick a coordinate you haven't fired at yet and respond with ONLY the coordinate (e.g. "B7").`,
    `Do not run any scripts or tools. Just reply with the coordinate.`,
  ].join("\n");

  const result = await runConversationTurn({
    ...(game.conversationId
      ? { conversationId: game.conversationId }
      : {}),
    content: [{ type: "text", text: promptText }],
    // conversationType and source are new options added to
    // RunConversationTurnOptions. They're not in the published type
    // definitions yet (pending vellum-assistant PR), so we cast.
    ...({ conversationType: "background", source: "plugin" } as Record<string, string>),
  } as Parameters<typeof runConversationTurn>[0]);

  // Persist the conversation ID so future turns reuse the same conversation
  if (!game.conversationId && result.conversationId) {
    game.conversationId = result.conversationId;
  }

  // Parse the assistant's response for a coordinate
  const responseText = result.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { text: string }).text)
    .join(" ");

  const coord = extractCoordinate(responseText);

  if (!coord) {
    game.assistantError = `Assistant did not return a valid coordinate. Response: "${responseText.slice(0, 200)}"`;
    game.turn = "player";
    saveGame(game);
    return;
  }

  // Apply the assistant's shot directly
  const shotResult = fireAtBoard(game.playerBoard, coord.row, coord.col);
  if (shotResult.result === "already") {
    // The assistant picked a coordinate it already fired at. Pick a random
    // unfired cell as a fallback so the game doesn't stall.
    const fallback = pickRandomUnfiredCell(game.playerBoard);
    if (fallback) {
      const fbResult = fireAtBoard(game.playerBoard, fallback.row, fallback.col);
      game.assistantShots.push({ row: fallback.row, col: fallback.col, result: fbResult.result });
      if (allShipsSunk(game.playerBoard)) {
        game.status = "assistant_won";
      }
    }
  } else {
    game.assistantShots.push({ row: coord.row, col: coord.col, result: shotResult.result });
    if (allShipsSunk(game.playerBoard)) {
      game.status = "assistant_won";
    }
  }

  game.turn = "player";
  game.assistantError = undefined;
  saveGame(game);
}

function formatBoardForAssistant(
  grid: CellState[][],
  shots: Array<{ row: number; col: number; result: string }>,
): string {
  // Build a display grid from the shot history
  const display: string[][] = Array.from({ length: 10 }, () =>
    Array.from({ length: 10 }, () => "."),
  );
  for (const shot of shots) {
    display[shot.row][shot.col] = shot.result === "hit" || shot.result === "sunk" ? "H" : "M";
  }
  const header = "   " + Array.from({ length: 10 }, (_, i) => `${i + 1}`.padStart(2)).join(" ");
  const rows = display.map((row, r) => {
    const letter = String.fromCharCode(65 + r);
    return ` ${letter} ${row.map((c) => ` ${c}`).join("")}`;
  });
  return [header, ...rows].join("\n");
}

function extractCoordinate(text: string): { row: number; col: number } | null {
  // Look for a coordinate pattern like "B7" or "b7" in the text
  const match = text.match(/\b([A-J])(\d{1,2})\b/i);
  if (!match) return null;
  const row = match[1].toUpperCase().charCodeAt(0) - "A".charCodeAt(0);
  const col = parseInt(match[2], 10) - 1;
  if (row < 0 || row >= 10 || col < 0 || col >= 10) return null;
  return { row, col };
}

function pickRandomUnfiredCell(board: Board): { row: number; col: number } | null {
  const cells: { row: number; col: number }[] = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (board.grid[r][c] !== "hit" && board.grid[r][c] !== "miss") {
        cells.push({ row: r, col: c });
      }
    }
  }
  if (cells.length === 0) return null;
  return cells[Math.floor(Math.random() * cells.length)];
}
