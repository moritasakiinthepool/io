import { MATERIALS, SURFACES, PRESETS, BANDS, DECK } from './room-model.js';
import { PARAMS, REALTIME_DEFAULTS } from './params.js';
import { RoomScene } from './scene.js';
import { Engine } from './engine.js';

const $ = (id) => document.getElementById(id);
const clone = (o) => JSON.parse(JSON.stringify(o));
const STORAGE_KEY = 'pool-designer-v1';
const isTouch = window.matchMedia('(pointer: coarse)').matches;

// ---------------------------------------------------------------- 状態
const state = {
  preset: 0,
  spec: clone(PRESETS[0].spec),
  rt: { ...REALTIME_DEFAULTS },
  detail: false,
  surface: DECK,
  bypass: false,
};
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (saved && saved.spec && saved.spec.surfaces?.length === 6) Object.assign(state, saved, { bypass: false });
} catch { /* 保存が使えない環境では毎回初期値 */ }
let saveTimer;
const save = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ preset: state.preset, spec: state.spec, rt: state.rt, detail: state.detail, surface: state.surface })); } catch { /* 無視 */ }
  }, 300);
};

const valueOf = (id) => (id in state.rt ? state.rt[id] : state.spec[id]);

// ---------------------------------------------------------------- 音声
const audio = $('audio');
const engine = new Engine(audio);
if (navigator.audioSession) {
  try { navigator.audioSession.type = 'playback'; } catch { /* iOS のマナーモードでも鳴らすため(対応ブラウザのみ) */ }
}

// ---------------------------------------------------------------- 響きの計算(Worker)
let worker = null;
try {
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
} catch { worker = null; }
let busy = false, pending = false, renderTimer = null, stats = null;
const renderOpts = isTouch ? { rays: 2000 } : {};

function scheduleRender(delay = 150) {
  document.body.classList.add('updating');
  $('status').textContent = '計算中…';
  clearTimeout(renderTimer);
  renderTimer = setTimeout(requestRender, delay);
}

async function requestRender() {
  if (busy) { pending = true; return; }
  busy = true;
  const msg = { spec: clone(state.spec), sampleRate: engine.sampleRate, opts: renderOpts };
  if (worker) {
    worker.postMessage(msg);
  } else {
    // module Worker が使えない古いブラウザでは画面側で計算する
    const { renderRoom } = await import('./room-model.js');
    onRendered(renderRoom(msg.spec, msg.sampleRate, msg.opts));
  }
}

function onRendered(result) {
  busy = false;
  engine.setImpulseResponse(result.ir, result.water);
  stats = result.stats;
  if (pending) { pending = false; requestRender(); return; }
  document.body.classList.remove('updating');
  updateStats();
}
if (worker) {
  worker.onmessage = (e) => onRendered(e.data);
  worker.onerror = () => { worker = null; busy = false; requestRender(); };
}

// ---------------------------------------------------------------- 立体図
const scene = new RoomScene($('scene'), {
  getSpec: () => state.spec,
  onChange: (values) => {
    Object.assign(state.spec, values);
    scene.draw();
    syncSliders();
    updateDims();
    scheduleRender(250);
    save();
  },
});
// タッチでつまみを掴んだときだけページのスクロールを止める
$('scene').addEventListener('touchstart', (e) => {
  const r = e.currentTarget.getBoundingClientRect(), t = e.touches[0];
  if (scene.targetAt({ x: t.clientX - r.left, y: t.clientY - r.top }, true)) e.preventDefault();
}, { passive: false });

let lastFrame = 0;
function animate(t) {
  requestAnimationFrame(animate);
  if (state.rt.waveHeight <= 0 || document.hidden || t - lastFrame < 66) return;
  lastFrame = t;
  scene.wavePhase += 0.05 + 0.25 * state.rt.waveSpeed;
  scene.draw();
}
requestAnimationFrame(animate);

// ---------------------------------------------------------------- ヘッダー
PRESETS.forEach((p, i) => $('preset').add(new Option(p.name, i)));
$('preset').addEventListener('change', (e) => {
  state.preset = +e.target.value;
  state.spec = clone(PRESETS[state.preset].spec);
  refreshAll();
  scheduleRender(0);
  save();
});

$('detailToggle').addEventListener('click', () => {
  state.detail = !state.detail;
  applyMode();
  save();
});

function applyMode() {
  document.body.classList.toggle('detail', state.detail);
  $('detailToggle').setAttribute('aria-pressed', String(state.detail));
  $('detailToggle').textContent = state.detail ? '詳細を閉じる' : '詳細設定';
  $('materialLabel').textContent = state.detail ? '素材 / MATERIAL' : '素材 / MATERIAL ― すべての面';
  scene.selected = state.detail ? state.surface : -1;
  buildSliders();
  refreshMaterials();
  scene.resize();
}

// ---------------------------------------------------------------- 面と素材
SURFACES.forEach((sf, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'tab';
  b.textContent = sf.ja;
  b.addEventListener('click', () => { state.surface = i; scene.selected = i; refreshMaterials(); scene.draw(); save(); });
  $('surfaceTabs').append(b);
});

MATERIALS.forEach((m, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip';
  b.title = m.en;
  const sw = document.createElement('i');
  sw.style.background = swatch(m);
  const label = document.createElement('span');
  label.textContent = m.ja;
  b.append(sw, label);
  b.addEventListener('click', () => {
    if (state.detail) {
      state.spec.surfaces[state.surface].a = i;
    } else {
      state.spec.surfaces = SURFACES.map(() => ({ a: i, b: i, mix: 0 }));
    }
    refreshMaterials();
    scene.draw();
    scheduleRender();
    save();
  });
  $('materials').append(b);
  $('materialB').add(new Option(m.ja, i));
});

function swatch(m) {
  const line = 'rgba(20,46,54,0.35)';
  if (m.pattern === 'vertical' || m.pattern === 'grid') {
    const h = m.pattern === 'grid' ? `, linear-gradient(to bottom, transparent 45%, ${line} 45% 55%, transparent 55%)` : '';
    return `repeating-linear-gradient(to right, ${m.color} 0 7px, ${line} 7px 8px)${h}`;
  }
  if (m.pattern === 'horizontal') return `linear-gradient(to bottom, ${m.color} 45%, ${line} 45% 55%, ${m.color} 55%)`;
  if (m.pattern === 'dots') return `radial-gradient(circle, ${line} 1px, transparent 1.5px) 0 0 / 6px 6px, ${m.color}`;
  return m.color;
}

$('materialB').addEventListener('change', (e) => {
  state.spec.surfaces[state.surface].b = +e.target.value;
  scene.draw(); scheduleRender(); save();
});
$('mixB').addEventListener('input', (e) => {
  state.spec.surfaces[state.surface].mix = +e.target.value;
  setPct(e.target);
  $('mixBValue').textContent = `${Math.round(e.target.value * 100)} %`;
  scene.draw(); scheduleRender(); save();
});

function uniformMaterial() {
  const s = state.spec.surfaces, a = s[0].a;
  return s.every((x) => x.a === a && x.mix === 0) ? a : -1;
}

function refreshMaterials() {
  const current = state.detail ? state.spec.surfaces[state.surface].a : uniformMaterial();
  [...$('materials').children].forEach((c, i) => c.classList.toggle('on', i === current));
  [...$('surfaceTabs').children].forEach((c, i) => c.classList.toggle('on', i === state.surface));
  $('customNote').hidden = state.detail || current >= 0;
  const sf = state.spec.surfaces[state.surface];
  $('materialB').value = sf.b;
  $('mixB').value = sf.mix;
  setPct($('mixB'));
  $('mixBValue').textContent = `${Math.round(sf.mix * 100)} %`;
}

// ---------------------------------------------------------------- スライダー
const toSlider = (p, v) => (p.log ? Math.log(v / p.min) / Math.log(p.max / p.min) * 1000 : v);
const fromSlider = (p, x) => (p.log ? p.min * Math.pow(p.max / p.min, x / 1000) : x);
function setPct(input) {
  const min = +input.min, max = +input.max;
  input.style.setProperty('--pct', `${((input.value - min) / (max - min)) * 100}%`);
}

let rows = [];
function buildSliders() {
  const box = $('sliders');
  box.textContent = '';
  rows = PARAMS.filter((p) => (state.detail ? p.detail : p.basic)).map((p) => {
    const row = document.createElement('label');
    row.className = 'row';
    const head = document.createElement('div');
    head.className = 'row-head';
    const title = document.createElement('span');
    title.className = 'label';
    title.textContent = state.detail ? p.detail : p.basic;
    const value = document.createElement('span');
    value.className = 'value';
    head.append(title, value);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = p.log ? 0 : p.min;
    input.max = p.log ? 1000 : p.max;
    input.step = p.log ? 1 : p.step;
    input.setAttribute('aria-label', title.textContent);
    input.addEventListener('input', () => {
      let v = fromSlider(p, +input.value);
      if (p.log) v = Math.round(v / p.step) * p.step;
      if (p.id in state.rt) {
        state.rt[p.id] = v;
        engine.setRealtime({ [p.id]: v });
        if (p.id === 'waveHeight') { scene.waveHeight = v; scene.draw(); }
      } else {
        state.spec[p.id] = v;
        if (p.id === 'temperature') engine.setRealtime({ temperature: v });
        if (['length', 'width', 'height', 'deckWidth'].includes(p.id)) { scene.draw(); updateDims(); }
      }
      value.textContent = p.fmt(v);
      setPct(input);
      if (p.room) scheduleRender();
      save();
    });
    // ダブルクリックで初期値に戻す
    input.addEventListener('dblclick', () => {
      const def = p.id in REALTIME_DEFAULTS ? REALTIME_DEFAULTS[p.id] : PRESETS[state.preset].spec[p.id];
      input.value = toSlider(p, def);
      input.dispatchEvent(new Event('input'));
    });
    row.append(head, input);
    box.append(row);
    return { p, input, value };
  });
  syncSliders();
}

function syncSliders() {
  for (const { p, input, value } of rows) {
    const v = valueOf(p.id);
    input.value = toSlider(p, v);
    value.textContent = p.fmt(v);
    setPct(input);
  }
}

function updateDims() {
  const s = state.spec;
  $('dims').textContent = `${s.length.toFixed(1)} x ${s.width.toFixed(1)} x ${s.height.toFixed(1)} m · ${Math.round(s.length * s.width * s.height)} m³`;
}

// ---------------------------------------------------------------- 計算結果
const chart = $('chart');
const bandEls = BANDS.map((f) => {
  const band = document.createElement('div');
  band.className = 'band';
  band.innerHTML = `<div class="bar"><div class="fill"></div><div class="ey"></div><span class="v"></span></div><small>${f >= 1000 ? f / 1000 + 'k' : f}</small>`;
  chart.append(band);
  return { fill: band.querySelector('.fill'), ey: band.querySelector('.ey'), v: band.querySelector('.v') };
});

function updateStats() {
  if (!stats) return;
  const maxRt = Math.ceil(Math.max(2, ...stats.rtMeasured, ...stats.rtEyring));
  bandEls.forEach((el, b) => {
    const sim = stats.rtMeasured[b], ey = stats.rtEyring[b];
    el.fill.style.height = `${(sim / maxRt) * 100}%`;
    el.ey.style.bottom = `${(ey / maxRt) * 100}%`;
    el.v.style.bottom = `${(sim / maxRt) * 100}%`;
    el.v.textContent = sim.toFixed(1);
  });
  const mid = 0.5 * (stats.rtMeasured[2] + stats.rtMeasured[3]);
  $('rtMid').textContent = `${mid.toFixed(2)} s`;
  $('critical').textContent = `${stats.criticalDistance.toFixed(1)} m`;
  $('distance').textContent = `${stats.directDistance.toFixed(1)} m`;
  $('status').textContent = `反映済み ${Math.round(stats.renderMs)} ms`;
}

// ---------------------------------------------------------------- プレイヤー
const fmtTime = (t) => (Number.isFinite(t) ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` : '0:00');
const setPlayIcon = (playing) => {
  $('playIcon').setAttribute('d', playing ? 'M6 5h4v14H6zM14 5h4v14h-4z' : 'M8 5v14l11-7z');
  $('play').setAttribute('aria-label', playing ? '一時停止' : '再生');
};
$('play').addEventListener('click', async () => {
  await engine.resume();
  if (audio.paused) await audio.play().catch(() => {}); else audio.pause();
});
audio.addEventListener('play', () => setPlayIcon(true));
audio.addEventListener('pause', () => setPlayIcon(false));
audio.addEventListener('ended', () => setPlayIcon(false));
let seeking = false;
$('seek').addEventListener('input', (e) => {
  seeking = true;
  setPct(e.target);
  $('time').textContent = fmtTime((e.target.value / 1000) * audio.duration);
});
$('seek').addEventListener('change', (e) => {
  if (Number.isFinite(audio.duration)) audio.currentTime = (e.target.value / 1000) * audio.duration;
  seeking = false;
});
audio.addEventListener('timeupdate', () => {
  if (seeking || !Number.isFinite(audio.duration)) return;
  $('seek').value = (audio.currentTime / audio.duration) * 1000;
  setPct($('seek'));
  $('time').textContent = fmtTime(audio.currentTime);
});

$('bypass').addEventListener('click', () => {
  state.bypass = !state.bypass;
  engine.setRealtime({ bypass: state.bypass });
  $('bypass').classList.toggle('on', !state.bypass);
  $('bypass').setAttribute('aria-pressed', String(!state.bypass));
  $('bypass').textContent = state.bypass ? 'FX OFF' : 'FX ON';
});

$('file').addEventListener('change', (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const wasPlaying = !audio.paused;
  if (audio.src.startsWith('blob:')) URL.revokeObjectURL(audio.src);
  audio.src = URL.createObjectURL(f);
  $('trackTitle').textContent = f.name.replace(/\.[^.]+$/, '');
  $('trackArtist').textContent = '自分の音源';
  if (wasPlaying) engine.resume().then(() => audio.play().catch(() => {}));
});

// ---------------------------------------------------------------- 起動
function refreshAll() {
  $('preset').value = state.preset;
  scene.waveHeight = state.rt.waveHeight;
  engine.setRealtime({ ...state.rt, temperature: state.spec.temperature });
  applyMode();
  updateDims();
}
refreshAll();
scheduleRender(0);
