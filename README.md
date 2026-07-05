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

## Eventos (1 por rodada, a partir da 2ª, sem repetir na partida)

13 eventos implementados (`src/game/events.ts`), com `eventsEnabled` em
`config.ts` para desligar. Modificadores puros: _Primo Rico_ (+2 no buffet),
_Acabou o Carvão_ (−2 no buffet), _Churrasqueiro Profissa_ (tudo aberto),
_Depois Acaba_ (vire-e-leve), _Abre a Boquinha_ (compra vai ao vizinho),
_Os Últimos Serão os Primeiros_, _Brinde!_, _Esqueceram de Mim_,
_O Rex Atacou_ (come as sobras da mesa; buffet novo). Com interação:
_Não Alimente os Animais_ (todos descartam 1), _Amigo Secreto_ (todos passam
1 ao seguinte), _Álbum da Copa_ (troca com qualquer jogador), _As Sobras de
Ontem_ (contribui 1 ao monte que semeia a próxima rodada). Cortados no
playtest digital: _Tá Pegando Fogo_ (swing puro sem decisão; o hook
`'round-lost'` segue no motor) e _Foto pro Story_ (redundante com as mãos
abertas por padrão).

## Interpretações de regra (decisões digitais, mude em `config.ts`/`events.ts`)

1. **Anti-trava**: passar só é permitido enquanto houver carta virada para
   baixo; com tudo revelado, é obrigatório pegar. O abacaxi é **ação grátis**,
   fora da trava: troque (uma vez por abacaxi na mão) e ainda pegue ou passe no
   mesmo turno. Trocar abacaxi por abacaxi é proibido; só _Depois Acaba_
   bloqueia a troca. Sob _Churrasqueiro Profissa_ a rodada vira um draft
   aberto.
2. **Virada automática**: revelar a próxima carta fechada não é decisão, então
   o motor vira sozinho na abertura de cada turno. Exceção: _Depois Acaba_,
   onde virar É o turno (vire-e-leve) e continua sendo ação do jogador.
3. **Empate na bebida**: empatados dividem o _pool_ das colocações que ocupam
   (piso); empate no último não divide (−4 cada); todos iguais = lavada.
4. **Pratos não exclusivos**: uma carta pode servir a mais de um prato
   (ex.: um suco fecha Domingo em Família e Fitness de Mentira).
5. **7 acompanhamentos distintos** valem o teto da tabela (25).
6. **Mãos abertas**: todas as mãos são públicas na UI (decisão de playtest —
   mais leitura de mesa, menos memória; _Foto pro Story_ ficou redundante e
   saiu do deck de eventos).
7. **Álbum da Copa**: você escolhe a carta que dá e o alvo — qualquer jogador,
   não só vizinhos; a carta que recebe é sorteada da mão dele (troca às cegas,
   mesmo com mãos abertas). Resolve em ordem de mesa.
8. **Brinde!** desempata por mais cartas de carne; persistindo, ordem da mesa.
9. **Abre a Boquinha**: a carta comprada vai ao vizinho seguinte na ordem; a
   ordem de chegada na mão do vizinho conta para o pão-de-alho dele.
10. **Timer de turno**: 30 s de inatividade e a mesa joga pelo jogador da vez
    (política do bot; `turnTimeoutSec` em `config.ts`). Barra visível na UI.

## Playtest solo e análise

- **Bots**: o anfitrião adiciona até 5 bots no lobby (política gulosa por
  delta de pontuação, `src/game/bot.ts`). Também pilotam jogadores que caírem.
- **Log de decisões**: toda pegada/passada/escolha de evento vai para o
  snapshot; a tela final tem **Baixar log (CSV)** (rodada, evento, jogador,
  ação, carta, nº de opções abertas) + totais por categoria — insumo direto
  para as questões de balanço do design (passar paga? M=2N infla os placares?).
- **Simulação**: `npx tsx scripts/sim.ts [n]` roda n partidas bot-vs-bot por
  experimento (guloso vs aleatório, guloso+ vs guloso, efeito de assento,
  variância com/sem eventos) — números para as perguntas de sorte/habilidade.
- **Regras no jogo**: botão «?» flutuante abre o "Como jogar" (gerado do
  config: pontuações, pratos e eventos sempre em dia com o balanceamento).

## Roadmap

- Stream mode (tabuleiro na TV) e deploy estático (Cloudflare Pages/Netlify).
