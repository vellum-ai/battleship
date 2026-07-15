import type { GameSummary } from "../types";

interface GameListProps {
  games: GameSummary[];
  onNewGame: () => void;
  onResume: (gameId: string) => void;
  loading: boolean;
  assistantName: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function statusLabel(status: string): string {
  if (status === "player_won") return "You Won";
  if (status === "assistant_won") return `${assistantName} Won`;
  return "In Progress";
}

export function GameList({ games, onNewGame, onResume, loading, assistantName }: GameListProps) {
  const activeGames = games.filter((g) => g.status === "playing");
  const completedGames = games.filter((g) => g.status !== "playing");

  return (
    <div>
      <h1>&#9875; Battleship</h1>
      <div class="subtitle">You vs. {assistantName}</div>

      <div class="controls">
        <button class="btn primary" onClick={onNewGame} disabled={loading}>
          {loading ? "Starting..." : "New Game"}
        </button>
      </div>

      {games.length === 0 && !loading && (
        <div class="empty-state">
          No games yet. Click "New Game" to start playing!
        </div>
      )}

      {activeGames.length > 0 && (
        <>
          <h2 style="font-size:1rem;margin-top:24px;margin-bottom:8px;color:var(--text-dim)">Active Games</h2>
          <div class="game-list">
            {activeGames.map((game) => (
              <div class="game-card" onClick={() => onResume(game.gameId)}>
                <div class="game-meta">
                  <div>
                    <strong>{game.turn === "player" ? "Your turn" : `${assistantName}'s turn`}</strong>
                    <div class="game-id">{game.gameId.slice(0, 8)}</div>
                  </div>
                  <div style="text-align:right">
                    <span class="game-status-badge playing">{statusLabel(game.status)}</span>
                    <div class="game-id">{formatDate(game.createdAt)}</div>
                  </div>
                </div>
                <div style="margin-top:8px;font-size:0.78rem;color:var(--text-dim)">
                  Your ships: {game.playerShipsRemaining}/5 | Enemy ships: {game.assistantShipsRemaining}/5
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {completedGames.length > 0 && (
        <>
          <h2 style="font-size:1rem;margin-top:24px;margin-bottom:8px;color:var(--text-dim)">Completed Games</h2>
          <div class="game-list">
            {completedGames.map((game) => (
              <div class="game-card" onClick={() => onResume(game.gameId)}>
                <div class="game-meta">
                  <div>
                    <strong>{statusLabel(game.status)}</strong>
                    <div class="game-id">{game.gameId.slice(0, 8)}</div>
                  </div>
                  <div style="text-align:right">
                    <span class={`game-status-badge ${game.status}`}>
                      {game.status === "player_won" ? "Won" : "Lost"}
                    </span>
                    <div class="game-id">{formatDate(game.createdAt)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
