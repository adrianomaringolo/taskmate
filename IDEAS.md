# Ideias

Sugestões de funcionalidades e melhorias para o Taskmate. Nenhuma é compromisso —
é material para decidir o que vale a pena.

## Como ler

Toda sugestão passou pelo filtro do [`PRODUCT.md`](./PRODUCT.md): captura antes de
estrutura, hierarquia é navegação e não formulário, cor é estado e não enfeite,
nada de gamificação nem dashboard, e **nunca perder uma tarefa**. O que briga com
esses princípios está marcado com ⚠ **Tensão** e explicado — não é veto, é aviso.

Esforço, grosso modo:

- **P** — até um dia, sem mexer no schema do documento.
- **M** — alguns dias, ou toca o schema / a projeção.
- **G** — semana ou mais, ou tem risco arquitetural (CRDT, offline, bundle).

Mudança de schema do `doc.ts` = `SCHEMA` sobe e precisa de caminho de migração;
qualquer campo novo em `Task`/`List`/`Group` entra nessa conta.

## Onde o app está hoje

Hierarquia grupo › lista › atividade + Entrada. Tarefa tem título, notas, prazo
(dia de calendário), prioridade 0–3, recorrência (dia/semana/mês) e ordem por
índice fracionário. Visões: Hoje, Próximos 7 dias, Calendário (mês/semana/dia),
Busca (título + notas). Captura por `N`, desfazer por `Ctrl+Z` (só exclusão,
via tombstone). Sync opcional por um arquivo no Drive. PWA instalável e offline.
Lembrete diário local às 8h. Tema claro/escuro, modo de baixa visão.

Não existe: linguagem natural na captura, uma visão de triagem do que não tem
prazo, subtarefas, data de início, etiquetas, filtro/ordenação dentro da lista,
lixeira, export legível, navegação da lista por teclado.

---

## 1. Captura — a metade que não pode falhar

### 1.1 Linguagem natural no campo de captura — **M**

`comprar leite amanhã !alta` → título `comprar leite`, prazo amanhã, prioridade
alta. Reconhecer `hoje`/`amanhã`/`seg…dom`/`12/03`/`+3`, `!1..!3` ou
`!baixa/média/alta`, e talvez `#grupo` / `/lista` para o destino. Texto puro
sempre funciona: o parser só **acrescenta**, nunca recusa.

**Por quê:** é o caminho mais direto para "tirar da cabeça em cinco segundos"
sem abrir os detalhes depois. Hoje capturar é rápido mas *classificar* exige um
segundo passo em outra tela.

⚠ **Tensão:** sintaxe pode assustar. Mitigação: um preview discreto do que foi
entendido (chips abaixo do campo antes de confirmar), e nunca exigir a sintaxe.

### 1.2 `share_target` no manifest — **P**

Declarar `share_target` no `web/vite.config.ts` (manifest). No Android, o app
passa a aparecer na folha de compartilhar; o texto/URL compartilhado cai na
Entrada. Zero backend.

**Por quê:** metade da captura móvel é "vi isso, quero lembrar" a partir de outro
app. Sem isso, o usuário troca de app, o que o `PRODUCT.md` diz que mata a
captura.

### 1.3 Colar várias linhas vira várias tarefas — **P**

Colar um bloco de texto multilinha no campo de captura (ou numa lista) cria uma
tarefa por linha não vazia. Confirmar quantas antes de criar.

**Por quê:** transcrever uma lista pronta (de um e-mail, de uma reunião) é um
gesto de captura comum e hoje é uma linha por vez.

### 1.4 Capturar em Hoje/Próximos já com prazo — **P**

O `QuickAdd` em Hoje e em Próximos 7 dias hoje joga na Entrada **sem prazo** — ou
seja, a tarefa recém-criada não aparece na visão onde foi criada. Padrão melhor:
em Hoje, prazo = hoje; em Próximos, um toast "na Entrada · dar prazo?" com ação.

---

## 2. Triagem — a segunda metade

O `PRODUCT.md` descreve triagem como "ver **tudo cruzando grupos**, não abrir uma
pasta por vez". Hoje não existe essa tela: Hoje e Próximos só mostram o que tem
prazo, e o resto só aparece abrindo cada lista.

### 2.1 Visão "A revisar" — o que não tem prazo, cruzando listas — **M**

Uma visão única com todas as tarefas em aberto **sem prazo**, agrupadas por
lista, com ação rápida de dar prazo (hoje/amanhã/semana) ou adiar (ver 2.3) em
cada linha. É a tela de triagem que o produto pede e não tem.

**Por quê:** sem ela, tarefa sem prazo capturada rápido some da vista até alguém
abrir a lista certa — exatamente o medo do princípio 6.

### 2.2 Ações em lote na triagem — **M**

Selecionar várias (checkbox ou `Shift+↓`) e: dar o mesmo prazo, mover de lista,
concluir. Tudo alcançável por teclado.

⚠ **Tensão:** seleção múltipla é padrão de "app de produtividade". Manter quieto:
sem barra flutuante grande, sem contadores em destaque.

### 2.3 Adiar sem inventar data — **M**

Um estado "algum dia" por tarefa (campo `deferred: boolean` ou lista dedicada),
que tira a tarefa do radar ativo sem fingir um prazo distante. Aparece só numa
visão "Algum dia" e na lista de origem esmaecida.

**Por quê:** serve ao "não sentir vontade de abrir o app quando não há nada a
fazer" — o que está adiado de propósito não deveria pesar em Hoje.

### 2.4 Lidar com atraso — **P**

Hoje mistura atrasadas no bloco de Hoje. Adicionar uma ação "jogar atrasadas para
hoje" (em lote, com desfazer) e/ou um subcabeçalho "Em atraso" separado dentro de
Hoje, como já existe em Próximos.

---

## 3. Modelo de tarefa

### 3.1 Checklist dentro da tarefa — **M**

Um nível de itens marcáveis dentro de uma tarefa (não subtarefas com prazo
próprio — só passos). Schema: `Task.steps: {id, text, done, order}[]`.

**Por quê:** é a funcionalidade mais pedida em app de tarefa. "Preparar viagem"
tem cinco passos que não merecem ser tarefas de primeira classe.

⚠ **Tensão:** vira porta de entrada para "por que não subtarefa com prazo, e
recorrência, e…". Segurar em **um** nível, sem prazo, sem prioridade. Se as notas
já resolvem para o usuário, não fazer.

### 3.2 Data de início / "esconder até" — **M**

Campo `startDate` separado do prazo: a tarefa só aparece em Hoje/Próximos/listas
a partir dele. Complementa o 2.3.

**Por quê:** "renovar o seguro" é relevante em novembro, não agora. Sem isso, ou
polui a lista o ano inteiro ou é esquecida.

### 3.3 Recorrência melhor — **M**

- "a cada N dias/semanas/meses" (não só toda semana).
- "toda seg/qua/sex" ou "dias úteis".
- **"repetir N dias depois de concluída"** vs. a atual "no dia agendado": regar
  planta é 3 dias depois da última vez; aluguel é dia 1. O `advanceDue` em
  `date.ts` só faz o modo "agendado" — avança a partir do prazo antigo, não de
  hoje, então concluir com atraso deixa a próxima ocorrência já vencida.

### 3.4 Etiquetas / contextos — **M**

Rótulos de texto que cruzam a hierarquia: `@espera`, `@ligar`, `@rua`. Filtráveis,
sem cor (cor é escassa), renderizados como chip neutro.

**Por quê:** "aguardando resposta de alguém" é um contexto GTD clássico que os
três níveis não capturam — não é grupo nem lista, é um estado transversal.

⚠ **Tensão:** é o começo do "Todoist cheio de etiqueta colorida". Regra: sem
matiz, no máximo um punhado, e some da UI quando não usado.

### 3.5 Duplicar tarefa / usar como modelo — **P**

"Duplicar" no menu da tarefa. Com 3.1, um modelo de checklist reaproveitável sem
sistema de templates.

---

## 4. Visões e navegação

### 4.1 Navegação da lista por teclado — **M**

`j`/`k` move a seleção, `x` conclui, `e` abre detalhes, `#` exclui, `t` = hoje,
`Espaço` expande. O persona é dev/consultor em sessões de 30 s — hoje só há
`N`, `/`, `Ctrl+Z` e Tab.

**Por quê:** encaixa exatamente no usuário descrito e torna a triagem diária
questão de segundos. Acelerador, nunca caminho único (princípio de
acessibilidade).

### 4.2 Paleta de comandos (`Ctrl/Cmd+K`) — **M**

Pular para qualquer lista/grupo/visão e disparar ações por busca fuzzy.

⚠ **Tensão:** cheira a "app". Mitigação: sem firulas, teclado primeiro,
descobrível mas nunca obrigatório. Alinha com o persona dev.

### 4.3 Filtro e ordenação dentro da lista — **P/M**

Ordenar por prazo / prioridade / criação; alternar "esconder concluídas";
filtrar por prioridade. Estado da tela (como recolher grupo), fica em
`localStorage`, não sincroniza.

### 4.4 Arrastar no calendário para reagendar — **M**

Arrastar uma tarefa entre dias no `CalendarView` muda o prazo. Hoje o calendário
é só leitura de quando as coisas caem.

### 4.5 Arrastar tarefa para grupo/lista na lateral — **P**

Soltar uma linha de tarefa sobre uma lista da árvore move para lá. Atalho para o
`select` de "Lista" nos detalhes.

### 4.6 Contagem de abertas por lista na lateral — **P**

Número discreto ao lado do nome da lista.

⚠ **Tensão:** o `PRODUCT.md` desconfia de badge e número. Manter em `--ink-3`,
sem cor, e talvez só no hover ou só quando > 0.

### 4.7 Tela de preferências — **P**

Hoje as preferências estão espalhadas (tema e baixa visão num menu, lembrete
noutro, sync noutro). Uma folha "Preferências" reúne: tema, baixa visão,
lembrete + horário, início da semana (hoje fixo em segunda no `date.ts`),
densidade.

---

## 5. Tempo e lembretes

### 5.1 Horário opcional no prazo + lembrete local — **M**

`Task.dueTime?: "HH:MM"`. Com o app instalado, agendar uma `Notification` local
(via `setTimeout` enquanto aberto; `Notification Triggers` onde existir) para "X
antes". Não é push com app fechado — o `PRODUCT.md` explica por que isso exige
servidor —, mas cobre "reunião às 15h" para quem deixa a aba aberta.

### 5.2 Adiar o lembrete — **P**

Botão "lembrar depois" na notificação e no toast.

### 5.3 Lembrete abre a visão certa — **P**

Clicar na notificação diária foca a visão Hoje (deep link `?view=today`).

---

## 6. Posse dos dados: exportar, importar, recuperar

### 6.1 Exportar legível — **P/M**

O `PRODUCT.md` diz "o usuário é dono do arquivo" — mas o `taskmate.automerge` é
binário opaco. Um export **Markdown** (outline grupo › lista › tarefa, com
`- [ ]`/`- [x]`, prazo e notas) e/ou **JSON** entrega a posse de verdade: dá para
ler, versionar, colar noutro lugar.

### 6.2 Importar — **M**

Colar Markdown/lista de texto, ou importar export do Todoist / Apple Reminders
(CSV). Tira o atrito do primeiro dia.

### 6.3 Lixeira — **M**

As tombstones ficam invisíveis depois que o toast de desfazer some. Uma visão
"Lixeira" com o que foi excluído nos últimos N dias e um botão "restaurar"
entrega direto os princípios 4 ("arrependimento barato") e 6. Os dados já estão
lá — é só projetar `deletedAt != null`.

### 6.4 `.ics` das tarefas com prazo — **P**

Gerar um `.ics` (client-side) das tarefas datadas, para abrir/assinar no
calendário do sistema. Um arquivo gravado no Drive já resolve o caso "quero ver
minhas tarefas junto da agenda".

### 6.5 Histórico recente — **P/M**

O Automerge guarda o histórico inteiro. Uma lista "concluídas recentemente" /
"mudou nos últimos 7 dias" reforça "confiar que nada se perdeu".

⚠ **Tensão:** não deixar virar dashboard. Sem gráfico, sem "12 tarefas esta
semana", sem meta.

---

## 7. Sincronização

### 7.1 "Sincronizado há X" mais visível — **P**

Hoje o estado vive só no painel de sync. Uma linha discreta no rodapé da lateral
("Drive · há 2 min" / "Drive · há 3 dias") avisa quando algo travou sem precisar
abrir o painel.

### 7.2 Testar o caminho de renomear arquivo no Drive — **M**

O `README.md` diz que é o único caminho sem teste automatizado. Um teste de
integração com Drive-falso cobrindo `findFile()` → renomeia legado tira esse
ponto cego.

### 7.3 Safari de verdade — **M**

O `README.md` marca a renovação silenciosa como possivelmente quebrada por ITP,
"não testado em Apple". Os últimos commits mudaram esse fluxo (falha graciosa
para "Reconectar"). O persona trabalha numa mesa — Safari/macOS importa. Rodar
em Safari real e documentar.

### 7.4 Rótulo de dispositivo no painel — **P**

`deviceId` (em `storage.ts`) só serve de rótulo hoje e nem é usado. Mostrar
"editado por último em: iPhone" numa tarefa, ou uma lista de dispositivos no
painel de sync, dá mais confiança de que o sync está funcionando.

---

## 8. Qualidade técnica e dívidas conhecidas

### 8.1 Custo do WebAssembly do Automerge — **G (investigar)**

1,1 MB comprimido, contra ~97 KB do resto. Opções, da mais barata:

- Carregar o wasm **depois do primeiro paint** — o shell renderiza na hora, o
  documento hidrata em seguida (hoje o boot espera o wasm).
- Avaliar build slim do `@automerge/automerge`.
- Avaliar CRDTs menores (Yjs, Loro). **Migração de CRDT é risco alto** — a
  correção de merge é o que justifica a arquitetura e tem 13 testes atrás. Só
  investigar, com os mesmos cenários de `tools/sync.test.ts` como rede de
  segurança.

### 8.2 Desempenho com muitas tarefas — **M**

"Serializar 200 tarefas ~1,6 ms." E 2 000, com cinco anos de concluídas +
tombstones que nunca são purgadas? A `project()` filtra tombstones a cada
render. Vale um benchmark com documento sintético grande e, se preciso, lista
virtualizada e memoização da projeção.

### 8.3 Plano de migração de `SCHEMA` — **P (doc)**

`doc.ts` tem `SCHEMA = 1`. Não há código de migração nem teste para `1 → 2`. O
primeiro campo novo (qualquer ideia da seção 3) precisa disso. Documentar a
estratégia antes de precisar dela.

### 8.4 E2E no CI — **P**

`test:e2e`, `test:offline` e `test:rename` precisam de servidor rodando e hoje
são manuais. Colocar num job de CI com o `dev`/`preview` de fundo fecha a lacuna
entre "os testes existem" e "os testes rodam".

### 8.5 Undo além de exclusão — **M**

`undoRef` é um slot só, focado em exclusão. Uma pilha curta de sessão (desfazer
conclusão, edição, movimento) encaixa no princípio 4.

⚠ **Tensão:** semântica de undo sobre CRDT é sutil — desfazer localmente não é
"reverter no histórico". Escopo de sessão, sem promessa entre dispositivos.

### 8.6 Links clicáveis nas notas — **P**

O textarea de notas é texto puro. Detectar URLs e torná-las clicáveis (na
visualização, não na edição) cobre 90% do "markdown nas notas" sem virar editor.

---

## 9. Deliberadamente fora

Contra as anti-referências do `PRODUCT.md`, **não**:

- Sequências, pontos, comemoração de conclusão, gráficos de produtividade.
- Campos obrigatórios, estados customizáveis, workflow configurável.
- Cor por categoria em toda a navegação.
- Colaboração / listas compartilhadas / responsáveis — o app é de um usuário só
  por decisão; multiusuário exige backend e quebra o modelo de dados.
- IA como recurso de vitrine. Se algum dia entrar, é uma coisa pequena e
  delimitada (ex.: transformar um parágrafo de brain-dump em tarefas, offline ou
  opcional) — nunca "assistente", nunca no caminho da tarefa.

---

## 10. Se fosse pra escolher três

1. **2.1 Visão "A revisar"** — é a metade da triagem que o produto promete e não
   entrega. Maior distância entre o que o `PRODUCT.md` diz e o que o app faz.
2. **1.1 Linguagem natural na captura** — multiplica a velocidade da metade que
   "se falhar, o app morre".
3. **6.3 Lixeira** — barato (os dados já existem), e transforma o princípio
   "nunca perder uma tarefa" de promessa de bastidor em coisa visível.

Menções honrosas de baixo custo: 1.2 (`share_target`), 1.3 (colar várias linhas),
6.1 (export Markdown), 4.7 (tela de preferências).
