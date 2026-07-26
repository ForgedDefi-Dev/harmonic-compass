import type { StableChordEvent, TempoContext } from "@/types/music";
import type { AnalysisResult } from "./analysis";
import { ChordStabilizer, type ChordObservation } from "./stabilizer";
import { estimateTempo } from "./tempo";

const DEFAULT_WORKLET_URL = "/audio/pcm-worklet.js";
const DEFAULT_WORKER_URL = "/audio/chord-worker.js";

export type ListeningState =
  "idle" | "requesting" | "listening" | "suspended" | "denied" | "unsupported" | "error";

export interface AudioHealth {
  state: ListeningState;
  inputLevel: number;
  tuningCents: number;
  message?: string;
}

export interface MicrophoneCallbacks {
  onObservation?: (observation: ChordObservation) => void;
  onProvisional?: (event: StableChordEvent) => void;
  onConfirmed?: (event: StableChordEvent) => void;
  onCompleted?: (event: StableChordEvent) => void;
  onTempo?: (tempo: TempoContext) => void;
  onHealth?: (health: AudioHealth) => void;
}

export interface MicrophoneOptions extends MicrophoneCallbacks {
  workletUrl?: URL | string;
  workerFactory?: () => Worker;
  backgroundStopMs?: number;
}

export class MicrophoneChordListener {
  private context?: AudioContext;
  private stream?: MediaStream;
  private source?: MediaStreamAudioSourceNode;
  private relay?: AudioWorkletNode;
  private silentGain?: GainNode;
  private worker?: Worker;
  private recorder?: MediaRecorder;
  private recordingChunks: Blob[] = [];
  private stabilizer = new ChordStabilizer();
  private state: ListeningState = "idle";
  private analysisSuppressed = false;
  private backgroundTimer?: ReturnType<typeof setTimeout>;
  private startedAt = 0;
  private onsets: number[] = [];

  constructor(private readonly options: MicrophoneOptions = {}) {}

  get listeningState(): ListeningState {
    return this.state;
  }

  async start(): Promise<void> {
    if (this.state === "listening") return;
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof AudioContext === "undefined" ||
      typeof AudioWorkletNode === "undefined"
    ) {
      this.setState(
        "unsupported",
        "Live listening is unavailable here. Demo and manual input still work.",
      );
      return;
    }

    this.setState("requesting");
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
        video: false,
      });
      this.context = new AudioContext({ latencyHint: "interactive" });
      await this.context.resume();
      await this.context.audioWorklet.addModule(this.options.workletUrl ?? DEFAULT_WORKLET_URL);

      this.worker =
        this.options.workerFactory?.() ??
        new Worker(DEFAULT_WORKER_URL, {
          type: "module",
          name: "harmonic-compass-analysis",
        });
      this.source = this.context.createMediaStreamSource(this.stream);
      this.relay = new AudioWorkletNode(this.context, "harmonic-compass-pcm", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      this.silentGain = this.context.createGain();
      this.silentGain.gain.value = 0;
      this.source.connect(this.relay).connect(this.silentGain).connect(this.context.destination);
      this.startedAt = performance.now();

      this.relay.port.onmessage = (event: MessageEvent<{ type: "pcm"; samples: Float32Array }>) => {
        if (event.data.type !== "pcm" || this.analysisSuppressed || !this.worker || !this.context) {
          return;
        }
        const samples = event.data.samples;
        this.worker.postMessage(
          {
            type: "audio",
            samples,
            sampleRate: this.context.sampleRate,
            capturedAtMs: performance.now() - this.startedAt,
          },
          [samples.buffer as ArrayBuffer],
        );
      };
      this.worker.onmessage = (
        event: MessageEvent<{ type: "observation"; observation: AnalysisResult }>,
      ) => {
        if (event.data.type !== "observation" || this.analysisSuppressed) return;
        const observation = event.data.observation;
        this.options.onObservation?.(observation);
        this.options.onHealth?.({
          state: this.state,
          inputLevel: Math.min(1, observation.rms * 9),
          tuningCents: observation.tuningCents,
        });
        if (observation.onset) {
          this.onsets.push(observation.atMs);
          this.onsets = this.onsets.slice(-24);
          this.options.onTempo?.(estimateTempo(this.onsets));
        }
        const update = this.stabilizer.push(observation);
        if (update.provisional) this.options.onProvisional?.(update.provisional);
        if (update.completed) this.options.onCompleted?.(update.completed);
        if (update.confirmed) this.options.onConfirmed?.(update.confirmed);
      };
      this.worker.onerror = () => {
        void this.releaseResources().then(() => {
          this.setState(
            "error",
            "Chord analysis stopped unexpectedly. You can restart or use manual input.",
          );
        });
      };

      for (const track of this.stream.getTracks()) {
        track.onended = () => {
          if (this.state === "listening") {
            void this.stop("The microphone was disconnected.");
          }
        };
      }
      document.addEventListener("visibilitychange", this.handleVisibility);
      this.setState("listening");
    } catch (error) {
      await this.releaseResources();
      if (
        error instanceof DOMException &&
        ["NotAllowedError", "SecurityError"].includes(error.name)
      ) {
        this.setState(
          "denied",
          "Microphone access was not granted. Demo and manual input remain available.",
        );
      } else {
        const errorName =
          error instanceof DOMException
            ? error.name
            : error instanceof Error
              ? error.name
              : "UnknownError";
        const message =
          errorName === "NotReadableError"
            ? "Microphone access was granted, but no usable input is available. Check that another app is not using the mic, then try again."
            : errorName === "AbortError"
              ? "The browser stopped microphone startup. Try again, or choose Demo or Manual input."
              : errorName === "NotSupportedError"
                ? "This browser cannot load live audio analysis. Try the latest Chrome, Edge, or Safari."
                : "The live audio engine could not start. Refresh the page and try again, or choose Demo or Manual input.";
        this.setState(
          "error",
          `${message} (${errorName})`,
        );
      }
    }
  }

  setPreviewActive(active: boolean): void {
    this.analysisSuppressed = active;
    if (active) this.worker?.postMessage({ type: "reset" });
  }

  startRecording(): boolean {
    if (!this.stream || typeof MediaRecorder === "undefined" || this.recorder) return false;
    this.recordingChunks = [];
    this.recorder = new MediaRecorder(this.stream);
    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.recordingChunks.push(event.data);
    };
    this.recorder.start(1000);
    return true;
  }

  async stopRecording(): Promise<Blob | undefined> {
    if (!this.recorder) return undefined;
    const recorder = this.recorder;
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(this.recordingChunks, {
          type: recorder.mimeType || "audio/webm",
        });
        this.recorder = undefined;
        this.recordingChunks = [];
        resolve(blob);
      };
      recorder.stop();
    });
  }

  async suspend(): Promise<void> {
    if (!this.context || this.state !== "listening") return;
    await this.context.suspend();
    this.setState("suspended");
  }

  async resume(): Promise<void> {
    if (!this.context || this.state !== "suspended") return;
    await this.context.resume();
    this.setState("listening");
  }

  async stop(message?: string): Promise<void> {
    const final = this.stabilizer.finish(performance.now() - this.startedAt);
    if (final) this.options.onCompleted?.(final);
    await this.releaseResources();
    this.setState("idle", message);
  }

  private handleVisibility = (): void => {
    if (document.visibilityState === "hidden") {
      this.backgroundTimer = setTimeout(() => {
        if (document.visibilityState === "hidden") void this.stop();
      }, this.options.backgroundStopMs ?? 30_000);
    } else if (this.backgroundTimer) {
      clearTimeout(this.backgroundTimer);
      this.backgroundTimer = undefined;
    }
  };

  private async releaseResources(): Promise<void> {
    document.removeEventListener("visibilitychange", this.handleVisibility);
    if (this.backgroundTimer) clearTimeout(this.backgroundTimer);
    this.backgroundTimer = undefined;
    if (this.recorder?.state === "recording") this.recorder.stop();
    this.recorder = undefined;
    this.recordingChunks = [];
    this.relay?.disconnect();
    this.source?.disconnect();
    this.silentGain?.disconnect();
    this.worker?.terminate();
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.context && this.context.state !== "closed") await this.context.close();
    this.relay = undefined;
    this.source = undefined;
    this.silentGain = undefined;
    this.worker = undefined;
    this.stream = undefined;
    this.context = undefined;
    this.stabilizer.reset();
    this.onsets = [];
  }

  private setState(state: ListeningState, message?: string): void {
    this.state = state;
    this.options.onHealth?.({ state, inputLevel: 0, tuningCents: 0, message });
  }
}
