# CLAUDE.md — Taskmate

Orientações para quem desenvolver neste repositório (pessoa ou agente).

## Versionamento — bump a cada commit

A versão exibida no app (menu **Sobre**) vem do campo `"version"` do
`package.json` da raiz — lido em build-time por `web/vite.config.ts` como
`__APP_VERSION__`. É a única forma que o usuário tem de saber se está rodando
um build atualizado, então ela precisa refletir a realidade.

**Todo commit que altera código do app (`web/`, `tools/`) deve, na mesma
alteração, incrementar essa versão**, seguindo semver (`MAJOR.MINOR.PATCH`) —
avalie qual dos três casos abaixo se aplica antes de commitar:

- **MAJOR**: muda algo incompatível com o que já está publicado — formato do
  documento Automerge (`web/src/lib/doc.ts`), do arquivo `taskmate.automerge`
  no Drive, do schema do IndexedDB, ou qualquer dado persistido que exigiria
  migração (ou seria perdido) se um dispositivo num build antigo sincronizasse
  com um dispositivo no build novo.
- **MINOR**: funcionalidade nova ou mudança de comportamento visível para o
  usuário, compatível com o que já existe (tela nova, campo novo, novo
  comportamento de sync, nova preferência).
- **PATCH**: correção de bug, ajuste de UI/copy, refactor interno,
  performance — nada que o usuário descreveria como "chegou algo novo".

Não incremente para commits que só tocam documentação (`README.md`, `docs/`,
comentários), testes, ou configuração de ferramentas sem efeito no app
publicado.

`web/package.json` tem sua própria versão, mas ela não é lida em lugar
nenhum do app — não precisa acompanhar o bump da raiz.
