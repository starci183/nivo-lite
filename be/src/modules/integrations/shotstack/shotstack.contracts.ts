/*
 * The Shotstack Edit API's own request and response shapes, as its official reference gives them (https://shotstack.io/docs/api/).
 * Only the members NIVO sends or reads are typed.
 */

/** The two environments of the Edit API: `stage` (sandbox, watermarked, free) and `v1` (production, uses credits). https://shotstack.io/docs/guide/getting-started/request-api-keys/ */
export const SHOTSTACK_ENVIRONMENTS = ["stage", "v1"] as const

/** One environment (the path segment after `/edit/`). */
export type ShotstackEnvironment = (typeof SHOTSTACK_ENVIRONMENTS)[number]

/** The render states the docs list (`RenderResponseData.status`): https://shotstack.io/docs/api/ */
export const SHOTSTACK_RENDER_STATES = [
    "queued",
    "fetching",
    "preprocessing",
    "rendering",
    "generating",
    "saving",
    "done",
    "failed",
] as const

/** One render state. */
export type ShotstackRenderState = (typeof SHOTSTACK_RENDER_STATES)[number]

/** A moment or a length of a clip: seconds, or `auto` (after the previous clip / the asset's duration) or `end` (to the end of the timeline). */
export type ShotstackTime = number | "auto" | "end"

/** `Clip.position` (https://shotstack.io/docs/api/, Clip). */
export type ShotstackPosition =
    | "top"
    | "topRight"
    | "right"
    | "bottomRight"
    | "bottom"
    | "bottomLeft"
    | "left"
    | "topLeft"
    | "center"

/** A video asset: `trim` is the start trim point in seconds, `volume` 0..1. */
export interface ShotstackVideoAsset {
    /** Tells the render this asset is a video. */
    readonly type: "video"
    /** The URL the render fetches the video from. */
    readonly src: string
    /** Seconds cut from the start of the video before it plays. */
    readonly trim?: number
    /** How loud the video's own sound is, 0 (mute) to 1. */
    readonly volume?: number
}

/** An audio asset: `volume` 0..1. */
export interface ShotstackAudioAsset {
    /** Tells the render this asset is a sound. */
    readonly type: "audio"
    /** The URL the render fetches the sound from. */
    readonly src: string
    /** How loud the sound is, 0 (mute) to 1. */
    readonly volume?: number
}

/** An image asset (a jpg or png the render fetches). */
export interface ShotstackImageAsset {
    /** Tells the render this asset is a still image. */
    readonly type: "image"
    /** The URL the render fetches the image from. */
    readonly src: string
}

/** The font of a rich-text asset. */
export interface ShotstackRichTextFont {
    /** The size of the letters, in pixels. */
    readonly size: number
    /** The colour of the letters, as a hex string. */
    readonly color: string
    /** How heavy the letters are, as a CSS weight. */
    readonly weight: number
}

/** The alignment of a rich-text asset. */
export interface ShotstackRichTextAlign {
    /** Where the text sits from left to right in its box. */
    readonly horizontal: "left" | "center" | "right"
    /** Where the text sits from top to bottom in its box. */
    readonly vertical: "top" | "middle" | "bottom"
}

/** The background of a rich-text asset. */
export interface ShotstackRichTextBackground {
    /** The fill behind the text, as a hex string. */
    readonly color: string
    /** How opaque that fill is, 0 to 1. */
    readonly opacity: number
    /** Whether lines break at the edge of the box instead of running past it. */
    readonly wrap: boolean
}

/** A rich-text asset: the text (at most 5000 characters), its font, alignment and background. */
export interface ShotstackRichTextAsset {
    /** Tells the render this asset is styled text. */
    readonly type: "rich-text"
    /** The words shown, at most 5000 characters. */
    readonly text: string
    /** How the letters look. */
    readonly font: ShotstackRichTextFont
    /** Where the text sits in its box. */
    readonly align: ShotstackRichTextAlign
    /** What is drawn behind the text. */
    readonly background: ShotstackRichTextBackground
}

/** Any asset NIVO sends. */
export type ShotstackAsset = ShotstackVideoAsset | ShotstackAudioAsset | ShotstackImageAsset | ShotstackRichTextAsset

/** A clip's shift from its position, in the library's relative units. */
export interface ShotstackOffset {
    /** The shift across, as a fraction of the frame. */
    readonly x: number
    /** The shift down, as a fraction of the frame. */
    readonly y: number
}

/** One clip of a track. */
export interface ShotstackClip {
    /** What the clip shows or plays. */
    readonly asset: ShotstackAsset
    /** When the clip starts on the timeline, in seconds or `auto`. */
    readonly start: ShotstackTime
    /** How long the clip lasts, in seconds, `auto` or `end`. */
    readonly length: ShotstackTime
    /** How the asset fills the frame when its shape differs. */
    readonly fit?: "crop" | "cover" | "contain" | "none"
    /** How large the asset is against the frame. */
    readonly scale?: number
    /** Where in the frame the asset is anchored. */
    readonly position?: ShotstackPosition
    /** A shift from that anchor. */
    readonly offset?: ShotstackOffset
}

/** One track: the FIRST track of the timeline is the TOP one. */
export interface ShotstackTrack {
    /** The clips of the track, in play order. */
    readonly clips: ReadonlyArray<ShotstackClip>
}

/** The `output` of an Edit. */
export interface ShotstackOutput {
    /** The file type the render makes. */
    readonly format: "mp4"
    /** The size class of the video. */
    readonly resolution: "sd" | "hd" | "1080"
    /** The shape of the frame. */
    readonly aspectRatio: "16:9" | "9:16" | "1:1"
}

/** The timeline of an Edit: its tracks. */
export interface ShotstackTimeline {
    /** The tracks, the first drawn on top. */
    readonly tracks: ReadonlyArray<ShotstackTrack>
}

/** The Edit: the JSON a render is POSTed. */
export interface ShotstackEdit {
    /** The clips to render, in tracks. */
    readonly timeline: ShotstackTimeline
    /** The file the render makes. */
    readonly output: ShotstackOutput
    /** The webhook URL Shotstack POSTs the render's end to. */
    readonly callback?: string
}

/** A queued render: `response.id`. */
export interface ShotstackQueued {
    /** The render id (UUID). */
    readonly id: string
}

/** A render as the status call answers it (the members NIVO reads). */
export interface ShotstackRender {
    /** `response.id`. */
    readonly id: string
    /** `response.status`, one of the documented words. */
    readonly status: ShotstackRenderState
    /** `response.url`, once `done` (a temporary link: it expires after 24 hours). */
    readonly url: string | null
    /** `response.error`, once `failed`. */
    readonly error: string | null
}
