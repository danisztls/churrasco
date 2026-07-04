import type { EventId, GameSnapshot } from './types'

/**
 * Event cards. One is drawn per round from round 2 on, no repeats per game.
 * Every event is symmetric in card count (all players +1, or all net 0) so
 * hands stay in sync and the "everyone reaches 7 together" end holds.
 *
 * Two hooks per event, both run at round start:
 * - preDeal: set RoundModifiers before the buffet is (re)filled.
 * - postDeal: immediate effects after the buffet is ready — override the
 *   starting seat, set up a pending interaction phase, or burn the round.
 *   Return 'round-lost' to skip the round entirely (Tá Pegando Fogo).
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
  fogo: {
    name: 'Tá pegando fogo, bicho!',
    emoji: '🔥',
    desc: 'O buffet inteiro queimou. Ninguém pega nada nesta rodada.',
    postDeal: (snap) => {
      snap.log.push({
        round: snap.round,
        event: 'fogo',
        seat: 'mesa',
        action: 'queimou',
        options: snap.buffet.length
      })
      snap.discard.push(...snap.buffet.map((s) => s.card))
      snap.buffet = []
      return 'round-lost'
    }
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
    desc: 'Proibido passar: vire uma carta e ela é sua.',
    preDeal: (snap) => {
      snap.modifiers.passAllowed = false
      snap.modifiers.forcedTake = true
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

  churrasqueiro: {
    name: 'Churrasqueiro profissa',
    emoji: '👨‍🍳',
    desc: 'Todo o buffet aberto desde o início — e sem passar.',
    preDeal: (snap) => {
      snap.modifiers.revealAll = true
    }
  },

  'foto-story': {
    name: 'Foto pro Story',
    emoji: '📸',
    desc: 'Todas as mãos abertas nesta rodada.',
    preDeal: (snap) => {
      snap.modifiers.openHands = true
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
      if (queue.length > 0) snap.pending = { kind: 'swap', queue }
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
  }
}

export const ALL_EVENTS = Object.keys(EVENTS) as EventId[]
