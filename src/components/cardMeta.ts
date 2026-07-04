import { CONFIG } from '../game/config'
import type { Acomp, Bebida, Card, Corte, PratoReq } from '../game/types'

export interface CardMeta {
  emoji: string
  name: string
  rule: string
  /** CSS class for category color. */
  kind: string
}

export const CORTE_META: Record<Corte, { emoji: string; name: string }> = {
  picanha: { emoji: '🥩', name: 'Picanha' },
  costela: { emoji: '🍖', name: 'Costela' },
  fraldinha: { emoji: '🥓', name: 'Fraldinha' },
  coracao: { emoji: '❤️‍🔥', name: 'Coração' },
  'coxao-duro': { emoji: '🦴', name: 'Coxão Duro' }
}

export const BEBIDA_META: Record<Bebida, { emoji: string; name: string }> = {
  cerveja: { emoji: '🍺', name: 'Cerveja' },
  guarana: { emoji: '🥤', name: 'Guaraná' },
  suco: { emoji: '🧃', name: 'Suco' },
  caipirinha: { emoji: '🍹', name: 'Caipirinha' }
}

export const ACOMP_META: Record<Acomp, { emoji: string; name: string }> = {
  vinagrete: { emoji: '🍅', name: 'Vinagrete' },
  arroz: { emoji: '🍚', name: 'Arroz' },
  'feijao-tropeiro': { emoji: '🫘', name: 'Feijão Tropeiro' },
  'queijo-coalho': { emoji: '🧀', name: 'Queijo Coalho' },
  farofa: { emoji: '🥣', name: 'Farofa' },
  maionese: { emoji: '🥔', name: 'Maionese' },
  mandioca: { emoji: '🍠', name: 'Mandioca' },
  salada: { emoji: '🥗', name: 'Salada' }
}

/** Display meta for one prato-recipe requirement. */
export function reqMeta(req: PratoReq): { emoji: string; name: string } {
  switch (req.kind) {
    case 'carne':
      return CORTE_META[req.corte]
    case 'acomp':
      return ACOMP_META[req.acomp]
    case 'bebida':
      return BEBIDA_META[req.bebida]
    case 'linguica':
      return { emoji: '🌭', name: 'Linguiça' }
    case 'pao-de-alho':
      return { emoji: '🧄', name: 'Pão de Alho' }
  }
}

/** Category (CSS suffix) for a plain log label (see game/log.ts cardLabel). */
export function labelKind(label: string): string {
  if (label in CORTE_META) return 'carne'
  if (label in BEBIDA_META) return 'bebida'
  if (label in ACOMP_META) return 'acomp'
  if (label === 'pao-de-alho') return 'pao'
  if (label === 'abacaxi') return 'abacaxi'
  return 'linguica'
}

/** Display name for a plain log label (see game/log.ts cardLabel). */
export function labelName(label: string): string {
  const all: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(CORTE_META).map(([k, v]) => [k, v.name])
    ),
    ...Object.fromEntries(
      Object.entries(BEBIDA_META).map(([k, v]) => [k, v.name])
    ),
    ...Object.fromEntries(
      Object.entries(ACOMP_META).map(([k, v]) => [k, v.name])
    ),
    linguica: 'Linguiça',
    'pao-de-alho': 'Pão de Alho',
    abacaxi: 'Abacaxi'
  }
  return all[label] ?? label
}

/** Fuller mechanic description, shown as a hover tooltip. */
export function cardTooltip(card: Card): string {
  switch (card.kind) {
    case 'carne':
      return `${CORTE_META[card.corte].name}: ${CONFIG.cortePoints[card.corte]} pontos de face. Um Pão de Alho pego antes dobra este corte.`
    case 'bebida':
      return `${BEBIDA_META[card.bebida].name}: ${CONFIG.bebidaFace} pt de face. No fim, quem tiver mais bebidas ganha +${CONFIG.bebidaPlacementBonus[0]}, o 2º +${CONFIG.bebidaPlacementBonus[1]}, e quem tiver menos leva ${CONFIG.bebidaLastPenalty}. Conta para pratos.`
    case 'acomp':
      return `${ACOMP_META[card.acomp].name}: acompanhamento. Tipos distintos pontuam ${CONFIG.acompCurve.slice(1).join('/')}; repetidos não contam.`
    case 'linguica':
      return `Linguiça: iguais escalam ${CONFIG.linguicaCurve.slice(1, 4).join('/')}, depois +1 por extra. Não é corte: pão-de-alho não a dobra.`
    case 'pao-de-alho':
      return 'Pão de Alho: dobra o PRÓXIMO corte que você pegar (um só). Não vale para cortes já na mão; sem corte depois, vale 0.'
    case 'abacaxi':
      return 'Abacaxi: 0 pontos. Ação grátis: na sua vez, troque-o por uma carta aberta do buffet — e ainda pegue ou passe no mesmo turno.'
  }
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
