import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"
import { z, type ZodType } from "zod"
import { MAX_ID, MAX_LINE } from "../../bounds"
import { SCRIPT_SCENES_MAX } from "../../rules/video/script"

/** Where one making of a video stands: its clips are being generated, a compose service is joining them, it is done, or it failed. */
export const VIDEO_RENDER_STATES = ["generating", "composing", "done", "failed"] as const

/** One state of a render. */
export type VideoRenderState = (typeof VIDEO_RENDER_STATES)[number]

/** The most clip jobs one render follows, and the most clips it keeps: one per scene of a script. */
export const RENDER_JOBS_MAX: number = SCRIPT_SCENES_MAX

/** The largest clip kept, in bytes (a clip is a few seconds long). */
export const RENDER_CLIP_MAX_BYTES: number = 100 * 1024 * 1024

/** The largest narration track kept, in bytes. */
export const RENDER_VOICE_MAX_BYTES: number = 20 * 1024 * 1024

/** The largest composed video kept, in bytes. */
export const RENDER_OUTPUT_MAX_BYTES: number = 300 * 1024 * 1024

/** The longest id of a render at its compose service, and the longest provider key kept beside it. */
export const RENDER_ID_AT_PROVIDER_MAX = 200
export const RENDER_PROVIDER_MAX = 40

/** The provider jobs a render follows, one per scene, in scene order. */
export type RenderJobs = {
    /** The ids of the provider jobs started for this render, one per clip. */
    readonly ids: ReadonlyArray<string>
}

/** The shape of the stored jobs. */
export const renderJobsShape: ZodType<RenderJobs> = z.object({
    ids: z.array(z.string().min(1).max(MAX_ID)).max(RENDER_JOBS_MAX),
})

type RenderFields = {
    readonly projectId: FieldDef<"uuid", false>
    readonly state: FieldDef<"enum", false>
    readonly jobs: FieldDef<"jsonb", false> & { readonly shape: ZodType<RenderJobs> }
    readonly clips: FieldDef<"file", false> & { readonly many: true }
    readonly voice: FieldDef<"file", true>
    readonly output: FieldDef<"file", true>
    readonly renderId: FieldDef<"text", true>
    readonly provider: FieldDef<"text", true>
    readonly error: FieldDef<"text", true>
}

const renderFields: RenderFields = {
    projectId: field.uuid(),
    state: field.enum({ of: VIDEO_RENDER_STATES, default: { literal: "generating" } }),
    jobs: field.jsonb({ shape: renderJobsShape }),
    clips: field.file({ many: true, max: RENDER_JOBS_MAX, accept: ["video/mp4", "video/webm"], maxBytes: RENDER_CLIP_MAX_BYTES }),
    voice: field.file({ accept: ["audio/*"], maxBytes: RENDER_VOICE_MAX_BYTES }),
    output: field.file({ accept: ["video/mp4"], maxBytes: RENDER_OUTPUT_MAX_BYTES }),
    renderId: field.text({ maxLength: RENDER_ID_AT_PROVIDER_MAX, nullable: true }),
    provider: field.text({ maxLength: RENDER_PROVIDER_MAX, nullable: true }),
    error: field.text({ maxLength: MAX_LINE, nullable: true }),
}

/**
 * One making of a project's video: the provider jobs of its clips, where it stands, the clips themselves (one file per scene, in scene
 * order, as the video provider made them, sound included), the narration track (one audio file), the composed video (one file, made
 * by the connected compose service from the clips, the narration, the captions and the logo; copied here because the service's
 * address expires), the compose service's render id and provider key, and the failure when it failed. Files are references of the
 * core's file store. Each run of `video.produce` writes one. NIVO joins nothing itself. Graph node kind `video-render`.
 */
export const videoRenderEntity: EntityDefinition<RenderFields> = defineEntity({
    name: "blocks-core.video.render",
    dataKind: "video-render",
    fields: renderFields,
    indexes: [
        { name: "project_recent", on: ["projectId", { desc: "createdAt" }, { desc: "id" }] },
        { name: "state_recent", on: ["state", { desc: "createdAt" }, { desc: "id" }] },
    ],
})
