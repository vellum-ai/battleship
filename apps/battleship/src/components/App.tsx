import { useState, useEffect, useCallback } from "preact/hooks";
import { GameBoard, getShipColor } from "./GameBoard";
import { GameList } from "./GameList";
import type { GameState, GameSummary } from "./types";

const BASE = "/v1/x/plugins/battleship";

function vfetch(url: string, options?: RequestInit): Promise<Response> {
  const fetcher = (window as any).vellum?.fetch ?? fetch;
  return fetcher(url, options);
}

type View = "list" | "game";

export function App() {
  const [view, setView] = useState<View>("list");
  const [games, setGames] = useState<GameSummary[]>([]);
  const [game, setGame] = useState<GameState | null>(null);
  const [messages, setMessages] = useState<{ text: string; type: string }[]>([]);
  const [isFiring, setIsFiring] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assistantName, setAssistantName] = useState("Assistant");

  // Fetch the assistant's display name from the daemon identity endpoint
  useEffect(() => {
    vfetch("/v1/identity")
      .then((res) => res.json())
      .then((data) => {
        if (data?.name) setAssistantName(data.name);
      })
      .catch(() => {});
  }, []);

  const addMessage = (text: string, type: string) => {
    setMessages((prev) => [{ text, type }, ...prev].slice(0, 10));
  };

  const rebuildMessages = (data: GameState) => {
    const msgs: { text: string; type: string }[] = [];
    const yourShots = data.enemyWaters?.yourShots || [];
    const enemyShots = data.yourBoard?.enemyShots || [];

    // Interleave shots chronologically. Player fires first (index 0),
    // then assistant (index 0), then player (index 1), etc.
    const maxLen = Math.max(yourShots.length, enemyShots.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < yourShots.length) {
        const s = yourShots[i];
        const coord = String.fromCharCode(65 + s.row) + (s.col + 1);
        if (s.result === "sunk") {
          msgs.push({ text: `You sank the enemy's ship at ${coord}!`, type: "sunk" });
        } else if (s.result === "hit") {
          msgs.push({ text: `Hit at ${coord}!`, type: "hit" });
        } else {
          msgs.push({ text: `Miss at ${coord}`, type: "miss" });
        }
      }
      if (i < enemyShots.length) {
        const s = enemyShots[i];
        const coord = String.fromCharCode(65 + s.row) + (s.col + 1);
        if (s.result === "sunk") {
          msgs.push({ text: `${assistantName} sank your ship at ${coord}!`, type: "sunk" });
        } else if (s.result === "hit") {
          msgs.push({ text: `${assistantName} hit your ship at ${coord}`, type: "hit" });
        } else {
          msgs.push({ text: `${assistantName} missed at ${coord}`, type: "miss" });
        }
      }
    }

    if (data.status === "player_won") {
      msgs.push({ text: "Victory! You sank all enemy ships!", type: "win" });
    } else if (data.status === "assistant_won") {
      msgs.push({ text: `${assistantName} sank your fleet!`, type: "win" });
    } else if (data.turn === "assistant") {
      msgs.push({ text: `${assistantName} is taking its turn...`, type: "info" });
    }

    // Newest first, capped at 10
    setMessages(msgs.reverse().slice(0, 10));
  };

  const loadGames = useCallback(async () => {
    try {
      const res = await vfetch(`${BASE}/games`);
      const data = await res.json();
      setGames(data.games || []);
    } catch {
      addMessage("Failed to load games", "miss");
    }
  }, []);

  const loadGameState = useCallback(async (gameId: string) => {
    try {
      const res = await vfetch(`${BASE}/game-state?gameId=${gameId}`);
      const data = await res.json();
      if (data.error) {
        addMessage(data.error.message, "miss");
        return;
      }
      setGame(data);
      rebuildMessages(data);
    } catch {
      addMessage("Failed to load game state", "miss");
    }
  }, []);

  // Load games on mount
  useEffect(() => {
    loadGames();
  }, [loadGames]);

  const startNewGame = async () => {
    setLoading(true);
    try {
      const res = await vfetch(`${BASE}/games/new`, { method: "POST" });
      const data = await res.json();
      setGame(data);
      setMessages([]);
      setView("game");
      addMessage(data.message || "New game started!", "info");
      loadGames();
    } catch {
      addMessage("Failed to start new game", "miss");
    } finally {
      setLoading(false);
    }
  };

  const resumeGame = async (gameId: string) => {
    await loadGameState(gameId);
    setView("game");
  };

  const fireShot = async (row: number, col: number) => {
    if (!game || isFiring) return;
    if (game.turn !== "player" || game.status !== "playing") return;

    setIsFiring(true);
    try {
      const coord = String.fromCharCode(65 + row) + (col + 1);
      const res = await vfetch(`${BASE}/games/fire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game.gameId, coordinate: coord }),
      });
      const data = await res.json();
      if (data.error) {
        addMessage(data.error.message, "miss");
        return;
      }

      setGame(data);
      const shot = data.lastShot;
      if (shot) {
        addMessage(
          shot.result === "sunk"
            ? `You sank the enemy's ${shot.sunkShip}!`
            : shot.result === "hit"
              ? `Hit at ${shot.coordinate}!`
              : `Miss at ${shot.coordinate}`,
          shot.result,
        );

        if (data.status === "player_won") {
          addMessage("Victory! You sank all enemy ships!", "win");
        } else if (data.turn === "assistant") {
          addMessage(`${assistantName} is taking its turn...`, "info");
          setTimeout(() => pollAssistantTurn(data.gameId), 3000);
        }
      }
    } catch {
      addMessage("Fire failed", "miss");
    } finally {
      setIsFiring(false);
    }
  };

  const pollAssistantTurn = (gameId: string) => {
    let attempts = 0;
    const maxAttempts = 30;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        addMessage(`Still waiting for ${assistantName}. Click Refresh to check.`, "info");
        return;
      }
      attempts++;
      try {
        const res = await vfetch(`${BASE}/game-state?gameId=${gameId}`);
        const data = await res.json();
        if (data.error) return;
        if (data.turn === "player" || data.status !== "playing") {
          setGame(data);
          const enemyShots = data.yourBoard?.enemyShots;
          if (enemyShots && enemyShots.length > 0) {
            const latest = enemyShots[enemyShots.length - 1];
            const coord = String.fromCharCode(65 + latest.row) + (latest.col + 1);
            addMessage(
              `${assistantName} fired at ${coord} - ${latest.result}${latest.result === "sunk" ? " your ship!" : ""}`,
              latest.result === "hit" || latest.result === "sunk" ? "hit" : "miss",
            );
          }
          if (data.status === "assistant_won") {
            addMessage(`${assistantName} sank your fleet!`, "win");
          }
        } else {
          setTimeout(poll, 3000);
        }
      } catch {
        setTimeout(poll, 3000);
      }
    };
    setTimeout(poll, 3000);
  };

  const refresh = () => {
    if (view === "list") loadGames();
    else if (game) loadGameState(game.gameId);
  };

  const backToList = () => {
    setView("list");
    setGame(null);
    setMessages([]);
    loadGames();
  };

  const viewConversation = (conversationId: string) => {
    vfetch(`${BASE}/open-conversation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId }),
    }).catch(() => {
      addMessage("Failed to open conversation", "miss");
    });
  };

  if (view === "list") {
    return (
      <GameList
        games={games}
        onNewGame={startNewGame}
        onResume={resumeGame}
        loading={loading}
        assistantName={assistantName}
      />
    );
  }

  if (!game) {
    return <div class="loading">Loading game...</div>;
  }

  return (
    <div>
      <h1>&#9875; Battleship</h1>
      <div class="subtitle">You vs. {assistantName}</div>

      <div class="status-bar">
        <div class="status-item" id="turn-indicator">
          {game.status === "player_won" ? (
            <><span class="dot over"></span> You Won!</>
          ) : game.status === "assistant_won" ? (
            <><span class="dot over"></span> {assistantName} Won!</>
          ) : game.turn === "player" ? (
            <><span class="dot player"></span> Your Turn</>
          ) : (
            <><span class="dot assistant"></span> {assistantName} Thinking...</>
          )}
        </div>
        <div class="ships-remaining">
          Your ships: <strong>{game.yourBoard.remainingShips}/5</strong> | Enemy ships: <strong>{game.enemyWaters.remainingShips}/5</strong>
        </div>
        {game.turn === "assistant" && game.status === "playing" && game.conversationId && (
          <button
            class="btn btn-sm"
            onClick={() => viewConversation(game.conversationId!)}
          >
            View Conversation
          </button>
        )}
      </div>

      <div class="boards">
        <GameBoard
          title="Enemy Waters"
          titleClass="target"
          grid={game.enemyWaters.grid}
          shots={game.enemyWaters.yourShots}
          isTarget={true}
          canFire={game.turn === "player" && game.status === "playing" && !isFiring}
          onFire={fireShot}
        />
        <GameBoard
          title="Your Fleet"
          titleClass="fleet"
          grid={game.yourBoard.grid}
          shipGrid={game.yourBoard.shipGrid}
          shots={game.yourBoard.enemyShots}
          isTarget={false}
          canFire={false}
          onFire={() => {}}
        />
      </div>

      {game.yourShips && (
        <div class="ship-list">
          {game.yourShips.map((ship: any, i: number) => (
            <span
              class={`ship-tag${ship.sunk ? " sunk" : ""}`}
              style={`border-color:${getShipColor(i)};color:${getShipColor(i)}`}
            >
              <span
                style={`display:inline-block;width:10px;height:10px;border-radius:2px;background:${getShipColor(i)};margin-right:4px;vertical-align:middle`}
              ></span>
              {ship.name} ({ship.size})
            </span>
          ))}
        </div>
      )}

      <div class="controls">
        <button class="btn" onClick={backToList}>Back to Games</button>
        <button class="btn" onClick={refresh}>Refresh</button>
        <button class="btn primary" onClick={startNewGame}>New Game</button>
      </div>

      <div class="message-log">
        {messages.map((msg, i) => (
          <div class={`message ${msg.type}`} key={i}>{msg.text}</div>
        ))}
      </div>
    </div>
  );
}
