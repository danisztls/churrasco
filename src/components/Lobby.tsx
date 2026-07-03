import { getRoomCode } from 'playroomkit'
import { CONFIG } from '../game/config'
import { useGameEngine } from '../multiplayer/useGameEngine'

const MIN_PLAYERS = import.meta.env.DEV ? 2 : CONFIG.minPlayers

export function Lobby() {
  const { players, amHost, startGame } = useGameEngine()
  const count = players.length
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
      </ul>
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
