// 部屋の立体図(プラグイン版 RoomScene の移植)。
// L / W / H ラベルのドラッグで寸法、「音源」「聴く位置」の点のドラッグで位置を変える。マウスとタッチの両方に対応
import { MATERIALS, DECK, CEILING, FRONT, BACK, LEFT, RIGHT, EAR_HEIGHT } from './room-model.js';

const INK = '#e9f2f0', AQUA = '#6bdbc8', GOLD = '#f4d18c', DEEP = '#142e36';

function mixColor(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (p, s) => (p >> s) & 255;
  const m = (s) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
  return `rgb(${m(16)},${m(8)},${m(0)})`;
}
const toHex = (rgb) => '#' + rgb.match(/\d+/g).map((v) => (+v).toString(16).padStart(2, '0')).join('');

export class RoomScene {
  constructor(canvas, { getSpec, onChange, onDragEnd }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.getSpec = getSpec;
    this.onChange = onChange;
    this.onDragEnd = onDragEnd;
    this.selected = -1;
    this.wavePhase = 0;
    this.waveHeight = 2;
    this.drag = null;
    this.hover = null;

    canvas.addEventListener('pointerdown', (e) => this.pointerDown(e));
    canvas.addEventListener('pointermove', (e) => this.pointerMove(e));
    canvas.addEventListener('pointerup', (e) => this.pointerUp(e));
    canvas.addEventListener('pointercancel', (e) => this.pointerUp(e));
    canvas.addEventListener('pointerleave', () => { if (!this.drag && this.hover) { this.hover = null; this.draw(); } });
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  get compact() { return this.w < 480; }

  projection() {
    const s = this.getSpec(), l = s.length, w = s.width, h = s.height;
    const mx = Math.min(170, this.w * 0.3), my = Math.min(80, this.h * 0.25);
    const sc = Math.max(0.1, Math.min((this.w - mx) / (0.866 * (l + w)), (this.h - my) / (0.38 * (l + w) + h)));
    // 図(ラベル分の余白を含む)を上下中央に置く
    const drawingH = (0.38 * (l + w) + h) * sc;
    const origin = { x: this.w / 2 - (l - w) * 0.866 * sc / 2, y: Math.max(my * 0.38, (this.h - drawingH - my * 0.5) / 2) + h * sc };
    const point = (x, y, z = 0) => ({ x: origin.x + (x - y) * 0.866 * sc, y: origin.y + (x + y) * 0.38 * sc - z * sc });
    const unproject = (p, z) => {
      const u = (p.x - origin.x) / (0.866 * sc), v = (p.y - origin.y + z * sc) / (0.38 * sc);
      return { x: 0.5 * (u + v), y: 0.5 * (v - u) };
    };
    return { l, w, h, s: sc, point, unproject };
  }

  handlePos(pr, id) {
    const k = this.compact ? 0.78 : 1;
    // ラベルが画面からはみ出さないように端で止める
    const fit = (q) => ({ x: Math.min(this.w - 42 * k, Math.max(42 * k, q.x)), y: Math.min(this.h - 14, Math.max(14, q.y)) });
    if (id === 'L') { const p = pr.point(pr.l * 0.56, pr.w); return fit({ x: p.x + 15 * k, y: p.y + 26 * k }); }
    const wp = pr.point(0, pr.w * 0.58), W = { x: wp.x - 50 * k, y: wp.y + 26 * k };
    if (id === 'W') return fit(W);
    const p = pr.point(0, pr.w, pr.h * 0.68);
    return fit({ x: p.x - 40 * k, y: Math.min(p.y - 9, W.y - 40 * k) });
  }

  // 掴む点は床の上。耳の高さは描画でだけ示す
  dotPos(pr, which, z = 0) {
    const s = this.getSpec();
    return which === 'source' ? pr.point(s.sourceX * pr.l, s.sourceY * pr.w, z) : pr.point(s.listenerX * pr.l, s.listenerY * pr.w, z);
  }

  surfaceColor(i) {
    const sf = this.getSpec().surfaces[i];
    return mixColor(MATERIALS[sf.a].color, MATERIALS[sf.b].color, sf.mix);
  }

  // 原点 p0 と辺 u, v で張られる面を、その面の素材の色と模様で塗る
  drawSurface(pr, p0, u, v, surface, shade) {
    const g = this.ctx, sf = this.getSpec().surfaces[surface], mat = MATERIALS[sf.a];
    const at = (a, b) => pr.point(p0[0] + u[0] * a + v[0] * b, p0[1] + u[1] * a + v[1] * b, p0[2] + u[2] * a + v[2] * b);
    const quad = [at(0, 0), at(1, 0), at(1, 1), at(0, 1)];
    g.beginPath();
    quad.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.closePath();
    g.fillStyle = mixColor(toHex(this.surfaceColor(surface)), DEEP, shade);
    g.fill();
    if (mat.pattern === 'none') return;

    const lu = Math.hypot(...u), lv = Math.hypot(...v);
    let spacing = mat.spacing;
    while (spacing * pr.s < 6) spacing *= 2;
    g.save();
    g.clip();
    g.strokeStyle = 'rgba(20,46,54,0.28)';
    g.fillStyle = 'rgba(20,46,54,0.45)';
    g.lineWidth = 0.7;
    if (mat.pattern === 'dots') {
      for (let a = spacing / 2; a < lu; a += spacing) for (let b = spacing / 2; b < lv; b += spacing) {
        const p = at(a / lu, b / lv);
        g.fillRect(p.x - 1, p.y - 1, 2, 2);
      }
    } else {
      g.beginPath();
      if (mat.pattern === 'grid' || mat.pattern === 'vertical') for (let a = spacing; a < lu; a += spacing) {
        const p = at(a / lu, 0), q = at(a / lu, 1); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y);
      }
      if (mat.pattern === 'grid' || mat.pattern === 'horizontal') for (let b = spacing; b < lv; b += spacing) {
        const p = at(0, b / lv), q = at(1, b / lv); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y);
      }
      g.stroke();
    }
    g.restore();
  }

  draw() {
    const g = this.ctx;
    if (!this.w) return;
    g.clearRect(0, 0, this.w, this.h);
    const s = this.getSpec(), pr = this.projection(), { l: L, w: W, h: H } = pr;
    const deck = Math.max(0, Math.min(Math.min(L, W) / 2 - 0.5, s.deckWidth));
    const P = pr.point;
    const a = P(0, 0), b = P(L, 0), c = P(L, W), d = P(0, W);
    const at0 = P(0, 0, H), bt = P(L, 0, H), ct = P(L, W, H), dt = P(0, W, H);

    this.drawSurface(pr, [0, 0, 0], [0, W, 0], [0, 0, H], LEFT, 0.25);
    this.drawSurface(pr, [0, 0, 0], [L, 0, 0], [0, 0, H], FRONT, 0.12);
    this.drawSurface(pr, [0, 0, 0], [L, 0, 0], [0, W, 0], DECK, 0.2);

    // 水面
    const w0 = P(deck, deck), w1 = P(L - deck, deck), w2 = P(L - deck, W - deck), w3 = P(deck, W - deck);
    g.save();
    g.beginPath(); g.moveTo(w0.x, w0.y); g.lineTo(w1.x, w1.y); g.lineTo(w2.x, w2.y); g.lineTo(w3.x, w3.y); g.closePath();
    g.clip();
    const grad = g.createLinearGradient(Math.min(w0.x, w3.x), w0.y, Math.max(w1.x, w2.x), w2.y);
    grad.addColorStop(0, '#2f9fa3'); grad.addColorStop(1, '#0b6b85');
    g.fillStyle = grad;
    g.fill();
    const waves = Math.min(1, this.waveHeight / 10), wl = L - 2 * deck, ww = W - 2 * deck;
    for (let row = 1; row < 13; row++) {
      g.beginPath();
      for (let i = 0; i <= 55; i++) {
        const x = deck + wl * i / 55;
        const y = deck + ww * (row / 13 + (0.006 + 0.012 * waves) * Math.sin(i * 0.38 + row + this.wavePhase));
        const p = P(x, y, 0.025);
        i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y);
      }
      g.strokeStyle = `rgba(189,245,229,${row % 3 === 0 ? 0.38 : 0.17})`;
      g.lineWidth = row % 3 === 0 ? 1.5 : 0.7;
      g.stroke();
    }
    g.restore();

    // 輪郭
    const line = (p, q, color, width, dashed) => {
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y);
      g.strokeStyle = color; g.lineWidth = width; g.setLineDash(dashed ? [4, 5] : []); g.stroke(); g.setLineDash([]);
    };
    for (const [p, q] of [[at0, bt], [at0, dt], [at0, a], [bt, b], [dt, d], [b, c], [c, d]]) line(p, q, 'rgba(195,232,224,0.65)', 1.2);
    line(bt, ct, 'rgba(195,232,224,0.25)', 1, true);
    line(dt, ct, 'rgba(195,232,224,0.25)', 1, true);
    line(ct, c, 'rgba(195,232,224,0.22)', 1, true);

    // 選択中の面
    const poly = (pts) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); };
    const outline = (pts, cutaway) => {
      poly(pts);
      if (cutaway) {
        g.fillStyle = 'rgba(107,219,200,0.10)'; g.fill();
        g.setLineDash([5, 4]); g.strokeStyle = 'rgba(107,219,200,0.9)'; g.lineWidth = 1.6; g.stroke(); g.setLineDash([]);
      } else {
        g.strokeStyle = AQUA; g.lineWidth = 2.2; g.stroke();
      }
    };
    ({
      [DECK]: () => outline([a, b, c, d], false),
      [CEILING]: () => outline([at0, bt, ct, dt], true),
      [FRONT]: () => outline([at0, bt, b, a], false),
      [LEFT]: () => outline([at0, dt, d, a], false),
      [BACK]: () => outline([dt, ct, c, d], true),
      [RIGHT]: () => outline([bt, ct, c, b], true),
    })[this.selected]?.();

    // 音源・聴く位置と水面での1次反射(音声処理と同じ幾何)
    const sx = s.sourceX * L, sy = s.sourceY * W, lx = s.listenerX * L, ly = s.listenerY * W;
    const ear = Math.min(EAR_HEIGHT, H - 0.1);
    const srcFloor = this.dotPos(pr, 'source'), lstFloor = this.dotPos(pr, 'listener');
    const src = this.dotPos(pr, 'source', ear), lst = this.dotPos(pr, 'listener', ear);
    line(srcFloor, src, 'rgba(244,209,140,0.55)', 1.2);
    line(lstFloor, lst, 'rgba(107,219,200,0.55)', 1.2);
    for (const [p, c] of [[src, GOLD], [lst, AQUA]]) {
      g.fillStyle = c;
      g.beginPath(); g.arc(p.x, p.y, 2.5, 0, Math.PI * 2); g.fill();
    }
    line(src, lst, 'rgba(255,255,255,0.18)', 1, true);
    const rx = (sx + lx) / 2, ry = (sy + ly) / 2;
    if (rx >= deck && rx <= L - deck && ry >= deck && ry <= W - deck) {
      const r = P(rx, ry);
      line(src, r, 'rgba(244,209,140,0.85)', 1.1, true);
      line(r, lst, 'rgba(244,209,140,0.85)', 1.1, true);
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.beginPath(); g.arc(r.x, r.y, 2, 0, Math.PI * 2); g.fill();
    }
    const dot = (p, color, label, hot) => {
      g.fillStyle = 'rgba(13,32,40,0.8)';
      g.beginPath(); g.arc(p.x, p.y, 8, 0, Math.PI * 2); g.fill();
      if (hot) { g.strokeStyle = color; g.globalAlpha = 0.6; g.lineWidth = 1.5; g.beginPath(); g.arc(p.x, p.y, 10, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1; }
      g.fillStyle = color;
      g.beginPath(); g.arc(p.x, p.y, 3.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = INK; g.font = '600 10px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'top';
      g.fillText(label, p.x, p.y + 10);
    };
    dot(srcFloor, GOLD, '音源', this.drag === 'source' || this.hover === 'source');
    dot(lstFloor, AQUA, '聴く位置', this.drag === 'listener' || this.hover === 'listener');

    // 寸法ラベル
    const k = this.compact ? 0.78 : 1;
    for (const [id, v] of [['L', L], ['W', W], ['H', H]]) {
      const p = this.handlePos(pr, id), bw = 80 * k, bh = 26 * k;
      const hot = this.drag === id || this.hover === id;
      g.beginPath(); g.roundRect(p.x - bw / 2, p.y - bh / 2, bw, bh, bh / 2);
      g.fillStyle = hot ? '#285751' : '#172f36'; g.fill();
      g.strokeStyle = hot ? INK : '#4c8d86'; g.lineWidth = 1; g.stroke();
      g.fillStyle = AQUA; g.font = `600 ${Math.round(12 * k)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(`${id}  ${v.toFixed(1)} m`, p.x, p.y + 0.5);
    }
  }

  targetAt(p, touch) {
    const pr = this.projection(), r = touch ? 22 : 11;
    for (const which of ['source', 'listener']) {
      const q = this.dotPos(pr, which);
      if (Math.hypot(p.x - q.x, p.y - q.y) < r) return which;
    }
    const k = this.compact ? 0.78 : 1;
    for (const id of ['L', 'W', 'H']) {
      const q = this.handlePos(pr, id), pad = touch ? 8 : 2;
      if (Math.abs(p.x - q.x) < 40 * k + pad && Math.abs(p.y - q.y) < 13 * k + pad) return id;
    }
    return null;
  }

  local(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  pointerDown(e) {
    const p = this.local(e), t = this.targetAt(p, e.pointerType !== 'mouse');
    if (!t) return;
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    const s = this.getSpec();
    this.drag = t;
    this.dragOrigin = p;
    this.dragStart = { L: s.length, W: s.width, H: s.height }[t];
    this.draw();
  }

  pointerMove(e) {
    const p = this.local(e);
    if (!this.drag) {
      if (e.pointerType === 'mouse') {
        const t = this.targetAt(p, false);
        if (t !== this.hover) {
          this.hover = t;
          this.canvas.style.cursor = t === 'H' ? 'ns-resize' : t ? 'grab' : 'default';
          this.draw();
        }
      }
      return;
    }
    e.preventDefault();
    const pr = this.projection();
    if (this.drag === 'L' || this.drag === 'W' || this.drag === 'H') {
      const dx = p.x - this.dragOrigin.x, dy = p.y - this.dragOrigin.y;
      const delta = this.drag === 'H' ? -dy / pr.s
        : ((this.drag === 'L' ? 0.866 : -0.866) * dx + 0.38 * dy) / ((0.866 * 0.866 + 0.38 * 0.38) * pr.s);
      const key = { L: 'length', W: 'width', H: 'height' }[this.drag];
      const lim = { length: [5, 100], width: [4, 60], height: [2.5, 30] }[key];
      this.onChange({ [key]: Math.min(lim[1], Math.max(lim[0], Math.round((this.dragStart + delta) * 2) / 2)) });
    } else {
      const q = pr.unproject(p, 0);
      const clamp01 = (v) => Math.min(1, Math.max(0, Math.round(v * 100) / 100));
      const isSource = this.drag === 'source';
      this.onChange({ [isSource ? 'sourceX' : 'listenerX']: clamp01(q.x / pr.l), [isSource ? 'sourceY' : 'listenerY']: clamp01(q.y / pr.w) });
    }
  }

  pointerUp(e) {
    if (!this.drag) return;
    this.canvas.releasePointerCapture?.(e.pointerId);
    this.drag = null;
    this.draw();
    this.onDragEnd?.();
  }
}
