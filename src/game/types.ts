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

/** One required card in a prato (combo) recipe. */
export type PratoReq =
  | { kind: 'carne'; corte: Corte }
  | { kind: 'acomp'; acomp: Acomp }
  | { kind: 'bebida'; bebida: Bebida }
  | { kind: 'linguica' }
  | { kind: 'pao-de-alho' }

export interface PratoSpec {
  name: string
  /** Distinct requirements; having ALL of them in hand awards the bonus. */
  reqs: PratoReq[]
  bonus: number
}

export interface BuffetSlot {
  card: Card
  faceUp: boolean
}

export interface PlayerSeat {
  id: string
  name: string
  /** Player profile color (hex), for UI accents. */
  color?: string
  /** Acquisition order matters: pao-de-alho binds to the next corte AFTER it. */
  hand: Card[]
  tookThisRound: boolean
}

export type EventId =
  | 'resenha'
  | 'nao-alimente'
  | 'ultimos-primeiros'
  | 'brinde'
  | 'esqueceram'
  | 'depois-acaba'
  | 'primo-rico'
  | 'carvao'
  | 'churrasqueiro'
  | 'amigo-secreto'
  | 'album-copa'
  | 'abre-boquinha'
  | 'sobras'
  | 'rex'

/**
 * Per-round rule modifiers, reset every round and set by the event card.
 */
export interface RoundModifiers {
  /** Extra buffet cards beyond CONFIG.buffetSlots(n) (Primo Rico: +2). */
  buffetDelta: number
  /** Depois Acaba: false = passing forbidden. */
  passAllowed: boolean
  /** Churrasqueiro Profissa: whole buffet revealed at round start. */
  revealAll: boolean
  /** Os Últimos Serão os Primeiros: reversed turn order this round. */
  reversed: boolean
  /** Depois Acaba: revealing a card takes it immediately (flip-and-take). */
  forcedTake: boolean
  /** Abre a Boquinha: the card you take goes to the next seat's hand. */
  takeToNeighbor: boolean
  /** As Sobras de Ontem: after taking, put 1 card from hand on the pile. */
  sobrasGive: boolean
  /** Esqueceram de Mim: this seat only gets its turn after everyone else took. */
  lastSeat: number | null
}

/** A prato taken in the race: only the FIRST hand to complete the recipe
 * scores it. Permanent — losing a piece later does not revoke the claim. */
export interface PratoClaim {
  /** Prato name (key into CONFIG.pratos). */
  name: string
  /** Seat id of the claimant. */
  seat: string
  round: number
}

export type GamePhase = 'playing' | 'scored'

/** 'reveal' only occurs under Depois Acaba (elsewhere the flip is automatic);
 * 'give' is the post-take step under As Sobras de Ontem. */
export type TurnStep = 'reveal' | 'act' | 'give'

/** Simultaneous pick-from-hand phase (Não Alimente / Amigo Secreto). */
export interface PendingSimul {
  kind: 'discard' | 'gift'
  /** Seat ids that still need to choose. */
  waitingFor: string[]
  /** Chosen hand index per seat id; resolved when waitingFor empties. */
  choices: Record<string, number>
}

/** Sequential neighbor-swap phase (Álbum da Copa); head of queue acts. */
export interface PendingSwap {
  kind: 'swap'
  queue: string[]
}

export type Pending = PendingSimul | PendingSwap

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
  /** Shuffled event deck; one drawn per round from round 2, no repeats. */
  eventDeck: EventId[]
  /** Event in effect this round (null in round 1 or if deck exhausted). */
  currentEvent: EventId | null
  /** Blocking event phase before normal turns start (or null). */
  pending: Pending | null
  /** Pratos already won, in claim order (race: first to complete keeps it). */
  pratoClaims: PratoClaim[]
  /** As Sobras de Ontem: cards contributed this round; seeds next round. */
  sobras: Card[]
  /** Cards removed from play (Tá Pegando Fogo, Não Alimente). */
  discard: Card[]
  /** Every player decision, for post-game balance analysis (CSV export). */
  log: LogEntry[]
  /** RNG seed the deck was shuffled with — for reproducing a game. */
  seed: number
}

export type LogAction =
  | 'pegou'
  | 'passou'
  | 'abacaxi'
  | 'descartou'
  | 'presenteou'
  | 'trocou'
  | 'sobras'
  | 'prato'

export interface LogEntry {
  round: number
  event: EventId | null
  /** Seat name (stable for the game, readable in the CSV). */
  seat: string
  action: LogAction
  /** Label of the card acquired/given, when the action involves one. */
  card?: string
  /** Face-up options available at the moment of a take/pass decision. */
  options?: number
}

export type Move =
  /** Flip the next face-down buffet card (fixed order — no choice). */
  | { type: 'reveal' }
  | { type: 'take'; slot: number }
  | { type: 'pass' }
  /** Free action: swap a hand abacaxi with the face-up card at `slot`. */
  | { type: 'abacaxi'; slot: number }
  /** Não Alimente os Animais: choose a hand card to discard. */
  | { type: 'event-discard'; handIdx: number }
  /** Amigo Secreto: choose a hand card to gift to the next seat. */
  | { type: 'event-gift'; handIdx: number }
  /** Álbum da Copa: give a chosen card to a neighbor, get a random one back. */
  | { type: 'event-swap'; handIdx: number; target: string }
  /** As Sobras de Ontem: after taking, choose a hand card for the pile. */
  | { type: 'event-give'; handIdx: number }

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
