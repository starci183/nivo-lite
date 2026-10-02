import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EnvSource } from "../../platform/config/env.source";

export type VideoOptions = {
  /** Where the bundled fonts and music live (engine/assets/video, copied into the image). */
  readonly assetsDir: string;
  /** TTS cache (by text hash). A Docker volume in production so a re-render of the same script costs no TTS call. */
  readonly cacheDir: string;
  /** Scratch space for one render; removed when the render ends (stale ones are swept at start). */
  readonly workDir: string;
  /** "edge" = Microsoft Edge read-aloud (free, no key); "none" = captions only. A paid provider plugs into tts/tts.provider.ts. */
  readonly ttsProvider: "edge" | "none";
  readonly maxSeconds: number;
  readonly ffmpegThreads: number;
  /** Seconds between two TTS requests (Edge throttles bursts). */
  readonly ttsMinGapMs: number;
};

export const parseVideoConfig = (env: EnvSource): VideoOptions => ({
  assetsDir: env.optional("VIDEO_ASSETS_DIR") ?? join(__dirname, "..", "..", "..", "assets", "video"),
  cacheDir: env.optional("VIDEO_CACHE_DIR") ?? "/var/cache/nivo-video",
  workDir: env.optional("VIDEO_WORK_DIR") ?? join(tmpdir(), "nivo-video"),
  ttsProvider: env.optional("VIDEO_TTS_PROVIDER") === "none" ? "none" : "edge",
  maxSeconds: env.int("VIDEO_MAX_SECONDS", 90, { min: 10, max: 300 }),
  ffmpegThreads: env.int("VIDEO_FFMPEG_THREADS", 4, { min: 1, max: 16 }),
  ttsMinGapMs: env.int("VIDEO_TTS_MIN_GAP_MS", 700, { min: 0, max: 10_000 }),
});

export const VIDEO_OPTIONS = Symbol("VIDEO_OPTIONS");
