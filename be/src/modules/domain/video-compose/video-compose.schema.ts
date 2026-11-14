import { FILE_REMOTE_URL_MAX } from "@nivo-lite/agent-sdk/entity"
import { z } from "zod"
import type { ToolJson } from "@modules/domain/tools"
import {
    COMPOSE_ASPECTS,
    COMPOSE_AUDIO_ROLES,
    COMPOSE_CORNERS,
    COMPOSE_RESOLUTIONS,
    type ComposeSpec,
} from "./video-compose.contracts"

/*
 * The bounded arguments of the generic compose tools. Every bound here is NIVO's own (a neutral contract no single provider documents);
 * a provider whose own limits are tighter refuses the spec itself (`provider_refused`, proved `not_sent`) from its official docs.
 */

/** The most clips one timeline joins (a short video of scenes; the video module's script makes at most 12). */
export const COMPOSE_CLIPS_MAX = 20

/** The most audio tracks under one timeline (a voice or two and at most one music bed). */
export const COMPOSE_AUDIO_MAX = 4

/** The most music beds one timeline takes. */
export const COMPOSE_MUSIC_MAX = 1

/** The most captions one timeline burns in. */
export const COMPOSE_CAPTIONS_MAX = 60

/** The longest caption, in characters (one or two lines on a phone screen). */
export const COMPOSE_CAPTION_TEXT_MAX = 200

/** The longest timeline a moment may name, in milliseconds: ten minutes. */
export const COMPOSE_TIMELINE_MAX_MS = 600_000

/** NIVO's own bound of a render id a provider answered. */
export const RENDER_ID_MAX = 200

/**
 * An address the provider fetches itself: https only (a signed URL of the file store, `nivo.tool.file.get` with up to 7 days), at most
 * the SDK's `FILE_REMOTE_URL_MAX`. NIVO never fetches it.
 */
const fileUrl = z
    .url({ protocol: /^https$/u })
    .max(FILE_REMOTE_URL_MAX)
    .describe("A signed https address of the file (`nivo.tool.file.get` with `expiresInSeconds`, up to 7 days).")

/** A moment of the timeline, in whole milliseconds. */
const MOMENT = z.number().int().min(0).max(COMPOSE_TIMELINE_MAX_MS)

const trimSchema = z
    .strictObject({
        fromMs: MOMENT.describe("Where the used part starts in the source clip."),
        toMs: MOMENT.describe("Where it ends; absent = the clip's end.").optional(),
    })
    .describe("The part of the clip used.")

const clipSchema = z.strictObject({ fileUrl, trimMs: trimSchema.optional() })

const audioSchema = z.strictObject({
    fileUrl,
    role: z.enum(COMPOSE_AUDIO_ROLES).describe("`voice` (narration) or `music` (a bed under everything)."),
    volume: z.number().min(0).max(1).optional().describe("Loudness 0 (silent) to 1 (as recorded); absent = 1."),
})

const logoSchema = z.strictObject({ fileUrl, corner: z.enum(COMPOSE_CORNERS) })

const captionSchema = z.strictObject({
    text: z.string().trim().min(1).max(COMPOSE_CAPTION_TEXT_MAX),
    fromMs: MOMENT.describe("When the caption shows, on the composed timeline."),
    toMs: MOMENT.describe("When it goes, on the composed timeline."),
})

/** The neutral compose spec, structurally (each member's type and bound); the rules across members are `composeSpecProblems`. */
export const COMPOSE_SPEC_SCHEMA: z.ZodType<ComposeSpec> = z.strictObject({
    clips: z.array(clipSchema).min(1).max(COMPOSE_CLIPS_MAX).describe("The clips, in play order."),
    audio: z.array(audioSchema).max(COMPOSE_AUDIO_MAX).optional(),
    logo: logoSchema.optional(),
    captions: z.array(captionSchema).max(COMPOSE_CAPTIONS_MAX).optional(),
    aspect: z.enum(COMPOSE_ASPECTS),
    resolution: z.enum(COMPOSE_RESOLUTIONS),
})

/** The arguments of a compose call, as read. */
export type VideoComposeArgs = {
    /** The neutral compose spec. */
    readonly spec: ComposeSpec
}

/** The arguments of a render read, as read. */
export type VideoRenderGetArgs = {
    /** The render, as the compose call answered it. */
    readonly renderId: string
}

/** The arguments of `nivo.tool.video.compose`. */
export const VIDEO_COMPOSE_SCHEMA: z.ZodType<VideoComposeArgs> = z.strictObject({ spec: COMPOSE_SPEC_SCHEMA })

/** The arguments of `nivo.tool.video.render.get`. */
export const VIDEO_RENDER_GET_SCHEMA: z.ZodType<VideoRenderGetArgs> = z.strictObject({
    renderId: z.string().trim().min(1).max(RENDER_ID_MAX).describe("The render, as `nivo.tool.video.compose` answered it."),
})

/** The schemas the manifest announces, generated from the validators. */
export const VIDEO_COMPOSE_INPUT_SCHEMA: ToolJson = z.toJSONSchema(VIDEO_COMPOSE_SCHEMA, { io: "input" })
export const VIDEO_RENDER_GET_INPUT_SCHEMA: ToolJson = z.toJSONSchema(VIDEO_RENDER_GET_SCHEMA, { io: "input" })
