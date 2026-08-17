/**
 * Drives the real UI through the flows screenshots cannot prove. There is no
 * server any more: persistence is IndexedDB, so "survives a reload" now proves
 * the local document round-tripped through its own binary format.
 *
 *   npm run dev            (in another terminal)
 *   npm run test:e2e
 */
import { chromium, type Browser, type Page } from 'playwright';
import { demoDoc, installDoc } from './seed.js';

const WEB = process.argv[2] ?? 'http://127.0.0.1:5173';

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

/** Fresh context each time: isolated storage, so no cleanup step can go stale. */
async function freshPage(browser: Browser, seeded = false): Promise<{ page: Page; errors: string[] }> {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'pt-BR' });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(WEB, { waitUntil: 'networkidle' });
  if (seeded) {
    await installDoc(page, demoDoc());
    await page.reload({ waitUntil: 'networkidle' });
  }
  return { page, errors };
}

const titles = (page: Page) =>
  page.locator('.tasks .task__title-input').evaluateAll((els) =>
    els.map((e) => (e as HTMLTextAreaElement).value)
  );

async function run() {
  const browser = await chromium.launch();

  // ---------------------------------------------------------------- part 1
  // Build the hierarchy from nothing, on a first-run document.
  {
    const { page, errors } = await freshPage(browser);

    await page.locator('.view-head__title').waitFor();
    check('primeiro uso abre sem servidor nem configuração', true);

    await page.getByRole('button', { name: 'Novo grupo' }).click();
    await page.getByLabel('Novo grupo').fill('Cliente X');
    await page.getByLabel('Novo grupo').press('Enter');
    await page.locator('.group__name', { hasText: 'Cliente X' }).waitFor();
    check('grupo criado', true);

    const group = page.locator('.group', { has: page.locator('.group__name', { hasText: 'Cliente X' }) });
    await group.hover();
    await group.getByRole('button', { name: 'Nova lista' }).click();
    await group.getByLabel('Nova lista').fill('Entregas');
    await group.getByLabel('Nova lista').press('Enter');
    await group.locator('button.row', { hasText: 'Entregas' }).waitFor();
    check('lista criada dentro do grupo', true);

    await group.locator('button.row', { hasText: 'Entregas' }).click();
    await page.locator('.view-head__title').getByText('Entregas').waitFor();

    const quick = page.getByLabel('Nova tarefa em Entregas');
    for (const title of ['Primeira', 'Segunda', 'Terceira']) {
      await quick.fill(title);
      await quick.press('Enter');
      await page.locator('.task').filter({ hasText: title }).waitFor();
    }
    check(
      'três atividades na ordem de criação',
      JSON.stringify(await titles(page)) === '["Primeira","Segunda","Terceira"]',
      (await titles(page)).join(' / ')
    );

    // --- complete ------------------------------------------------------
    await page.locator('.task', { hasText: 'Segunda' }).getByRole('checkbox').click();
    await page.getByRole('button', { name: /Concluídas \(1\)/ }).waitFor();
    check(
      'concluir separa da lista principal',
      JSON.stringify(await titles(page)) === '["Primeira","Terceira"]',
      (await titles(page)).join(' / ')
    );

    // --- reorder by keyboard, over an invisible completed row ----------
    const grip = page.locator('.task', { hasText: 'Terceira' }).locator('.task__grip');
    await grip.focus();
    await grip.press('Alt+ArrowUp');
    await page.waitForTimeout(200);
    check(
      'Alt+↑ reordena pulando a concluída',
      JSON.stringify(await titles(page)) === '["Terceira","Primeira"]',
      (await titles(page)).join(' / ')
    );

    // --- drag ----------------------------------------------------------
    await page.locator('.task', { hasText: 'Terceira' }).hover();
    await page
      .locator('.task', { hasText: 'Terceira' })
      .locator('.task__grip')
      .dragTo(page.locator('.task', { hasText: 'Primeira' }), { targetPosition: { x: 200, y: 30 } });
    await page.waitForTimeout(300);
    check(
      'arrastar pela alça reordena',
      JSON.stringify(await titles(page)) === '["Primeira","Terceira"]',
      (await titles(page)).join(' / ')
    );

    // --- delete then undo ----------------------------------------------
    await page
      .locator('.task', { hasText: 'Primeira' })
      .getByRole('button', { name: /Excluir Primeira/ })
      .click();
    const toast = page.locator('.toast', { hasText: 'foi excluída' });
    await toast.waitFor();
    check(
      'excluir remove da lista e oferece desfazer',
      JSON.stringify(await titles(page)) === '["Terceira"]',
      (await titles(page)).join(' / ')
    );
    await toast.getByRole('button', { name: 'Desfazer' }).click();
    await page.locator('.task', { hasText: 'Primeira' }).waitFor();
    check('desfazer restaura a atividade', true);

    // --- delete a whole group, then undo it ----------------------------
    await group.getByRole('button', { name: /Ações do grupo/ }).click();
    await page.getByRole('button', { name: 'Excluir grupo' }).click();
    await page.getByRole('button', { name: 'Excluir', exact: true }).click();
    const groupToast = page.locator('.toast', { hasText: 'foram excluídos' });
    await groupToast.waitFor();
    check('excluir grupo em cascata avisa e oferece desfazer', true);
    await groupToast.getByRole('button', { name: 'Desfazer' }).click();
    await page.locator('.group__name', { hasText: 'Cliente X' }).waitFor();
    await page.locator('button.row', { hasText: 'Entregas' }).waitFor();
    check('desfazer traz o grupo, a lista e as tarefas de volta', true);

    // --- rename + detail fields ----------------------------------------
    await page.locator('button.row', { hasText: 'Entregas' }).click();
    const heading = page.locator('.title-input');
    await heading.fill('Entregas Q3');
    await heading.press('Enter');
    await page.waitForTimeout(200);
    await page.locator('button.row', { hasText: 'Entregas Q3' }).waitFor();
    check('renomear pelo título reflete na lateral', true);

    const row = page.locator('.task', { hasText: 'Terceira' });
    await row.hover();
    await row.getByRole('button', { name: 'Abrir detalhes' }).click();
    await row.getByLabel('Notas').fill('anotação de teste');
    await row.getByRole('button', { name: 'Hoje', exact: true }).click();
    await page.waitForTimeout(300);
    await row.getByRole('button', { name: 'Fechar detalhes' }).click();
    check('prazo "hoje" aplicado sem perder as notas', await row.locator('.chip--today').isVisible());

    // --- persistence across reload -------------------------------------
    const before = await titles(page);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.view-head__title').getByText('Entregas Q3').waitFor();
    const after = await titles(page);
    check('documento sobrevive ao reload (IndexedDB)', JSON.stringify(before) === JSON.stringify(after), after.join(' / '));

    const meta = await page.locator('.task', { hasText: 'Terceira' }).locator('.task__meta').innerText();
    check('notas e prazo persistiram', meta.includes('notas') && meta.includes('hoje'), meta.replace(/\n/g, ' | '));

    // --- collapsed state is device-local, not synced --------------------
    await page.locator('.group__toggle', { hasText: 'Cliente X' }).click();
    await page.waitForTimeout(150);
    await page.reload({ waitUntil: 'networkidle' });
    const expanded = await page.locator('.group__toggle', { hasText: 'Cliente X' }).getAttribute('aria-expanded');
    check('grupo recolhido continua recolhido (localStorage)', expanded === 'false', `aria-expanded=${expanded}`);

    check('sem erros de console', errors.length === 0, errors.slice(0, 3).join(' | '));
    await page.context().close();
  }

  // ---------------------------------------------------------------- part 2
  // Seeded document: smart views, search, and the offline claim.
  {
    const { page, errors } = await freshPage(browser, true);

    await page.locator('button.row', { hasText: 'Hoje' }).click();
    await page.locator('.view-head__title').getByText('Hoje').waitFor();
    const todayRows = await titles(page);
    check('visão Hoje reúne atrasadas e de hoje', todayRows.length === 3, `${todayRows.length} linhas`);

    await page.locator('button.row', { hasText: 'Próximos 7 dias' }).click();
    await page.locator('.day-group').first().waitFor();
    const dayGroups = await page.locator('.day-group__head').count();
    check('Próximos 7 dias agrupa por dia', dayGroups >= 3, `${dayGroups} grupos de dia`);

    // Accent-insensitive search: "migracao" must find "migração".
    await page.getByLabel('Buscar tarefas').fill('migracao');
    await page.waitForTimeout(250);
    const found = await titles(page);
    check('busca ignora acentos', found.length === 1 && found[0]!.includes('migração'), found.join(' / '));

    /*
     * Offline behaviour, stated precisely: with the tab open and the network
     * down, editing works and the write reaches IndexedDB. Reloading while
     * offline does NOT work — the page itself has to be fetched, which needs a
     * service worker the app does not have yet. So: edit offline, come back
     * online, reload, and prove the write had already landed locally.
     */
    await page.getByLabel('Buscar tarefas').fill('');
    await page.locator('button.row', { hasText: 'Entrada' }).click();
    await page.context().setOffline(true);

    const quick = page.getByLabel('Nova tarefa em Entrada');
    await quick.fill('criada offline');
    await quick.press('Enter');
    await page.locator('.task', { hasText: 'criada offline' }).waitFor();
    check('cria atividade com a rede desligada', true);

    await page.context().setOffline(false);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('button.row', { hasText: 'Entrada' }).click();
    await page.locator('.task', { hasText: 'criada offline' }).waitFor();
    check('a escrita feita offline já estava no IndexedDB', true);

    check('sem erros de console (visões e busca)', errors.length === 0, errors.slice(0, 3).join(' | '));
    await page.context().close();
  }

  await browser.close();
  console.log(failures === 0 ? '\nTodos os fluxos passaram.' : `\n${failures} falha(s).`);
  process.exit(failures === 0 ? 0 : 1);
}

await run();
