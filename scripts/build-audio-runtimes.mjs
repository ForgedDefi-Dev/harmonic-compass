import { build } from "esbuild";

const shared = {
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  minify: true,
  sourcemap: false,
  logLevel: "info",
};

await build({
  ...shared,
  entryPoints: ["src/audio/pcm-worklet.ts"],
  outfile: "public/audio/pcm-worklet.js",
});

await build({
  ...shared,
  entryPoints: ["src/audio/chord-worker.ts"],
  outfile: "public/audio/chord-worker.js",
});
