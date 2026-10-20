import { ASPECTS, MUSIC_TRACKS, TTS_VOICES, normaliseColor } from "./video-spec.policy"
import type { Scene, SceneBackground, TtsVoice } from "./video-spec.policy"

/** One scene of the script the owner edited: the words and the file behind them. */
export interface ScriptScene {
    /** On-screen words (burned-in caption, or the big headline when the scene has no photo/clip). */
    readonly caption: string
    /** What the voice says. Empty = silent scene. */
    readonly voiceover: string
    /** Path in the `media` bucket, or null = a colour card in the brand colours. */
    readonly media: string | null
}

/** The workspace brand kit as the spec takes it. */
export interface BrandKit {
    /** The shop name shown in the video. */
    readonly shopName: string
    /** The accent colour. */
    readonly primary: string
    /** The second colour. */
    readonly secondary: string
    /** The logo path in the media bucket, or null. */
    readonly logoPath: string | null
    /** The music track id, or null for none. */
    readonly musicTrack: string | null
    /** The voice name. */
    readonly voice: string
}

const DEFAULT_PRIMARY = "#16a34a"
const DEFAULT_SECONDARY = "#0f172a"
const DEFAULT_VOICE: TtsVoice = "vi-VN-HoaiMyNeural"
const MAX_SCENES = 12

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const clip = (value: unknown, max: number): string =>
    typeof value === "string" ? value.replace(/\s+/gu, " ").trim().slice(0, max) : ""

/** Whatever is stored -> clean scenes (at most 12; a scene with neither caption nor voiceover is dropped). Never throws. */
export const readScript = (raw: unknown): Array<ScriptScene> => {
    if (!Array.isArray(raw)) return []
    return raw.slice(0, MAX_SCENES).flatMap((entry: unknown): Array<ScriptScene> => {
        if (!isObject(entry)) return []
        const caption = clip(entry.caption, 160)
        const voiceover = clip(entry.voiceover, 420)
        if (caption === "" && voiceover === "") return []
        const media = typeof entry.media === "string" && entry.media !== "" ? entry.media.slice(0, 300) : null
        return [{ caption, voiceover, media }]
    })
}

/** Whether an uploaded file is a clip or a picture. */
export const mediaKindOf = (path: string): "video" | "image" => (/\.(mp4|mov|webm)$/iu.test(path) ? "video" : "image")

const sceneOf = (scene: ScriptScene, index: number, primary: string, secondary: string): Scene => {
    let background: SceneBackground
    if (scene.media === null) {
        background =
            index % 2 === 0
                ? { type: "gradient", from: primary, to: secondary }
                : { type: "gradient", from: secondary, to: primary }
    } else if (mediaKindOf(scene.media) === "video") {
        background = { type: "video", src: scene.media, start_s: 0 }
    } else {
        background = { type: "image", src: scene.media, motion: index % 2 === 0 ? "zoom-in" : "pan-left" }
    }
    return {
        background,
        // A colour card has no picture to show: the words go big in the middle. With a photo or clip they are the caption at the bottom.
        text: scene.media === null ? scene.caption.slice(0, 120) : "",
        caption: scene.media === null ? "" : scene.caption,
        voiceover: scene.voiceover,
        duration_s: 0,
        transition: "fade",
    }
}

/**
 * The spec the script and the brand make, not yet validated: callers pass it to `validateVideoSpec`. `shopFallback` names a shop that has
 * no name yet; `framed` adds the brand frame (AI Editor renders delegated by another agent always carry it).
 */
export const specOf = (
    scenes: ReadonlyArray<ScriptScene>,
    aspect: string,
    brand: BrandKit,
    shopFallback: string,
    framed = false,
): unknown => {
    const primary = normaliseColor(brand.primary) ?? DEFAULT_PRIMARY
    const secondary = normaliseColor(brand.secondary) ?? DEFAULT_SECONDARY
    const track = MUSIC_TRACKS.find((candidate) => candidate.id === brand.musicTrack)
    return {
        version: 1,
        aspect: ASPECTS.find((candidate) => candidate === aspect) ?? "9:16",
        scenes: scenes.map((scene, index) => sceneOf(scene, index, primary, secondary)),
        brand: {
            name: brand.shopName === "" ? shopFallback : brand.shopName,
            primary,
            secondary,
            logo: brand.logoPath,
            ...(framed ? { frame: true } : {}),
        },
        music: track === undefined ? null : { track: track.id, volume: 0.45 },
        voice: {
            enabled: true,
            name: TTS_VOICES.find((candidate) => candidate === brand.voice) ?? DEFAULT_VOICE,
            rate_pct: 0,
        },
        captions: true,
    }
}
