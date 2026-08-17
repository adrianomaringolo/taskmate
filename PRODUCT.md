# Product

## Register

product

## Users

Um único usuário: um desenvolvedor/consultor que mistura, no mesmo dia, trabalho
de cliente e vida pessoal. Abre o app várias vezes ao dia no desktop, entre
outras tarefas — nunca como destino, sempre como escala. O contexto físico é uma
mesa iluminada, luz ambiente de dia, sessões de 30 segundos a 3 minutos.

O trabalho a ser feito tem duas metades assimétricas:

1. **Capturar** — tirar algo da cabeça em menos de cinco segundos, sem escolher
   onde guardar. Se capturar exige navegação, a captura não acontece e o app
   morre.
2. **Triar** — uma vez ou duas por dia, decidir o que é hoje e o que espera.
   Aqui o usuário quer ver tudo cruzando grupos, não abrir uma pasta por vez.

A hierarquia grupo › lista › atividade existe para o segundo momento (dar
endereço às coisas), não para o primeiro. Ela nunca deve ser pré-requisito de
captura.

## Arquitetura de dados

Local-first. O documento canônico vive no dispositivo (IndexedDB, formato binário
do Automerge). Sincronização entre dispositivos é **opcional** e acontece por um
único arquivo no Google Drive do próprio usuário — sem servidor nosso, sem tabela
de usuários, sem senha. O usuário é dono do arquivo e pode copiá-lo ou versioná-lo
sem passar pelo app.

Consequência estratégica: o app precisa ser **completo e agradável sem
sincronização nenhuma**. Sync é infraestrutura opt-in, nunca pré-requisito, e
nunca aparece na frente da tarefa.

## Product Purpose

Um gerenciador de tarefas pessoal com hierarquia explícita de três níveis:
**grupos** separam contextos de vida (Casa, Cliente X, Estudos), **listas**
dividem cada contexto em frentes de trabalho, **atividades** são o trabalho em
si.

Existe porque as ferramentas populares erram para os dois lados: as simples
(Apple Reminders) achatam tudo em listas soltas e não separam contexto de
frente de trabalho; as completas (Notion, Jira) cobram configuração antes de
qualquer valor. Este app entrega os três níveis sem cobrar setup: começa
funcionando, a estrutura aparece conforme é necessária.

Sucesso é o usuário confiar que nada se perdeu — e não sentir vontade de abrir
o app quando não há nada a fazer.

## Brand Personality

**Calma, precisa, discreta.**

Voz: direta e humana em português, primeira pessoa quando faz sentido. Nunca
motivacional, nunca exclamativa, nunca gamificada. Zero parabéns por concluir
tarefa — concluir tarefa é o normal, não uma conquista. Rótulos são verbos
concretos ("Nova lista", "Concluir"), nunca abstrações ("Gerenciar itens").

Emocionalmente o app deve produzir **alívio**, não empolgação. O sinal de que
acertamos é o usuário fechar a aba sem pensar no app.

## Anti-references

- **Todoist / Notion cheios de cor**: cor por categoria em tudo, ícones em todo
  lugar, badges coloridos competindo. Cor aqui é informação escassa, não
  decoração de navegação.
- **Gamificação (Habitica, streaks do Duolingo)**: pontos, sequências,
  celebração de conclusão. Transforma manutenção de lista em obrigação
  emocional.
- **Jira / Asana**: campos obrigatórios, estados customizáveis, configuração
  antes do valor. Se o usuário precisa configurar para começar, falhamos.
- **Dashboards de produtividade**: gráficos de tarefas concluídas por semana,
  métricas grandes no topo. Mede o instrumento, não o trabalho.
- **Skeuomorfismo de papel**: textura de caderno, fontes manuscritas, som de
  risco no papel.

## Design Principles

1. **Captura antes de estrutura.** Sempre existe um caminho de uma tecla para
   adicionar tarefa, e ele nunca exige escolher grupo ou lista. Um destino
   padrão ("Entrada") absorve o que não tem endereço ainda.
2. **A hierarquia é navegação, não formulário.** Os três níveis aparecem na
   lateral como uma árvore que se recolhe. Nenhuma tela obriga o usuário a
   percorrer os três níveis para chegar a uma tarefa.
3. **Cor é estado, não enfeite.** O âmbar da marca marca exatamente uma coisa:
   o que está selecionado ou ativo agora. Grupos podem receber cor, mas como
   pista de orientação de baixa intensidade — nunca preenchimento chapado.
4. **Erro barato, arrependimento barato.** Ação frequente e reversível
   (concluir, excluir tarefa) acontece sem confirmação e oferece desfazer.
   Ação rara e destrutiva (excluir grupo com listas dentro) confirma no lugar,
   sem modal.
5. **Silêncio quando está vazio.** Estado vazio ensina o próximo gesto em uma
   frase e para. Não anima e não vende. Marca em cinza e pequeno — o ícone diz
   "este estado é normal", nunca celebra e nunca ocupa o lugar da frase.
   Falha não é estado vazio: erro tem texto e caminho de saída, sem desenho.
6. **Nunca perder uma tarefa.** Acima de qualquer consideração de desempenho ou
   elegância. Escrita local sem debounce, tombstones em vez de remoção, merge por
   CRDT em vez de last-write-wins: todas essas decisões trocam simplicidade por
   durabilidade, de propósito. Se a escolha for entre um app mais enxuto e um app
   que nunca engole trabalho do usuário, é o segundo.

## Accessibility & Inclusion

- **Meta: WCAG 2.2 AA.** Texto corrido ≥ 4.5:1; elementos de UI não textuais
  (limite de checkbox, bordas de input, anel de foco) ≥ 3:1. Verificado
  numericamente em `tools/contrast.mjs`, que roda no CI de tokens — não a olho.
- **Nunca cor sozinha.** Concluído é checkbox marcado + texto esmaecido +
  tachado. Atraso é ícone + texto, não só vermelho. Prioridade é rótulo
  legível, não só matiz. Isso cobre daltonismo sem tratamento especial.
- **Teclado completo.** Toda ação alcançável por teclado, foco visível em tudo
  (nunca `outline: none` sem substituto), ordem de tabulação seguindo a ordem
  visual. Atalhos são aceleradores, nunca o único caminho.
- **Movimento reduzido.** Todas as transições respeitam
  `prefers-reduced-motion: reduce`, degradando para fade curto ou troca
  instantânea. Nenhuma informação depende de animação para ser percebida.
- **Densidade legível.** Base 15px, alvos de toque ≥ 32px de altura mesmo na
  densidade compacta, zoom até 200% sem perda de conteúdo.
