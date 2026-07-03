import { useEffect, useState } from 'react'
import { scoreHand } from '../game/scoring'
import { useGameEngine } from '../multiplayer/useGameEngine'
import { CardBack, CardView } from './CardView'
import { cardMeta } from './cardMeta'

export function Table() {
  const { game, me, myMoves, dispatch } = useGameEngine()
  const [selected, setSelected] = useState<number | null>(null)

  useEffect(() => {
    setSelected(null)
  }, [game?.turnSeat, game?.turnStep, game?.round])

  if (!game) return null
  const turnSeat = game.seats[game.turnSeat]
  const myTurn = turnSeat.id === me.id
  const mySeat = game.seats.find((s) => s.id === me.id)

  const revealSlots = new Set(
    myMoves.filter((m) => m.type === 'reveal').map((m) => m.slot)
  )
  const takeSlots = new Set(
    myMoves.filter((m) => m.type === 'take').map((m) => m.slot)
  )
  const abacaxiSlots = new Set(
    myMoves.filter((m) => m.type === 'abacaxi').map((m) => m.slot)
  )
  const canPass = myMoves.some((m) => m.type === 'pass')
  const inActStep = myTurn && game.turnStep === 'act'

  const banner = myTurn
    ? game.turnStep === 'reveal'
      ? 'Sua vez! Toque numa carta virada para revelar.'
      : 'Pegue uma carta do buffet — ou passe.'
    : `Vez de ${turnSeat.name}`

  return (
    <div className="screen table">
      <header className="table-header">
        <span>Rodada {game.round}</span>
        <span className="muted">monte: {game.deck.length}</span>
      </header>

      <div className={`banner ${myTurn ? 'banner-mine' : ''}`}>{banner}</div>

      <ul className="players-strip">
        {game.seats.map((seat, i) => (
          <li
            key={seat.id}
            className={[
              'player-chip',
              i === game.turnSeat && 'player-current',
              seat.tookThisRound && 'player-done'
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className="dot" style={{ background: seat.color }} />
            <span className="player-name">
              {seat.name}
              {seat.id === me.id ? ' (você)' : ''}
            </span>
            <span className="muted">
              🍽️{seat.hand.length} 🍺
              {seat.hand.filter((c) => c.kind === 'bebida').length}
            </span>
            {seat.tookThisRound && <span title="já pegou nesta rodada">✓</span>}
          </li>
        ))}
      </ul>

      <div className="buffet">
        {game.buffet.map((slot, i) =>
          slot.faceUp ? (
            <CardView
              key={slot.card.id}
              card={slot.card}
              selected={selected === i}
              clickable={takeSlots.has(i)}
              onClick={
                takeSlots.has(i)
                  ? () => setSelected(selected === i ? null : i)
                  : undefined
              }
            />
          ) : (
            <CardBack
              key={slot.card.id}
              clickable={revealSlots.has(i)}
              onClick={
                revealSlots.has(i)
                  ? () => dispatch({ type: 'reveal', slot: i })
                  : undefined
              }
            />
          )
        )}
      </div>

      {inActStep && (
        <div className="action-bar">
          {selected !== null && takeSlots.has(selected) && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => dispatch({ type: 'take', slot: selected })}
            >
              Pegar {cardMeta(game.buffet[selected].card).name}
            </button>
          )}
          {selected !== null && abacaxiSlots.has(selected) && (
            <button
              type="button"
              className="btn"
              onClick={() => dispatch({ type: 'abacaxi', slot: selected })}
            >
              Trocar pelo 🍍
            </button>
          )}
          <button
            type="button"
            className="btn"
            disabled={!canPass}
            title={
              canPass
                ? 'Deixa para depois — a vez volta'
                : 'Sem cartas viradas para baixo: tem que pegar'
            }
            onClick={() => dispatch({ type: 'pass' })}
          >
            Passar
          </button>
        </div>
      )}

      {mySeat ? (
        <Hand seat={mySeat} />
      ) : (
        <p className="muted">Você entrou no meio do jogo — assistindo.</p>
      )}
    </div>
  )
}

function Hand({ seat }: { seat: { hand: Parameters<typeof scoreHand>[0] } }) {
  const score = scoreHand(seat.hand)
  return (
    <div className="hand">
      <div className="hand-header">
        <span>Sua mão ({seat.hand.length}/7)</span>
        <span className="muted">parcial: {score.subtotal} pts</span>
      </div>
      <div className="hand-cards">
        {seat.hand.map((card) => (
          <CardView key={card.id} card={card} small />
        ))}
      </div>
    </div>
  )
}
