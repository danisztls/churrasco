import { CONFIG } from '../game/config'
import type { Acomp, Bebida, Card, Corte } from '../game/types'

export interface CardMeta {
  emoji: string
  name: string
  rule: string
  /** CSS class for category color. */
  kind: string
}

const CORTE_META: Record<Corte, { emoji: string; name: string }> = {
  picanha: { emoji: '🥩', name: 'Picanha' },
  costela: { emoji: '🍖', name: 'Costela' },
  fraldinha: { emoji: '🥓', name: 'Fraldinha' },
  coracao: { emoji: '❤️‍🔥', name: 'Coração' },
  'coxao-duro': { emoji: '🦴', name: 'Coxão Duro' }
}

const BEBIDA_META: Record<Bebida, { emoji: string; name: string }> = {
  cerveja: { emoji: '🍺', name: 'Cerveja' },
  guarana: { emoji: '🥤', name: 'Guaraná' },
  suco: { emoji: '🧃', name: 'Suco' },
  caipirinha: { emoji: '🍹', name: 'Caipirinha' }
}

const ACOMP_META: Record<Acomp, { emoji: string; name: string }> = {
  vinagrete: { emoji: '🍅', name: 'Vinagrete' },
  arroz: { emoji: '🍚', name: 'Arroz' },
  'feijao-tropeiro': { emoji: '🫘', name: 'Feijão Tropeiro' },
  'queijo-coalho': { emoji: '🧀', name: 'Queijo Coalho' },
  farofa: { emoji: '🥣', name: 'Farofa' },
  maionese: { emoji: '🥔', name: 'Maionese' },
  mandioca: { emoji: '🍠', name: 'Mandioca' },
  salada: { emoji: '🥗', name: 'Salada' }
}

export function cardMeta(card: Card): CardMeta {
  switch (card.kind) {
    case 'carne':
      return {
        ...CORTE_META[card.corte],
        rule: `${CONFIG.cortePoints[card.corte]} pts`,
        kind: 'carne'
      }
    case 'bebida':
      return {
        ...BEBIDA_META[card.bebida],
        rule: '1 pt · mais bebidas +8/+4, menos −4',
        kind: 'bebida'
      }
    case 'acomp':
      return {
        ...ACOMP_META[card.acomp],
        rule: 'distintos: 1/3/7/12/18/25',
        kind: 'acomp'
      }
    case 'linguica':
      return {
        emoji: '🌭',
        name: 'Linguiça',
        rule: 'iguais: 1/3/6, +1 por extra',
        kind: 'linguica'
      }
    case 'pao-de-alho':
      return {
        emoji: '🧄',
        name: 'Pão de Alho',
        rule: 'dobra o próximo corte que você pegar',
        kind: 'pao'
      }
    case 'abacaxi':
      return {
        emoji: '🍍',
        name: 'Abacaxi',
        rule: '0 pts · na sua vez, troque por carta do buffet',
        kind: 'abacaxi'
      }
  }
}
