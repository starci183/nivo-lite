import { mkdir, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { Injectable } from "@nestjs/common"
import { InjectFfmpeg } from "@modules/integrations/ffmpeg"
import type { Ffmpeg } from "@modules/integrations/ffmpeg"
import { InjectTts, TtsError, TtsErrorCode } from "@modules/integrations/tts"
import type { Tts } from "@modules/integrations/tts"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { eachInOrder } from "@modules/platform/primitives"
import { buildAss } from "./captions.policy"
import { VideoError, VideoErrorCode } from "./errors/video.error"
import { gradientPng } from "./gradient-png.policy"
import {
    aacArgs,
    audioFilterOf,
    captionCues,
    crossfadesOf,
    FPS,
    finalArgs,
    loudnessMeasureArgs,
    loudnessOf,
    loudnessReport,
    posterArgs,
    premixArgs,
    sceneArgs,
    sceneLengths,
    startsOf,
} from "./render-plan.policy"
import type { VoiceClip } from "./render-plan.policy"
import { InjectVideoOptions } from "./video.decorators"
import type { VideoOptions } from "./video.options"
import { aspectSize, MUSIC_TRACKS } from "./video-spec.policy"
import type { VideoSpec } from "./video-spec.policy"

/** What the renderer is doing, for the progress bar. */
export type RenderStage = "tts" | "scenes" | "mix" | "encode" | "poster"

/** One render: the validated spec, where to work and which local file holds each asset. */
export interface RenderInput {
    /** The validated spec. */
    readonly spec: VideoSpec
    /** The directory of this render; created if missing. */
    readonly workDir: string
    /** Bucket path ("<ws>/file") -> local file, for every asset the spec names. */
    readonly assets: ReadonlyMap<string, string>
    /** Aborts every ffmpeg run of the render. */
    readonly signal: AbortSignal
    /** Which delivery of the job this is; a voice failure fails the early deliveries (the queue retries them, the cache keeps the finished clips) and only degrades the late ones. */
    readonly attempt: number
    /** Reports the progress of a stage, 0..100. */
    readonly onProgress: (stage: RenderStage, percent: number) => void
}

/** How the voiceover of a render went. */
export interface TtsReport {
    /** The provider that spoke, or "none". */
    readonly provider: string
    /** Scenes that had words to speak. */
    readonly requested: number
    /** Scenes whose voice failed and fell back to captions. */
    readonly failed: number
    /** Scenes whose clip came from the cache. */
    readonly cached: number
}

/** What the loudness normalisation measured and did. */
export type LoudnessReport = Record<string, number | boolean | null>

/** The report a finished render keeps. */
export interface RenderMeta {
    /** Frame width in pixels. */
    readonly width: number
    /** Frame height in pixels. */
    readonly height: number
    /** Frames per second. */
    readonly fps: number
    /** Number of scenes. */
    readonly scenes: number
    /** Things that degraded the render, e.g. `captions_only`. */
    readonly warnings: ReadonlyArray<string>
    /** How the voiceover went. */
    readonly tts: TtsReport
    /** `none`, `tts` or `captions_only`. */
    readonly voiceover: string
    /** The music track, or null. */
    readonly music: string | null
    /** What the loudness normalisation measured and did. */
    readonly loudness: LoudnessReport
    /** Milliseconds per stage. */
    readonly timings: Record<string, number>
}

/** What a render produced. */
export interface RenderOutput {
    /** The MP4. */
    readonly videoFile: string
    /** The poster frame. */
    readonly posterFile: string
    /** Real length of the video in milliseconds. */
    readonly durationMs: number
    /** Size of the MP4 in bytes. */
    readonly sizeBytes: number
    /** What the render did, kept on the render row. */
    readonly meta: RenderMeta
}

/** The voice clips of a render and how they came about. */
interface Voiceover {
    readonly clips: ReadonlyArray<VoiceClip | null>
    readonly requested: number
    readonly failed: number
    readonly cached: number
}

/** The mixed audio of a render. */
interface MixedAudio {
    readonly file: string
    readonly loudness: LoudnessReport
}

/** Deliveries below this number fail on a voice error so the queue retries them; later ones fall back to captions only. */
const STRICT_TTS_ATTEMPTS = 3

/** The number at an index of a list, 0 when the list is shorter. */
const valueAt = (list: ReadonlyArray<number>, index: number): number =>
    list.slice(index, index + 1).reduce((sum, value) => sum + value, 0)

const voiceoverKind = (requested: number, clips: ReadonlyArray<VoiceClip | null>): string => {
    if (requested === 0) return "none"
    return clips.some((clip) => clip !== null) ? "tts" : "captions_only"
}

@Injectable()
/**
 * The whole render. Every ffmpeg call is bounded (lowered priority, a few threads, killed on abort):
 *   1. voiceover per scene (text to speech, cached): the real clip lengths decide the scene lengths
 *   2. one intermediate clip per scene (image with Ken Burns, trimmed video, colour or gradient card)
 *   3. audio: voices on a timeline, music ducked under them, two-pass loudness normalisation
 *   4. final pass: crossfades, brand logo, burned-in captions (libass), x264 with the prepared AAC, then a poster frame
 */
export class RendererService {
    constructor(
        @InjectVideoOptions() private readonly options: VideoOptions,
        @InjectFfmpeg() private readonly ffmpeg: Ffmpeg,
        @InjectTts() private readonly tts: Tts,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
    ) {}

    /** Renders the spec into an MP4 and a poster in the work directory. */
    async render(input: RenderInput): Promise<RenderOutput> {
        const { spec, workDir, signal } = input
        const size = aspectSize(spec.aspect)
        const timings: Record<string, number> = {}
        const warnings: Array<string> = []
        const lap = async <T>(name: string, work: () => Promise<T>): Promise<T> => {
            const began = this.clock.now().getTime()
            try {
                return await work()
            } finally {
                timings[name] = this.clock.now().getTime() - began
            }
        }
        await mkdir(workDir, { recursive: true })

        const voiced = await lap("tts_ms", () => this.voiceover(input, warnings))
        const lengths = sceneLengths(spec.scenes, voiced.clips)
        const total = lengths.reduce((sum, length) => sum + length, 0)
        if (total > this.options.maxSeconds + 0.5) {
            throw new VideoError({
                code: VideoErrorCode.RenderRejected,
                params: { reason: `video_too_long: ${Math.round(total)} s (max ${this.options.maxSeconds} s)` },
            })
        }
        const starts = startsOf(lengths)
        const crossfades = crossfadesOf(spec.scenes)

        const segments = await lap("scenes_ms", () =>
            this.scenes(
                input,
                lengths,
                crossfades.map((fade) => fade.seconds),
            ),
        )
        const audio = await lap("audio_ms", () => this.audio(input, voiced.clips, starts, total))
        input.onProgress("mix", 100)

        const units = new RegExp(`^(${this.catalog.get("video.captions.units", {}, "vi")})[.,!?]*$`, "iu")
        const cues = captionCues(
            spec,
            starts,
            lengths,
            voiced.clips.map((clip) => clip !== null),
        )
        await writeFile(join(workDir, "subs.ass"), buildAss(spec.aspect, cues, units), "utf8")

        const videoFile = join(workDir, "out.mp4")
        await lap("encode_ms", async () => {
            const logo = spec.brand.logo === null ? undefined : input.assets.get(spec.brand.logo)
            const args = finalArgs({
                spec,
                segments,
                audioFile: audio.file,
                logoFile: logo,
                starts,
                crossfades,
                total,
                threads: this.options.ffmpegThreads,
                fontsDir: join(this.options.assetsDir, "fonts"),
                output: videoFile,
            })
            await this.ffmpeg.run("ffmpeg", args, {
                signal,
                cwd: workDir,
                onTime: (seconds) => input.onProgress("encode", Math.min(99, Math.round((seconds / total) * 100))),
            })
        })

        const posterFile = join(workDir, "poster.jpg")
        await this.ffmpeg.run("ffmpeg", posterArgs(videoFile, valueAt(lengths, 0), total, size.width, posterFile), {
            signal,
            cwd: workDir,
        })
        input.onProgress("poster", 100)

        const sizeBytes = (await stat(videoFile)).size
        const duration = await this.ffmpeg.probeDuration(videoFile, signal)
        return {
            videoFile,
            posterFile,
            durationMs: Math.round(duration * 1000),
            sizeBytes,
            meta: {
                width: size.width,
                height: size.height,
                fps: FPS,
                scenes: spec.scenes.length,
                warnings,
                tts: {
                    provider: this.tts.providerId,
                    requested: voiced.requested,
                    failed: voiced.failed,
                    cached: voiced.cached,
                },
                voiceover: voiceoverKind(voiced.requested, voiced.clips),
                music: spec.music?.track ?? null,
                loudness: audio.loudness,
                timings,
            },
        }
    }

    /** Step 1: the voiceover clip of every scene that has words to speak. */
    private async voiceover(input: RenderInput, warnings: Array<string>): Promise<Voiceover> {
        const { spec, signal } = input
        const clips: Array<VoiceClip | null> = spec.scenes.map(() => null)
        const requested = spec.scenes.filter((scene) => scene.voiceover !== "").length
        let failed = 0
        let cached = 0
        if (requested > 0 && spec.voice.enabled) {
            if (!this.tts.enabled) warnings.push("tts_disabled")
            else {
                let done = 0
                await eachInOrder(spec.scenes, async (scene, index) => {
                    if (scene.voiceover === "") return
                    try {
                        const clip = await this.tts.clip(scene.voiceover, spec.voice.name, spec.voice.rate_pct, signal)
                        if (clip.cached) cached++
                        clips[index] = { file: clip.file, seconds: await this.ffmpeg.probeDuration(clip.file, signal) }
                    } catch (cause) {
                        const retryable = cause instanceof TtsError && cause.code === TtsErrorCode.Retryable
                        if (signal.aborted || (retryable && input.attempt < STRICT_TTS_ATTEMPTS)) throw cause
                        failed++
                        warnings.push(`tts_failed_scene_${index + 1}`)
                    }
                    input.onProgress("tts", Math.round((++done / requested) * 100))
                })
            }
        }
        if (requested > 0 && !clips.some((clip) => clip !== null)) warnings.push("captions_only")
        return { clips, requested, failed, cached }
    }

    /** Step 2: one silent clip per scene, each as long as its scene plus the crossfade that follows. */
    private async scenes(
        input: RenderInput,
        lengths: ReadonlyArray<number>,
        fades: ReadonlyArray<number>,
    ): Promise<Array<string>> {
        const { spec, workDir, signal } = input
        const size = aspectSize(spec.aspect)
        const files: Array<string> = []
        await eachInOrder(spec.scenes, async (scene, index) => {
            const output = join(workDir, `seg${index}.mp4`)
            const gradientFile = join(workDir, `grad${index}.png`)
            if (scene.background.type === "gradient") {
                const direction = index % 2 === 0 ? "vertical" : "diagonal"
                await writeFile(gradientFile, gradientPng(scene.background.from, scene.background.to, direction))
            }
            const args = sceneArgs({
                scene,
                length: valueAt(lengths, index) + valueAt(fades, index),
                size,
                assets: input.assets,
                output,
                threads: this.options.ffmpegThreads,
                gradientFile,
            })
            await this.ffmpeg.run("ffmpeg", args, { signal, cwd: workDir })
            files.push(output)
            input.onProgress("scenes", Math.round(((index + 1) / spec.scenes.length) * 100))
        })
        return files
    }

    /** The bundled file of the track the spec names, null for none; a track whose file is missing is a rejected render. */
    private async musicFileOf(spec: VideoSpec): Promise<string | null> {
        const track = MUSIC_TRACKS.find((candidate) => candidate.id === spec.music?.track)
        if (track === undefined) return null
        const file = join(this.options.assetsDir, "music", `${track.id}.mp3`)
        await stat(file).catch((cause: unknown) => {
            throw new VideoError({
                code: VideoErrorCode.RenderRejected,
                params: { reason: `music_missing: ${track.id}` },
                cause,
            })
        })
        return file
    }

    /** Step 3: voices on a timeline, music ducked under them, two-pass loudness normalisation. */
    private async audio(
        input: RenderInput,
        clips: ReadonlyArray<VoiceClip | null>,
        starts: ReadonlyArray<number>,
        total: number,
    ): Promise<MixedAudio> {
        const { spec, workDir, signal } = input
        const musicFile = await this.musicFileOf(spec)
        const voices = clips.flatMap((clip, index) =>
            clip === null ? [] : [{ file: clip.file, start: valueAt(starts, index) }],
        )
        const premix = join(workDir, "premix.wav")
        const output = join(workDir, "audio.m4a")
        await this.ffmpeg.run(
            "ffmpeg",
            premixArgs({ voices, musicFile, musicVolume: spec.music?.volume ?? 0, total, output: premix }),
            { signal, cwd: workDir },
        )
        // Pass 1 measures, pass 2 applies the measured values (linear, exact target). A silent mix is only encoded.
        const measured =
            voices.length > 0 || musicFile !== null
                ? loudnessOf(
                      (await this.ffmpeg.run("ffmpeg", loudnessMeasureArgs(premix), { signal, cwd: workDir })).stderr,
                  )
                : null
        const filter = audioFilterOf(measured)
        await this.ffmpeg.run("ffmpeg", aacArgs(premix, filter.filter, output), { signal, cwd: workDir })
        return { file: output, loudness: loudnessReport(measured, filter.normalised) }
    }
}
