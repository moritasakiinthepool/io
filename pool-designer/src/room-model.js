// Pool Designer の音響モデル(プラグイン版 Source/RoomModel.cpp の移植)。
// 直方体の屋内プールを、鏡像法(鏡面反射)+レイトレーシングの diffuse rain(散乱成分)で
// シミュレートしてステレオのインパルス応答を作る。Web Worker から呼ぶ。

export const BANDS = [125, 250, 500, 1000, 2000, 4000, 8000];
const NB = BANDS.length;

// 吸音率 125 Hz .. 8 kHz(一般的な文献値の概算)と画面での見た目
export const MATERIALS = [
  { ja: 'タイル', en: 'Tile', color: '#c2d5ce', pattern: 'grid', spacing: 2, alpha: [0.01, 0.01, 0.01, 0.01, 0.02, 0.02, 0.02] },
  { ja: 'ガラス', en: 'Glass', color: '#7dbbc9', pattern: 'vertical', spacing: 4, alpha: [0.18, 0.06, 0.04, 0.03, 0.02, 0.02, 0.02] },
  { ja: 'コンクリート', en: 'Concrete', color: '#939c9a', pattern: 'horizontal', spacing: 3, alpha: [0.10, 0.05, 0.06, 0.07, 0.09, 0.08, 0.08] },
  { ja: 'しっくい', en: 'Plaster', color: '#d9d2c3', pattern: 'none', spacing: 0, alpha: [0.013, 0.015, 0.02, 0.03, 0.04, 0.05, 0.05] },
  { ja: 'レンガ', en: 'Brick', color: '#b0675a', pattern: 'horizontal', spacing: 1.2, alpha: [0.03, 0.03, 0.03, 0.04, 0.05, 0.07, 0.07] },
  { ja: '木パネル', en: 'Wood Panel', color: '#b99262', pattern: 'vertical', spacing: 1.2, alpha: [0.28, 0.22, 0.17, 0.09, 0.10, 0.11, 0.11] },
  { ja: '金属屋根', en: 'Metal Roof', color: '#929fae', pattern: 'vertical', spacing: 1, alpha: [0.15, 0.10, 0.08, 0.06, 0.05, 0.05, 0.05] },
  { ja: '吸音デッキ', en: 'Perforated Deck', color: '#6f7b86', pattern: 'dots', spacing: 1, alpha: [0.40, 0.70, 0.90, 0.85, 0.70, 0.55, 0.50] },
  { ja: '吸音天井板', en: 'Acoustic Tile', color: '#e3e6e1', pattern: 'grid', spacing: 1.2, alpha: [0.30, 0.35, 0.60, 0.75, 0.70, 0.65, 0.60] },
  { ja: 'カーテン', en: 'Curtain', color: '#8e3b46', pattern: 'vertical', spacing: 0.8, alpha: [0.14, 0.35, 0.55, 0.72, 0.70, 0.65, 0.60] },
  { ja: '観客', en: 'Audience', color: '#7a6aa8', pattern: 'dots', spacing: 0.9, alpha: [0.60, 0.74, 0.88, 0.96, 0.93, 0.85, 0.80] },
];
const WATER = [0.008, 0.008, 0.013, 0.015, 0.020, 0.025, 0.025];
const WATER_SCATTERING = 0.05;

// 面(水面以外)。順番はプラグインのパラメータと同じ
export const SURFACES = [
  { key: 'deck', ja: '床(プールサイド)' },
  { key: 'ceiling', ja: '天井' },
  { key: 'front', ja: '長い壁・奥' },    // y = 0
  { key: 'back', ja: '長い壁・手前' },   // y = W
  { key: 'left', ja: '短い壁・奥' },     // x = 0
  { key: 'right', ja: '短い壁・手前' },  // x = L
];
export const DECK = 0, CEILING = 1, FRONT = 2, BACK = 3, LEFT = 4, RIGHT = 5;
const T = 0, G = 1, C = 2, P = 3, METAL = 6, PERF = 7, ACOUSTIC = 8;

const s = (a, b = a, mix = 0) => ({ a, b, mix });
const room = (name, L, W, H, deck, surfaces, pos) => ({
  name,
  spec: {
    length: L, width: W, height: H, deckWidth: deck, surfaces,
    scattering: 0.3, temperature: 30, humidity: 60,
    sourceX: pos[0], sourceY: pos[1], listenerX: pos[2], listenerY: pos[3], predelayMs: 0,
  },
});

export const PRESETS = [
  room('School 25m', 30, 18, 7, 2.5,
    [s(T), s(METAL, PERF, 0.3), s(T, G, 0.6), s(T), s(T, C, 0.5), s(T, C, 0.5)], [0.10, 0.17, 0.67, 0.67]),
  room('Hotel Pool', 15, 8, 3.5, 2.0,
    [s(T), s(P, ACOUSTIC, 0.3), s(T, G, 0.5), s(T), s(T, P, 0.4), s(T, P, 0.4)], [0.23, 0.25, 0.73, 0.75]),
  room('Olympic 50m', 64, 34, 12, 5.0,
    [s(T), s(METAL, PERF, 0.4), s(C, G, 0.7), s(C), s(C, G, 0.3), s(C, G, 0.3)], [0.125, 0.15, 0.625, 0.735]),
];

export const MAX_IR_SECONDS = 6;
export const DIRECT_OFFSET_SECONDS = 0.001;  // IR 内の直接音の位置(dry もこの分遅らせて揃える)
export const EAR_HEIGHT = 1.6;

const ILD_DB = [0.5, 1, 2, 4, 7, 10, 12];
const HEAD_RADIUS = 0.0875;
const EAR_SPACING = 0.18;
const BIN_SECONDS = 0.001;

export function speedOfSound(t) { return 331.3 * Math.sqrt(1 + t / 273.15); }

// ISO 9613-1 大気吸収 [dB/m]
export function airAbsorptionDbPerMetre(f, tC, rh) {
  const pr = 101.325, pa = 101.325;
  const Tk = tC + 273.15, T0 = 293.15, T01 = 273.16;
  const Cc = -6.8346 * Math.pow(T01 / Tk, 1.261) + 4.6151;
  const h = rh * Math.pow(10, Cc) * (pr / pa);
  const frO = (pa / pr) * (24 + 4.04e4 * h * (0.02 + h) / (0.391 + h));
  const frN = (pa / pr) * Math.pow(Tk / T0, -0.5) * (9 + 280 * h * Math.exp(-4.170 * (Math.pow(Tk / T0, -1 / 3) - 1)));
  const ff = f * f;
  return 8.686 * ff * (1.84e-11 * (pr / pa) * Math.sqrt(Tk / T0)
    + Math.pow(Tk / T0, -2.5) * (0.01275 * Math.exp(-2239.1 / Tk) / (frO + ff / frO)
      + 0.1068 * Math.exp(-3352.0 / Tk) / (frN + ff / frN)));
}

function mixMaterials(sf) {
  const a = MATERIALS[sf.a].alpha, b = MATERIALS[sf.b].alpha, m = Math.min(1, Math.max(0, sf.mix));
  return a.map((v, i) => Math.min(0.99, v * (1 - m) + b[i] * m));
}

// 32bit の決定的な乱数(同じ部屋なら同じ IR になる)
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function biquad(type, freq, sr) {
  const w = 2 * Math.PI * freq / sr, cw = Math.cos(w), al = Math.sin(w) / (2 * Math.SQRT1_2), a0 = 1 + al;
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; }
  else if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; }
  else { b0 = 1 - al; b1 = -2 * cw; b2 = 1 + al; }
  return [b0 / a0, b1 / a0, b2 / a0, -2 * cw / a0, (1 - al) / a0];
}

function runBiquad(c, x) {
  const [b0, b1, b2, a1, a2] = c;
  let z1 = 0, z2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i], y = b0 * v + z1;
    z1 = b1 * v - a1 * y + z2;
    z2 = b2 * v - a2 * y;
    x[i] = y;
  }
}

// Linkwitz-Riley 4次のクロスオーバーで帯域を合成する(全帯域の和が全域通過になる)。
// 帯域 k = HP_0..HP_{k-1} · LP_k · AP_{k+1..} を、上の帯域から T_k = LP_k(AP(b_k)) + HP_k(T_{k+1}) と
// 畳み込んでいくと、帯域ごとに全部かけるより双二次フィルターの数がほぼ半分で済む。bands[k] は書き換わる
function synthesizeBands(bands, sr) {
  const fc = [];
  for (let j = 0; j < NB - 1; j++) fc.push(Math.sqrt(BANDS[j] * BANDS[j + 1]));
  let acc = bands[NB - 1];
  for (let k = NB - 2; k >= 0; k--) {
    const x = bands[k];
    for (let j = NB - 2; j > k; j--) runBiquad(biquad('ap', fc[j], sr), x);
    const lp = biquad('lp', fc[k], sr), hp = biquad('hp', fc[k], sr);
    runBiquad(lp, x); runBiquad(lp, x);
    runBiquad(hp, acc); runBiquad(hp, acc);
    for (let i = 0; i < x.length; i++) x[i] += acc[i];
    acc = x;
  }
  return acc;
}

// 1 ms ごとの帯域エネルギーから T30(取れなければ T20)を求める
function measureRt(energy) {
  const n = energy.length, edc = new Float64Array(n + 1);
  for (let i = n - 1; i >= 0; i--) edc[i] = edc[i + 1] + energy[i];
  if (edc[0] <= 0) return 0;
  const timeAt = (db) => {
    const target = edc[0] * Math.pow(10, db / 10);
    for (let i = 0; i < n; i++) if (edc[i] < target) return i * BIN_SECONDS;
    return -1;
  };
  const t5 = timeAt(-5), t35 = timeAt(-35);
  if (t5 >= 0 && t35 > t5) return 2 * (t35 - t5);
  const t25 = timeAt(-25);
  if (t5 >= 0 && t25 > t5) return 3 * (t25 - t5);
  return 0;
}

// opts.maxImages / opts.rays で計算量を調整(スマホでは小さくする)
export function renderRoom(spec, sr, opts = {}) {
  const t0 = performance.now();
  const timings = {};
  let tLap = t0;
  const lap = (name) => { const now = performance.now(); timings[name] = Math.round(now - tLap); tLap = now; };
  const maxImages = opts.maxImages ?? 1500000;
  const numRays = opts.rays ?? 3000;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // 幾何
  const L = clamp(spec.length, 3, 200), W = clamp(spec.width, 3, 100), H = clamp(spec.height, 2.2, 40);
  const deck = clamp(spec.deckWidth, 0, Math.min(L, W) / 2 - 0.5);
  const px0 = deck, px1 = L - deck, py0 = deck, py1 = W - deck;
  const V = L * W * H, waterArea = (px1 - px0) * (py1 - py0);
  const inside = (v, size) => clamp(v, 0.1, size - 0.1);
  const src = [inside(spec.sourceX * L, L), inside(spec.sourceY * W, W), inside(EAR_HEIGHT, H)];
  const lst = [inside(spec.listenerX * L, L), inside(spec.listenerY * W, W), inside(EAR_HEIGHT, H)];
  if (Math.hypot(lst[0] - src[0], lst[1] - src[1], lst[2] - src[2]) < 0.5) lst[0] += lst[0] < L / 2 ? 0.5 : -0.5;

  const c = speedOfSound(spec.temperature);
  const d0 = Math.hypot(lst[0] - src[0], lst[1] - src[1], lst[2] - src[2]);
  const tDirect = d0 / c;

  let fx = src[0] - lst[0], fy = src[1] - lst[1];
  const fl = Math.hypot(fx, fy);
  if (fl < 1e-6) { fx = 0; fy = 1; } else { fx /= fl; fy /= fl; }
  const earX = fy, earY = -fx;  // 右耳方向

  // 面の特性(内部の面番号: 0 床, 1 天井, 2 y=0, 3 y=W, 4 x=0, 5 x=L)
  const scatter = clamp(spec.scattering, 0, 1);
  const deckAlpha = mixMaterials(spec.surfaces[DECK]);
  const alpha = [null, mixMaterials(spec.surfaces[CEILING]), mixMaterials(spec.surfaces[FRONT]),
    mixMaterials(spec.surfaces[BACK]), mixMaterials(spec.surfaces[LEFT]), mixMaterials(spec.surfaces[RIGHT])];
  const floorArea = L * W, wFrac = waterArea / floorArea;
  alpha[0] = WATER.map((w, b) => wFrac * w + (1 - wFrac) * deckAlpha[b]);
  const floorEnergyRefl = WATER.map((w, b) => wFrac * (1 - w) * (1 - WATER_SCATTERING) + (1 - wFrac) * (1 - deckAlpha[b]) * (1 - scatter));
  const faceScatter = [wFrac * WATER_SCATTERING + (1 - wFrac) * scatter, scatter, scatter, scatter, scatter, scatter];
  const faceArea = [floorArea, floorArea, L * H, L * H, W * H, W * H];
  const S = 2 * (L * W + L * H + W * H);
  const airM = BANDS.map((f) => airAbsorptionDbPerMetre(f, spec.temperature, spec.humidity) / 4.3429448);

  // 統計的な残響時間(比較・表示用)
  const stats = { rtEyring: [], rtMeasured: [], volume: V, directDistance: d0 };
  const kS = 24 * Math.log(10) / c;
  for (let b = 0; b < NB; b++) {
    let A = 0;
    for (let f = 0; f < 6; f++) A += faceArea[f] * alpha[f][b];
    stats.rtEyring.push(kS * V / (-S * Math.log(1 - A / S) + 4 * airM[b] * V));
  }
  const rtMidEy = 0.5 * (stats.rtEyring[2] + stats.rtEyring[3]);
  stats.criticalDistance = 0.057 * Math.sqrt(V / Math.max(0.05, rtMidEy));

  // バッファ
  const offset = Math.ceil(DIRECT_OFFSET_SECONDS * sr);
  const predelay = clamp(spec.predelayMs, 0, 200) * 0.001 * sr;
  const N = Math.ceil(offset + predelay + MAX_IR_SECONDS * sr) + 4;
  const band = [];
  for (let b = 0; b < NB; b++) band.push([new Float32Array(N), new Float32Array(N)]);

  const rBudget = Math.cbrt(maxImages * V * 3 / (4 * Math.PI));
  const tEnd = tDirect + MAX_IR_SECONDS;
  const tSpec = Math.min(tEnd, rBudget / c);
  const xfade = Math.min(0.02, tSpec * 0.2);
  const specularWeight = (t) => t <= tSpec - xfade ? 1 : t >= tSpec ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * (t - (tSpec - xfade)) / xfade);
  const toSample = (t, isDirect) => offset + (t - tDirect) * sr + (isDirect ? 0 : predelay);

  const LAT = 128;
  const ildR = [], ildL = [];
  for (let i = 0; i <= LAT; i++) {
    const lat = -1 + 2 * i / LAT;
    ildR.push(ILD_DB.map((db) => Math.pow(10, lat * db / 40)));
    ildL.push(ILD_DB.map((db) => Math.pow(10, -lat * db / 40)));
  }
  const itdSeconds = (lat) => { const th = Math.asin(clamp(lat, -1, 1)); return HEAD_RADIUS / c * (th + Math.sin(th)); };
  const place = (buf, pos, v) => {
    if (pos < 0) return;
    const i = Math.floor(pos);
    if (i + 1 >= N) return;
    const fr = pos - i;
    buf[i] += v * (1 - fr);
    buf[i + 1] += v * fr;
  };

  lap('setup');
  // 水面の1次反射(リアルタイムで揺らすので IR からは除く)
  const water = { active: false, delay: [0, 0], gain: [0, 0], pathPerWaveHeight: 0 };
  {
    const t = src[2] / (src[2] + lst[2]);
    const rx = src[0] + (lst[0] - src[0]) * t, ry = src[1] + (lst[1] - src[1]) * t;
    if (rx >= px0 && rx <= px1 && ry >= py0 && ry <= py1) {
      const vx = src[0] - lst[0], vy = src[1] - lst[1], vz = -src[2] - lst[2];
      const d = Math.hypot(vx, vy, vz), lat = (vx * earX + vy * earY) / d, itd = itdSeconds(lat);
      const li = Math.round((lat + 1) * 0.5 * LAT);
      const amp = Math.sqrt((1 - WATER[3]) * (1 - WATER_SCATTERING)) * Math.exp(-airM[4] * d / 2) / d;
      const base = toSample(d / c, false);
      water.active = true;
      water.delay = [(base + itd * 0.5 * sr) / sr, (base - itd * 0.5 * sr) / sr];
      water.gain = [amp * ildL[li][3], amp * ildR[li][3]];
      water.pathPerWaveHeight = 2 * (src[2] + lst[2]) / d;
    }
  }

  // 鏡像法(鏡面反射成分)
  let imageCount = 0;
  const numBins = Math.floor((tDirect + MAX_IR_SECONDS) / BIN_SECONDS) + 2;
  const imageEnergy = [];
  for (let b = 0; b < NB; b++) imageEnergy.push(new Float64Array(numBins));
  {
    const rMax = c * tSpec, pruneAmp = 1e-4 / d0;
    const axis = (sv, size, l) => {
      const out = [], n = Math.ceil(rMax / (2 * size)) + 1;
      for (let m = -n; m <= n; m++) for (let p = 0; p <= 1; p++) {
        const pos = (p ? -sv : sv) + 2 * m * size;
        if (Math.abs(pos - l) <= rMax) out.push([pos - l, Math.abs(m - p), Math.abs(m)]);
      }
      return out;
    };
    const xs = axis(src[0], L, lst[0]), ys = axis(src[1], W, lst[1]), zs = axis(src[2], H, lst[2]);
    let maxCount = 0;
    for (const a of [xs, ys, zs]) for (const e of a) maxCount = Math.max(maxCount, e[1], e[2]);

    // 面ごとの反射(振幅)の累乗表 pow[face][n*NB + b]
    const pow = [];
    for (let f = 0; f < 6; f++) {
      const r = BANDS.map((_, b) => f === 0 ? Math.sqrt(floorEnergyRefl[b]) : Math.sqrt((1 - alpha[f][b]) * (1 - faceScatter[f])));
      const tbl = new Float64Array((maxCount + 1) * NB);
      for (let b = 0; b < NB; b++) {
        let acc = 1;
        for (let n = 0; n <= maxCount; n++) { tbl[n * NB + b] = acc; acc *= r[b]; }
      }
      pow.push(tbl);
    }
    const airStep = 0.25, airSize = Math.floor(rMax / airStep) + 2;
    const airAmp = new Float64Array(airSize * NB);
    for (let i = 0; i < airSize; i++) for (let b = 0; b < NB; b++) airAmp[i * NB + b] = Math.exp(-airM[b] * i * airStep / 2);

    const gxy = new Float64Array(NB), g = new Float64Array(NB);
    const [pFloor, pCeil, pFront, pBack, pLeft, pRight] = pow;
    for (const ix of xs) {
      for (const iy of ys) {
        const dxy2 = ix[0] * ix[0] + iy[0] * iy[0];
        if (dxy2 > rMax * rMax) continue;
        let gxyMax = 0;
        for (let b = 0; b < NB; b++) {
          gxy[b] = pLeft[ix[1] * NB + b] * pRight[ix[2] * NB + b] * pFront[iy[1] * NB + b] * pBack[iy[2] * NB + b];
          if (gxy[b] > gxyMax) gxyMax = gxy[b];
        }
        // 残りの係数はすべて 1 以下なので、ここで小さすぎれば z 方向を全部飛ばせる
        if (gxyMax / Math.max(0.1, Math.sqrt(dxy2)) < pruneAmp) continue;
        const wallCount = ix[1] + ix[2] + iy[1] + iy[2];
        for (const iz of zs) {
          const d2 = dxy2 + iz[0] * iz[0];
          if (d2 > rMax * rMax) continue;
          if (gxyMax / Math.sqrt(d2) < pruneAmp) continue;
          if (water.active && wallCount === 0 && iz[1] === 1 && iz[2] === 0) continue;  // 水面の1次反射はリアルタイム側
          const d = Math.max(0.1, Math.sqrt(d2)), t = d / c;
          const w = specularWeight(t) / d;
          const ai = Math.min(airSize - 1, Math.floor(d / airStep)) * NB;
          let gmax = 0;
          for (let b = 0; b < NB; b++) {
            g[b] = gxy[b] * pFloor[iz[1] * NB + b] * pCeil[iz[2] * NB + b] * airAmp[ai + b] * w;
            if (g[b] > gmax) gmax = g[b];
          }
          if (gmax < pruneAmp) continue;
          imageCount++;
          const lat = (ix[0] * earX + iy[0] * earY) / d, itd = itdSeconds(lat);
          const li = Math.round((lat + 1) * 0.5 * LAT);
          const pos = toSample(t, wallCount + iz[1] + iz[2] === 0);
          const posL = pos + itd * 0.5 * sr, posR = pos - itd * 0.5 * sr;
          const bin = Math.min(numBins - 1, Math.floor(t / BIN_SECONDS));
          for (let b = 0; b < NB; b++) {
            const l = g[b] * ildL[li][b], r = g[b] * ildR[li][b];
            place(band[b][0], posL, l);
            place(band[b][1], posR, r);
            imageEnergy[b][bin] += 0.5 * (l * l + r * r);
          }
        }
      }
    }
  }
  stats.imageCount = imageCount;

  lap('images');
  // レイトレーシング + diffuse rain
  const hist = [];
  for (let b = 0; b < NB; b++) hist.push(new Float64Array(numBins));
  {
    const rand = rng(0x5eed);
    const maxDist = c * tEnd, golden = Math.PI * (3 - Math.sqrt(5)), stopEnergy = 1e-9 / numRays;
    const size = [L, W, H], E = new Float64Array(NB), pos = [0, 0, 0], dir = [0, 0, 0];
    for (let r = 0; r < numRays; r++) {
      const zz = 1 - 2 * (r + 0.5) / numRays, rad = Math.sqrt(Math.max(0, 1 - zz * zz)), ph = golden * r;
      dir[0] = rad * Math.cos(ph); dir[1] = rad * Math.sin(ph); dir[2] = zz;
      pos[0] = src[0]; pos[1] = src[1]; pos[2] = src[2];
      let travelled = 0;
      E.fill(1 / numRays);
      for (let bounce = 0; ; bounce++) {
        let tMin = Infinity, ax = 0, high = false;
        for (let a = 0; a < 3; a++) {
          if (dir[a] > 1e-12) { const t = (size[a] - pos[a]) / dir[a]; if (t < tMin) { tMin = t; ax = a; high = true; } }
          else if (dir[a] < -1e-12) { const t = -pos[a] / dir[a]; if (t < tMin) { tMin = t; ax = a; high = false; } }
        }
        travelled += tMin;
        if (travelled > maxDist) break;
        for (let a = 0; a < 3; a++) pos[a] = clamp(pos[a] + dir[a] * tMin, 0, size[a]);
        pos[ax] = high ? size[ax] : 0;

        let al, sc = scatter;
        if (ax === 0) al = alpha[high ? 5 : 4];
        else if (ax === 1) al = alpha[high ? 3 : 2];
        else if (high) al = alpha[1];
        else {
          const onWater = pos[0] >= px0 && pos[0] <= px1 && pos[1] >= py0 && pos[1] <= py1;
          al = onWater ? WATER : deckAlpha;
          sc = onWater ? WATER_SCATTERING : scatter;
        }
        for (let b = 0; b < NB; b++) E[b] *= 1 - al[b];

        // 反射点から受音点へ散乱で届く分(鏡像法の範囲では散乱分だけ、範囲の後ろは反射全体)
        const n = high ? -1 : 1;
        const tx = lst[0] - pos[0], ty = lst[1] - pos[1], tz = lst[2] - pos[2];
        const dist = Math.hypot(tx, ty, tz);
        const cosT = (ax === 0 ? tx : ax === 1 ? ty : tz) * n / Math.max(1e-9, dist);
        if (cosT > 0) {
          const tArr = (travelled + dist) / c, bin = Math.floor(tArr / BIN_SECONDS);
          if (bin < numBins) {
            const k = sc + (1 - sc) * (1 - specularWeight(tArr));
            const coef = 4 * k * cosT / Math.max(1, dist * dist);
            for (let b = 0; b < NB; b++) hist[b][bin] += E[b] * coef;
          }
        }

        if (rand() < sc) {
          const u1 = rand(), u2 = rand(), rr = Math.sqrt(u1), phi = 2 * Math.PI * u2;
          dir[ax] = Math.sqrt(Math.max(0, 1 - u1)) * n;
          dir[(ax + 1) % 3] = rr * Math.cos(phi);
          dir[(ax + 2) % 3] = rr * Math.sin(phi);
        } else {
          dir[ax] = -dir[ax];
        }

        if ((bounce & 7) === 7) {
          let maxE = 0;
          for (let b = 0; b < NB; b++) maxE = Math.max(maxE, E[b] * Math.exp(-airM[b] * travelled));
          if (maxE < stopEnergy) break;
        }
      }
    }
    for (let b = 0; b < NB; b++) for (let i = 0; i < numBins; i++) hist[b][i] *= Math.exp(-airM[b] * c * (i + 0.5) * BIN_SECONDS);
  }

  lap('rays');

  // 実際に響きが続く長さ(散乱成分が -80 dB を下回るまで)だけ以降の処理をする
  let Nact = N;
  if (numRays > 0) {
    let peak = 0, last = 0;
    const tot = new Float64Array(numBins);
    for (let i = 0; i < numBins; i++) { for (let b = 0; b < NB; b++) tot[i] += hist[b][i]; if (tot[i] > peak) peak = tot[i]; }
    for (let i = numBins - 1; i >= 0; i--) if (tot[i] > peak * 1e-8) { last = i; break; }
    Nact = Math.min(N, Math.ceil(toSample((last + 1) * BIN_SECONDS, false) + 0.1 * sr));
  }
  // 拡散成分をノイズで合成(左右の相関は耳間距離の拡散音場コヒーレンス)
  {
    // 乱数は xorshift32 をその場で回す(関数呼び出しを避けて速くする)
    let state = 0xa5a5a5a5 | 0;
    const scale = 1.7320508 * 2 / 4294967296;
    const binSamples = BIN_SECONDS * sr;
    const start = Math.ceil(offset + predelay);
    const invBin = 1 / binSamples, t0bins = tDirect / BIN_SECONDS - 0.5;
    for (let b = 0; b < NB; b++) {
      const x = 2 * Math.PI * BANDS[b] * EAR_SPACING / c;
      const rho = clamp(Math.sin(x) / x, 0, 1), gc = Math.sqrt(rho) * scale, gi = Math.sqrt(1 - rho) * scale;
      const h = hist[b], [bl, br] = band[b];
      for (let n = start; n < Nact; n++) {
        const fb = t0bins + (n - start) * invBin;
        const i0 = fb > 0 ? Math.floor(fb) : 0;
        if (i0 + 1 >= numBins) break;
        const fr = fb > 0 ? fb - i0 : 0, e = h[i0] + (h[i0 + 1] - h[i0]) * fr;
        if (e <= 0) continue;
        const env = Math.sqrt(e / binSamples);
        state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
        const common = state * gc;
        state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
        const l = state * gi;
        state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
        bl[n] += env * (common + l);
        br[n] += env * (common + state * gi);
      }
    }
  }

  lap('noise');
  // 帯域フィルター → 実測 RT → 合成
  for (let b = 0; b < NB; b++) {
    const e = imageEnergy[b];
    for (let i = 0; i < numBins; i++) e[i] += hist[b][i];
    stats.rtMeasured.push(measureRt(e));
  }
  const out = [0, 1].map((ch) => synthesizeBands(band.map((bb) => bb[ch].subarray(0, Nact)), sr));

  lap('filter');
  // -70 dB で切ってフェード、エネルギーで正規化
  const edc = new Float64Array(Nact + 1);
  for (let i = Nact - 1; i >= 0; i--) edc[i] = edc[i + 1] + out[0][i] * out[0][i] + out[1][i] * out[1][i];
  const total = edc[0];
  let end = Nact;
  for (let i = offset; i < Nact; i++) if (edc[i] < total * 1e-7) { end = i; break; }
  const fade = Math.min(end - offset, Math.floor(0.05 * sr));
  for (let i = 0; i < fade; i++) {
    const gg = 0.5 + 0.5 * Math.cos(Math.PI * (i + 1) / fade);
    out[0][end - fade + i] *= gg;
    out[1][end - fade + i] *= gg;
  }
  const norm = 1 / Math.sqrt(Math.max(1e-20, total / 2));
  const ir = out.map((o) => { const r = o.slice(0, end); for (let i = 0; i < r.length; i++) r[i] *= norm; return r; });
  water.gain = water.gain.map((v) => v * norm);

  stats.irSeconds = end / sr;
  lap('finish');
  stats.timings = timings;
  stats.renderMs = performance.now() - t0;
  return { ir, water, stats };
}
