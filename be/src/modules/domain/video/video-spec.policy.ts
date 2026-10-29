/**
 * The video render spec: ONE JSON document describes a whole short video. This policy validates and normalises untrusted input before a
 * render is queued and again before it is rendered (the queue is never trusted). It is pure: no I/O, no clock.
 *
 * Contract summary
 *   - 1..20 scenes, total length 3..90 s.
 *   - A scene background is an image or a video from the workspace `media` bucket, a solid colour, or a gradient.
 *   - Per scene: `caption` (burned in, bottom), `text` (big headline, centred), `voiceover` (Vietnamese text to speech).
 *   - `transition` is how this scene LEAVES into the next one (ignored on the last scene).
 *   - Assets are named by their path inside the bucket `media` ("<workspace_id>/<file>") or by a Supabase Storage URL of that bucket;
 *     the validator normalises both to the bare path and refuses any path outside the workspace folder.
 */

/** The version of the spec document. */
export const VIDEO_SPEC_VERSION = 1

/** The longest video in seconds. */
export const VIDEO_MAX_SECONDS = 90

/** The most scenes in one video. */
export const VIDEO_MAX_SCENES = 20

/** The output shapes: vertical, square and wide. */
export const ASPECTS = ["9:16", "1:1", "16:9"] as const

/** One of the output shapes. */
export type Aspect = (typeof ASPECTS)[number]

/** How a scene leaves into the next one. */
export const TRANSITIONS = ["fade", "slide", "wipe", "zoom", "none"] as const

/** One of the scene transitions. */
export type Transition = (typeof TRANSITIONS)[number]

/** How a still image moves (Ken Burns). */
export const MOTIONS = ["zoom-in", "zoom-out", "pan-left", "pan-right", "none"] as const

/** One of the image motions. */
export type Motion = (typeof MOTIONS)[number]

/** Royalty-free tracks synthesised for NIVO (CC0, uploaded to the media bucket by `cli seed-media upload`, see be/docs/guides/asset-licenses.md). */
export const MUSIC_TRACKS = [
    { id: "sunny-pop", bpm: 112 },
    { id: "calm-glow", bpm: 72 },
    { id: "bold-beat", bpm: 124 },
] as const

/** The id of one bundled music track. */
export type MusicTrackId = (typeof MUSIC_TRACKS)[number]["id"]

/** The folder of the music beds in the media bucket; `cli seed-media upload` writes them there, the renderer reads them. */
export const MUSIC_FOLDER = "music"

/** The object path of a music bed in the media bucket. */
export const musicObjectPath = (track: string): string => `${MUSIC_FOLDER}/${track}.mp3`

/** The voices the text to speech offers. */
export const TTS_VOICES = ["vi-VN-HoaiMyNeural", "vi-VN-NamMinhNeural"] as const

/** One of the voices. */
export type TtsVoice = (typeof TTS_VOICES)[number]

/** The private bucket of the images, videos and logos a workspace uploads. */
export const MEDIA_BUCKET = "media"

/** The private bucket of the rendered videos and their posters. */
export const VIDEOS_BUCKET = "videos"

/** The biggest asset one render reads, in bytes. */
export const MEDIA_MAX_BYTES = 50 * 1024 * 1024

/** What a scene shows behind its words. */
export type SceneBackground =
    | { readonly type: "image"; readonly src: string; readonly motion: Motion }
    | { readonly type: "video"; readonly src: string; readonly start_s: number }
    | { readonly type: "color"; readonly color: string }
    | { readonly type: "gradient"; readonly from: string; readonly to: string }

/** One scene of the video. */
export interface Scene {
    /** The picture, clip, colour or gradient behind the words. */
    readonly background: SceneBackground
    /** Big centred headline (cards). Optional on any scene. */
    readonly text: string
    /** Burned-in caption near the bottom. */
    readonly caption: string
    /** Spoken in Vietnamese by the text to speech. Empty = silent scene. */
    readonly voiceover: string
    /** Seconds the scene is shown; 0 = automatic (voiceover length, else reading time of the text). 1.5..15 otherwise. */
    readonly duration_s: number
    /** How this scene leaves into the next one. */
    readonly transition: Transition
}

/** The brand shown in the video. */
export interface Brand {
    /** The shop name shown at the top. */
    readonly name: string
    /** The accent colour, #rrggbb. */
    readonly primary: string
    /** The second colour, #rrggbb. */
    readonly secondary: string
    /** Path of a logo (png/jpg/webp with transparency welcome) in the `media` bucket, or null. */
    readonly logo: string | null
    /** True when every frame carries the brand frame (a primary border with a secondary inner line); absent = no frame. */
    readonly frame?: boolean
}

/** The background music of a video. */
export interface SpecMusic {
    /** The bundled track. */
    readonly track: MusicTrackId
    /** Its volume, 0.05..1. */
    readonly volume: number
}

/** The voiceover settings of a video. */
export interface SpecVoice {
    /** Whether the scenes are read aloud. */
    readonly enabled: boolean
    /** The voice. */
    readonly name: TtsVoice
    /** The speaking rate relative to normal, in percent. */
    readonly rate_pct: number
}

/** The whole spec of one video. */
export interface VideoSpec {
    /** The spec version. */
    readonly version: 1
    /** The output shape. */
    readonly aspect: Aspect
    /** The scenes in order. */
    readonly scenes: ReadonlyArray<Scene>
    /** The brand. */
    readonly brand: Brand
    /** The background music, or null for none. */
    readonly music: SpecMusic | null
    /** The voiceover settings. */
    readonly voice: SpecVoice
    /** Whether captions are burned in. */
    readonly captions: boolean
}

/** The pixel size of a frame. */
export interface FrameSize {
    /** Width in pixels. */
    readonly width: number
    /** Height in pixels. */
    readonly height: number
}

/** What a spec is validated against: the workspace whose media folder every asset path must stay in. */
export interface SpecScope {
    /** The workspace; without it any workspace folder is accepted. */
    readonly workspaceId?: string
}

/** What validating a spec answers: the normalised spec, or the list of problems. */
export type SpecResult =
    { readonly ok: true; readonly spec: VideoSpec } | { readonly ok: false; readonly errors: ReadonlyArray<string> }

const DEFAULT_COLOR = "#222222"
const DEFAULT_PRIMARY = "#16a34a"
const DEFAULT_SECONDARY = "#0f172a"
const DEFAULT_VOICE: TtsVoice = "vi-VN-HoaiMyNeural"
const MEDIA_URL =
    /\/storage\/v1\/object\/(?:sign\/|authenticated\/|public\/)?media\/(.+)$|^\/[a-z0-9][a-z0-9-]*-media\/(.+)$/u
const WORKSPACE_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/.+/iu
const HEX_COLOR = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/iu

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** Every control character but the tab and the line feed (a carriage return goes with them). */
const CONTROL = /(?![\t\n])\p{Cc}/gu

/** Text without control characters, trimmed and cut to `max`. */
const clean = (value: unknown, max: number): string =>
    typeof value === "string" ? value.replace(CONTROL, "").trim().slice(0, max) : ""

/** #RGB or #RRGGBB (any case) -> #rrggbb lower case, or null. */
export const normaliseColor = (value: unknown): string | null => {
    if (typeof value !== "string") return null
    const match = HEX_COLOR.exec(value.trim())
    if (match === null) return null
    const hex = match.slice(1).join("").toLowerCase()
    return `#${hex.length === 3 ? [...hex].map((char) => char + char).join("") : hex}`
}

const PERCENT_RUN = /(?:%[0-9a-f]{2})+/giu
const MALFORMED_PERCENT = /%(?![0-9a-f]{2})/iu

/** Decodes percent escapes the way a browser reads a path; bytes that are not UTF-8 become the replacement character, which no asset path has. */
const decodePath = (text: string): string =>
    text.replace(PERCENT_RUN, (run) =>
        new TextDecoder().decode(
            Uint8Array.from(
                run
                    .split("%")
                    .slice(1)
                    .map((hex) => Number.parseInt(hex, 16)),
            ),
        ),
    )

const urlPath = (value: string): string | null => {
    if (!URL.canParse(value)) return null
    const found = MEDIA_URL.exec(new URL(value).pathname)
    const tail = found?.[1] ?? found?.[2]
    if (tail === undefined || MALFORMED_PERCENT.test(tail)) return null
    return decodePath(tail)
}

const UNSAFE_CHARACTER = /[\p{Cc}\\]/u

const hasUnsafeSegment = (path: string): boolean =>
    path.split("/").some((segment) => segment === ".." || segment === "." || segment === "") ||
    UNSAFE_CHARACTER.test(path)

/**
 * An asset reference -> the bare path inside the `media` bucket, or null. Accepts the path itself or a storage URL: the S3 form
 * (https://host/<prefix>-media/<path>?signature) or the old Supabase form (.../storage/v1/object/{sign|authenticated|public}/media/<path>[?token]). `workspaceId` (when given) must be the first path segment.
 */
export const mediaPathOf = (value: unknown, workspaceId?: string): string | null => {
    if (typeof value !== "string") return null
    const trimmed = value.trim()
    const raw = /^https?:\/\//iu.test(trimmed) ? urlPath(trimmed) : trimmed
    if (raw === null) return null
    const path = raw.replace(/^\/+/u, "")
    if (path === "" || path.length > 300 || hasUnsafeSegment(path) || !WORKSPACE_PATH.test(path)) return null
    if (workspaceId !== undefined && !path.toLowerCase().startsWith(`${workspaceId.toLowerCase()}/`)) return null
    return path
}

const numeric = (value: unknown): number => {
    if (typeof value === "number") return value
    return typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN
}

const number = (value: unknown, fallback: number, min: number, max: number): number => {
    const parsed = numeric(value)
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
}

const pick = <T extends string>(value: unknown, allowed: ReadonlyArray<T>, fallback: T): T =>
    allowed.find((candidate) => candidate === value) ?? fallback

/** Rough reading/speaking time, used for the length estimate only (the renderer measures the real voice). */
export const estimateSceneSeconds = (scene: Pick<Scene, "caption" | "text" | "voiceover" | "duration_s">): number => {
    if (scene.duration_s > 0) return scene.duration_s
    const spoken = scene.voiceover.length / 14 + 0.8
    const read = (scene.caption.length + scene.text.length) / 16 + 1.2
    return Math.min(15, Math.max(2.5, spoken, read, 3))
}

/** Output pixel size for an aspect (1080 on the short side for 9:16 and 1:1, 1080p for 16:9). */
export const aspectSize = (aspect: Aspect): FrameSize => {
    if (aspect === "9:16") return { width: 1080, height: 1920 }
    if (aspect === "1:1") return { width: 1080, height: 1080 }
    return { width: 1920, height: 1080 }
}

const BACKGROUND_TYPES = ["image", "video", "color", "gradient"] as const

const backgroundOf = (
    raw: unknown,
    where: string,
    errors: Array<string>,
    assetPath: (value: unknown, where: string) => string,
): SceneBackground => {
    const bg = isObject(raw) ? raw : {}
    const type = pick(bg.type, BACKGROUND_TYPES, "color")
    if (!isObject(raw) || bg.type !== type)
        errors.push(`${where}.background.type must be image, video, color or gradient`)
    if (type === "image") {
        return { type, src: assetPath(bg.src, `${where}.background.src`), motion: pick(bg.motion, MOTIONS, "zoom-in") }
    }
    if (type === "video") {
        return { type, src: assetPath(bg.src, `${where}.background.src`), start_s: number(bg.start_s, 0, 0, 600) }
    }
    if (type === "gradient") {
        const from = normaliseColor(bg.from)
        const to = normaliseColor(bg.to)
        if (from === null || to === null) errors.push(`${where}.background: gradient needs from and to as #RRGGBB`)
        return { type, from: from ?? DEFAULT_COLOR, to: to ?? "#555555" }
    }
    const color = normaliseColor(bg.color)
    if (color === null) errors.push(`${where}.background.color must be #RRGGBB`)
    return { type, color: color ?? DEFAULT_COLOR }
}

const sceneOf = (
    raw: unknown,
    index: number,
    errors: Array<string>,
    assetPath: (value: unknown, where: string) => string,
): Scene => {
    const where = `scenes[${index}]`
    const scene = isObject(raw) ? raw : {}
    if (!isObject(raw)) errors.push(`${where}: must be an object`)
    const duration = number(scene.duration_s, 0, 0, 15)
    if (duration !== 0 && duration < 1.5) errors.push(`${where}.duration_s must be 0 (automatic) or between 1.5 and 15`)
    return {
        background: backgroundOf(scene.background, where, errors, assetPath),
        text: clean(scene.text, 120),
        caption: clean(scene.caption, 160),
        voiceover: clean(scene.voiceover, 420),
        duration_s: duration === 0 ? 0 : Math.max(1.5, duration),
        transition: pick(scene.transition, TRANSITIONS, "fade"),
    }
}

const musicOf = (raw: unknown, errors: Array<string>): VideoSpec["music"] => {
    if (isObject(raw)) {
        const ids = MUSIC_TRACKS.map((track) => track.id)
        const track = pick(raw.track, ids, "sunny-pop")
        if (raw.track !== track) errors.push(`music.track must be one of ${ids.join(", ")}`)
        return { track, volume: number(raw.volume, 0.5, 0.05, 1) }
    }
    if (raw !== undefined && raw !== null) errors.push("music must be null or { track, volume }")
    return null
}

/** Validates and normalises untrusted input. Never throws. `opts.workspaceId` pins every asset path to that workspace folder. */
export const validateVideoSpec = (input: unknown, opts: SpecScope = {}): SpecResult => {
    const errors: Array<string> = []
    if (!isObject(input)) return { ok: false, errors: ["spec must be an object"] }
    const aspect = pick(input.aspect, ASPECTS, "9:16")
    if (input.aspect !== undefined && input.aspect !== aspect)
        errors.push(`aspect must be one of ${ASPECTS.join(", ")}`)

    const rawScenes: ReadonlyArray<unknown> = Array.isArray(input.scenes) ? input.scenes : []
    if (rawScenes.length < 1) errors.push("scenes: at least one scene is required")
    if (rawScenes.length > VIDEO_MAX_SCENES) errors.push(`scenes: at most ${VIDEO_MAX_SCENES} scenes`)
    const assetPath = (value: unknown, where: string): string => {
        const path = mediaPathOf(value, opts.workspaceId)
        if (path === null) errors.push(`${where}: must be a path or Storage URL inside this workspace's media folder`)
        return path ?? ""
    }
    const scenes = rawScenes.slice(0, VIDEO_MAX_SCENES).map((raw, index) => sceneOf(raw, index, errors, assetPath))

    const rawBrand = isObject(input.brand) ? input.brand : {}
    const name = clean(rawBrand.name, 60)
    if (name === "") errors.push("brand.name is required")
    const hasLogo = rawBrand.logo !== undefined && rawBrand.logo !== null && rawBrand.logo !== ""
    const brand: Brand = {
        name,
        primary: normaliseColor(rawBrand.primary) ?? DEFAULT_PRIMARY,
        secondary: normaliseColor(rawBrand.secondary) ?? DEFAULT_SECONDARY,
        logo: hasLogo ? assetPath(rawBrand.logo, "brand.logo") || null : null,
        ...(rawBrand.frame === true ? { frame: true } : {}),
    }
    const music = musicOf(input.music, errors)
    const rawVoice = isObject(input.voice) ? input.voice : {}
    const voice = {
        enabled: rawVoice.enabled !== false,
        name: pick(rawVoice.name, TTS_VOICES, DEFAULT_VOICE),
        rate_pct: Math.round(number(rawVoice.rate_pct, 0, -30, 30)),
    }
    const total = scenes.reduce((sum, scene) => sum + estimateSceneSeconds(scene), 0)
    if (scenes.length > 0 && total > VIDEO_MAX_SECONDS) {
        errors.push(`video would be about ${Math.round(total)} s; the maximum is ${VIDEO_MAX_SECONDS} s`)
    }
    if (errors.length > 0) return { ok: false, errors }
    return { ok: true, spec: { version: 1, aspect, scenes, brand, music, voice, captions: input.captions !== false } }
}
