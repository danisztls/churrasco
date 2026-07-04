import { useEffect, useState } from 'react'
import { CONFIG } from '../game/config'
import { EVENTS } from '../game/events'
import { bebidaPlacements, cardContributions, scoreHand } from '../game/scoring'
import type { Card, GameSnapshot } from '../game/types'
import { useGameEngine } from '../multiplayer/useGameEngine'
import { CardBack, CardView } from './CardView'
import { ACOMP_META, BEBIDA_META, CORTE_META, cardMeta } from './cardMeta'
import { GameLog } from './GameLog'

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
  const turnSeat = game.seats[game.turnSeat]
  const myTurn = turnSeat.id === me.id
  const myIdx = game.seats.findIndex((s) => s.id === me.id)
  const mySeat = myIdx >= 0 ? game.seats[myIdx] : undefined
  const ev = game.currentEvent ? EVENTS[game.currentEvent] : null

  const canReveal = myMoves.some((m) => m.type === 'reveal')
  const nextRevealIdx = game.buffet.findIndex((s) => !s.faceUp)
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
  const swapTargets =
    selectedHand === null
      ? []
      : myMoves.flatMap((m) =>
          m.type === 'event-swap' && m.handIdx === selectedHand
            ? [m.target]
            : []
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
        ? 'Escolha 1 carta sua e com quem trocar.'
        : `${waitingNames[0] ?? '...'} está trocando figurinha...`
  } else if (myTurn && game.turnStep === 'give') {
    banner = 'Escolha 1 carta da mão para o monte das sobras.'
  } else if (myTurn && game.turnStep === 'reveal') {
    // Only Depois Acaba keeps the flip as a player move.
    banner = 'Vire a próxima carta — ela é sua!'
  } else if (myTurn) {
    banner = 'Pegue uma carta do buffet — ou passe.'
  } else {
    banner = `Vez de ${turnSeat.name}`
  }

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
      <div className="table-main">
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
              {seat.tookThisRound && (
                <span title="já pegou nesta rodada">✓</span>
              )}
            </li>
          ))}
        </ul>

        <div className="action-bar">
          {canReveal && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => dispatch({ type: 'reveal' })}
            >
              Virar — a carta é sua!
            </button>
          )}
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
                onClick={() => {
                  dispatch({ type: 'abacaxi', slot: selectedSlot })
                  setSelectedSlot(null)
                }}
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
            swapTargets.map((target) => (
              <button
                key={target}
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  dispatch({
                    type: 'event-swap',
                    handIdx: selectedHand,
                    target
                  })
                }
              >
                Trocar com{' '}
                {game.seats.find((s) => s.id === target)?.name ?? '?'}
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
                highlight={canReveal && i === nextRevealIdx}
              />
            )
          )}
        </div>

        {mySeat ? (
          <>
            <Hand
              cards={mySeat.hand}
              title={`Sua mão (${mySeat.hand.length}/7)`}
              clickableIdxs={handIdxs}
              selectedIdx={selectedHand}
              onCardClick={(i) => {
                if (!handIdxs.has(i)) return
                setSelectedHand(selectedHand === i ? null : i)
              }}
            />
            <ScoreStrip game={game} myIdx={myIdx} />
            <PratosPanel hand={mySeat.hand} />
          </>
        ) : (
          <p className="muted">Você entrou no meio do jogo — assistindo.</p>
        )}

        {game.modifiers.openHands && (
          <div className="reveal-hands">
            {game.seats
              .filter((s) => s.id !== me.id)
              .map((seat) => (
                <Hand
                  key={seat.id}
                  cards={seat.hand}
                  title={`📸 ${seat.name}`}
                />
              ))}
          </div>
        )}
      </div>
      <GameLog game={game} />
    </div>
  )
}

/** Every prato (combo) with live status: done, in progress, or untouched. */
function PratosPanel({ hand }: { hand: Card[] }) {
  return (
    <div className="pratos-panel">
      <div className="hand-header">
        <span>⭐ Pratos (combos)</span>
      </div>
      <ul>
        {CONFIG.pratos.map((p) => {
          const parts = [
            {
              meta: CORTE_META[p.corte],
              ok: hand.some((c) => c.kind === 'carne' && c.corte === p.corte)
            },
            {
              meta: ACOMP_META[p.acomp],
              ok: hand.some((c) => c.kind === 'acomp' && c.acomp === p.acomp)
            },
            {
              meta: BEBIDA_META[p.bebida],
              ok: hand.some((c) => c.kind === 'bebida' && c.bebida === p.bebida)
            }
          ]
          const have = parts.filter((x) => x.ok).length
          const state =
            have === 3
              ? 'prato-done'
              : have > 0
                ? 'prato-progress'
                : 'prato-off'
          return (
            <li key={p.name} className={`prato-row ${state}`}>
              <span className="prato-name">{p.name}</span>
              <span className="prato-parts">
                {parts.map((x) => (
                  <span
                    key={x.meta.name}
                    className={`prato-part${x.ok ? ' prato-part-ok' : ''}`}
                  >
                    {x.meta.emoji} {x.meta.name}
                  </span>
                ))}
              </span>
              <span className="prato-status">
                {have === 3 ? `+${p.bonus} ✓` : `${have}/3 · +${p.bonus}`}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Live score breakdown: category chips + projected bebida placement. */
function ScoreStrip({ game, myIdx }: { game: GameSnapshot; myIdx: number }) {
  const seat = game.seats[myIdx]
  const s = scoreHand(seat.hand)
  const counts = game.seats.map(
    (x) => x.hand.filter((c) => c.kind === 'bebida').length
  )
  const placement = bebidaPlacements(counts)[myIdx]
  const total = s.subtotal + placement
  const sign = (v: number) => (v > 0 ? `+${v}` : `${v}`)
  const chips: {
    emoji: string
    value: string
    zero: boolean
    title: string
  }[] = [
    {
      emoji: '🥩',
      value: `${s.carne}`,
      zero: s.carne === 0,
      title: 'carnes (valor de face)'
    },
    {
      emoji: '🧄',
      value: sign(s.pao),
      zero: s.pao === 0,
      title: 'pão de alho (dobras ativas)'
    },
    {
      emoji: '🌭',
      value: `${s.linguica}`,
      zero: s.linguica === 0,
      title: 'linguiças'
    },
    {
      emoji: '🥗',
      value: `${s.acomp}`,
      zero: s.acomp === 0,
      title: 'acompanhamentos distintos'
    },
    {
      emoji: '🍺',
      value: `${s.bebidaFace}`,
      zero: s.bebidaFace === 0,
      title: 'bebidas (valor de face)'
    },
    {
      emoji: '⭐',
      value: sign(s.pratosTotal),
      zero: s.pratosTotal === 0,
      title: 'pratos completos'
    },
    {
      emoji: '🏅',
      value: sign(placement),
      zero: placement === 0,
      title: 'colocação da bebida se o jogo acabasse agora'
    }
  ]
  return (
    <div className="score-strip">
      {chips.map((c) => (
        <span
          key={c.title}
          className={`score-chip${c.zero ? ' score-zero' : ''}`}
          title={c.title}
        >
          {c.emoji} {c.value}
        </span>
      ))}
      <span
        className="score-chip score-total"
        title="total se o jogo acabasse agora"
      >
        ≈ {total} pts
      </span>
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
  const points = cardContributions(cards)
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
            points={points[i]}
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
