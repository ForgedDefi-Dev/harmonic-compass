import type { ChordSymbol } from "@/types/music";
import { guitarVoicingNotes } from "@/music/guitar";
import { chordPitchClasses, formatChord } from "@/music/theory";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function chordNotes(chord: ChordSymbol, octave = 4): string[] {
  return chordPitchClasses(chord).map((pitch, index) => {
    const noteOctave = octave + (pitch < chord.root && index > 0 ? 1 : 0);
    return `${NOTE_NAMES[pitch]}${noteOctave}`;
  });
}

interface ToneInstrument {
  triggerAttackRelease(
    notes: string | string[],
    duration: string | number,
    time?: number,
    velocity?: number,
  ): void;
  dispose(): void;
  volume: { value: number };
}

export type ChordPreviewPattern = "strum" | "arpeggio";

export interface ChordPreviewOptions {
  pattern?: ChordPreviewPattern;
  durationSeconds?: number;
}

function noteFrequency(note: string): number {
  const match = /^([A-G])(#?)(-?\d+)$/.exec(note);
  if (!match) return 440;
  const pitchClasses: Record<string, number> = {
    C: 0,
    "C#": 1,
    D: 2,
    "D#": 3,
    E: 4,
    F: 5,
    "F#": 6,
    G: 7,
    "G#": 8,
    A: 9,
    "A#": 10,
    B: 11,
  };
  const pitch = pitchClasses[`${match[1]}${match[2]}`] ?? 9;
  const midi = (Number(match[3]) + 1) * 12 + pitch;
  return 440 * 2 ** ((midi - 69) / 12);
}

function seededNoise(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return (((state ^ (state >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

/**
 * A deliberately small physical model for a warm steel-string acoustic guitar.
 *
 * It is not intended to replace a multisampled instrument. It does, however,
 * model the things that make an acoustic preview feel musical instead of like
 * a bright test oscillator: a rounded pick transient, a damped string loop,
 * and a quiet, slowly decaying wooden-body resonance.
 */
export const STEEL_STRING_PROFILE = {
  pickAttackSeconds: 0.009,
  excitationSmoothing: 0.24,
  bodyMix: 0.048,
  bodyDecaySeconds: 0.48,
  damping: 0.9971,
} as const;

export function synthesizeSteelString(
  sampleRate: number,
  frequency: number,
  durationSeconds: number,
  voiceIndex = 0,
): Float32Array {
  const length = Math.ceil(sampleRate * durationSeconds);
  const signal = new Float32Array(length);
  const period = Math.max(2, Math.round(sampleRate / frequency));
  const noise = seededNoise(Math.round(frequency * 100) + voiceIndex * 8191);

  // A soft, correlated excitation keeps the pick present without the brittle
  // white-noise edge that made the old previews sound metallic and twangy.
  let previousNoise = 0;
  for (let sample = 0; sample < period && sample < length; sample += 1) {
    previousNoise += (noise() - previousNoise) * STEEL_STRING_PROFILE.excitationSmoothing;
    const pickShape = 0.92 - (sample / period) * 0.25;
    signal[sample] = previousNoise * pickShape;
  }

  // Karplus–Strong loop. High strings lose energy a touch sooner, as they do
  // on a real guitar, while the bass strings keep a rounder sustain.
  const damping = Math.max(
    0.9959,
    STEEL_STRING_PROFILE.damping - Math.min(0.0011, frequency * 0.0000012),
  );
  for (let sample = period; sample < length; sample += 1) {
    const delayed = signal[sample - period] ?? 0;
    const neighbor = signal[sample - period + 1] ?? delayed;
    signal[sample] = (delayed * 0.68 + neighbor * 0.32) * damping;
  }

  // Roll the string signal into the softer voice of an acoustic body and add
  // very low-level body modes. These modes are intentionally quiet: they add
  // wood and air, not an audible synthetic organ tone.
  const stringSmoothing = Math.min(0.34, 0.2 + frequency / 5_000);
  let smoothed = 0;
  let peak = 0;
  const bodyPhase = (voiceIndex % 7) * 0.42;
  for (let sample = 0; sample < length; sample += 1) {
    const seconds = sample / sampleRate;
    const raw = signal[sample] ?? 0;
    smoothed += (raw - smoothed) * stringSmoothing;
    const attack = Math.min(1, seconds / STEEL_STRING_PROFILE.pickAttackSeconds);
    const bodyEnvelope =
      (1 - Math.exp(-seconds / 0.012)) * Math.exp(-seconds / STEEL_STRING_PROFILE.bodyDecaySeconds);
    const body =
      (Math.sin(2 * Math.PI * 96 * seconds + bodyPhase) * 0.78 +
        Math.sin(2 * Math.PI * 188 * seconds + bodyPhase * 0.7) * 0.36 +
        Math.sin(2 * Math.PI * 286 * seconds + bodyPhase * 1.3) * 0.14) *
      STEEL_STRING_PROFILE.bodyMix *
      bodyEnvelope;
    const value = (smoothed * 0.94 + raw * 0.06 + body) * attack;
    signal[sample] = value;
    peak = Math.max(peak, Math.abs(value));
  }

  // Keep chord voicings consistent in level while retaining plenty of headroom
  // for the per-string velocity and the master compressor.
  const targetPeak = 0.62;
  const scale = peak > 0.0001 ? targetPeak / peak : 1;
  for (let sample = 0; sample < length; sample += 1) signal[sample] *= scale;
  return signal;
}

function createPluckedStringBuffer(
  context: AudioContext,
  frequency: number,
  durationSeconds: number,
  voiceIndex: number,
): AudioBuffer {
  const buffer = context.createBuffer(
    1,
    Math.ceil(context.sampleRate * durationSeconds),
    context.sampleRate,
  );
  buffer
    .getChannelData(0)
    .set(synthesizeSteelString(context.sampleRate, frequency, durationSeconds, voiceIndex));
  return buffer;
}
export class ChordPreviewPlayer {
  private context?: AudioContext;
  private sources = new Set<AudioBufferSourceNode>();
  private master?: GainNode;
  private outputNodes: AudioNode[] = [];
  private activeUntil?: ReturnType<typeof setTimeout>;

  constructor(private readonly onPreviewState?: (active: boolean) => void) {}

  async preview(chord: ChordSymbol, options: ChordPreviewOptions = {}): Promise<void> {
    await this.previewGuitarChord(formatChord(chord), options);
  }

  async previewGuitarChord(chord: string, options: ChordPreviewOptions = {}): Promise<void> {
    await this.stop();
    this.onPreviewState?.(true);
    let context: AudioContext;
    try {
      context = await this.prepareContext();
    } catch (error) {
      this.finishPreview();
      throw error;
    }
    const pattern = options.pattern ?? "strum";
    const durationSeconds = options.durationSeconds ?? (pattern === "arpeggio" ? 2.4 : 1.8);
    const notes = guitarVoicingNotes(chord);
    this.scheduleGuitarChord(notes, context.currentTime + 0.035, pattern, durationSeconds);
    const spacing = pattern === "arpeggio" ? 0.18 : 0.032;
    const previewDurationMs = (durationSeconds + notes.length * spacing + 0.8) * 1000;
    this.activeUntil = setTimeout(() => this.finishPreview(), previewDurationMs);
  }

  async previewRoute(
    chords: ChordSymbol[],
    bpm = 96,
    pattern: ChordPreviewPattern = "strum",
  ): Promise<void> {
    await this.previewGuitarRoute(
      chords.map((chord) => formatChord(chord)),
      bpm,
      pattern,
    );
  }

  async previewGuitarRoute(
    chords: string[],
    bpm = 96,
    pattern: ChordPreviewPattern = "strum",
  ): Promise<void> {
    await this.stop();
    this.onPreviewState?.(true);
    let context: AudioContext;
    try {
      context = await this.prepareContext();
    } catch (error) {
      this.finishPreview();
      throw error;
    }
    const secondsPerChord = (60 / bpm) * 2;
    const now = context.currentTime + 0.04;
    chords.forEach((chord, index) => {
      this.scheduleGuitarChord(
        guitarVoicingNotes(chord),
        now + index * secondsPerChord,
        pattern,
        secondsPerChord * 0.78,
      );
    });
    const previewDurationMs = (chords.length * secondsPerChord + 0.7) * 1000;
    this.activeUntil = setTimeout(() => this.finishPreview(), previewDurationMs);
  }

  private async prepareContext(): Promise<AudioContext> {
    if (!this.context) {
      const AudioContextConstructor =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) throw new Error("Web Audio is not supported in this browser.");
      this.context = new AudioContextConstructor();
    }
    if (this.context.state === "suspended") await this.context.resume();

    const master = this.context.createGain();
    const body = this.context.createBiquadFilter();
    const air = this.context.createBiquadFilter();
    const compressor = this.context.createDynamicsCompressor();
    master.gain.value = 0.68;

    // A little low-mid wood and a gentle air roll-off make the whole chord feel
    // like it is coming from a guitar body instead of a bright direct synth.
    body.type = "lowshelf";
    body.frequency.value = 145;
    body.gain.value = 1.35;
    air.type = "highshelf";
    air.frequency.value = 5_200;
    air.gain.value = -2.4;
    compressor.threshold.value = -18;
    compressor.knee.value = 16;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.22;
    master.connect(body).connect(air).connect(compressor).connect(this.context.destination);
    this.outputNodes = [body, air, compressor];
    this.master = master;
    return this.context;
  }

  private scheduleGuitarChord(
    notes: string[],
    startAt: number,
    pattern: ChordPreviewPattern,
    durationSeconds: number,
  ): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master) return;
    const spacing = pattern === "arpeggio" ? 0.18 : 0.032;
    notes.forEach((note, index) => {
      const noteDuration =
        pattern === "arpeggio" ? Math.max(0.82, durationSeconds - index * 0.055) : durationSeconds;
      const frequency = noteFrequency(note);
      const source = context.createBufferSource();
      const warmth = context.createBiquadFilter();
      const voiceGain = context.createGain();
      const panner = context.createStereoPanner();
      const noteStart = startAt + index * spacing;
      const velocity = Math.max(0.38, 0.72 - index * 0.035);

      source.buffer = createPluckedStringBuffer(context, frequency, noteDuration + 0.35, index);
      warmth.type = "lowpass";
      warmth.frequency.value = Math.min(5_800, 3_600 + frequency * 2.15);
      warmth.Q.value = 0.56;
      panner.pan.value = Math.max(-0.28, Math.min(0.28, (index - (notes.length - 1) / 2) * 0.1));
      voiceGain.gain.setValueAtTime(0.0001, noteStart);
      voiceGain.gain.exponentialRampToValueAtTime(velocity, noteStart + 0.007);
      voiceGain.gain.exponentialRampToValueAtTime(0.0001, noteStart + noteDuration);

      source.connect(warmth).connect(voiceGain).connect(panner).connect(master);
      source.onended = () => {
        this.sources.delete(source);
        source.disconnect();
        warmth.disconnect();
        voiceGain.disconnect();
        panner.disconnect();
      };
      this.sources.add(source);
      source.start(noteStart);
      source.stop(noteStart + noteDuration + 0.08);
    });
  }

  private finishPreview(): void {
    this.activeUntil = undefined;
    this.onPreviewState?.(false);
  }

  async stop(): Promise<void> {
    if (this.activeUntil) clearTimeout(this.activeUntil);
    this.activeUntil = undefined;
    const context = this.context;
    const master = this.master;
    if (context && master) {
      const now = context.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
      const sources = [...this.sources];
      const outputNodes = [...this.outputNodes];
      this.outputNodes = [];
      setTimeout(() => {
        sources.forEach((source) => {
          try {
            source.stop();
          } catch {
            // A source that already reached its natural end needs no further cleanup.
          }
        });
        master.disconnect();
        outputNodes.forEach((node) => node.disconnect());
      }, 55);
    }
    this.master = undefined;
    this.onPreviewState?.(false);
  }
}
export type BandStyle = "campfire" | "open-road" | "night-air";
export type BandDensity = 1 | 2 | 3;

export interface BandOptions {
  bpm: number;
  style: BandStyle;
  density: BandDensity;
  progression: ChordSymbol[];
  beatsPerChord?: number;
}

export class ResponsiveBand {
  private tone?: typeof import("tone");
  private pad?: ToneInstrument;
  private bass?: ToneInstrument;
  private kick?: ToneInstrument;
  private scheduleIds: number[] = [];
  private options?: BandOptions;

  async start(options: BandOptions): Promise<void> {
    await this.stop();
    this.options = options;
    this.tone ??= await import("tone");
    await this.tone.start();
    const Tone = this.tone;
    const transport = Tone.getTransport();
    transport.bpm.value = options.bpm;

    this.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: options.style === "night-air" ? "sine" : "triangle" },
      envelope: { attack: 0.08, decay: 0.3, sustain: 0.32, release: 0.7 },
    }).toDestination() as unknown as ToneInstrument;
    this.bass = new Tone.MonoSynth({
      oscillator: { type: options.style === "open-road" ? "square" : "triangle" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.24, release: 0.22 },
      filterEnvelope: { attack: 0.01, decay: 0.18, sustain: 0.2, baseFrequency: 90, octaves: 2 },
    }).toDestination() as unknown as ToneInstrument;
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 5,
      envelope: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.08 },
    }).toDestination() as unknown as ToneInstrument;
    this.pad.volume.value = options.style === "night-air" ? -16 : -19;
    this.bass.volume.value = -13;
    this.kick.volume.value = -12;

    const beatsPerChord = options.beatsPerChord ?? 4;
    const chordSchedule = transport.scheduleRepeat((time) => {
      if (!this.options?.progression.length) return;
      const position = transport.ticks / transport.PPQ;
      const index = Math.floor(position / beatsPerChord) % this.options.progression.length;
      const current = this.options.progression[index];
      this.pad?.triggerAttackRelease(chordNotes(current, 4), `${beatsPerChord}n`, time, 0.42);
      this.bass?.triggerAttackRelease(`${NOTE_NAMES[current.root]}2`, "4n", time, 0.65);
    }, `${beatsPerChord}n`);
    const drumSchedule = transport.scheduleRepeat((time) => {
      const beat = Math.floor(transport.ticks / transport.PPQ) % 4;
      const play =
        this.options?.density === 3 || beat === 0 || (this.options?.density === 2 && beat === 2);
      if (play) this.kick?.triggerAttackRelease("C1", "8n", time, beat === 0 ? 0.82 : 0.5);
    }, "4n");
    this.scheduleIds = [chordSchedule, drumSchedule];
    transport.start("+0.05");
  }

  updateProgression(progression: ChordSymbol[]): void {
    if (this.options) this.options = { ...this.options, progression };
  }

  async stop(): Promise<void> {
    if (this.tone) {
      const transport = this.tone.getTransport();
      this.scheduleIds.forEach((id) => transport.clear(id));
      transport.stop();
      transport.position = 0;
    }
    this.scheduleIds = [];
    this.pad?.dispose();
    this.bass?.dispose();
    this.kick?.dispose();
    this.pad = undefined;
    this.bass = undefined;
    this.kick = undefined;
    this.options = undefined;
  }
}
