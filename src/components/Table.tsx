import { useEffect, useState } from 'react'
import { EVENTS } from '../game/events'
import { scoreHand } from '../game/scoring'
import type { Card, GameSnapshot } from '../game/types'
import { useGameEngine } from '../multiplayer/useGameEngine'
import { CardBack, CardView } from './CardView'
import { cardMeta } from './cardMeta'

function pendingActors(game: GameSnapshot): string[] {
  if (!game.pending) return []
  return game.pending.kind === 'swap'
    ? game.pending.queue.slice(0, 1)
    : game.pending.waitingFor
}

export function Table() {
  const { game, me, myMoves, dispatch } = useGameEngine()
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [selectedHand, setSelectedHand] = useState<number | null>(null)

  useEffect(() => {
    setSelectedSlot(null)
    setSelectedHand(null)
  }, [
    game?.turnSeat,
    game?.turnStep,
    game?.round,
    game?.pending && pendingActors(game).join(',')
  ])

  if (!game) return null
  const n = game.seats.length
  const turnSeat = game.seats[game.turnSeat]
  const myTurn = turnSeat.id === me.id
  const myIdx = game.seats.findIndex((s) => s.id === me.id)
  const mySeat = myIdx >= 0 ? game.seats[myIdx] : undefined
  const ev = game.currentEvent ? EVENTS[game.currentEvent] : null

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
  const inActStep = myTurn && !game.pending && game.turnStep === 'act'

  // Event-phase moves that pick a card from my hand.
  const handMoves = myMoves.filter(
    (m) =>
      m.type === 'event-discard' ||
      m.type === 'event-gift' ||
      m.type === 'event-give' ||
      m.type === 'event-swap'
  )
  const handIdxs = new Set(
    handMoves.map((m) => ('handIdx' in m ? m.handIdx : -1))
  )
  const swapDirs =
    selectedHand === null
      ? []
      : myMoves.flatMap((m) =>
          m.type === 'event-swap' && m.handIdx === selectedHand ? [m.dir] : []
        )
  const handAction = handMoves[0]?.type

  const waitingNames = pendingActors(game)
    .filter((id) => id !== me.id)
    .map((id) => game.seats.find((s) => s.id === id)?.name ?? '?')

  let banner: string
  if (game.pending) {
    const mine = handMoves.length > 0
    if (game.pending.kind === 'discard')
      banner = mine
        ? 'Escolha 1 carta da mão para descartar.'
        : `Esperando descartarem: ${waitingNames.join(', ')}`
    else if (game.pending.kind === 'gift')
      banner = mine
        ? 'Escolha 1 carta para dar ao jogador seguinte.'
        : `Esperando os presentes: ${waitingNames.join(', ')}`
    else
      banner = mine
        ? 'Escolha 1 carta sua e o vizinho da troca.'
        : `${waitingNames[0] ?? '...'} está trocando figurinha...`
  } else if (myTurn && game.turnStep === 'give') {
    banner = 'Escolha 1 carta da mão para o monte das sobras.'
  } else if (myTurn && game.turnStep === 'reveal') {
    banner = game.modifiers.forcedTake
      ? 'Vire uma carta — ela é sua!'
      : 'Sua vez! Toque numa carta virada para revelar.'
  } else if (myTurn) {
    banner = 'Pegue uma carta do buffet — ou passe.'
  } else {
    banner = `Vez de ${turnSeat.name}`
  }

  const leftSeat = game.seats[(myIdx - 1 + n) % n]
  const rightSeat = game.seats[(myIdx + 1) % n]

  const handConfirmLabel = (card: Card): string | null => {
    const name = cardMeta(card).name
    switch (handAction) {
      case 'event-discard':
        return `Descartar ${name}`
      case 'event-gift':
        return `Dar ${name} de presente`
      case 'event-give':
        return `Pôr ${name} no monte`
      default:
        return null
    }
  }

  return (
    <div className="screen table">
      <header className="table-header">
        <span>Rodada {game.round}</span>
        <span className="muted">monte: {game.deck.length}</span>
      </header>

      {ev && (
        <div className="event-banner">
          <span className="event-emoji">{ev.emoji}</span>
          <span>
            <strong>{ev.name}</strong>
            <br />
            <span className="muted">{ev.desc}</span>
          </span>
        </div>
      )}

      <div
        className={`banner ${myTurn || handMoves.length > 0 ? 'banner-mine' : ''}`}
      >
        {banner}
      </div>

      <ul className="players-strip">
        {game.seats.map((seat, i) => (
          <li
            key={seat.id}
            className={[
              'player-chip',
              !game.pending && i === game.turnSeat && 'player-current',
              game.pending &&
                pendingActors(game).includes(seat.id) &&
                'player-current',
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
              🃏{seat.hand.length} · 🍺
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
              selected={selectedSlot === i}
              clickable={takeSlots.has(i)}
              onClick={
                takeSlots.has(i)
                  ? () => setSelectedSlot(selectedSlot === i ? null : i)
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

      {(inActStep || (selectedHand !== null && handAction)) && (
        <div className="action-bar">
          {inActStep &&
            selectedSlot !== null &&
            takeSlots.has(selectedSlot) && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => dispatch({ type: 'take', slot: selectedSlot })}
              >
                Pegar {cardMeta(game.buffet[selectedSlot].card).name}
              </button>
            )}
          {inActStep &&
            selectedSlot !== null &&
            abacaxiSlots.has(selectedSlot) && (
              <button
                type="button"
                className="btn"
                onClick={() =>
                  dispatch({ type: 'abacaxi', slot: selectedSlot })
                }
              >
                Trocar pelo 🍍
              </button>
            )}
          {inActStep && (
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
          )}
          {selectedHand !== null &&
            swapDirs.map((dir) => (
              <button
                key={dir}
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  dispatch({ type: 'event-swap', handIdx: selectedHand, dir })
                }
              >
                Trocar com {dir === 'left' ? leftSeat.name : rightSeat.name}
              </button>
            ))}
          {selectedHand !== null &&
            handAction &&
            handAction !== 'event-swap' &&
            mySeat &&
            handConfirmLabel(mySeat.hand[selectedHand]) && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  dispatch({
                    type: handAction as
                      'event-discard' | 'event-gift' | 'event-give',
                    handIdx: selectedHand
                  })
                }
              >
                {handConfirmLabel(mySeat.hand[selectedHand])}
              </button>
            )}
        </div>
      )}

      {mySeat ? (
        <Hand
          cards={mySeat.hand}
          title={`Sua mão (${mySeat.hand.length}/7)`}
          subtitle={`parcial: ${scoreHand(mySeat.hand).subtotal} pts`}
          clickableIdxs={handIdxs}
          selectedIdx={selectedHand}
          onCardClick={(i) => {
            if (!handIdxs.has(i)) return
            setSelectedHand(selectedHand === i ? null : i)
          }}
        />
      ) : (
        <p className="muted">Você entrou no meio do jogo — assistindo.</p>
      )}

      {game.modifiers.openHands && (
        <div className="reveal-hands">
          {game.seats
            .filter((s) => s.id !== me.id)
            .map((seat) => (
              <Hand key={seat.id} cards={seat.hand} title={`📸 ${seat.name}`} />
            ))}
        </div>
      )}
    </div>
  )
}

function Hand({
  cards,
  title,
  subtitle,
  clickableIdxs,
  selectedIdx,
  onCardClick
}: {
  cards: Card[]
  title: string
  subtitle?: string
  clickableIdxs?: Set<number>
  selectedIdx?: number | null
  onCardClick?: (i: number) => void
}) {
  return (
    <div className="hand">
      <div className="hand-header">
        <span>{title}</span>
        {subtitle && <span className="muted">{subtitle}</span>}
      </div>
      <div className="hand-cards">
        {cards.map((card, i) => (
          <CardView
            key={card.id}
            card={card}
            small
            selected={selectedIdx === i}
            clickable={clickableIdxs?.has(i)}
            onClick={
              clickableIdxs?.has(i) && onCardClick
                ? () => onCardClick(i)
                : undefined
            }
          />
        ))}
      </div>
    </div>
  )
}
