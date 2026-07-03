# Churrasco 🔥

Implementação digital do jogo de cartas **Churrasco** (design em
`~/Docs/dev/game/churrasco/_index.md`) para playtest remoto — 3 a 6 jogadores,
cada um no seu navegador/celular. Multiplayer via
[Playroom Kit](https://docs.joinplayroom.com/), sem backend próprio.

É uma ferramenta de playtest: todas as alavancas de balanceamento estão em
`src/game/config.ts` e a tela final mostra a pontuação aberta por categoria.

## Setup

1. Crie um projeto grátis em [dev.joinplayroom.com](https://dev.joinplayroom.com)
   e copie o `gameId` (Configuration → General) para `src/playroomConfig.ts`.
   Sem ele o modo dev local ainda funciona; o plano Free (10 usuários únicos/dia)
   cobre qualquer playtest.
2. `npm install`
3. `npm run dev` — abra a URL, o Playroom cria a sala; compartilhe o link/QR
   com os jogadores.

Em desenvolvimento o jogo aceita 2 jogadores (para smoke test em duas abas);
em produção o mínimo é 3.

## Scripts

- `npm run dev` — servidor local
- `npm test` — suíte do motor (pontuação, máquina de turnos, invariantes)
- `npm run build` — build estático (deploy em qualquer host estático)
- `npm run lint` / `npm run format`

## Arquitetura

- `src/game/` — motor puro em TS, sem React nem Playroom: `config.ts`
  (alavancas), `deck.ts` (baralho + shuffle com seed), `rules.ts` (máquina de
  turnos como reducer puro), `scoring.ts` (pontuação).
- `src/multiplayer/useGameEngine.tsx` — sync host-autoritativo: o snapshot
  inteiro vive numa chave `useMultiplayerState`; só o host aplica jogadas
  (validadas pelo motor) e publica; os demais enviam jogadas por RPC. Se o
  jogador da vez cair, o host joga por ele após 1,5 s (anti-deadlock).
- `src/components/` — UI mobile-first, PT-BR, arte em emoji.

## Interpretações de regra (decisões digitais, mude em `config.ts`)

1. **Anti-trava**: passar (e trocar abacaxi) só é permitido enquanto houver
   carta virada para baixo; com tudo revelado, é obrigatório pegar.
2. **Empate na bebida**: empatados dividem o _pool_ das colocações que ocupam
   (piso); empate no último não divide (−4 cada); todos iguais = lavada.
3. **Pratos não exclusivos**: uma carta pode servir a mais de um prato
   (ex.: um suco fecha Domingo em Família e Fitness de Mentira).
4. **7 acompanhamentos distintos** valem o teto da tabela (25).
5. **Mãos ocultas** dos rivais na UI (contagem de cartas e de bebidas é
   pública — a corrida da gelada precisa ser visível).

## Roadmap

- **M2**: cartas de evento (~13 tipos) sobre os hooks de `RoundModifiers`.
- **M3**: bots para playtest solo, stream mode (tabuleiro na TV), deploy
  estático, export de log de compras por rodada para análise de balanço.
