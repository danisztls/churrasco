# Churrasco

Jogo de cartas competitivo, por rodadas. Objetivo: maior pontuação ao final,
disputando com os outros jogadores a compra de cartas e a montagem de combos.
Temática de churrasco brasileiro, humor leve. Inspiração inicial no Sushi Go,
mas migrando para mecânicas próprias (o Sushi Go vive das regras de pontuação,
não da temática — clonar só a temática daria jogo fraco).

Status: ideia em desenvolvimento. Abaixo, o que está mais ou menos firmado vs.
propostas a discutir vs. questões em aberto.

**Implementação digital para playtest remoto: `~/Dev/game/churrasco`** (web,
Playroom Kit, 3-6 jogadores + bots; regras completas incluindo os 13 eventos;
todas as alavancas de balanço em `src/game/config.ts`; exporta CSV de decisões
por partida). É o veículo para fechar as questões de balanceamento abaixo — as
interpretações de regra que o digital forçou estão no README de lá.

## Público-alvo

**Público B confirmado: a galera adulta do churrasco** — jovens-adultos e adultos
(20-40), grupos de amigos e famílias com adolescentes. 3-6 jogadores = tamanho de
reunião. Humor projetado para 14+, satírico-afetuoso. **Não é jogo para crianças nem
idosos** — decisão consciente (validação 2ª onda): o tradeoff é inevitável e o dono
escolhe **profundidade/complexidade** (filler de hobbyist) em vez de simplificar para
todas as idades. Isso também dissolve a tensão álcool/14+: é jogo de
adolescente/adulto, álcool é só cor temática. **Sem lead/tagline — só "Churrasco".**
Nome aparentemente livre no espaço de jogos, mas é palavra genérica → marca fraca;
checar BGG + INPI antes de comercializar.

### Mercado internacional

O tema viaja; o humor não — e o humor é justamente o que escolhemos puxar (B).

- **A favor:** grelhar carne é quase universal (asado, braai, BBQ, barbie,
  mangal); jogos de comida exportam bem (Sushi Go, Point Salad); picanha tem hype
  global agora; mecânicas language-light (draft/combo, só localizar nomes + ícones).
- **Contra:** a alma do jogo é a piada e a linguagem idiomática BR (amigo secreto,
  "tá pegando fogo bicho", gírias, cortes e acompanhamentos locais). Humor de
  referência cultural não traduz, só se reescreve por mercado (modelo Cards Against
  Humanity).
- **Conclusão:** B = doméstico-primeiro, e está certo — a especificidade brasileira
  é o moat; um BBQ genérico não tem vantagem contra os Sushi Go-likes. Export é
  fase 2, via edições localizadas (recolorir a camada de humor/eventos por
  mercado), não genericizando o design agora. Manter arquitetura modular: núcleo
  universal + camada de humor/eventos trocável, para localização barata depois.
- **Prática:** lançar doméstico (convenções, editora/financiamento coletivo local);
  internacional exige editora de língua inglesa ou Kickstarter — lift bem maior, só
  se emplacar no Brasil.

Confiança: média (conhecimento geral de mercado, sem dados de venda recentes).

### Originalidade / risco legal

Inspirado no Sushi Go, mas seguro. **Mecânica de jogo não tem copyright** — a lei
separa ideia de expressão (vale nos EUA e no Brasil; LDA art. 8º exclui métodos,
sistemas e esquemas). Draft, coleção, maioria, "dobra a próxima" (wasabi), "pega 2"
(chopstick) são livres; o próprio Sushi Go pegou o draft do 7 Wonders. Protegidos
são a **expressão** (arte, texto do manual, nomes/ícones de carta, trade dress) e a
**marca** (nome, logo). Churrasco está livre: núcleo divergente (buffet sequencial
aberto ≠ draft simultâneo do Sushi Go), tema/arte/nome próprios. Cuidados: arte e
manual originais, nomes de carta próprios, não imitar ícones/embalagem, não usar
nome confundível nem citar "Sushi Go" na caixa. O risco é mais reputacional
("reskin") que legal — e os desvios (buffet, penalidade de repetido, gelada
graduada, linguiça decrescente) já dão identidade. IANAL: se for comercial, vale
uma consulta de IP barata antes de imprimir.

## Núcleo: draft de opcionalidade

Mecânica assinatura, o que diferencia do Sushi Go (que é draft simultâneo de mão
oculta). Aqui é draft sequencial aberto com pressão de sorte.

Descrição base (do conceito original):

- A cada rodada são dispostas N cartas viradas para baixo na mesa, N = número de
  jogadores.
- Na vez do primeiro jogador, a primeira carta é revelada. Ele compra ou passa.
- Segue assim até todos terem comprado uma carta (1 carta por jogador por
  rodada).
- Vantagem de passar = opcionalidade: depois pode ser revelada uma carta melhor.
- O jogador inicial alterna a cada rodada (para não ser sempre o mesmo a começar
  — correção de justiça de assento, não da opcionalidade).

### Turno (resolvido): buffet aberto, estilo rodízio

- Início da rodada: **M = 2N cartas na mesa, 2 já viradas para cima** (o buffet);
  o resto, virado para baixo.
- Na sua vez você **revela 1 carta** (vira uma das de baixo) e então:
  - **Pega** qualquer carta revelada (e sai da rodada) — não precisa ser a que
    acabou de revelar; ou
  - **Passa** (deixa pra depois): não pega nada, a vez segue.
- Como começa com 2 reveladas e você revela mais 1, **o buffet nunca está vazio na
  sua decisão**.
- Fim da rodada (todos compraram): as N cartas não compradas **viram para cima
  e ficam no buffet** (sobras públicas) — completa-se com N novas viradas para
  baixo. O rodízio continua: a sobra de hoje é a entrada de amanhã, e todo
  mundo sabe qual é.
- Passar = opcionalidade estilo rodízio: aposta que vem corte melhor (e a
  recirculação faz isso pagar — ver carryover), com o risco de um rival levar a joia
  antes de a vez voltar. (Equilíbrio do passar: ver _Questões em aberto_.)

### Abundância (resolvido): M = 2N

Furo descoberto testando a versão N cartas = N jogadores: **passar vira armadilha
para quem começa.** Exemplo (3 jogadores, 3 cartas): se A passa, B e C escolhem as
melhores e A cicla para o fim, comendo a última carta sem escolha — passar foi
estritamente pior que pegar. Girar o inicial por rodada distribui _quem_ é
prejudicado, mas não faz passar valer.

1ª correção: **M = N + 2**. O playtest digital subiu para **M = 2N** (ajustável —
é uma alavanca em `config.ts`): a simulação mostrou que a variância do jogo mora
no draft de núcleo, não nos eventos, e com N+2 cada decisão era "a melhor de ~3"
— pouca agência por turno. Dobrar o buffet alarga a escolha e dá mais espaço de
plano. Custo vigiado no playtest: sobras acumulam rejeito e os placares inflam.

- Ninguém é forçado a uma única carta — o último ainda escolhe entre várias.
- Passar vira ganho real de informação: o cardápio afina mas nunca seca.

**Carryover (regra de núcleo):** as M − N (= N) cartas não compradas ao fim da
rodada **viram para cima e ficam no buffet** (completa-se com N novas viradas
para baixo). Nada é desperdiçado; cartas boas que ninguém pegou voltam — é o que
faz "segurar pelo corte melhor" pagar ao longo do jogo (recirculação estilo
rodízio). O evento _as sobras de ontem_ amplifica isso (jogadores também injetam
cartas no monte). Não afeta a contagem de mãos.

**Sobras públicas (playtest digital):** o carryover virar para cima não é
cosmético — a simulação mostrou teto de habilidade raso (nenhuma heurística de
planejamento passou da paridade contra o guloso míope). Carryover oculto era
informação morta; aberto, a rodada seguinte nasce com N cartas de conhecimento
comum: dá para segurar plano ("a picanha volta"), ler o que os rivais deixaram
e decidir passar com base no que JÁ se sabe que vem. Custo zero de regra na
mesa física (é só não desvirar).

Custo aceito: perde-se o hook "N cartas = N jogadores" — bonito, mas quebrava a
mecânica assinatura.

## Cartas de comida / pontuação

**Seis categorias mecânicas** (não cartas avulsas) — poucas regras, muitas
cartas. Cada uma é um mecanismo conhecido-bom mapeado pro churrasco:

- **Carne** — um único tipo mecânico, **valor fixo impresso** que varia por corte:
  picanha (alta), costela, fraldinha, coração, coxão duro (baixa). Melhor corte =
  mais pontos. Pontua pelo valor de face. Os cortes são tiers de valor + estética,
  não mecânicas separadas.
- **Pão-de-alho** — multiplicador estilo _wasabi_ (Sushi Go): forma um par com o
  **próximo corte adquirido depois dele** (um único corte), dobrando-o. Não
  retroage a cortes já na mão → tensão de timing; sem corte depois, vale 0.
- **Bebida** (a estrela é a _gelada_/cerveja) — competição direta estilo _pudim_
  (Sushi Go): no fim do jogo, **mais bebidas = bônus, menos = penalidade**.
  Variantes só estéticas (cerveja, guaraná, suco, caipirinha) contam todas como
  bebida. É o eixo de interação entre jogadores.
- **Linguiça** — coleção de **iguais**: empilhe linguiças, pontua escalando. A
  carne barata/povão, comum no deck → **fácil de formar, teto menor.**
  Mecanicamente separada dos cortes (pão-de-alho não a dobra).
- **Acompanhamentos** — coleção de **variedade** (~8 tipos): pontua por tipos
  _distintos_; tipos repetidos só não contam (sem penalidade). Mais difícil de
  montar e **teto maior, escala melhor** que a linguiça — quer variar, não
  acumular.
- **Abacaxi** — utilidade (Sushi Go: _chopstick_), **0 pontos**: na sua vez, troque-o
  por uma carta revelada do buffet como **ação adicional** — no mesmo turno você
  ainda pega ou passa normalmente. A troca é net 0 (abacaxi sai, carta entra), então
  todos fecham a rodada iguais. Converte um slot morto numa carta escolhida.

Mapa de mecanismos: carne = acúmulo de valor bruto; pão-de-alho = multiplicador
(combo com carne); gelada = maioria/minoria (competição); acompanhamentos = set de
distintos; linguiça = set de iguais; abacaxi = flex/utilidade. Seis eixos
diferentes, profundidade sem virar planilha.

**Regras na carta:** cada carta traz a própria pontuação/regra impressa (como Sushi
Go). Não se joga de manual aberto — ele serve só para tirar dúvida. É o que torna as
6 lógicas administráveis na mesa apesar da variedade.

Desafio de balanceamento (3-6 jogadores):

- Coleção de variedade (acompanhamentos) escala bem com qualquer número.
- Maioria/minoria (gelada) fica mais swingy quanto mais gente — talvez bônus por
  colocação (1º/2º) e penalidade só do último, em vez de tudo-ou-nada.
- O multiplicador (pão-de-alho dobrando carne alta) precisa de teto/raridade para
  não explodir.
- Densidade de cada carta no deck é alavanca tão importante quanto o valor.

## Pontuação numérica (1ª passada — ilustrativa, a testar)

Escala-alvo: mão boa de 7 cartas ≈ 18-28 pontos. Os valores são relativos, não
sagrados — só o playtest fixa. O que importa são as razões entre eles.

**Carne — valor de face por corte:**

| Corte      | Pontos |
| ---------- | ------ |
| Picanha    | 5      |
| Costela    | 4      |
| Fraldinha  | 3      |
| Coração    | 2      |
| Coxão duro | 1      |

Densidade: pirâmide invertida — coxão duro comum, picanha rara (a raridade segura o
valor alto sem precisar de regra extra).

**Pão-de-alho:** 0 de face; forma um par com o **próximo corte adquirido depois
dele** (um único corte), dobrando-o (picanha 5 → 10). Não retroage a cortes já na
mão; sem corte depois, vale 0. Vários pães dobram cada um o seu próprio próximo
corte. Teto natural +5 por pão; densidade baixa para o combo não explodir.

**Linguiça (set de iguais):** 1 / 3 / 6, depois +1 por extra (4ª = 7, 5ª = 8, 6ª =
9). **Retornos decrescentes** — pega umas poucas e para; o oposto exato do
acompanhamentos. Comum no deck.

**Acompanhamentos (set de distintos):** ~8 tipos (vinagrete, arroz, feijão
tropeiro, queijo coalho, farofa, maionese, mandioca, salada). Tipos distintos
escalam acelerando: 1 / 3 / 7 / 12 / 18 / 25 por 1-6 distintos. Tipos repetidos só
não contam (sem penalidade). Alto teto, difícil de montar — o risco é só o slot
gasto num repetido (forçado por evento/sobra) que não pontua; mas paga muito no
topo.

**Bebida (gelada):** 1 de face cada (cerveja, guaraná, suco, caipirinha — todas
contam). No fim
do jogo, premia colocação: **1º +8, 2º +4, último −2**. Empate nos bônus (1º/2º)
**divide** os pontos (arredonda para baixo); empate no último **não divide** (cada
um leva −2). Se todos tiverem a mesma quantidade, é wash. Com 3 jogadores o 2º é o
do meio; com 5-6, dá para esticar (3º ainda +2) se a disputa ficar rasa.

A punição do último era −4 na 1ª passada; o playtest digital baixou para **−2**:
quem fica por último em bebida raramente escolheu isso — a ordem de compra da
última rodada costuma decidir — e −4 era swing demais para uma armadilha sem
decisão. O pódio (+8/+4) segue intacto; só o chicote encurtou.

**Abacaxi:** 0 pontos — só ferramenta. Na sua vez, **troque-o por uma carta revelada
do buffet como ação adicional** (a troca é net 0: abacaxi sai, carta entra) — no
mesmo turno você ainda pega ou passa normalmente, então todos fecham a rodada com a
mesma quantidade. Converte um slot morto numa carta escolhida.

Aferição rápida (mãos de 7, caem ~21-24, equilibradas):

- Carne + pão: [pão, picanha, contra-filé, barriguinha, coração, coxão, linguiça] →
  picanha dobrada 10 + 4 + 3 + 2 + 1 + linguiça 1 = **21**.
- Variedade: [5 acompanhamentos distintos, picanha, gelada] → 18 + 5 + bebida 1 =
  **24** (ápice difícil: 6 distintos + picanha ≈ 30).
- Bebida: [4 geladas (1º), picanha, contra-filé, linguiça] → face 4 + 1º +8 + 5 +
  4 + 1 = **22**.

### Combos (pratos) — proposta

Bônus por montar um **prato específico** (1 corte + 1 acompanhamento + 1 bebida
exatos). Lista de referência no player-aid; ter as 3 cartas na mão = bônus,
**somado** ao que cada carta já vale. É a mecânica nascida do tema que diferencia do
Sushi Go (combo _entre_ categorias, não set dentro de uma). 1ª passada:

| Prato                    | Corte      | Acompanhamento  | Bebida     | Bônus        |
| ------------------------ | ---------- | --------------- | ---------- | ------------ |
| **Prato Raiz**           | picanha    | farofa          | cerveja    | +10          |
| **Mineiro da Gema**      | costela    | feijão tropeiro | caipirinha | +6           |
| **Domingo em Família**   | fraldinha  | arroz           | suco       | +5           |
| **Espetinho de Esquina** | coração    | vinagrete       | guaraná    | +5           |
| **Fitness de Mentira**   | coxão duro | salada          | suco       | +3 (a piada) |

Na 1ª passada cada corte ancora um prato (usado uma vez) e queijo coalho, maionese
e mandioca ficam fora. A **2ª passada** (playtest digital) incorpora os três órfãos
com receitas de formas variadas e **sem bebida** — para não acoplar mais combos à
corrida da gelada:

| Prato                   | Receita                                | Bônus |
| ----------------------- | -------------------------------------- | ----- |
| **Espetinho de Boteco** | queijo coalho + linguiça + pão de alho | +4    |
| **Vaca Atolada**        | costela + mandioca                     | +2    |
| **Churrasco de Laje**   | coxão duro + maionese                  | +2    |

Não muda o deck, só adiciona uma camada de objetivo. Montar o prato exato é difícil
(3 cartas específicas de 7), daí o bônus alto — mas é mais um acelerador, cuidar de
runaway no playtest. Dá para pontuar mais de um prato; lista expansível (mais
pratos = mais alvos).

**Rebalanço (medido na simulação):** os pratos de 2 cartas fecham **5-6× mais**
que o Prato Raiz — a +3, o EV dos pares atropelava o do Raiz e todo mundo
perseguia os mesmos combos baratos. Ajuste: pares caem para **+2** e o Raiz sobe
para **+8 → +10**; com as taxas medidas os EVs ficam ~pareados (par: 2 × ~5,5r ≈
11r; Raiz: 10r). Os triplos do meio (+4 a +6) já escalonavam bem e não mudam.

### Composição do deck (quantas de cada — 1ª passada)

Calibrado para até 6 jogadores (pior caso: 6 × 7 = 42 cartas compradas + folga). As
razões de densidade importam mais que os totais.

**Comida (~68):**

| Categoria       | Cópias | Detalhe                                                                             |
| --------------- | ------ | ----------------------------------------------------------------------------------- |
| Carne           | 23     | picanha 3 · costela 4 · fraldinha 5 · coração 5 · coxão duro 6 (pirâmide invertida) |
| Bebida          | 12     | cerveja/guaraná/suco/caipirinha (só arte); todas contam como bebida                 |
| Acompanhamentos | 16     | 8 tipos × 2 cópias                                                                  |
| Linguiça        | 8      | comum (povão)                                                                       |
| Pão-de-alho     | 5      | incomum — segura o combo                                                            |
| Abacaxi         | 4      | incomum                                                                             |

**Eventos (19):** 13 tipos × 1 cópia + 6 cópias do neutro _Só Resenha_.
Sem repetir na partida (o neutro repete por design) → embaralha e saca ~7-8 do
topo.

Total ≈ 83 cartas (caixa pequena, ordem de grandeza do Sushi Go). Com 3-4
jogadores usa-se o mesmo deck e vê-se uma fração menor — variedade entre partidas.

## Cartas de evento

Uma por rodada, **a partir da 2ª** (sem evento na 1ª para não bagunçar a primeira
rodada). Altera a dinâmica da rodada.

Regra de tempo proposta: o evento é **revelado no início da rodada e modifica as
regras daquela rodada** (alguns exigem isso — ex. "churrasqueiro profissa" só faz
sentido sabido antes de começar). "Comprar" evento é confuso — proposta: **virar**,
não comprar.

Deck e variedade: **não se repete evento numa mesma partida** — saca-se um
subconjunto único (~7-8) de um deck de **~12-15 tipos**, então cada jogo vê um
elenco diferente. É a camada de replay/humor/localização.

**Diluição (playtest digital):** um evento diferente em TODA rodada pesava —
cansaço de regra nova atrás de regra nova. O deck ganhou **6 cópias do neutro
_Só Resenha_** (rodada sem regra especial): ~1/3 das rodadas sai tranquila, e o
evento que vem depois de uma rodada quieta volta a ter impacto. Alavanca:
`neutralEventCopies` em `config.ts`; na mesa física, é literalmente 6 cartas a
mais no deck de eventos.

Dois trilhos de design para qualquer evento novo:

- resolve no início da rodada;
- **simétrico na contagem de cartas** (todos +1 ou todos net-0) — preserva o fim
  "todos com 7 juntos". Pode mexer em _quais_ cartas, ordem, informação; não pode
  fazer a contagem divergir entre jogadores.

Deck atual (13 tipos + o neutro, saca ~7-8 por jogo):

**Neutro (várias cópias — diluição):**

- _Só Resenha_ — rodada tranquila, sem regra especial; só o papo e a brasa.

**Perda / caos (raros, alto swing):**

- _Não alimente os animais_ — todos descartam 1 carta da mão.
- _O Rex atacou!_ — o cachorro come as sobras da mesa (o carryover é descartado);
  a rodada abre com buffet todo novo. Versão domada do evento dropado.

**Procedimento / ordem:**

- _Os últimos serão os primeiros_ — inverte a ordem da rodada.
- _Brinde!_ — a rodada começa por quem tem mais **bebida** na mão (qualquer uma;
  desempate: mais carne). Segundo motivo para disputar bebida, sem premiar álcool
  especificamente.
- _Esqueceram de mim_ — quem seria o primeiro da rodada vira o último e escolhe uma
  das cartas que restarem. Com abundância (o último ainda escolhe entre várias) é
  brando — evento de ordem leve; alvo único, mas o primeiro rotaciona.
- _Depois acaba_ — passar é proibido: na sua vez você vira a carta do topo e é
  obrigado a pegá-la (flip-and-take). Mata a opcionalidade por uma rodada (pura
  urgência).

**Buffet (tamanho):**

- _Primo Rico_ — buffet com 2 cartas a mais (M+2): fartura, escolha sobrando.
- _Acabou o carvão_ — buffet com 2 cartas a menos (2N − 2): escassez relativa,
  passar fica arriscado. Espelho do Primo Rico.

**Informação:**

- _Churrasqueiro profissa_ — todo o buffet revelado no início (draft de info
  perfeita).

**Troca / distribuição:**

- _Amigo secreto_ — todos passam 1 carta da mão para o próximo (o "presente").
- _Álbum da Copa_ — você troca 1 carta da mão com a de um jogador à escolha
  (qualquer um da mesa; recebe carta aleatória da mão dele).
- _Abre a boquinha_ — a carta que você escolhe vai para a pessoa do lado (você
  compra para o vizinho e recebe do outro lado). Net +1 cada.
- _As sobras de ontem_ — ao comprar, cada um põe 1 carta da mão num monte virado
  para baixo; ao fim da rodada o monte é embaralhado e semeia a próxima (amplifica
  o carryover de núcleo).

Dropados: _fura-fila_ (sortear é trabalhoso), _caiu na brasa_ (sem graça),
_rodízio_ (redundante com o amigo secreto), _Anfitrião pão-duro_ e
_Aqui não é uma democracia_ (cortes do dono — humor/swing, por hora);
_tá pegando fogo, bicho!_ (cortado no playtest digital: swing puro sem nenhuma
decisão, a rodada se resolve sozinha; a expressão fica como gíria da marca).
_O Rex atacou_ voltou em versão domada (come só as sobras da mesa).
_Foto pro Story_ saiu no playtest digital: as mãos ficaram **abertas por padrão**
(mais leitura de mesa, menos memória), o que o tornou redundante.

## Resolvido

- **Mão = coleção acumulada**, e os eventos mexem nela. Confirmado. (Evento pode
  destruir combo construído — aceito, faz parte do caos.)
- **Nº de jogadores: 3-6.**
- **Fim de jogo: todos com 7 cartas na mão.** Funciona porque todo evento é
  simétrico na contagem (todos -1, ou todos net 0) e resolve no início da rodada
  — então os jogadores chegam a 7 juntos, sem dessincronizar. Rodadas que zeram o
  ganho (não alimente, as sobras) só esticam o jogo em nº de
  rodadas; o prato final é sempre exatamente 7 cartas. Vantagem dupla: a duração
  flexa com o caos e o tableau fixo de 7 simplifica muito o balanceamento da
  pontuação. Cartas-utilidade (pão-de-alho e abacaxi guardado) contam para as 7 —
  gastar um slot nelas tem custo de oportunidade real. Maior pontuação ganha.

## Questões em aberto

Regras de precisão resolvidas e embutidas nas seções: pão-de-alho não retroage e
faz par com um único corte; "depois acaba" = flip-and-take; "esqueceram de mim"
escolhe uma das que restam; o buffet nunca fica vazio na decisão (revela-se no início da vez);
gelada sem desempate (empatados recebem integral). Primeiro jogador inicial:
sorteio (ou o último que fez churrasco).

Resta só **balanceamento** (só o playtest fixa):

- Valores de pontuação (1ª passada) e densidade de cada carta no deck.
- Ajuste da gelada por nº de jogadores (esticar colocações com 5-6); face 1 vs
  0/pudim puro.
- Tamanho do monte quando _as sobras_ injeta cartas.

## Validação (personas sintéticas)

Quatro personas LLM (homem/mulher × hobbyist/casual, 20-40, BR) reagiram ao
conceito. Hipótese, não evidência de mercado — útil para aflorar reações óbvias e
armadilhas, não substitui playtest.

Convergência: o tema é o ativo (unânime); o núcleo é próprio, não reskin (comparado
a Port Royal / Diamant / Coloretto, não Sushi Go); **sobrecarga de pontuação foi o
medo unânime** (hobbyists deram 8/7, casuais 6/6,5 — hoje soa a filler de hobbyist
vestido de jogo de família). As mulheres sinalizaram o humor político como pavio
numa mesa de família; o casual apontou que o jogo roda melhor _antes_ do churrasco
que no auge dele.

Respostas dadas: regra impressa na carta (legibilidade); humor político removido
(amigo secreto, democracia dropada); negativo do acompanhamento removido;
fim-de-jogo resolvido (utilidades contam). Mantido pendente de playtest: nº de
categorias (não cortado), variância dos eventos, abacaxi.

### 2ª onda — stakeholders (editor, professor de regras, parente 50+, designer, cultural)

Notas: editor 5 · professor 6 · parente 6 · designer 4 · cultural 8. Lentes
não-jogador acharam problemas mais fundos que os jogadores.

- **Núcleo em risco (designer):** com M = N+2, "passar" pode ser dominado a 5-6
  jogadores (você alimenta o buffet e a vez dos rivais sem consumir; a carta não
  sobrevive até voltar). Refina/desafia a conclusão "abundância resolve" — talvez M
  escalar com N, ou compensação a quem passa. Item nº 1 do playtest.
- **Sinal do primeiro jogador pode estar invertido:** revelar primeiro com buffet
  mínimo pode ser DESvantagem — o que tornaria saideira/esqueceram de mim
  mal-calibrados. Testar.
- **Runaway / kingmaking (designer):** aceleradores convexos (acompanhamentos, pão
  multiplicador) sem freio; eventos de transferência direcionada (abre a boquinha,
  amigo secreto, álbum da copa) habilitam kingmaking; "empate da bebida recebe
  integral" vira bug a 5-6 (injeta +24, anula o freio do −4) → considerar dividir.
- **Camada de pontuação = decalque do Sushi Go (editor):** núcleo é próprio, mas
  pudim/wasabi/sashimi/chopstick mapeados 1:1 — falta UMA mecânica de scoring
  nascida do tema pra fugir do "reskin".
- **Negócio (editor):** vê economia presa ao filler nacional e o caso real na LINHA
  (Boteco, Feijoada...). Ressalva do dono (correta): grelhar carne é universal (BBQ,
  asado, braai) — o motor exporta via edições localizadas, uma linha **horizontal**
  por país, não só vertical por prato BR. Co-desenvolvimento, não aquisição de
  conceito.
- **"Família" é falso/contraditório (parente, cultural, casual):** na prática é
  adolescente+adulto; álcool como MOTOR (saideira/maioria) + 14+ briga com o pitch.
  Desacoplar álcool de vantagem (saideira = mais bebida qualquer, incl.
  guaraná/suco) resolve sem custo de graça.
- **Buracos de regra (professor) — resolvidos:** sobras ficam no buffet;
  revela-e-pega (não precisa pegar a revelada); abacaxi (ação adicional). Sobre
  "regra na carta", o dono tem razão: a carta imprime regra e curva (+8/+4/−4;
  1/3/7/12/18/25) como o Sushi Go — o resíduo é só a contagem no fim, normal do
  gênero. Player-aid é conforto, não obrigação; texto de evento imperativo com o
  nome fofo de subtítulo continua valendo.
- **Tema é autêntico e nacional (cultural, 8/10):** ativo protegido; cuidar só pra
  itens regionais (coalho/tropeiro/mandioca) não virarem cartas-lixo e o humor não
  punir pra baixo (sobras/fome do perdedor).

Decisões pós-validação — **resolvidas:** álcool fora do motor (_Brinde!_); empate da
bebida divide o bônus, não o −4; posicionamento adolescente/adulto; buracos de regra
(sobras no buffet, revela-e-pega, abacaxi); **passar fica como está** (o dono
considera que funciona — verificar no playtest); **combo "prato" definido** (ver
Combos); nome sem lead, só "Churrasco". **Ainda abertas:** eventos de transferência
sem escolha de alvo (anti-kingmaking, playtest); a linha de produtos.

## Viabilidade comercial: plataforma, licenciamento, produção

Avaliação de como o Churrasco chegaria ao mundo (origem da pergunta: "dá pra
publicar no Board Game Arena?"). Conclusão guarda-chuva: o gargalo nunca é
técnico nem de produção — é a régua de craft (blind playtest) e a distribuição.
Cartas são o formato mais barato de produzir e o mais fácil de pitchar que
existe; isso joga a favor.

### Plataforma digital (BGA e afins)

Board Game Arena **não é sandbox de protótipo** — é canal de distribuição de
jogos comerciais já publicados. A regra que mata o uso atual ([doc de
licenças](https://en.doc.boardgamearena.com/BGA_Game_licenses)): jogo que não
pode ser comprado **não passa de alpha privado** — jogável só com amigos
convidados, nunca chega ao lobby público (os 10M+ jogadores). Eles inclusive
desencorajam explicitamente o designer amador que quer usar a plataforma pra
playtestar. Ou seja: BGA não é ferramenta de teste do Churrasco.

- **Quando faz sentido:** fase 3, **depois** de o jogo virar comprável
  (auto-publicação ou crowdfinanciamento). Aí o jogo "buyable" deixa você-editor
  aprovar a ida ao público, e o BGA vira **motor de descoberta/vendas** (joga
  online, gosta, compra a caixa) — que é pra isso que ele serve.
- **Implementação é viável pra mim:** sendo front-end dev, JS/HTML/CSS/inglês já
  estão cobertos; sobra PHP + SQL + o framework idiossincrático (máquina de
  estados, componente `Deck` em PHP que gerencia baralho/mão/embaralhar — encaixa
  num jogo de cartas). Curva real, não proibitiva. Ressalva: o código fica com o
  BGA (trabalho voluntário, não pago).
- **Playtest remoto agora** (o que eu realmente preciso, isolado e sem grupo
  local): **Screentop.gg** (navegador, grátis, monta card game custom sem código
  — melhor encaixe), **Tabletopia** (tier grátis, focado em board game),
  **Tabletop Simulator** (Steam, pago, scripting Lua). Qualquer um entrega o mesmo
  que o alpha do BGA por ~1% do esforço.

### Caminho ao mercado: três vias, foco em licenciar

- **1. Licenciar pra editora (autor):** desenho + playtest; a editora banca
  produção, distribuição e marketing; eu recebo royalty. Não exige ser insider —
  a cena BR de design nacional é pequena e porosa (PaperGames, Grok, Conclave,
  Buró, Ace Studios publicam autor nacional; Galápagos/Devir só localizam gringo).
  Tema brasileiro é atrativo pra elas. **Via escolhida.**
- **2. Self-publishing (empreendedor):** via Catarse, controle e teto maiores,
  mas vira microempresa de manufatura+logística+marketing, e a campanha é ganha
  pela audiência pré-construída, não pela qualidade do jogo. **Descartada** (não
  planejo carreira nisso) — fica como plano B.
- **3. Insider:** não é via, é acelerador das outras duas, conquistável em 1-2
  anos de Ludopedia/convenção. **Descartado** pelo mesmo motivo.

Posição ideal pra licenciar: salário em USD, o jogo não precisa pagar aluguel —
dá pra jogar o jogo longo, que é quando design de tabuleiro funciona (hobbyista
com emprego estável). Expectativa honesta: o primeiro design costuma ser o de
treino; o Churrasco pode ser a prática, e tudo bem.

### Funil de pitch (de um sócio da Grok Games)

Processo BR descrito por Rafael "Parma" Verri
([vídeo](https://m.youtube.com/watch?v=Bu6cGQ85ytQ)):

- **Sell-sheet (1 página A4) → pitch de 10-15 min → decisão.** Remoto-amigável
  (e-mail + vídeo + link Tabletopia) — bom pro isolamento, não exige convenção.
- O sell-sheet leva: tema, mecânicas em overview, condição de vitória, nº de
  jogadores, tempo de partida, faixa etária, frase-gancho, **lista de
  componentes** e contato. **Não** precisa de arte pronta — a editora cuida disso.
- **Lista curta de componentes é vantagem minha:** "lista enorme já é motivo pra
  cair fora". Cartas + caixa + manual passa o filtro de viabilidade na hora.
- **Primeiro jogo é OK**; o que avaliam é o repertório do autor como jogador
  (jogo moderno, não só Catan/War).
- **Roubo de ideia é medo infundado:** regra não é patenteável, mas o mercado se
  autorregula (copiar dá mais trabalho que assinar; quem rouba queima). Bate com a
  seção _Originalidade / risco legal_.
- **Pré-requisito pra pitchar:** mecânica sólida, blind playtest com gente variada
  (não só amigos/família), manual pronto, protótipo jogável.
- **Royalty** (confiança média): padrão global ~5-8% do atacado — poucos reais por
  cópia; no BR tende a igual ou menor, com tiragens de 1-3 mil num primeiro título.
  Um primeiro jogo licenciado rende de centenas a poucos milhares de reais no total
  da vida do título. Hobby OK, renda não. Confirmar o número com autores na
  Ludopedia antes de assinar.

### Produção: simulação de custos

Premissas: ~83 cartas + caixa + manual (porte tipo Sushi Go); câmbio ~R$ 5,5/US$;
importação na NCM **9504.90.90** (jogos) — **II 18%, IPI 13%, PIS 2,1%, COFINS
9,65%** ([Fazcomex](https://ncm.fazcomex.com.br/95049090-outros/)) + **ICMS ~17%**
(ES). Os tributos **cascateiam** (cada um entra na base do seguinte; ICMS "por
dentro") → ~**1,75× o CIF** só de imposto, antes de frete, AFRMM (25% do frete),
Siscomex e despachante. Regra de bolso: **landed ≈ 2× o FOB**.

**Cenário A — tiragem pequena nacional** (Copag personalizado, ou gráficas tipo
Atual Card / Paulista Cartões). Sem importação, MOQ baixíssimo, rápido, dá pra
iterar. Estimado, exige cotação (confiança baixa-média):

| Tiragem | R$/un. (est.) | Total (est.) |
| ------- | ------------- | ------------ |
| 100     | 40-55         | 4.000-5.500  |
| 300     | 25-38         | 7.500-11.000 |

**Cenário B — tiragem comercial na China.** FOB ancorado em cotações reais:
LongPack ~US$ 0,82/un. e PrintNinja US$ 2,97/un. a ~2.000 cópias de card game
([Reddit](https://www.reddit.com/r/tabletopgamedesign/comments/132azp5/cost_of_manufacturing/));
QinPrinting/Panda no meio (MOQ 200, 300gsm, sem taxa de molde). Confiança média:

| Tiragem | FOB US$/un. | Landed BR R$/un. (~2× FOB + despacho) |
| ------- | ----------- | ------------------------------------- |
| 500     | 3,0-4,0     | 40-55 (frete/despacho mal diluídos)   |
| 1.000   | 2,0-3,0     | 28-38                                 |
| 2.000   | 1,3-2,0     | 18-26                                 |
| 5.000+  | 0,8-1,3     | 11-16                                 |

Fixos de importação (despachante, Siscomex, AFRMM): ~R$ 1.500-3.000 por embarque,
só diluem em volume. (Como CNPJ no regime certo, IPI e ICMS viram crédito
recuperável; pra player pequeno/one-off, trate como custo.)

**Leitura:** o muro alfandegário come a vantagem da China em volume baixo. A ~1.000
unidades a China-landed empata ou perde pra gráfica nacional, com muito mais dor de
cabeça (3-4 meses, frete marítimo, risco de despacho). A China só compensa **acima
de ~3-5 mil unidades** + crowdfunding (levanta a grana antes do MOQ e mata o risco
de estoque). Regra: **nacional até ~1k, China acima de ~3k.**

Amarração: se eu **licenciar**, nada disso é custo meu — é da editora (que tem CNPJ,
recupera crédito, importa em volume e distribui). A simulação serve só pra (a) ter a
economia do plano B via Catarse e (b) ler um royalty justo, sabendo que a editora
produz a ~R$ 12-30/un.
