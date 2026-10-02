import { createHash } from "node:crypto";
import { mkdir, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Inject, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { VIDEO_OPTIONS, type VideoOptions } from "../video.config";
import { EdgeTtsProvider } from "./edge-tts.provider";
import { TtsRetryable, type TtsProvider } from "./tts.provider";

const ATTEMPTS = 4;
const CACHE_MAX_FILES = 400;

export type TtsClip = { readonly file: string; readonly cached: boolean; readonly provider: string };

/**
 * Voiceover for the renderer: provider (pluggable) + pacing (one request at a time, a minimum gap between requests, exponential backoff on
 * throttling) + a disk cache keyed by provider, voice, rate and text hash. With provider "none" (or when Edge is unreachable) the renderer
 * falls back to captions only and reports it; this service never invents audio.
 */
@Injectable()
export class TtsService implements OnModuleDestroy {
  private readonly log = new Logger(TtsService.name);
  private readonly provider: TtsProvider | null;
  private lastCall = 0;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(@Inject(VIDEO_OPTIONS) private readonly options: VideoOptions) {
    this.provider = options.ttsProvider === "edge" ? new EdgeTtsProvider() : null;
  }

  get enabled(): boolean {
    return this.provider !== null;
  }

  get providerId(): string {
    return this.provider?.id ?? "none";
  }

  onModuleDestroy(): void {
    this.provider?.close?.();
  }

  /** The MP3 for this text, from cache or the provider. Throws when the provider keeps failing (the caller degrades that scene to captions only). */
  async clip(text: string, voice: string, ratePct: number, signal: AbortSignal): Promise<TtsClip> {
    if (!this.provider) throw new Error("tts disabled");
    const key = createHash("sha256").update(`${this.provider.id}\n${voice}\n${ratePct}\n${text}`).digest("hex").slice(0, 40);
    const file = join(this.options.cacheDir, `${key}.mp3`);
    try {
      await stat(file);
      return { file, cached: true, provider: this.provider.id };
    } catch {
      /* miss */
    }
    // Serialise: Edge throttles bursts, and one socket handles one request at a time anyway.
    const run = this.chain.then(() => this.fetchWithRetry(text, voice, ratePct, signal));
    this.chain = run.catch(() => undefined);
    const audio = await run;
    try {
      await mkdir(this.options.cacheDir, { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await writeFile(tmp, audio);
      await rename(tmp, file);
      void this.prune();
      return { file, cached: false, provider: this.provider.id };
    } catch (e) {
      // The cache is an optimisation: a read-only volume must not fail the render. Write into the work dir instead.
      this.log.warn(`tts cache write failed: ${(e as Error).message}`);
      await mkdir(this.options.workDir, { recursive: true });
      const fallback = join(this.options.workDir, `tts-${key}.mp3`);
      await writeFile(fallback, audio);
      return { file: fallback, cached: false, provider: this.provider.id };
    }
  }

  private async fetchWithRetry(text: string, voice: string, ratePct: number, signal: AbortSignal): Promise<Buffer> {
    let lastError: Error = new Error("tts failed");
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      if (signal.aborted) throw new Error("aborted");
      const wait = this.lastCall + this.options.ttsMinGapMs - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.lastCall = Date.now();
      try {
        const audio = await this.provider!.synthesize({ text, voice, ratePct }, signal);
        this.lastCall = Date.now();
        return audio;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        if (!(e instanceof TtsRetryable) || attempt === ATTEMPTS) break;
        const backoff = 1500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 400);
        this.log.warn(`tts attempt ${attempt} failed (${lastError.message}); retry in ${backoff}ms`);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
    throw lastError;
  }

  /** Keep the cache bounded: drop the oldest files beyond CACHE_MAX_FILES. */
  private async prune(): Promise<void> {
    try {
      const names = (await readdir(this.options.cacheDir)).filter((n) => n.endsWith(".mp3"));
      if (names.length <= CACHE_MAX_FILES) return;
      const withTime = await Promise.all(names.map(async (n) => ({ n, t: (await stat(join(this.options.cacheDir, n))).mtimeMs })));
      withTime.sort((a, b) => a.t - b.t);
      for (const { n } of withTime.slice(0, names.length - CACHE_MAX_FILES)) await unlink(join(this.options.cacheDir, n)).catch(() => undefined);
    } catch {
      /* best effort */
    }
  }
}
