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

## Música ambiente

Todas as faixas vêm do álbum *Space - Sleep - Meditation* (2022), de
**HoliznaCC0**, publicado no
[Free Music Archive](https://freemusicarchive.org/music/holiznacc0/space-sleep-meditation/)
sob **CC0 1.0 Universal** — domínio público, sem exigência de atribuição. O
crédito fica aqui, no menu de música e nas Preferências por cortesia.

Arquivos em `web/src/assets/audio/`, todos MP3 96 kbps estéreo 44,1 kHz e
nivelados em **-20 LUFS** (`volume` calculado com `ebur128` + `alimiter` a 0,95),
para trocar de música não mudar o volume:

| No app | Faixa original | Arquivos | Trechos (início no original) |
|---|---|---|---|
| Chuva | Rain _ Sleep _ Meditation | `chuva.mp3` | 4:00, 4 min, loop contínuo |
| Ondas cósmicas | Cosmic Waves | `cosmos-1..3.mp3` | 5:00 · 15:00 · 25:00, 3 min cada |
| Paisagem de sonho | DreamScape | `sonho-1..3.mp3` | 2:00 · 9:00 · 16:00 |
| Um tempo breve | Too Brief A Time To Be Anything | `breve-1..3.mp3` | 10:00 · 25:00 · 38:20 |
| Meditação 12 | 20 Minute Meditation 12 | `medit12-1..3.mp3` | 1:00 · 9:40 · 18:20 |
| Meditação 1 | 20 Minute Meditation 1 | `medit1-1..3.mp3` | 1:00 · 8:00 · 15:00 |
| Meditação 5 | 20 Minute Meditation 5 | `medit5-1..3.mp3` | 1:00 · 8:40 · 16:20 |
| Meditação 6 | 20 Minute Meditation 6 | `medit6-1..3.mp3` | 1:00 · 8:40 · 16:20 |
| Meditação 7 | 20 Minute Meditation 7 | `medit7-1..3.mp3` | 1:00 · 10:20 · 15:40 |
| Meditação 10 | 20 Minute Meditation 10 | `medit10-1..3.mp3` | 6:20 · 11:40 · 17:00 |
| Meditação 11 | 20 Minute Meditation 11 | `medit11-1..3.mp3` | 1:00 · 10:20 · 15:40 |

Os trechos de 3 minutos são cortes simples; a transição entre eles (e do
último de volta ao primeiro) é um crossfade de 6 s feito em tempo de execução
por `web/src/lib/ambient.ts`. Corte de cada um:

```
ffmpeg -ss <início> -t 180 -i original.mp3 -af "volume=<ganho>dB,alimiter=limit=0.95:level=false" \
  -ac 2 -ar 44100 -c:a libmp3lame -b:a 96k <nome>-<n>.mp3
```

A Chuva é um trecho só, de 4:00 a 8:08 do original, com os últimos 8 segundos
fundidos (crossfade equal-power) sobre o início para o loop não ter emenda:

```
ffmpeg -ss 240 -t 248 -i original.mp3 -filter_complex "[0:a]volume=-5.1dB,asplit=2[s1][s2];
  [s1]atrim=start=8:end=248,asetpts=PTS-STARTPTS,afade=t=out:st=232:d=8:curve=qsin[a];
  [s2]atrim=start=0:end=8,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=8:curve=qsin,adelay=232000|232000[b];
  [a][b]amix=inputs=2:normalize=0:duration=first,atrim=end=240,alimiter=limit=0.95:level=false[o]"
  -map "[o]" -ac 2 -ar 44100 -c:a libmp3lame -b:a 96k chuva.mp3
```

Várias faixas desse álbum são, por dentro, um loop curto repetido: a Chuva
repete a cada 64 s e a Meditação 1 também, então os três trechos dela soam
iguais. Ondas cósmicas, Um tempo breve e Paisagem de sonho não se repetem, e a
Meditação 12 tem ciclo de ~5,6 min — nelas os três trechos são de fato
diferentes.

As Meditações 2 a 11 também são loops (medidos por autocorrelação do
espectro). As 2, 3, 4, 8 e 9 repetem um ciclo de 48 s e mudam pouco ao longo
da faixa, e ficaram de fora. As 7 e 11 têm ciclo de 4 min e a 10, de 8 min:
os trechos começam em pontos diferentes do ciclo (80 s de distância um do
outro nas 7 e 11, 160 s na 10), então não soam iguais, embora se sobreponham
em parte. As 5 e 6 também repetem a cada 48 s, mas o timbre muda devagar ao
longo dos 20 minutos. Por isso os trechos delas vêm do começo, do meio e do
fim.
