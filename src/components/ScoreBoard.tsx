import { logToCsv } from '../game/log'
import { scoreGame } from '../game/scoring'
import { useGameEngine } from '../multiplayer/useGameEngine'
import { CardView } from './CardView'

export function ScoreBoard() {
  const { game, amHost, startGame } = useGameEngine()
  if (!game) return null
  const scores = [...scoreGame(game.seats, game.pratoClaims ?? [])].sort(
    (a, b) => b.total - a.total
  )
  const top = scores[0]?.total

  const downloadCsv = () => {
    const blob = new Blob([logToCsv(game)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `churrasco-log-${game.seed}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="screen scoreboard">
      <h1>Fim do churrasco 🔥</h1>
      <div className="score-table-wrap">
        <table className="score-table">
          <thead>
            <tr>
              <th></th>
              <th>🥩 Carne</th>
              <th>🧄 Pão</th>
              <th>🌭 Ling.</th>
              <th>🥗 Acomp.</th>
              <th>🍺 Bebida</th>
              <th>🏅 Coloc.</th>
              <th>⭐ Pratos</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s) => (
              <tr key={s.seatId} className={s.total === top ? 'winner' : ''}>
                <td className="score-name">
                  {s.total === top && '🏆 '}
                  {s.name}
                </td>
                <td>{s.carne}</td>
                <td>{s.pao > 0 ? `+${s.pao}` : 0}</td>
                <td>{s.linguica}</td>
                <td>{s.acomp}</td>
                <td>
                  {s.bebidaFace}{' '}
                  <span className="muted">({s.bebidaCount})</span>
                </td>
                <td>
                  {s.bebidaPlacement > 0
                    ? `+${s.bebidaPlacement}`
                    : s.bebidaPlacement}
                </td>
                <td>{s.pratosTotal > 0 ? `+${s.pratosTotal}` : 0}</td>
                <td className="score-total">{s.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {scores.some((s) => s.pratos.length > 0) && (
        <ul className="pratos-list">
          {scores
            .filter((s) => s.pratos.length > 0)
            .map((s) => (
              <li key={s.seatId}>
                <strong>{s.name}:</strong>{' '}
                {s.pratos.map((p) => `${p.name} (+${p.bonus})`).join(', ')}
              </li>
            ))}
        </ul>
      )}

      <div className="reveal-hands">
        {game.seats.map((seat) => (
          <div key={seat.id} className="reveal-hand">
            <div className="hand-header">
              <span>
                <span className="dot" style={{ background: seat.color }} />{' '}
                {seat.name}
              </span>
            </div>
            <div className="hand-cards">
              {seat.hand.map((card) => (
                <CardView key={card.id} card={card} small />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="score-actions">
        {amHost ? (
          <button type="button" className="btn btn-primary" onClick={startGame}>
            Jogar de novo
          </button>
        ) : (
          <p className="muted">O anfitrião pode começar outra partida.</p>
        )}
        <button type="button" className="btn" onClick={downloadCsv}>
          Baixar log (CSV)
        </button>
      </div>
    </div>
  )
}
