// Renders a spec WITHOUT Supabase or the queue (assets are local files), to measure time and memory and to eyeball the result.
//   docker run --rm -v <scratch>:/work -v <engine/dev>:/dev-scripts --entrypoint node nivo-engine:<tag> /dev-scripts/render-smoke.mjs /work/spec.json /work/assets /work/out
// spec.json asset paths ("<ws>/name.jpg") resolve to <assetsDir>/name.jpg.
import { readFileSync, mkdirSync, copyFileSync } from "node:fs";
import { basename, join } from "node:path";
const root = process.env.ENGINE_DIST ?? "/app/dist";
const { renderVideo } = await import(`${root}/features/video-render/renderer.js`);
const { TtsService } = await import(`${root}/features/video-render/tts/tts.service.js`);
const { validateVideoSpec } = await import(`${root}/features/video-render/video-spec.js`);
const [specFile, assetsDir, outDir] = process.argv.slice(2);
const raw = JSON.parse(readFileSync(specFile, "utf8"));
const checked = validateVideoSpec(raw, { workspaceId: raw.__ws });
if (!checked.ok) { console.error(checked.errors); process.exit(2); }
const options = { assetsDir: process.env.VIDEO_ASSETS_DIR ?? "/app/assets/video", cacheDir: process.env.VIDEO_CACHE_DIR ?? "/tmp/tts-cache", workDir: join(outDir, "work"), ttsProvider: process.env.VIDEO_TTS_PROVIDER ?? "edge", maxSeconds: 90, ffmpegThreads: 4, ttsMinGapMs: 700 };
const spec = checked.spec;
const assets = new Map();
for (const s of spec.scenes) if (s.background.src) assets.set(s.background.src, join(assetsDir, basename(s.background.src)));
if (spec.brand.logo) assets.set(spec.brand.logo, join(assetsDir, basename(spec.brand.logo)));
mkdirSync(outDir, { recursive: true });
const t0 = Date.now();
const res = await renderVideo({ spec, workDir: options.workDir, assets, signal: new AbortController().signal, options, tts: new TtsService(options), onProgress: (st, p) => process.stderr.write(`\r${st} ${p}%   `) });
copyFileSync(res.videoFile, join(outDir, "out.mp4"));
copyFileSync(res.posterFile, join(outDir, "poster.jpg"));
console.log("\n" + JSON.stringify({ wall_ms: Date.now() - t0, durationMs: res.durationMs, sizeMB: +(res.sizeBytes / 1048576).toFixed(2), meta: res.meta }, null, 1));
process.exit(0);
