import type {
    ComposeAudio,
    ComposeCaption,
    ComposeCorner,
    ComposeResolution,
    ComposeSpec,
    RenderStatus,
} from "@modules/domain/video-compose"
import type {
    ShotstackClip,
    ShotstackEdit,
    ShotstackEnvironment,
    ShotstackPosition,
    ShotstackRenderState,
    ShotstackTrack,
} from "@modules/integrations/shotstack"

/*
 * NIVO's neutral `ComposeSpec` -> the Shotstack Edit (https://shotstack.io/docs/api/, schema Edit / Timeline / Track / Clip / assets /
 * Output), and Shotstack's render words -> the neutral statuses. Pure: no network, no clock.
 *
 * The timeline: `tracks[0]` is the TOP track (https://shotstack.io/docs/guide/getting-started/core-concepts/: "the first element is the
 * top track and the last element is the bottom most track"). Order top to bottom: captions, logo, the clips, each voice, the music bed.
 * A clip's `start` is in seconds on the timeline, its `length` in seconds; a video asset's `trim` is "the start trim point of the video
 * clip, in seconds".
 */

/** The longest render the sandbox takes: "the maximum render duration is 10 minutes" (https://shotstack.io/docs/guide/architecting-an-application/limitations/). */
export const SHOTSTACK_STAGE_MAX_MS = 600_000

/** The logo's size as a fraction of the viewport (`Clip.scale`: "0.5 means half the viewport size"). A NIVO choice. */
const LOGO_SCALE = 0.2

/** The distance of the logo from its corner (`Offset`, relative to the viewport; range -10..10). A NIVO choice. */
const LOGO_MARGIN = 0.03

/** The caption text size in pixels per output resolution (`RichTextFont.size`, 1..500). A NIVO choice. */
const CAPTION_SIZE: Readonly<Record<ComposeResolution, number>> = { sd: 32, hd: 44, "1080": 64 }

/** The caption colours (`RichTextFont.color`, `RichTextBackground.color`: hex). A NIVO choice. */
const CAPTION_COLOR = "#ffffff"
const CAPTION_BACKDROP = "#000000"

/** Where a logo corner sits (`Clip.position`) and which way its margin pushes it (`Offset`: x positive = right, y positive = up). */
const CORNER: Readonly<Record<ComposeCorner, { readonly position: ShotstackPosition; readonly x: number; readonly y: number }>> = {
    "top-left": { position: "topLeft", x: LOGO_MARGIN, y: -LOGO_MARGIN },
    "top-right": { position: "topRight", x: -LOGO_MARGIN, y: -LOGO_MARGIN },
    "bottom-left": { position: "bottomLeft", x: LOGO_MARGIN, y: LOGO_MARGIN },
    "bottom-right": { position: "bottomRight", x: -LOGO_MARGIN, y: LOGO_MARGIN },
}

const seconds = (ms: number): number => ms / 1000

/**
 * What the spec asks that this account cannot have, named by member; empty when Shotstack can render it. The one limit the docs give
 * that a spec can break: the sandbox (`stage`) renders at most 10 minutes, so a spec whose clips (all trimmed with an end) add up to more
 * is refused there. A clip with no `toMs` has a length only the file knows, so it adds nothing here.
 */
export const shotstackProblemsOf = (spec: ComposeSpec, environment: ShotstackEnvironment): ReadonlyArray<string> => {
    if (environment !== "stage") return []
    const knownMs = spec.clips.reduce((sum, clip) => sum + (clip.trimMs?.toMs === undefined ? 0 : clip.trimMs.toMs - clip.trimMs.fromMs), 0)
    return knownMs > SHOTSTACK_STAGE_MAX_MS ? [`clips: ${knownMs} ms is over the ${SHOTSTACK_STAGE_MAX_MS} ms the sandbox environment renders`] : []
}

/** The clips as one track in play order: the first at 0, each next `auto` (after the previous), the length from the trim or `auto`. */
const clipsTrackOf = (spec: ComposeSpec): ShotstackTrack => ({
    clips: spec.clips.map((clip, index): ShotstackClip => {
        const trim = clip.trimMs
        return {
            asset: { type: "video", src: clip.fileUrl, ...(trim === undefined ? {} : { trim: seconds(trim.fromMs) }) },
            start: index === 0 ? 0 : "auto",
            length: trim?.toMs === undefined ? "auto" : seconds(trim.toMs - trim.fromMs),
        }
    }),
})

/** One caption as a rich-text clip at the bottom, between its two moments of the timeline. */
const captionClipOf = (caption: ComposeCaption, resolution: ComposeResolution): ShotstackClip => ({
    asset: {
        type: "rich-text",
        text: caption.text,
        font: { size: CAPTION_SIZE[resolution], color: CAPTION_COLOR, weight: 700 },
        align: { horizontal: "center", vertical: "bottom" },
        background: { color: CAPTION_BACKDROP, opacity: 0.5, wrap: true },
    },
    start: seconds(caption.fromMs),
    length: seconds(caption.toMs - caption.fromMs),
    position: "bottom",
})

/** The captions on as few tracks as keep every track free of overlap (a track plays one clip at a time), in time order. */
const captionTracksOf = (captions: ReadonlyArray<ComposeCaption>, resolution: ComposeResolution): ReadonlyArray<ShotstackTrack> => {
    const lanes: Array<{ end: number; clips: Array<ShotstackClip> }> = []
    for (const caption of [...captions].sort((left, right) => left.fromMs - right.fromMs)) {
        const lane = lanes.find((candidate) => candidate.end <= caption.fromMs)
        const clip = captionClipOf(caption, resolution)
        if (lane === undefined) lanes.push({ end: caption.toMs, clips: [clip] })
        else {
            lane.clips.push(clip)
            lane.end = caption.toMs
        }
    }
    return lanes.map((lane) => ({ clips: lane.clips }))
}

/**
 * The Edit for a spec. Output: `mp4`, the preset `resolution` of the same name (`sd`, `hd`, `1080`) and `aspectRatio` as given
 * (`16:9`, `9:16`, `1:1` are in the docs' enum). Audio: an `audio` asset from second 0, `volume` only when the spec names one; a voice
 * plays its own length (`auto`), the music bed to the end of the timeline (`end`). The callback is the URL NIVO was given, verbatim.
 */
export const shotstackEditOf = (spec: ComposeSpec, callback: string | null): ShotstackEdit => {
    const voices = (spec.audio ?? []).filter((track) => track.role === "voice")
    const music = (spec.audio ?? []).filter((track) => track.role === "music")
    const audioTrack = (track: ComposeAudio, length: "auto" | "end"): ShotstackTrack => ({
        clips: [
            {
                asset: { type: "audio", src: track.fileUrl, ...(track.volume === undefined ? {} : { volume: track.volume }) },
                start: 0,
                length,
            },
        ],
    })
    const tracks: ReadonlyArray<ShotstackTrack> = [
        ...captionTracksOf(spec.captions ?? [], spec.resolution),
        ...(spec.logo === undefined
            ? []
            : [
                  {
                      clips: [
                          {
                              asset: { type: "image", src: spec.logo.fileUrl },
                              start: 0,
                              length: "end",
                              fit: "contain",
                              scale: LOGO_SCALE,
                              position: CORNER[spec.logo.corner].position,
                              offset: { x: CORNER[spec.logo.corner].x, y: CORNER[spec.logo.corner].y },
                          },
                      ],
                  } satisfies ShotstackTrack,
              ]),
        clipsTrackOf(spec),
        ...voices.map((track) => audioTrack(track, "auto")),
        ...music.map((track) => audioTrack(track, "end")),
    ]
    return {
        timeline: { tracks },
        output: { format: "mp4", resolution: spec.resolution, aspectRatio: spec.aspect },
        ...(callback === null ? {} : { callback }),
    }
}

/**
 * Shotstack's render word -> the neutral status (the words are the docs' `RenderResponseData.status`, https://shotstack.io/docs/api/):
 * `queued` waits; `fetching`, `preprocessing`, `rendering`, `generating`, `saving` are work in progress; `done` and `failed` are the end.
 */
export const shotstackStatusOf = (state: ShotstackRenderState): RenderStatus => {
    switch (state) {
        case "queued":
            return "queued"
        case "done":
            return "done"
        case "failed":
            return "failed"
        case "fetching":
        case "preprocessing":
        case "rendering":
        case "generating":
        case "saving":
            return "rendering"
    }
}
