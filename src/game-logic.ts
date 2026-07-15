/**
 * Core Battleship game logic.
 *
 * All state transitions live here so both the route handlers (player moves
 * via the app UI) and the tool definitions (assistant moves via conversation)
 * share a single source of truth.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type CellState = "empty" | "ship" | "hit" | "miss";

/** A 10x10 grid. Index [row][col], 0-based. */
export type Grid = CellState[][];

export interface ShipPlacement {
  /** Ship type name. */
  name: string;
  /** Length in cells. */
  size: number;
  /** Top-left row (0-based). */
  row: number;
  /** Top-left column (0-based). */
  col: number;
  /** true = horizontal, false = vertical. */
  horizontal: boolean;
  /** Cells already hit on this ship. */
  hits: boolean[];
}

export interface Board {
  /** 10x10 grid of cell states. */
  grid: Grid;
  /** Ships placed on this board. */
  ships: ShipPlacement[];
}

export interface ShotResult {
  /** "hit" | "miss" | "sunk" | "already" */
  result: "hit" | "miss" | "sunk" | "already";
  /** Ship name when result is "sunk". */
  sunkShip?: string;
  /** Row that was fired upon. */
  row: number;
  /** Column that was fired upon. */
  col: number;
}

export interface GameState {
  /** Unique game ID. */
  gameId: string;
  /** Player's board (ships the assistant is hunting). */
  playerBoard: Board;
  /** Assistant's board (ships the player is hunting). */
  assistantBoard: Board;
  /** All shots the player has fired at the assistant's board. */
  playerShots: Array<{ row: number; col: number; result: string }>;
  /** All shots the assistant has fired at the player's board. */
  assistantShots: Array<{ row: number; col: number; result: string }>;
  /** "player" | "assistant" — whose turn it is. */
  turn: "player" | "assistant";
  /** "playing" | "player_won" | "assistant_won". */
  status: "playing" | "player_won" | "assistant_won";
  /** When the game was created (ISO timestamp). */
  createdAt: string;
  /** Conversation ID for assistant turns (set on first fire, reused after). */
  conversationId?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const BOARD_SIZE = 10;

export const SHIP_TYPES = [
  { name: "Carrier", size: 5 },
  { name: "Battleship", size: 4 },
  { name: "Cruiser", size: 3 },
  { name: "Submarine", size: 3 },
  { name: "Destroyer", size: 2 },
] as const;

// ─── Grid helpers ────────────────────────────────────────────────────────────

export function createEmptyGrid(): Grid {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => "empty" as CellState),
  );
}

export function createEmptyBoard(): Board {
  return { grid: createEmptyGrid(), ships: [] };
}

// ─── Ship placement ──────────────────────────────────────────────────────────

/**
 * Check if a ship placement is valid: within bounds and no overlap with
 * existing ships.
 */
export function canPlaceShip(
  board: Board,
  row: number,
  col: number,
  size: number,
  horizontal: boolean,
): boolean {
  const endRow = horizontal ? row : row + size - 1;
  const endCol = horizontal ? col + size - 1 : col;

  if (endRow >= BOARD_SIZE || endCol >= BOARD_SIZE) return false;
  if (row < 0 || col < 0) return false;

  for (let i = 0; i < size; i++) {
    const r = horizontal ? row : row + i;
    const c = horizontal ? col + i : col;
    if (board.grid[r][c] !== "empty") return false;
  }
  return true;
}

/** Place a ship on the board (mutates in place). */
export function placeShip(
  board: Board,
  shipType: { name: string; size: number },
  row: number,
  col: number,
  horizontal: boolean,
): ShipPlacement {
  for (let i = 0; i < shipType.size; i++) {
    const r = horizontal ? row : row + i;
    const c = horizontal ? col + i : col;
    board.grid[r][c] = "ship";
  }
  const placement: ShipPlacement = {
    name: shipType.name,
    size: shipType.size,
    row,
    col,
    horizontal,
    hits: Array.from({ length: shipType.size }, () => false),
  };
  board.ships.push(placement);
  return placement;
}

/**
 * Randomly place all standard ships on a fresh board.
 * Uses rejection sampling: try random positions until a valid one is found.
 */
export function randomPlaceAllShips(): Board {
  const board = createEmptyBoard();
  for (const shipType of SHIP_TYPES) {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 1000) {
      const horizontal = Math.random() < 0.5;
      const maxRow = horizontal ? BOARD_SIZE - 1 : BOARD_SIZE - shipType.size;
      const maxCol = horizontal ? BOARD_SIZE - shipType.size : BOARD_SIZE - 1;
      const row = Math.floor(Math.random() * (maxRow + 1));
      const col = Math.floor(Math.random() * (maxCol + 1));

      if (canPlaceShip(board, row, col, shipType.size, horizontal)) {
        placeShip(board, shipType, row, col, horizontal);
        placed = true;
      }
      attempts++;
    }
    if (!placed) {
      // Retry the entire board — extremely unlikely but theoretically possible
      return randomPlaceAllShips();
    }
  }
  return board;
}

// ─── Firing ──────────────────────────────────────────────────────────────────

/**
 * Fire at a board. Returns the result and mutates the board state.
 * Does NOT check whose turn it is — that's the caller's responsibility.
 */
export function fireAtBoard(
  board: Board,
  row: number,
  col: number,
): ShotResult {
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
    return { result: "miss", row, col };
  }

  const cell = board.grid[row][col];

  if (cell === "hit" || cell === "miss") {
    return { result: "already", row, col };
  }

  if (cell === "empty") {
    board.grid[row][col] = "miss";
    return { result: "miss", row, col };
  }

  // cell === "ship" → hit
  board.grid[row][col] = "hit";

  // Find which ship was hit and mark it
  for (const ship of board.ships) {
    if (isCellOnShip(ship, row, col)) {
      const index = shipCellIndex(ship, row, col);
      ship.hits[index] = true;

      if (ship.hits.every((h) => h)) {
        return { result: "sunk", sunkShip: ship.name, row, col };
      }
      return { result: "hit", row, col };
    }
  }

  // Shouldn't reach here (cell was "ship" but no ship found)
  return { result: "hit", row, col };
}

function isCellOnShip(
  ship: ShipPlacement,
  row: number,
  col: number,
): boolean {
  const endRow = ship.horizontal ? ship.row : ship.row + ship.size - 1;
  const endCol = ship.horizontal ? ship.col + ship.size - 1 : ship.col;
  return (
    row >= ship.row &&
    row <= endRow &&
    col >= ship.col &&
    col <= endCol
  );
}

function shipCellIndex(ship: ShipPlacement, row: number, col: number): number {
  return ship.horizontal ? col - ship.col : row - ship.row;
}

// ─── Win detection ───────────────────────────────────────────────────────────

export function allShipsSunk(board: Board): boolean {
  return board.ships.every((ship) => ship.hits.every((h) => h));
}

// ─── Game state factory ──────────────────────────────────────────────────────

export function createNewGame(): GameState {
  return {
    gameId: crypto.randomUUID(),
    playerBoard: randomPlaceAllShips(),
    assistantBoard: randomPlaceAllShips(),
    playerShots: [],
    assistantShots: [],
    turn: "player",
    status: "playing",
    createdAt: new Date().toISOString(),
  };
}

// ─── View projections (for hidden information) ───────────────────────────────

/**
 * What the player sees of the assistant's board: only hits and misses,
 * never raw ship positions. This is the "targeting view."
 */
export function playerViewOfAssistant(game: GameState): {
  grid: CellState[][];
  shots: Array<{ row: number; col: number; result: string }>;
  remainingShips: number;
} {
  // Project only hit/miss cells — hide unhit ship cells
  const grid = game.assistantBoard.grid.map((row) =>
    row.map((cell) => (cell === "ship" ? "empty" : cell)),
  );
  return {
    grid,
    shots: game.playerShots,
    remainingShips: countRemainingShips(game.assistantBoard),
  };
}

/**
 * What the player sees of their own board: everything, including ships
 * and where the assistant has fired. The `shipGrid` parallel grid carries
 * the ship index (0-4) for each cell so the UI can color each ship.
 */
export function playerViewOfSelf(game: GameState): {
  grid: Grid;
  shipGrid: number[][];
  shots: Array<{ row: number; col: number; result: string }>;
  remainingShips: number;
} {
  return {
    grid: game.playerBoard.grid,
    shipGrid: buildShipGrid(game.playerBoard),
    shots: game.assistantShots,
    remainingShips: countRemainingShips(game.playerBoard),
  };
}

/**
 * What the assistant sees via its tool: the player's board with only
 * hits and misses shown, never raw ship positions.
 */
export function assistantViewOfPlayer(game: GameState): {
  grid: CellState[][];
  shots: Array<{ row: number; col: number; result: string }>;
  remainingShips: number;
} {
  const grid = game.playerBoard.grid.map((row) =>
    row.map((cell) => (cell === "ship" ? "empty" : cell)),
  );
  return {
    grid,
    shots: game.assistantShots,
    remainingShips: countRemainingShips(game.playerBoard),
  };
}

function countRemainingShips(board: Board): number {
  return board.ships.filter((s) => !s.hits.every((h) => h)).length;
}

/**
 * Build a parallel grid where each cell contains the ship index (0-4) or -1.
 * Used by the UI to color each ship individually.
 */
function buildShipGrid(board: Board): number[][] {
  const shipGrid: number[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array(BOARD_SIZE).fill(-1),
  );
  for (let i = 0; i < board.ships.length; i++) {
    const ship = board.ships[i];
    for (let j = 0; j < ship.size; j++) {
      const r = ship.horizontal ? ship.row : ship.row + j;
      const c = ship.horizontal ? ship.col + j : ship.col;
      shipGrid[r][c] = i;
    }
  }
  return shipGrid;
}

// ─── Coordinate helpers ──────────────────────────────────────────────────────

/** Convert "A5" to { row: 0, col: 4 }. Returns null on invalid input. */
export function parseCoordinate(coord: string): { row: number; col: number } | null {
  const match = coord.trim().toUpperCase().match(/^([A-J])(\d+)$/);
  if (!match) return null;
  const row = match[1].charCodeAt(0) - "A".charCodeAt(0);
  const col = parseInt(match[2], 10) - 1;
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
  return { row, col };
}

/** Convert { row: 0, col: 4 } to "A5". */
export function formatCoordinate(row: number, col: number): string {
  const letter = String.fromCharCode("A".charCodeAt(0) + row);
  return `${letter}${col + 1}`;
}
