import { useCallback, useEffect, useRef, useState } from 'react';
import { describeStamp } from '../lib/date';
import { useStore } from '../lib/store';
import type { Plan } from '../lib/types';
import { EmptyState } from './EmptyState';
import { Icon } from './Icon';
import { InlineText } from './InlineText';
import { NoteCard } from './NotesView';
import { TaskRow } from './TaskRow';

/**
 * Long-term ideas — "Escrever um livro", "Viagem para a Europa" — distinct
 * from the grupo›lista hierarchy, which organises the daily work rather than
 * what it serves. A Plano has no address to file things *into*; a task or
 * note keeps living where it already does and only optionally also points
 * at one (see Task.planId / TaskDetail's "Plano" field, and the same in
 * NoteCard). Flat, tag-free, no manual reordering — see PRODUCT.md's
 * "captura antes de estrutura": writing one down asks for nothing but a
 * title.
 */
export function PlansView() {
  const { data, addPlan } = useStore();
  const active = data.plans.filter((p) => !p.done);
  const done = data.plans.filter((p) => p.done);

  return (
    <div className="main__inner">
      <header className="view-head">
        <p className="view-head__crumb">
          <Icon name="target" size={13} />
          Ideias de longo prazo
        </p>
        <h1 className="view-head__title">Planos</h1>
        <p className="view-head__sub">
          {data.plans.length === 0 ? 'Nenhum plano ainda.' : `${active.length} ${active.length === 1 ? 'plano ativo' : 'planos ativos'}`}
        </p>
      </header>

      <PlanQuickAdd onCreate={(title) => void addPlan({ title })} />

      {data.plans.length === 0 ? (
        <EmptyState illustration="list-empty" title="Nenhum plano ainda">
          Um plano é uma ideia grande demais para uma tarefa só — um livro, uma viagem, uma mudança
          de carreira. Tarefas e notas podem apontar para ele conforme você for escrevendo.
        </EmptyState>
      ) : (
        <>
          {active.length > 0 && (
            <ul className="plans">
              {active.map((plan) => (
                <PlanCard key={plan.id} plan={plan} />
              ))}
            </ul>
          )}
          {done.length > 0 && <DonePlans plans={done} />}
        </>
      )}
    </div>
  );
}

function PlanQuickAdd({ onCreate }: { onCreate: (title: string) => void }) {
  const [value, setValue] = useState('');

  const submit = () => {
    const title = value.trim();
    if (!title) return;
    setValue('');
    onCreate(title);
  };

  return (
    <div className="quick-add">
      <div className="quick-add__field">
        <span className="quick-add__plus" aria-hidden="true">
          <Icon name="plus" />
        </span>
        <div className="quick-add__editor">
          <input
            className="quick-add__input"
            value={value}
            placeholder="Novo plano…"
            aria-label="Novo plano"
            maxLength={200}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setValue('');
                e.currentTarget.blur();
              }
            }}
          />
        </div>
        {value.trim() && (
          <button type="button" className="btn btn--sm btn--primary" onClick={submit}>
            Adicionar
          </button>
        )}
      </div>
    </div>
  );
}

function DonePlans({ plans }: { plans: Plan[] }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="done-section">
      <button type="button" className="done-section__head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="chevron" size={12} className="done-section__chevron" />
        Concluídos ({plans.length})
      </button>
      {open && (
        <ul className="plans">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function PlanCard({ plan }: { plan: Plan }) {
  const { data, patchPlan, removePlan } = useStore();
  const [description, setDescription] = useState(plan.description);

  useEffect(() => setDescription(plan.description), [plan.id, plan.description]);

  const commitDescription = useCallback(() => {
    if (description !== plan.description) void patchPlan(plan.id, { description });
  }, [description, patchPlan, plan.description, plan.id]);

  // Same autosave-while-typing discipline as a task's notes field and a
  // note's body: survives a closed tab instead of waiting for a blur that
  // may never come.
  useEffect(() => {
    if (description === plan.description) return;
    const timer = setTimeout(commitDescription, 600);
    return () => clearTimeout(timer);
  }, [description, plan.description, commitDescription]);

  const flushRef = useRef(commitDescription);
  flushRef.current = commitDescription;
  useEffect(() => () => flushRef.current(), []);

  const tasks = data.tasks.filter((t) => t.planId === plan.id);
  const notes = data.notes.filter((n) => n.planId === plan.id);

  return (
    <li className="plan" data-done={plan.done}>
      <div className="plan__head">
        <button
          type="button"
          className="check"
          role="checkbox"
          aria-checked={plan.done}
          aria-label={plan.done ? `Reabrir ${plan.title || 'plano'}` : `Concluir ${plan.title || 'plano'}`}
          onClick={() => void patchPlan(plan.id, { done: !plan.done })}
        >
          <svg className="check__tick" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M4 9.2l3.1 3.1L14 5.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <InlineText
          className="title-input plan__title"
          value={plan.title}
          ariaLabel="Título do plano"
          placeholder="Sem título"
          maxLength={200}
          onCommit={(title) => void patchPlan(plan.id, { title })}
        />
        <button
          type="button"
          className="btn btn--icon plan__delete"
          aria-label="Excluir plano"
          title="Excluir"
          onClick={() => void removePlan(plan.id)}
        >
          <Icon name="trash" size={14} />
        </button>
      </div>

      <textarea
        className="textarea plan__description"
        value={description}
        placeholder="Do que se trata, por que importa, o que fica pronto quando terminar."
        aria-label="Descrição do plano"
        onChange={(e) => setDescription(e.target.value)}
        onBlur={commitDescription}
      />

      {(tasks.length > 0 || notes.length > 0) && (
        <div className="plan__attached">
          {tasks.length > 0 && (
            <div className="plan__section">
              <p className="plan__section-title">
                {tasks.length} {tasks.length === 1 ? 'tarefa' : 'tarefas'}
              </p>
              <ul className="tasks">
                {tasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </ul>
            </div>
          )}
          {notes.length > 0 && (
            <div className="plan__section">
              <p className="plan__section-title">
                {notes.length} {notes.length === 1 ? 'nota' : 'notas'}
              </p>
              <ul className="notes">
                {notes.map((note) => (
                  <NoteCard key={note.id} note={note} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <p className="plan__stamp">
        {plan.done && plan.doneAt ? `Concluído em ${describeStamp(plan.doneAt)}` : `Criado em ${describeStamp(plan.createdAt)}`}
      </p>
    </li>
  );
}
