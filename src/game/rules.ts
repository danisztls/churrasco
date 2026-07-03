import { CONFIG, DEFAULT_MODIFIERS } from './config'
import { buildShuffledDeck, mulberry32 } from './deck'
import type { GameSnapshot, Move, TurnStep } from './types'

/**
 * Pure turn machine. applyMove() takes a snapshot + a move and returns a NEW
 * snapshot (or throws on an illegal move). The host is the only writer: it
 * validates through this module and publishes the resulting snapshot.
 */

export function newGame(
  players: { id: string; name: string; color?: string }[],
  seed: number
): GameSnapshot {
  if (players.length < 2 || players.length > CONFIG.maxPlayers)
    throw new Error(`newGame: ${players.length} jogadores fora do limite`)
  const rng = mulberry32(seed)
  const deck = buildShuffledDeck(seed)
  const snap: GameSnapshot = {
    phase: 'playing',
    round: 1,
    seats: players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      hand: [],
      tookThisRound: false
    })),
    startSeat: Math.floor(rng() * players.length),
    turnSeat: 0,
    turnStep: 'act',
    buffet: [],
    deck,
    modifiers: { ...DEFAULT_MODIFIERS },
    seed
  }
  dealRound(snap)
  return snap
}

/** Fills the buffet up to M = N + extra (+delta), keeping carryover face-up. */
function dealRound(snap: GameSnapshot): void {
  const n = snap.seats.length
  const target = n + CONFIG.buffetExtra + snap.modifiers.buffetDelta
  // Round 1 has no carryover: flip the first cards dealt instead.
  const isFirstDeal = snap.buffet.length === 0
  while (snap.buffet.length < target && snap.deck.length > 0) {
    snap.buffet.push({ card: snap.deck.shift()!, faceUp: false })
  }
  if (isFirstDeal) {
    for (let i = 0; i < Math.min(CONFIG.faceUpAtStart, snap.buffet.length); i++)
      snap.buffet[i].faceUp = true
  }
  if (snap.modifiers.revealAll) snap.buffet.forEach((s) => (s.faceUp = true))
  snap.turnSeat = snap.startSeat
  snap.turnStep = stepFor(snap)
}

function stepFor(snap: GameSnapshot): TurnStep {
  return snap.buffet.some((s) => !s.faceUp) ? 'reveal' : 'act'
}

function passIsLegal(snap: GameSnapshot): boolean {
  if (!snap.modifiers.passAllowed) return false
  if (CONFIG.antiStallPass && !snap.buffet.some((s) => !s.faceUp)) return false
  return true
}

/** Legal moves for the seat whose turn it is (UI highlighting + host checks). */
export function legalMoves(snap: GameSnapshot): Move[] {
  if (snap.phase !== 'playing') return []
  const moves: Move[] = []
  if (snap.turnStep === 'reveal') {
    snap.buffet.forEach((s, i) => {
      if (!s.faceUp) moves.push({ type: 'reveal', slot: i })
    })
    return moves
  }
  snap.buffet.forEach((s, i) => {
    if (s.faceUp) moves.push({ type: 'take', slot: i })
  })
  if (passIsLegal(snap)) {
    moves.push({ type: 'pass' })
    const me = snap.seats[snap.turnSeat]
    if (me.hand.some((c) => c.kind === 'abacaxi')) {
      snap.buffet.forEach((s, i) => {
        if (s.faceUp) moves.push({ type: 'abacaxi', slot: i })
      })
    }
  }
  return moves
}

export function applyMove(
  snap: GameSnapshot,
  playerId: string,
  move: Move
): GameSnapshot {
  if (snap.phase !== 'playing') throw new Error('jogo não está em andamento')
  const next = structuredClone(snap)
  const seat = next.seats[next.turnSeat]
  if (!seat || seat.id !== playerId) throw new Error('não é a sua vez')

  switch (move.type) {
    case 'reveal': {
      if (next.turnStep !== 'reveal') throw new Error('nada a revelar agora')
      const slot = next.buffet[move.slot]
      if (!slot || slot.faceUp) throw new Error('carta inválida para revelar')
      slot.faceUp = true
      next.turnStep = 'act'
      return next
    }
    case 'take': {
      if (next.turnStep !== 'act') throw new Error('revele uma carta primeiro')
      const slot = next.buffet[move.slot]
      if (!slot || !slot.faceUp) throw new Error('carta inválida para pegar')
      seat.hand.push(slot.card)
      seat.tookThisRound = true
      next.buffet.splice(move.slot, 1)
      endTurn(next)
      return next
    }
    case 'pass': {
      if (next.turnStep !== 'act') throw new Error('revele uma carta primeiro')
      if (!passIsLegal(next)) throw new Error('passar não é permitido agora')
      endTurn(next)
      return next
    }
    case 'abacaxi': {
      if (next.turnStep !== 'act') throw new Error('revele uma carta primeiro')
      if (!passIsLegal(next)) throw new Error('troca não é permitida agora')
      const slot = next.buffet[move.slot]
      if (!slot || !slot.faceUp) throw new Error('carta inválida para trocar')
      const idx = seat.hand.findIndex((c) => c.kind === 'abacaxi')
      if (idx === -1) throw new Error('você não tem abacaxi')
      const [abacaxi] = seat.hand.splice(idx, 1)
      seat.hand.push(slot.card)
      slot.card = abacaxi
      endTurn(next)
      return next
    }
  }
}

function endTurn(snap: GameSnapshot): void {
  if (snap.seats.every((s) => s.tookThisRound)) {
    endRound(snap)
    return
  }
  const dir = snap.modifiers.reversed ? -1 : 1
  const n = snap.seats.length
  let i = snap.turnSeat
  do {
    i = (i + dir + n) % n
  } while (snap.seats[i].tookThisRound)
  snap.turnSeat = i
  snap.turnStep = stepFor(snap)
}

function endRound(snap: GameSnapshot): void {
  // Invariant: everyone acquired net +1 card, buffet keeps its leftovers
  // (normally 2, all face-up) as next round's opening.
  if (snap.seats.every((s) => s.hand.length >= CONFIG.handSize)) {
    snap.phase = 'scored'
    return
  }
  snap.round += 1
  snap.startSeat = (snap.startSeat + 1) % snap.seats.length
  snap.seats.forEach((s) => (s.tookThisRound = false))
  snap.modifiers = { ...DEFAULT_MODIFIERS } // M2: event card resolves here
  dealRound(snap)
}
