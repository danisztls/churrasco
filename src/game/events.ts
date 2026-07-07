import { CONFIG } from './config'
import type { EventId, GameSnapshot } from './types'

/**
 * Event cards. One is drawn per round from round 2 on, no repeats per game —
 * except the neutral 'resenha' (no-op), which enters the deck in multiple
 * copies (CONFIG.neutralEventCopies) to dilute event frequency: a fresh
 * twist EVERY round proved overwhelming.
 * Every event is symmetric in card count (all players +1, or all net 0) so
 * hands stay in sync and the "everyone reaches 7 together" end holds.
 *
 * Two hooks per event, both run at round start:
 * - preDeal: set RoundModifiers before the buffet is (re)filled.
 * - postDeal: immediate effects after the buffet is ready — override the
 *   starting seat, set up a pending interaction phase, or burn the round.
 *   Return 'round-lost' to skip the round entirely (no stock event uses it
 *   since Tá Pegando Fogo was cut; kept as API for custom events).
 */
export interface EventSpec {
  name: string
  emoji: string
  /** Rule text shown to players (PT-BR). */
  desc: string
  preDeal?: (snap: GameSnapshot) => void
  postDeal?: (snap: GameSnapshot) => void | 'round-lost'
}

/** Seats able to give a card from hand right now. */
const seatsWithCards = (snap: GameSnapshot) =>
  snap.seats.filter((s) => s.hand.length > 0)

export const EVENTS: Record<EventId, EventSpec> = {
  resenha: {
    name: 'Só resenha',
    emoji: '😎',
    desc: 'Rodada tranquila, sem regra especial — só o papo e a brasa.'
    // No hooks: a normal round. Exists to dilute the event deck.
  },

  'nao-alimente': {
    name: 'Não alimente os animais',
    emoji: '🚫',
    desc: 'Todos descartam 1 carta da mão.',
    postDeal: (snap) => {
      const givers = seatsWithCards(snap)
      if (givers.length === 0) return
      snap.pending = {
        kind: 'discard',
        waitingFor: givers.map((s) => s.id),
        choices: {}
      }
    }
  },

  'ultimos-primeiros': {
    name: 'Os últimos serão os primeiros',
    emoji: '🔄',
    desc: 'A ordem desta rodada é invertida.',
    preDeal: (snap) => {
      snap.modifiers.reversed = true
    },
    postDeal: (snap) => {
      const n = snap.seats.length
      snap.turnSeat = (snap.startSeat + n - 1) % n
    }
  },

  brinde: {
    name: 'Brinde!',
    emoji: '🥂',
    desc: 'Começa quem tem mais bebidas na mão (desempate: mais carnes).',
    postDeal: (snap) => {
      const n = snap.seats.length
      let best = snap.startSeat
      const key = (i: number): [number, number] => {
        const hand = snap.seats[i].hand
        return [
          hand.filter((c) => c.kind === 'bebida').length,
          hand.filter((c) => c.kind === 'carne').length
        ]
      }
      // Walk in seat order from startSeat so remaining ties keep table order.
      for (let d = 0; d < n; d++) {
        const i = (snap.startSeat + d) % n
        const [b, c] = key(i)
        const [bb, bc] = key(best)
        if (b > bb || (b === bb && c > bc)) best = i
      }
      snap.turnSeat = best
    }
  },

  esqueceram: {
    name: 'Esqueceram de mim',
    emoji: '🏠',
    desc: 'Quem começaria a rodada vira o último a pegar.',
    postDeal: (snap) => {
      const n = snap.seats.length
      snap.modifiers.lastSeat = snap.startSeat
      snap.turnSeat = (snap.startSeat + 1) % n
    }
  },

  'depois-acaba': {
    name: 'Depois acaba',
    emoji: '⏰',
    desc: 'Proibido passar: escolha uma carta da mesa, mas tem que levar uma.',
    preDeal: (snap) => {
      snap.modifiers.passAllowed = false
    }
  },

  'primo-rico': {
    name: 'Primo Rico',
    emoji: '🤑',
    desc: 'Fartura: o buffet desta rodada tem 2 cartas a mais.',
    preDeal: (snap) => {
      snap.modifiers.buffetDelta = 2
    }
  },

  carvao: {
    name: 'Acabou o carvão',
    emoji: '🪵',
    desc: 'Faltou brasa: o buffet desta rodada tem 2 cartas a menos.',
    preDeal: (snap) => {
      snap.modifiers.buffetDelta = -2
    }
  },

  churrasqueiro: {
    name: 'Churrasqueiro profissa',
    emoji: '👨‍🍳',
    desc: 'Todo o buffet aberto desde o início — e sem passar.',
    preDeal: (snap) => {
      snap.modifiers.revealAll = true
    }
  },

  'amigo-secreto': {
    name: 'Amigo secreto',
    emoji: '🎁',
    desc: 'Todos passam 1 carta da mão para o jogador seguinte.',
    postDeal: (snap) => {
      const givers = seatsWithCards(snap)
      if (givers.length < 2) return
      snap.pending = {
        kind: 'gift',
        waitingFor: givers.map((s) => s.id),
        choices: {}
      }
    }
  },

  'album-copa': {
    name: 'Álbum da Copa',
    emoji: '⚽',
    desc: 'Na ordem da mesa: dê 1 carta a quem quiser e receba 1 aleatória dele.',
    postDeal: (snap) => {
      if (snap.seats.length < 2) return
      const n = snap.seats.length
      const queue: string[] = []
      for (let d = 0; d < n; d++) {
        const seat = snap.seats[(snap.startSeat + d) % n]
        if (seat.hand.length > 0) queue.push(seat.id)
      }
      if (queue.length > 0) snap.pending = { kind: 'swap', queue, chosen: [] }
    }
  },

  'abre-boquinha': {
    name: 'Abre a boquinha',
    emoji: '😮',
    desc: 'A carta que você pegar vai para o vizinho; você recebe do outro lado.',
    preDeal: (snap) => {
      snap.modifiers.takeToNeighbor = true
    }
  },

  sobras: {
    name: 'As sobras de ontem',
    emoji: '🍛',
    desc: 'Ao pegar sua carta, ponha 1 da mão no monte — ele vira a próxima rodada.',
    preDeal: (snap) => {
      snap.modifiers.sobrasGive = true
    }
  },

  rex: {
    name: 'O Rex atacou!',
    emoji: '🐕',
    desc: 'O cachorro comeu as sobras da mesa: a rodada abre com buffet novinho.',
    // preDeal: the table is cleared BEFORE the refill, so dealRound sees an
    // empty buffet and opens it like a fresh deal.
    preDeal: (snap) => {
      snap.discard.push(...snap.buffet.map((s) => s.card))
      snap.buffet = []
    }
  }
}

export const ALL_EVENTS = Object.keys(EVENTS) as EventId[]

/** The full event deck: every real event once + N copies of the neutral. */
export function buildEventDeck(): EventId[] {
  const deck: EventId[] = ALL_EVENTS.filter((e) => e !== 'resenha')
  for (let i = 0; i < CONFIG.neutralEventCopies; i++) deck.push('resenha')
  return deck
}
