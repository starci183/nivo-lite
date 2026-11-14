import { z } from "zod"
import { MAX_ID } from "../../../shared/bounds"
import { CLIP_SECONDS, type ClipSeconds, VIDEO_ASPECTS, type VideoAspect } from "../rules/spec"
import { CAPTION_MAX, SCENE_ROLES, SCRIPT_SCENES_MAX, type ScriptScene, VISUAL_MAX, VOICEOVER_MAX } from "../rules/script"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"

/** The longest prompt one scene's clip is asked with. */
export const SHOT_PROMPT_MAX = 4_000

/** The longest text one voice track says. */
export const VOICE_TEXT_MAX = 5_000

/** One scene of a script, as the nodes pass it on. */
export const sceneSchema: NodeSchema<ScriptScene> = z.object({
    role: z.enum(SCENE_ROLES),
    caption: z.string().max(CAPTION_MAX),
    voiceover: z.string().max(VOICEOVER_MAX),
    visual: z.string().max(VISUAL_MAX),
})

/** One clip to generate: its key (the scene's position), what it shows, its length and its frame. */
export type Shot = {
    /** The key of the shot, the same as its scene. */
    readonly key: string
    /** What the shot shows, as the video provider is asked for it. */
    readonly prompt: string
    /** How long the shot runs. */
    readonly seconds: ClipSeconds
    /** The shape of the shot. */
    readonly aspect: VideoAspect
}

/** The zod type of one clip to generate. */
export type ShotSchema = z.ZodObject<{
    key: z.ZodString
    prompt: z.ZodString
    seconds: z.ZodUnion<[z.ZodLiteral<4>, z.ZodLiteral<6>, z.ZodLiteral<8>]>
    aspect: z.ZodEnum<{ "9:16": "9:16"; "16:9": "16:9" }>
}>

/** The schema of one clip to generate. */
export const shotSchema: ShotSchema = z.object({
    key: z.string().min(1).max(MAX_ID),
    prompt: z.string().min(1).max(SHOT_PROMPT_MAX),
    seconds: z.union([z.literal(CLIP_SECONDS[0]), z.literal(CLIP_SECONDS[1]), z.literal(CLIP_SECONDS[2])]),
    aspect: z.enum(VIDEO_ASPECTS),
})

/** A frame of a video. */
export const aspectSchema: NodeSchema<VideoAspect> = z.enum(VIDEO_ASPECTS)

/** The most scenes a node passes on. */
export const SCENES_MAX: number = SCRIPT_SCENES_MAX

/** The member `key` of a value that is an object, else undefined: how a node reads a tool's answer it does not trust. */
export const memberOf = (value: unknown, key: string): unknown =>
    typeof value === "object" && value !== null && !Array.isArray(value) ? Reflect.get(value, key) : undefined

/** The staged file a provider tool's file reference holds once the file store kept it, else null. */
export const storedOf = (file: unknown): string | null => {
    const stored = memberOf(file, "stored")
    return typeof stored === "string" && stored !== "" ? stored : null
}
