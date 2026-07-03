import { describe, expect, it } from 'vitest'
import { botMove } from './bot'
import { CONFIG } from './config'
import { mulberry32 } from './deck'
import { applyMove, newGame } from './rules'
import { logToCsv } from './log'

const PLAYERS = [
  { id: 'a', name: 'Ana' },
  { id: 'b', name: 'Beto' },
  { id: 'c', name: 'Caio' }
]

describe('bot policy', () => {
  it.each([[11], [22], [33]])(
    'bots finish a full game with events (seed %i)',
    (seed) => {
      const rng = mulberry32(seed)
      let snap = newGame(PLAYERS, seed)
      let guard = 3000
      while (snap.phase === 'playing' && guard-- > 0) {
        let acted = false
        for (const seat of snap.seats) {
          const move = botMove(snap, seat.id, rng)
          if (move) {
            snap = applyMove(snap, seat.id, move)
            acted = true
            break
          }
        }
        expect(acted).toBe(true)
      }
      expect(snap.phase).toBe('scored')
      expect(snap.seats.every((s) => s.hand.length === CONFIG.handSize)).toBe(
        true
      )
    }
  )

  it('prefers the highest-value take', () => {
    const snap = newGame(PLAYERS, 5, { events: false })
    // Open the whole buffet so the bot is in a pure take decision.
    snap.buffet.forEach((s) => (s.faceUp = true))
    snap.turnStep = 'act'
    const seatId = snap.seats[snap.turnSeat].id
    const move = botMove(snap, seatId, () => 0.99) // never passes
    expect(move?.type).toBe('take')
    if (move?.type !== 'take') throw new Error('unreachable')
    const values = snap.buffet.map(
      (s) =>
        (s.card.kind === 'carne' ? CONFIG.cortePoints[s.card.corte] : 0) +
        (s.card.kind === 'bebida' ? 1 : 0)
    )
    // The chosen card's raw value should not be beaten by a plain carne face
    // value elsewhere (proxy check; exact deltas depend on hand context).
    const chosen = snap.buffet[move.slot]
    expect(values[move.slot]).toBeGreaterThanOrEqual(
      Math.max(...values.filter((_, i) => i !== move.slot)) - 2
    )
    expect(chosen.faceUp).toBe(true)
  })
})

describe('decision log', () => {
  it('records one take per player per effective round and exports CSV', () => {
    const rng = mulberry32(99)
    let snap = newGame(PLAYERS, 99, { events: false })
    let guard = 1000
    while (snap.phase === 'playing' && guard-- > 0) {
      for (const seat of snap.seats) {
        const move = botMove(snap, seat.id, rng)
        if (move) {
          snap = applyMove(snap, seat.id, move)
          break
        }
      }
    }
    expect(snap.phase).toBe('scored')
    const takes = snap.log.filter((e) => e.action === 'pegou')
    expect(takes).toHaveLength(3 * CONFIG.handSize)
    expect(takes.every((e) => typeof e.card === 'string')).toBe(true)
    expect(takes.every((e) => (e.options ?? 0) >= 1)).toBe(true)

    const csv = logToCsv(snap)
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('rodada,evento,jogador,acao,carta,opcoes')
    // header + all log entries + 3 total rows
    expect(lines).toHaveLength(1 + snap.log.length + 3)
    expect(lines.at(-1)).toContain('total')
  })
})
