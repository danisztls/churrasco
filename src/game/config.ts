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
  maxPlayers: 7,
  /** Game ends when every hand reaches this size. */
  handSize: 7,
  /**
   * Buffet slots per round as a function of player count (event deltas add on
   * top). M = N * 2 since the luck findings (sim showed the core draft, not
   * events, carries the variance — wider choice adds agency). The doc's
   * original was (n) => n + 2.
   */
  buffetSlots: (n: number): number => n * 2,
  /**
   * Cards flipped face-up on a FRESH deal (round 1, or post-Rex). From round
   * 2 the carryover arrives already face-up — sobras públicas, see endRound.
   */
  faceUpAtStart: 2,
  /**
   * Anti-stall house rule (digital-only): pass and abacaxi-swap are legal only
   * while at least one face-down card remains. On a physical table social
   * pressure ends the round; online this guarantees termination.
   */
  antiStallPass: true,
  /** Event cards from round 2 on (one per round, no repeats per game). */
  eventsEnabled: true,
  /**
   * Copies of the neutral "Só resenha" (no-event) card in the event deck.
   * A different event EVERY round felt like too much — with 6 copies over
   * 13 real events, ~1/3 of the drawn rounds come up quiet. 0 restores an
   * event every round.
   */
  neutralEventCopies: 6,
  /**
   * Default seconds a connected player gets before the table plays for them.
   * The host can override this per game in the lobby (TURN_TIMEOUT_OPTIONS);
   * the chosen value rides along in the snapshot, so this is only the fallback.
   */
  turnTimeoutSec: 30,

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
   * End-game placement bonuses, best count first: 1º +8, 2º +4, 3º +2.
   * The 3rd slot only pays when there are ≥3 players above the minimum, so it
   * is inert at 3 players and kicks in from 4 up — the sim (sim-players.ts)
   * showed the bebida axis going mushy as N grows (29% of seats scored 0 at
   * N=7 under a bare [8,4]); the 3º +2 halves that dead middle at 4-5 and
   * trims it at 6-7, and rewards more of a bigger table. Matches the doc's
   * "stretch to 3º +2 with 5-6" note.
   */
  bebidaPlacementBonus: [8, 4, 2],
  /**
   * Penalty for the fewest bebidas (each tied player takes it in full).
   * Softened from the doc's -4: last place is often decided by draw order in
   * the final round, not by choice — too much swing for a trap.
   */
  bebidaLastPenalty: -2,

  paoDeAlhoCopies: 5,
  abacaxiCopies: 4,

  /**
   * Pratos (combos): having every card of the recipe in hand => bonus, on top
   * of what each card already scores (non-exclusive: one card may serve several
   * pratos). Ordered high bonus first — display everywhere follows this array.
   * Shapes vary: the doc's "1ª passada" triples (carne+acomp+bebida), digital
   * playtest additions without bebida (an identity for the orphan acomps), and
   * two full-set combos — Rei do Gado (all 5 cortes) / Sedento (all 4 bebidas),
   * very committed hands, hence hefty. Rebalance (sim-driven): 2-card pratos
   * fire 5-6x more often than Raiz, so pairs sit at +2 and Raiz at +10.
   */
  pratos: [
    {
      name: 'Rei do Gado',
      reqs: [
        carne('picanha'),
        carne('costela'),
        carne('fraldinha'),
        carne('coracao'),
        carne('coxao-duro')
      ],
      bonus: 12
    },
    {
      name: 'Prato Raiz',
      reqs: [carne('picanha'), acomp('farofa'), bebida('cerveja')],
      bonus: 10
    },
    {
      name: 'Sedento',
      reqs: [
        bebida('cerveja'),
        bebida('guarana'),
        bebida('suco'),
        bebida('caipirinha')
      ],
      bonus: 10
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
      name: 'Espetinho de Boteco',
      reqs: [acomp('queijo-coalho'), linguica, pao],
      bonus: 4
    },
    {
      name: 'Fitness',
      reqs: [carne('coxao-duro'), acomp('salada'), bebida('suco')],
      bonus: 3
    },
    {
      name: 'Vaca Atolada',
      reqs: [carne('costela'), acomp('mandioca')],
      bonus: 2
    },
    {
      name: 'Churrasco de Laje',
      reqs: [carne('coxao-duro'), acomp('maionese')],
      bonus: 2
    }
  ] as PratoSpec[]
}

/** Turn-timeout choices the host can pick in the lobby (seconds). */
export const TURN_TIMEOUT_OPTIONS = [15, 30, 60] as const

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
  takeToNeighbor: false,
  sobrasGive: false,
  lastSeat: null
}
