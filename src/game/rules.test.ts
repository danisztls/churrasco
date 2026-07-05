import { describe, expect, it } from 'vitest'
import { CONFIG } from './config'
import { mulberry32 } from './deck'
import { applyMove, legalMoves, newGame } from './rules'
import type { GameSnapshot, Move } from './types'

const PLAYERS = [
  { id: 'a', name: 'Ana' },
  { id: 'b', name: 'Beto' },
  { id: 'c', name: 'Caio' }
]

const NO_EVENTS = { events: false }

const currentId = (snap: GameSnapshot) => snap.seats[snap.turnSeat].id

/** Plays the current player's turn: reveal if needed, then use pick(). */
function playTurn(
  snap: GameSnapshot,
  pick: (moves: Move[]) => Move
): GameSnapshot {
  if (snap.turnStep === 'reveal') {
    const reveals = legalMoves(snap, currentId(snap))
    snap = applyMove(snap, currentId(snap), reveals[0])
    if (snap.phase !== 'playing' || snap.turnStep === 'reveal') return snap
  }
  const moves = legalMoves(snap, currentId(snap))
  return applyMove(snap, currentId(snap), pick(moves))
}

const firstTake = (moves: Move[]) => moves.find((m) => m.type === 'take')!

describe('newGame', () => {
  it('deals M = 2N buffet with 2 face-up + the auto-flip for the opener', () => {
    const snap = newGame(PLAYERS, 42, NO_EVENTS)
    expect(snap.buffet).toHaveLength(6)
    // faceUpAtStart plus the first player's automatic turn-opening flip.
    expect(snap.buffet.filter((s) => s.faceUp)).toHaveLength(3)
    expect(snap.deck).toHaveLength(68 - 6)
    expect(snap.round).toBe(1)
    expect(snap.turnSeat).toBe(snap.startSeat)
    expect(snap.turnStep).toBe('act')
  })

  it('total deck is 68 food cards', () => {
    const snap = newGame(PLAYERS, 1, NO_EVENTS)
    expect(snap.deck.length + snap.buffet.length).toBe(68)
  })

  it('with events on, shuffles all 13 into the event deck', () => {
    const snap = newGame(PLAYERS, 1)
    expect(snap.eventDeck).toHaveLength(13)
    expect(new Set(snap.eventDeck).size).toBe(13)
    expect(snap.currentEvent).toBeNull() // round 1 has no event
  })
})

describe('turn flow', () => {
  it('take removes the slot; the next turn auto-flips another card', () => {
    let snap = newGame(PLAYERS, 42, NO_EVENTS)
    const player = currentId(snap)
    expect(legalMoves(snap, player).some((m) => m.type === 'reveal')).toBe(
      false
    )
    const before = snap.buffet.length
    snap = applyMove(snap, player, firstTake(legalMoves(snap, player)))
    expect(snap.buffet).toHaveLength(before - 1)
    expect(snap.seats.find((s) => s.id === player)!.hand).toHaveLength(1)
    expect(currentId(snap)).not.toBe(player)
    // 3 were up, one left in a hand, the new turn flipped another: 3 again.
    expect(snap.buffet.filter((s) => s.faceUp)).toHaveLength(3)
  })

  it('rejects moves from a player out of turn', () => {
    const snap = newGame(PLAYERS, 42, NO_EVENTS)
    const notCurrent = snap.seats.find((_, i) => i !== snap.turnSeat)!.id
    expect(() => applyMove(snap, notCurrent, { type: 'reveal' })).toThrow()
    expect(legalMoves(snap, notCurrent)).toHaveLength(0)
  })

  it('the auto-flip opens the first face-down slot, in order', () => {
    let snap = newGame(PLAYERS, 42, NO_EVENTS)
    // Slots 0-2 are up (2 at deal + the opener's flip); 3-5 still down.
    expect(snap.buffet.map((s) => s.faceUp)).toEqual([
      true,
      true,
      true,
      false,
      false,
      false
    ])
    snap = applyMove(snap, currentId(snap), { type: 'take', slot: 0 })
    // Next turn flipped the first remaining face-down (old slot 3).
    expect(snap.buffet.map((s) => s.faceUp)).toEqual([
      true,
      true,
      true,
      false,
      false
    ])
  })

  it('pass requeues the player; round ends when everyone took', () => {
    let snap = newGame(PLAYERS, 42, NO_EVENTS)
    const passer = currentId(snap)
    snap = playTurn(snap, (moves) => moves.find((m) => m.type === 'pass')!)
    expect(snap.seats.find((s) => s.id === passer)!.tookThisRound).toBe(false)
    while (snap.round === 1 && snap.phase === 'playing') {
      snap = playTurn(snap, firstTake)
    }
    expect(snap.round).toBe(2)
    expect(snap.seats.every((s) => s.hand.length === 1)).toBe(true)
  })
})

describe('anti-stall rule', () => {
  it('pass is illegal once no face-down card remains', () => {
    let snap = newGame(PLAYERS, 42, NO_EVENTS)
    let guard = 100
    while (snap.buffet.some((s) => !s.faceUp) && guard-- > 0) {
      snap = playTurn(
        snap,
        (moves) => moves.find((m) => m.type === 'pass') ?? firstTake(moves)
      )
    }
    const moves = legalMoves(snap, currentId(snap))
    expect(moves.some((m) => m.type === 'pass')).toBe(false)
    expect(moves.some((m) => m.type === 'take')).toBe(true)
  })

  it('abacaxi swap stays legal with everything revealed (it spends the abacaxi)', () => {
    const snap = newGame(PLAYERS, 42, NO_EVENTS)
    snap.buffet.forEach((s) => (s.faceUp = true))
    snap.turnStep = 'act'
    const seat = snap.seats[snap.turnSeat]
    seat.hand.push({ id: 900, kind: 'abacaxi' })
    // An abacaxi lying on the buffet is never a swap target (no-op loop).
    snap.buffet[0].card = { id: 901, kind: 'abacaxi' }
    const moves = legalMoves(snap, seat.id)
    expect(moves.some((m) => m.type === 'pass')).toBe(false)
    const slots = moves.flatMap((m) => (m.type === 'abacaxi' ? [m.slot] : []))
    expect(slots).toEqual([1, 2, 3, 4, 5])
    const next = applyMove(snap, seat.id, { type: 'abacaxi', slot: 1 })
    const me = next.seats.find((s) => s.id === seat.id)!
    expect(me.tookThisRound).toBe(false)
    expect(me.hand.some((c) => c.kind === 'abacaxi')).toBe(false)
    expect(next.buffet[1].card.kind).toBe('abacaxi')
    // Free action: still the same player's turn — take in the same turn.
    expect(next.turnSeat).toBe(snap.turnSeat)
    expect(next.turnStep).toBe('act')
    const after = applyMove(next, seat.id, { type: 'take', slot: 2 })
    expect(after.seats.find((s) => s.id === seat.id)!.tookThisRound).toBe(true)
  })
})

describe('carryover', () => {
  it('leaves N leftovers (2 up, rest down) that open the next round', () => {
    let snap = newGame(PLAYERS, 7, NO_EVENTS)
    while (snap.round === 1) {
      snap = playTurn(snap, firstTake)
    }
    // M = 2N: flips per round = 2 + N turns, so N-2 stay down; N carry over.
    expect(snap.buffet).toHaveLength(6)
    // 2 face-up carryover + the round-2 opener's automatic flip.
    expect(snap.buffet.filter((s) => s.faceUp)).toHaveLength(3)
  })

  it('rotates the start seat every round', () => {
    let snap = newGame(PLAYERS, 7, NO_EVENTS)
    const firstStart = snap.startSeat
    while (snap.round === 1) snap = playTurn(snap, firstTake)
    expect(snap.startSeat).toBe((firstStart + 1) % 3)
    expect(snap.turnSeat).toBe(snap.startSeat)
  })
})

describe('game end', () => {
  it('greedy playthrough ends after 7 rounds with all hands at 7', () => {
    let snap = newGame(PLAYERS, 123, NO_EVENTS)
    let guard = 500
    while (snap.phase === 'playing' && guard-- > 0) {
      snap = playTurn(snap, firstTake)
    }
    expect(snap.phase).toBe('scored')
    expect(snap.round).toBe(7)
    expect(snap.seats.every((s) => s.hand.length === 7)).toBe(true)
    expect(snap.buffet).toHaveLength(3) // M - N leftovers at 3 players
  })
})

describe('property: random legal play always terminates with invariants', () => {
  it.each([2, 3, 4, 5, 6].flatMap((n) => [1, 2, 3].map((s) => [n, s])))(
    '%i players, seed %i (no events)',
    (nPlayers, seed) => {
      const players = Array.from({ length: nPlayers }, (_, i) => ({
        id: `p${i}`,
        name: `P${i}`
      }))
      const rng = mulberry32(seed * 7919 + nPlayers)
      let snap = newGame(players, seed, NO_EVENTS)
      let guard = 2000
      while (snap.phase === 'playing' && guard-- > 0) {
        const moves = legalMoves(snap, currentId(snap))
        expect(moves.length).toBeGreaterThan(0)
        snap = applyMove(
          snap,
          currentId(snap),
          moves[Math.floor(rng() * moves.length)]
        )
        const ids = [
          ...snap.deck.map((c) => c.id),
          ...snap.buffet.map((s) => s.card.id),
          ...snap.seats.flatMap((s) => s.hand.map((c) => c.id))
        ]
        expect(new Set(ids).size).toBe(ids.length)
        expect(ids.length).toBe(68)
      }
      expect(snap.phase).toBe('scored')
      expect(snap.seats.every((s) => s.hand.length === CONFIG.handSize)).toBe(
        true
      )
    }
  )
})
