/**
 * Lazy Web Audio sampler for the FreePats FSS steel-string acoustic bank.
 *
 * The bank is intentionally small (13 recorded notes, about 5.3 MB decoded)
 * so previews can sound like a real guitar without turning the app into a
 * heavyweight sampler. The nearest recorded note is repitched for each
 * played pitch. If the network is unavailable, callers can use the existing
 * procedural instrument as a graceful offline fallback.
 */

export const STEEL_STRING_SAMPLE_ROOTS = [
  { midi: 40, file: "E2.wav" },
  { midi: 45, file: "A2.wav" },
  { midi: 51, file: "D#3.wav" },
  { midi: 56, file: "G#3.wav" },
  { midi: 60, file: "C4.wav" },
  { midi: 63, file: "D#4.wav" },
  { midi: 66, file: "F#4.wav" },
  { midi: 69, file: "A4.wav" },
  { midi: 72, file: "C5.wav" },
  { midi: 75, file: "D#5.wav" },
  { midi: 78, file: "F#5.wav" },
  { midi: 81, file: "A5.wav" },
  { midi: 84, file: "C6.wav" },
] as const;

const SAMPLE_BASE_URL = "/audio/steel-string/samples/";

const PITCH_CLASSES: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

export function noteToMidi(note: string): number | undefined {
  const match = /^([A-G](?:#|b)?)(-?\d+)$/.exec(note);
  if (!match) return undefined;
  const pitch = PITCH_CLASSES[match[1]!];
  if (pitch === undefined) return undefined;
  return (Number(match[2]) + 1) * 12 + pitch;
}

export class SteelStringSampleBank {
  private readonly buffers = new Map<number, AudioBuffer>();
  private loadPromise?: Promise<boolean>;

  constructor(private readonly context: AudioContext) {}

  async load(): Promise<boolean> {
    if (this.buffers.size === STEEL_STRING_SAMPLE_ROOTS.length) return true;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = Promise.all(
      STEEL_STRING_SAMPLE_ROOTS.map(async ({ midi, file }) => {
        const response = await fetch(`${SAMPLE_BASE_URL}${encodeURIComponent(file)}`, {
          cache: "force-cache",
        });
        if (!response.ok) throw new Error(`Unable to load acoustic guitar sample ${file}`);
        const data = await response.arrayBuffer();
        const decoded = await this.context.decodeAudioData(data);
        this.buffers.set(midi, decoded);
      }),
    )
      .then(() => true)
      .catch(() => false);
    return this.loadPromise;
  }

  getBuffer(note: string): { buffer: AudioBuffer; sampleMidi: number } | undefined {
    const midi = noteToMidi(note);
    if (midi === undefined || !this.buffers.size) return undefined;
    const sampleMidi = STEEL_STRING_SAMPLE_ROOTS.reduce<number>(
      (closest, sample) =>
        Math.abs(sample.midi - midi) < Math.abs(closest - midi) ? sample.midi : closest,
      STEEL_STRING_SAMPLE_ROOTS[0]!.midi,
    );
    const buffer = this.buffers.get(sampleMidi);
    return buffer ? { buffer, sampleMidi } : undefined;
  }
}
