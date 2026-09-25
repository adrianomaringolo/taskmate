# Instagram — Taskmate

Regras de identidade visual e voz para os posts do Instagram do Taskmate. A skill
`instagram-post` (genérica, mora em `~/Projects/claude-skills/skills/instagram-post`) lê
este arquivo como fonte de verdade. O mundo visual é o do app: ver `DESIGN.md` e
`web/src/styles/tokens.css`, que mandam se algo aqui divergir.

---

## Conta e marca

- **Handle**: nenhum nos slides. A marca aparece como logo (tique + "Taskmate"), e o
  endereço `get-taskmate.web.app` só no fecho.
- **O que é**: um gerenciador de tarefas pessoal, com grupos, listas e notas. Captura em uma
  tecla, sem conta e sem servidor. Funciona sem internet e sincroniza pelo Google Drive da
  própria pessoa, se ela quiser.
- **Para quem**: quem tem a cabeça cheia de pendências soltas (trabalho, casa, estudos) e
  quer um lugar calmo para despejar tudo e decidir depois.
- **Nota recorrente**: capturar e organizar são dois momentos. Primeiro tire da cabeça,
  depois decida o dia com calma.

## Templates

O projeto ainda não tem templates. O arquivo de marca sozinho basta; quando um formato se
repetir, rode `/instagram-post criar-template`.

## Tipos de post

- **Lançamento / novidade**: um recurso ou versão nova. Mostra a UI real (tarefas de
  exemplo), uma ideia por slide, e fecha com o endereço.
- **Método**: uma ideia de organização (capturar agora, triar depois, prazo para o que não
  tem). O app aparece como exemplo, não como anúncio.
- **Dica de uso**: um atalho ou comportamento concreto (`N` abre a captura, "amanhã !alta"
  no texto vira prazo e prioridade). Post único ou carrossel curto.

## Voz da marca

- **Tom**: calmo, concreto, direto, gentil. Frases curtas, como a página de produto
  ("Sua cabeça não é lugar de guardar tarefa.").
- **Nunca**:
  - Hype de produtividade: nada de "10x mais produtivo", "hack", "rotina de CEO",
    "domine sua agenda".
  - Promessa que o app não cumpre: **não** dizer "criptografado" (não é), "com IA" (não
    tem), "em tempo real entre pessoas" (é pessoal, não colaborativo).
  - Urgência ou escassez: sem "corra", "por tempo limitado", "últimas vagas", caixa alta
    gritando.
  - Jargão técnico nos slides: CRDT, Automerge, PWA, IndexedDB ficam fora dos slides
    (podem ir na legenda, com explicação).
- **Termos do app**: use os nomes reais das telas, com inicial maiúscula: Entrada, Hoje,
  A revisar, Notas, Lixeira, Quadro, Calendário.
- **pt-BR**: imperativo culto ("Anote", "Decida", "Abra"), no máximo um travessão por
  slide (prefira ponto ou dois-pontos), ponto final em frase declarativa.

## Paleta

Só tema claro, em todos os slides (é o padrão do app). O âmbar é para o que está ativo ou é
ação: nunca como fundo chapado de slide.

| Papel | Hex | Token do app |
|---|---|---|
| Fundo | `#ffffff` | `--bg` |
| Superfície (lateral, painéis, cartões) | `#f5f7fa` | `--surface` |
| Superfície 2 (campos) | `#eef0f3` | `--surface-2` |
| Fio de 1px | `#dde0e4` | `--line` |
| Fio forte | `#c9ccd1` | `--line-strong` |
| Texto | `#161a1f` | `--ink` |
| Texto secundário | `#4d535a` | `--ink-2` |
| Meta / legenda | `#6b7178` | `--ink-3` |
| Âmbar (preenchimento, CTA, checkbox marcado) | `#cd8134` | `--brand` |
| Âmbar texto (link, destaque em texto) | `#a15f27` | `--brand-ink` |
| Tinta sobre âmbar | `#25170b` | `--on-brand` |
| Atrasada (sempre com ícone) | `#c51d28` | `--danger` |
| Grupos (ponto de 8px, nunca fundo) | `#4f84ba` cobalto · `#519160` verde · `#8e70b0` violeta | `--g-*` |

- **Âncora**: branco frio + neutros azulados. **Acento**: âmbar, uma poça só por slide.
- Rótulo sobre âmbar é sempre `#25170b`, nunca branco.

## Tipografia

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

- **Família única**: Inter.
- **Títulos**: 600–650, `letter-spacing: -0.032em`, `line-height: 1.06`, 84–104px na capa,
  64–76px nos internos. `text-wrap: balance`.
- **Corpo**: 400, 32–36px, `line-height: 1.45`, cor `#4d535a`.
- **Eyebrow**: 600, 26px, cor `#a15f27`, sentence case (sem caixa alta).
- **UI de exemplo**: na escala do app ampliada ~2,2× (título de tarefa ~31px, meta ~27px),
  `font-variant-numeric: tabular-nums` em datas e contadores.

## Elementos de marca

- **Logo**: o tique da marca + "Taskmate", em SVG inline (paths de `web/produto/index.html`:
  `M3.4 10.4 5.5 12.7 10.8 5.7` e `M12.9 2.9 13.9 1.6`, viewBox 16, traço âmbar
  `#cd8134`, 2.25, pontas redondas). Na capa (56px) e no fecho (72px). Nos internos, só o
  tique pequeno (28px) no canto superior esquerdo.
- **Assinatura dos slides internos**: o fio de 1px da página de produto. Uma linha
  horizontal `#dde0e4` separando o texto do exemplo de UI.
- **Marcador de carrossel**: barras de 6px de altura no rodapé, centradas. Ativa em âmbar
  `#cd8134` (40px), inativas em `#dde0e4` (16px). Fica fora do post único.
- **CTA**: botão do app, com fundo `#cd8134`, texto `#25170b` 650 e raio 12px. Endereço
  `get-taskmate.web.app` abaixo, em `#a15f27`.
- **Fundo**: branco liso. A metade de baixo pode usar `#f5f7fa`, ecoando a lateral do app.
  Sem gradiente, sem blob.
- **Sombra**: só nos "cartões" de UI flutuante (diálogo, toast):
  `0 12px 32px rgba(22,26,31,.10), 0 2px 6px rgba(22,26,31,.06)`.

## Ícones

- **Lucide** (https://lucide.dev), paths copiados de `node_modules/lucide-static/icons/`,
  nunca desenhados à mão. Wrapper padrão (`viewBox="0 0 24 24"`, `stroke-width="2"`,
  pontas redondas). Cor `#6b7178` em UI e `#a15f27` quando é destaque.
- A única exceção é a marca (tique), que é do app.

## Fotos

- O conteúdo principal é a UI real do app, recriada em HTML com tarefas de exemplo
  (rotule "Tarefas de exemplo" quando parecer dado real).
- **Única foto da marca**: quadros do vídeo do hero da página de produto
  (`web/public/produto/hero.mp4`, Cup of Couple no Pexels, ver `ATTRIBUTION.md`): parede
  lisa, poça de luz de janela, aparador com livros. Extraia com
  `ffmpeg -ss 4 -i web/public/produto/hero.mp4 -frames:v 1 -vf "crop=864:1080:X:0,scale=1080:1350"`,
  escolhendo `X` para o texto cair na parede lisa, sem folhas nem objetos atrás dele.
- Texto sobre a foto usa as cores normais (`#161a1f`, `#2f343a`), nunca branco, com um véu
  branco no topo (`rgba(255,255,255,.72)` → transparente aos 62%). Sem scrim escuro.

## Acessibilidade

- Corpo de texto no mínimo `#6b7178` sobre `#ffffff` (4.95:1) ou `#f5f7fa` (4.62:1).
- Nunca texto âmbar `#cd8134` sobre branco (3.09:1, só para preenchimento/UI). Texto em
  âmbar usa `#a15f27`.
- Estado nunca só por cor: atrasada = ícone + texto, concluída = checkbox + tachado.

## Estrutura de arquivos

| O quê | Caminho |
|---|---|
| HTML dos slides | `instagram-posts/html/post-NN/` |
| PNGs exportados | `instagram-posts/output/post-NN/` |
| Origem do logo | `web/produto/index.html` (SVG inline da marca) |
| Script de export | `node instagram-posts/scripts/export.mjs post-NN [--slides 1,3]` (gera os PNGs e o `caption.md`) |
| Índice de posts | `instagram-posts/POSTS.md` |

## Referências no repo

- `DESIGN.md`: paleta, tipografia, marca, voz da página de produto.
- `web/src/styles/tokens.css`: tokens (fonte da verdade das cores).
- `web/produto/index.html`: copy e sequência do método (problema → capturar → triar → Hoje).
