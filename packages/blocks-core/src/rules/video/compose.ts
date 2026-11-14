import type { VideoAspect } from "./spec"

/**
 * The neutral compose spec the video module hands the connected compose service (`nivo.tool.video.compose`): the clips in play order,
 * the audio tracks under them, an optional logo, the captions with their moments on the composed timeline, the frame and the
 * resolution. Pure: exact arithmetic over the clips' lengths, no I/O, no clock. The service fetches every address itself.
 */

/** The resolutions the compose tool takes. */
export const COMPOSE_RESOLUTION_NAMES = ["sd", "hd", "1080"] as const

/** One resolution. */
export type ComposeResolutionName = (typeof COMPOSE_RESOLUTION_NAMES)[number]

/** The loudness of the narration under the clips, 0 (silent) to 1 (as recorded): the clips keep their own sound beneath it. */
export const VOICE_VOLUME = 1

/** The corner the workspace logo takes. */
export const LOGO_CORNER = "top-right"

/** The longest caption the compose tool takes, in characters. */
export const COMPOSE_CAPTION_MAX = 200

/** The most clips one spec joins. */
export const COMPOSE_CLIPS_MAX = 20

/** What the compose spec is built from: the clips' addresses and lengths, the scenes' headings, the narration, the logo, the frame. */
export interface ComposeSpecInput {
    /** The signed address of each clip, in scene order. */
    readonly clipUrls: ReadonlyArray<string>
    /** The length of each clip in seconds, in scene order, as it was asked of the video provider. */
    readonly clipSeconds: ReadonlyArray<number>
    /** The heading of each scene, in scene order (an empty heading shows no caption). */
    readonly captions: ReadonlyArray<string>
    /** The signed address of the narration track, or null for none. */
    readonly voiceUrl: string | null
    /** The address of the workspace logo, or null for none. */
    readonly logoUrl: string | null
    /** The shape of the finished video. */
    readonly aspect: VideoAspect
    /** The resolution of the finished video. */
    readonly resolution: ComposeResolutionName
}

/** One caption on the composed timeline. */
export type ComposeCaption = {
    /** The caption text. */
    readonly text: string
    /** When the caption appears, in milliseconds from the start. */
    readonly fromMs: number
    /** When the caption disappears, in milliseconds from the start. */
    readonly toMs: number
}

/** A file the video is made from. */
type ComposeFile = {
    /** The address of the file. */
    readonly fileUrl: string
}

/** An audio track laid under the clips. */
type ComposeAudio = ComposeFile & {
    /** What the track is: the voice-over. */
    readonly role: "voice"
    /** How loud the track plays. */
    readonly volume: number
}

/** The shop logo drawn on the video. */
type ComposeLogo = ComposeFile & {
    /** The corner the logo sits in. */
    readonly corner: typeof LOGO_CORNER
}

/** The neutral spec, as `nivo.tool.video.compose` takes it (`{ spec }`). */
export type ComposeSpec = {
    /** The clips, in play order, each with the address of its file. */
    readonly clips: ReadonlyArray<ComposeFile>
    /** The audio tracks laid under the clips (the voice-over); absent when there is none. */
    readonly audio?: ReadonlyArray<ComposeAudio>
    /** The shop logo and the corner it sits in; absent when there is no logo. */
    readonly logo?: ComposeLogo
    /** The captions drawn over the clips; absent when there are none. */
    readonly captions?: ReadonlyArray<ComposeCaption>
    /** The shape of the finished video. */
    readonly aspect: VideoAspect
    /** The resolution of the finished video. */
    readonly resolution: ComposeResolutionName
}

/** The spec, or why the inputs cannot make one. */
export type ComposeSpecResult = { readonly spec: ComposeSpec } | { readonly problem: string }

/**
 * Each scene's caption at its moment of the composed video: scene `i` shows from the sum of the lengths of the clips before it to that
 * sum plus its own length, in whole milliseconds (seconds times 1000, exact). A scene with an empty heading shows none but still takes
 * its time; a heading is cut to the compose tool's longest.
 */
export const captionsOf = (headings: ReadonlyArray<string>, clipSeconds: ReadonlyArray<number>): ReadonlyArray<ComposeCaption> => {
    const captions: Array<ComposeCaption> = []
    let fromMs = 0
    for (const [index, seconds] of clipSeconds.entries()) {
        const toMs = fromMs + Math.round(seconds * 1000)
        const text = (headings[index] ?? "").replaceAll(/\s+/gu, " ").trim().slice(0, COMPOSE_CAPTION_MAX)
        if (text !== "") captions.push({ text, fromMs, toMs })
        fromMs = toMs
    }
    return captions
}

/**
 * The compose spec of one video: the clips in scene order, the narration (when one was kept) at `VOICE_VOLUME`, the logo (when the
 * workspace has one) in `LOGO_CORNER`, a caption per scene heading timed by `captionsOf`. The inputs must line up (one address, one
 * length and one heading per scene) and fit the tool's bounds, else the problem is said and nothing is asked of a provider.
 */
export const composeSpecOf = (input: ComposeSpecInput): ComposeSpecResult => {
    const count = input.clipUrls.length
    if (count === 0) return { problem: "no clips to join" }
    if (count > COMPOSE_CLIPS_MAX) return { problem: `more than ${String(COMPOSE_CLIPS_MAX)} clips` }
    if (input.clipSeconds.length !== count || input.captions.length !== count)
        return { problem: "the clips, their lengths and the headings of the scenes do not line up" }
    const captions = captionsOf(input.captions, input.clipSeconds)
    return {
        spec: {
            clips: input.clipUrls.map((fileUrl) => ({ fileUrl })),
            ...(input.voiceUrl === null ? {} : { audio: [{ fileUrl: input.voiceUrl, role: "voice" as const, volume: VOICE_VOLUME }] }),
            ...(input.logoUrl === null ? {} : { logo: { fileUrl: input.logoUrl, corner: LOGO_CORNER } }),
            ...(captions.length === 0 ? {} : { captions }),
            aspect: input.aspect,
            resolution: input.resolution,
        },
    }
}
