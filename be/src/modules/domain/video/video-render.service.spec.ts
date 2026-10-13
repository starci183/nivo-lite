import { mkdir, mkdtemp, readdir, utimes, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { FakeClock, builder, mock } from "@starci/jest-preset"
import { StorageApiError } from "@supabase/storage-js"
import { VideoRendersService } from "@modules/domain/video-renders"
import type { SupabaseStorageService } from "@modules/integrations/supabase"
import type { Logger } from "@modules/platform/logging"
import { VideoErrorCode } from "./errors/video.error"
import { RendererService } from "./renderer.service"
import type { RenderInput, RenderOutput } from "./renderer.service"
import { VideoLogEvent } from "./video.log-events"
import type { VideoOptions } from "./video.options"
import { VideoService } from "./video.service"
import { VideoRenderService } from "./video-render.service"

jest.mock("@modules/integrations/supabase", () => ({ InjectSupabaseStorage: () => () => undefined }))

const WORKSPACE = "0a1b2c3d-0a1b-4c3d-8a1b-0a1b2c3d4e5f"
const IMAGE = `${WORKSPACE}/photo.jpg`
const LOGO = `${WORKSPACE}/logo.png`

const SPEC = {
    aspect: "9:16",
    scenes: [
        { background: { type: "image", src: IMAGE, motion: "zoom-in" }, caption: "Hello" },
        { background: { type: "video", src: IMAGE, start_s: 0 } },
        { background: { type: "color", color: "#fff" } },
    ],
    brand: { name: "Shop", logo: LOGO },
}

type ClaimedRender = NonNullable<Awaited<ReturnType<VideoRendersService["claim"]>>>
const claimOf = builder<ClaimedRender>({ renderId: "render-1", workspaceId: WORKSPACE, spec: SPEC, attempts: 1 })

const outputOf = (dir: string): RenderOutput => ({
    videoFile: join(dir, "out.mp4"),
    posterFile: join(dir, "poster.jpg"),
    durationMs: 9000,
    sizeBytes: 5,
    meta: {
        width: 1080,
        height: 1920,
        fps: 30,
        scenes: 3,
        warnings: [],
        tts: { provider: "none", requested: 0, failed: 0, cached: 0 },
        voiceover: "none",
        music: null,
        loudness: {},
        timings: { tts_ms: 1 },
    },
})

const has = async (dir: string, name: string): Promise<boolean> => (await readdir(dir)).includes(name)

const build = async () => {
    const root = await mkdtemp(join(tmpdir(), "nivo-render-job-spec-"))
    const options: VideoOptions = { assetsDir: "assets", workDir: join(root, "work"), maxSeconds: 90, ffmpegThreads: 2 }
    const video = mock<VideoService>()
    const renders = mock<VideoRendersService>()
    const renderer = mock<RendererService>()
    const logger = mock<Logger>()
    const clock = new FakeClock("2026-10-12T00:00:00.000Z")
    const bucket = mock<SupabaseStorageService>()
    bucket.download.mockResolvedValue({ data: new Blob(["bytes"]), error: null })
    bucket.upload.mockResolvedValue({ data: { id: "1", path: "p", fullPath: "f" }, error: null })
    renders.claim.mockResolvedValue(claimOf())
    renderer.render.mockImplementation(async (input: RenderInput) => {
        await writeFile(join(input.workDir, "out.mp4"), "video")
        await writeFile(join(input.workDir, "poster.jpg"), "poster")
        return outputOf(input.workDir)
    })
    const service = new VideoRenderService(options, video, renders, renderer, bucket, clock, logger)
    return { service, video, renders, renderer, logger, clock, bucket, options, root }
}

describe("VideoRenderService", () => {
    describe("render", () => {
        it("downloads the assets, renders, uploads the files, settles the render and removes the work directory", async () => {
            const { service, video, renderer, bucket, logger, options } = await build()

            await service.render({ renderId: "render-1" })

            expect(bucket.download).toHaveBeenCalledWith("media", IMAGE)
            expect(bucket.download).toHaveBeenCalledWith("media", LOGO)
            expect(bucket.download).toHaveBeenCalledTimes(2)
            const input = renderer.render.mock.calls[0]?.[0]
            expect(input?.attempt).toBe(1)
            expect([...(input?.assets.keys() ?? [])]).toEqual([IMAGE, LOGO])
            expect(bucket.upload).toHaveBeenCalledWith(
                "videos",
                `${WORKSPACE}/render-1/video.mp4`,
                expect.any(Buffer),
                {
                    contentType: "video/mp4",
                    upsert: true,
                },
            )
            expect(bucket.upload).toHaveBeenCalledWith(
                "videos",
                `${WORKSPACE}/render-1/poster.jpg`,
                expect.any(Buffer),
                {
                    contentType: "image/jpeg",
                    upsert: true,
                },
            )
            expect(video.completeRender).toHaveBeenCalledWith("render-1", {
                outputPath: `${WORKSPACE}/render-1/video.mp4`,
                posterPath: `${WORKSPACE}/render-1/poster.jpg`,
                durationMs: 9000,
                sizeBytes: 5,
                meta: expect.objectContaining({ timings: { tts_ms: 1, upload_ms: 0 } }),
            })
            expect(logger.info).toHaveBeenCalledWith(
                VideoLogEvent.RenderDone,
                expect.objectContaining({ renderId: "render-1" }),
            )
            expect(await has(options.workDir, "render-1")).toBe(false)
        })

        it("changes nothing for a payload that is not a render-video payload", async () => {
            const { service, renders } = await build()

            await service.render({ orderId: "order-1" })

            expect(renders.claim).not.toHaveBeenCalled()
        })

        it("changes nothing for a render that is already settled", async () => {
            const { service, renders, renderer } = await build()
            renders.claim.mockResolvedValue(null)

            await service.render({ renderId: "render-1" })

            expect(renderer.render).not.toHaveBeenCalled()
        })

        it("fails the render for good, without a retry, when its spec cannot be rendered", async () => {
            const { service, renders, video, renderer } = await build()
            renders.claim.mockResolvedValue(claimOf({ spec: { scenes: [] } }))

            await expect(service.render({ renderId: "render-1" })).resolves.toBeUndefined()

            expect(renderer.render).not.toHaveBeenCalled()
            expect(video.failRender).toHaveBeenCalledWith("render-1", expect.stringContaining("VIDEO_RENDER_REJECTED"))
        })

        it("fails the render for good when an asset is missing or too big", async () => {
            const { service, video, bucket } = await build()
            bucket.download.mockResolvedValueOnce({ data: null, error: new StorageApiError("gone", 500, "500") })

            await expect(service.render({ renderId: "render-1" })).resolves.toBeUndefined()

            expect(video.failRender).toHaveBeenCalledTimes(1)

            bucket.download.mockResolvedValue({ data: new Blob([new Uint8Array(51 * 1024 * 1024)]), error: null })
            await expect(service.render({ renderId: "render-1" })).resolves.toBeUndefined()

            expect(video.failRender).toHaveBeenCalledTimes(2)
        })

        it("throws a failure that may pass so the queue retries, and settles nothing", async () => {
            const { service, video, renderer, logger } = await build()
            const failure = new Error("ffmpeg crashed")
            renderer.render.mockRejectedValue(failure)

            await expect(service.render({ renderId: "render-1" })).rejects.toBe(failure)

            expect(video.failRender).not.toHaveBeenCalled()
            expect(logger.error).toHaveBeenCalledWith(VideoLogEvent.RenderFailed, failure, {
                renderId: "render-1",
                attempt: 1,
            })
        })

        it("fails the render on the last delivery and still throws", async () => {
            const { service, video, renderer, renders } = await build()
            const failure = new Error("ffmpeg crashed")
            renderer.render.mockRejectedValue(failure)
            renders.claim.mockResolvedValue(claimOf({ attempts: 5 }))

            await expect(service.render({ renderId: "render-1" })).rejects.toBe(failure)

            expect(video.failRender).toHaveBeenCalledWith("render-1", "ffmpeg crashed")
        })

        it("gives a failure that is no error a generic reason", async () => {
            const { service, video, renderer, renders } = await build()
            renderer.render.mockRejectedValue("boom")
            renders.claim.mockResolvedValue(claimOf({ attempts: 5 }))

            await expect(service.render({ renderId: "render-1" })).rejects.toBe("boom")

            expect(video.failRender).toHaveBeenCalledWith("render-1", "render failed")
        })

        it("retries a render whose files could not be uploaded", async () => {
            const { service, video, bucket } = await build()
            bucket.upload.mockResolvedValue({ data: null, error: new StorageApiError("down", 500, "500") })

            await expect(service.render({ renderId: "render-1" })).rejects.toMatchObject({
                code: VideoErrorCode.StorageFailed,
            })

            expect(video.completeRender).not.toHaveBeenCalled()
        })

        it("writes the progress of the renderer, at most one write per 2.5 seconds and only when the percent moved", async () => {
            const { service, renders, renderer, clock } = await build()
            renders.reportProgress.mockResolvedValue(undefined)
            renderer.render.mockImplementation(async (input: RenderInput) => {
                input.onProgress("tts", 100)
                input.onProgress("scenes", 50)
                clock.advance(3000)
                input.onProgress("scenes", 50)
                clock.advance(3000)
                input.onProgress("scenes", 60)
                clock.advance(3000)
                input.onProgress("encode", 50)
                await writeFile(join(input.workDir, "out.mp4"), "video")
                await writeFile(join(input.workDir, "poster.jpg"), "poster")
                return outputOf(input.workDir)
            })

            await service.render({ renderId: "render-1" })

            expect(renders.reportProgress.mock.calls).toEqual([
                ["render-1", 10, "tts"],
                ["render-1", 28, "scenes"],
                ["render-1", 31, "scenes"],
                ["render-1", 71, "encode"],
            ])
        })

        it("logs a progress write that failed and carries on", async () => {
            const { service, renders, renderer, logger } = await build()
            const failure = new Error("database busy")
            renders.reportProgress.mockRejectedValue(failure)
            renderer.render.mockImplementation(async (input: RenderInput) => {
                input.onProgress("tts", 100)
                await writeFile(join(input.workDir, "out.mp4"), "video")
                await writeFile(join(input.workDir, "poster.jpg"), "poster")
                return outputOf(input.workDir)
            })

            await service.render({ renderId: "render-1" })
            await Promise.resolve()

            expect(logger.error).toHaveBeenCalledWith(VideoLogEvent.ProgressNotRecorded, failure, {
                renderId: "render-1",
            })
        })
    })

    describe("onApplicationBootstrap", () => {
        it("removes the work directories of crashed renders older than an hour and keeps the others", async () => {
            const { service, options } = await build()
            await mkdir(join(options.workDir, "stale"), { recursive: true })
            await mkdir(join(options.workDir, "fresh"), { recursive: true })
            await utimes(
                join(options.workDir, "stale"),
                new Date("2026-10-11T00:00:00.000Z"),
                new Date("2026-10-11T00:00:00.000Z"),
            )
            await utimes(
                join(options.workDir, "fresh"),
                new Date("2026-10-11T23:50:00.000Z"),
                new Date("2026-10-11T23:50:00.000Z"),
            )

            await service.onApplicationBootstrap()

            expect(await has(options.workDir, "stale")).toBe(false)
            expect(await has(options.workDir, "fresh")).toBe(true)
        })

        it("logs a work directory it cannot list and carries on", async () => {
            const { service, logger } = await build()

            await service.onApplicationBootstrap()

            expect(logger.error).toHaveBeenCalledWith(VideoLogEvent.WorkDirUnreadable, expect.anything())
        })
    })
})
