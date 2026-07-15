import type { Shot } from "../types";

interface GameBoardProps {
  title: string;
  titleClass: string;
  grid: string[][];
  shots: Shot[];
  isTarget: boolean;
  canFire: boolean;
  onFire: (row: number, col: number) => void;
}

const ROW_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

export function GameBoard({ title, titleClass, grid, isTarget, canFire, onFire }: GameBoardProps) {
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
              const classes = [
                "cell",
                isTarget && "target-cell",
                isTarget && !isFired && canFire && "",
                isTarget && (isFired || !canFire) && "disabled",
                cell === "hit" && "hit",
                cell === "miss" && "miss",
                cell === "ship" && "ship",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <div
                  class={classes}
                  onClick={() => handleClick(r, c)}
                >
                  {cell === "hit" ? "\u2715" : ""}
                  {cell === "miss" ? "" : ""}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
