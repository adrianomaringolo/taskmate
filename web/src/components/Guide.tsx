import { useEffect, useRef } from 'react';
import { Icon } from './Icon';

interface Props {
  open: boolean;
  onClose: () => void;
}

const CAPTURE_TOKENS: [string, string][] = [
  ['hoje / amanhã', 'prazo para hoje ou amanhã'],
  ['seg … dom', 'próxima ocorrência do dia'],
  ['12/03', 'data específica'],
  ['+3', 'daqui a 3 dias'],
  ['!alta !media !baixa', 'prioridade'],
  ['diária semanal mensal', 'repetição'],
];

const SHORTCUTS: [string, string][] = [
  ['N', 'Nova tarefa'],
  ['/', 'Buscar'],
  ['Ctrl + Z', 'Desfazer exclusão'],
  ['Alt + ↑ ↓', 'Mover tarefa (na alça)'],
  ['Esc', 'Cancelar / fechar'],
];

/**
 * The complete reference — every explicit list of everything the app does,
 * as opposed to Welcome.tsx's brief first-visit carousel. Same native-
 * `<dialog>` handling as every other panel here: `onClose` only ever fires
 * from the dialog's own `close` event.
 */
export function Guide({ open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = () => ref.current?.close();

  return (
    <dialog
      ref={ref}
      className="dialog guide"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <button type="button" className="btn btn--icon dialog__close" aria-label="Fechar" onClick={close}>
        <Icon name="x" />
      </button>

      <h2 className="dialog__title">Tudo o que o Taskmate faz</h2>
      <p className="dialog__body">Referência completa, em vez do tour de boas-vindas — pode ser lida em qualquer ordem.</p>

      <section className="guide__section">
        <h3 className="guide__heading">Captura</h3>
        <p className="guide__body">
          A tecla <kbd className="kbd">N</kbd> foca o campo de captura em qualquer tela. O que você
          escreve cai na Entrada — ou na lista aberta, se estiver dentro de uma.
        </p>
        <p className="guide__body">
          Prazo, prioridade e repetição podem ir no próprio texto; a palavra reconhecida vira campo
          da tarefa e some do título:
        </p>
        <dl className="sheet__list sheet__list--tokens guide__tokens">
          {CAPTURE_TOKENS.map(([token, what]) => (
            <div className="sheet__item" key={token}>
              <dt>
                <code className="sheet__token">{token}</code>
              </dt>
              <dd>{what}</dd>
            </div>
          ))}
        </dl>
        <p className="guide__body">
          O que o app não reconhece continua no título — a captura nunca recusa texto puro. Colar um
          bloco com várias linhas cria uma tarefa por linha.
        </p>
        <p className="guide__body">
          No celular, compartilhar um link, um texto ou um post (do Instagram, do navegador, de
          qualquer app) com o Taskmate pergunta se ele vira tarefa ou nota, com o texto recebido já
          pronto para editar antes de salvar.
        </p>
      </section>

      <section className="guide__section">
        <h3 className="guide__heading">Organização</h3>
        <p className="guide__body">
          Grupos separam contextos de vida — Casa, um cliente, estudos. Listas dividem cada grupo em
          frentes de trabalho. A Entrada recebe o que ainda não tem endereço e nunca pode ser
          excluída.
        </p>
        <ul className="guide__list">
          <li>
            Arraste uma tarefa pela alça até uma lista na lateral (a Entrada também vale) para
            movê-la para lá — um grupo recolhido se abre se você segurar a tarefa em cima dele. Ou
            use as setas no detalhe da tarefa.
          </li>
          <li>Grupos e listas são reordenáveis pela lateral, também por arrastar.</li>
          <li>
            Um grupo pode virar um <strong>Quadro</strong>: cada lista vira uma coluna, cada tarefa
            um cartão arrastável entre colunas.
          </li>
          <li>Cada grupo tem uma cor — só orientação visual na lateral, nunca preenchimento chapado.</li>
        </ul>
      </section>

      <section className="guide__section">
        <h3 className="guide__heading">Visões</h3>
        <ul className="guide__list">
          <li>
            <strong>Hoje</strong> — o que vence hoje ou já passou do prazo.
          </li>
          <li>
            <strong>Próximos 7 dias</strong> — o que vence essa semana, agrupado por dia.
          </li>
          <li>
            <strong>A revisar</strong> — tudo o que está aberto sem prazo, cruzando listas, com ação
            de dar prazo direto na linha.
          </li>
          <li>
            <strong>Insights</strong> — atraso concentrado numa lista, prioridade alta sem prazo,
            grupos parados há muito tempo. Sem gráfico e sem contagem do que já foi concluído — é um
            assistente de triagem, não um painel de produtividade.
          </li>
          <li>
            <strong>Calendário</strong> — mês, semana ou dia.
          </li>
          <li>
            <strong>Busca</strong> — tarefas, notas e planos, por título, corpo e etiquetas.
          </li>
          <li>
            <strong>Notas</strong> — captura livre com etiquetas, sem lista ou grupo obrigatório.
          </li>
          <li>
            <strong>Planos</strong> — ideias de longo prazo, com tarefas e notas apontando para elas.
          </li>
        </ul>
      </section>

      <section className="guide__section">
        <h3 className="guide__heading">Cada tarefa</h3>
        <ul className="guide__list">
          <li>
            <strong>Prazo</strong>, e um <strong>Início</strong> opcional — que só esconde a tarefa
            de Hoje e Próximos até a data chegar. A lista onde ela mora sempre mostra tudo.
          </li>
          <li>
            <strong>Prioridade</strong>: nenhuma, baixa, média ou alta.
          </li>
          <li>
            <strong>Repetição</strong>: diária, semanal ou mensal. Concluir avança para a próxima
            data — a tarefa nunca vira uma linha nova, nem some do histórico.
          </li>
          <li>
            <strong>Checklist</strong>: passos marcáveis dentro da tarefa, sem prazo ou prioridade
            próprios.
          </li>
          <li>
            <strong>Etiquetas</strong>: texto livre, sem cor, buscáveis.
          </li>
          <li>
            <strong>Notas</strong> em texto livre.
          </li>
          <li>
            <strong>Plano</strong>: qual plano de longo prazo ela serve, se algum — opcional, não
            move a tarefa da lista onde ela mora.
          </li>
        </ul>
      </section>

      <section className="guide__section">
        <h3 className="guide__heading">Notas</h3>
        <p className="guide__body">
          Para o que não é tarefa — uma referência, uma ideia solta, algo para guardar sem prazo nem
          conclusão. Título, corpo com formatação simples e etiquetas: as mesmas etiquetas das
          tarefas, mesmo vocabulário, buscável junto. Sem lista nem grupo — nada aqui exige
          endereço antes de ser escrito.
        </p>
        <p className="guide__body">
          O corpo aceita negrito, itálico, sublinhado, títulos e marcadores — só isso, de propósito.
          Nada de tabelas, imagens ou links: uma nota continua rápida de escrever e de ler.
        </p>
      </section>

      <section className="guide__section">
        <h3 className="guide__heading">Planos</h3>
        <p className="guide__body">
          Uma ideia grande demais para uma tarefa só — escrever um livro, uma viagem, uma mudança de
          carreira. Título, descrição livre e um jeito de marcar como concluído, sem prazo nem
          repetição.
        </p>
        <p className="guide__body">
          Um plano não é mais um nível na hierarquia grupo › lista: uma tarefa continua na sua lista
          de sempre, e uma nota continua solta — cada uma pode só também apontar para um plano, pelos
          detalhes dela, para reaparecer junto quando você abrir o plano. Nenhum progresso é
          calculado; o ponto é ver o objetivo e o que já serve a ele, não medir.
        </p>
      </section>

      <section className="guide__section">
        <h3 className="guide__heading">Sincronizar entre dispositivos</h3>
        <p className="guide__body">
          Opcional, por um único arquivo no seu Google Drive. Sem servidor nosso, sem tabela de
          usuários, sem senha — o arquivo é seu, visível e copiável fora do app. Sem conectar nada,
          os dados ficam só neste dispositivo, e o app funciona igual.
        </p>
      </section>

      <section className="guide__section">
        <h3 className="guide__heading">Lembrete diário</h3>
        <p className="guide__body">
          Um aviso a partir das 8h sobre o que vence hoje ou amanhã, na próxima vez que o app
          estiver aberto. Sem servidor por trás — nada chega com o navegador fechado. Liga nas
          Preferências.
        </p>
      </section>

      <section className="guide__section">
        <h3 className="guide__heading">Música ambiente</h3>
        <p className="guide__body">
          Seis músicas relaxantes para tocar ao fundo enquanto você organiza o dia — chuva, pads
          cósmicos, meditações. Deixar ligada ajuda a organizar os pensamentos. Escolha no ícone de
          nota musical, no topo, ou nas Preferências. Com “Tocar em sequência”, ao fim de cada música
          passa para a próxima. O app lembra a música e se ela estava tocando, e retoma no primeiro
          toque da próxima visita.
        </p>
      </section>

      <section className="guide__section">
        <h3 className="guide__heading">Nunca perder uma tarefa (ou nota)</h3>
        <p className="guide__body">
          Excluir tem desfazer na hora (<kbd className="kbd">Ctrl</kbd> + <kbd className="kbd">Z</kbd>
          ), e tudo o que foi excluído — tarefa ou nota — continua na Lixeira, restaurável quando
          quiser. Nada é apagado de verdade.
        </p>
      </section>

      <section className="guide__section">
        <h3 className="guide__heading">Preferências</h3>
        <p className="guide__body">
          Tema (claro, escuro ou seguir o sistema), texto ampliado, música ambiente, início da
          semana, o lembrete diário e exportar tudo em Markdown legível — tudo na engrenagem, no topo.
        </p>
      </section>

      <section className="guide__section">
        <h3 className="guide__heading">Atalhos</h3>
        <dl className="sheet__list guide__tokens">
          {SHORTCUTS.map(([keys, what]) => (
            <div className="sheet__item" key={keys}>
              <dt>{what}</dt>
              <dd>
                <kbd className="kbd">{keys}</kbd>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="guide__section">
        <h3 className="guide__heading">Instalar e usar offline</h3>
        <p className="guide__body">
          Dá para instalar como app pelo menu do navegador e continuar usando sem internet — o que
          for feito offline sincroniza sozinho quando a conexão voltar.
        </p>
      </section>
    </dialog>
  );
}
