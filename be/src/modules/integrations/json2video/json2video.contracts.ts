/*
 * JSON2Video's own request and response shapes, as its official reference prints them (https://json2video.com/docs/v2/reference/json-syntax/movie,
 * .../scene, .../element and its element pages). NIVO's neutral spec is mapped onto them by the provider adapter, never here.
 */

/** The movie JSON limit of `POST /v2/movies`: 2 MB (2,097,152 UTF-8 bytes); above it JSON2Video answers 413 `movie_json_too_large` (movies-create). */
export const JSON2VIDEO_MOVIE_MAX_BYTES = 2_097_152

/** A canvas percentage or pixels as the element pages take them (`"20%"`, `"250px"`, `250`). */
export type Json2VideoSize = string | number

/** `position` values of a visual element (element/image, element/video). */
export type Json2VideoCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right"

/** Where the text of a caption sits inside the text element's canvas (element/text: `vertical-position`, `horizontal-position`). */
export interface Json2VideoTextSettings {
    /** `bottom`: the caption sits at the bottom of the picture. */
    readonly "vertical-position": "bottom"
    /** `center`: the caption is centred across the picture. */
    readonly "horizontal-position": "center"
}

/** A video element (https://json2video.com/docs/v2/reference/json-syntax/element/video): `seek` and `duration` in seconds. */
export interface Json2VideoVideoElement {
    /** `video`. */
    readonly type: "video"
    /** The public https address of the clip, which JSON2Video fetches while rendering. */
    readonly src: string
    /** The point in the source file where playback begins, in seconds. */
    readonly seek?: number
    /** The element's length in seconds; `-1` the asset's own, `-2` the parent's. */
    readonly duration?: number
    /** `cover` stretches to cover the canvas. */
    readonly resize: "cover"
    /** Where a resized element sits. */
    readonly position: "center-center"
}

/** An audio element (https://json2video.com/docs/v2/reference/json-syntax/element/audio). */
export interface Json2VideoAudioElement {
    /** `audio`. */
    readonly type: "audio"
    /** The public https address of the track, which JSON2Video fetches while rendering. */
    readonly src: string
    /** Gain, 0 to 10, `1` as recorded. */
    readonly volume?: number
    /** `-1` the asset's own length, `-2` the parent's (the movie's, at movie level). */
    readonly duration?: number
    /** Plays; `-1` loops indefinitely. */
    readonly loop?: number
}

/** An image element (https://json2video.com/docs/v2/reference/json-syntax/element/image). */
export interface Json2VideoImageElement {
    /** `image`. */
    readonly type: "image"
    /** The public https address of the picture, which JSON2Video fetches while rendering. */
    readonly src: string
    /** The corner preset the picture sits in (inset by 5% of the canvas). */
    readonly position: Json2VideoCorner
    /** Its width: a canvas percentage keeps it small whatever the canvas. */
    readonly width: Json2VideoSize
    /** `-2`: it stays for the parent's whole length. */
    readonly duration: number
}

/** A text element (https://json2video.com/docs/v2/reference/json-syntax/element/text): plain text, CSS-named settings. */
export interface Json2VideoTextElement {
    /** `text`. */
    readonly type: "text"
    /** The words shown, plain text. */
    readonly text: string
    /** Seconds from the start of the parent (the movie, at movie level). */
    readonly start: number
    /** Seconds the words stay. */
    readonly duration: number
    /** Where the words sit. */
    readonly settings: Json2VideoTextSettings
}

/** A movie-level element, rendered above every scene (movie `elements`). */
export type Json2VideoMovieElement = Json2VideoAudioElement | Json2VideoImageElement | Json2VideoTextElement

/** One scene: elements only; its duration is as long as its elements need (`-1`, the default). */
export interface Json2VideoScene {
    /** What plays in the scene. */
    readonly elements: ReadonlyArray<Json2VideoVideoElement>
}

/** A webhook destination of an export (https://json2video.com/docs/v2/reference/webhooks). */
export interface Json2VideoWebhookDestination {
    /** `webhook`. */
    readonly type: "webhook"
    /** The https address JSON2Video posts the finished render to (one POST per render). */
    readonly endpoint: string
}

/** One export pipeline. */
export interface Json2VideoExport {
    /** Where the finished render is delivered. */
    readonly destinations: ReadonlyArray<Json2VideoWebhookDestination>
}

/** The movie JSON `POST /v2/movies` takes (movie page). */
export interface Json2VideoMovie {
    /** `custom`: the canvas is `width` x `height`. */
    readonly resolution: "custom"
    /** Canvas width in pixels (50 to 3840). */
    readonly width: number
    /** Canvas height in pixels (50 to 3840). */
    readonly height: number
    /** The scenes, played in order. */
    readonly scenes: ReadonlyArray<Json2VideoScene>
    /** The elements laid over every scene. */
    readonly elements: ReadonlyArray<Json2VideoMovieElement>
    /** The export pipelines (the webhook), absent without a callback. */
    readonly exports?: ReadonlyArray<Json2VideoExport>
}

/** The statuses the status endpoint reports (movies-status): `timeout` is the client's own word, the server reports `running`. */
export const JSON2VIDEO_STATUSES = ["pending", "running", "done", "error", "timeout"] as const

/** One status word. */
export type Json2VideoStatus = (typeof JSON2VIDEO_STATUSES)[number]

/** A started movie: `project`, the 16-character id to poll. */
export interface Json2VideoStarted {
    /** The 16-character id the status endpoint is asked about. */
    readonly project: string
}

/** A movie as the status endpoint reports it (the members NIVO reads). */
export interface Json2VideoMovieState {
    /** `project`: the movie's id. */
    readonly project: string
    /** `status`: where the render stands. */
    readonly status: Json2VideoStatus
    /** `message`: the reason when the render failed. */
    readonly message: string
    /** `url`: the public MP4, null until done and after the file is deleted. */
    readonly url: string | null
    /** `created_at`, ISO-8601, null when absent. */
    readonly createdAt: string | null
}
