import { z } from "zod"
import type { ToolJson } from "@modules/domain/tools"
import { ELEVENLABS_OUTPUT_FORMATS, ELEVENLABS_SEED_MAX, ELEVENLABS_VOICE_PAGE_MAX } from "@modules/integrations/elevenlabs"
import { VEO_ASPECT_RATIOS, VEO_DURATIONS, VEO_IMAGE_TYPES, VEO_PERSON_GENERATION, VEO_RESOLUTIONS } from "@modules/integrations/veo"

/**
 * The bounded arguments of the generic media tools. Bounds the providers document are theirs (cited in their integration); a bound no
 * provider documents is NIVO's own and says so. A provider's enumerated words (output formats, aspect ratios) are taken from the one
 * provider that serves the purpose today and grow with a second.
 */

/** NIVO's own bound of one text to speak (ElevenLabs' convert page states none). */
export const SPEECH_TEXT_MAX = 5_000

/** NIVO's own bound of an id a provider answered (a voice, a model, a job). */
const ID_MAX = 200

/** NIVO's own bound of a prompt (the Veo guide states none). */
export const VIDEO_PROMPT_MAX = 4_000

/** NIVO's own bound of a start image, as base64 characters (about 7.5 MB of bytes; the Veo guide states none). */
export const VIDEO_IMAGE_MAX = 10_000_000

const id = (what: string): z.ZodString => z.string().trim().min(1).max(ID_MAX).describe(what)

/** A language code: ISO 639-1 (two letters) or 639-3 (three), as the providers take it. */
const language = (what: string): z.ZodString =>
    z
        .string()
        .max(3)
        .regex(/^[a-z]{2,3}$/u)
        .describe(what)

export const SPEECH_GENERATE_SCHEMA = z
    .object({
        text: z.string().min(1).max(SPEECH_TEXT_MAX).describe("The text to speak."),
        voiceId: id("The voice, as `nivo.tool.speech.voice.list` answered it."),
        modelId: id("The provider's model; absent for its default.").optional(),
        languageCode: language("The language (ISO 639-1); absent to let the model decide.").optional(),
        format: z.enum(ELEVENLABS_OUTPUT_FORMATS).optional().describe("The audio format; absent for the provider's default (MP3)."),
        seed: z.number().int().min(0).max(ELEVENLABS_SEED_MAX).optional().describe("A seed, for a repeatable clip (best effort)."),
    })
    .strict()

export const SPEECH_VOICE_LIST_SCHEMA = z
    .object({
        search: z.string().trim().min(1).max(200).optional().describe("Words to search the voices by (name, labels)."),
        pageSize: z.number().int().min(1).max(ELEVENLABS_VOICE_PAGE_MAX).optional().describe("The most voices in the answer."),
        pageToken: z.string().min(1).max(2048).optional().describe("Only to page: the `nextPageToken` an earlier answer gave."),
    })
    .strict()

export const DUBBING_CREATE_SCHEMA = z
    .object({
        sourceUrl: z.url({ protocol: /^https$/u }).max(2048).describe("The https address of the video or audio to dub."),
        targetLanguage: language("The language to dub into (ISO 639-1 or 639-3)."),
        sourceLanguage: language("The source language; absent to detect it.").optional(),
        name: z.string().trim().min(1).max(200).optional().describe("A name for the job."),
        speakers: z.number().int().min(0).max(50).optional().describe("How many speakers; 0 or absent detects them."),
        watermark: z.boolean().optional().describe("Whether the output carries the provider's watermark."),
    })
    .strict()

export const JOB_GET_SCHEMA = z.object({ jobId: id("The job, as its create call answered it.") }).strict()

export const VIDEO_GENERATE_SCHEMA = z
    .object({
        prompt: z.string().min(1).max(VIDEO_PROMPT_MAX).describe("What the video shows."),
        image: z
            .object({
                mimeType: z.enum(VEO_IMAGE_TYPES),
                data: z.base64().max(VIDEO_IMAGE_MAX),
            })
            .strict()
            .optional()
            .describe("The image the video starts from, base64."),
        modelId: id("The provider's model; absent for the account's own.").optional(),
        aspectRatio: z.enum(VEO_ASPECT_RATIOS).optional(),
        resolution: z.enum(VEO_RESOLUTIONS).optional(),
        durationSeconds: z.enum(VEO_DURATIONS).optional(),
        personGeneration: z.enum(VEO_PERSON_GENERATION).optional(),
        seed: z.number().int().min(0).max(4_294_967_295).optional(),
    })
    .strict()

/** The schemas the manifest announces, generated from the validators. */
export const SPEECH_GENERATE_INPUT_SCHEMA: ToolJson = z.toJSONSchema(SPEECH_GENERATE_SCHEMA, { io: "input" })
export const SPEECH_VOICE_LIST_INPUT_SCHEMA: ToolJson = z.toJSONSchema(SPEECH_VOICE_LIST_SCHEMA, { io: "input" })
export const DUBBING_CREATE_INPUT_SCHEMA: ToolJson = z.toJSONSchema(DUBBING_CREATE_SCHEMA, { io: "input" })
export const JOB_GET_INPUT_SCHEMA: ToolJson = z.toJSONSchema(JOB_GET_SCHEMA, { io: "input" })
export const VIDEO_GENERATE_INPUT_SCHEMA: ToolJson = z.toJSONSchema(VIDEO_GENERATE_SCHEMA, { io: "input" })
