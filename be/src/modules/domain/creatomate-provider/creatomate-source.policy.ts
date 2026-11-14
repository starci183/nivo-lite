import type { ComposeAspect, ComposeCorner, ComposeResolution, ComposeSpec } from "@modules/domain/video-compose"
import {
    CREATOMATE_BODY_MAX_BYTES,
    type CreatomateElement,
    type CreatomateSource,
} from "@modules/integrations/creatomate"

/*
 * NIVO's neutral compose spec -> a Creatomate RenderScript (pure). Every property name below is one the docs print:
 *   root:  https://creatomate.com/llms/renderscript-basics.md  (output_format "mp4", width / height in px 0-3840, frame_rate, elements)
 *   timing and position, common to all elements: https://creatomate.com/llms/elements.md  (track, time, duration, x, y, x_anchor,
 *     y_anchor, width, height, units "%" "vmin" "px")
 *   media: https://creatomate.com/llms/media.md  (source, trim_start and trim_duration in seconds, volume in %, loop, fit)
 *   sequencing on one track: https://creatomate.com/llms/durations.md  (time null = after the previous element on the track)
 *   text: https://creatomate.com/llms/subtitles.md and the text section of https://creatomate.com/llms-full.txt (text, fill_color,
 *     font_size "7 vmin", stroke_color, x_alignment)
 * A spec the RenderScript cannot carry is answered as a list of problems naming the member, decided before any request.
 */

/** The short side, in pixels, of each neutral resolution (`sd` 480p, `hd` 720p, `1080`). */
const SHORT_SIDE: Readonly<Record<ComposeResolution, number>> = { sd: 480, hd: 720, "1080": 1080 }

/** The long side for a 16:9 frame at each short side, rounded to an even number (a video encoder wants even sizes). */
const LONG_SIDE: Readonly<Record<ComposeResolution, number>> = { sd: 854, hd: 1280, "1080": 1920 }

/** The frame rate NIVO asks (the docs: 25 or 30 gives "predictable, smaller files"; the default would be the highest of the clips). */
export const CREATOMATE_FRAME_RATE = 30

/** The track of the clips; audio tracks follow, then the logo, then one track per caption (captions may overlap in time). */
const CLIP_TRACK = 1
const FIRST_AUDIO_TRACK = 2
/** Room for the most audio tracks the neutral schema allows (4) before the logo track. */
const LOGO_TRACK = 6
const FIRST_CAPTION_TRACK = 7

/** The logo's width, as a share of the frame (NIVO's choice: the spec names a corner, not a size). */
const LOGO_WIDTH = "20%"

/** The margin of the logo from the frame edge. */
const LOGO_MARGIN = 5

/** The caption's font size, in vmin (the docs' own unit: "7 vmin"). */
const CAPTION_FONT_SIZE = "5 vmin"

/** The frame size of an aspect at a resolution, in pixels. */
export const framesOf = (aspect: ComposeAspect, resolution: ComposeResolution): Pick<CreatomateSource, "width" | "height"> => {
    const short = SHORT_SIDE[resolution]
    const long = LONG_SIDE[resolution]
    switch (aspect) {
        case "9:16":
            return { width: short, height: long }
        case "16:9":
            return { width: long, height: short }
        case "1:1":
            return { width: short, height: short }
    }
}

/** Milliseconds as the seconds the RenderScript takes. */
const seconds = (ms: number): number => ms / 1000

/** A loudness 0..1 as the percent string the docs show (`"20%"`). */
const percent = (volume: number): string => `${Number((volume * 100).toFixed(2))}%`

/** The anchor and offsets that put an element in a corner: `x` / `y` place the anchor point, `x_anchor` / `y_anchor` pick the edge. */
const cornerOf = (corner: ComposeCorner): Readonly<Record<string, string>> => {
    const left = corner.endsWith("left")
    const top = corner.startsWith("top")
    return {
        x: `${left ? LOGO_MARGIN : 100 - LOGO_MARGIN}%`,
        x_anchor: left ? "0%" : "100%",
        y: `${top ? LOGO_MARGIN : 100 - LOGO_MARGIN}%`,
        y_anchor: top ? "0%" : "100%",
    }
}

/** The rules the RenderScript cannot carry, by member (the neutral policy states them too; the adapter holds them on its own). */
const problemsOf = (spec: ComposeSpec): ReadonlyArray<string> => [
    ...spec.clips.flatMap((clip, index) =>
        clip.trimMs?.toMs !== undefined && clip.trimMs.toMs <= clip.trimMs.fromMs
            ? [`clips.${index}.trimMs: toMs not after fromMs (trim_duration must be positive)`]
            : [],
    ),
    ...(spec.audio ?? []).flatMap((track, index) =>
        track.volume !== undefined && !(track.volume >= 0 && track.volume <= 1) ? [`audio.${index}.volume: not between 0 and 1`] : [],
    ),
    ...(spec.captions ?? []).flatMap((caption, index) =>
        caption.toMs <= caption.fromMs ? [`captions.${index}: toMs not after fromMs (duration must be positive)`] : [],
    ),
]

const clipElement = (clip: ComposeSpec["clips"][number], index: number): CreatomateElement => {
    const trim = clip.trimMs
    return {
        type: "video",
        track: CLIP_TRACK,
        ...(index === 0 ? { time: 0 } : {}),
        source: clip.fileUrl,
        fit: "cover",
        ...(trim !== undefined && trim.fromMs > 0 ? { trim_start: seconds(trim.fromMs) } : {}),
        ...(trim?.toMs !== undefined ? { trim_duration: seconds(trim.toMs - trim.fromMs), duration: seconds(trim.toMs - trim.fromMs) } : {}),
    }
}

const audioElement = (track: NonNullable<ComposeSpec["audio"]>[number], index: number): CreatomateElement => ({
    type: "audio",
    track: FIRST_AUDIO_TRACK + index,
    time: 0,
    source: track.fileUrl,
    ...(track.volume === undefined ? {} : { volume: percent(track.volume) }),
    // a music bed fills the whole timeline (a null duration stretches to it) and repeats when its file is shorter (media.md `loop`)
    ...(track.role === "music" ? { duration: null, loop: true } : {}),
})

const logoElement = (logo: NonNullable<ComposeSpec["logo"]>): CreatomateElement => ({
    type: "image",
    track: LOGO_TRACK,
    time: 0,
    duration: null,
    source: logo.fileUrl,
    fit: "contain",
    width: LOGO_WIDTH,
    height: null,
    ...cornerOf(logo.corner),
})

const captionElement = (caption: NonNullable<ComposeSpec["captions"]>[number], index: number): CreatomateElement => ({
    type: "text",
    track: FIRST_CAPTION_TRACK + index,
    time: seconds(caption.fromMs),
    duration: seconds(caption.toMs - caption.fromMs),
    text: caption.text,
    x: "50%",
    y: "85%",
    width: "90%",
    x_alignment: "50%",
    font_size: CAPTION_FONT_SIZE,
    fill_color: "#ffffff",
    stroke_color: "#000000",
})

/** The RenderScript of a spec, or the problems that stop it. */
export type CreatomateSourceResult =
    | { readonly ok: true; readonly source: CreatomateSource }
    | { readonly ok: false; readonly problems: ReadonlyArray<string> }

/**
 * The RenderScript a spec maps to: the clips in order on track 1, each audio track on its own track from 0, the logo above, each caption
 * on its own track between its two moments. Problems (and a body over the 2 MB cap of the API) are answered, never thrown. Pure.
 */
export const creatomateSourceOf = (spec: ComposeSpec): CreatomateSourceResult => {
    const problems = problemsOf(spec)
    if (problems.length > 0) return { ok: false, problems }
    const { width, height } = framesOf(spec.aspect, spec.resolution)
    const source: CreatomateSource = {
        output_format: "mp4",
        width,
        height,
        frame_rate: CREATOMATE_FRAME_RATE,
        elements: [
            ...spec.clips.map((clip, index) => clipElement(clip, index)),
            ...(spec.audio ?? []).map((track, index) => audioElement(track, index)),
            ...(spec.logo === undefined ? [] : [logoElement(spec.logo)]),
            ...(spec.captions ?? []).map((caption, index) => captionElement(caption, index)),
        ],
    }
    if (Buffer.byteLength(JSON.stringify(source), "utf8") > CREATOMATE_BODY_MAX_BYTES) {
        return { ok: false, problems: ["spec: the render request is over the 2 MB the API takes"] }
    }
    return { ok: true, source }
}
