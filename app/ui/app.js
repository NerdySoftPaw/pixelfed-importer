const { invoke, convertFileSrc } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const dialog = window.__TAURI__.dialog;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const state = {
  lang: 'de',
  step: 'login',
  session: null,
  lastExports: [],
  exp: null, // { name, paths, posts, imported }
  selected: new Set(),
  filters: { sources: new Set(), year: '', q: '', hideImported: false },
  options: { visibility: 'unlisted', footerOn: true, footerText: '', sensitive: false, delay: 5 },
  run: null, // running import, see startImport
};

// ---------- i18n ----------

function t(key, vars = {}) {
  let s = STRINGS[state.lang][key] ?? STRINGS.de[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}

function applyI18n() {
  document.documentElement.lang = state.lang;
  $$('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  $$('[data-i18n-html]').forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
  $$('[data-i18n-placeholder]').forEach((el) => (el.placeholder = t(el.dataset.i18nPlaceholder)));
  $$('.lang button').forEach((b) => b.classList.toggle('active', b.dataset.lang === state.lang));
  renderGuide();
  renderAccount();
  if (state.exp) renderSelect();
  renderImport();
}

function setLang(lang) {
  const oldDefault = STRINGS[state.lang]['opts.footerDefault'];
  state.lang = lang;
  if (!state.options.footerText || state.options.footerText === oldDefault) {
    state.options.footerText = t('opts.footerDefault');
    $('#opt-footer-text').value = state.options.footerText;
  }
  applyI18n();
  invoke('save_prefs', { lang, options: state.options }).catch(() => {});
}

function errText(e) {
  const msg = String(e?.message ?? e);
  if (STRINGS.de['err.' + msg]) return t('err.' + msg);
  const [kind, ...rest] = msg.split(': ');
  if (kind === 'connect' || kind === 'register_app') return t('err.' + kind, { msg: rest.join(': ') });
  return t('err.generic', { msg });
}

function toast(text, ms = 4000) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.hidden = true), ms);
}

const fmtDate = (ts) =>
  new Date(ts * 1000).toLocaleDateString(state.lang === 'de' ? 'de-DE' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });

function fmtDuration(sec) {
  sec = Math.round(sec);
  if (sec < 60) return state.lang === 'de' ? '< 1 Min.' : '< 1 min';
  const m = Math.round(sec / 60);
  if (m < 60) return state.lang === 'de' ? `${m} Min.` : `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} ${state.lang === 'de' ? 'Min.' : 'min'}`;
}

const thumbUrl = (uri) => convertFileSrc(uri, 'igmedia');

// ---------- navigation ----------

function canGo(step) {
  if (step === 'login') return true;
  if (step === 'export') return !!state.session;
  if (step === 'select') return !!state.session && !!state.exp;
  if (step === 'import') return !!state.run;
  return false;
}

function goto(step) {
  if (!canGo(step)) return;
  state.step = step;
  $$('.view').forEach((v) => (v.hidden = v.id !== `view-${step}`));
  const order = ['login', 'export', 'select', 'import'];
  $$('#steps button').forEach((b) => {
    const s = b.dataset.step;
    b.classList.toggle('active', s === step);
    b.classList.toggle('done', order.indexOf(s) < order.indexOf(step) && canGo(s));
    b.disabled = !canGo(s);
  });
  $('main').scrollTop = 0;
}

// ---------- guide ----------

function renderGuide() {
  const sections = GUIDE[state.lang];
  $('#guide-toc').innerHTML = '';
  $('#guide-body').innerHTML = '';
  for (const s of sections) {
    const b = document.createElement('button');
    b.textContent = s.title;
    b.onclick = () => showGuideSection(s.id);
    $('#guide-toc').append(b);
    const sec = document.createElement('section');
    sec.id = `guide-${s.id}`;
    sec.innerHTML = `<h3>${s.title}</h3>${s.html}`;
    $('#guide-body').append(sec);
  }
}

function currentInstance() {
  const raw = state.session?.instance || $('#instance').value.trim() || 'pixelfed.social';
  return /^https?:\/\//.test(raw) ? raw.replace(/\/+$/, '') : `https://${raw.replace(/^@?[^@]*@/, '').replace(/\/+$/, '')}`;
}

function showGuideSection(id) {
  const el = $(`#guide-${id}`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1500);
}

function openGuide(id) {
  $('#guide').hidden = false;
  $('#drawer-backdrop').hidden = false;
  if (id) setTimeout(() => showGuideSection(id), 50);
}

function closeGuide() {
  $('#guide').hidden = true;
  $('#drawer-backdrop').hidden = true;
}

document.addEventListener('click', (e) => {
  const open = e.target.closest('[data-open]');
  if (open) {
    invoke('open_url', { url: open.dataset.open.replace('{instance}', currentInstance()) }).catch((err) => toast(errText(err)));
    return;
  }
  const guide = e.target.closest('[data-guide]');
  if (guide) return openGuide(guide.dataset.guide);
  const go = e.target.closest('[data-goto]');
  if (go) goto(go.dataset.goto);
});

// ---------- login ----------

function renderAccount() {
  const s = state.session;
  $('#account-card').hidden = !s;
  $('#login-form').hidden = !!s;
  $('#welcome').hidden = !!s;
  if (!s) return;
  $('#acc-avatar').src = s.account.avatar || 'logo.svg';
  $('#acc-name').textContent = s.account.display_name || s.account.acct;
  $('#acc-instance').textContent = `@${s.account.acct.split('@')[0]}@${new URL(s.instance).host}`;
  $('#acc-limits').textContent = t('login.limits', { chars: s.limits.max_chars, media: s.limits.max_media });
}

function loginError(e) {
  const el = $('#login-error');
  el.hidden = !e;
  el.textContent = e ? errText(e) : '';
  if (e && String(e).startsWith('register_app')) $('#token-box').open = true;
}

function setSession(s) {
  state.session = s;
  renderAccount();
  if (state.exp) refreshImported();
}

async function loginOAuth() {
  const instance = $('#instance').value.trim();
  if (!instance) return loginError('instance');
  loginError(null);
  $('#oauth-wait').hidden = false;
  $('#btn-oauth').disabled = true;
  try {
    setSession(await invoke('login_oauth', { instance }));
    goto(state.exp ? 'select' : 'export');
  } catch (e) {
    loginError(e);
  } finally {
    $('#oauth-wait').hidden = true;
    $('#btn-oauth').disabled = false;
  }
}

async function loginToken() {
  const instance = $('#instance').value.trim();
  const token = $('#token').value.trim();
  if (!instance) return loginError('instance');
  if (!token) return;
  loginError(null);
  $('#btn-token').disabled = true;
  try {
    setSession(await invoke('login_token', { instance, token }));
    $('#token').value = '';
    goto(state.exp ? 'select' : 'export');
  } catch (e) {
    loginError(e);
  } finally {
    $('#btn-token').disabled = false;
  }
}

$('#btn-oauth').onclick = loginOAuth;
$('#instance').addEventListener('keydown', (e) => e.key === 'Enter' && loginOAuth());
$('#btn-oauth-cancel').onclick = () => invoke('cancel_login');
$('#btn-token').onclick = loginToken;
$('#btn-token-page').onclick = () => invoke('open_url', { url: `${currentInstance()}/settings/applications` });
$('#btn-logout').onclick = async () => {
  try {
    await invoke('logout');
    state.session = null;
    renderAccount();
    goto('login');
  } catch (e) {
    toast(errText(e));
  }
};

// ---------- export ----------

async function openExport(paths) {
  if (!paths?.length) return;
  $('#export-error').hidden = true;
  $('#export-wait').hidden = false;
  try {
    const exp = await invoke('open_export', { paths });
    state.exp = exp;
    state.lastExports = paths;
    state.filters = { sources: new Set(), year: '', q: '', hideImported: false };
    $('#search').value = '';
    $('#hide-imported').checked = false;
    state.selected = new Set(exp.posts.filter(selectable).filter((p) => !exp.imported[p.key]).map((p) => p.key));
    renderRecent();
    renderSelect();
    goto('select');
  } catch (e) {
    $('#export-error').textContent = errText(e);
    $('#export-error').hidden = false;
  } finally {
    $('#export-wait').hidden = true;
  }
}

function renderRecent() {
  const paths = state.lastExports;
  $('#recent').hidden = !paths.length;
  if (!paths.length) return;
  const name = paths[0].split(/[\\/]/).pop();
  $('#btn-recent').textContent = paths.length > 1 ? `${name} (+${paths.length - 1})` : name;
  $('#btn-recent').title = paths.join('\n');
}

$('#btn-recent').onclick = () => openExport(state.lastExports);
$('#btn-zip').onclick = async () => {
  const picked = await dialog.open({ multiple: true, filters: [{ name: 'Instagram ZIP', extensions: ['zip'] }] });
  if (picked) openExport(Array.isArray(picked) ? picked : [picked]);
};
$('#btn-folder').onclick = async () => {
  const picked = await dialog.open({ directory: true });
  if (picked) openExport([picked]);
};

window.__TAURI__.webview.getCurrentWebview().onDragDropEvent((e) => {
  const dz = $('#dropzone');
  const type = e.payload.type;
  if (type === 'enter' || type === 'over') dz.classList.add('over');
  else dz.classList.remove('over');
  if (type === 'drop' && !state.run?.running) {
    if (!state.session) return toast(t('err.auth'));
    goto('export');
    openExport(e.payload.paths);
  }
});

// ---------- selection ----------

const selectable = (p) => p.missing === 0;

function visiblePosts() {
  const f = state.filters;
  const q = f.q.toLowerCase();
  return state.exp.posts.filter(
    (p) =>
      (!f.sources.size || f.sources.has(p.source)) &&
      (!f.year || new Date(p.timestamp * 1000).getFullYear() === Number(f.year)) &&
      (!q || p.caption.toLowerCase().includes(q)) &&
      !(f.hideImported && state.exp.imported[p.key]),
  );
}

function renderFilters() {
  const posts = state.exp.posts;
  const counts = {};
  posts.forEach((p) => (counts[p.source] = (counts[p.source] || 0) + 1));
  const chips = $('#source-chips');
  chips.innerHTML = '';
  for (const src of ['posts', 'archived', 'reels', 'igtv']) {
    if (!counts[src]) continue;
    const b = document.createElement('button');
    b.className = 'chip' + (state.filters.sources.has(src) ? ' on' : '');
    b.innerHTML = `${t('src.' + src)}<span>${counts[src]}</span>`;
    b.onclick = () => {
      state.filters.sources.has(src) ? state.filters.sources.delete(src) : state.filters.sources.add(src);
      renderSelect();
    };
    chips.append(b);
  }
  const years = [...new Set(posts.map((p) => new Date(p.timestamp * 1000).getFullYear()))].sort((a, b) => b - a);
  const sel = $('#year-filter');
  sel.innerHTML = `<option value="">${t('select.allYears')}</option>` + years.map((y) => `<option>${y}</option>`).join('');
  sel.value = state.filters.year;
}

function renderSelect() {
  renderFilters();
  const posts = visiblePosts();
  $('#visible-count').textContent = t('select.visible', { n: posts.length });
  const grid = $('#grid');
  grid.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (const p of posts) frag.append(postCard(p));
  grid.append(frag);
  renderSummary();
}

function postCard(p) {
  const done = state.exp.imported[p.key];
  const el = document.createElement('div');
  el.className = 'post';
  el.dataset.key = p.key;
  el.classList.toggle('sel', state.selected.has(p.key));
  el.classList.toggle('done', !!done);
  el.classList.toggle('missing', !selectable(p));

  const firstImage = p.media.find((m) => !m.video);
  const thumb = document.createElement('div');
  thumb.className = 'thumb';
  if (firstImage) {
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = thumbUrl(firstImage.uri);
    thumb.append(img);
  } else {
    thumb.innerHTML = '<span class="vid">▶</span>';
  }
  el.append(thumb);

  const badges = document.createElement('div');
  badges.className = 'badges';
  const badge = (text, cls = '') => {
    const b = document.createElement('span');
    b.className = 'badge ' + cls;
    b.textContent = text;
    badges.append(b);
  };
  if (done) badge(done.partial ? '⚠ ' + t('select.partial') : '✓ ' + t('select.imported'), done.partial ? 'warn' : 'ok');
  if (!selectable(p)) badge('⚠ ' + t('select.missing'), 'warn');
  if (p.media.length > 1) badge(`⧉ ${p.media.length}`);
  if (p.media.some((m) => m.video)) badge('▶');
  el.append(badges);

  if (!done && selectable(p)) {
    const tick = document.createElement('button');
    tick.className = 'tick';
    tick.textContent = '✓';
    tick.onclick = (e) => {
      e.stopPropagation();
      toggle(p.key);
    };
    el.append(tick);
  }
  if (done) {
    const forget = document.createElement('button');
    forget.className = 'secondary small forget';
    forget.textContent = t('select.forget');
    forget.onclick = async (e) => {
      e.stopPropagation();
      if (!forget.dataset.sure) {
        forget.dataset.sure = '1';
        forget.textContent = t('select.forgetSure');
        return;
      }
      state.exp.imported = await invoke('forget_imported', { keys: [p.key] });
      state.selected.add(p.key);
      el.replaceWith(postCard(p));
      renderSummary();
    };
    el.append(forget);
  }
  if (!selectable(p)) el.title = t('select.missingHint');

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.innerHTML = `<div class="date"></div><div class="cap"></div>`;
  meta.querySelector('.date').textContent = fmtDate(p.timestamp);
  const cap = meta.querySelector('.cap');
  cap.textContent = p.caption || t('select.noCaption');
  cap.classList.toggle('empty', !p.caption);
  el.append(meta);

  el.onclick = () => showPreview(p);
  return el;
}

function toggle(key, on) {
  const want = on ?? !state.selected.has(key);
  want ? state.selected.add(key) : state.selected.delete(key);
  const el = $(`.post[data-key="${CSS.escape(key)}"]`);
  if (el) el.classList.toggle('sel', want);
  renderSummary();
}

function pickable() {
  return visiblePosts().filter((p) => selectable(p) && !state.exp.imported[p.key]);
}

$('#sel-all').onclick = () => pickable().forEach((p) => toggle(p.key, true));
$('#sel-none').onclick = () => visiblePosts().forEach((p) => toggle(p.key, false));
$('#sel-invert').onclick = () => pickable().forEach((p) => toggle(p.key));
$('#year-filter').onchange = (e) => {
  state.filters.year = e.target.value;
  renderSelect();
};
$('#search').oninput = (e) => {
  state.filters.q = e.target.value;
  clearTimeout(renderSelect.timer);
  renderSelect.timer = setTimeout(renderSelect, 200);
};
$('#hide-imported').onchange = (e) => {
  state.filters.hideImported = e.target.checked;
  renderSelect();
};

function selectedPosts() {
  return state.exp.posts.filter((p) => state.selected.has(p.key) && !state.exp.imported[p.key] && selectable(p));
}

// Mirrors importer::caption in Rust, for the preview.
function buildCaption(text, ts, limit, part) {
  const date = new Date(ts * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const d = state.lang === 'de' ? `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}` : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  let tail = part ? ` ${part}` : '';
  const footer = state.options.footerOn ? state.options.footerText : '';
  if (footer.trim()) tail += `\n\n${footer.replaceAll('{date}', d)}`;
  const room = Math.max(limit - [...tail].length, 0);
  const chars = [...text];
  const body = chars.length > room ? chars.slice(0, Math.max(room - 1, 0)).join('').trimEnd() + '…' : text;
  return (body + tail).trim();
}

function postFiles(p) {
  const types = state.session?.limits.mime_types ?? [];
  return p.media.filter((m) => !m.video || types.includes('video/mp4'));
}

function renderSummary() {
  if (!state.exp) return;
  const posts = selectedPosts();
  const lim = state.session?.limits ?? { max_media: 4, max_chars: 500, mime_types: [] };
  let files = 0, pfPosts = 0, split = 0, cut = 0, videos = 0;
  for (const p of posts) {
    const f = postFiles(p);
    files += f.length;
    const chunks = Math.max(1, Math.ceil(f.length / lim.max_media));
    pfPosts += chunks;
    if (chunks > 1) split++;
    if (f.length < p.media.length) videos++;
    if ([...buildCaption(p.caption, p.timestamp, Infinity, chunks > 1 ? `(1/${chunks})` : '')].length > lim.max_chars) cut++;
  }
  const eta = pfPosts * (Number(state.options.delay) + 1.5) + files * 2;
  let html = t('opts.summary', { n: posts.length, files, posts: pfPosts, eta: fmtDuration(eta) });
  const warn = [];
  if (split) warn.push(t('opts.split', { n: split, max: lim.max_media }));
  if (cut) warn.push(t('opts.cut', { n: cut, max: lim.max_chars }));
  if (videos) warn.push(t('opts.videos', { n: videos }));
  if (warn.length) html += '<ul>' + warn.map((w) => `<li>${w}</li>`).join('') + '</ul>';
  $('#summary').innerHTML = html;
  const btn = $('#btn-start');
  btn.textContent = posts.length ? t('opts.start', { n: posts.length }) : t('opts.startNone');
  btn.disabled = !posts.length || !!state.run?.running;
  $('#vis-hint').textContent = t('opts.vis.hint.' + state.options.visibility);
}

// ---------- preview ----------

function showPreview(p) {
  const media = $('#modal-media');
  media.innerHTML = '';
  for (const m of p.media) {
    if (m.video) {
      const ph = document.createElement('div');
      ph.className = 'ph';
      ph.textContent = '▶';
      media.append(ph);
    } else {
      const img = document.createElement('img');
      img.src = thumbUrl(m.uri);
      media.append(img);
    }
  }
  const lim = state.session?.limits ?? { max_media: 4, max_chars: 500 };
  const chunks = Math.max(1, Math.ceil(postFiles(p).length / lim.max_media));
  $('#modal-meta').textContent =
    `${fmtDate(p.timestamp)} · ${t('src.' + p.source)} · ${p.media.length} 🖼` + (chunks > 1 ? ` · ${t('preview.parts', { n: chunks })}` : '');
  $('#modal-caption').textContent = buildCaption(p.caption, p.timestamp, lim.max_chars, chunks > 1 ? `(1/${chunks})` : '');
  $('#modal').hidden = false;
}

$('#modal-close').onclick = () => ($('#modal').hidden = true);
$('#modal').onclick = (e) => e.target.id === 'modal' && ($('#modal').hidden = true);
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  $('#modal').hidden = true;
  closeGuide();
});

// ---------- options ----------

function loadOptions(saved) {
  Object.assign(state.options, saved || {});
  if (!state.options.footerText) state.options.footerText = t('opts.footerDefault');
  $('#opt-visibility').value = state.options.visibility;
  $('#opt-footer').checked = state.options.footerOn;
  $('#opt-footer-text').value = state.options.footerText;
  $('#opt-footer-text').disabled = !state.options.footerOn;
  $('#opt-sensitive').checked = state.options.sensitive;
  $('#opt-delay').value = String(state.options.delay);
}

function saveOptions() {
  const o = state.options;
  o.visibility = $('#opt-visibility').value;
  o.footerOn = $('#opt-footer').checked;
  o.footerText = $('#opt-footer-text').value;
  o.sensitive = $('#opt-sensitive').checked;
  o.delay = Number($('#opt-delay').value);
  $('#opt-footer-text').disabled = !o.footerOn;
  renderSummary();
  invoke('save_prefs', { options: o }).catch(() => {});
}

['#opt-visibility', '#opt-footer', '#opt-sensitive', '#opt-delay'].forEach((s) => ($(s).onchange = saveOptions));
$('#opt-footer-text').oninput = saveOptions;

// ---------- import ----------

const postByKey = (key) => state.exp?.posts.find((p) => p.key === key);

async function startImport(keys) {
  if (!keys.length) return;
  const o = state.options;
  try {
    await invoke('start_import', {
      keys,
      options: { visibility: o.visibility, sensitive: o.sensitive, footer: o.footerOn ? o.footerText : '', lang: state.lang, delay: o.delay },
    });
  } catch (e) {
    return toast(errText(e));
  }
  state.run = { running: true, paused: false, total: keys.length, ok: 0, failed: 0, failedKeys: [], durations: [], begin: 0, current: null, step: '', finished: null };
  $('#log').innerHTML = '';
  goto('import');
  renderImport();
  renderSummary();
}

$('#btn-start').onclick = () => startImport(selectedPosts().map((p) => p.key));

function renderImport() {
  const r = state.run;
  if (!r) return;
  const processed = r.ok + r.failed;
  $('#bar').style.width = `${r.total ? (processed / r.total) * 100 : 0}%`;
  $('#st-ok').textContent = r.ok;
  $('#st-failed').textContent = r.failed;
  $('#st-left').textContent = Math.max(r.total - processed, 0);
  const avg = r.durations.length ? r.durations.reduce((a, b) => a + b, 0) / r.durations.length : Number(state.options.delay) + 4;
  $('#st-eta').textContent = r.running ? fmtDuration(avg * (r.total - processed)) : '–';
  $('#import-title').textContent = r.finished === 'done' ? t('import.done') : r.finished === 'stopped' ? t('import.stopped') : r.paused ? t('import.paused') : t('import.running');
  $('#btn-pause').textContent = r.paused ? t('import.resume') : t('import.pause');
  $('#btn-pause').hidden = !r.running;
  $('#btn-stop').hidden = !r.running;
  $('#done-box').hidden = r.running;
  $('#btn-retry').hidden = r.running || !r.failedKeys.length;

  const cur = $('#current');
  const p = r.current && postByKey(r.current);
  if (!r.running) {
    cur.innerHTML = r.finished === 'stopped' ? `<span class="muted">${t('import.stopHint')}</span>` : '';
  } else if (p) {
    const img = p.media.find((m) => !m.video);
    cur.innerHTML = `${img ? `<img src="${thumbUrl(img.uri)}">` : '<div class="ph">▶</div>'}<div><div class="cap"></div><div class="step"></div></div>`;
    cur.querySelector('.cap').textContent = `${fmtDate(p.timestamp)} · ${(p.caption || t('select.noCaption')).slice(0, 90)}`;
    cur.querySelector('.step').textContent = r.paused ? t('import.step.paused') : r.step;
  }
}

function logEntry(p, ok, ev) {
  const li = document.createElement('li');
  const img = p.media.find((m) => !m.video);
  li.innerHTML = `<span class="icon">${ok ? '✅' : '❌'}</span>${img ? `<img src="${thumbUrl(img.uri)}">` : '<div class="ph"></div>'}<div class="txt"><div class="cap"></div></div>`;
  li.querySelector('.cap').textContent = `${fmtDate(p.timestamp)} · ${p.caption || t('select.noCaption')}`;
  const txt = li.querySelector('.txt');
  if (ev.error) {
    const d = document.createElement('div');
    d.className = 'err';
    d.textContent = ev.error;
    txt.append(d);
  }
  const skipped = state.exp.imported[p.key]?.skipped;
  if (ok && skipped?.length) {
    const d = document.createElement('div');
    d.className = 'skip';
    d.textContent = t('import.skipped', { files: skipped.join(', ') });
    txt.append(d);
  }
  for (const url of ev.urls || []) {
    if (!url) continue;
    const b = document.createElement('button');
    b.className = 'ghost small';
    b.textContent = t('import.view') + ' ↗';
    b.onclick = () => invoke('open_url', { url });
    li.append(b);
  }
  $('#log').prepend(li);
}

listen('import-progress', async ({ payload: ev }) => {
  const r = state.run;
  if (!r) return;
  switch (ev.kind) {
    case 'begin':
      r.current = ev.key;
      r.begin = performance.now();
      r.step = '';
      break;
    case 'step': {
      const m = ev.step.match(/^upload (\d+)\/(\d+)$/);
      r.step = m ? t('import.step.upload', { a: m[1], b: m[2] }) : t('import.step.post');
      break;
    }
    case 'waiting':
      r.step = t('import.step.wait', { err: ev.error, s: ev.wait });
      break;
    case 'post':
    case 'failed': {
      const ok = ev.kind === 'post';
      r.ok = ev.ok;
      r.failed = ev.failed;
      if (r.begin) r.durations.push((performance.now() - r.begin) / 1000);
      r.durations = r.durations.slice(-10);
      if (!ok) r.failedKeys.push(ev.key);
      r.step = t('import.step.next');
      state.exp.imported = await invoke('imported');
      const p = postByKey(ev.key);
      if (p) logEntry(p, ok, ev);
      break;
    }
    case 'fatal':
      toast(t('err.fatal'), 10000);
      break;
    case 'done':
    case 'stopped':
      r.running = false;
      r.finished = ev.kind;
      r.ok = ev.ok;
      r.failed = ev.failed;
      r.current = null;
      state.exp.imported = await invoke('imported');
      state.selected = new Set([...state.selected].filter((k) => !state.exp.imported[k]));
      renderSelect();
      break;
  }
  renderImport();
});

$('#btn-pause').onclick = async () => {
  const r = state.run;
  r.paused = !r.paused;
  await invoke('pause_import', { paused: r.paused });
  renderImport();
};
$('#btn-stop').onclick = () => invoke('stop_import');
$('#btn-retry').onclick = () => startImport(state.run.failedKeys.filter((k) => !state.exp.imported[k]));
$('#btn-profile').onclick = () => state.session && invoke('open_url', { url: state.session.account.url });

async function refreshImported() {
  state.exp.imported = await invoke('imported');
  renderSelect();
}

// ---------- boot ----------

$$('#steps button').forEach((b) => (b.onclick = () => goto(b.dataset.step)));
$$('.lang button').forEach((b) => (b.onclick = () => setLang(b.dataset.lang)));
$('#btn-guide').onclick = () => openGuide();
$('#btn-guide-close').onclick = closeGuide;
$('#drawer-backdrop').onclick = closeGuide;

(async function boot() {
  const b = await invoke('boot');
  state.lang = b.lang || ((navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en');
  loadOptions(b.options && typeof b.options === 'object' ? b.options : null);
  state.session = b.session;
  state.lastExports = b.last_exports || [];
  if (b.session) $('#instance').value = new URL(b.session.instance).host;
  applyI18n();
  renderRecent();
  if (b.session_error) loginError(b.session_error);
  goto(b.session ? 'export' : 'login');
})();
