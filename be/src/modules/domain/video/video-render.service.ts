import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises"
import { extname, join } from "node:path"
import { Injectable } from "@nestjs/common"
import type { OnApplicationBootstrap } from "@nestjs/common"
import { VideoRendersService } from "@modules/domain/video-renders"
import { InjectSupabaseAdminClient } from "@modules/integrations/supabase"
import type { SupabaseAdminClient } from "@modules/integrations/supabase"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { isRenderVideoPayload } from "@modules/queues/video-render"
import { VideoError, VideoErrorCode } from "./errors/video.error"
import { RendererService } from "./renderer.service"
import type { RenderStage } from "./renderer.service"
import { InjectVideoOptions } from "./video.decorators"
import { VideoLogEvent } from "./video.log-events"
import type { VideoOptions } from "./video.options"
import { VideoService } from "./video.service"
import { MEDIA_BUCKET, MEDIA_MAX_BYTES, VIDEOS_BUCKET, mediaPathOf, validateVideoSpec } from "./video-spec.policy"
import type { VideoSpec } from "./video-spec.policy"

/** Where each stage sits on the 0..100 bar the member sees (the upload is the last 6 %). */
const BANDS: Record<RenderStage, readonly [number, number]> = {
    tts: [0, 10],
    scenes: [10, 45],
    mix: [45, 50],
    encode: [50, 92],
    poster: [92, 94],
}

/** The delivery that is the last the queue gives a job (the queue archives the message after it). */
const LAST_ATTEMPT = 5

/** A render that runs longer than this is aborted and retried. */
const RENDER_TIMEOUT_MS = 25 * 60_000

/** Work directories older than this are leftovers of a crashed render. */
const STALE_WORKDIR_MS = 3_600_000

/** The least time between two progress writes. */
const PROGRESS_GAP_MS = 2500

@Injectable()
/**
 * The render-video job's effect: take the render, download the assets of its workspace, render, upload the MP4 and its poster, and settle the
 * row. A request that cannot be rendered (rejected) fails the render for good; anything else is thrown so the queue retries the delivery,
 * and the last delivery marks the render failed. The work directory is always removed.
 */
export class VideoRenderService implements OnApplicationBootstrap {
    constructor(
        @InjectVideoOptions() private readonly options: VideoOptions,
        private readonly video: VideoService,
        private readonly renders: VideoRendersService,
        private readonly renderer: RendererService,
        @InjectSupabaseAdminClient() private readonly supabase: SupabaseAdminClient,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Sweeps the leftovers of a crashed render: any work directory older than an hour. */
    async onApplicationBootstrap(): Promise<void> {
        const names = await readdir(this.options.workDir).catch((cause: unknown) => {
            this.logger.warn(VideoLogEvent.WorkDirUnreadable, {
                reason: cause instanceof Error ? cause.name : "unknown",
            })
            return []
        })
        await Promise.all(
            names.map(async (name) => {
                const dir = join(this.options.workDir, name)
                const age = this.clock.now().getTime() - (await stat(dir)).mtimeMs
                if (age > STALE_WORKDIR_MS) await rm(dir, { recursive: true, force: true })
            }),
        )
    }

    /** Renders the render row the job payload names; any other payload changes nothing. */
    async render(payload: object): Promise<void> {
        if (!isRenderVideoPayload(payload)) return
        const claimed = await this.renders.claim(payload.renderId)
        if (claimed === null) return
        const workDir = join(this.options.workDir, claimed.renderId)
        try {
            await this.produce(claimed.renderId, claimed.workspaceId, claimed.spec, claimed.attempts, workDir)
        } catch (cause) {
            const rejected = cause instanceof VideoError && cause.code === VideoErrorCode.RenderRejected
            this.logger.error(VideoLogEvent.RenderFailed, cause, {
                renderId: claimed.renderId,
                attempt: claimed.attempts,
            })
            if (rejected || claimed.attempts >= LAST_ATTEMPT) {
                await this.video.failRender(claimed.renderId, cause instanceof Error ? cause.message : "render failed")
            }
            if (!rejected) throw cause
        } finally {
            await rm(workDir, { recursive: true, force: true })
        }
    }

    private async produce(
        renderId: string,
        workspaceId: string,
        raw: unknown,
        attempt: number,
        workDir: string,
    ): Promise<void> {
        const checked = validateVideoSpec(raw, { workspaceId })
        if (!checked.ok) {
            throw new VideoError({
                code: VideoErrorCode.RenderRejected,
                params: { reason: `invalid_spec: ${checked.errors.join("; ")}` },
            })
        }
        await rm(workDir, { recursive: true, force: true })
        await mkdir(workDir, { recursive: true })
        const assets = await this.fetchAssets(checked.spec, workspaceId, workDir)
        const output = await this.renderer.render({
            spec: checked.spec,
            workDir,
            assets,
            signal: AbortSignal.timeout(RENDER_TIMEOUT_MS),
            attempt,
            onProgress: this.progressReporter(renderId),
        })
        const base = `${workspaceId}/${renderId}`
        const began = this.clock.now().getTime()
        await this.upload(`${base}/video.mp4`, await readFile(output.videoFile), "video/mp4")
        await this.upload(`${base}/poster.jpg`, await readFile(output.posterFile), "image/jpeg")
        await this.video.completeRender(renderId, {
            outputPath: `${base}/video.mp4`,
            posterPath: `${base}/poster.jpg`,
            durationMs: output.durationMs,
            sizeBytes: output.sizeBytes,
            meta: {
                ...output.meta,
                timings: { ...output.meta.timings, upload_ms: this.clock.now().getTime() - began },
            },
        })
        this.logger.info(VideoLogEvent.RenderDone, {
            renderId,
            durationMs: output.durationMs,
            sizeBytes: output.sizeBytes,
        })
    }

    /** A throttled progress write (at most one per 2.5 s, only when the percent moved). It never fails the render. */
    private progressReporter(renderId: string): (stage: RenderStage, percent: number) => void {
        let lastAt = 0
        let lastPercent = -1
        return (stage, percent) => {
            const [low, high] = BANDS[stage]
            const overall = Math.round(low + ((high - low) * percent) / 100)
            const now = this.clock.now().getTime()
            if (now - lastAt < PROGRESS_GAP_MS || overall === lastPercent) return
            lastAt = now
            lastPercent = overall
            this.renders.reportProgress(renderId, overall, stage).catch((cause: unknown) => {
                this.logger.error(VideoLogEvent.ProgressNotRecorded, cause, { renderId })
            })
        }
    }

    /** Every asset of the spec, downloaded once into the work directory. Only paths inside the render's own workspace folder are ever read. */
    private async fetchAssets(spec: VideoSpec, workspaceId: string, workDir: string): Promise<Map<string, string>> {
        const paths = new Set<string>()
        for (const scene of spec.scenes) {
            if (scene.background.type === "image" || scene.background.type === "video") paths.add(scene.background.src)
        }
        if (spec.brand.logo !== null) paths.add(spec.brand.logo)
        const files = new Map<string, string>()
        await eachInOrder(paths, async (path) => {
            if (mediaPathOf(path, workspaceId) === null) {
                throw new VideoError({
                    code: VideoErrorCode.RenderRejected,
                    params: { reason: `asset_outside_workspace: ${path}` },
                })
            }
            const file = join(workDir, `asset${files.size}${extname(path).slice(0, 8).toLowerCase()}`)
            await writeFile(file, await this.download(path))
            files.set(path, file)
        })
        return files
    }

    /** The bytes of one asset of the media bucket; an unreadable or oversized asset is a rejected render. */
    private async download(path: string): Promise<Buffer> {
        const { data, error } = await this.supabase.storage.from(MEDIA_BUCKET).download(path)
        if (error !== null) {
            throw new VideoError({
                code: VideoErrorCode.RenderRejected,
                params: { reason: `asset_missing: ${path}` },
                cause: error,
            })
        }
        if (data.size > MEDIA_MAX_BYTES) {
            throw new VideoError({
                code: VideoErrorCode.RenderRejected,
                params: { reason: `asset_too_large: ${path}` },
            })
        }
        return Buffer.from(await data.arrayBuffer())
    }

    /** Writes one file of the render into the videos bucket, replacing an earlier attempt. */
    private async upload(path: string, body: Buffer, contentType: string): Promise<void> {
        const { error } = await this.supabase.storage
            .from(VIDEOS_BUCKET)
            .upload(path, body, { contentType, upsert: true })
        if (error !== null) throw new VideoError({ code: VideoErrorCode.StorageFailed, params: { path }, cause: error })
    }
}
