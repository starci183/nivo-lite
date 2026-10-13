import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock } from "@starci/jest-preset"
import { FFMPEG, type Ffmpeg } from "@modules/integrations/ffmpeg"
import { TTS, TtsError, TtsErrorCode, type Tts } from "@modules/integrations/tts"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { VideoErrorCode } from "./errors/video.error"
import { RendererService } from "./renderer.service"
import type { RenderInput } from "./renderer.service"
import type { VideoAssets } from "./video.contracts"
import { VIDEO_ASSETS, VIDEO_OPTIONS } from "./video.decorators"
import type { VideoOptions } from "./video.options"
import type { Scene, VideoSpec } from "./video-spec.policy"

const WORKSPACE = "0a1b2c3d-0a1b-4c3d-8a1b-0a1b2c3d4e5f"
const IMAGE = `${WORKSPACE}/photo.jpg`
const LOGO = `${WORKSPACE}/logo.png`

const PRINTED = `{ "input_i" : "-20.0", "input_tp" : "-3.0", "input_lra" : "5.0", "input_thresh" : "-30.0", "target_offset" : "0.1" }`

const sceneOf = builder<Scene>({
    background: { type: "color", color: "#112233" },
    text: "",
    caption: "",
    voiceover: "",
    duration_s: 0,
    transition: "fade",
})

const specOf = builder<VideoSpec>({
    version: 1,
    aspect: "9:16",
    scenes: [sceneOf()],
    brand: { name: "Shop", primary: "#16a34a", secondary: "#0f172a", logo: null },
    music: null,
    voice: { enabled: true, name: "vi-VN-HoaiMyNeural", rate_pct: 0 },
    captions: true,
})

const build = async (maxSeconds = 90) => {
    const root = await mkdtemp(join(tmpdir(), "nivo-render-spec-"))
    const assets = mock<VideoAssets>()
    assets.download.mockImplementation((_bucket, path) =>
        Promise.resolve(
            path === "music/calm-glow.mp3"
                ? { data: new Blob(["music"]), error: null }
                : { data: null, error: new Error("Object not found") },
        ),
    )
    const options: VideoOptions = {
        fontsDir: join(root, "fonts"),
        workDir: join(root, "work"),
        maxSeconds,
        ffmpegThreads: 2,
    }
    const ffmpeg = mock<Ffmpeg>()
    ffmpeg.run.mockImplementation(async (_tool, args, run) => {
        const output = args[args.length - 1] ?? ""
        if (output.endsWith("out.mp4")) await writeFile(output, "video")
        run.onTime?.(5)
        return { stdout: "", stderr: PRINTED }
    })
    ffmpeg.probeDuration.mockResolvedValue(2)
    const tts = mock<Tts>({ enabled: true, providerId: "edge" })
    tts.clip.mockResolvedValue({ file: "clip.mp3", cached: false, provider: "edge" })
    const catalog = mock<MessageCatalog>()
    catalog.get.mockReturnValue("min|kg")
    const clock = new FakeClock("2026-10-12T00:00:00.000Z")
    const moduleRef = await Test.createTestingModule({
        providers: [
            RendererService,
            { provide: VIDEO_OPTIONS, useValue: options },
            { provide: VIDEO_ASSETS, useValue: assets },
            { provide: FFMPEG, useValue: ffmpeg },
            { provide: TTS, useValue: tts },
            { provide: CLOCK, useValue: clock },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()
    const renderer = moduleRef.get(RendererService)
    const progress: Array<string> = []
    const inputOf = (spec: VideoSpec, overrides: Partial<RenderInput> = {}): RenderInput => ({
        spec,
        workDir: join(root, "work", "render-1"),
        assets: new Map([
            [IMAGE, "asset0.jpg"],
            [LOGO, "asset1.png"],
        ]),
        signal: new AbortController().signal,
        attempt: 1,
        onProgress: (stage, percent) => progress.push(`${stage}:${percent}`),
        ...overrides,
    })
    return { renderer, ffmpeg, tts, assets, inputOf, progress, options }
}

describe("RendererService", () => {
    it("renders a spoken scene, a picture, a gradient card and a logo with music into an MP4 and a poster", async () => {
        const { renderer, ffmpeg, tts, assets, inputOf, progress, options } = await build()
        const spec = specOf({
            music: { track: "calm-glow", volume: 0.5 },
            brand: { name: "Shop", primary: "#16a34a", secondary: "#0f172a", logo: LOGO },
            scenes: [
                sceneOf({ voiceover: "Hello there", text: "Welcome" }),
                sceneOf({ background: { type: "gradient", from: "#000000", to: "#ffffff" }, duration_s: 3 }),
                sceneOf({ background: { type: "gradient", from: "#ffffff", to: "#000000" }, duration_s: 3 }),
                sceneOf({ background: { type: "image", src: IMAGE, motion: "zoom-in" }, caption: "Look" }),
            ],
        })

        const output = await renderer.render(inputOf(spec))

        expect(output).toMatchObject({ durationMs: 2000, sizeBytes: 5 })
        expect(assets.download).toHaveBeenCalledWith("media", "music/calm-glow.mp3")
        expect(await readFile(join(options.workDir, "render-1", "music-calm-glow.mp3"), "utf8")).toBe("music")
        expect(output.videoFile.endsWith("out.mp4")).toBe(true)
        expect(output.posterFile.endsWith("poster.jpg")).toBe(true)
        expect(output.meta).toMatchObject({
            width: 1080,
            height: 1920,
            fps: 30,
            scenes: 4,
            warnings: [],
            tts: { provider: "edge", requested: 1, failed: 0, cached: 0 },
            voiceover: "tts",
            music: "calm-glow",
            loudness: { target_lufs: -14, measured_lufs: -20, normalised: true },
        })
        expect(Object.keys(output.meta.timings)).toEqual(["tts_ms", "scenes_ms", "audio_ms", "encode_ms"])
        expect(tts.clip).toHaveBeenCalledWith("Hello there", "vi-VN-HoaiMyNeural", 0, expect.anything())
        expect(progress).toEqual(
            expect.arrayContaining([
                "tts:100",
                "scenes:25",
                "scenes:75",
                "scenes:100",
                "mix:100",
                "encode:42",
                "poster:100",
            ]),
        )
        expect(ffmpeg.run).toHaveBeenCalledTimes(4 + 3 + 1 + 1)
        const subs = await readFile(join(options.workDir, "render-1", "subs.ass"), "utf8")
        expect(subs).toContain("Dialogue: 1,0:00:00.15")
    })

    it("renders a silent video with no voice, no music and no loudness pass", async () => {
        const { renderer, ffmpeg, tts, inputOf } = await build()

        const output = await renderer.render(inputOf(specOf()))

        expect(output.meta).toMatchObject({
            voiceover: "none",
            music: null,
            loudness: { measured_lufs: null, normalised: false },
        })
        expect(tts.clip).not.toHaveBeenCalled()
        expect(ffmpeg.run).toHaveBeenCalledTimes(1 + 1 + 1 + 1 + 1)
    })

    it("falls back to captions only when the provider is off", async () => {
        const { renderer, tts, inputOf } = await build()
        Object.defineProperty(tts, "enabled", { value: false })

        const output = await renderer.render(inputOf(specOf({ scenes: [sceneOf({ voiceover: "Hello" })] })))

        expect(output.meta).toMatchObject({ warnings: ["tts_disabled", "captions_only"], voiceover: "captions_only" })
    })

    it("does not speak when the spec switches the voice off", async () => {
        const { renderer, tts, inputOf } = await build()
        const spec = specOf({
            voice: { enabled: false, name: "vi-VN-HoaiMyNeural", rate_pct: 0 },
            scenes: [sceneOf({ voiceover: "Hello" })],
        })

        const output = await renderer.render(inputOf(spec))

        expect(tts.clip).not.toHaveBeenCalled()
        expect(output.meta.warnings).toEqual(["captions_only"])
    })

    it("counts the clips that came from the cache", async () => {
        const { renderer, tts, inputOf } = await build()
        tts.clip.mockResolvedValue({ file: "clip.mp3", cached: true, provider: "edge" })

        const output = await renderer.render(inputOf(specOf({ scenes: [sceneOf({ voiceover: "Hello" })] })))

        expect(output.meta.tts).toMatchObject({ cached: 1 })
    })

    describe("when the voice fails", () => {
        const retryable = new TtsError({ code: TtsErrorCode.Retryable })
        const spoken = specOf({ scenes: [sceneOf({ voiceover: "One" }), sceneOf({ voiceover: "Two" })] })

        it("fails an early delivery with a retryable error so the queue tries again", async () => {
            const { renderer, tts, inputOf } = await build()
            tts.clip.mockRejectedValue(retryable)

            await expect(renderer.render(inputOf(spoken, { attempt: 2 }))).rejects.toBe(retryable)
        })

        it("degrades a late delivery to captions for the scenes whose voice failed", async () => {
            const { renderer, tts, inputOf } = await build()
            tts.clip
                .mockResolvedValueOnce({ file: "clip.mp3", cached: false, provider: "edge" })
                .mockRejectedValueOnce(retryable)

            const output = await renderer.render(inputOf(spoken, { attempt: 3 }))

            expect(output.meta).toMatchObject({
                warnings: ["tts_failed_scene_2"],
                tts: { requested: 2, failed: 1 },
                voiceover: "tts",
            })
        })

        it("degrades at once on a failure that a retry would not mend", async () => {
            const { renderer, tts, inputOf } = await build()
            tts.clip.mockRejectedValue(new TtsError({ code: TtsErrorCode.Disabled }))

            const output = await renderer.render(inputOf(spoken, { attempt: 1 }))

            expect(output.meta.warnings).toEqual(["tts_failed_scene_1", "tts_failed_scene_2", "captions_only"])
        })

        it("stops when the render was aborted", async () => {
            const { renderer, tts, inputOf } = await build()
            const abort = new AbortController()
            abort.abort()
            tts.clip.mockRejectedValue(new TtsError({ code: TtsErrorCode.Aborted }))

            await expect(renderer.render(inputOf(spoken, { signal: abort.signal, attempt: 5 }))).rejects.toMatchObject({
                code: TtsErrorCode.Aborted,
            })
        })
    })

    it("rejects a video that would run longer than the maximum", async () => {
        const { renderer, inputOf } = await build(10)
        const spec = specOf({ scenes: [sceneOf({ duration_s: 8 }), sceneOf({ duration_s: 8 })] })

        await expect(renderer.render(inputOf(spec))).rejects.toMatchObject({
            code: VideoErrorCode.RenderRejected,
            params: { reason: "video_too_long: 16 s (max 10 s)" },
        })
    })

    it("rejects a track the media bucket does not hold", async () => {
        const { renderer, inputOf } = await build()
        const spec = specOf({ music: { track: "bold-beat", volume: 0.5 } })

        await expect(renderer.render(inputOf(spec))).rejects.toMatchObject({
            code: VideoErrorCode.RenderRejected,
            params: { reason: "music_missing: bold-beat" },
        })
    })

    it("encodes without a logo the assets do not hold", async () => {
        const { renderer, ffmpeg, inputOf } = await build()
        const spec = specOf({ brand: { name: "Shop", primary: "#16a34a", secondary: "#0f172a", logo: LOGO } })

        await renderer.render(inputOf(spec, { assets: new Map() }))

        const final = ffmpeg.run.mock.calls.find((call) => call[1].includes("[v]"))
        expect(final?.[1].join(" ") ?? "").not.toContain("overlay")
    })
})
