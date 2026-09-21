/*
 * Taskmate /product — bespoke interaction, on top of the untouched
 * scrollcraft engine. Three pieces:
 *
 *  1. Hero task check: reads the hero act's own --sc-p (published by the
 *     engine) to toggle a demo task done as the reader scrolls past it.
 *  2. Notes demo: the actual click-to-preview/click-to-edit behavior
 *     shipped in the real app (see web/src/components/NotesView.tsx),
 *     rebuilt here with a small real contentEditable instead of a
 *     screenshot of it.
 *  3. The signature move: a working port of the real capture parser
 *     (web/src/lib/parse.ts) so a visitor's own typed text is recognised
 *     live, exactly as it would be in the app, and becomes a real task row
 *     on Enter. Not a fake input; it runs the actual rule set.
 */
(function () {
  'use strict';

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ------------------------------------------------------------- chrome --
  // The fixed top bar's real height, so a pinned act's sticky stage (CSS,
  // under the "@media (max-width: 860px)" block) can stick just below it
  // instead of behind it. Measured, not hardcoded: the bar's content (and
  // so its height) can change with font loading or text reflow.
  (function railHeight() {
    var rail = document.querySelector('.tm-rail');
    if (!rail) return;
    function measure() {
      document.documentElement.style.setProperty('--tm-rail-h', rail.offsetHeight + 'px');
    }
    measure();
    addEventListener('resize', measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  })();

  // -------------------------------------------------------------- hero --
  (function hero() {
    var act = document.getElementById('hero');
    var task = document.getElementById('hero-task');
    if (!act || !task) return;
    var dateMark = act.querySelector('[data-mark="date"]');
    var priorityMark = act.querySelector('[data-mark="priority"]');
    var lastDone = null, lastDate = null, lastPriority = null;
    function poll() {
      var p = parseFloat(getComputedStyle(act).getPropertyValue('--sc-p')) || 0;
      var done = p > 0.55;
      if (done !== lastDone) { task.classList.toggle('tm-done', done); lastDone = done; }
      var dateOn = p > 0.15;
      if (dateOn !== lastDate) { dateMark.classList.toggle('tm-mark-in', dateOn); lastDate = dateOn; }
      var prioOn = p > 0.32;
      if (prioOn !== lastPriority) { priorityMark.classList.toggle('tm-mark-in', prioOn); lastPriority = prioOn; }
      requestAnimationFrame(poll);
    }
    requestAnimationFrame(poll);
  })();

  // ------------------------------------------------------------- notes --
  (function notes() {
    var card = document.querySelector('.tm-note');
    if (!card) return;
    var body = card.querySelector('.tm-note__body');
    var toolbar = card.querySelector('.tm-note__toolbar');
    var savedHtml = body.innerHTML;

    function enter() {
      if (card.classList.contains('tm-editing')) return;
      savedHtml = body.innerHTML;
      card.classList.add('tm-editing');
      body.setAttribute('contenteditable', 'true');
      body.focus();
      var range = document.createRange();
      range.selectNodeContents(body);
      range.collapse(false);
      var sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    function leave() {
      card.classList.remove('tm-editing');
      body.removeAttribute('contenteditable');
      if (!body.textContent.trim()) body.innerHTML = savedHtml;
    }

    body.addEventListener('click', enter);
    body.addEventListener('blur', leave);

    Array.prototype.forEach.call(toolbar.querySelectorAll('[data-cmd]'), function (btn) {
      // mousedown, not click: click fires after the body has already lost
      // selection to the toolbar button gaining focus.
      btn.addEventListener('mousedown', function (e) {
        e.preventDefault();
        var cmd = btn.getAttribute('data-cmd');
        if (cmd === 'h2') document.execCommand('formatBlock', false, 'h2');
        else if (cmd === 'p') document.execCommand('formatBlock', false, 'p');
        else if (cmd === 'ul') document.execCommand('insertUnorderedList', false);
        else document.execCommand(cmd, false);
      });
    });
  })();

  // --------------------------------------------------- the capture rule --
  // Same rules as web/src/lib/parse.ts's parseCapture, trimmed to what a
  // 30-second demo needs: date words, +N, priority, recurrence. Ported by
  // hand rather than shared, since the two run in unrelated build systems.
  var WEEKDAYS = { domingo: 0, dom: 0, segunda: 1, seg: 1, terca: 2, ter: 2, quarta: 3, qua: 3, quinta: 4, qui: 4, sexta: 5, sex: 5, sabado: 6, sab: 6 };

  function strip(s) {
    return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  }
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function addDays(key, days) {
    var parts = key.split('-').map(Number);
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function matchDate(token) {
    var t = strip(token);
    var now = todayKey();
    if (t === 'hoje') return { key: now, label: 'hoje' };
    if (t === 'amanha') return { key: addDays(now, 1), label: 'amanhã' };
    var plus = /^\+(\d{1,3})$/.exec(t);
    if (plus) return { key: addDays(now, Number(plus[1])), label: 'em ' + plus[1] + ' dias' };
    if (t in WEEKDAYS) return { key: null, label: token };
    return null;
  }
  function matchPriority(token) {
    var t = strip(token);
    if (t === '!alta' || t === '!3') return 'alta';
    if (t === '!media' || t === '!2') return 'média';
    if (t === '!baixa' || t === '!1') return 'baixa';
    return null;
  }
  function matchRecurrence(token) {
    var t = strip(token);
    if (t === 'diaria' || t === 'diariamente') return 'diária';
    if (t === 'semanal' || t === 'semanalmente') return 'semanal';
    if (t === 'mensal' || t === 'mensalmente') return 'mensal';
    return null;
  }

  function parseCapture(input) {
    var tokens = input.trim().split(/\s+/).filter(Boolean);
    var kept = [];
    var date = null, priority = null, recurrence = null;
    tokens.forEach(function (token) {
      var d = matchDate(token);
      if (d) { date = d; return; }
      var p = matchPriority(token);
      if (p) { priority = p; return; }
      var r = matchRecurrence(token);
      if (r) { recurrence = r; return; }
      kept.push(token);
    });
    var title = kept.join(' ').trim();
    return { title: title || input.trim(), date: date, priority: priority, recurrence: recurrence };
  }

  // ---------------------------------------------------------------------
  (function capture() {
    var input = document.getElementById('capture-input');
    var hint = document.getElementById('capture-hint');
    var btn = document.getElementById('capture-add');
    var list = document.getElementById('capture-list');
    if (!input || !hint || !btn || !list) return;

    function render() {
      var v = input.value;
      if (!v.trim()) {
        hint.textContent = 'Digite algo como "revisar contrato amanhã !alta"';
        return;
      }
      var parsed = parseCapture(v);
      var parts = [];
      if (parsed.date) parts.push('prazo: <mark>' + parsed.date.label + '</mark>');
      if (parsed.priority) parts.push('prioridade: <mark>' + parsed.priority + '</mark>');
      if (parsed.recurrence) parts.push('repetição: <mark>' + parsed.recurrence + '</mark>');
      hint.innerHTML = parts.length ? parts.join(' · ') : 'sem prazo, prioridade ou repetição reconhecidos';
    }

    function add() {
      var v = input.value.trim();
      if (!v) return;
      var parsed = parseCapture(v);
      var row = document.createElement('li');
      row.className = 'tm-task';
      var meta = [];
      if (parsed.date) meta.push(parsed.date.label);
      if (parsed.priority) meta.push('prioridade ' + parsed.priority);
      if (parsed.recurrence) meta.push(parsed.recurrence);
      row.innerHTML =
        '<span class="tm-check"></span>' +
        '<span class="tm-task__title">' + parsed.title.replace(/</g, '&lt;') + '</span>' +
        (meta.length ? '<span class="tm-task__meta">' + meta.join(' · ') + '</span>' : '');
      list.prepend(row);
      input.value = '';
      render();
      input.focus();
    }

    input.addEventListener('input', render);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); add(); }
    });
    btn.addEventListener('click', add);
    render();
  })();

  // ------------------------------------------------------------ mount --
  ScrollCraft.mount(document.body);
})();
