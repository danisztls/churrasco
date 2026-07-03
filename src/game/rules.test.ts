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

const currentId = (snap: GameSnapshot) => snap.seats[snap.turnSeat].id

/** Plays the current player's turn: reveal if needed, then use pick(). */
function playTurn(
  snap: GameSnapshot,
  pick: (moves: Move[]) => Move
): GameSnapshot {
  if (snap.turnStep === 'reveal') {
    const reveals = legalMoves(snap)
    snap = applyMove(snap, currentId(snap), reveals[0])
  }
  const moves = legalMoves(snap)
  return applyMove(snap, currentId(snap), pick(moves))
}

const firstTake = (moves: Move[]) => moves.find((m) => m.type === 'take')!

describe('newGame', () => {
  it('deals M = N+2 buffet with 2 face-up, deck holds the rest', () => {
    const snap = newGame(PLAYERS, 42)
    expect(snap.buffet).toHaveLength(5)
    expect(snap.buffet.filter((s) => s.faceUp)).toHaveLength(2)
    expect(snap.deck).toHaveLength(68 - 5)
    expect(snap.round).toBe(1)
    expect(snap.turnSeat).toBe(snap.startSeat)
    expect(snap.turnStep).toBe('reveal')
  })

  it('total deck is 68 food cards', () => {
    const snap = newGame(PLAYERS, 1)
    expect(snap.deck.length + snap.buffet.length).toBe(68)
  })
})

describe('turn flow', () => {
  it('requires reveal before acting, then take removes the slot', () => {
    let snap = newGame(PLAYERS, 42)
    const player = currentId(snap)
    expect(() => applyMove(snap, player, { type: 'take', slot: 0 })).toThrow()
    snap = applyMove(snap, player, legalMoves(snap)[0]) // reveal
    expect(snap.buffet.filter((s) => s.faceUp)).toHaveLength(3)
    const before = snap.buffet.length
    snap = applyMove(snap, player, firstTake(legalMoves(snap)))
    expect(snap.buffet).toHaveLength(before - 1)
    expect(snap.seats.find((s) => s.id === player)!.hand).toHaveLength(1)
    expect(currentId(snap)).not.toBe(player)
  })

  it('rejects moves from a player out of turn', () => {
    const snap = newGame(PLAYERS, 42)
    const notCurrent = snap.seats.find((_, i) => i !== snap.turnSeat)!.id
    expect(() =>
      applyMove(snap, notCurrent, { type: 'reveal', slot: 2 })
    ).toThrow()
  })

  it('pass requeues the player; round ends when everyone took', () => {
    let snap = newGame(PLAYERS, 42)
    const passer = currentId(snap)
    snap = playTurn(snap, (moves) => moves.find((m) => m.type === 'pass')!)
    expect(snap.seats.find((s) => s.id === passer)!.tookThisRound).toBe(false)
    // Everyone takes as their turns come; passer gets a turn again.
    while (snap.round === 1 && snap.phase === 'playing') {
      snap = playTurn(snap, firstTake)
    }
    expect(snap.round).toBe(2)
    expect(snap.seats.every((s) => s.hand.length === 1)).toBe(true)
  })
})

describe('anti-stall rule', () => {
  it('pass is illegal once no face-down card remains', () => {
    let snap = newGame(PLAYERS, 42)
    // Exhaust reveals: everyone passes while allowed; face-down shrinks 1/turn.
    let guard = 100
    while (snap.buffet.some((s) => !s.faceUp) && guard-- > 0) {
      snap = playTurn(
        snap,
        (moves) => moves.find((m) => m.type === 'pass') ?? firstTake(moves)
      )
    }
    const moves = legalMoves(snap)
    expect(moves.some((m) => m.type === 'pass')).toBe(false)
    expect(moves.some((m) => m.type === 'abacaxi')).toBe(false)
    expect(moves.every((m) => m.type === 'take')).toBe(true)
  })
})

describe('carryover', () => {
  it('leaves exactly 2 face-up leftovers that open the next round', () => {
    let snap = newGame(PLAYERS, 7)
    const leftoverIds = () => snap.buffet.map((s) => s.card.id).sort()
    while (snap.round === 1) {
      snap = playTurn(snap, firstTake)
    }
    // New round: 5 slots again, 2 face-up (the carryover), 3 face-down.
    expect(snap.buffet).toHaveLength(5)
    expect(snap.buffet.filter((s) => s.faceUp)).toHaveLength(2)
    expect(leftoverIds()).toHaveLength(5)
  })

  it('rotates the start seat every round', () => {
    let snap = newGame(PLAYERS, 7)
    const firstStart = snap.startSeat
    while (snap.round === 1) snap = playTurn(snap, firstTake)
    expect(snap.startSeat).toBe((firstStart + 1) % 3)
    expect(snap.turnSeat).toBe(snap.startSeat)
  })
})

describe('game end', () => {
  it('greedy playthrough ends after 7 rounds with all hands at 7', () => {
    let snap = newGame(PLAYERS, 123)
    let guard = 500
    while (snap.phase === 'playing' && guard-- > 0) {
      snap = playTurn(snap, firstTake)
    }
    expect(snap.phase).toBe('scored')
    expect(snap.round).toBe(7)
    expect(snap.seats.every((s) => s.hand.length === 7)).toBe(true)
    expect(snap.buffet).toHaveLength(2)
  })
})

describe('property: random legal play always terminates with invariants', () => {
  it.each([2, 3, 4, 5, 6].flatMap((n) => [1, 2, 3].map((s) => [n, s])))(
    '%i players, seed %i',
    (nPlayers, seed) => {
      const players = Array.from({ length: nPlayers }, (_, i) => ({
        id: `p${i}`,
        name: `P${i}`
      }))
      const rng = mulberry32(seed * 7919 + nPlayers)
      let snap = newGame(players, seed)
      let guard = 2000
      while (snap.phase === 'playing' && guard-- > 0) {
        const moves = legalMoves(snap)
        expect(moves.length).toBeGreaterThan(0)
        snap = applyMove(
          snap,
          currentId(snap),
          moves[Math.floor(rng() * moves.length)]
        )
        // No card ever duplicated or lost.
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
