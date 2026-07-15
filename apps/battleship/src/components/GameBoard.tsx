import type { Shot } from "../types";

interface GameBoardProps {
  title: string;
  titleClass: string;
  grid: string[][];
  shipGrid?: number[][];
  shots: Shot[];
  isTarget: boolean;
  canFire: boolean;
  onFire: (row: number, col: number) => void;
}

const ROW_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

const SHIP_COLORS = [
  "#e63946", // Carrier - red
  "#f4a261", // Battleship - orange
  "#2a9d8f", // Cruiser - teal
  "#264653", // Submarine - dark blue
  "#9d4edd", // Destroyer - purple
];

export function getShipColor(index: number): string {
  return SHIP_COLORS[index] ?? "#6c757d";
}

export function GameBoard({ title, titleClass, grid, shipGrid, isTarget, canFire, onFire }: GameBoardProps) {
  const handleClick = (row: number, col: number) => {
    if (!canFire) return;
    const cell = grid[row]?.[col];
    if (cell === "hit" || cell === "miss") return;
    onFire(row, col);
  };

  return (
    <div class="board-section">
      <div class={`board-title ${titleClass}`}>{title}</div>
      <div class="grid-wrapper">
        <div class="corner"></div>
        {Array.from({ length: 10 }, (_, c) => (
          <div class="label">{c + 1}</div>
        ))}
        {grid.map((row, r) => (
          <>
            <div class="label">{ROW_LABELS[r]}</div>
            {row.map((cell, c) => {
              const isFired = cell === "hit" || cell === "miss";
              const shipIdx = shipGrid?.[r]?.[c] ?? -1;
              const isShip = cell === "ship" && shipIdx >= 0;
              const isShipHit = cell === "hit" && shipIdx >= 0;

              const classes = [
                "cell",
                isTarget && "target-cell",
                isTarget && (isFired || !canFire) && "disabled",
                cell === "hit" && !isShipHit && "hit",
                cell === "miss" && "miss",
                cell === "ship" && "ship",
                isShipHit && "ship-hit",
              ]
                .filter(Boolean)
                .join(" ");

              const style = isShip
                ? `background:${getShipColor(shipIdx)};border:1px solid rgba(255,255,255,0.15)`
                : isShipHit
                  ? `background:${getShipColor(shipIdx)};opacity:0.5;border:1px solid rgba(255,255,255,0.1)`
                  : undefined;

              return (
                <div
                  class={classes}
                  style={style}
                  onClick={() => handleClick(r, c)}
                >
                  {cell === "hit" ? "\u2715" : ""}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
