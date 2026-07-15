/**
 * battleship-status tool — lets the assistant check the current game state.
 *
 * Useful when the assistant needs to know if a game is in progress, whose
 * turn it is, or what the current targeting grid looks like before deciding
 * on its next move.
 */

import type { ToolDefinition } from "@vellumai/plugin-api";

export default {
  name: "battleship-status",
  description:
    "Check the current Battleship game state. Returns whose turn it is, " +
    "the game status, your targeting grid (hits and misses only), and " +
    "how many enemy ships remain. Use this before firing or when the " +
    "player asks about the game state.",
  category: "games",
  defaultRiskLevel: "low",
  executionTarget: "host",

  input_schema: {
    type: "object",
    properties: {},
  },

  async execute(): Promise<{ content: string; isError?: boolean }> {
    const { loadGame } = await import("../src/state-store.js");
    const {
      assistantViewOfPlayer,
      formatCoordinate,
    } = await import("../src/game-logic.js");

    const game = loadGame();
    if (!game) {
      return {
        content:
          "No active Battleship game. The player needs to start one by clicking New Game in the Battleship app (app id: plugins~battleship~battleship).",
      };
    }

    if (game.status !== "playing") {
      return {
        content:
          `Battleship game is over. Status: ${game.status}. ` +
          (game.status === "player_won"
            ? "The player sank all your ships!"
            : "You sank all the player's ships!"),
      };
    }

    const view = assistantViewOfPlayer(game);
    const gridText = formatGridAsText(view.grid);
    const shotsList = view.shots
      .map(
        (s) => `  ${formatCoordinate(s.row, s.col)}: ${s.result}`,
      )
      .join("\n");

    return {
      content:
        `Battleship game in progress.\n` +
        `Turn: ${game.turn === "assistant" ? "Your turn to fire" : "Player's turn"}\n` +
        `Enemy ships remaining: ${view.remainingShips}/5\n` +
        `Your shots fired: ${view.shots.length}\n\n` +
        `Your targeting grid (H=hit, M=miss, .=unknown):\n${gridText}\n\n` +
        `All your shots:\n${shotsList}`,
    };
  },
} satisfies ToolDefinition;

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
