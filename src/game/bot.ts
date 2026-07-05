import { BEBIDA_TYPES, CONFIG } from './config'
import { legalMoves } from './rules'
import { matchesPratoReq, scoreHand } from './scoring'
import type { Card, GameSnapshot, Move, PratoReq } from './types'

/**
 * Greedy bot policy, used for bot seats and as auto-pilot for disconnected
 * players. Pure given a rand() source; the host is the only caller.
 *
 * On top of the raw score delta, the bot values PRATO PURSUIT: pieces of a
 * started-but-unfinished combo carry the bonus weighted by the chance of
 * completing it (see pratoPotential).
 */

export const BOT_SEATS = [
  { id: 'bot-0', name: 'Tio da Brasa', color: '#f97316' },
  { id: 'bot-1', name: 'Dona Farofa', color: '#eab308' },
  { id: 'bot-2', name: 'Zé Gelada', color: '#0ea5e9' },
  { id: 'bot-3', name: 'Vizinho Folgado', color: '#22c55e' },
  { id: 'bot-4', name: 'Cunhado', color: '#a855f7' }
]

/** Pursuit knobs: chance that ONE unseen copy of a needed card reaches this
 * bot in time, and a flat discount for opportunity cost / rival theft. */
// Measured (scripts/sim.ts E2): mild pursuit is win-rate NEUTRAL vs the
// legacy greedy; aggressive weights (0.4 / 1.0) are actively worse (19.4%
// win rate) — chasing potential trades real points for pieces that rarely
// arrive. Kept mild: combo-aware behavior at zero cost, and the knobs are
// ready to re-measure if a design change ever makes pursuit pay.
const PRATO_COPY_CHANCE = 0.3
const PRATO_DISCOUNT = 0.6

function reqCopies(req: PratoReq): number {
  switch (req.kind) {
    case 'carne':
      return CONFIG.corteCopies[req.corte]
    case 'acomp':
      return CONFIG.acompCopiesPerType
    case 'bebida':
      return CONFIG.bebidaCopies / BEBIDA_TYPES.length
    case 'linguica':
      return CONFIG.linguicaCopies
    case 'pao-de-alho':
      return CONFIG.paoDeAlhoCopies
  }
}

/**
 * Expected bonus of pratos STARTED but unfinished: bonus times the product
 * of per-missing-piece arrival chances, discounted. A piece lying face-up on
 * the buffet nearly guarantees its factor; copies visibly gone (discard)
 * shrink it; a dead piece kills the prato's term.
 */
/** Names already claimed in the race — dead for pursuit AND for hand value
 * (a rival's claim never pays; an own claim is banked, so it is a constant
 * that only muddies the deltas). */
function claimedNames(snap: GameSnapshot): Set<string> {
  return new Set((snap.pratoClaims ?? []).map((c) => c.name))
}

function pratoPotential(snap: GameSnapshot, hand: Card[]): number {
  const picksLeft = CONFIG.handSize - hand.length
  if (picksLeft <= 0) return 0
  const claimed = claimedNames(snap)
  let sum = 0
  for (const p of CONFIG.pratos) {
    if (claimed.has(p.name)) continue
    const missing = p.reqs.filter(
      (r) => !hand.some((c) => matchesPratoReq(c, r))
    )
    if (missing.length === 0 || missing.length === p.reqs.length) continue
    if (missing.length > picksLeft) continue
    let prob = 1
    for (const req of missing) {
      if (snap.buffet.some((s) => s.faceUp && matchesPratoReq(s.card, req))) {
        prob *= 0.8 // it's on the table right now
        continue
      }
      const gone = snap.discard.filter((c) => matchesPratoReq(c, req)).length
      const copies = reqCopies(req) - gone
      if (copies <= 0) {
        prob = 0
        break
      }
      prob *= 1 - Math.pow(1 - PRATO_COPY_CHANCE, copies)
    }
    sum += p.bonus * prob * PRATO_DISCOUNT
  }
  return sum
}

/** The hand value the bot optimizes: realized points + pursuit potential.
 * Claimed pratos are excluded from scoreHand — completing a recipe someone
 * already claimed is worth nothing. */
function valueOf(snap: GameSnapshot, hand: Card[]): number {
  return (
    scoreHand(hand, claimedNames(snap)).subtotal + pratoPotential(snap, hand)
  )
}

/** Points gained by adding a card (bebida gets a placement-race proxy). */
function gainOf(snap: GameSnapshot, hand: Card[], card: Card): number {
  const base = valueOf(snap, [...hand, card]) - valueOf(snap, hand)
  return card.kind === 'bebida' ? base + 1.5 : base
}

/** Points lost by removing hand[idx]. */
function lossOf(snap: GameSnapshot, hand: Card[], idx: number): number {
  const rest = hand.filter((_, i) => i !== idx)
  return valueOf(snap, hand) - valueOf(snap, rest)
}

export function botMove(
  snap: GameSnapshot,
  seatId: string,
  rand: () => number
): Move | null {
  const moves = legalMoves(snap, seatId)
  if (moves.length === 0) return null
  const seat = snap.seats.find((s) => s.id === seatId)!
  const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]

  // Only Depois Acaba still offers a reveal move (flip-and-take).
  const reveals = moves.filter((m) => m.type === 'reveal')
  if (reveals.length > 0) return pick(reveals)

  // Event phases: shed the least valuable card (swap target is arbitrary).
  const handMoves = moves.filter(
    (m) =>
      m.type === 'event-discard' ||
      m.type === 'event-gift' ||
      m.type === 'event-give' ||
      m.type === 'event-swap'
  )
  if (handMoves.length > 0) {
    const withIdx = handMoves as (Move & { handIdx: number })[]
    let best = withIdx[0]
    for (const m of withIdx) {
      if (
        lossOf(snap, seat.hand, m.handIdx) <
        lossOf(snap, seat.hand, best.handIdx)
      )
        best = m
    }
    return best
  }

  const takes = moves.filter(
    (m): m is Move & { type: 'take' } => m.type === 'take'
  )
  const bestTake = takes.reduce((best, m) =>
    gainOf(snap, seat.hand, snap.buffet[m.slot].card) >
    gainOf(snap, seat.hand, snap.buffet[best.slot].card)
      ? m
      : best
  )
  const bestGain = gainOf(snap, seat.hand, snap.buffet[bestTake.slot].card)

  // Abacaxi swap first when a strong card is open: it converts the dead slot
  // without spending the round's take.
  const abacaxis = moves.filter(
    (m): m is Move & { type: 'abacaxi' } => m.type === 'abacaxi'
  )
  if (abacaxis.length > 0) {
    const best = abacaxis.reduce((a, m) =>
      gainOf(snap, seat.hand, snap.buffet[m.slot].card) >
      gainOf(snap, seat.hand, snap.buffet[a.slot].card)
        ? m
        : a
    )
    if (gainOf(snap, seat.hand, snap.buffet[best.slot].card) >= 2) return best
  }

  // Weak table + pass available: wait for a better cut (sometimes).
  const canPass = moves.some((m) => m.type === 'pass')
  if (canPass && bestGain <= 1 && rand() < 0.6) return { type: 'pass' }

  return bestTake
}
