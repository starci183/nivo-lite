import {
    JSON2VIDEO_MOVIE_MAX_BYTES,
    type Json2VideoAudioElement,
    type Json2VideoImageElement,
    type Json2VideoMovie,
    type Json2VideoMovieElement,
    type Json2VideoScene,
    type Json2VideoTextElement,
} from "@modules/integrations/json2video"
import type {
    ComposeAspect,
    ComposeAudio,
    ComposeCaption,
    ComposeClip,
    ComposeLogo,
    ComposeResolution,
    ComposeSpec,
    OptionalRenderCallback,
} from "@modules/domain/video-compose"

/*
 * NIVO's neutral compose spec -> JSON2Video's movie JSON. Pure. Every rule below is read from the vendor's official reference:
 *  - movie: https://json2video.com/docs/v2/reference/json-syntax/movie (`resolution: "custom"` takes `width` x `height`, 50..3840;
 *    `scenes` play in array order; movie `elements` "overlay every scene"; `exports` take `destinations`)
 *  - scene: https://json2video.com/docs/v2/reference/json-syntax/scene (`duration` -1, the default, = as long as its elements need)
 *  - video element: .../element/video (`seek` = second of the source where playback begins; `duration` seconds; `resize: "cover"` with
 *    `position: "center-center"` fills the canvas)
 *  - audio element: .../element/audio (`volume` 0..10, 1 = as recorded; at movie level `duration: -2` = the movie's length, `loop: -1`
 *    loops indefinitely)
 *  - image element: .../element/image (`position` top-left, top-right, bottom-left, bottom-right; `width` as a canvas percentage,
 *    `height` -1 keeps the aspect)
 *  - text element: .../element/text (plain text; `start` / `duration` in seconds on the parent's timeline, the movie's at movie level;
 *    `settings` `vertical-position` / `horizontal-position`)
 *  - webhook: https://json2video.com/docs/v2/reference/webhooks (`exports[].destinations[] = { type: "webhook", endpoint }`)
 * A spec the movie cannot carry is refused with a reason naming the member, BEFORE any request.
 */

/** The width of a logo, a canvas percentage (the neutral spec carries no size; NOT VERIFIED in docs how it looks). */
export const JSON2VIDEO_LOGO_WIDTH = "20%"

/** Pixels of the short and the long side per resolution (`sd` 480p, `hd` 720p, `1080`), even numbers (h264). */
const SIDES: Readonly<Record<ComposeResolution, { readonly short: number; readonly long: number }>> = {
    sd: { short: 480, long: 854 },
    hd: { short: 720, long: 1280 },
    "1080": { short: 1080, long: 1920 },
}

/** A canvas in pixels. */
export interface Json2VideoCanvas {
    /** Pixels across. */
    readonly width: number
    /** Pixels down. */
    readonly height: number
}

/** The canvas of an aspect at a resolution, in pixels. */
export const canvasOf = (aspect: ComposeAspect, resolution: ComposeResolution): Json2VideoCanvas => {
    const { short, long } = SIDES[resolution]
    switch (aspect) {
        case "9:16":
            return { width: short, height: long }
        case "16:9":
            return { width: long, height: short }
        case "1:1":
            return { width: short, height: short }
    }
}

const seconds = (ms: number): number => ms / 1000

/** One clip as one scene (scenes play in order, each as long as its video): the used part by `seek` and `duration`. */
const sceneOf = (clip: ComposeClip): Json2VideoScene => {
    const trim = clip.trimMs
    return {
        elements: [
            {
                type: "video",
                src: clip.fileUrl,
                ...(trim !== undefined && trim.fromMs > 0 ? { seek: seconds(trim.fromMs) } : {}),
                ...(trim?.toMs === undefined ? {} : { duration: seconds(trim.toMs - trim.fromMs) }),
                resize: "cover",
                position: "center-center",
            },
        ],
    }
}

/**
 * One track under the whole movie: the voice plays once from the start, as long as it is; the music is a bed over the movie's length,
 * looped (the docs: "For infinite loops, set duration to -2").
 */
const audioOf = (track: ComposeAudio): Json2VideoAudioElement => ({
    type: "audio",
    src: track.fileUrl,
    ...(track.volume === undefined ? {} : { volume: track.volume }),
    ...(track.role === "music" ? { duration: -2, loop: -1 } : {}),
})

/** The logo over the whole movie, in its corner (the preset insets 5% of the canvas). */
const logoOf = (logo: ComposeLogo): Json2VideoImageElement => ({
    type: "image",
    src: logo.fileUrl,
    position: logo.corner,
    width: JSON2VIDEO_LOGO_WIDTH,
    duration: -2,
})

/** One caption: a text element on the movie's timeline between its two moments, at the bottom centre. */
const captionOf = (caption: ComposeCaption): Json2VideoTextElement => ({
    type: "text",
    text: caption.text,
    start: seconds(caption.fromMs),
    duration: seconds(caption.toMs - caption.fromMs),
    settings: { "vertical-position": "bottom", "horizontal-position": "center" },
})

/** The movie JSON of a spec, or why the movie cannot be sent. */
export type MovieBuilt =
    | { readonly ok: true; readonly movie: Json2VideoMovie }
    | { readonly ok: false; readonly reason: string }

/**
 * The movie JSON for a spec: the canvas, one scene per clip, then (above every scene) the audio tracks, the logo and the captions;
 * the webhook as an export when a callback is given. Refused when the JSON is over the 2 MB `POST /v2/movies` takes.
 */
export const movieOf = (spec: ComposeSpec, callback: OptionalRenderCallback): MovieBuilt => {
    const elements: ReadonlyArray<Json2VideoMovieElement> = [
        ...(spec.audio ?? []).map((track) => audioOf(track)),
        ...(spec.logo === undefined ? [] : [logoOf(spec.logo)]),
        ...(spec.captions ?? []).map((caption) => captionOf(caption)),
    ]
    const movie: Json2VideoMovie = {
        resolution: "custom",
        ...canvasOf(spec.aspect, spec.resolution),
        scenes: spec.clips.map((clip) => sceneOf(clip)),
        elements,
        ...(callback === null ? {} : { exports: [{ destinations: [{ type: "webhook", endpoint: callback.url }] }] }),
    }
    const bytes = Buffer.byteLength(JSON.stringify(movie), "utf8")
    return bytes > JSON2VIDEO_MOVIE_MAX_BYTES
        ? {
              ok: false,
              reason: `clips/audio/logo/captions: the movie JSON is ${bytes} bytes, over the ${JSON2VIDEO_MOVIE_MAX_BYTES} bytes JSON2Video takes`,
          }
        : { ok: true, movie }
}
