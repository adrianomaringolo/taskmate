import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { describeStamp } from '../lib/date';
import { useStore } from '../lib/store';
import type { Note } from '../lib/types';
import { EmptyState } from './EmptyState';
import { Icon } from './Icon';
import { InlineCreate } from './InlineCreate';
import { InlineText } from './InlineText';

/**
 * Flat, tag-only — no list or group to choose, matching PRODUCT.md's
 * "captura antes de estrutura": a note is title + body + tags, nothing that
 * needs an address before it can be written down.
 */
export function NotesView() {
  const { data, addNote } = useStore();
  const notes = [...data.notes].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  return (
    <div className="main__inner">
      <header className="view-head">
        <p className="view-head__crumb">
          <Icon name="notepadText" size={13} />
          Captura livre, com etiquetas
        </p>
        <h1 className="view-head__title">Notas</h1>
        <p className="view-head__sub">
          {notes.length === 0 ? 'Nenhuma nota ainda.' : `${notes.length} ${notes.length === 1 ? 'nota' : 'notas'}`}
        </p>
      </header>

      <NoteQuickAdd onCreate={(title) => void addNote({ title })} />

      {notes.length === 0 ? (
        <EmptyState illustration="list-empty" title="Nenhuma nota ainda">
          Use o campo acima para escrever algo que não é tarefa — uma referência, uma ideia, um
          lembrete solto. Etiquetas ajudam a reencontrar depois; nenhuma lista é obrigatória.
        </EmptyState>
      ) : (
        <ul className="notes">
          {notes.map((note) => (
            <NoteCard key={note.id} note={note} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** A one-line field, same register as QuickAdd but with no capture syntax to parse. */
function NoteQuickAdd({ onCreate }: { onCreate: (title: string) => void }) {
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
            placeholder="Nova nota…"
            aria-label="Nova nota"
            maxLength={300}
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

export function NoteCard({ note }: { note: Note }) {
  const { patchNote, removeNote, addNoteTag, removeNoteTag, allTags } = useStore();
  const ids = useId();
  const [body, setBody] = useState(note.body);

  useEffect(() => setBody(note.body), [note.id, note.body]);

  const commitBody = useCallback(() => {
    if (body !== note.body) void patchNote(note.id, { body });
  }, [body, note.body, note.id, patchNote]);

  // Same autosave-while-typing discipline as a task's notes field: the body
  // survives a closed tab instead of waiting for a blur that may never come.
  useEffect(() => {
    if (body === note.body) return;
    const timer = setTimeout(commitBody, 600);
    return () => clearTimeout(timer);
  }, [body, note.body, commitBody]);

  const flushRef = useRef(commitBody);
  flushRef.current = commitBody;
  useEffect(() => () => flushRef.current(), []);

  return (
    <li className="note">
      <div className="note__head">
        <InlineText
          className="title-input note__title"
          value={note.title}
          ariaLabel="Título da nota"
          placeholder="Sem título"
          maxLength={120}
          onCommit={(title) => void patchNote(note.id, { title })}
        />
        <button
          type="button"
          className="btn btn--icon note__delete"
          aria-label="Excluir nota"
          title="Excluir"
          onClick={() => void removeNote(note.id)}
        >
          <Icon name="trash" size={14} />
        </button>
      </div>

      <textarea
        className="textarea note__body"
        value={body}
        placeholder="Escreva aqui…"
        aria-label="Corpo da nota"
        onChange={(e) => setBody(e.target.value)}
        onBlur={commitBody}
      />

      <div className="note__foot">
        <div className="tag-list" role="group" aria-labelledby={`${ids}-tags`}>
          <span className="sr-only" id={`${ids}-tags`}>
            Etiquetas
          </span>
          {note.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="tag tag--removable"
              onClick={() => void removeNoteTag(note.id, tag)}
              aria-label={`Remover etiqueta ${tag}`}
              title="Remover"
            >
              {tag}
              <Icon name="x" size={10} />
            </button>
          ))}
          <InlineCreate
            compact
            label="Adicionar etiqueta"
            placeholder="Nome da etiqueta"
            maxLength={40}
            suggestions={allTags.filter((t) => !note.tags.includes(t))}
            onCreate={(tag) => void addNoteTag(note.id, tag)}
          />
        </div>
        <span className="note__stamp">Atualizada em {describeStamp(note.updatedAt)}</span>
      </div>
    </li>
  );
}
