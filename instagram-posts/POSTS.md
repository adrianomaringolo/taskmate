# Posts do Instagram — Taskmate

Última atualização: 2026-09-25

| ID | Título | Data | Tipo | Slides | Status | Tema |
|---|---|---|---|---|---|---|
| post-01 | Lançamento: Taskmate, suas tarefas num lugar calmo | 2026-09-24 | carrossel | 7 | pronto | Lançamento / método |
| post-02 | Promocional: anote agora, decida depois | 2026-09-25 | único | 1 | pronto | Promocional |

## Detalhes por post

### post-01 — Lançamento: Taskmate, suas tarefas num lugar calmo
- **Data:** 2026-09-24 · **Tipo:** carrossel (1080×1350) · **Slides:** 7
- **HTML:** `html/post-01/` · **PNGs:** `output/post-01/`
- Capa (logo + "Suas tarefas, num lugar calmo." + Hoje de exemplo) → o problema (pendências
  soltas) → Capturar (campo com "amanhã" e "!alta" reconhecidos) → Entrada → Hoje (grupos,
  concluída, atrasada com Adiar) → Seus dados (sem cadastro, offline, sem servidor, Drive) →
  Fecho (botão + get-taskmate.web.app, sobre um quadro do vídeo do hero: `bg-fecho.jpg`).
- Segue o método da página de produto (`web/produto/index.html`): capturar e decidir são
  dois momentos. Toda a UI é HTML com tarefas de exemplo, nos tokens do app.
- **Ícones:** Lucide (calendar, inbox, plus, check, repeat, triangle-alert, user-round-x,
  wifi-off, server-off, cloud), de `node_modules/lucide-static`. Marca do app no logo.
- **Hashtags:** taskmate, organizacao, listadetarefas, gestaodotempo, organizacaopessoal,
  produtividadecalma, todolist, planejamento, appdetarefas, semcadastro

### post-02 — Promocional: anote agora, decida depois
- **Data:** 2026-09-25 · **Tipo:** post único (1080×1350) · **Slides:** 1
- **HTML:** `html/post-02/` · **PNG:** `output/post-02/`
- Logo, eyebrow "Seu companheiro de tarefas", "Anote agora. Decida depois.", "Sem conta, sem
  servidor, do seu jeito e com tranquilidade.", CTA em texto (não botão): "Abra no navegador, instale no celular" + get-taskmate.web.app.
- **Fundo:** a cena inteira do vídeo do hero (vaso, livros, aparador, luz da janela),
  `bg.jpg`, na metade de baixo, dissolvendo para cima em `#f5f7fa` como o hero no celular.
  O texto fica todo sobre a superfície, nunca sobre a foto (o topo do quadro é escuro).
  Vídeo: Cup of Couple, Pexels.
- **Hashtags:** taskmate, organizacao, listadetarefas, organizacaopessoal, gestaodotempo,
  produtividadecalma, todolist, appdetarefas

## Como manter este arquivo

Sempre que um post for criado ou tiver o status alterado:

1. Adicione/atualize a linha na **tabela**.
2. Adicione/atualize o bloco em **Detalhes por post**.
3. Atualize a data de "Última atualização" no topo.

Fonte da verdade de cada post: `html/post-NN/meta.json`.
