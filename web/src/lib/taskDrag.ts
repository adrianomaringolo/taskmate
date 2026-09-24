import { useRef, useState, type DragEvent } from 'react';
import { useStore } from './store';

/**
 * Dragging a task onto a list in the sidebar moves it there. The row's grip
 * already starts an HTML5 drag for reordering; it also sets this type, so a
 * sidebar row can tell a task apart from a file or text dragged in from
 * outside — during dragover only the types are readable, never the data.
 */
export const TASK_MIME = 'application/x-taskmate-task';

const isTaskDrag = (e: DragEvent) => e.dataTransfer.types.includes(TASK_MIME);

/** Props for a sidebar row that takes a dropped task, plus whether one is over it. */
export function useTaskDrop(listId: string, listName: string) {
  const { data, tasksByList, moveTask, notify } = useStore();
  const [over, setOver] = useState(false);
  // dragenter/dragleave fire for every child the pointer crosses; count them
  // so the highlight does not flicker between the label and the count.
  const depth = useRef(0);

  const reset = () => {
    depth.current = 0;
    setOver(false);
  };

  return {
    over,
    props: {
      onDragEnter: (e: DragEvent) => {
        if (!isTaskDrag(e)) return;
        e.preventDefault();
        depth.current++;
        setOver(true);
      },
      onDragOver: (e: DragEvent) => {
        if (!isTaskDrag(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      },
      onDragLeave: (e: DragEvent) => {
        if (!isTaskDrag(e)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      },
      onDrop: (e: DragEvent) => {
        if (!isTaskDrag(e)) return;
        e.preventDefault();
        reset();
        const id = e.dataTransfer.getData(TASK_MIME);
        const task = data.tasks.find((t) => t.id === id);
        if (!task || task.listId === listId) return;

        const from = task.listId;
        const fromIndex = (tasksByList.get(from) ?? []).findIndex((t) => t.id === id);
        // Top of the list: the task you just moved is the one you will look for.
        void moveTask(id, listId, 0);
        notify(`Movida para ${listName}.`, 'info', {
          label: 'Desfazer',
          run: () => void moveTask(id, from, Math.max(0, fromIndex)),
        });
      },
    },
  };
}

/** Opens a collapsed group when a task is held over its header for a moment. */
export function useOpenOnTaskHover(open: () => void, isOpen: boolean) {
  const timer = useRef<number | undefined>(undefined);
  const cancel = () => window.clearTimeout(timer.current);
  return {
    onDragEnter: (e: DragEvent) => {
      if (isOpen || !isTaskDrag(e)) return;
      cancel();
      timer.current = window.setTimeout(open, 600);
    },
    onDragLeave: cancel,
    onDrop: cancel,
  };
}
