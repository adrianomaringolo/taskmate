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
| `--brand` (preenchimento, ação primária) | `oklch(0.660 0.135 62)` | `oklch(0.755 0.135 64)` |
| `--brand-hover` | `oklch(0.615 0.140 62)` | `oklch(0.800 0.130 64)` |
| `--brand-ink` (texto/link em cima da página) | `oklch(0.485 0.112 58)` | `oklch(0.800 0.130 64)` |
| `--on-brand` (rótulo sobre preenchimento) | `oklch(0.240 0.030 62)` | `oklch(0.200 0.030 62)` |

Duas decisões deliberadas:

1. **`--brand` no claro é L 0.660, não L 0.700.** O valor da semente (0.700)
   dava 2.76:1 contra o branco — abaixo dos 3:1 de UI não textual, ou seja, um
   checkbox preenchido cuja borda desaparece. 0.660 dá 3.22:1.
2. **O rótulo sobre âmbar é tinta escura, não branco.** Branco sobre âmbar
   L 0.66 não alcança 4.5:1 sem escurecer o âmbar até virar marrom. Tinta
   escura sobre âmbar dá 5.13:1 e lê como latão/marca-texto, não como botão
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
  padrão só, em tudo. `--focus` é `--brand-ink` no claro (3.6:1 contra branco).
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
