import { getRoomCode, useMultiplayerState } from 'playroomkit'
import { BOT_SEATS } from '../game/bot'
import { CONFIG, TURN_TIMEOUT_OPTIONS } from '../game/config'
import { useGameEngine } from '../multiplayer/useGameEngine'

const MIN_PLAYERS = import.meta.env.DEV ? 2 : CONFIG.minPlayers

export function Lobby() {
  const { players, amHost, startGame } = useGameEngine()
  const [bots, setBots] = useMultiplayerState('bots', 0)
  const [turnTimeoutSec, setTurnTimeoutSec] = useMultiplayerState(
    'turnTimeoutSec',
    CONFIG.turnTimeoutSec
  )
  const count = players.length + bots
  const ready = count >= MIN_PLAYERS && count <= CONFIG.maxPlayers
  return (
    <div className="screen lobby">
      <h1>Churrasco 🔥</h1>
      <p className="muted">
        Sala <strong>{getRoomCode() ?? '...'}</strong> · {CONFIG.minPlayers} a{' '}
        {CONFIG.maxPlayers} jogadores
      </p>
      <ul className="lobby-players">
        {players.map((p) => (
          <li key={p.id}>
            <span
              className="dot"
              style={{ background: p.getProfile().color?.hexString }}
            />
            {p.getProfile().name}
          </li>
        ))}
        {BOT_SEATS.slice(0, bots).map((b) => (
          <li key={b.id}>
            <span className="dot" style={{ background: b.color }} />
            🤖 {b.name}
          </li>
        ))}
      </ul>
      {amHost && (
        <div className="lobby-bots">
          <button
            type="button"
            className="btn"
            disabled={bots <= 0}
            onClick={() => setBots(bots - 1, true)}
          >
            −
          </button>
          <span>
            {bots} bot{bots === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            className="btn"
            disabled={players.length + bots >= CONFIG.maxPlayers}
            onClick={() => setBots(bots + 1, true)}
          >
            +
          </button>
        </div>
      )}
      {amHost && (
        <div className="lobby-timeout">
          <span className="muted">Tempo por jogada</span>
          <div className="lobby-timeout-opts">
            {TURN_TIMEOUT_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                className="btn"
                aria-pressed={turnTimeoutSec === opt}
                onClick={() => setTurnTimeoutSec(opt, true)}
              >
                {opt}s
              </button>
            ))}
          </div>
        </div>
      )}
      {amHost ? (
        <button
          type="button"
          className="btn btn-primary"
          disabled={!ready}
          onClick={startGame}
        >
          {ready
            ? 'Começar churrasco'
            : `Esperando gente (${count}/${MIN_PLAYERS})`}
        </button>
      ) : (
        <p className="muted">
          Esperando o anfitrião acender a churrasqueira...
        </p>
      )}
    </div>
  )
}
