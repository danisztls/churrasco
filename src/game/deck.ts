import { ACOMP_TYPES, BEBIDA_TYPES, CONFIG } from './config'
import type { Card, Corte } from './types'

/** Deterministic PRNG (mulberry32) so a game is reproducible from its seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Builds the full food deck (~68 cards) from CONFIG densities, unshuffled. */
export function buildDeck(): Card[] {
  const cards: Card[] = []
  let id = 0
  for (const [corte, copies] of Object.entries(CONFIG.corteCopies)) {
    for (let i = 0; i < copies; i++)
      cards.push({ id: id++, kind: 'carne', corte: corte as Corte })
  }
  for (let i = 0; i < CONFIG.bebidaCopies; i++)
    cards.push({
      id: id++,
      kind: 'bebida',
      bebida: BEBIDA_TYPES[i % BEBIDA_TYPES.length]
    })
  for (const acomp of ACOMP_TYPES) {
    for (let i = 0; i < CONFIG.acompCopiesPerType; i++)
      cards.push({ id: id++, kind: 'acomp', acomp })
  }
  for (let i = 0; i < CONFIG.linguicaCopies; i++)
    cards.push({ id: id++, kind: 'linguica' })
  for (let i = 0; i < CONFIG.paoDeAlhoCopies; i++)
    cards.push({ id: id++, kind: 'pao-de-alho' })
  for (let i = 0; i < CONFIG.abacaxiCopies; i++)
    cards.push({ id: id++, kind: 'abacaxi' })
  return cards
}

export function buildShuffledDeck(seed: number): Card[] {
  return shuffle(buildDeck(), mulberry32(seed))
}
