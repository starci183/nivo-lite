import { createWriteStream } from "node:fs";
import { mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Inject, Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NivoClient, NivoHttpError } from "../../platform/nivo/nivo-client.service";
import { PermanentJobError, RetryJobError, type EngineJob, type JobHandler, type JobResult } from "../../platform/queue/queue.types";
import { SUPABASE } from "../../platform/supabase/supabase.module";
import { FfmpegError } from "./ffmpeg";
import { RenderRejected, renderVideo, type Stage } from "./renderer";
import { TtsService } from "./tts/tts.service";
import { mediaPathOf, validateVideoSpec, MEDIA_BUCKET, MEDIA_MAX_BYTES, VIDEOS_BUCKET, type VideoSpec } from "./video-spec";
import { VIDEO_OPTIONS, type VideoOptions } from "./video.config";

type VideoInput = { readonly render_id: string; readonly workspace_id: string; readonly status: string; readonly spec: unknown };

/** Where each stage sits on the 0..100 bar the member sees (upload is the last 5 %). */
const BAND: Record<Stage, readonly [number, number]> = { tts: [0, 10], scenes: [10, 45], mix: [45, 50], encode: [50, 92], poster: [92, 94] };

/**
 * video.render { render_id }: render one short marketing video from a spec and put it in Storage.
 *   app  ->  /api/engine/video-input  { job_id }                         the spec of the render row of THIS job
 *   here     download assets (media bucket, this workspace only) -> TTS -> ffmpeg -> upload to the `videos` bucket
 *   app  <-  /api/engine/callback { op: video.progress | video.result | video.error }
 * One render at a time (maxConcurrent 1, outside the shared slots), nice 10, 4 ffmpeg threads, a 90 s ceiling and a per-job temp dir that is always removed.
 */
@Injectable()
export class VideoRenderHandler implements JobHandler, OnApplicationBootstrap {
  readonly kind = "video.render";
  readonly maxConcurrent = 1;
  private readonly log = new Logger(VideoRenderHandler.name);

  constructor(
    private readonly nivo: NivoClient,
    private readonly tts: TtsService,
    @Inject(SUPABASE) private readonly db: SupabaseClient,
    @Inject(VIDEO_OPTIONS) private readonly options: VideoOptions,
  ) {}

  /** Leftovers of a crashed render: anything older than an hour in the work dir. */
  async onApplicationBootstrap(): Promise<void> {
    try {
      for (const name of await readdir(this.options.workDir)) {
        const dir = join(this.options.workDir, name);
        if (Date.now() - (await stat(dir)).mtimeMs > 3_600_000) await rm(dir, { recursive: true, force: true });
      }
    } catch {
      /* no work dir yet */
    }
  }

  async run(job: EngineJob, signal: AbortSignal): Promise<JobResult> {
    if (!job.workspace_id) throw new PermanentJobError("video.render needs a workspace");
    const t0 = Date.now();
    let input: VideoInput;
    try {
      input = await this.nivo.call<VideoInput>("/api/engine/video-input", { job_id: job.id }, signal);
    } catch (e) {
      throw this.classify(e);
    }
    if (input.status === "done" || input.status === "failed") return { skipped: input.status, render_id: input.render_id };

    const workDir = join(this.options.workDir, job.id);
    try {
      const checked = validateVideoSpec(input.spec, { workspaceId: input.workspace_id });
      if (!checked.ok) throw new RenderRejected(`invalid_spec: ${checked.errors.join("; ")}`);
      const spec = checked.spec;
      await rm(workDir, { recursive: true, force: true });
      await mkdir(workDir, { recursive: true });

      const progress = this.progressReporter(job.id, signal);
      const assets = await this.fetchAssets(spec, input.workspace_id, workDir, signal);
      const tAssets = Date.now() - t0;

      const out = await renderVideo({
        spec,
        workDir,
        assets,
        signal,
        options: this.options,
        tts: this.tts,
        onProgress: (stage, pct) => {
          const [lo, hi] = BAND[stage];
          progress(lo + ((hi - lo) * pct) / 100, stage);
        },
      });

      progress(94, "upload", true);
      const base = `${input.workspace_id}/${input.render_id}`;
      const tUp = Date.now();
      await this.upload(`${base}/video.mp4`, out.videoFile, "video/mp4");
      await this.upload(`${base}/poster.jpg`, out.posterFile, "image/jpeg");
      const meta: Record<string, unknown> = { ...out.meta, timings: { ...(out.meta.timings as Record<string, number>), assets_ms: tAssets, upload_ms: Date.now() - tUp, total_ms: Date.now() - t0 } };
      await this.nivo.call("/api/engine/callback", {
        job_id: job.id,
        op: "video.result",
        output_path: `${base}/video.mp4`,
        poster_path: `${base}/poster.jpg`,
        duration_ms: out.durationMs,
        size_bytes: out.sizeBytes,
        meta,
      }, signal);
      this.log.log(`render ${input.render_id} ok: ${out.durationMs} ms of video, ${(out.sizeBytes / 1048576).toFixed(1)} MB, ${JSON.stringify(meta.timings)} ${JSON.stringify(meta.memory)}`);
      return { render_id: input.render_id, duration_ms: out.durationMs, size_bytes: out.sizeBytes, timings: meta.timings, memory: meta.memory };
    } catch (e) {
      if (signal.aborted) throw e;
      const message = e instanceof Error ? e.message : String(e);
      const permanent = e instanceof RenderRejected || e instanceof PermanentJobError || (e instanceof NivoHttpError && e.permanent);
      const last = job.attempts >= job.max_attempts;
      this.log.warn(`render ${input.render_id} failed (${permanent ? "permanent" : last ? "last attempt" : "will retry"}): ${message}${e instanceof FfmpegError ? ` | ${e.stderr.slice(-600)}` : ""}`);
      if (permanent || last) {
        await this.nivo.call("/api/engine/callback", { job_id: job.id, op: "video.error", reason: message.slice(0, 300) }, signal).catch(() => undefined);
      }
      throw permanent ? new PermanentJobError(message) : e instanceof Error ? e : new Error(message);
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /** Throttled progress callback (at most one per 2.5 s and only when the percent moved). Never fails the render. */
  private progressReporter(jobId: string, signal: AbortSignal): (percent: number, stage: string, force?: boolean) => void {
    let lastAt = 0;
    let lastPct = -1;
    return (percent, stage, force = false) => {
      const pct = Math.max(0, Math.min(99, Math.round(percent)));
      const now = Date.now();
      if (!force && (now - lastAt < 2500 || pct === lastPct)) return;
      lastAt = now;
      lastPct = pct;
      this.nivo.call("/api/engine/callback", { job_id: jobId, op: "video.progress", progress: pct, stage }, signal).catch(() => undefined);
    };
  }

  /** Every asset of the spec, downloaded once into the work dir. Only paths inside the job's own workspace folder are ever read. */
  private async fetchAssets(spec: VideoSpec, workspaceId: string, workDir: string, signal: AbortSignal): Promise<Map<string, string>> {
    const paths = new Set<string>();
    for (const s of spec.scenes) if (s.background.type === "image" || s.background.type === "video") paths.add(s.background.src);
    if (spec.brand.logo) paths.add(spec.brand.logo);
    const map = new Map<string, string>();
    let n = 0;
    for (const path of paths) {
      if (!mediaPathOf(path, workspaceId)) throw new RenderRejected(`asset_outside_workspace: ${path}`);
      const file = join(workDir, `asset${n++}${extname(path).slice(0, 8).toLowerCase()}`);
      const { data, error } = await this.db.storage.from(MEDIA_BUCKET).createSignedUrl(path, 300);
      if (error || !data) throw new RenderRejected(`asset_missing: ${path} (${error?.message ?? "no url"})`);
      const res = await fetch(data.signedUrl, { signal: AbortSignal.any([signal, AbortSignal.timeout(120_000)]) });
      if (!res.ok || !res.body) throw new RenderRejected(`asset_unreadable: ${path} (${res.status})`);
      const declared = Number(res.headers.get("content-length") ?? 0);
      if (declared > MEDIA_MAX_BYTES) throw new RenderRejected(`asset_too_large: ${path}`);
      let seen = 0;
      const limited = Readable.fromWeb(res.body as never).on("data", (c: Buffer) => {
        seen += c.length;
        if (seen > MEDIA_MAX_BYTES) limited.destroy(new RenderRejected(`asset_too_large: ${path}`));
      });
      await pipeline(limited, createWriteStream(file));
      map.set(path, file);
    }
    return map;
  }

  private async upload(path: string, file: string, contentType: string): Promise<void> {
    const body = await readFile(file);
    const { error } = await this.db.storage.from(VIDEOS_BUCKET).upload(path, body, { contentType, upsert: true });
    if (error) throw new Error(`upload ${path}: ${error.message}`);
  }

  private classify(e: unknown): Error {
    if (e instanceof NivoHttpError) return e.permanent ? new PermanentJobError(e.message) : new RetryJobError(e.message, 10);
    return e instanceof Error ? e : new Error(String(e));
  }
}
