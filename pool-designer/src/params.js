// スライダーで操作するパラメータ。room: true は変更すると響き(IR)を計算し直すもの
const pct = (v) => `${Math.round(v * 100)} %`;

export const PARAMS = [
  { id: 'length', room: true, detail: '長さ / LENGTH', min: 5, max: 100, step: 0.5, fmt: (v) => `${v.toFixed(1)} m` },
  { id: 'width', room: true, detail: '幅 / WIDTH', min: 4, max: 60, step: 0.5, fmt: (v) => `${v.toFixed(1)} m` },
  { id: 'height', room: true, detail: '高さ / HEIGHT', min: 2.5, max: 30, step: 0.5, fmt: (v) => `${v.toFixed(1)} m` },
  { id: 'deckWidth', room: true, detail: 'プールサイドの幅 / DECK', min: 0, max: 10, step: 0.1, fmt: (v) => `${v.toFixed(1)} m` },
  { id: 'scattering', room: true, basic: '壁の凹凸 / SCATTERING', detail: '壁の凹凸(散乱)/ SCATTERING', min: 0, max: 1, step: 0.01, fmt: pct },
  { id: 'temperature', room: true, detail: '気温 / AIR TEMP', min: 15, max: 35, step: 0.5, fmt: (v) => `${v.toFixed(1)} °C` },
  { id: 'humidity', room: true, detail: '湿度 / HUMIDITY', min: 20, max: 100, step: 1, fmt: (v) => `${Math.round(v)} %` },
  { id: 'waveHeight', basic: '水面の揺れ / WAVES', detail: '波の高さ / WAVE HEIGHT', min: 0, max: 20, step: 0.1, fmt: (v) => `${v.toFixed(1)} cm` },
  { id: 'waveSpeed', detail: '揺れの速さ / WAVE SPEED', min: 0.05, max: 3, step: 0.01, log: true, fmt: (v) => `${v.toFixed(2)} Hz` },
  { id: 'predelayMs', room: true, detail: 'プリディレイ / PRE-DELAY', min: 0, max: 200, step: 1, fmt: (v) => `${Math.round(v)} ms` },
  { id: 'lowCut', detail: 'ローカット / LOW CUT', min: 20, max: 1000, step: 1, log: true, fmt: (v) => (v <= 20.5 ? 'Off' : `${Math.round(v)} Hz`) },
  { id: 'mix', basic: '原音と響き / MIX', detail: '原音と響き / MIX', min: 0, max: 1, step: 0.01, fmt: pct },
  { id: 'output', basic: '出力 / OUTPUT', detail: '出力 / OUTPUT', min: -24, max: 12, step: 0.1, fmt: (v) => `${v.toFixed(1)} dB` },
];

export const REALTIME_DEFAULTS = { waveHeight: 2, waveSpeed: 0.4, lowCut: 20, mix: 1, output: 0 };
