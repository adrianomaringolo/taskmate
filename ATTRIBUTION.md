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

O conjunto em `web/src/components/Icon.tsx` é desenhado à mão neste projeto,
numa grade de 16 unidades com traço 1.5 — mesmo idioma do Lucide. Não há
dependência de runtime para ícones.

## Ícones do app (PWA)

`web/public/icon-*.png` e `apple-touch-icon.png` são gerados de
`tools/icons.ts` a partir da marca do próprio projeto (checkbox com tique, âmbar
`#cc7d2a`). Nenhuma arte de terceiros. Regenera com `npm run icons`.

## Histórico

Antes do Lucide, os estados vazios usaram cinco vetores de domínio público de
publicdomainvectors.org (duotone recolorido para uma rampa de três níveis). Foram
substituídos porque, mesmo recoloridos, eram arte de outro autor com outro peso
de traço convivendo com o set de ícones da interface — e o Lucide elimina a
mistura ao ser o mesmo idioma. A troca também reduziu as marcas de 11.741 para
2.564 bytes.
