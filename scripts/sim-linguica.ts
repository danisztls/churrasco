/**
 * Linguiça-curve balance experiment. Runs identical seeds under each candidate
 * linguicaCurve and reports what "is a linguiça build viable?" actually needs:
 *   - adoption:  do greedy bots collect more linguiça under the new curve?
 *   - payoff:    binned by final linguiça count, does committing win more?
 *   - runaway:   does the linguiça leader win disproportionately (safe build)?
 *   - specialist: a player leaning into linguiça vs 3 normal greedy — win rate.
 *
 * The deck is built from linguicaCopies (not the curve), so a given seed deals
 * the SAME cards across variants — only valuation/behaviour changes. CONFIG is
 * not frozen, so we swap CONFIG.linguicaCurve between variants in-process.
 *
 *   npx tsx scripts/sim-linguica.ts [games]
 */
import { botMove } from '../src/game/bot'
import { CONFIG } from '../src/game/config'
import { mulberry32 } from '../src/game/deck'
import { applyMove, legalMoves, newGame } from '../src/game/rules'
import { scoreGame, scoreHand } from '../src/game/scoring'
import type { Card, GameSnapshot, Move } from '../src/game/types'

type Policy = (s: GameSnapshot, id: string, r: () => number) => Move | null

const greedy: Policy = botMove

// A player who leans into linguiça: honest greedy valuation + a fixed affinity
// thumb on linguiça takes (mirrors the bebida placement proxy). The affinity is
// CONSTANT across variants, so any win-rate gap between variants is the curve's
// doing, not the thumb's.
const LINGUICA_AFFINITY = 1.5
const specialist: Policy = (snap, seatId, rand) => {
  const moves = legalMoves(snap, seatId)
  if (moves.length === 0) return null
  const seat = snap.seats.find((s) => s.id === seatId)!

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
    for (const m of withIdx)
      if (lossOf(m.handIdx) < lossOf(best.handIdx)) best = m
    return best
  }

  const gain = (card: Card): number => {
    const base =
      scoreHand([...seat.hand, card]).subtotal - scoreHand(seat.hand).subtotal
    if (card.kind === 'bebida') return base + 1.5
    if (card.kind === 'linguica') return base + LINGUICA_AFFINITY
    return base
  }
  const takes = moves.filter(
    (m): m is Move & { type: 'take' } => m.type === 'take'
  )
  const bestTake = takes.reduce((b, m) =>
    gain(snap.buffet[m.slot].card) > gain(snap.buffet[b.slot].card) ? m : b
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

// Maximal commitment: grab ANY face-up linguiça whenever a take is legal;
// otherwise play greedy. Isolates "if you DO stack 5-6, do you win?" from the
// acquisition friction the soft specialist hits.
const hoarder: Policy = (snap, seatId, rand) => {
  const moves = legalMoves(snap, seatId)
  if (moves.length === 0) return null
  const lingTake = moves.find(
    (m) => m.type === 'take' && snap.buffet[m.slot].card.kind === 'linguica'
  )
  if (lingTake) return lingTake
  return greedy(snap, seatId, rand)
}

function playGame(
  policies: Policy[],
  seed: number
): { totals: number[]; ling: number[] } {
  const players = policies.map((_, i) => ({ id: `p${i}`, name: `P${i}` }))
  let snap = newGame(players, seed, { events: true })
  const rand = mulberry32((seed ^ 0x9e3779b9) >>> 0)
  let guard = 8000
  while (snap.phase === 'playing' && guard-- > 0) {
    let actor = -1
    for (let i = 0; i < snap.seats.length; i++)
      if (legalMoves(snap, snap.seats[i].id).length > 0) {
        actor = i
        break
      }
    if (actor < 0) throw new Error('no actor with legal moves')
    const move = policies[actor](snap, `p${actor}`, rand)
    if (!move) throw new Error('policy returned null')
    snap = applyMove(snap, `p${actor}`, move)
  }
  if (snap.phase !== 'scored') throw new Error(`game did not finish (${seed})`)
  return {
    totals: scoreGame(snap.seats, snap.pratoClaims).map((s) => s.total),
    ling: snap.seats.map((s) => s.hand.filter((c) => c.kind === 'linguica').length)
  }
}

function winShares(totals: number[]): number[] {
  const max = Math.max(...totals)
  const winners = totals.filter((t) => t === max).length
  return totals.map((t) => (t === max ? 1 / winners : 0))
}
const pct = (x: number): string => `${(100 * x).toFixed(1)}%`
const mean = (xs: number[]): number =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0

const VARIANTS: { name: string; curve: number[] }[] = [
  { name: 'baseline    [0,1,3,6,7,8,9]        tail +1', curve: [0, 1, 3, 6, 7, 8, 9] },
  { name: 'opt1 flat   [0,1,3,6,8,10,12,14]   tail +2', curve: [0, 1, 3, 6, 8, 10, 12, 14] },
  { name: 'opt3 steep  [0,1,3,6,10,14,18,22]  tail +4', curve: [0, 1, 3, 6, 10, 14, 18, 22] },
  { name: 'opt4 stone  [0,1,3,6,8,20,23,26]   +12 @5th', curve: [0, 1, 3, 6, 8, 20, 23, 26] }
]

const GAMES = Number(process.argv[2] ?? 3000)
const N = 4
console.log(`4 players, ${GAMES} games/variant, parity = ${pct(1 / N)}\n`)

for (const v of VARIANTS) {
  CONFIG.linguicaCurve = v.curve

  // ---- E-A: 4 greedy, same curve. Adoption + payoff-by-commitment + runaway.
  const binWin = new Array(8).fill(0)
  const binCnt = new Array(8).fill(0)
  let sumLing = 0
  let nHands = 0
  let ge4 = 0
  const allTotals: number[] = []
  let leaderWin = 0
  let leaderGames = 0
  for (let g = 0; g < GAMES; g++) {
    const { totals, ling } = playGame([greedy, greedy, greedy, greedy], 5000 + g)
    const shares = winShares(totals)
    for (let i = 0; i < N; i++) {
      const c = Math.min(ling[i], 7)
      binWin[c] += shares[i]
      binCnt[c] += 1
      sumLing += ling[i]
      nHands++
      if (ling[i] >= 4) ge4++
      allTotals.push(totals[i])
    }
    const max = Math.max(...ling)
    if (ling.filter((x) => x === max).length === 1) {
      leaderGames++
      leaderWin += shares[ling.indexOf(max)]
    }
  }
  const groupWin = (lo: number, hi: number): { rate: number; n: number } => {
    let w = 0
    let n = 0
    for (let c = lo; c <= hi; c++) {
      w += binWin[c]
      n += binCnt[c]
    }
    return { rate: n ? w / n : 0, n }
  }

  // ---- E-B: one linguiça pursuer vs 3 greedy, hero seat rotates. Soft =
  // affinity thumb; hoard = grabs every linguiça (isolates payoff from
  // acquisition friction).
  const pursue = (pol: Policy, base: number) => {
    let win = 0
    let ling = 0
    let score = 0
    for (let g = 0; g < GAMES; g++) {
      const hero = g % N
      const policies = Array.from({ length: N }, (_, i) =>
        i === hero ? pol : greedy
      )
      const { totals, ling: lc } = playGame(policies, base + g)
      win += winShares(totals)[hero]
      ling += lc[hero]
      score += totals[hero]
    }
    return { win: win / GAMES, ling: ling / GAMES, score: score / GAMES }
  }
  const soft = pursue(specialist, 6000)
  const hoard = pursue(hoarder, 7000)

  console.log(`=== ${v.name}`)
  console.log(
    `  adoption (4 greedy): avg ${(sumLing / nHands).toFixed(2)} linguiça/hand, ` +
      `${pct(ge4 / nHands)} of hands hold >=4  | avg score ${mean(allTotals).toFixed(1)}`
  )
  const groups: [string, number, number][] = [
    ['0-1', 0, 1],
    ['  2', 2, 2],
    ['  3', 3, 3],
    ['  4', 4, 4],
    [' 5+', 5, 7]
  ]
  console.log(`  payoff by final linguiça count (win rate | # hands):`)
  for (const [label, lo, hi] of groups) {
    const { rate, n } = groupWin(lo, hi)
    console.log(`      ${label}: ${pct(rate).padStart(6)}  (${n})`)
  }
  console.log(
    `  runaway: linguiça leader win rate ${pct(leaderWin / leaderGames)} ` +
      `(over ${leaderGames} games w/ a unique leader)`
  )
  console.log(
    `  soft   pursuer vs 3 greedy: win ${pct(soft.win)}  ` +
      `avg ${soft.ling.toFixed(2)} linguiça, score ${soft.score.toFixed(1)}`
  )
  console.log(
    `  hoard  pursuer vs 3 greedy: win ${pct(hoard.win)}  ` +
      `avg ${hoard.ling.toFixed(2)} linguiça, score ${hoard.score.toFixed(1)}\n`
  )
}

// ---- E-C: SUPPLY sweep. Fix curve at flat +2 and vary linguicaCopies. Is the
// wall the reward curve, or the number of cards in the deck? If more copies let
// the hoarder actually reach 4-5 AND its win rate climbs, supply was the lever.
console.log(`\n--- supply sweep (curve fixed at flat +2 [0,1,3,6,8,10,12,14]) ---`)
CONFIG.linguicaCurve = [0, 1, 3, 6, 8, 10, 12, 14]
const baseCopies = CONFIG.linguicaCopies
for (const copies of [8, 12, 16, 20]) {
  CONFIG.linguicaCopies = copies
  let hWin = 0
  let hLing = 0
  let hScore = 0
  let hMax = 0
  for (let g = 0; g < GAMES; g++) {
    const hero = g % N
    const policies = Array.from({ length: N }, (_, i) =>
      i === hero ? hoarder : greedy
    )
    const { totals, ling } = playGame(policies, 8000 + g)
    hWin += winShares(totals)[hero]
    hLing += ling[hero]
    hScore += totals[hero]
    hMax = Math.max(hMax, ling[hero])
  }
  console.log(
    `  copies=${String(copies).padStart(2)}: hoarder win ${pct(hWin / GAMES)}  ` +
      `avg ${(hLing / GAMES).toFixed(2)} linguiça (max seen ${hMax}), ` +
      `score ${(hScore / GAMES).toFixed(1)}`
  )
}
CONFIG.linguicaCopies = baseCopies
