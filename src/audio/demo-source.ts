import type { StableChordEvent } from "@/types/music";
import { SHOWCASE_OBSERVATIONS, createShowcaseEvents } from "@/music/demo";

export interface DemoSourceCallbacks {
  onObservation?: (observation: (typeof SHOWCASE_OBSERVATIONS)[number]) => void;
  onEvent?: (event: StableChordEvent) => void;
  onComplete?: () => void;
}

export class ShowcaseChordSource {
  private timers: ReturnType<typeof setTimeout>[] = [];
  private running = false;

  constructor(private readonly callbacks: DemoSourceCallbacks = {}) {}

  start(speed = 1): void {
    this.stop();
    this.running = true;
    const safeSpeed = Math.max(0.25, Math.min(4, speed));
    const events = createShowcaseEvents();
    for (const observation of SHOWCASE_OBSERVATIONS) {
      this.timers.push(
        setTimeout(() => {
          if (this.running) this.callbacks.onObservation?.(observation);
        }, observation.atMs / safeSpeed),
      );
    }
    for (const event of events) {
      this.timers.push(
        setTimeout(
          () => {
            if (this.running) this.callbacks.onEvent?.(event);
          },
          (event.startMs + 260) / safeSpeed,
        ),
      );
    }
    const endMs = events.at(-1)?.endMs ?? 0;
    this.timers.push(
      setTimeout(() => {
        if (!this.running) return;
        this.running = false;
        this.callbacks.onComplete?.();
      }, endMs / safeSpeed),
    );
  }

  stop(): void {
    this.running = false;
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers = [];
  }
}
