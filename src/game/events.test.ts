import { describe, expect, it } from 'vitest'
import { CONFIG, DEFAULT_MODIFIERS } from './config'
import { mulberry32 } from './deck'
import { applyMove, legalMoves, newGame } from './rules'
import type { EventId, GameSnapshot, Move } from './types'

const PLAYERS = [
  { id: 'a', name: 'Ana' },
  { id: 'b', name: 'Beto' },
  { id: 'c', name: 'Caio' }
]

/** Applies the first legal move of whichever seat can act (greedy). */
function autoMove(snap: GameSnapshot): GameSnapshot {
  for (const seat of snap.seats) {
    const moves = legalMoves(snap, seat.id)
    if (moves.length > 0) return applyMove(snap, seat.id, moves[0])
  }
  throw new Error('deadlock: no seat has a legal move')
}

function playUntil(
  snap: GameSnapshot,
  done: (s: GameSnapshot) => boolean,
  guard = 500
): GameSnapshot {
  while (!done(snap) && snap.phase === 'playing' && guard-- > 0) {
    snap = autoMove(snap)
  }
  if (guard <= 0) throw new Error('guard exhausted')
  return snap
}

/** New game (no random events) with `id` staged as the round-2 event. */
function gameWithEvent(id: EventId, seed = 42): GameSnapshot {
  const snap = newGame(PLAYERS, seed, { events: false })
  snap.eventDeck = [id]
  return playUntil(snap, (s) => s.round === 2)
}

const allCardIds = (snap: GameSnapshot) => [
  ...snap.deck.map((c) => c.id),
  ...snap.buffet.map((s) => s.card.id),
  ...snap.seats.flatMap((s) => s.hand.map((c) => c.id)),
  ...snap.discard.map((c) => c.id),
  ...snap.sobras.map((c) => c.id)
]

describe('só resenha (neutro)', () => {
  it('is a pure no-op: default modifiers, no pending phase', () => {
    const snap = gameWithEvent('resenha')
    expect(snap.currentEvent).toBe('resenha')
    expect(snap.modifiers).toEqual(DEFAULT_MODIFIERS)
    expect(snap.pending).toBeNull()
    expect(snap.buffet).toHaveLength(CONFIG.buffetSlots(3))
  })
})

describe('primo rico', () => {
  it('deals 2 extra buffet cards for the round', () => {
    const snap = gameWithEvent('primo-rico')
    expect(snap.currentEvent).toBe('primo-rico')
    expect(snap.buffet).toHaveLength(CONFIG.buffetSlots(3) + 2)
  })
})

describe('acabou o carvão', () => {
  it('deals 2 fewer buffet cards and the round still resolves', () => {
    let snap = gameWithEvent('carvao')
    expect(snap.currentEvent).toBe('carvao')
    expect(snap.buffet).toHaveLength(CONFIG.buffetSlots(3) - 2)
    snap = playUntil(snap, (s) => s.round === 3)
    // M = N: nothing carries over; round 3 opens as a fresh deal.
    expect(snap.seats.every((s) => s.hand.length === 2)).toBe(true)
    expect(new Set(allCardIds(snap)).size).toBe(68)
  })
})

describe('o rex atacou', () => {
  it('discards the carryover and opens a fresh buffet', () => {
    const snap = gameWithEvent('rex')
    expect(snap.currentEvent).toBe('rex')
    // Last round's N leftovers (2 up + 1 down at 3p) were eaten by the dog.
    expect(snap.discard).toHaveLength(3)
    expect(snap.buffet).toHaveLength(CONFIG.buffetSlots(3))
    // Fresh deal: 2 flipped at start + the opener's auto-flip.
    expect(snap.buffet.filter((s) => s.faceUp)).toHaveLength(3)
    expect(new Set(allCardIds(snap)).size).toBe(68)
  })
})

describe('churrasqueiro profissa', () => {
  it('reveals the whole buffet and (via anti-stall) forbids passing', () => {
    const snap = gameWithEvent('churrasqueiro')
    expect(snap.buffet.every((s) => s.faceUp)).toBe(true)
    expect(snap.turnStep).toBe('act')
    const moves = legalMoves(snap, snap.seats[snap.turnSeat].id)
    expect(moves.some((m) => m.type === 'pass')).toBe(false)
    expect(moves.every((m) => m.type === 'take')).toBe(true)
  })
})

describe('depois acaba', () => {
  it('flip-and-take: revealing takes the card and ends your turn', () => {
    const snap = gameWithEvent('depois-acaba')
    const actor = snap.seats[snap.turnSeat]
    const moves = legalMoves(snap, actor.id)
    expect(moves.every((m) => m.type === 'reveal')).toBe(true)
    const next = applyMove(snap, actor.id, moves[0])
    const after = next.seats.find((s) => s.id === actor.id)!
    expect(after.hand.length).toBe(actor.hand.length + 1)
    expect(after.tookThisRound).toBe(true)
    expect(next.turnSeat).not.toBe(snap.turnSeat)
  })

  it('the round completes in exactly N turns', () => {
    let snap = gameWithEvent('depois-acaba')
    snap = playUntil(snap, (s) => s.round === 3)
    expect(snap.seats.every((s) => s.hand.length === 2)).toBe(true)
  })
})

describe('os últimos serão os primeiros', () => {
  it('starts from the would-be last seat and runs in reverse', () => {
    const snap = gameWithEvent('ultimos-primeiros')
    const n = snap.seats.length
    expect(snap.modifiers.reversed).toBe(true)
    expect(snap.turnSeat).toBe((snap.startSeat + n - 1) % n)
    // First take moves the turn backwards.
    const actor = snap.seats[snap.turnSeat]
    let s = snap
    if (s.turnStep === 'reveal')
      s = applyMove(s, actor.id, legalMoves(s, actor.id)[0])
    const take = legalMoves(s, actor.id).find((m) => m.type === 'take')!
    s = applyMove(s, actor.id, take)
    expect(s.turnSeat).toBe((snap.startSeat + n - 2) % n)
  })
})

describe('brinde!', () => {
  it('the seat with most bebidas starts the round', () => {
    const snap = newGame(PLAYERS, 42, { events: false })
    snap.eventDeck = ['brinde']
    // Move three bebidas from the deck into seat 1's hand (conserving cards).
    const bebidas = snap.deck.filter((c) => c.kind === 'bebida').slice(0, 3)
    const bebidaIds = new Set(bebidas.map((c) => c.id))
    snap.deck = snap.deck.filter((c) => !bebidaIds.has(c.id))
    snap.seats[1].hand.push(...bebidas)
    const s = playUntil(snap, (x) => x.round === 2)
    expect(s.turnSeat).toBe(1)
  })
})

describe('esqueceram de mim', () => {
  it('the would-be starter takes last', () => {
    let snap = gameWithEvent('esqueceram')
    const skipped = snap.startSeat
    expect(snap.modifiers.lastSeat).toBe(skipped)
    expect(snap.turnSeat).toBe((skipped + 1) % 3)
    // The two others act first, whatever their moves; skipped goes last.
    snap = playUntil(
      snap,
      (s) =>
        s.round !== 2 || s.seats.filter((x) => x.tookThisRound).length === 2
    )
    expect(snap.round).toBe(2)
    expect(snap.seats[skipped].tookThisRound).toBe(false)
    expect(snap.turnSeat).toBe(skipped)
    snap = playUntil(snap, (s) => s.round === 3)
    expect(snap.seats.every((s) => s.hand.length === 2)).toBe(true)
  })
})

describe('não alimente os animais', () => {
  it('everyone discards 1 card, then the round runs normally', () => {
    let snap = gameWithEvent('nao-alimente')
    expect(snap.pending?.kind).toBe('discard')
    for (const seat of snap.seats) {
      const moves = legalMoves(snap, seat.id)
      expect(moves).toHaveLength(1) // hands have exactly 1 card
      snap = applyMove(snap, seat.id, moves[0])
    }
    expect(snap.pending).toBeNull()
    expect(snap.discard).toHaveLength(3)
    expect(snap.seats.every((s) => s.hand.length === 0)).toBe(true)
    snap = playUntil(snap, (s) => s.round === 3)
    expect(snap.seats.every((s) => s.hand.length === 1)).toBe(true)
  })

  it('stretches the game by one round (net-zero round)', () => {
    let snap = newGame(PLAYERS, 42, { events: false })
    snap.eventDeck = ['nao-alimente']
    snap = playUntil(snap, (s) => s.phase === 'scored', 2000)
    expect(snap.round).toBe(8) // 7 gains + 1 washed round
    expect(snap.seats.every((s) => s.hand.length === 7)).toBe(true)
  })
})

describe('amigo secreto', () => {
  it('each chosen card moves to the next seat', () => {
    let snap = gameWithEvent('amigo-secreto')
    expect(snap.pending?.kind).toBe('gift')
    const before = snap.seats.map((s) => s.hand[0].id)
    for (const seat of snap.seats) {
      const moves = legalMoves(snap, seat.id)
      snap = applyMove(snap, seat.id, moves[0])
    }
    expect(snap.pending).toBeNull()
    snap.seats.forEach((seat, i) => {
      expect(seat.hand).toHaveLength(1)
      expect(seat.hand[0].id).toBe(before[(i + 2) % 3]) // received from seat i-1
    })
  })
})

describe('álbum da copa', () => {
  it('swaps in table order: chosen card out, random card from the target in', () => {
    let snap = gameWithEvent('album-copa')
    expect(snap.pending?.kind).toBe('swap')
    if (snap.pending?.kind !== 'swap') throw new Error('unreachable')
    expect(snap.pending.queue[0]).toBe(snap.seats[snap.startSeat].id)

    const headId = snap.pending.queue[0]
    const headIdx = snap.seats.findIndex((s) => s.id === headId)
    const myCard = snap.seats[headIdx].hand[0].id
    const swaps = legalMoves(snap, headId).filter(
      (m): m is Move & { type: 'event-swap' } => m.type === 'event-swap'
    )
    // Every other player with cards is a target (any seat, not just neighbors).
    expect(new Set(swaps.map((m) => m.target)).size).toBe(2)
    const move = swaps[0]
    const otherIdx = snap.seats.findIndex((s) => s.id === move.target)
    const otherCard = snap.seats[otherIdx].hand[0].id

    snap = applyMove(snap, headId, move)
    expect(snap.seats[headIdx].hand.map((c) => c.id)).toEqual([otherCard])
    expect(snap.seats[otherIdx].hand.map((c) => c.id)).toEqual([myCard])

    // Drain the rest of the album, recording who each actor targets. Cards are
    // conserved (each swap trades 1-for-1) and the phase ends cleanly.
    const targets = [move.target]
    while (snap.pending?.kind === 'swap') {
      const id = snap.pending.queue[0]
      const mv = legalMoves(snap, id).find(
        (m): m is Move & { type: 'event-swap' } => m.type === 'event-swap'
      )!
      targets.push(mv.target)
      snap = applyMove(snap, id, mv)
    }
    expect(snap.pending).toBeNull()
    expect(snap.seats.every((s) => s.hand.length === 1)).toBe(true)
    // Nobody is chosen twice — an actor with no un-chosen target is skipped.
    expect(new Set(targets).size).toBe(targets.length)
  })

  it('never targets the same player twice, even with many seats', () => {
    const players = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: id }))
    const fresh = newGame(players, 7, { events: false })
    fresh.eventDeck = ['album-copa']
    let snap = playUntil(fresh, (s) => s.round === 2)
    expect(snap.pending?.kind).toBe('swap')

    const targets: string[] = []
    while (snap.pending?.kind === 'swap') {
      const id = snap.pending.queue[0]
      const mv = legalMoves(snap, id).find(
        (m): m is Move & { type: 'event-swap' } => m.type === 'event-swap'
      )!
      // The offered targets never include an already-chosen seat.
      legalMoves(snap, id).forEach((m) => {
        if (m.type === 'event-swap') expect(targets).not.toContain(m.target)
      })
      targets.push(mv.target)
      snap = applyMove(snap, id, mv)
    }
    expect(new Set(targets).size).toBe(targets.length)
  })
})

describe('abre a boquinha', () => {
  it('the taken card lands in the next seat’s hand', () => {
    let snap = gameWithEvent('abre-boquinha')
    const actorIdx = snap.turnSeat
    const actor = snap.seats[actorIdx]
    if (snap.turnStep === 'reveal')
      snap = applyMove(snap, actor.id, legalMoves(snap, actor.id)[0])
    const take = legalMoves(snap, actor.id).find(
      (m): m is Move & { type: 'take' } => m.type === 'take'
    )!
    const cardId = snap.buffet[take.slot].card.id
    snap = applyMove(snap, actor.id, take)
    const receiver = snap.seats[(actorIdx + 1) % 3]
    expect(receiver.hand.some((c) => c.id === cardId)).toBe(true)
    expect(snap.seats[actorIdx].tookThisRound).toBe(true)
    expect(snap.seats[actorIdx].hand).toHaveLength(1) // unchanged

    snap = playUntil(snap, (s) => s.round === 3)
    expect(snap.seats.every((s) => s.hand.length === 2)).toBe(true)
  })
})

describe('as sobras de ontem', () => {
  it('take, then give to the pile; the pile seeds the next round', () => {
    let snap = gameWithEvent('sobras')
    const actor = snap.seats[snap.turnSeat]
    if (snap.turnStep === 'reveal')
      snap = applyMove(snap, actor.id, legalMoves(snap, actor.id)[0])
    const take = legalMoves(snap, actor.id).find((m) => m.type === 'take')!
    snap = applyMove(snap, actor.id, take)
    expect(snap.turnStep).toBe('give')
    const gives = legalMoves(snap, actor.id)
    expect(gives.every((m) => m.type === 'event-give')).toBe(true)
    snap = applyMove(snap, actor.id, gives[0])
    expect(snap.sobras).toHaveLength(1)

    snap = playUntil(snap, (s) => s.round === 3)
    const faceDownIds = snap.buffet
      .filter((s) => !s.faceUp)
      .map((s) => s.card.id)
    expect(snap.sobras).toHaveLength(0)
    // The 3 pile cards enter face-down after the (all face-up) carryover;
    // the round-3 opener's flip opens the first of them, leaving 2 down.
    expect(faceDownIds).toHaveLength(2)
    expect(snap.seats.every((s) => s.hand.length === 1)).toBe(true)
  })
})

describe('property: random play with events terminates in sync', () => {
  it.each([2, 3, 4, 5, 6].flatMap((n) => [1, 2, 3, 4].map((s) => [n, s])))(
    '%i players, seed %i',
    (nPlayers, seed) => {
      const players = Array.from({ length: nPlayers }, (_, i) => ({
        id: `p${i}`,
        name: `P${i}`
      }))
      const rng = mulberry32(seed * 104729 + nPlayers)
      let snap = newGame(players, seed)
      let guard = 5000
      while (snap.phase === 'playing' && guard-- > 0) {
        const actors = snap.seats
          .map((seat) => ({ id: seat.id, moves: legalMoves(snap, seat.id) }))
          .filter((a) => a.moves.length > 0)
        expect(actors.length).toBeGreaterThan(0)
        const actor = actors[Math.floor(rng() * actors.length)]
        const move = actor.moves[Math.floor(rng() * actor.moves.length)]
        snap = applyMove(snap, actor.id, move)
        const ids = allCardIds(snap)
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
