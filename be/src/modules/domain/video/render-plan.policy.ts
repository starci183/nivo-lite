import { frameFilter } from "./brand-frame.policy"
import { luminance } from "./captions.policy"
import type { TextCue } from "./captions.policy"
import { VideoError, VideoErrorCode } from "./errors/video.error"
import { aspectSize, estimateSceneSeconds } from "./video-spec.policy"
import type { FrameSize, Motion, Scene, Transition, VideoSpec } from "./video-spec.policy"

/** Frames per second of every clip. */
export const FPS = 30

/** Seconds after a scene starts before its voiceover begins. */
export const VOICE_LEAD = 0.25

/** Integrated loudness the audio is normalised to, in LUFS: the TikTok / Reels / Zalo norm. */
const LOUDNESS_I = -14
const LOUDNESS_TP = -1.5
const LOUDNESS_TARGET = `I=${LOUDNESS_I}:TP=${LOUDNESS_TP}:LRA=11`

/** One voiceover clip on disk and its measured length. */
export interface VoiceClip {
    /** The audio file. */
    readonly file: string
    /** Its length in seconds. */
    readonly seconds: number
}

/** How a scene leaves into the next one: the xfade filter name and its length. */
export interface Crossfade {
    /** The ffmpeg xfade transition. */
    readonly name: string
    /** Seconds the two scenes overlap. */
    readonly seconds: number
}

/** What loudnorm measured on the premix. */
export interface Loudness {
    /** Integrated loudness in LUFS. */
    readonly input_i: number
    /** True peak in dBTP. */
    readonly input_tp: number
    /** Loudness range in LU. */
    readonly input_lra: number
    /** Gate threshold in LUFS. */
    readonly input_thresh: number
    /** The offset to reach the target. */
    readonly target_offset: number
}

/** The audio filter of the final encode and whether it is the measured, linear loudness normalisation. */
export interface AudioFilter {
    /** The ffmpeg `-af` value. */
    readonly filter: string
    /** True when the loudness was measured and applied. */
    readonly normalised: boolean
}

const CROSSFADES: Record<Exclude<Transition, "none">, Crossfade> = {
    fade: { name: "fade", seconds: 0.5 },
    slide: { name: "slideleft", seconds: 0.45 },
    wipe: { name: "wipeleft", seconds: 0.45 },
    zoom: { name: "zoomin", seconds: 0.5 },
}

const hex0x = (color: string): string => `0x${color.slice(1)}`
const fixed = (value: number): string => value.toFixed(3)

/** Seconds each scene is shown: its own duration, else the voice clip plus a lead, else the reading time. */
export const sceneLengths = (scenes: ReadonlyArray<Scene>, voice: ReadonlyArray<VoiceClip | null>): Array<number> =>
    scenes.map((scene, index) => {
        const clip = voice[index] ?? null
        if (scene.duration_s > 0) return Math.max(scene.duration_s, clip ? clip.seconds + VOICE_LEAD + 0.4 : 0)
        if (clip) return Math.max(2.5, clip.seconds + VOICE_LEAD + 0.7)
        return estimateSceneSeconds(scene)
    })

/** The second each scene starts at. */
export const startsOf = (lengths: ReadonlyArray<number>): Array<number> =>
    lengths.map((_length, index) => lengths.slice(0, index).reduce((sum, length) => sum + length, 0))

/** How each scene leaves into the next; the last one has no next. */
export const crossfadesOf = (scenes: ReadonlyArray<Scene>): Array<Crossfade> =>
    scenes.map((scene, index) => {
        if (index === scenes.length - 1) return { name: "fade", seconds: 0 }
        return scene.transition === "none" ? { name: "fade", seconds: 0.04 } : CROSSFADES[scene.transition]
    })

const rejected = (reason: string): VideoError =>
    new VideoError({ code: VideoErrorCode.RenderRejected, params: { reason } })

const motionOf = (motion: Motion, frames: number): string => {
    const centre = "x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
    const motions: Record<Motion, string> = {
        "zoom-in": `z='1+0.14*on/${frames}':${centre}`,
        "zoom-out": `z='1.14-0.14*on/${frames}':${centre}`,
        "pan-left": `z=1.15:x='(iw-iw/zoom)*(1-on/${frames})':y='ih/2-(ih/zoom/2)'`,
        "pan-right": `z=1.15:x='(iw-iw/zoom)*on/${frames}':y='ih/2-(ih/zoom/2)'`,
        none: `z=1:${centre}`,
    }
    return motions[motion]
}

/** What `sceneArgs` needs to draw one scene's silent clip. */
export interface SceneClip {
    /** The scene. */
    readonly scene: Scene
    /** Seconds of the clip, transition included. */
    readonly length: number
    /** The frame size. */
    readonly size: FrameSize
    /** Bucket path -> local file, for every asset the spec names. */
    readonly assets: ReadonlyMap<string, string>
    /** The clip to write. */
    readonly output: string
    /** ffmpeg threads. */
    readonly threads: number
    /** The gradient PNG the caller wrote for a gradient scene. */
    readonly gradientFile: string
}

/** The ffmpeg arguments of one scene's silent clip: an image with Ken Burns, a trimmed video, a colour or a gradient card. */
export const sceneArgs = (clip: SceneClip): Array<string> => {
    const { scene, length, size, assets, output, threads } = clip
    const { width, height } = size
    const encode = [
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-r",
        String(FPS),
        "-g",
        String(FPS),
        "-threads",
        String(threads),
        "-t",
        fixed(length),
        output,
    ]
    const background = scene.background
    const local = (path: string): string => {
        const file = assets.get(path)
        if (file === undefined) throw rejected(`asset_missing: ${path}`)
        return file
    }
    if (background.type === "color") {
        return [
            "-f",
            "lavfi",
            "-i",
            `color=c=${hex0x(background.color)}:s=${width}x${height}:r=${FPS}:d=${fixed(length)}`,
            ...encode,
        ]
    }
    if (background.type === "gradient") {
        // The gradient is a small PNG scaled up smoothly: the lavfi gradients source ignores its line for some sizes.
        const filter = `scale=${width}:${height}:flags=bicubic,setsar=1,format=yuv420p`
        return ["-loop", "1", "-framerate", String(FPS), "-i", clip.gradientFile, "-vf", filter, ...encode]
    }
    if (background.type === "video") {
        const filter = `fps=${FPS},scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,format=yuv420p`
        return [
            "-ss",
            fixed(background.start_s),
            "-stream_loop",
            "-1",
            "-i",
            local(background.src),
            "-vf",
            filter,
            ...encode,
        ]
    }
    // image: Ken Burns. The source is scaled to 1.5x the frame so zoompan's whole-pixel crops do not jitter.
    const scaledWidth = Math.round((width * 1.5) / 2) * 2
    const scaledHeight = Math.round((height * 1.5) / 2) * 2
    const frames = Math.max(2, Math.round(length * FPS))
    const filter = `scale=${scaledWidth}:${scaledHeight}:force_original_aspect_ratio=increase:flags=lanczos,crop=${scaledWidth}:${scaledHeight},setsar=1,zoompan=${motionOf(background.motion, frames)}:d=${frames}:s=${width}x${height}:fps=${FPS},format=yuv420p`
    return ["-i", local(background.src), "-vf", filter, ...encode]
}

/** What `premixArgs` mixes. */
export interface Premix {
    /** The voice clips and the second of the scene each one belongs to. */
    readonly voices: ReadonlyArray<{ readonly file: string; readonly start: number }>
    /** The music file, or null for none. */
    readonly musicFile: string | null
    /** The spec music volume. */
    readonly musicVolume: number
    /** Seconds of the whole video. */
    readonly total: number
    /** The WAV to write. */
    readonly output: string
}

/** The ffmpeg arguments that place the voices on a timeline and duck the music under them; a silent stereo track when there is neither. */
export const premixArgs = (mix: Premix): Array<string> => {
    const format = "aformat=sample_rates=44100:channel_layouts=stereo"
    const hasVoice = mix.voices.length > 0
    const inputs = [
        ...mix.voices.flatMap((voice) => ["-i", voice.file]),
        ...(mix.musicFile === null ? [] : ["-stream_loop", "-1", "-i", mix.musicFile]),
    ]
    const graph: Array<string> = []
    mix.voices.forEach((voice, index) => {
        const ms = Math.round((voice.start + VOICE_LEAD) * 1000)
        graph.push(`[${index}:a]${format},adelay=${ms}|${ms}[v${index}]`)
    })
    if (hasVoice) {
        const labels = mix.voices.map((_voice, index) => `[v${index}]`).join("")
        graph.push(
            `${labels}amix=inputs=${mix.voices.length}:normalize=0:dropout_transition=0,apad=whole_dur=${fixed(mix.total)},atrim=0:${fixed(mix.total)}[voice]`,
        )
    }
    if (mix.musicFile !== null) {
        const volume = (mix.musicVolume * (hasVoice ? 0.55 : 0.9)).toFixed(3)
        graph.push(
            `[${mix.voices.length}:a]${format},atrim=0:${fixed(mix.total)},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=1,afade=t=out:st=${fixed(Math.max(0, mix.total - 2))}:d=2,volume=${volume}[music]`,
        )
    }
    let label = "silent"
    if (hasVoice && mix.musicFile !== null) {
        graph.push(
            "[voice]asplit=2[vm][vk]",
            "[music][vk]sidechaincompress=threshold=0.02:ratio=12:attack=10:release=450:makeup=1[duck]",
            "[vm][duck]amix=inputs=2:normalize=0:duration=first[mix]",
        )
        label = "mix"
    } else if (hasVoice) label = "voice"
    else if (mix.musicFile !== null) label = "music"
    else {
        // No voice, no music: a silent stereo track (some platforms reject a video without audio).
        inputs.push("-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo")
        graph.push(`[0:a]atrim=0:${fixed(mix.total)}[silent]`)
    }
    return [
        ...inputs,
        "-filter_complex",
        graph.join(";"),
        "-map",
        `[${label}]`,
        "-t",
        fixed(mix.total),
        "-c:a",
        "pcm_s16le",
        "-ar",
        "44100",
        mix.output,
    ]
}

/** The first loudness pass: measure the premix. */
export const loudnessMeasureArgs = (premix: string): Array<string> => [
    "-i",
    premix,
    "-af",
    `loudnorm=${LOUDNESS_TARGET}:print_format=json`,
    "-f",
    "null",
    "-",
]

const readMeasured = (block: string, key: string): number => {
    const match = new RegExp(String.raw`"${key}"\s*:\s*"?(-?[0-9.]+|-?inf)"?`, "u").exec(block)
    return match?.[1] === undefined ? Number.NaN : Number(match[1])
}

/** The loudness the first pass printed in its stderr, or null when it printed none that can be used. */
export const loudnessOf = (stderr: string): Loudness | null => {
    const start = stderr.indexOf("{")
    const target = stderr.indexOf('"target_offset"', Math.max(0, start))
    const end = target < 0 ? -1 : stderr.indexOf("}", target)
    const block = start >= 0 && target > start && end >= 0 ? stderr.slice(start, end + 1) : undefined
    if (block === undefined) return null
    const measured = {
        input_i: readMeasured(block, "input_i"),
        input_tp: readMeasured(block, "input_tp"),
        input_lra: readMeasured(block, "input_lra"),
        input_thresh: readMeasured(block, "input_thresh"),
        target_offset: readMeasured(block, "target_offset"),
    }
    const usable = Object.values(measured).every((value) => Number.isFinite(value)) && measured.input_i > -70
    return usable ? measured : null
}

/** The audio filter of the final encode: the measured, linear loudness normalisation, or a plain resample. */
export const audioFilterOf = (measured: Loudness | null): AudioFilter => {
    if (measured === null) return { filter: "aresample=44100", normalised: false }
    return {
        filter: `loudnorm=${LOUDNESS_TARGET}:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true,aresample=44100`,
        normalised: true,
    }
}

/** The second pass: encode the premix to AAC with the filter. */
export const aacArgs = (premix: string, filter: string, output: string): Array<string> => [
    "-i",
    premix,
    "-af",
    filter,
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-ar",
    "44100",
    output,
]

/** The loudness report the render keeps in its meta. */
export const loudnessReport = (
    measured: Loudness | null,
    normalised: boolean,
): Record<string, number | boolean | null> => ({
    target_lufs: LOUDNESS_I,
    measured_lufs: measured?.input_i ?? null,
    measured_tp: measured?.input_tp ?? null,
    normalised,
})

const isLight = (scene: Scene): boolean => {
    const background = scene.background
    if (background.type === "color") return luminance(background.color) > 0.55
    if (background.type === "gradient") return (luminance(background.from) + luminance(background.to)) / 2 > 0.55
    return false
}

/** The caption of a scene: its own, or in captions-only mode (the voice failed) the spoken text instead of an empty caption. */
const captionOf = (scene: Scene, voiced: boolean): string => {
    if (scene.caption !== "") return scene.caption
    return scene.voiceover !== "" && !voiced ? scene.voiceover : ""
}

/** The burned-in text of the video: the brand over everything, a headline and a caption per scene (the spoken words when the voice failed). */
export const captionCues = (
    spec: VideoSpec,
    starts: ReadonlyArray<number>,
    lengths: ReadonlyArray<number>,
    hasVoice: ReadonlyArray<boolean>,
): Array<TextCue> => {
    const total = lengths.reduce((sum, length) => sum + length, 0)
    const cues: Array<TextCue> =
        spec.brand.name === "" ? [] : [{ start: 0, end: total, text: spec.brand.name, kind: "brand" }]
    spec.scenes.forEach((scene, index) => {
        const start = starts[index] ?? 0
        const end = start + (lengths[index] ?? 0)
        if (scene.text !== "")
            cues.push({ start: start + 0.15, end, text: scene.text, kind: "headline", light: isLight(scene) })
        const caption = captionOf(scene, hasVoice[index] === true)
        if (spec.captions && caption !== "") {
            cues.push({ start: start + 0.2, end: Math.max(start + 0.8, end - 0.1), text: caption, kind: "caption" })
        }
    })
    return cues
}

/** What `finalArgs` encodes. */
export interface FinalPass {
    /** The spec. */
    readonly spec: VideoSpec
    /** One silent clip per scene. */
    readonly segments: ReadonlyArray<string>
    /** The AAC audio. */
    readonly audioFile: string
    /** The local logo file, or undefined. */
    readonly logoFile: string | undefined
    /** The second each scene starts at. */
    readonly starts: ReadonlyArray<number>
    /** How each scene leaves into the next. */
    readonly crossfades: ReadonlyArray<Crossfade>
    /** Seconds of the whole video. */
    readonly total: number
    /** ffmpeg threads. */
    readonly threads: number
    /** The directory libass reads the fonts from. */
    readonly fontsDir: string
    /** The MP4 to write. */
    readonly output: string
}

/** The final ffmpeg pass: crossfades, brand logo, the brand frame, burned-in captions (libass), x264 and the prepared AAC. */
export const finalArgs = (pass: FinalPass): Array<string> => {
    const { width, height } = aspectSize(pass.spec.aspect)
    // One decoder thread per intermediate: frame-threaded decoders of 4+ inputs were the memory peak.
    const inputs = pass.segments.flatMap((file) => ["-threads", "1", "-i", file])
    const audioIndex = pass.segments.length
    inputs.push("-i", pass.audioFile)
    const logoIndex = pass.logoFile === undefined ? -1 : audioIndex + 1
    if (pass.logoFile !== undefined) inputs.push("-loop", "1", "-framerate", String(FPS), "-i", pass.logoFile)
    const graph: Array<string> = []
    let last = "0:v"
    for (let index = 1; index < pass.segments.length; index++) {
        const fade = pass.crossfades[index - 1] ?? { name: "fade", seconds: 0 }
        graph.push(
            `[${last}][${index}:v]xfade=transition=${fade.name}:duration=${fixed(fade.seconds)}:offset=${fixed(pass.starts[index] ?? 0)}[x${index}]`,
        )
        last = `x${index}`
    }
    if (logoIndex >= 0) {
        const logoWidth = Math.round(Math.min(width, height) * 0.17)
        const margin = Math.round(Math.min(width, height) * 0.045)
        const top = Math.round(height * (pass.spec.aspect === "9:16" ? 0.05 : 0.035))
        graph.push(
            `[${logoIndex}:v]scale=${logoWidth}:-1:force_original_aspect_ratio=decrease,format=rgba[lg]`,
            `[${last}][lg]overlay=${margin}:${top}:shortest=1[lo]`,
        )
        last = "lo"
    }
    if (pass.spec.brand.frame === true) {
        graph.push(frameFilter(last, pass.spec.brand.primary, pass.spec.brand.secondary, Math.min(width, height)))
        last = "fr"
    }
    graph.push(`[${last}]ass=subs.ass:fontsdir=${pass.fontsDir},format=yuv420p[v]`)
    return [
        ...inputs,
        "-filter_complex",
        graph.join(";"),
        "-map",
        "[v]",
        "-map",
        `${audioIndex}:a`,
        "-t",
        fixed(pass.total),
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "22",
        "-maxrate",
        "3500k",
        "-bufsize",
        "7000k",
        "-profile:v",
        "high",
        "-pix_fmt",
        "yuv420p",
        "-r",
        String(FPS),
        "-c:a",
        "copy",
        "-movflags",
        "+faststart",
        "-threads",
        String(pass.threads),
        "-filter_threads",
        "2",
        "-filter_complex_threads",
        "2",
        pass.output,
    ]
}

/** The ffmpeg arguments of the poster frame: a still of the first scene. */
export const posterArgs = (
    video: string,
    firstLength: number,
    total: number,
    width: number,
    output: string,
): Array<string> => {
    const at = Math.min(total - 0.1, Math.min(1.4, firstLength * 0.6))
    return [
        "-ss",
        fixed(at),
        "-i",
        video,
        "-frames:v",
        "1",
        "-vf",
        `scale=${Math.min(width, 720)}:-2`,
        "-q:v",
        "3",
        output,
    ]
}
