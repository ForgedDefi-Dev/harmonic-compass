import type { ChordSymbol } from "@/types/music";
import { chordPitchClasses } from "@/music/theory";

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

export class ChordPreviewPlayer {
  private tone?: typeof import("tone");
  private synth?: ToneInstrument;
  private activeUntil?: ReturnType<typeof setTimeout>;

  constructor(private readonly onPreviewState?: (active: boolean) => void) {}

  async preview(chord: ChordSymbol, durationSeconds = 1.4): Promise<void> {
    await this.stop();
    this.tone ??= await import("tone");
    await this.tone.start();
    const synth = new this.tone.PolySynth(this.tone.Synth, {
      oscillator: { type: "triangle8" },
      envelope: { attack: 0.015, decay: 0.22, sustain: 0.34, release: 0.75 },
    }).toDestination() as unknown as ToneInstrument;
    synth.volume.value = -11;
    this.synth = synth;
    this.onPreviewState?.(true);
    synth.triggerAttackRelease(chordNotes(chord), durationSeconds);
    this.activeUntil = setTimeout(
      () => {
        void this.stop();
      },
      durationSeconds * 1000 + 850,
    );
  }

  async previewRoute(chords: ChordSymbol[], bpm = 96): Promise<void> {
    await this.stop();
    this.tone ??= await import("tone");
    await this.tone.start();
    const synth = new this.tone.PolySynth(this.tone.Synth, {
      oscillator: { type: "triangle8" },
      envelope: { attack: 0.012, decay: 0.18, sustain: 0.3, release: 0.45 },
    }).toDestination() as unknown as ToneInstrument;
    synth.volume.value = -12;
    this.synth = synth;
    this.onPreviewState?.(true);
    const secondsPerChord = (60 / bpm) * 2;
    const now = this.tone.now() + 0.04;
    chords.forEach((chord, index) => {
      synth.triggerAttackRelease(
        chordNotes(chord),
        secondsPerChord * 0.82,
        now + index * secondsPerChord,
      );
    });
    this.activeUntil = setTimeout(
      () => void this.stop(),
      (chords.length * secondsPerChord + 0.7) * 1000,
    );
  }

  async stop(): Promise<void> {
    if (this.activeUntil) clearTimeout(this.activeUntil);
    this.activeUntil = undefined;
    this.synth?.dispose();
    this.synth = undefined;
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
