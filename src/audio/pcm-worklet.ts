declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;
  abstract process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processorCtor: new () => AudioWorkletProcessor,
): void;

class PcmRelayProcessor extends AudioWorkletProcessor {
  private chunks: Float32Array[] = [];
  private sampleCount = 0;

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0];
    if (!input?.length) return true;
    const copy = new Float32Array(input);
    this.chunks.push(copy);
    this.sampleCount += copy.length;

    if (this.sampleCount >= 1024) {
      const pooled = new Float32Array(this.sampleCount);
      let offset = 0;
      for (const chunk of this.chunks) {
        pooled.set(chunk, offset);
        offset += chunk.length;
      }
      this.chunks = [];
      this.sampleCount = 0;
      this.port.postMessage({ type: "pcm", samples: pooled }, [pooled.buffer as ArrayBuffer]);
    }
    return true;
  }
}

registerProcessor("harmonic-compass-pcm", PcmRelayProcessor);

export {};
