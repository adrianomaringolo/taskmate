import { useState, type RefObject } from 'react';
import { useStore } from '../lib/store';
import { Icon } from './Icon';

interface Props {
  listId: string;
  listName: string;
  inputRef?: RefObject<HTMLInputElement | null>;
}

export function QuickAdd({ listId, listName, inputRef }: Props) {
  const { addTask } = useStore();
  const [value, setValue] = useState('');

  const submit = () => {
    const title = value.trim();
    if (!title) return;
    // Clear first: the field must feel instant even if the write is in flight.
    setValue('');
    void addTask(listId, title);
  };

  return (
    <div className="quick-add">
      <span className="quick-add__plus" aria-hidden="true">
        <Icon name="plus" />
      </span>
      <input
        ref={inputRef}
        className="quick-add__input"
        value={value}
        placeholder={`Adicionar em ${listName}…`}
        aria-label={`Nova tarefa em ${listName}`}
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
      {value.trim() ? (
        <button type="button" className="btn btn--sm btn--primary" onClick={submit}>
          Adicionar
        </button>
      ) : (
        <span className="quick-add__hint" aria-hidden="true">
          <kbd className="kbd">N</kbd>
        </span>
      )}
    </div>
  );
}
