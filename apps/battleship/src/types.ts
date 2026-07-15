export interface Shot {
  row: number;
  col: number;
  result: "hit" | "miss" | "sunk";
}

export interface BoardView {
  grid: string[][];
  remainingShips: number;
  shots: Shot[];
}

export interface ShipInfo {
  name: string;
  size: number;
  sunk: boolean;
}

export interface GameState {
  gameId: string;
  status: "playing" | "player_won" | "assistant_won";
  turn: "player" | "assistant";
  createdAt: string;
  yourBoard: BoardView;
  enemyWaters: BoardView;
  yourShips: ShipInfo[];
  lastShot?: {
    coordinate: string;
    result: "hit" | "miss" | "sunk";
    sunkShip?: string;
  };
  message?: string;
}

export interface GameSummary {
  gameId: string;
  status: string;
  turn: string;
  createdAt: string;
  playerShots: number;
  assistantShots: number;
  playerShipsRemaining: number;
  assistantShipsRemaining: number;
}
