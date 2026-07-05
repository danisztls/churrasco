/**
 * Player-count scaling harness. Answers "does the game hold up at 7 players?"
 * by sweeping N and measuring the four things the design doc (DOCS.md) predicts
 * degrade as N grows — so the 3-6 → 3-7 decision rests on numbers, not vibes:
 *
 *   1. Deck health  — does the 68-card food deck seat N hands of handSize? If
 *      the deck runs dry the game ends SHORT via the exhaustion rail in
 *      rules.ts (finishTurn/endRound), silently breaking every scoring
 *      assumption. This is the hard ceiling; everything else is moot if it fails.
 *   2. Score inflation — mean total & winning score as the buffet (M = 2N)
 *      widens. Balloons = the abundance lever is over-feeding.
 *   3. Gelada spread — the bebida placement is [8,4] podium + last −2. With
 *      many players the middle of the table scores 0 on the game's interaction
 *      axis. We report that "dead middle" under the current podium vs a
 *      stretched [8,4,2] one, to size the fix.
 *   4. Pass value — a greedy that CAN pass vs greedies that CANNOT, all else
 *      equal. Win rate over parity (1/N) is the cash value of opcionalidade —
 *      the signature mechanic, and the doc's #1 playtest risk at 5-6 ("passar
 *      pode ser dominado"). If it trends to/below parity as N grows, the core
 *      is eroding.
 *
 *   npx tsx scripts/sim-players.ts [games-per-cell]
 */
import { botMove } from '../src/game/bot'
import { mulberry32 } from '../src/game/deck'
import { applyMove, legalMoves, newGame } from '../src/game/rules'
import { scoreGame, scoreHand } from '../src/game/scoring'
import { CONFIG } from '../src/game/config'
import type { Card, GameSnapshot, Move } from '../src/game/types'

type Policy = (
  snap: GameSnapshot,
  seatId: string,
  rand: () => number
) => Move | null

const greedy: Policy = botMove

/**
 * Greedy with the pass option removed: identical to botMove except that when
 * the bot would pass, it instead takes its best face-up card. The take it falls
 * back to is the same bestTake the bot already computed (it only passes when
 * bestGain <= 1), so this isolates the VALUE OF THE PASS OPTION and nothing else.
 */
const greedyNoPass: Policy = (snap, seatId, rand) => {
  const move = botMove(snap, seatId, rand)
  if (!move || move.type !== 'pass') return move
  const seat = snap.seats.find((s) => s.id === seatId)!
  const claimed = new Set((snap.pratoClaims ?? []).map((c) => c.name))
  const gain = (card: Card): number => {
    const base =
      scoreHand([...seat.hand, card], claimed).subtotal -
      scoreHand(seat.hand, claimed).subtotal
    return card.kind === 'bebida' ? base + 1.5 : base
  }
  const takes = legalMoves(snap, seatId).filter(
    (m): m is Move & { type: 'take' } => m.type === 'take'
  )
  if (takes.length === 0) return move // nothing to take (shouldn't happen)
  return takes.reduce((best, m) =>
    gain(snap.buffet[m.slot].card) > gain(snap.buffet[best.slot].card) ? m : best
  )
}

function findActor(snap: GameSnapshot): number {
  for (let i = 0; i < snap.seats.length; i++) {
    if (legalMoves(snap, snap.seats[i].id).length > 0) return i
  }
  throw new Error('no actor with legal moves')
}

type GameResult = {
  totals: number[]
  bebidaCounts: number[]
  handLens: number[]
  rounds: number
  passes: number // times any seat chose to pass
}

function playGame(
  policies: Policy[],
  seed: number,
  events: boolean
): GameResult {
  const players = policies.map((_, i) => ({ id: `p${i}`, name: `P${i}` }))
  let snap = newGame(players, seed, { events })
  const rand = mulberry32((seed ^ 0x9e3779b9) >>> 0)
  let passes = 0
  let guard = 50000
  while (snap.phase === 'playing' && guard-- > 0) {
    const actor = findActor(snap)
    const move = policies[actor](snap, `p${actor}`, rand)
    if (!move) throw new Error('policy returned null for the actor')
    if (move.type === 'pass') passes++
    snap = applyMove(snap, `p${actor}`, move)
  }
  if (snap.phase !== 'scored')
    throw new Error(`game did not finish (N=${policies.length}, seed ${seed})`)
  const scores = scoreGame(snap.seats, snap.pratoClaims)
  return {
    totals: scores.map((s) => s.total),
    bebidaCounts: scores.map((s) => s.bebidaCount),
    handLens: snap.seats.map((s) => s.hand.length),
    rounds: snap.round,
    passes
  }
}

/** Placement scorer parametrized by podium (mirrors scoring.bebidaPlacements,
 * which is hard-wired to CONFIG). Lets us A/B the podium without touching config. */
function placementsWith(
  counts: number[],
  bonus: number[],
  lastPenalty: number
): number[] {
  const result = counts.map(() => 0)
  if (counts.length === 0) return result
  const min = Math.min(...counts)
  const max = Math.max(...counts)
  if (min === max) return result
  const ranked = counts
    .map((count, i) => ({ count, i }))
    .filter((e) => e.count > min)
    .sort((a, b) => b.count - a.count)
  let pos = 0
  while (pos < ranked.length) {
    const groupCount = ranked[pos].count
    const group = ranked.filter((e) => e.count === groupCount)
    const pool = bonus.slice(pos, pos + group.length).reduce((s, b) => s + b, 0)
    const share = Math.floor(pool / group.length)
    group.forEach((e) => (result[e.i] = share))
    pos += group.length
  }
  counts.forEach((count, i) => {
    if (count === min) result[i] = lastPenalty
  })
  return result
}

const GAMES = Number(process.argv[2] ?? 2000)
const SWEEP = [3, 4, 5, 6, 7]

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}
function pct(x: number): string {
  return `${(100 * x).toFixed(1)}%`
}

// A/B podiums for the gelada dead-middle metric.
const PODIUM_NOW = CONFIG.bebidaPlacementBonus // [8, 4]
const PODIUM_STRETCH = [8, 4, 2]
const LAST = CONFIG.bebidaLastPenalty

const DECK_SIZE =
  Object.values(CONFIG.corteCopies).reduce((a, b) => a + b, 0) +
  CONFIG.bebidaCopies +
  8 * CONFIG.acompCopiesPerType +
  CONFIG.linguicaCopies +
  CONFIG.paoDeAlhoCopies +
  CONFIG.abacaxiCopies
console.log(
  `Churrasco player-count sweep — ${GAMES} games/cell\n` +
    `deck: ${DECK_SIZE} food cards, handSize ${CONFIG.handSize}, buffet M=2N\n`
)

// ── 1-3. Deck health, score inflation, gelada spread (all-greedy, events ON) ──
console.log('all-greedy tables, events ON:')
console.log(
  '  N   deckOK   short   avgTot  topTot  rounds   dead-mid[8,4]  dead-mid[8,4,2]  gelSwing'
)
for (const n of SWEEP) {
  const policies = Array.from({ length: n }, () => greedy)
  let healthy = 0
  let minHandSum = 0
  const totals: number[] = []
  const tops: number[] = []
  const rounds: number[] = []
  let deadNow = 0
  let deadStretch = 0
  let swingSum = 0
  for (let g = 0; g < GAMES; g++) {
    const r = playGame(policies, 10000 + g, true)
    const minHand = Math.min(...r.handLens)
    if (minHand >= CONFIG.handSize) healthy++
    minHandSum += minHand
    totals.push(...r.totals)
    tops.push(Math.max(...r.totals))
    rounds.push(r.rounds)
    const pNow = placementsWith(r.bebidaCounts, PODIUM_NOW, LAST)
    const pStr = placementsWith(r.bebidaCounts, PODIUM_STRETCH, LAST)
    deadNow += pNow.filter((x) => x === 0).length / n
    deadStretch += pStr.filter((x) => x === 0).length / n
    swingSum += Math.max(...pNow) - Math.min(...pNow)
  }
  console.log(
    `  ${n}   ${pct(healthy / GAMES).padStart(6)}  ${pct(1 - healthy / GAMES).padStart(6)}   ` +
      `${mean(totals).toFixed(1).padStart(5)}  ${mean(tops).toFixed(1).padStart(5)}  ` +
      `${mean(rounds).toFixed(2).padStart(5)}   ${pct(deadNow / GAMES).padStart(11)}  ${pct(deadStretch / GAMES).padStart(13)}  ${(swingSum / GAMES).toFixed(1).padStart(6)}`
  )
}

// deck health with events OFF, to attribute any exhaustion to events vs base draw
console.log('\nall-greedy tables, events OFF (isolates base draw pressure):')
console.log('  N   deckOK   short   minHand-avg')
for (const n of SWEEP) {
  const policies = Array.from({ length: n }, () => greedy)
  let healthy = 0
  let minHandSum = 0
  for (let g = 0; g < GAMES; g++) {
    const r = playGame(policies, 20000 + g, false)
    const minHand = Math.min(...r.handLens)
    if (minHand >= CONFIG.handSize) healthy++
    minHandSum += minHand
  }
  console.log(
    `  ${n}   ${pct(healthy / GAMES).padStart(6)}  ${pct(1 - healthy / GAMES).padStart(6)}   ${(minHandSum / GAMES).toFixed(2)}`
  )
}

// ── 4. Pass value: 1 greedy (can pass) vs N-1 greedyNoPass, hero rotates ──
console.log('\npass value — greedy(can pass) vs N-1 greedyNoPass, events ON:')
console.log('  N   parity   heroWin   edge(win-parity)   passes/game')
for (const n of SWEEP) {
  const parity = 1 / n
  let wins = 0
  let passSum = 0
  for (let g = 0; g < GAMES; g++) {
    const hero = g % n
    const policies = Array.from({ length: n }, (_, i) =>
      i === hero ? greedy : greedyNoPass
    )
    const r = playGame(policies, 30000 + g, true)
    const max = Math.max(...r.totals)
    const winners = r.totals.filter((t) => t === max).length
    if (r.totals[hero] === max) wins += 1 / winners
    passSum += r.passes
  }
  const heroWin = wins / GAMES
  console.log(
    `  ${n}   ${pct(parity).padStart(6)}   ${pct(heroWin).padStart(6)}   ${(heroWin - parity >= 0 ? '+' : '') + pct(heroWin - parity)}   ${(passSum / GAMES).toFixed(2)}`
  )
}
