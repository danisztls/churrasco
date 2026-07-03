export type Corte =
  'picanha' | 'costela' | 'fraldinha' | 'coracao' | 'coxao-duro'

export type Bebida = 'cerveja' | 'guarana' | 'suco' | 'caipirinha'

export type Acomp =
  | 'vinagrete'
  | 'arroz'
  | 'feijao-tropeiro'
  | 'queijo-coalho'
  | 'farofa'
  | 'maionese'
  | 'mandioca'
  | 'salada'

export type Card =
  | { id: number; kind: 'carne'; corte: Corte }
  | { id: number; kind: 'bebida'; bebida: Bebida }
  | { id: number; kind: 'acomp'; acomp: Acomp }
  | { id: number; kind: 'linguica' }
  | { id: number; kind: 'pao-de-alho' }
  | { id: number; kind: 'abacaxi' }

export type CardKind = Card['kind']

export interface BuffetSlot {
  card: Card
  faceUp: boolean
}

export interface PlayerSeat {
  id: string
  name: string
  /** Acquisition order matters: pao-de-alho binds to the next corte AFTER it. */
  hand: Card[]
  tookThisRound: boolean
}

/**
 * Per-round rule modifiers — the plug-in point for event cards (milestone 2).
 * v1 always uses DEFAULT_MODIFIERS.
 */
export interface RoundModifiers {
  /** Extra buffet cards beyond N + buffetExtra (Primo Rico: +2). */
  buffetDelta: number
  /** Depois Acaba: false = flip-and-take, passing forbidden. */
  passAllowed: boolean
  /** Churrasqueiro Profissa: whole buffet revealed at round start. */
  revealAll: boolean
  /** Os Últimos Serão os Primeiros: reversed turn order this round. */
  reversed: boolean
  /** Foto pro Story: all hands visible this round. */
  openHands: boolean
}

export type GamePhase = 'playing' | 'scored'

export type TurnStep = 'reveal' | 'act'

export interface GameSnapshot {
  phase: GamePhase
  /** 1-based round counter. */
  round: number
  seats: PlayerSeat[]
  /** Seat index that opens the current round (rotates every round). */
  startSeat: number
  /** Seat index whose turn it is. */
  turnSeat: number
  turnStep: TurnStep
  buffet: BuffetSlot[]
  /** Remaining draw pile. */
  deck: Card[]
  modifiers: RoundModifiers
  /** RNG seed the deck was shuffled with — for reproducing a game. */
  seed: number
}

export type Move =
  | { type: 'reveal'; slot: number }
  | { type: 'take'; slot: number }
  | { type: 'pass' }
  /** Swap an abacaxi from hand with the face-up card at `slot`, then pass. */
  | { type: 'abacaxi'; slot: number }

export interface HandScore {
  carne: number
  /** Extra points from pao-de-alho doublings (the bound corte's value again). */
  pao: number
  linguica: number
  acomp: number
  bebidaFace: number
  pratos: { name: string; bonus: number }[]
  pratosTotal: number
  /** Everything except bebida placement. */
  subtotal: number
}

export interface PlayerScore extends HandScore {
  seatId: string
  name: string
  bebidaCount: number
  bebidaPlacement: number
  total: number
}
