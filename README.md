# Taskmate

Controle de tarefas com hierarquia de três níveis: **grupos** › **listas** ›
**atividades**. Grupos separam contextos de vida (Casa, Cliente X, Estudos),
listas dividem cada contexto em frentes, atividades são o trabalho.

Site estático, sem servidor. Os dados ficam em **IndexedDB** neste navegador e,
se você quiser usar em mais de um dispositivo, sincronizam por um único arquivo
no seu **Google Drive**. Sem tabela de usuários, sem senha, sem backend.

## Rodar

```bash
npm install
npm run dev            # http://localhost:5173
```

Funciona imediatamente, sem configurar nada. A sincronização é opcional.

```bash
npm run build && npm run preview   # produção, também sem servidor de app
```

O `dist/` é estático: serve em GitHub Pages, Netlify, Vercel, ou um `nginx`.

## Sincronização com o Google Drive (opcional)

Copie `.env.example` para `web/.env.local` e preencha `VITE_GOOGLE_CLIENT_ID` —
o passo a passo do console do Google está dentro do arquivo. Sem essa variável o
painel de sincronização diz "Não configurada" e o resto do app funciona igual.

Escopo usado: `drive.file`. O app só acessa arquivos que ele mesmo criou; não
consegue ler o resto do seu Drive nem se o código tentasse. É um escopo **não
sensível**, então não passa por revisão do Google.

O arquivo é um `taskmate.automerge` normal e visível na raiz do Drive. Você pode
copiar, versionar e fazer backup dele sem depender do app.

### O que "sincronizar" faz de fato

Cada ciclo é **ler → mesclar → gravar**, nessa ordem. Os gatilhos são: ao abrir,
ao a aba voltar ao foco, alguns segundos depois de uma edição (com debounce), e
um heartbeat de 45s enquanto a aba está visível. Aba oculta não sincroniza.

Verificar metadados é barato; o arquivo só é baixado quando a revisão mudou.

## Verificação

```bash
npm test               # tokens de cor + convergência de sincronização
npm run test:tokens    # 47 checagens de contraste e gamut sRGB
npm run test:sync      # 12 cenários de convergência, sem navegador
npm run test:e2e       # 23 fluxos no navegador (precisa de `npm run dev`)
npm run test:offline   # 10 checagens do service worker (ver abaixo)
npm run test:rename    # 6 checagens da migração de nomes (precisa de `npm run dev`)
npm run shots          # capturas em tools/shots/
npm run typecheck
```

`test:offline` exige o build de produção, porque o service worker é desligado de
propósito em dev (ele encobriria o HMR e esconderia erros):

```bash
npm run build
npx vite preview --port 5180 --strictPort   # noutro terminal
npm run test:offline
```

`test:sync` é o teste que justifica a arquitetura. Cada cenário reproduz uma
forma de um loop ingênuo de "baixa o arquivo, sobe o arquivo" perder dados, e
verifica que este não perde. O falso Drive dos testes é hostil de propósito: não
tem lock, não tem escrita condicional, e sabe descartar um upload em silêncio ou
deixar um dispositivo sobrescrever o outro — exatamente o que o Drive real faz.

## Como está organizado

```
web/src/lib
  doc.ts       o documento Automerge: schema, mutações, projeção para a UI
  sync.ts      o algoritmo ler→mesclar→gravar (não importa nada do Drive)
  drive.ts     OAuth via Google Identity Services + API REST do Drive
  storage.ts   IndexedDB: o documento binário + metadados de sync
  store.tsx    estado React, persistência, agendamento de sync, desfazer
  date.ts      datas de calendário no fuso local (nunca instantes UTC)
web/src/components   Sidebar (árvore) + ContentView (coluna) + linha/detalhe
web/src/styles       tokens.css (cor, tipo, espaço, z, motion) + app.css
tools
  sync.test.ts   cenários de convergência com um Drive falso e hostil
  e2e.ts         fluxos de interação reais no navegador
  seed.ts        dataset de demonstração injetado no IndexedDB
  offline.test.ts  service worker: abre e escreve com a rede desligada
  rename.test.ts   migração dos identificadores após a renomeação
  contrast.mjs     verificador de contraste/gamut em OKLCH
  gen-seed.mjs     regenera a semente constante do documento
  illustrations.mjs gera as marcas de estado vazio a partir do Lucide
  icons.ts         gera os ícones do app a partir da marca
```

`PRODUCT.md` (quem usa, por quê, princípios) e `DESIGN.md` (paleta, tipografia,
motion, e o *porquê* de cada valor) são o contrato de design.

## Decisões que valem saber

**Todo dispositivo parte da mesma semente de bytes.** Não é otimização, é
correção. Dois documentos Automerge criados por chamadas separadas de `A.from()`
têm raízes sem parentesco, e mesclá-los **descarta um lado em silêncio** — sem
exceção, sem aviso, só tarefas que desaparecem. Isso foi descoberto pelos testes,
não por leitura de documentação. A semente constante está em `doc.ts` e se
regenera com `npm run seed:regen`.

**Ordem é índice fracionário (`"a0"`, `"a0V"`, `"a1"`), não inteiro.** Inteiros
não mesclam: inserir entre duas linhas obriga a renumerar as vizinhas, e dois
dispositivos renumerando offline produzem reescritas contraditórias que nenhum
CRDT sabe reconciliar. Uma chave fracionária é escrita uma vez, por um
dispositivo, e nunca toca nas vizinhas.

**Excluir é tombstone, nunca remoção.** Apagar a chave num CRDT deixa a linha
voltar: um dispositivo que a editou concorrentemente recria os campos que tocou e
sobra um fantasma meio ressuscitado. Marcar como morta é o único delete seguro —
e de graça vira a janela de desfazer, inclusive para grupos e listas inteiros.

**`PATCH` grava só os campos que ele nomeia.** Num CRDT, tocar um campo é o que o
torna candidato a sobrescrever o valor de outro dispositivo. Gravar os seis
campos a cada edição transformaria "mudei o título" em "e afirmo que o prazo que
você pôs no celular está errado".

**Prazo é dia de calendário, não instante.** Guardado como `YYYY-MM-DD`.
Interpretar `"2026-08-17"` com `new Date()` daria meia-noite **UTC** e mostraria o
dia anterior para quem está a oeste de Greenwich.

**Recolher grupo não sincroniza.** Se um grupo está dobrado é propriedade desta
tela, não do dado. Sincronizar isso faria um dispositivo dobrar a barra lateral
do outro. Fica em `localStorage`.

**Gravar no IndexedDB não tem debounce.** Qualquer atraso ali é uma janela em que
um reload perde a última edição — e perdeu, em teste: uma nota digitada pouco
antes de recarregar nunca chegou ao banco, enquanto o prazo posto instantes antes
sobreviveu. Serializar 200 tarefas custa ~1,6 ms e 23 KB, então não há o que
economizar.

**Botões que agem sem roubar foco.** Os atalhos de data no painel de detalhes
usam `onMouseDown` com `preventDefault`. Sem isso, o `mousedown` tira o foco das
notas, o commit insere o chip "notas" na linha acima, tudo abaixo desce, e o
`mouseup` cai no vazio: um botão que não faz nada.

**Nada é comunicado só por cor.** Concluído é checkbox marcado + texto esmaecido
+ tachado. Atrasado é ícone + palavras. Prioridade é rótulo legível.

## Offline e instalação

Um service worker precacheia o shell **e o WebAssembly do Automerge**. Esse
segundo item é o que costuma faltar: sem ele o app abre offline e depois falha ao
ler o próprio documento, o que é pior do que não abrir. `test:offline` verifica
exatamente isso — desliga a rede, recarrega, e confere que as tarefas aparecem.

O app é instalável (manifest com ícones, inclusive maskable). Atualizações usam
`registerType: 'prompt'`: quando uma versão nova está pronta, aparece um toast
com "Recarregar". Nunca recarrega sozinho — você pode estar no meio de uma nota.

Requisições ao Drive **não** têm cache de runtime, de propósito: uma listagem ou
revisão em cache faria o loop de sync raciocinar sobre estado velho, e ele já tem
a própria checagem de frescor.

## Marcas dos estados vazios

Cinco ícones do [Lucide](https://lucide.dev) — `inbox`, `list-todo`, `coffee`,
`calendar-days`, `search-x` — gerados por `npm run illustrations` a partir de
`lucide-static` (devDependency; nada de ícones no bundle além do SVG inline).

Lucide é o mesmo idioma do set de ícones desenhado à mão em `Icon.tsx`, então um
estado vazio mostra o sistema de ícones em tamanho maior, não arte de fora colada
dentro. O gerador afina o traço de 2 para 1.5: Lucide é desenhado para 16–24px, e
ampliado para 58px um traço de 2 lê como grafismo pesado.

São 58px dentro de uma placa neutra de 96px. A placa é o que faz um glifo de
traço único parecer intencional nesse tamanho — sem ela a marca flutua e parece
ícone mal dimensionado. É um azulejo atrás de um glifo, não um card: sem borda,
sem sombra, sem conteúdo.

**Lucide é ISC, não domínio público — a atribuição é obrigatória.** O aviso viaja
dentro de cada SVG gerado (que é inline no bundle), em `assets/lucide-LICENSE.txt`
e em `ATTRIBUTION.md`.

## Renomeação: Trellis → Taskmate

O app já se chamou Trellis. Nome é cosmético até tocar num identificador
persistido, e três tocaram:

| Identificador | Migração |
|---|---|
| Banco IndexedDB `trellis` → `taskmate` | Se não há documento com o nome novo, o antigo é lido e **copiado** — uma vez, não a cada boot. O banco antigo é aberto sem versão e com o upgrade abortado, para um navegador que nunca rodou o build velho não ganhar um banco vazio de brinde |
| `localStorage` `trellis:*` → `taskmate:*` | `prefs.ts` lê o namespace antigo como fallback, grava no novo e apaga o velho na primeira leitura |
| Arquivo no Drive `trellis.automerge` → `taskmate.automerge` | `findFile()` procura o nome novo; não achando, procura o antigo e o **renomeia no lugar** (PATCH de metadados, sem tocar no conteúdo). Um arquivo, um id, todos os dispositivos convergindo — em vez de cada um criar o seu e nunca mais se ver |

`npm run test:rename` planta dados com os nomes **antigos** e verifica que o app
os adota, que a preferência migra, que sobrevive a um segundo reload, e que o
primeiro uso não cria o banco antigo por efeito colateral. A renomeação do
arquivo no Drive é o único caminho sem teste automatizado — exige um Drive real —
e é o que observar no primeiro sync após a troca.

## Limites conhecidos

**O WebAssembly do Automerge custa 1,1 MB comprimido** (3,5 MB cru), contra ~97 KB
do resto do JS. É um ativo com hash imutável, então é baixado uma vez por versão
e depois vem do cache — mas o primeiro acesso sente, e o service worker precisa
baixá-lo inteiro para o app funcionar offline. É o preço do merge correto.

**Renovação silenciosa de token pode falhar no Safari.** O fluxo de navegador dá
access token de ~1 h e não refresh token (guardar um exigiria backend). A
renovação é invisível depois do primeiro consentimento, mas as restrições de
cookie de terceiros do Safari podem quebrá-la e forçar reconexão manual. Não
testado em dispositivo Apple.

**Dois uploads quase simultâneos custam um round trip.** O Drive não tem escrita
condicional, então o segundo sobrescreve o primeiro. Nenhum dado é perdido — o
dispositivo sobrescrito reintroduz suas mudanças no ciclo seguinte, e há teste
para isso — mas a propagação atrasa alguns segundos.

**Tombstones não são removidas.** Nunca. Purgar poderia ressuscitar uma linha num
dispositivo que ficou offline tempo suficiente para não ter visto a exclusão. O
Automerge guarda histórico de qualquer forma, então purgar quase não reduziria o
arquivo.
