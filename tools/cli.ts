#!/usr/bin/env -S npx tsx
/**
 * Command-line access to the same Automerge/Drive document the web app
 * syncs — the shape an external agent needs to read or create tasks without
 * inventing its own storage. Talks to Drive with its own OAuth client (see
 * tools/cli/README.md) and reuses `doc.ts`/`sync.ts` unmodified, so a task
 * this CLI adds merges with the web app exactly like a second browser tab
 * would, offline-safe interleavings included.
 *
 *   npx tsx tools/cli.ts <command> [args] [--flags]
 */
import * as doc from '../web/src/lib/doc.js';
import type { AppState, List, Priority, Task } from '../web/src/lib/types.js';
import { PRIORITY_LABELS } from '../web/src/lib/types.js';
import * as auth from './cli/auth.js';
import { CliError } from './cli/config.js';
import { pull, push } from './cli/data.js';
import { driveTransport } from './cli/drive.js';

// --- arg parsing ----------------------------------------------------------

interface Args {
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq === -1) flags[arg.slice(2)] = true;
      else flags[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function flagString(flags: Args['flags'], name: string): string | undefined {
  const value = flags[name];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new CliError(`--${name} precisa de um valor.`);
  return value;
}

// --- list/priority resolution ---------------------------------------------

function findList(state: AppState, ref: string | undefined): List {
  if (ref === undefined) {
    const inbox = state.lists.find((l) => l.isInbox);
    if (!inbox) throw new CliError('Nenhuma lista de entrada encontrada no documento.');
    return inbox;
  }
  const byId = state.lists.find((l) => l.id === ref);
  if (byId) return byId;
  const byName = state.lists.find((l) => l.name.toLowerCase() === ref.toLowerCase());
  if (byName) return byName;
  const known = state.lists.map((l) => l.name).join(', ');
  throw new CliError(`Lista "${ref}" não encontrada. Listas disponíveis: ${known}`);
}

const PRIORITY_WORDS: Record<string, Priority> = { nenhuma: 0, baixa: 1, media: 2, média: 2, alta: 3 };

function parsePriority(raw: string | undefined): Priority | undefined {
  if (raw === undefined) return undefined;
  if (/^[0-3]$/.test(raw)) return Number(raw) as Priority;
  const word = PRIORITY_WORDS[raw.toLowerCase()];
  if (word === undefined) throw new CliError(`Prioridade inválida: "${raw}" (use 0-3, baixa, media ou alta).`);
  return word;
}

// --- printing ---------------------------------------------------------------

function printTask(t: Task, listName: string): string {
  const parts = [t.done ? '[x]' : '[ ]', t.id.slice(0, 8), t.title];
  if (t.dueDate) parts.push(`vence ${t.dueDate}`);
  if (t.priority > 0) parts.push(PRIORITY_LABELS[t.priority]);
  parts.push(`(${listName})`);
  return parts.join('  ');
}

// --- commands ---------------------------------------------------------------

async function cmdAuthLogin(): Promise<void> {
  await auth.login();
}

async function cmdAuthLogout(): Promise<void> {
  await auth.logout();
  console.log('Desconectado.');
}

function cmdAuthStatus(json: boolean): void {
  const s = auth.status();
  if (json) {
    console.log(JSON.stringify(s));
    return;
  }
  console.log(s.connected ? `Conectado${s.email ? ` como ${s.email}` : ''}.` : 'Não conectado.');
}

async function cmdLists(args: Args): Promise<void> {
  const json = args.flags.json === true;
  const d = await pull(driveTransport, false);
  const state = doc.project(d);
  if (json) {
    console.log(JSON.stringify(state.lists.map((l) => ({ id: l.id, name: l.name, groupId: l.groupId }))));
    return;
  }
  for (const group of state.groups) {
    console.log(group.name);
    for (const list of state.lists.filter((l) => l.groupId === group.id)) {
      console.log(`  ${list.id.slice(0, 8)}  ${list.name}`);
    }
  }
  const ungrouped = state.lists.filter((l) => l.groupId === null);
  if (ungrouped.length > 0) {
    console.log('(sem grupo)');
    for (const list of ungrouped) console.log(`  ${list.id.slice(0, 8)}  ${list.name}`);
  }
}

async function cmdList(args: Args): Promise<void> {
  const json = args.flags.json === true;
  const d = await pull(driveTransport, false);
  const state = doc.project(d);
  const list = findList(state, flagString(args.flags, 'list'));
  const showAll = args.flags.all === true;
  const tasks = state.tasks.filter((t) => t.listId === list.id && (showAll || !t.done));

  if (json) {
    console.log(JSON.stringify(tasks));
    return;
  }
  if (tasks.length === 0) {
    console.log(`(nenhuma tarefa em ${list.name})`);
    return;
  }
  for (const t of tasks) console.log(printTask(t, list.name));
}

async function cmdAdd(args: Args): Promise<void> {
  const title = args.positional[0];
  if (!title) throw new CliError('Uso: taskmate add "<título>" [--list=] [--due=YYYY-MM-DD] [--priority=] [--notes=]');
  const json = args.flags.json === true;

  const d = await pull(driveTransport, args.flags.create === true);
  const state = doc.project(d);
  const list = findList(state, flagString(args.flags, 'list'));

  const [next, id] = doc.addTask(d, {
    listId: list.id,
    title,
    notes: flagString(args.flags, 'notes'),
    dueDate: flagString(args.flags, 'due') ?? null,
    priority: parsePriority(flagString(args.flags, 'priority')),
  });
  await push(driveTransport, next);

  if (json) console.log(JSON.stringify({ id, listId: list.id }));
  else console.log(`Criada: ${id.slice(0, 8)}  ${title}  (${list.name})`);
}

async function cmdDone(args: Args): Promise<void> {
  const ref = args.positional[0];
  if (!ref) throw new CliError('Uso: taskmate done <id>');
  const json = args.flags.json === true;

  const d = await pull(driveTransport, false);
  const state = doc.project(d);
  const task = state.tasks.find((t) => t.id === ref || t.id.startsWith(ref));
  if (!task) throw new CliError(`Tarefa "${ref}" não encontrada.`);

  const next = doc.patchTask(d, task.id, { done: true });
  await push(driveTransport, next);

  if (json) console.log(JSON.stringify({ id: task.id }));
  else console.log(`Concluída: ${task.title}`);
}

function printHelp(): void {
  console.log(`taskmate <comando> [args] [--flags]

Comandos:
  auth login              conecta ao Google Drive (device flow)
  auth status              mostra se está conectado
  auth logout              desconecta e revoga o token local
  lists                    lista grupos e listas
  list [--list=] [--all]   lista tarefas (padrão: entrada, pendentes)
  add "<título>" [--list=] [--due=YYYY-MM-DD] [--priority=0-3|baixa|media|alta] [--notes=]
  done <id>                marca uma tarefa como concluída

Flags globais:
  --json                   saída em JSON, para consumo por outro programa
  --create                 permite criar um novo arquivo no Drive se nenhum for encontrado
                            (veja tools/cli/README.md antes de usar isso)`);
}

async function main(): Promise<void> {
  const command = process.argv[2];

  switch (command) {
    case 'auth': {
      const sub = process.argv[3];
      const args = parseArgs(process.argv.slice(4));
      if (sub === 'login') return cmdAuthLogin();
      if (sub === 'logout') return cmdAuthLogout();
      if (sub === 'status') return cmdAuthStatus(args.flags.json === true);
      throw new CliError('Uso: taskmate auth <login|status|logout>');
    }
    case 'lists':
      return cmdLists(parseArgs(process.argv.slice(3)));
    case 'list':
      return cmdList(parseArgs(process.argv.slice(3)));
    case 'add':
      return cmdAdd(parseArgs(process.argv.slice(3)));
    case 'done':
      return cmdDone(parseArgs(process.argv.slice(3)));
    case 'help':
    case undefined:
    case '--help':
      printHelp();
      return;
    default:
      throw new CliError(`Comando desconhecido: ${command}. Rode "taskmate help".`);
  }
}

main().catch((err: unknown) => {
  if (err instanceof CliError) {
    console.error(err.message);
    process.exitCode = 1;
    return;
  }
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
