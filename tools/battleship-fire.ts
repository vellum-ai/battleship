/**
 * battleship-fire tool — lets the assistant fire at the player's fleet.
 *
 * The assistant calls this tool during conversation to take its turn.
 * The tool reads the current game state, validates it's the assistant's
 * turn, fires at the given coordinate on the player's board, and returns
 * the result plus a sanitized targeting view (no ship positions).
 */

import type { ToolDefinition } from "@vellumai/plugin-api";

export default {
  name: "battleship-fire",
  description:
    "Fire at the player's fleet in Battleship. Call this when it's your turn " +
    "to fire a shot at the player's board. You will see the result (hit, " +
    "miss, or sunk) and a targeting grid showing only your past hits and " +
    "misses. Use the targeting grid to decide your next shot strategically. " +
    "After firing, the turn passes back to the player.",
  category: "games",
  defaultRiskLevel: "low",
  executionTarget: "host",

  input_schema: {
    type: "object",
    properties: {
      coordinate: {
        type: "string",
        description:
          'The grid coordinate to fire at, e.g. "A5" or "J10". ' +
          "Letters A-J for rows (top to bottom), numbers 1-10 for columns (left to right).",
      },
    },
    required: ["coordinate"],
  },

  async execute(input: { coordinate: string }): Promise<{
    content: string;
    isError?: boolean;
  }> {
    const { coordinate } = input;

    // Load the current game state
    const { loadGame } = await import("../src/state-store.js");
    const {
      fireAtBoard,
      allShipsSunk,
      formatCoordinate,
      parseCoordinate,
      assistantViewOfPlayer,
    } = await import("../src/game-logic.js");

    const game = loadGame();
    if (!game) {
      return {
        content: "No active Battleship game. Ask the player to start one by clicking New Game in the app.",
        isError: true,
      };
    }

    if (game.status !== "playing") {
      return {
        content: `The game is already over. Status: ${game.status}. Ask the player to start a new game.`,
        isError: true,
      };
    }

    if (game.turn !== "assistant") {
      return {
        content: "It's not your turn yet. Wait for the player to fire first.",
        isError: true,
      };
    }

    const parsed = parseCoordinate(coordinate);
    if (!parsed) {
      return {
        content: `Invalid coordinate: "${coordinate}". Use A1 through J10 (e.g. "A5", "J10").`,
        isError: true,
      };
    }

    const result = fireAtBoard(game.playerBoard, parsed.row, parsed.col);

    if (result.result === "already") {
      return {
        content: `You already fired at ${formatCoordinate(parsed.row, parsed.col)}. Pick a different coordinate.`,
        isError: true,
      };
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

    // Save updated state
    const { saveGame } = await import("../src/state-store.js");
    saveGame(game);

    // Build the assistant's view (no ship positions visible)
    const view = assistantViewOfPlayer(game);

    // Format a readable result for the assistant
    let message: string;
    if (game.status === "assistant_won") {
      message = `You fired at ${formatCoordinate(parsed.row, parsed.col)} and SUNK the last enemy ship! Victory! All ships destroyed.`;
    } else if (result.result === "sunk") {
      message = `You fired at ${formatCoordinate(parsed.row, parsed.col)} and SUNK the enemy's ${result.sunkShip}! ${view.remainingShips} enemy ship(s) remaining.`;
    } else if (result.result === "hit") {
      message = `You fired at ${formatCoordinate(parsed.row, parsed.col)} and got a HIT! ${view.remainingShips} enemy ship(s) remaining.`;
    } else {
      message = `You fired at ${formatCoordinate(parsed.row, parsed.col)} and missed. ${view.remainingShips} enemy ship(s) remaining.`;
    }

    // Include the targeting grid as a text representation for the assistant
    const gridText = formatGridAsText(view.grid);
    const shotsList = view.shots
      .map(
        (s) =>
          `  ${formatCoordinate(s.row, s.col)}: ${s.result}`,
      )
      .join("\n");

    return {
      content:
        `${message}\n\n` +
        `Your targeting grid (H=hit, M=miss, .=unknown):\n${gridText}\n\n` +
        `All your shots so far:\n${shotsList}\n\n` +
        `Turn: ${game.turn === "player" ? "Player's turn now" : "Your turn"} | ` +
        `Game status: ${game.status}`,
    };
  },
} satisfies ToolDefinition;

/** Render the 10x10 grid as text for the assistant to reason about. */
function formatGridAsText(grid: string[][]): string {
  const header = "   " +
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
