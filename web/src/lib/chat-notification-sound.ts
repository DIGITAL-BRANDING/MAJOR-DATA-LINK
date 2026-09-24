// Browser autoplay rules prohibit unexpected audio until the person has
// interacted with the page. This tiny Web Audio chime has no asset/CDN
// dependency and becomes available after the first tap, click, or key press.
let audioContext: AudioContext | null = null;

function context() {
  audioContext ??= new AudioContext();
  return audioContext;
}

export function enableChatNotificationSound() {
  const unlock = () => {
    const audio = context();
    void audio.resume().catch(() => undefined);
  };
  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true });
  return () => {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
}

/** A short two-note chime for a reply from the other side of live chat. */
export function playChatNotificationSound() {
  const audio = audioContext;
  if (!audio || audio.state !== 'running') return;
  const now = audio.currentTime;
  [0, 0.15].forEach((offset, index) => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = index === 0 ? 880 : 1175;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.12, now + offset + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.13);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(now + offset);
    oscillator.stop(now + offset + 0.14);
  });
}
