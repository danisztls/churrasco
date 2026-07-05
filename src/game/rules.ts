import { CONFIG, DEFAULT_MODIFIERS } from './config'
import { buildShuffledDeck, mulberry32, shuffle } from './deck'
import { buildEventDeck, EVENTS } from './events'
import { cardLabel } from './log'
import type {
  Card,
  GameSnapshot,
  LogAction,
  Move,
  PendingSimul,
  PendingSwap,
  PlayerSeat,
  TurnStep
} from './types'

function logEntry(
  snap: GameSnapshot,
  seat: PlayerSeat,
  action: LogAction,
  card?: Card,
  options?: number
): void {
  snap.log.push({
    round: snap.round,
    event: snap.currentEvent,
    seat: seat.name,
    action,
    card: card ? cardLabel(card) : undefined,
    options
  })
}

const faceUpCount = (snap: GameSnapshot) =>
  snap.buffet.filter((s) => s.faceUp).length

/**
 * Pure turn machine. applyMove() takes a snapshot + a move and returns a NEW
 * snapshot (or throws on an illegal move). The host is the only writer: it
 * validates through this module and publishes the resulting snapshot.
 *
 * Round lifecycle: endRound() -> startRound() draws an event (round >= 2),
 * runs its preDeal hook (modifiers), refills the buffet, then its postDeal
 * hook (starter overrides, pending phases, or burning the round).
 */

export function newGame(
  players: { id: string; name: string; color?: string }[],
  seed: number,
  opts: { events?: boolean } = {}
): GameSnapshot {
  if (players.length < 2 || players.length > CONFIG.maxPlayers)
    throw new Error(`newGame: ${players.length} jogadores fora do limite`)
  const events = opts.events ?? CONFIG.eventsEnabled
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
    eventDeck: events ? shuffle(buildEventDeck(), rng) : [],
    currentEvent: null,
    pending: null,
    sobras: [],
    discard: [],
    log: [],
    seed
  }
  dealRound(snap)
  return snap
}

/** Fills the buffet up to CONFIG.buffetSlots(n) (+delta). Carryover slots
 * arrive face-up (flipped at endRound — sobras públicas). */
function dealRound(snap: GameSnapshot): void {
  const n = snap.seats.length
  const target = CONFIG.buffetSlots(n) + snap.modifiers.buffetDelta
  // A fresh table (round 1, or after Tá Pegando Fogo) has no carryover:
  // flip the first cards dealt instead.
  const isFreshDeal = snap.buffet.length === 0
  while (snap.buffet.length < target && snap.deck.length > 0) {
    snap.buffet.push({ card: snap.deck.shift()!, faceUp: false })
  }
  if (isFreshDeal) {
    for (let i = 0; i < Math.min(CONFIG.faceUpAtStart, snap.buffet.length); i++)
      snap.buffet[i].faceUp = true
  }
  if (snap.modifiers.revealAll) snap.buffet.forEach((s) => (s.faceUp = true))
  snap.turnSeat = snap.startSeat
  beginTurn(snap)
}

/**
 * Turn opener. Flipping the next face-down card carries no decision, so the
 * engine does it automatically — except under Depois Acaba, where the flip IS
 * the turn (what you flip is yours) and stays a player move.
 */
function beginTurn(snap: GameSnapshot): void {
  if (snap.modifiers.forcedTake) {
    snap.turnStep = stepFor(snap)
    return
  }
  const idx = snap.buffet.findIndex((s) => !s.faceUp)
  if (idx !== -1) snap.buffet[idx].faceUp = true
  snap.turnStep = 'act'
}

/** Round >= 2 opener: event draw + hooks around the buffet refill. */
function startRound(snap: GameSnapshot): void {
  snap.modifiers = { ...DEFAULT_MODIFIERS }
  snap.pending = null
  snap.currentEvent = snap.eventDeck.shift() ?? null
  const spec = snap.currentEvent ? EVENTS[snap.currentEvent] : undefined
  spec?.preDeal?.(snap)
  // As Sobras de Ontem: last round's pile seeds this round's face-down cards.
  if (snap.sobras.length > 0) {
    const rng = mulberry32((snap.seed ^ (snap.round * 2654435761)) >>> 0)
    snap.deck.unshift(...shuffle(snap.sobras, rng))
    snap.sobras = []
  }
  dealRound(snap)
  if (spec?.postDeal?.(snap) === 'round-lost') {
    // Nobody takes; the round is skipped (unused by stock events, kept as API).
    endRound(snap)
  }
}

function stepFor(snap: GameSnapshot): TurnStep {
  return snap.buffet.some((s) => !s.faceUp) ? 'reveal' : 'act'
}

function passIsLegal(snap: GameSnapshot): boolean {
  if (!snap.modifiers.passAllowed) return false
  if (CONFIG.antiStallPass && !snap.buffet.some((s) => !s.faceUp)) return false
  return true
}

const seatIdx = (snap: GameSnapshot, playerId: string) =>
  snap.seats.findIndex((s) => s.id === playerId)

/** Legal moves for a given player (may be empty; event phases are not
 * turn-gated, so different players can have moves at the same time). */
export function legalMoves(snap: GameSnapshot, playerId: string): Move[] {
  if (snap.phase !== 'playing') return []
  const moves: Move[] = []

  if (snap.pending) {
    const idx = seatIdx(snap, playerId)
    if (idx === -1) return []
    const hand = snap.seats[idx].hand
    if (snap.pending.kind === 'swap') {
      if (snap.pending.queue[0] !== playerId || hand.length === 0) return []
      const targets = snap.seats.filter(
        (s, i) => i !== idx && s.hand.length > 0
      )
      hand.forEach((_, handIdx) => {
        targets.forEach((t) =>
          moves.push({ type: 'event-swap', handIdx, target: t.id })
        )
      })
      return moves
    }
    // simultaneous discard / gift
    if (
      !snap.pending.waitingFor.includes(playerId) ||
      playerId in snap.pending.choices
    )
      return []
    const type =
      snap.pending.kind === 'discard' ? 'event-discard' : 'event-gift'
    hand.forEach((_, handIdx) => moves.push({ type, handIdx }))
    return moves
  }

  const seat = snap.seats[snap.turnSeat]
  if (!seat || seat.id !== playerId) return []

  if (snap.turnStep === 'give') {
    seat.hand.forEach((_, handIdx) =>
      moves.push({ type: 'event-give', handIdx })
    )
    return moves
  }
  if (snap.turnStep === 'reveal') {
    if (snap.buffet.some((s) => !s.faceUp)) moves.push({ type: 'reveal' })
    return moves
  }
  snap.buffet.forEach((s, i) => {
    if (s.faceUp) moves.push({ type: 'take', slot: i })
  })
  if (passIsLegal(snap)) moves.push({ type: 'pass' })
  // The abacaxi swap is progress, not stalling — each swap spends an abacaxi
  // from the hand, so it can't loop. It skips the anti-stall face-down gate
  // and is blocked only by "no passing" events (it still behaves as a pass).
  if (
    snap.modifiers.passAllowed &&
    seat.hand.some((c) => c.kind === 'abacaxi')
  ) {
    snap.buffet.forEach((s, i) => {
      if (s.faceUp && s.card.kind !== 'abacaxi')
        moves.push({ type: 'abacaxi', slot: i })
    })
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

  switch (move.type) {
    case 'event-discard':
    case 'event-gift':
      return applySimul(next, playerId, move.type, move.handIdx)
    case 'event-swap':
      return applySwap(next, playerId, move.handIdx, move.target)
    case 'event-give':
      return applySobrasGive(next, playerId, move.handIdx)
  }

  if (next.pending) throw new Error('resolva o evento primeiro')
  const seat = next.seats[next.turnSeat]
  if (!seat || seat.id !== playerId) throw new Error('não é a sua vez')

  switch (move.type) {
    case 'reveal': {
      if (next.turnStep !== 'reveal') throw new Error('nada a revelar agora')
      const slotIdx = next.buffet.findIndex((s) => !s.faceUp)
      if (slotIdx === -1) throw new Error('nada para revelar')
      next.buffet[slotIdx].faceUp = true
      if (next.modifiers.forcedTake) {
        // Depois Acaba: what you flip is yours.
        takeSlot(next, seat, slotIdx)
        return next
      }
      next.turnStep = 'act'
      return next
    }
    case 'take': {
      if (next.turnStep !== 'act') throw new Error('revele uma carta primeiro')
      const slot = next.buffet[move.slot]
      if (!slot || !slot.faceUp) throw new Error('carta inválida para pegar')
      takeSlot(next, seat, move.slot)
      return next
    }
    case 'pass': {
      if (next.turnStep !== 'act') throw new Error('revele uma carta primeiro')
      if (!passIsLegal(next)) throw new Error('passar não é permitido agora')
      logEntry(next, seat, 'passou', undefined, faceUpCount(next))
      finishTurn(next)
      return next
    }
    case 'abacaxi': {
      if (next.turnStep !== 'act') throw new Error('revele uma carta primeiro')
      if (!next.modifiers.passAllowed)
        throw new Error('troca não é permitida agora')
      const slot = next.buffet[move.slot]
      if (!slot || !slot.faceUp || slot.card.kind === 'abacaxi')
        throw new Error('carta inválida para trocar')
      const idx = seat.hand.findIndex((c) => c.kind === 'abacaxi')
      if (idx === -1) throw new Error('você não tem abacaxi')
      logEntry(next, seat, 'abacaxi', slot.card, faceUpCount(next))
      const [abacaxi] = seat.hand.splice(idx, 1)
      seat.hand.push(slot.card)
      slot.card = abacaxi
      // Free action: the turn continues — still take or pass afterwards.
      return next
    }
  }
}

/** Move the buffet card into a hand (own, or neighbor's under Abre a
 * Boquinha), then advance — via the sobras give step when active. */
function takeSlot(snap: GameSnapshot, seat: PlayerSeat, slotIdx: number): void {
  logEntry(snap, seat, 'pegou', snap.buffet[slotIdx].card, faceUpCount(snap))
  const [slot] = snap.buffet.splice(slotIdx, 1)
  const receiver = snap.modifiers.takeToNeighbor
    ? snap.seats[(snap.turnSeat + 1) % snap.seats.length]
    : seat
  receiver.hand.push(slot.card)
  seat.tookThisRound = true
  if (snap.modifiers.sobrasGive && seat.hand.length > 0) {
    snap.turnStep = 'give'
    return
  }
  finishTurn(snap)
}

function applySimul(
  snap: GameSnapshot,
  playerId: string,
  type: 'event-discard' | 'event-gift',
  handIdx: number
): GameSnapshot {
  const pending = snap.pending
  const wanted = type === 'event-discard' ? 'discard' : 'gift'
  if (!pending || pending.kind !== wanted)
    throw new Error('não há evento desse tipo agora')
  const simul = pending as PendingSimul
  if (!simul.waitingFor.includes(playerId) || playerId in simul.choices)
    throw new Error('você não precisa escolher agora')
  const idx = seatIdx(snap, playerId)
  const hand = snap.seats[idx].hand
  if (handIdx < 0 || handIdx >= hand.length) throw new Error('carta inválida')
  simul.choices[playerId] = handIdx
  simul.waitingFor = simul.waitingFor.filter((id) => id !== playerId)
  if (simul.waitingFor.length === 0) resolveSimul(snap, simul)
  return snap
}

function resolveSimul(snap: GameSnapshot, simul: PendingSimul): void {
  const n = snap.seats.length
  // Remove every chosen card first, then distribute (a gift must never be
  // re-gifted in the same resolution).
  const given = new Map<number, (typeof snap.seats)[0]['hand'][0]>()
  snap.seats.forEach((seat, i) => {
    const choice = simul.choices[seat.id]
    if (choice === undefined) return
    const [card] = seat.hand.splice(choice, 1)
    given.set(i, card)
  })
  given.forEach((card, i) => {
    logEntry(
      snap,
      snap.seats[i],
      simul.kind === 'discard' ? 'descartou' : 'presenteou',
      card
    )
    if (simul.kind === 'discard') snap.discard.push(card)
    else snap.seats[(i + 1) % n].hand.push(card)
  })
  snap.pending = null
}

function applySwap(
  snap: GameSnapshot,
  playerId: string,
  handIdx: number,
  targetId: string
): GameSnapshot {
  const pending = snap.pending
  if (!pending || pending.kind !== 'swap') throw new Error('não há troca agora')
  const swap = pending as PendingSwap
  if (swap.queue[0] !== playerId) throw new Error('não é a sua vez de trocar')
  const idx = seatIdx(snap, playerId)
  const me = snap.seats[idx]
  if (handIdx < 0 || handIdx >= me.hand.length)
    throw new Error('carta inválida')
  const otherIdx = seatIdx(snap, targetId)
  if (otherIdx === -1 || otherIdx === idx) throw new Error('alvo inválido')
  const other = snap.seats[otherIdx]
  if (other.hand.length === 0) throw new Error('jogador sem cartas')
  // Deterministic pick of the returned card (host is the single writer).
  const rng = mulberry32(
    (snap.seed ^ (snap.round * 1009 + swap.queue.length * 31)) >>> 0
  )
  const [mine] = me.hand.splice(handIdx, 1)
  const theirIdx = Math.floor(rng() * other.hand.length)
  const [theirs] = other.hand.splice(theirIdx, 1)
  other.hand.push(mine)
  me.hand.push(theirs)
  logEntry(snap, me, 'trocou', mine)
  swap.queue.shift()
  // Skip queued players left without a legal swap.
  while (swap.queue.length > 0) {
    const headIdx = seatIdx(snap, swap.queue[0])
    const head = snap.seats[headIdx]
    const can =
      head.hand.length > 0 &&
      snap.seats.some((s, i) => i !== headIdx && s.hand.length > 0)
    if (can) break
    swap.queue.shift()
  }
  if (swap.queue.length === 0) snap.pending = null
  return snap
}

function applySobrasGive(
  snap: GameSnapshot,
  playerId: string,
  handIdx: number
): GameSnapshot {
  if (snap.turnStep !== 'give') throw new Error('nada a dar agora')
  const seat = snap.seats[snap.turnSeat]
  if (!seat || seat.id !== playerId) throw new Error('não é a sua vez')
  if (handIdx < 0 || handIdx >= seat.hand.length)
    throw new Error('carta inválida')
  const [card] = seat.hand.splice(handIdx, 1)
  snap.sobras.push(card)
  logEntry(snap, seat, 'sobras', card)
  finishTurn(snap)
  return snap
}

function finishTurn(snap: GameSnapshot): void {
  if (snap.seats.every((s) => s.tookThisRound)) {
    endRound(snap)
    return
  }
  if (snap.buffet.length === 0) {
    // Safety rail (unreachable with stock config): deck exhausted mid-round.
    endRound(snap)
    return
  }
  const n = snap.seats.length
  const dir = snap.modifiers.reversed ? -1 : 1
  const last = snap.modifiers.lastSeat
  const othersAllTook =
    last !== null && snap.seats.every((s, i) => i === last || s.tookThisRound)
  let i = snap.turnSeat
  do {
    i = (i + dir + n) % n
  } while (snap.seats[i].tookThisRound || (i === last && !othersAllTook))
  snap.turnSeat = i
  beginTurn(snap)
}

function endRound(snap: GameSnapshot): void {
  // Sobras públicas: leftovers flip face-up before carrying over, so next
  // round's carryover is common knowledge — the planning lever the sim showed
  // was missing (hidden carryover was dead information).
  snap.buffet.forEach((s) => (s.faceUp = true))
  if (snap.seats.every((s) => s.hand.length >= CONFIG.handSize)) {
    snap.phase = 'scored'
    return
  }
  if (snap.deck.length === 0 && snap.buffet.length === 0) {
    // Safety rail: nothing left to play with.
    snap.phase = 'scored'
    return
  }
  snap.round += 1
  snap.startSeat = (snap.startSeat + 1) % snap.seats.length
  snap.seats.forEach((s) => (s.tookThisRound = false))
  startRound(snap)
}
