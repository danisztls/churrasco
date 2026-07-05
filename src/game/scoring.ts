import { CONFIG } from './config'
import type {
  Card,
  HandScore,
  PlayerScore,
  PlayerSeat,
  PratoClaim,
  PratoReq
} from './types'

/** Does this card satisfy one prato-recipe requirement? */
export function matchesPratoReq(card: Card, req: PratoReq): boolean {
  switch (req.kind) {
    case 'carne':
      return card.kind === 'carne' && card.corte === req.corte
    case 'acomp':
      return card.kind === 'acomp' && card.acomp === req.acomp
    case 'bebida':
      return card.kind === 'bebida' && card.bebida === req.bebida
    case 'linguica':
    case 'pao-de-alho':
      return card.kind === req.kind
  }
}

/**
 * Scores one hand, everything except the bebida placement (which needs all
 * players). Hand order matters: each pao-de-alho pairs with the FIRST corte
 * acquired after it that isn't already paired with an earlier pao (wasabi
 * semantics: one pao doubles one corte, no retroaction, no stacking).
 * Linguiça is not a corte and is never doubled.
 *
 * Pratos here mean "recipe satisfied by this hand" — the potential view.
 * Under race rules the REAL prato points come from claims (see scoreSeat);
 * `excludePratos` lets callers drop names already claimed (or all of them).
 */
export function scoreHand(
  hand: Card[],
  excludePratos?: ReadonlySet<string>
): HandScore {
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
    .filter((p) => !excludePratos?.has(p.name))
    .filter((p) =>
      p.reqs.every((req) => hand.some((c) => matchesPratoReq(c, req)))
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
 * Per-card point allocation for UI badges: face values on cortes/bebidas,
 * the doubling credited to the pao-de-alho card, curve INCREMENTS on each
 * linguiça/new acomp type. Sums to scoreHand().subtotal minus pratos
 * (pratos are hand-level bonuses, not per-card).
 */
export function cardContributions(hand: Card[]): number[] {
  const out = hand.map(() => 0)
  const lCurve = CONFIG.linguicaCurve
  const aCurve = CONFIG.acompCurve
  let linguicaCount = 0
  const seenAcomps = new Set<string>()
  const unboundPaes: number[] = []
  hand.forEach((card, i) => {
    switch (card.kind) {
      case 'carne': {
        const value = CONFIG.cortePoints[card.corte]
        out[i] = value
        const pao = unboundPaes.shift()
        if (pao !== undefined) out[pao] = value
        break
      }
      case 'pao-de-alho':
        unboundPaes.push(i)
        break
      case 'linguica':
        linguicaCount += 1
        out[i] =
          linguicaCount < lCurve.length
            ? lCurve[linguicaCount] - lCurve[linguicaCount - 1]
            : 1
        break
      case 'acomp':
        if (!seenAcomps.has(card.acomp)) {
          seenAcomps.add(card.acomp)
          const d = seenAcomps.size
          out[i] = d < aCurve.length ? aCurve[d] - aCurve[d - 1] : 0
        }
        break
      case 'bebida':
        out[i] = CONFIG.bebidaFace
        break
      case 'abacaxi':
        break
    }
  })
  return out
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

const ALL_PRATO_NAMES: ReadonlySet<string> = new Set(
  CONFIG.pratos.map((p) => p.name)
)

/**
 * Hand score under race rules: prato points come from the seat's CLAIMS
 * (first to complete keeps it, even if the hand later loses a piece), never
 * from current hand contents.
 */
export function scoreSeat(seat: PlayerSeat, claims: PratoClaim[]): HandScore {
  const base = scoreHand(seat.hand, ALL_PRATO_NAMES)
  const pratos = claims
    .filter((c) => c.seat === seat.id)
    .map((c) => ({
      name: c.name,
      bonus: CONFIG.pratos.find((p) => p.name === c.name)?.bonus ?? 0
    }))
  const pratosTotal = pratos.reduce((sum, p) => sum + p.bonus, 0)
  return {
    ...base,
    pratos,
    pratosTotal,
    subtotal: base.subtotal + pratosTotal
  }
}

export function scoreGame(
  seats: PlayerSeat[],
  claims: PratoClaim[]
): PlayerScore[] {
  const handScores = seats.map((s) => scoreSeat(s, claims))
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
