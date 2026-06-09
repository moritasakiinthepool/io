let audioContext = null;

function getContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

export function unlockAudio() {
  const context = getContext();
  if (context.state === "suspended") context.resume().catch(() => {});
}

export function playConfirm() {
  const context = getContext();
  if (context.state === "suspended") return;
  const start = context.currentTime;

  [[660, 0, 0.10], [1047, 0.09, 0.18]].forEach(([frequency, delay, decay]) => {
    const time = start + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.16, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + decay);
    oscillator.start(time);
    oscillator.stop(time + decay + 0.01);
  });
}

export function playCursor() {
  const context = getContext();
  if (context.state === "suspended") return;
  const start = context.currentTime;
  const length = Math.max(1, Math.floor(context.sampleRate * 0.025));
  const noiseBuffer = context.createBuffer(1, length, context.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }

  const noise = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const noiseGain = context.createGain();
  noise.buffer = noiseBuffer;
  filter.type = "bandpass";
  filter.frequency.value = 3200;
  filter.Q.value = 1.8;
  noiseGain.gain.setValueAtTime(0.18, start);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, start + 0.022);
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(context.destination);
  noise.start(start);
  noise.stop(start + 0.025);
}

export function playPuyoStep(step = 0) {
  const context = getContext();
  if (context.state === "suspended") return;
  const start = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.type = "square";
  const frequency = step % 2 === 0 ? 920 : 1080;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.88, start + 0.045);
  gain.gain.setValueAtTime(0.055, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.05);
  oscillator.start(start);
  oscillator.stop(start + 0.055);
}

export function playTypingVoice() {
  const context = getContext();
  if (context.state === "suspended") return;
  const start = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.type = "square";
  oscillator.frequency.value = 500 + Math.random() * 120;
  gain.gain.setValueAtTime(0.05, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.045);
  oscillator.start(start);
  oscillator.stop(start + 0.05);
}
