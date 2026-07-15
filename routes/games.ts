/**
 * Games list route — lists all Battleship games.
 *
 *   GET /x/plugins/battleship/games
 *
 * Returns an array of game summaries with id, status, turn, and ship counts.
 */

import { listGames } from "../src/state-store.js";

export const description = "List all Battleship games";

export async function GET(): Promise<Response> {
  const games = listGames();
  return Response.json({ games });
}
