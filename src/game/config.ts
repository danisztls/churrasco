import type {
  Acomp,
  Bebida,
  Corte,
  PratoReq,
  PratoSpec,
  RoundModifiers
} from './types'

// Recipe shorthands for the pratos table below.
const carne = (corte: Corte): PratoReq => ({ kind: 'carne', corte })
const acomp = (a: Acomp): PratoReq => ({ kind: 'acomp', acomp: a })
const bebida = (b: Bebida): PratoReq => ({ kind: 'bebida', bebida: b })
const linguica: PratoReq = { kind: 'linguica' }
const pao: PratoReq = { kind: 'pao-de-alho' }

/**
 * Every balance lever in one place. Values are the "1ª passada" from the design
 * doc (~/Docs/dev/game/churrasco/_index.md) — playtesting adjusts them here.
 */
export const CONFIG = {
  minPlayers: 3,
  maxPlayers: 6,
  /** Game ends when every hand reaches this size. */
  handSize: 7,
  /**
   * Buffet slots per round as a function of player count (event deltas add on
   * top). M = N * 2 since the luck findings (sim showed the core draft, not
   * events, carries the variance — wider choice adds agency). The doc's
   * original was (n) => n + 2.
   */
  buffetSlots: (n: number): number => n * 2,
  /** Cards already face-up at round start (carryover feeds this from round 2). */
  faceUpAtStart: 2,
  /**
   * Anti-stall house rule (digital-only): pass and abacaxi-swap are legal only
   * while at least one face-down card remains. On a physical table social
   * pressure ends the round; online this guarantees termination.
   */
  antiStallPass: true,
  /** Event cards from round 2 on (one per round, no repeats per game). */
  eventsEnabled: true,

  /** Face value per corte (pirâmide invertida: raro = alto). */
  cortePoints: {
    picanha: 5,
    costela: 4,
    fraldinha: 3,
    coracao: 2,
    'coxao-duro': 1
  } as Record<Corte, number>,

  /** Copies of each corte in the deck. */
  corteCopies: {
    picanha: 3,
    costela: 4,
    fraldinha: 5,
    coracao: 5,
    'coxao-duro': 6
  } as Record<Corte, number>,

  /** Cumulative linguiça points by count (index = count). Beyond: +1 each. */
  linguicaCurve: [0, 1, 3, 6, 7, 8, 9],
  linguicaCopies: 8,

  /**
   * Cumulative acompanhamento points by DISTINCT type count (index = count).
   * The doc's table stops at 6 distinct; 7 distinct (possible in a 7-card
   * hand) clamps to the last value.
   */
  acompCurve: [0, 1, 3, 7, 12, 18, 25],
  acompCopiesPerType: 2,

  /** Face value of each bebida card. */
  bebidaFace: 1,
  bebidaCopies: 12,
  /**
   * End-game placement bonuses, best count first: 1º +8, 2º +4.
   * With 5-6 players the doc suggests optionally stretching to 3º +2 —
   * append a 2 here to enable it.
   */
  bebidaPlacementBonus: [8, 4],
  /** Penalty for the fewest bebidas (each tied player takes it in full). */
  bebidaLastPenalty: -4,

  paoDeAlhoCopies: 5,
  abacaxiCopies: 4,

  /**
   * Pratos (combos): having every card of the recipe in hand => bonus, on top
   * of what each card already scores (non-exclusive: one card may serve
   * several pratos). The first 5 are the doc's "1ª passada" triples; the last
   * 3 are digital-playtest additions with varied shapes and no bebida (they
   * give the orphan acomps an identity without deepening the bebida race).
   */
  pratos: [
    {
      name: 'Prato Raiz',
      reqs: [carne('picanha'), acomp('farofa'), bebida('cerveja')],
      bonus: 8
    },
    {
      name: 'Mineiro da Gema',
      reqs: [carne('costela'), acomp('feijao-tropeiro'), bebida('caipirinha')],
      bonus: 6
    },
    {
      name: 'Domingo em Família',
      reqs: [carne('fraldinha'), acomp('arroz'), bebida('suco')],
      bonus: 5
    },
    {
      name: 'Espetinho de Esquina',
      reqs: [carne('coracao'), acomp('vinagrete'), bebida('guarana')],
      bonus: 5
    },
    {
      name: 'Fitness de Mentira',
      reqs: [carne('coxao-duro'), acomp('salada'), bebida('suco')],
      bonus: 3
    },
    {
      name: 'Espetinho de Boteco',
      reqs: [acomp('queijo-coalho'), linguica, pao],
      bonus: 4
    },
    {
      name: 'Vaca Atolada',
      reqs: [carne('costela'), acomp('mandioca')],
      bonus: 3
    },
    {
      name: 'Churrasco de Laje',
      reqs: [carne('coxao-duro'), acomp('maionese')],
      bonus: 3
    }
  ] as PratoSpec[]
}

export const ACOMP_TYPES: Acomp[] = [
  'vinagrete',
  'arroz',
  'feijao-tropeiro',
  'queijo-coalho',
  'farofa',
  'maionese',
  'mandioca',
  'salada'
]

export const BEBIDA_TYPES: Bebida[] = [
  'cerveja',
  'guarana',
  'suco',
  'caipirinha'
]

export const DEFAULT_MODIFIERS: RoundModifiers = {
  buffetDelta: 0,
  passAllowed: true,
  revealAll: false,
  reversed: false,
  openHands: false,
  forcedTake: false,
  takeToNeighbor: false,
  sobrasGive: false,
  lastSeat: null
}
