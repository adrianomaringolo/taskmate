# Design

Sistema visual do Taskmate. Toda decisão aqui é verificável: os tokens de cor
vivem em `web/src/styles/tokens.css` e passam por `npm run test:tokens`
(`tools/contrast.mjs`, 47 checagens de contraste e gamut).

## Theme

**Claro por padrão, escuro real disponível, respeitando o sistema.**

A escolha vem da cena de uso, não de preferência: o usuário abre o app durante
o dia, na mesa, com luz ambiente, em sessões de segundos. Escuro em ambiente
claro obriga a pupila a se readaptar a cada visita — custo real para uma
ferramenta de visita rápida. O escuro existe porque trabalho pessoal acontece à
noite também, e é um tema de primeira classe, não um filtro invertido.

Preferência persiste em `localStorage` com três estados: `system` (padrão),
`light`, `dark`.

## Color

**Estratégia: Restrained.** A superfície é branco puro. A marca aparece em
menos de 5% da tela e sempre significa "isto está ativo/selecionado agora" ou
"esta é a ação primária". Nada de preenchimento chapado decorativo.

A frase que ancora a paleta: *mesa escandinava às 15h — papel branco frio, uma
lâmpada de latão, uma única poça de luz quente.* O frio é a arquitetura
(superfícies, neutros levemente azulados em h 255); o quente é o foco (âmbar
h 62). Os dois nunca disputam: onde há âmbar, não há outra cor.

### Superfícies e tinta

O corpo é `oklch(1 0 0)` — branco literal, cromaticidade **zero**. A barra
lateral usa um neutro frio um passo abaixo, criando a segunda camada que o
registro de produto pede sem recorrer a sombra ou borda pesada.

| Papel | Claro | Escuro |
|---|---|---|
| `--bg` (conteúdo) | `oklch(1 0 0)` | `oklch(0.165 0.008 255)` |
| `--surface` (lateral, painéis) | `oklch(0.976 0.004 255)` | `oklch(0.205 0.009 255)` |
| `--surface-2` (hover, campos) | `oklch(0.955 0.005 255)` | `oklch(0.245 0.010 255)` |
| `--line` (fio de 1px) | `oklch(0.905 0.006 255)` | `oklch(0.315 0.011 255)` |
| `--ink` (texto) | `oklch(0.215 0.012 255)` | `oklch(0.955 0.004 255)` |
| `--ink-2` (secundário) | `oklch(0.440 0.014 255)` | `oklch(0.755 0.011 255)` |
| `--ink-3` (meta, placeholder) | `oklch(0.545 0.014 255)` | `oklch(0.655 0.013 255)` |

`--ink-3` é o piso: 4.95:1 no conteúdo, 4.62:1 na lateral. Placeholder usa
`--ink-3`, **não** um cinza mais claro — placeholder é texto e obedece 4.5:1.

### Marca

| Papel | Claro | Escuro |
|---|---|---|
| `--brand` (preenchimento, ação primária) | `oklch(0.670 0.130 62)` | `oklch(0.790 0.130 64)` |
| `--brand-hover` | `oklch(0.625 0.135 62)` | `oklch(0.815 0.125 64)` |
| `--brand-ink` (texto/link em cima da página) | `oklch(0.550 0.110 58)` | `oklch(0.805 0.120 64)` |
| `--on-brand` (rótulo sobre preenchimento) | `oklch(0.220 0.030 62)` | `oklch(0.200 0.030 62)` |

Duas decisões deliberadas:

1. **`--brand` no claro tem teto real: L 0.678 a essa matiz/croma.** Acima
   disso, o preenchimento cai abaixo dos 3:1 de UI não textual contra
   `--bg` branco puro — um checkbox preenchido cuja borda desaparece. Ficou
   em 0.670 (3.09:1), com uma margem de segurança pequena de propósito: é
   o mesmo teto que limita o quanto a marca pode clarear no claro, ponto
   final — nem trocar matiz nem reduzir croma abre muito mais espaço (o
   teto varia entre L 0.671 e L 0.682 em toda a faixa 46–90°). Foi
   `--brand-ink` — o texto/link, sem esse piso de 3:1 não textual — quem
   ganhou a clareada visível: de L 0.485 para L 0.550.
2. **O rótulo sobre âmbar é tinta escura, não branco.** Branco sobre âmbar
   não alcança 4.5:1 sem escurecer o âmbar até virar marrom. Tinta escura
   sobre âmbar dá 5.62:1 e lê como latão/marca-texto, não como botão
   genérico colorido.

### Semântica de estado

`--danger` `oklch(0.53 0.20 25)`, `--success` `oklch(0.53 0.12 152)` no claro;
`oklch(0.68 0.18 25)` / `oklch(0.72 0.13 152)` no escuro. Estado nunca é
comunicado só por cor: atrasado é ícone + texto, concluído é checkbox marcado +
texto esmaecido + tachado.

### Acentos de grupo

Oito matizes com **L e C idênticos** — `oklch(0.60 0.100 h)` no claro,
`oklch(0.74 0.125 h)` no escuro — em h 62 / 30 / 355 / 305 / 268 / 232 / 195 /
150. O C de 0.100 é o limite de gamut sRGB do matiz mais fraco (teal, 0.102 em
L 0.60): teto pelo elo mais fraco, para que nenhum swatch sofra clipping
silencioso e quebre a intensidade uniforme da família. O resultado é
propositalmente dessaturado — orientação periférica, não navegação por cor.

Aparecem como ponto de 8px na lateral e fio de 2px no cabeçalho da lista. Nunca
como fundo chapado.

## Typography

**Uma família.** `Inter var` quando disponível, caindo para a pilha
`system-ui` — sem carregamento de fonte web bloqueando o primeiro paint de uma
ferramenta que abre 20 vezes por dia. Números usam `font-variant-numeric:
tabular-nums` em contadores e datas para não haver dança de largura.

Escala fixa em rem, razão ~1.16 (produto tem muitos elementos de texto;
contraste exagerado gera ruído):

| Token | Tamanho | Uso |
|---|---|---|
| `--t-xs` | 0.75rem / 11.25px | contadores, meta em cima de meta |
| `--t-sm` | 0.8125rem / 12.2px | rótulos, datas, meta |
| `--t-base` | 0.9375rem / 14.1px | título de tarefa, corpo, inputs |
| `--t-md` | 1.0625rem / 16px | nome da lista na coluna |
| `--t-lg` | 1.375rem / 20.6px | título da tela |

Base de 15px no `:root`. Sem `clamp()` em nenhum lugar: DPI é consistente e um
título fluido que encolhe dentro de um painel fica pior, não melhor. Corpo de
notas limitado a 68ch.

## Icons

**Sempre Lucide, nunca desenhado à mão.** Todo ícone novo em `Icon.tsx` vem da
geometria real do Lucide — escalada de 24 para o grid de 16 unidades por
`tools/lucide-scale.mjs`, nunca digitada ou aproximada de memória. Parâmetro de
arco SVG escrito à mão é fácil de errar e difícil de revisar sem renderizar; foi
exatamente isso que produziu o ícone `cloudCheck` malformado que motivou essa
regra (ver `ATTRIBUTION.md` e o histórico do repositório). Antes de desenhar um
ícone novo, procure o equivalente em `node_modules/lucide-static/icons/` e passe
pelo script — mesmo para variações simples (uma seta, um traço a mais).

Só ficam desenhados à mão a marca (`mark`) e as composições sem equivalente no
Lucide — os ícones de calendário com grade de pontos (`today`/`upcoming`/
`calendar`) e simplificações deliberadas (`list`, por exemplo, lê melhor como
linhas de texto do que a lista com marcadores do Lucide para indicar notas).
Mesmo esses usam a mesma grade de 16 unidades e o mesmo traço 1.5 — nunca uma
curva nova inventada por conta própria.

### A marca

`mark` é um **tique cujo braço longo não para** — segue subindo num raio, com um
risquinho solto logo à frente da ponta que lê como faísca/impulso: tarefa feita,
e em movimento. Uma polilinha reta mais o traço curto, no mesmo grid e traço dos
outros ícones. Não é uma caixa de seleção (lê como controle de UI) nem três
barras (lê como o menu-sanduíche ao lado do qual ela aparece). Nos ícones do PWA
e no favicon é tinta escura sobre o campo âmbar — latão/marca-texto, não botão
colorido genérico. `tools/icons.ts` gera os PNGs a partir do mesmo caminho.

## Layout

App shell de duas colunas: lateral de 264px (a árvore grupo › lista) + coluna de
conteúdo. A coluna de conteúdo limita a lista de tarefas a 46rem e a centraliza
— linha de leitura curta é o que torna a triagem rápida.

Responsivo é **estrutural**, não fluido. Abaixo de 860px a lateral sai do fluxo
e vira gaveta sobreposta acionada por botão, com o conteúdo em largura total.
Nada de tipografia que encolhe.

Espaçamento em escala de 4px (`--s-1` a `--s-8`), com ritmo variado: 12px entre
linhas de tarefa, 24px entre blocos, 32px acima de cabeçalho de seção.

**Sem cards.** A lista de tarefas é uma lista com fios de 1px, porque linhas são
o afordamento correto para itens homogêneos e ordenáveis. Card aqui só
adicionaria borda e sombra em volta de cada linha.

### Escala de z-index

Semântica, nunca valor arbitrário:
`--z-base: 0` → `--z-sticky: 10` → `--z-drawer: 20` → `--z-overlay: 30` →
`--z-popover: 40` → `--z-toast: 50`.

Menus (cor do grupo, ações) usam a Popover API nativa, então escapam de
qualquer `overflow: hidden` ancestral sem portal manual.

## Components

Todo componente interativo tem os sete estados: default, hover, focus-visible,
active, disabled, loading, error. Vocabulário único em toda a superfície.

- **Foco**: `outline: 2px solid var(--focus)` com `outline-offset: 2px`. Um
  padrão só, em tudo. `--focus` é `--brand-ink` no claro (5.02:1 contra branco).
- **Botões**: raio 8px, altura 32px (compacto) / 36px (padrão). Três variantes:
  `primary` (preenchimento âmbar, tinta escura), `ghost` (transparente, hover em
  `--surface-2`), `danger` (texto vermelho, hover com tinte).
- **Checkbox de tarefa**: 18px, raio 5px, borda 1.5px em `--ink-3` (4.95:1). Ao
  marcar, preenche com `--brand` e desenha o tique em `--on-brand`.
- **Linha de tarefa**: 1px `--line` embaixo, hover em `--surface-2`, ações
  aparecem no hover mas ficam sempre no DOM e sempre alcançáveis por foco —
  esconder no `opacity: 0` sem manter foco é a falha clássica.
- **Estado vazio**: uma marca de 58px numa placa de 96px, uma frase que ensina o
  próximo gesto, e um botão quando há um próximo passo óbvio. A marca é um ícone
  Lucide — o mesmo idioma do set da interface, em tamanho maior — em
  `--illo-line` sobre `--illo-plate`. Sem matiz de marca: marca não é estado. O
  traço é afinado para 1.5 porque Lucide é desenhado para 16–24px e um traço de 2
  em 58px vira grafismo pesado. A placa existe porque um glifo de traço único
  nesse tamanho, sem apoio, flutua e parece ícone mal dimensionado; é azulejo
  atrás de glifo, não card. **Erro não é estado vazio e não recebe desenho.**
- **Carregando**: skeleton com a forma do conteúdo real, nunca spinner no meio
  da coluna.
- **Toast**: canto inferior, com "Desfazer" para exclusão de tarefa. 7s.

## Motion

150–220ms na maioria das transições, `cubic-bezier(0.22, 1, 0.36, 1)`
(ease-out-quint). Sem bounce, sem elastic, sem sequência de entrada da página —
o app carrega dentro de uma tarefa.

Movimento comunica estado e nada mais:

- **Concluir tarefa**: o tique risca em 180ms e o texto esmaece — confirma a
  ação sem interromper. A linha só sai da posição depois de 320ms, tempo de
  perceber o que aconteceu.
- **Recolher grupo**: `grid-template-rows` de 0fr a 1fr, 200ms. É layout, mas é
  exatamente a informação sendo transmitida.
- **Gaveta no mobile**: translate de 220ms, com backdrop em fade.
- **Toast**: entra com translate + fade de 200ms.

`prefers-reduced-motion: reduce` reduz tudo para fade de 1ms ou troca
instantânea, e o `transition` de propriedades de layout é zerado.

## Sincronização na interface

Um ícone no topo, quatro formas — nuvem cortada (só neste dispositivo), nuvem com
tique (em dia), nuvem (sincronizando, com fade lento em vez de spinner), triângulo
de alerta (erro, em `--danger`). O painel só abre quando pedido: um app de tarefas
não deve receber o usuário com um diálogo sobre armazenamento.

O estado "sincronizando" usa opacidade pulsante e não rotação. Rotação puxa o olho
para fora da lista; um fade diz "trabalhando" na periferia e desaparece sob
`prefers-reduced-motion`.

## Content

Interface em **português do Brasil**. Rótulos são verbos concretos no
infinitivo; contadores dizem o número, não "itens". Datas relativas humanas
("hoje", "amanhã", "atrasada há 3 dias") com a data absoluta no `title`.

Mensagem de erro diz o que aconteceu e o que fazer, na mesma frase, sem código:
"Não consegui salvar — o servidor não respondeu. Sua alteração continua aqui;
tentar de novo."

## Página de produto (`/produto/`)

A única superfície de persuasão do projeto, e ela **não troca de mundo**: mesmos
tokens (`tokens.css` importado direto), mesma família, mesmo âmbar só para o que
está ativo. O que muda é a composição.

- **Primeiro acesso vai para a página de produto.** Um script no `<head>`
  do `index.html` do app, antes de qualquer coisa gravar no storage, manda
  para `/produto/` quem ainda não tem `taskmate:visited`. Contam como visita:
  essa chave (gravada por qualquer link da página de produto para `/`),
  qualquer preferência `taskmate:`/`trellis:` de uma sessão anterior (quem já
  usa o app nunca é desviado) e URLs com propósito (`?capturar=`, o
  compartilhamento do Android). Storage bloqueado: sem redirecionamento, para
  não prender ninguém num laço. Enquanto redireciona, o `main.tsx` não monta o
  app. Os testes em `tools/` gravam a chave antes de abrir a página.
- **Hero de vídeo** antes do split: uma parede lisa às três da tarde, uma
  poça de luz de janela, vaso e aparador (vídeo do Pexels, ver
  `ATTRIBUTION.md`). É a frase da paleta em imagem. O texto fica na metade
  direita, sobre a parede lisa, sem scrim; como a parede é cinza médio, todo
  texto do hero usa `--ink`, nunca `--ink-2`. No escuro o vídeo é escurecido
  (`brightness(.42)`) e `--ink` vira claro. No celular o vídeo desce para a
  metade de baixo com máscara em gradiente e o texto fica sobre `--surface`.
  O vídeo só toca visível e nunca com `prefers-reduced-motion` (fica o
  pôster). A lentidão (0,6×, a luz no ritmo de uma tarde) vem embutida no
  arquivo, com quadros interpolados a 30 fps; desacelerar no navegador
  deixava a imagem em ~15 quadros por segundo, truncada. Ao
  rolar, o vídeo anda a 0,35× da página e o texto a 1×; parallax nunca no
  texto, e desligado com movimento reduzido.
- **Indicação de scroll:** pedida explicitamente, então é um link de verdade
  ("Ver como funciona", âncora para `#como-funciona`), não enfeite. A seta
  desce 4px e descansa (2,4s), parada com movimento reduzido, e o link some ao
  longo do primeiro terço do hero rolado.
- **O problema** (logo depois do hero, ato fixo de 6,5 telas): quatro passos de
  texto à esquerda, com manchetes entrando linha a linha. À direita, os
  mesmos cartões de tarefa atravessam três arranjos medidos de slots reais
  (CSS, não números no JS): nuvem espalhada que tremula mais conforme enche
  ("Sua cabeça não é lugar de guardar tarefa."), todos caindo numa Entrada
  com contador ("Primeiro, tire tudo dela."), redistribuídos em grupos
  ("Depois, organize do seu jeito.") e, por fim, ganhando prazo e barras de
  prioridade no canto do cartão ("E dê a cada coisa o seu quando."), com as
  cores do app: "hoje" em `--brand-ink`, prioridade alta em `--danger`. O nome
  só cede espaço quando o prazo chega; no celular ficam só os prazos. Posição é função do progresso; o
  tremor é o único movimento por tempo e para quando o cartão é capturado.
  Com movimento reduzido: sem tremor e troca de arranjo instantânea. No
  celular: 12 cartões com rótulo curto.
- **Split stage.** A tela é o app partido ao meio: Capturar à esquerda sobre
  `--surface`, Triar à direita sobre `--bg`. A divisória de 1px é o único
  cromo da página: carrega os rótulos de cada cena e a seta de foco. Sem
  barra de navegação, sem cards de feature.
- **Seta de foco:** um círculo âmbar com a seta do Lucide, fixo na tela
  depois do hero. Na demonstração ela anda pela divisória até a altura da
  demo que está se mexendo e aponta para esse lado (cima/baixo no celular);
  no problema aponta para os cartões; no fechamento sai da borda da barra
  lateral para o campo de captura. Cada cena tem sua sequência em `FOCUS`
  (`main.ts`), e as demos são temporizadas para que um lado se mexa de cada
  vez. Desliza e gira pelo caminho mais curto, com um pulso curto ao mudar de
  direção; com movimento reduzido, pula direto. Escondida no hero.
- **O fechamento é o app.** No fim do scroll a divisória desliza até 264px e o
  chão da esquerda vai junto, virando exatamente a barra lateral; a direita
  vira a coluna de conteúdo com um campo de captura real. O que o visitante
  digita ali vai para `/?capturar=` e cai na Entrada do app, já interpretado.
- **Nada pintado.** Toda linha, chip e destaque nas colunas é marcação gerada
  por `parse.ts` e `date.ts` sobre tarefas de exemplo (rotuladas como tal).
  Cada cena é função pura do progresso do scroll, então rolar para trás desfaz.
- **Cena calma (antes do fechamento):** à esquerda, quatro aparelhos
  (computador, notebook, tablet, celular) em ícones Lucide de traço fino e
  "No navegador ou instalado como app"; à direita, três fatos verificáveis
  (acesso restrito pelo escopo `drive.file`, sem servidor nosso, arquivo do
  usuário). Ícones em cinza, sem âmbar: nada ali é estado. Nenhuma promessa
  de criptografia, porque o app não criptografa.
- **Compartilhar | Tarefa ou nota** (depois de "cole uma lista"): um post
  de outro app (desenhado de propósito simples, sem copiar a interface do
  Instagram) com o botão Compartilhar, depois o diálogo real do app
  ("Compartilhado com o Taskmate / Guardar como tarefa ou como nota?",
  botões Tarefa e Nota) com Nota escolhida; à direita a nota chega em Notas
  com o toast "Nota criada.". A página avisa "No Android, com o app
  instalado", porque o Web Share Target só existe lá.
- **Detalhes | Etiquetas** (depois de Atrasadas): uma tarefa aberta com
  notas, prazo, prioridade, etiqueta e checklist sendo marcado, e o progresso
  "3/4" na própria linha; à direita a busca por "viagem" traz duas tarefas e
  uma nota, no formato da busca do app. As etiquetas são uma lista só porque
  a nota é uma tarefa por dentro (`allTags` em `doc.ts`).
- **Lixeira** (cena logo depois de Hoje): à esquerda uma tarefa é excluída e
  aparece o toast real do app (`"…" foi excluída.` + Desfazer), depois
  desfeita; à direita a Lixeira recebe o item e o devolve. Rótulos da
  divisória: "Desfazer | Lixeira".
- **Preferências** (depois de Quadro/Calendário): à esquerda uma miniatura do
  painel que passa de Claro para Escuro e liga o Texto ampliado sozinha, sem
  mexer no tema da página. Ela carrega cópia dos tokens do tema escuro e de
  `[data-vision='low']` (espelho de `tokens.css`; mude lá primeiro). À direita,
  o Markdown que o próprio `toMarkdown()` gera para os dados de exemplo, linha
  a linha, com botão para baixar o `.md`. Rótulos: "Aparência | Seus dados".
- **Marca no hero:** 1.75rem com o tique a 32px (traço 1.4 para manter o peso
  do conjunto), e embaixo "Seu companheiro de tarefas". CTA de 52px de altura
  e 1.0625rem, igual no hero e no fechamento.
- **Rolar sozinho:** botão no pé do hero e, depois dele, um botão fixo no
  centro inferior que alterna "Rolar sozinho" / "Parar a rolagem" (pílula
  neutra, não âmbar). A página desce a 0,15 altura de tela por segundo (cerca
  de 14 s por cena, ~3,5 min a página toda), medido em tempo real. Para no fim da
  página, no botão, com Esc, ou assim que o visitante rola por conta própria;
  acionado no fim, recomeça do topo.
- **Ritmo das cenas:** todas as janelas vivem em `SCENES` e têm a mesma
  largura (~2,1 telas; 11 cenas em 26 telas); a primeira é mais curta porque já aparece enquanto o
  hero sai. Medido: 1,7 tela legível por cena, 1,5 na primeira e na calma.
- **Atrasadas | A revisar** (depois de Hoje): três atrasadas adiadas uma a uma
  com os atalhos reais do app (Amanhã, 3 dias, 1 semana, 1 mês), o escolhido
  em âmbar, até "Nada atrasado."; à direita, "A revisar" com "Dar prazo"
  (Hoje, Amanhã, Em 1 semana). Atrasada é ícone + texto em `--danger`.
- **Atualização | Versão** (depois de Preferências): o toast real ("Uma versão
  nova do Taskmate está pronta." + Recarregar; o app nunca recarrega sozinho)
  e uma miniatura do Sobre com a versão e a data de compilação reais do build.
- **Assinatura no fechamento:** abaixo do CTA, um quadro discreto (fio de
  1px sobre `--surface`) com a foto do autor (quadrada, raio de 8px), "Criado com ♥ por Adriano
  Maringolo" e o link para adrianomaringolo.dev. O coração é o `heart` do
  Lucide em âmbar. A foto é um recorte do retrato real do portfólio, não a
  versão gerada por IA que também existe lá.
- **Quadro e Calendário** dividem uma cena: o quadro de um grupo à esquerda,
  o mês à direita, e a divisória troca os rótulos para "Quadro | Calendário".
  Na coluna do quadro, que fica sobre `--surface`, as colunas invertem para
  `--bg`. As janelas de todas as cenas vivem numa tabela só (`SCENES` em
  `web/src/produto/main.ts`); o HTML não tem números de progresso.
- **Tipografia de manchete** é a única exceção à escala fixa: `clamp()` entre
  1.9rem e 2.9rem, peso 640, tracking -0.032em. Só nas manchetes da página de
  produto; o app continua sem `clamp()`.
- **Motor:** scroll-craft (MIT, ver `ATTRIBUTION.md`), sem edição. Movimento
  só em `transform` e `opacity`; com `prefers-reduced-motion` as cenas trocam
  por opacidade e nada se desloca.
- **Celular:** a divisão vira horizontal (Capturar em cima, Triar embaixo) e o
  fechamento leva a divisória até o topo, onde ela vira a barra do app.

## Páginas legais (`/privacidade/`, `/termos/`)

Modo leitura: uma coluna de 44rem, medida de ~68ch, corpo em 17px com
entrelinha 1.65, seções numeradas com mais espaço acima do título do que
abaixo, e os tokens do app (tema claro/escuro e âmbar só em links). Sem
animação e sem nada além do texto. O conteúdo descreve só o que o código faz
(ver `drive.ts`, `storage.ts`, `notify.ts`); qualquer mudança em dados,
permissões do Google ou terceiros exige atualizar a política e a data no topo.
Links no fechamento da página de produto e no painel Sobre do app.

