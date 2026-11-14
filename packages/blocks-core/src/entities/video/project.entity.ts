import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"
import { z, type ZodType } from "zod"
import { MAX_LINE } from "../../bounds"
import {
    CAPTION_MAX,
    SCENE_ROLES,
    SCRIPT_SCENES_MAX,
    type ScriptScene,
    VISUAL_MAX,
    VOICEOVER_MAX,
} from "../../rules/video/script"
import { VIDEO_ASPECTS, VIDEO_DEFAULT_SECONDS, VIDEO_GOALS } from "../../rules/video/spec"

/** Where a video project stands: drafted, scripted, being made, waiting for review, published, failed, or put away. */
export const VIDEO_PROJECT_STATUSES = [
    "draft",
    "scripted",
    "rendering",
    "review",
    "published",
    "failed",
    "archived",
] as const

/** One status of a video project. */
export type VideoProjectStatus = (typeof VIDEO_PROJECT_STATUSES)[number]

/** The longest brief an owner writes for a video. */
export const VIDEO_BRIEF_MAX = 2_000

/** The script of a project as the entity keeps it: its scenes, in order. */
export type VideoScript = {
    /** The scenes of the script, in the order they play. */
    readonly scenes: ReadonlyArray<ScriptScene>
}

/** The shape of the stored script. */
export const videoScriptShape: ZodType<VideoScript> = z.object({
    scenes: z
        .array(
            z.object({
                role: z.enum(SCENE_ROLES),
                caption: z.string().max(CAPTION_MAX),
                voiceover: z.string().max(VOICEOVER_MAX),
                visual: z.string().max(VISUAL_MAX),
            }),
        )
        .max(SCRIPT_SCENES_MAX),
})

type ProjectFields = {
    readonly title: FieldDef<"text", false>
    readonly goal: FieldDef<"enum", false>
    readonly aspect: FieldDef<"enum", false>
    readonly targetSeconds: FieldDef<"int", false>
    readonly brief: FieldDef<"text", false>
    readonly status: FieldDef<"enum", false>
    readonly script: FieldDef<"jsonb", false> & { readonly shape: ZodType<VideoScript> }
    readonly lastError: FieldDef<"text", true>
    readonly publishedAt: FieldDef<"timestamptz", true>
}

const projectFields: ProjectFields = {
    title: field.text({ maxLength: MAX_LINE }),
    goal: field.enum({ of: VIDEO_GOALS, default: { literal: "custom" } }),
    aspect: field.enum({ of: VIDEO_ASPECTS, default: { literal: "9:16" } }),
    targetSeconds: field.int({ default: { literal: VIDEO_DEFAULT_SECONDS } }),
    brief: field.text({ maxLength: VIDEO_BRIEF_MAX, default: "empty" }),
    status: field.enum({ of: VIDEO_PROJECT_STATUSES, default: { literal: "draft" } }),
    script: field.jsonb({ shape: videoScriptShape }),
    lastError: field.text({ maxLength: MAX_LINE, nullable: true }),
    publishedAt: field.timestamptz({ nullable: true }),
}

/**
 * One short video a shop is making: what it is for, its shape and length, the owner's brief, the script the video agent wrote and
 * where it stands. Written by the workbench (the owner's edits) and by the `video.produce` graph (the script, the status). Graph node
 * kind `video-project`.
 */
export const videoProjectEntity: EntityDefinition<ProjectFields> = defineEntity({
    name: "blocks-core.video.project",
    dataKind: "video-project",
    fields: projectFields,
    indexes: [
        { name: "recent", on: [{ desc: "createdAt" }, { desc: "id" }] },
        { name: "status_recent", on: ["status", { desc: "createdAt" }, { desc: "id" }] },
    ],
})
