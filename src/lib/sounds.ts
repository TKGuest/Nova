/**
 * Sound Synthesis Engine for Nova Habit Tracker
 * Highly portable, browser-compatible synthesized sound effects using Web Audio API.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Plays an ascending hero's fanfare representing streak validation or completion success.
 */
export function playAscendingFanfare() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Beautiful bright ascending major triad pattern
    // C4 (261.63), E4 (329.63), G4 (392.00), C5 (523.25), E5 (659.25), G5 (783.99)
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
    const duration = 0.12;
    const interval = 0.08;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle'; // Warm retro synth vibe
      osc.frequency.setValueAtTime(freq, now + idx * interval);
      
      // Volume envelope to prevent popping/clicking
      gain.gain.setValueAtTime(0, now + idx * interval);
      gain.gain.linearRampToValueAtTime(idx === notes.length - 1 ? 0.35 : 0.2, now + idx * interval + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * interval + duration + (idx === notes.length - 1 ? 0.4 : 0.2));

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * interval);
      osc.stop(now + idx * interval + duration + (idx === notes.length - 1 ? 0.45 : 0.25));
    });
  } catch (error) {
    console.warn('Audio synthesis failed:', error);
  }
}

/**
 * Plays a simple upward ding sound representing item tick off
 */
export function playDing() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Clean double upward ding (high E followed immediately by high A)
    const notes = [659.25, 880.0];
    const times = [0, 0.08];

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + times[idx]);

      gain.gain.setValueAtTime(0, now + times[idx]);
      gain.gain.linearRampToValueAtTime(0.25, now + times[idx] + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + times[idx] + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + times[idx]);
      osc.stop(now + times[idx] + 0.3);
    });
  } catch (error) {
    console.warn('Audio synthesis failed:', error);
  }
}
