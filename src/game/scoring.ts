import { CONFIG } from './config'
import type { Card, HandScore, PlayerScore, PlayerSeat } from './types'

/**
 * Scores one hand, everything except the bebida placement (which needs all
 * players). Hand order matters: each pao-de-alho pairs with the FIRST corte
 * acquired after it that isn't already paired with an earlier pao (wasabi
 * semantics: one pao doubles one corte, no retroaction, no stacking).
 * Linguiça is not a corte and is never doubled.
 */
export function scoreHand(hand: Card[]): HandScore {
  let carne = 0
  let pao = 0
  let unboundPaes = 0
  let linguicaCount = 0
  let bebidaCount = 0
  const acompTypes = new Set<string>()

  for (const card of hand) {
    switch (card.kind) {
      case 'carne': {
        const value = CONFIG.cortePoints[card.corte]
        carne += value
        if (unboundPaes > 0) {
          pao += value
          unboundPaes -= 1
        }
        break
      }
      case 'pao-de-alho':
        unboundPaes += 1
        break
      case 'linguica':
        linguicaCount += 1
        break
      case 'bebida':
        bebidaCount += 1
        break
      case 'acomp':
        acompTypes.add(card.acomp)
        break
      case 'abacaxi':
        break
    }
  }

  const lCurve = CONFIG.linguicaCurve
  const linguica =
    linguicaCount < lCurve.length
      ? lCurve[linguicaCount]
      : lCurve[lCurve.length - 1] + (linguicaCount - (lCurve.length - 1))

  const aCurve = CONFIG.acompCurve
  const acomp = aCurve[Math.min(acompTypes.size, aCurve.length - 1)]

  const pratos = CONFIG.pratos
    .filter(
      (p) =>
        hand.some((c) => c.kind === 'carne' && c.corte === p.corte) &&
        hand.some((c) => c.kind === 'acomp' && c.acomp === p.acomp) &&
        hand.some((c) => c.kind === 'bebida' && c.bebida === p.bebida)
    )
    .map((p) => ({ name: p.name, bonus: p.bonus }))
  const pratosTotal = pratos.reduce((sum, p) => sum + p.bonus, 0)

  const bebidaFace = bebidaCount * CONFIG.bebidaFace
  const subtotal = carne + pao + linguica + acomp + bebidaFace + pratosTotal
  return {
    carne,
    pao,
    linguica,
    acomp,
    bebidaFace,
    pratos,
    pratosTotal,
    subtotal
  }
}

/**
 * Bebida placement: best counts earn bebidaPlacementBonus[0], [1], ...;
 * ties split the pooled bonuses of the positions they occupy (floored);
 * the fewest-bebidas group takes the full penalty each (no splitting) and
 * is excluded from bonuses. All players tied = wash.
 */
export function bebidaPlacements(counts: number[]): number[] {
  const result = counts.map(() => 0)
  if (counts.length === 0) return result
  const min = Math.min(...counts)
  const max = Math.max(...counts)
  if (min === max) return result // wash

  const ranked = counts
    .map((count, i) => ({ count, i }))
    .filter((e) => e.count > min)
    .sort((a, b) => b.count - a.count)

  let pos = 0
  while (pos < ranked.length) {
    const groupCount = ranked[pos].count
    const group = ranked.filter((e) => e.count === groupCount)
    const pool = CONFIG.bebidaPlacementBonus
      .slice(pos, pos + group.length)
      .reduce((sum, b) => sum + b, 0)
    const share = Math.floor(pool / group.length)
    group.forEach((e) => (result[e.i] = share))
    pos += group.length
  }
  counts.forEach((count, i) => {
    if (count === min) result[i] = CONFIG.bebidaLastPenalty
  })
  return result
}

export function scoreGame(seats: PlayerSeat[]): PlayerScore[] {
  const handScores = seats.map((s) => scoreHand(s.hand))
  const bebidaCounts = seats.map(
    (s) => s.hand.filter((c) => c.kind === 'bebida').length
  )
  const placements = bebidaPlacements(bebidaCounts)
  return seats.map((seat, i) => ({
    seatId: seat.id,
    name: seat.name,
    ...handScores[i],
    bebidaCount: bebidaCounts[i],
    bebidaPlacement: placements[i],
    total: handScores[i].subtotal + placements[i]
  }))
}
