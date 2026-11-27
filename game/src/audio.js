// Sound only: tiny synthesised blips through WebAudio, no audio files at all.
// Every sound is one short oscillator burst, so the game stays silent until the
// player first presses a key (browsers block audio before a gesture).

export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context === null) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        context = new AudioContext();
      } catch {
        context = null;
      }
    }
    if (context !== null && context.state === 'suspended') context.resume();
    return context;
  }

  /** One burst: `frequency` slides to `slideTo` over `seconds`, at `volume`. */
  function blip(frequency, slideTo, seconds, type, volume) {
    if (muted) return;
    const audio = ensure();
    if (audio === null) return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), audio.currentTime + seconds);
    gain.gain.setValueAtTime(volume, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + seconds);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + seconds);
  }

  return {
    jump() {
      blip(320, 640, 0.14, 'sine', 0.12);
    },
    corn() {
      blip(880, 1320, 0.09, 'triangle', 0.1);
    },
    feather() {
      blip(660, 990, 0.18, 'triangle', 0.12);
      setTimeout(() => blip(990, 1320, 0.16, 'triangle', 0.1), 90);
    },
    stumble() {
      blip(220, 70, 0.25, 'sawtooth', 0.14);
    },
    hide() {
      blip(440, 660, 0.12, 'sine', 0.08);
    },
    caught() {
      blip(330, 55, 0.7, 'sawtooth', 0.16);
    },
    escaped() {
      blip(523, 523, 0.14, 'triangle', 0.12);
      setTimeout(() => blip(659, 659, 0.14, 'triangle', 0.12), 140);
      setTimeout(() => blip(784, 784, 0.3, 'triangle', 0.14), 280);
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}
