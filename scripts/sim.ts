/**
 * Skill/luck measurement harness. Runs headless bot-vs-bot games on the pure
 * engine and prints win rates and score stats.
 *
 *   npx tsx scripts/sim.ts [games-per-experiment]
 *
 * Experiments (4 players each):
 *  E1  1 greedy vs 3 random-legal  -> how much exact valuation is worth
 *  E2  1 greedy+ vs 3 greedy       -> how much planning ABOVE greedy is worth
 *  E3  4 greedy, seat effect       -> does the round-1 start seat win more?
 *  E4  4 greedy, events on vs off  -> how much variance the events inject
 */
import { botMove } from '../src/game/bot'
import { CONFIG } from '../src/game/config'
import { mulberry32 } from '../src/game/deck'
import { applyMove, legalMoves, newGame } from '../src/game/rules'
import { bebidaPlacements, scoreGame, scoreHand } from '../src/game/scoring'
import type { Card, GameSnapshot, Move } from '../src/game/types'

type Policy = (
  snap: GameSnapshot,
  seatId: string,
  rand: () => number
) => Move | null

const randomPolicy: Policy = (snap, seatId, rand) => {
  const moves = legalMoves(snap, seatId)
  if (moves.length === 0) return null
  return moves[Math.floor(rand() * moves.length)]
}

const greedy: Policy = botMove

/** Greedy plus two planning upgrades: speculative pão value and the REAL
 * marginal bebida-placement delta (public info) instead of a flat +1.5. */
const greedyPlus: Policy = (snap, seatId, rand) => {
  const moves = legalMoves(snap, seatId)
  if (moves.length === 0) return null
  const seatIdx = snap.seats.findIndex((s) => s.id === seatId)
  const seat = snap.seats[seatIdx]

  const reveals = moves.filter((m) => m.type === 'reveal')
  if (reveals.length > 0) return reveals[Math.floor(rand() * reveals.length)]

  const handMoves = moves.filter(
    (m) =>
      m.type === 'event-discard' ||
      m.type === 'event-gift' ||
      m.type === 'event-give' ||
      m.type === 'event-swap'
  )
  if (handMoves.length > 0) {
    const lossOf = (idx: number) =>
      scoreHand(seat.hand).subtotal -
      scoreHand(seat.hand.filter((_, i) => i !== idx)).subtotal
    const withIdx = handMoves as (Move & { handIdx: number })[]
    let best = withIdx[0]
    for (const m of withIdx) {
      if (lossOf(m.handIdx) < lossOf(best.handIdx)) best = m
    }
    return best
  }

  const gain = (card: Card): number => {
    const base =
      scoreHand([...seat.hand, card]).subtotal - scoreHand(seat.hand).subtotal
    if (card.kind === 'bebida') {
      const counts = snap.seats.map(
        (s) => s.hand.filter((c) => c.kind === 'bebida').length
      )
      const before = bebidaPlacements(counts)[seatIdx]
      counts[seatIdx] += 1
      const after = bebidaPlacements(counts)[seatIdx]
      // Discounted: the race can still move before scoring.
      return base + Math.max(0, after - before) * 0.8
    }
    if (card.kind === 'pao-de-alho') {
      // Speculative doubling while there are picks left to land a corte.
      const picksLeft = CONFIG.handSize - seat.hand.length
      return base + (picksLeft >= 3 ? 2.5 : picksLeft === 2 ? 1.2 : 0)
    }
    return base
  }

  const takes = moves.filter(
    (m): m is Move & { type: 'take' } => m.type === 'take'
  )
  const bestTake = takes.reduce((best, m) =>
    gain(snap.buffet[m.slot].card) > gain(snap.buffet[best.slot].card)
      ? m
      : best
  )
  const bestGain = gain(snap.buffet[bestTake.slot].card)

  const abacaxis = moves.filter(
    (m): m is Move & { type: 'abacaxi' } => m.type === 'abacaxi'
  )
  if (abacaxis.length > 0) {
    const best = abacaxis.reduce((a, m) =>
      gain(snap.buffet[m.slot].card) > gain(snap.buffet[a.slot].card) ? m : a
    )
    if (gain(snap.buffet[best.slot].card) >= 2) return best
  }

  const canPass = moves.some((m) => m.type === 'pass')
  if (canPass && bestGain <= 1 && rand() < 0.6) return { type: 'pass' }
  return bestTake
}

function findActor(snap: GameSnapshot): number {
  for (let i = 0; i < snap.seats.length; i++) {
    if (legalMoves(snap, snap.seats[i].id).length > 0) return i
  }
  throw new Error('no actor with legal moves')
}

function playGame(
  policies: Policy[],
  seed: number,
  events: boolean
): { totals: number[]; startSeat: number } {
  const players = policies.map((_, i) => ({ id: `p${i}`, name: `P${i}` }))
  let snap = newGame(players, seed, { events })
  const startSeat = snap.startSeat
  const rand = mulberry32((seed ^ 0x9e3779b9) >>> 0)
  let guard = 8000
  while (snap.phase === 'playing' && guard-- > 0) {
    const actor = findActor(snap)
    const move = policies[actor](snap, `p${actor}`, rand)
    if (!move) throw new Error('policy returned null for the actor')
    snap = applyMove(snap, `p${actor}`, move)
  }
  if (snap.phase !== 'scored')
    throw new Error(`game did not finish (seed ${seed})`)
  return { totals: scoreGame(snap.seats).map((s) => s.total), startSeat }
}

/** Fractional wins (ties split). */
function winShares(totals: number[]): number[] {
  const max = Math.max(...totals)
  const winners = totals.filter((t) => t === max).length
  return totals.map((t) => (t === max ? 1 / winners : 0))
}

const N_PLAYERS = 4
const GAMES = Number(process.argv[2] ?? 1000)

function pct(x: number): string {
  return `${(100 * x).toFixed(1)}%`
}
function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}
function std(xs: number[]): number {
  const m = mean(xs)
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)))
}

// E1: 1 greedy vs 3 random (greedy's seat rotates to cancel seat effects)
{
  let wins = 0
  const gScores: number[] = []
  const rScores: number[] = []
  for (let g = 0; g < GAMES; g++) {
    const hero = g % N_PLAYERS
    const policies = Array.from({ length: N_PLAYERS }, (_, i) =>
      i === hero ? greedy : randomPolicy
    )
    const { totals } = playGame(policies, 1000 + g, true)
    wins += winShares(totals)[hero]
    gScores.push(totals[hero])
    totals.forEach((t, i) => i !== hero && rScores.push(t))
  }
  console.log(`E1  greedy vs 3 random   (${GAMES} games, parity 25%)`)
  console.log(`    greedy win rate: ${pct(wins / GAMES)}`)
  console.log(
    `    avg score  greedy ${mean(gScores).toFixed(1)}  random ${mean(rScores).toFixed(1)}\n`
  )
}

// E2: 1 greedy+ vs 3 greedy
{
  let wins = 0
  const pScores: number[] = []
  const gScores: number[] = []
  for (let g = 0; g < GAMES; g++) {
    const hero = g % N_PLAYERS
    const policies = Array.from({ length: N_PLAYERS }, (_, i) =>
      i === hero ? greedyPlus : greedy
    )
    const { totals } = playGame(policies, 2000 + g, true)
    wins += winShares(totals)[hero]
    pScores.push(totals[hero])
    totals.forEach((t, i) => i !== hero && gScores.push(t))
  }
  console.log(`E2  greedy+ vs 3 greedy  (${GAMES} games, parity 25%)`)
  console.log(`    greedy+ win rate: ${pct(wins / GAMES)}`)
  console.log(
    `    avg score  greedy+ ${mean(pScores).toFixed(1)}  greedy ${mean(gScores).toFixed(1)}\n`
  )
}

// E3: 4 greedy — advantage by seat relative to the round-1 start seat
{
  const winsByRel = [0, 0, 0, 0]
  const scoreByRel: number[][] = [[], [], [], []]
  for (let g = 0; g < GAMES; g++) {
    const { totals, startSeat } = playGame(
      [greedy, greedy, greedy, greedy],
      3000 + g,
      true
    )
    const shares = winShares(totals)
    for (let i = 0; i < N_PLAYERS; i++) {
      const rel = (i - startSeat + N_PLAYERS) % N_PLAYERS
      winsByRel[rel] += shares[i]
      scoreByRel[rel].push(totals[i])
    }
  }
  console.log(`E3  4x greedy, by seat relative to round-1 starter (parity 25%)`)
  winsByRel.forEach((w, rel) =>
    console.log(
      `    rel seat ${rel}: win ${pct(w / GAMES)}  avg ${mean(scoreByRel[rel]).toFixed(1)}`
    )
  )
  console.log('')
}

// E4: 4 greedy — margin/variance with events on vs off
for (const events of [true, false]) {
  const margins: number[] = []
  const spreads: number[] = []
  let close = 0
  for (let g = 0; g < GAMES; g++) {
    const { totals } = playGame(
      [greedy, greedy, greedy, greedy],
      4000 + g,
      events
    )
    const sorted = [...totals].sort((a, b) => b - a)
    margins.push(sorted[0] - sorted[1])
    spreads.push(std(totals))
    if (sorted[0] - sorted[1] <= 2) close++
  }
  console.log(
    `E4  4x greedy, events ${events ? 'ON ' : 'OFF'}: ` +
      `1st-2nd margin avg ${mean(margins).toFixed(2)} ` +
      `(±${std(margins).toFixed(2)}), close(<=2pt) ${pct(close / GAMES)}, ` +
      `per-game score std ${mean(spreads).toFixed(2)}`
  )
}
