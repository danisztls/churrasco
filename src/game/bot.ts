import { legalMoves } from './rules'
import { scoreHand } from './scoring'
import type { Card, GameSnapshot, Move } from './types'

/**
 * Greedy bot policy, used for bot seats and as auto-pilot for disconnected
 * players. Pure given a rand() source; the host is the only caller.
 */

export const BOT_SEATS = [
  { id: 'bot-0', name: 'Tio da Brasa', color: '#f97316' },
  { id: 'bot-1', name: 'Dona Farofa', color: '#eab308' },
  { id: 'bot-2', name: 'Zé Gelada', color: '#0ea5e9' },
  { id: 'bot-3', name: 'Vizinho Folgado', color: '#22c55e' },
  { id: 'bot-4', name: 'Cunhado', color: '#a855f7' }
]

/** Points gained by adding a card (bebida gets a placement-race proxy). */
function gainOf(hand: Card[], card: Card): number {
  const base = scoreHand([...hand, card]).subtotal - scoreHand(hand).subtotal
  return card.kind === 'bebida' ? base + 1.5 : base
}

/** Points lost by removing hand[idx]. */
function lossOf(hand: Card[], idx: number): number {
  const rest = hand.filter((_, i) => i !== idx)
  return scoreHand(hand).subtotal - scoreHand(rest).subtotal
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

  // Event phases: shed the least valuable card (dir of a swap is arbitrary).
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
      if (lossOf(seat.hand, m.handIdx) < lossOf(seat.hand, best.handIdx))
        best = m
    }
    return best
  }

  const takes = moves.filter(
    (m): m is Move & { type: 'take' } => m.type === 'take'
  )
  const bestTake = takes.reduce((best, m) =>
    gainOf(seat.hand, snap.buffet[m.slot].card) >
    gainOf(seat.hand, snap.buffet[best.slot].card)
      ? m
      : best
  )
  const bestGain = gainOf(seat.hand, snap.buffet[bestTake.slot].card)

  // Abacaxi swap first when a strong card is open: it converts the dead slot
  // without spending the round's take.
  const abacaxis = moves.filter(
    (m): m is Move & { type: 'abacaxi' } => m.type === 'abacaxi'
  )
  if (abacaxis.length > 0) {
    const best = abacaxis.reduce((a, m) =>
      gainOf(seat.hand, snap.buffet[m.slot].card) >
      gainOf(seat.hand, snap.buffet[a.slot].card)
        ? m
        : a
    )
    if (gainOf(seat.hand, snap.buffet[best.slot].card) >= 2) return best
  }

  // Weak table + pass available: wait for a better cut (sometimes).
  const canPass = moves.some((m) => m.type === 'pass')
  if (canPass && bestGain <= 1 && rand() < 0.6) return { type: 'pass' }

  return bestTake
}
