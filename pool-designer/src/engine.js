// Web Audio のグラフ(プラグインの processBlock に相当)
//
//  audio 要素 ─┬─ dry 遅延(IR の直接音の位置に揃える) ─ dryGain ────────────────┐
//              └─ モノラル化 ─┬─ 畳み込み A ─ gainA ─┐                           ├─ 出力 ─ 再生
//                             ├─ 畳み込み B ─ gainB ─┼─ ローカット ─ wetGain ────┘
//                             └─ 水面反射(揺れる遅延)┘
import { DIRECT_OFFSET_SECONDS, speedOfSound } from './room-model.js';

const XFADE = 0.25;   // IR 切り替えのクロスフェード [s]
const SMOOTH = 0.03;  // パラメータ変化のなめらかさ [s]

export class Engine {
  constructor(audioElement) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx({ latencyHint: 'playback' });
    const ctx = this.ctx;
    this.audio = audioElement;
    this.source = ctx.createMediaElementSource(audioElement);

    this.output = ctx.createGain();
    this.output.connect(ctx.destination);

    this.dryDelay = ctx.createDelay(0.1);
    this.dryDelay.delayTime.value = DIRECT_OFFSET_SECONDS;
    this.dryGain = ctx.createGain();
    this.source.connect(this.dryDelay).connect(this.dryGain).connect(this.output);

    this.mono = ctx.createGain();
    this.mono.channelCount = 1;
    this.mono.channelCountMode = 'explicit';
    this.mono.channelInterpretation = 'speakers';
    this.source.connect(this.mono);

    this.wetSum = ctx.createGain();
    this.lowCut = ctx.createBiquadFilter();
    this.lowCut.type = 'highpass';
    this.lowCut.frequency.value = 10;
    this.wetGain = ctx.createGain();
    this.wetSum.connect(this.lowCut).connect(this.wetGain).connect(this.output);

    this.convs = [0, 1].map(() => {
      const conv = ctx.createConvolver();
      conv.normalize = false;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      this.mono.connect(conv).connect(gain).connect(this.wetSum);
      return { conv, gain };
    });
    this.active = -1;  // まだ IR がない間は原音をそのまま流す

    // 水面の1次反射: 揺れる遅延線を左右に1本ずつ
    const merger = ctx.createChannelMerger(2);
    merger.connect(this.wetSum);
    this.lfos = [1, 1.37, 0.71].map((ratio, i) => {
      const osc = ctx.createOscillator();
      osc.frequency.value = 0.4 * ratio;
      osc.start(ctx.currentTime + i * 0.37);  // 位相をずらして繰り返し感を減らす
      return { osc, ratio, weight: [0.5, 0.3, 0.2][i] };
    });
    this.water = [0, 1].map((ch) => {
      const delay = ctx.createDelay(1.0);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      this.mono.connect(delay).connect(gain).connect(merger, 0, ch);
      // LFO → 深さ → delayTime / gain
      const delayDepth = this.lfos.map((l) => { const g = ctx.createGain(); g.gain.value = 0; l.osc.connect(g).connect(delay.delayTime); return g; });
      const ampDepth = ctx.createGain();
      ampDepth.gain.value = 0;
      this.lfos[ch === 0 ? 1 : 2].osc.connect(ampDepth).connect(gain.gain);
      return { delay, gain, delayDepth, ampDepth };
    });
    this.waterInfo = { active: false, delay: [0.001, 0.001], gain: [0, 0], pathPerWaveHeight: 0 };
    this.rt = { waveHeight: 2, waveSpeed: 0.4, lowCut: 20, mix: 1, output: 0, temperature: 30, bypass: false };
    this.applyRealtime();
  }

  async resume() {
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  get sampleRate() { return this.ctx.sampleRate; }

  setImpulseResponse(ir, water) {
    const ctx = this.ctx, now = ctx.currentTime;
    const buf = ctx.createBuffer(2, ir[0].length, ctx.sampleRate);
    buf.copyToChannel(ir[0], 0);
    buf.copyToChannel(ir[1], 1);
    const next = this.active === 0 ? 1 : 0;
    const incoming = this.convs[next];
    incoming.conv.buffer = buf;
    incoming.gain.gain.cancelScheduledValues(now);
    incoming.gain.gain.setValueAtTime(0, now);
    incoming.gain.gain.linearRampToValueAtTime(1, now + XFADE);
    if (this.active >= 0) {
      const outgoing = this.convs[this.active];
      outgoing.gain.gain.cancelScheduledValues(now);
      outgoing.gain.gain.setValueAtTime(outgoing.gain.gain.value, now);
      outgoing.gain.gain.linearRampToValueAtTime(0, now + XFADE);
      // 使わなくなった畳み込みは止めて CPU を空ける
      clearTimeout(this.releaseTimer);
      this.releaseTimer = setTimeout(() => { outgoing.conv.buffer = null; }, (XFADE + 0.1) * 1000);
    }
    const first = this.active < 0;
    this.active = next;
    this.waterInfo = water;
    if (first) this.applyRealtime(); else this.applyWater();
  }

  setRealtime(values) {
    Object.assign(this.rt, values);
    this.applyRealtime();
  }

  applyRealtime() {
    const now = this.ctx.currentTime, r = this.rt;
    const mix = r.bypass || this.active < 0 ? 0 : r.mix;
    this.dryGain.gain.setTargetAtTime(1 - mix, now, SMOOTH);
    this.wetGain.gain.setTargetAtTime(mix, now, SMOOTH);
    this.output.gain.setTargetAtTime(Math.pow(10, r.output / 20), now, SMOOTH);
    this.lowCut.frequency.setTargetAtTime(r.lowCut <= 20.5 ? 10 : r.lowCut, now, SMOOTH);
    for (const l of this.lfos) l.osc.frequency.setTargetAtTime(r.waveSpeed * l.ratio, now, SMOOTH);
    this.applyWater();
  }

  applyWater() {
    const now = this.ctx.currentTime, w = this.waterInfo, r = this.rt;
    const heightM = r.waveHeight * 0.01;
    const depthSeconds = heightM * w.pathPerWaveHeight / speedOfSound(r.temperature);
    const focus = 0.35 * Math.min(1, heightM / 0.1);
    this.water.forEach((node, ch) => {
      const gain = w.active ? w.gain[ch] : 0;
      node.delay.delayTime.setTargetAtTime(Math.max(0.0005, w.delay[ch]), now, 0.05);
      node.gain.gain.setTargetAtTime(gain, now, 0.05);
      node.ampDepth.gain.setTargetAtTime(gain * focus, now, 0.05);
      node.delayDepth.forEach((g, i) => g.gain.setTargetAtTime(depthSeconds * this.lfos[i].weight, now, 0.05));
    });
  }
}
