# Procedência dos ícones e marcas

## Lucide — ícones dos estados vazios

As cinco marcas dos estados vazios vêm do [Lucide](https://lucide.dev),
licenciado **ISC**.

**A ISC exige atribuição.** Diferente de domínio público, ela condiciona o uso à
retenção do aviso de copyright em todas as cópias. Por isso o aviso aparece em
três lugares, e nenhum deles é decorativo:

1. Como comentário no topo de cada SVG gerado em
   `web/src/assets/illustrations/` — os arquivos são inline no bundle, então o
   aviso viaja junto com o app compilado.
2. Em `assets/lucide-LICENSE.txt`, cópia integral da licença.
3. Aqui.

```
Copyright (c) 2026 Lucide Icons and Contributors
ISC License — texto completo em assets/lucide-LICENSE.txt
```

| Arquivo | Estado | Ícone Lucide |
|---|---|---|
| `inbox-empty.svg` | Entrada vazia | `inbox` |
| `list-empty.svg` | Lista vazia | `list-todo` |
| `day-clear.svg` | Hoje sem prazos | `coffee` |
| `week-free.svg` | Semana sem prazos | `calendar-days` |
| `not-found.svg` | Busca sem resultado, lista inexistente | `search-x` |

`npm run illustrations` regenera a partir de `lucide-static` (devDependency, não
vai para o bundle): remove `width`/`height`/`class`, afina o traço de 2 para 1.5,
preserva `currentColor` e recopia a licença. Trocar de ícone é editar o mapa no
topo de `tools/illustrations.mjs`.

### Por que o traço muda

Lucide é desenhado para 16–24px. Ampliado para 58px, um traço de 2 renderiza com
~5px e lê como grafismo pesado em vez de marco discreto. Em 1.5 fica ~3,6px, que
é o peso equivalente ao dos ícones de 14–18px do resto da interface.

## Ícones da interface

O conjunto em `web/src/components/Icon.tsx` vive numa grade de 16 unidades com
traço 1.5. A maioria dos paths é geometria do [Lucide](https://lucide.dev)
(ISC), escalada de 24 para 16 unidades por `tools/lucide-scale.mjs` — não
retraçada à mão. O aviso de copyright fica no comentário no topo do próprio
`Icon.tsx`, já que os ícones não têm um arquivo por SVG como os estados
vazios. Não há dependência de runtime: o script roda uma vez, o resultado é
colado como código estático, igual aos ícones sempre foram.

```
Copyright (c) 2026 Lucide Icons and Contributors
ISC License — texto completo em assets/lucide-LICENSE.txt
```

Ficam desenhados à mão, sem equivalente no Lucide ou deliberadamente
simplificados: `mark` (a marca da Taskmate), `today`/`upcoming`/`calendar`
(composições de grade de pontos específicas do produto), `list` (linhas de
texto lê melhor que lista com marcadores para indicar notas), e
`moon`/`search`/`sun`/`keyboard`/`monitor`/`menu` (sem risco de arco a
eliminar, ou simplificados de propósito para legibilidade em 16px).

## Ícones do app (PWA)

`web/public/icon-*.png` e `apple-touch-icon.png` são gerados de
`tools/icons.ts` a partir da marca do próprio projeto (checkbox com tique, âmbar
`#cc7d2a`). Nenhuma arte de terceiros. Regenera com `npm run icons`.

## Motor de scroll da página de produto

`web/src/produto/scrollcraft.js` e `scrollcraft.css` são o motor do
[scroll-craft](https://github.com/nateherkai/scroll-craft), copiados sem
alteração. Licença MIT, Copyright (c) 2026 Nate Herk; o aviso completo está em
`assets/scrollcraft-LICENSE.txt`. Só a página `/produto/` carrega esses arquivos,
nunca o app.

## Vídeo do hero da página de produto

`web/public/produto/hero.mp4` e `hero-poster.webp` vêm do vídeo 6963729 do
Pexels, de **Cup of Couple** (https://www.pexels.com/video/6963729/), sob a
licença do Pexels (uso livre, atribuição não obrigatória). O crédito aparece
no canto do hero mesmo assim. Tratamento: arquivo HD 1920×1080 (a maior
versão disponível), loop sem emenda (o último 0,8 s funde com o começo),
desacelerado para 0,6× com interpolação de movimento a 30 fps, sem áudio,
H.264 CRF 20; `hero-720.mp4` é a mesma coisa em 1280×720, CRF 23, servida
só em telas de até 860px. O pôster é o primeiro quadro em WebP.

## Foto do autor na página de produto

`web/public/produto/adriano.webp` é um recorte quadrado (320×320) do retrato
`about-profile-photo.jpeg` do site pessoal do autor (adrianomaringolo.dev),
usado com a autorização dele.

## Histórico

Antes do Lucide, os estados vazios usaram cinco vetores de domínio público de
publicdomainvectors.org (duotone recolorido para uma rampa de três níveis). Foram
substituídos porque, mesmo recoloridos, eram arte de outro autor com outro peso
de traço convivendo com o set de ícones da interface — e o Lucide elimina a
mistura ao ser o mesmo idioma. A troca também reduziu as marcas de 11.741 para
2.564 bytes.
