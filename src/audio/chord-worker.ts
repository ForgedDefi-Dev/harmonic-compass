/// <reference lib="webworker" />

import FFT from "fft.js";
import {
  ANALYSIS_HOP_SIZE,
  ANALYSIS_WINDOW_SIZE,
  analyzeMagnitudeSpectrum,
  hannWindow,
  rootMeanSquare,
} from "./analysis";

declare const self: DedicatedWorkerGlobalScope;

interface AudioChunkMessage {
  type: "audio";
  samples: Float32Array;
  sampleRate: number;
  capturedAtMs: number;
}

interface ResetMessage {
  type: "reset";
}

let buffer = new Float32Array(0);
let previousRms = 0;
const fft = new FFT(ANALYSIS_WINDOW_SIZE);

function appendSamples(incoming: Float32Array): void {
  const combined = new Float32Array(buffer.length + incoming.length);
  combined.set(buffer);
  combined.set(incoming, buffer.length);
  buffer = combined;
}

function analyze(sampleRate: number, capturedAtMs: number): void {
  while (buffer.length >= ANALYSIS_WINDOW_SIZE) {
    const frame = buffer.slice(0, ANALYSIS_WINDOW_SIZE);
    buffer = buffer.slice(ANALYSIS_HOP_SIZE);
    const rms = rootMeanSquare(frame);
    const onset = rms > Math.max(0.012, previousRms * 1.6);
    previousRms = previousRms * 0.72 + rms * 0.28;

    const windowed = hannWindow(frame);
    const complex = fft.createComplexArray();
    fft.realTransform(complex, windowed);
    const magnitudes = new Float32Array(ANALYSIS_WINDOW_SIZE / 2);
    for (let bin = 0; bin < magnitudes.length; bin += 1) {
      const real = complex[bin * 2] ?? 0;
      const imaginary = complex[bin * 2 + 1] ?? 0;
      magnitudes[bin] = Math.hypot(real, imaginary) / ANALYSIS_WINDOW_SIZE;
    }

    const centerLagSamples = Math.max(0, buffer.length - ANALYSIS_WINDOW_SIZE / 2);
    self.postMessage({
      type: "observation",
      observation: analyzeMagnitudeSpectrum({
        magnitudes,
        sampleRate,
        fftSize: ANALYSIS_WINDOW_SIZE,
        rms,
        onset,
        atMs: Math.max(0, capturedAtMs - (centerLagSamples / sampleRate) * 1000),
      }),
    });
  }
}

self.onmessage = (event: MessageEvent<AudioChunkMessage | ResetMessage>) => {
  if (event.data.type === "reset") {
    buffer = new Float32Array(0);
    previousRms = 0;
    return;
  }
  appendSamples(event.data.samples);
  analyze(event.data.sampleRate, event.data.capturedAtMs);
};

export {};
