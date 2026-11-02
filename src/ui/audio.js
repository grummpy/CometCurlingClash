// Live synthesis only: oscillators, a noise buffer, and short envelopes.

const MELODY = [523, 659, 784, 659, 587, 523, 392, 440, 523, 392, 349, 392, 523, 659, 784, 1047];

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let failed = false;
  let timer = 0;
  let step = 0;
  let playing = false;
  const state = { volume: 0.8, mute: false };

  function ensure() {
    if (failed) return null;
    try {
      if (!ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
          failed = true;
          return null;
        }
        ctx = new AudioCtx();
        master = ctx.createGain();
        master.gain.value = state.mute ? 0 : state.volume;
        master.connect(ctx.destination);
        musicGain = ctx.createGain();
        musicGain.gain.value = 0.07;
        musicGain.connect(master);
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    } catch {
      failed = true;
      return null;
    }
  }

  function envGain(peak, duration, destination) {
    const audio = ensure();
    if (!audio) return null;
    const gain = audio.createGain();
    const now = audio.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    gain.connect(destination || master);
    return { audio, gain, now };
  }

  function tone(freq, duration, type, peak, destination) {
    const node = envGain(peak, duration, destination);
    if (!node) return;
    const osc = node.audio.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, node.now);
    osc.connect(node.gain);
    osc.start(node.now);
    osc.stop(node.now + duration + 0.02);
  }

  function noise(duration, peak) {
    const node = envGain(peak, duration, master);
    if (!node) return;
    const length = Math.floor(node.audio.sampleRate * duration);
    const buffer = node.audio.createBuffer(1, length, node.audio.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = (Math.floor(node.audio.currentTime * 1000) ^ 0x9e3779b9) >>> 0 || 1;
    for (let i = 0; i < length; i++) {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      data[i] = (seed / 4294967296) * 2 - 1;
    }
    const source = node.audio.createBufferSource();
    source.buffer = buffer;
    source.connect(node.gain);
    source.start(node.now);
  }

  function scheduleMusic() {
    if (!playing) return;
    const audio = ensure();
    if (!audio) return;
    const freq = MELODY[step % MELODY.length];
    tone(freq, 0.16, "square", 0.9, musicGain);
    if (step % 4 === 0) tone(freq / 2, 0.18, "triangle", 0.4, musicGain);
    step += 1;
    timer = window.setTimeout(scheduleMusic, 180);
  }

  return {
    resume() {
      ensure();
    },
    setVolume(volume) {
      state.volume = volume;
      if (master && !state.mute) master.gain.value = volume;
    },
    setMute(mute) {
      state.mute = mute;
      if (master) master.gain.value = mute ? 0 : state.volume;
    },
    startMusic() {
      if (playing) return;
      playing = true;
      step = 0;
      scheduleMusic();
    },
    stopMusic() {
      playing = false;
      if (timer) window.clearTimeout(timer);
      timer = 0;
    },
    ui() {
      tone(660, 0.07, "square", 0.12);
    },
    launch() {
      const node = envGain(0.16, 0.22);
      if (!node) return;
      const osc = node.audio.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180, node.now);
      osc.frequency.exponentialRampToValueAtTime(720, node.now + 0.18);
      osc.connect(node.gain);
      osc.start(node.now);
      osc.stop(node.now + 0.24);
      noise(0.12, 0.08);
    },
    hit() {
      tone(140, 0.12, "square", 0.18);
      noise(0.08, 0.16);
    },
    pickup() {
      tone(520, 0.08, "square", 0.12);
      tone(780, 0.1, "square", 0.1);
      tone(1040, 0.12, "triangle", 0.08);
    },
    ko() {
      const node = envGain(0.2, 0.35);
      if (!node) return;
      const osc = node.audio.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(420, node.now);
      osc.frequency.exponentialRampToValueAtTime(70, node.now + 0.3);
      osc.connect(node.gain);
      osc.start(node.now);
      osc.stop(node.now + 0.36);
      noise(0.18, 0.12);
    },
    countdown() {
      tone(880, 0.09, "square", 0.14);
    },
    spin() {
      tone(300, 0.1, "triangle", 0.12);
      tone(460, 0.14, "sine", 0.08);
    },
    roundWin() {
      const audio = ensure();
      if (!audio) return;
      [523, 659, 784, 1047].forEach((freq, index) => {
        const when = audio.currentTime + index * 0.09;
        const gain = audio.createGain();
        gain.gain.setValueAtTime(0.0001, when);
        gain.gain.exponentialRampToValueAtTime(0.14, when + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.2);
        gain.connect(master);
        const osc = audio.createOscillator();
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, when);
        osc.connect(gain);
        osc.start(when);
        osc.stop(when + 0.22);
      });
    },
  };
}
