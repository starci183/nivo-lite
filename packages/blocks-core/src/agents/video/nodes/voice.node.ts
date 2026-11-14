import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../../shared/bounds"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"
import { answered, refused, valueOrCannot, viaAccount } from "../../../shared/nodes/tool-answers"
import { videoTitle } from "./video.copy"
import { VOICE_TEXT_MAX, memberOf, storedOf } from "./video.shapes"

/** The words to say, the voice to say them with and the render record that keeps the track. */
export interface VideoVoiceInput {
    /** What the one narration track says; empty for no narration. */
    readonly text: string
    /** The provider's voice the brand kit chose, or null to take the account's first. */
    readonly voiceId: string | null
    /** The `blocks-core.video.render` record whose `voice` field keeps the track. */
    readonly renderId: string
}

/** Whether a narration track was made and stored. */
export interface VideoVoiceOutput {
    /** True when the voice-over file was kept. */
    readonly kept: boolean
    /** True when a person declined making the narration or storing it on its card: no narration was kept. */
    readonly declined: boolean
}

const input: NodeSchema<VideoVoiceInput> = z.object({
    text: z.string().max(VOICE_TEXT_MAX),
    voiceId: z.string().min(1).max(MAX_ID).nullable(),
    renderId: z.string().min(1).max(MAX_ID),
})

const output: NodeSchema<VideoVoiceOutput> = z.object({
    kept: z.boolean().describe("True once the narration track is stored on the render record; false when the script has no words."),
    declined: z.boolean().describe("True when a person declined making the narration or storing it on its card: no narration was kept."),
})

/** The language of the shop's videos. */
const LANGUAGE = "vi"

/** The file name the narration is kept under: an `.mp3` when the provider answered MPEG audio. */
const trackNameOf = (file: unknown): string => (memberOf(file, "mimeType") === "audio/mpeg" ? "narration.mp3" : "narration")

/** The first voice a voice list answered, or null. */
const firstVoiceOf = (page: unknown): string | null => {
    const voices = memberOf(page, "voices")
    const voiceId = Array.isArray(voices) ? memberOf(voices[0], "voiceId") : undefined
    return typeof voiceId === "string" && voiceId !== "" ? voiceId : null
}

/**
 * `video.voice` (Doc loi video): reads the script's words aloud as ONE narration track on the connected speech account, with the
 * brand's voice (or the account's first voice when the brand chose none), and stores the track as it is in the `voice` field of the
 * render record (`nivo.tool.file.put`). The clips keep their own sound; the track is a separate file. A script with no words has no
 * narration: nothing is called. A track the speech account made but the file store did not keep stops the run; a person declining the narration or its storing is `declined: true` (the graph ends the run `declined`).
 */
export const videoVoiceNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "video.voice",
    title: videoTitle("nodeVideoVoiceTitle"),
    description: { vi: "\u0110\u1ecdc l\u1eddi c\u1ee7a k\u1ecbch b\u1ea3n th\u00e0nh m\u1ed9t \u0111o\u1ea1n thuy\u1ebft minh b\u1eb1ng gi\u1ecdng c\u1ee7a th\u01b0\u01a1ng hi\u1ec7u v\u00e0 l\u01b0u l\u1ea1i c\u00f9ng b\u1ea3n ghi d\u1ef1ng video.", en: "Reads the script's words aloud as one narration in the brand's voice and stores it on the video record." },
    tools: [TOOL.speechVoiceList, TOOL.speechGenerate],
    mode: "auto",
    accounts: [PROVIDER.elevenlabs],
    input,
    output,
    run: async (given, context) => {
        if (given.text.trim() === "") return { kept: false, declined: false }
        const voiceId =
            given.voiceId ??
            firstVoiceOf(
                valueOrCannot(
                    context,
                    TOOL.speechVoiceList,
                    await context.tools.call(TOOL.speechVoiceList, { pageSize: 1 }),
                ),
            )
        if (voiceId === null) return context.fail({ kind: "cannot", why: "the speech account offers no voice" })
        const made = await context.tools.call(TOOL.speechGenerate, { text: given.text, voiceId, languageCode: LANGUAGE })
        if (!made.ok && made.declined === true) return { kept: false, declined: true }
        const spoken = valueOrCannot(context, TOOL.speechGenerate, made)
        const file = memberOf(spoken, "file")
        const staged = storedOf(file)
        if (staged === null) return context.fail({ kind: "cannot", why: "the voice track was not kept by the file store" })
        const put = await context.tools.call(TOOL.filePut, {
            type: "blocks-core.video.render",
            id: given.renderId,
            field: "voice",
            staged,
            name: trackNameOf(file),
        })
        if (!put.ok && put.declined === true) return { kept: false, declined: true }
        valueOrCannot(context, TOOL.filePut, put)
        return { kept: true, declined: false }
    },
    examples: [
        {
            name: "the brand's voice reads the script: the track is stored on the render record",
            params: {},
            input: { text: "Tu\u1ea7n n\u00e0y hoa h\u1ed3ng gi\u1ea3m gi\u00e1.", voiceId: "voice-1", renderId: "r1" },
            tools: [
                {
                    id: TOOL.speechGenerate,
                    args: { text: "Tu\u1ea7n n\u00e0y hoa h\u1ed3ng gi\u1ea3m gi\u00e1.", voiceId: "voice-1", languageCode: "vi" },
                    answer: answered(
                        { file: { provider: "elevenlabs", connectionId: "c1", handle: "h1", mimeType: "audio/mpeg", expiresAt: null, stored: "ws/staged/v1" } },
                        viaAccount(PROVIDER.elevenlabs, "c1"),
                    ),
                },
                {
                    id: TOOL.filePut,
                    args: { type: "blocks-core.video.render", id: "r1", field: "voice", staged: "ws/staged/v1", name: "narration.mp3" },
                    answer: answered({
                        file: { key: "ws/blocks-core.video.render/r1/voice/o1", mime: "audio/mpeg", size: 4096, name: "narration.mp3" },
                    }),
                },
            ],
            output: { kept: true, declined: false },
        },
        {
            name: "no brand voice: the account's first voice reads it",
            params: {},
            input: { text: "Xin ch\u00e0o.", voiceId: null, renderId: "r1" },
            tools: [
                {
                    id: TOOL.speechVoiceList,
                    args: { pageSize: 1 },
                    answer: answered({ voices: [{ voiceId: "voice-9", name: "Mai" }], nextPageToken: null }, viaAccount(PROVIDER.elevenlabs)),
                },
                {
                    id: TOOL.speechGenerate,
                    args: { text: "Xin ch\u00e0o.", voiceId: "voice-9", languageCode: "vi" },
                    answer: answered({ file: { provider: "elevenlabs", handle: "h2", mimeType: null, stored: "ws/staged/v2" } }, viaAccount(PROVIDER.elevenlabs)),
                },
                {
                    id: TOOL.filePut,
                    args: { type: "blocks-core.video.render", id: "r1", field: "voice", staged: "ws/staged/v2", name: "narration" },
                    answer: answered({
                        file: { key: "ws/blocks-core.video.render/r1/voice/o2", mime: "audio/mpeg", size: 2048, name: "narration" },
                    }),
                },
            ],
            output: { kept: true, declined: false },
        },
        {
            name: "a script with no words has no narration: nothing is called",
            params: {},
            input: { text: "", voiceId: "voice-1", renderId: "r1" },
            tools: [],
            output: { kept: false, declined: false },
        },
        {
            name: "a person declines the narration on its card: nothing is stored and the node says declined",
            params: {},
            input: { text: "Xin ch\u00e0o.", voiceId: "voice-1", renderId: "r1" },
            tools: [
                {
                    id: TOOL.speechGenerate,
                    args: { text: "Xin ch\u00e0o.", voiceId: "voice-1", languageCode: "vi" },
                    answer: refused("declined"),
                },
            ],
            output: { kept: false, declined: true },
        },
        {
            name: "a person declines storing the narration track: the node says declined",
            params: {},
            input: { text: "Xin ch\u00e0o.", voiceId: "voice-1", renderId: "r1" },
            tools: [
                {
                    id: TOOL.speechGenerate,
                    args: { text: "Xin ch\u00e0o.", voiceId: "voice-1", languageCode: "vi" },
                    answer: answered({ file: { provider: "elevenlabs", handle: "h5", mimeType: "audio/mpeg", stored: "ws/staged/v5" } }, viaAccount(PROVIDER.elevenlabs)),
                },
                {
                    id: TOOL.filePut,
                    args: { type: "blocks-core.video.render", id: "r1", field: "voice", staged: "ws/staged/v5", name: "narration.mp3" },
                    answer: refused("declined"),
                },
            ],
            output: { kept: false, declined: true },
        },
        {
            name: "a track the file store did not keep stops the run",
            params: {},
            input: { text: "Xin ch\u00e0o.", voiceId: "voice-1", renderId: "r1" },
            tools: [
                {
                    id: TOOL.speechGenerate,
                    args: { text: "Xin ch\u00e0o.", voiceId: "voice-1", languageCode: "vi" },
                    answer: answered({ file: { provider: "elevenlabs", handle: "h3", stored: null } }, viaAccount(PROVIDER.elevenlabs)),
                },
            ],
            failure: { kind: "cannot", why: "the voice track was not kept by the file store" },
        },
        {
            name: "the render record refuses the track (its size): the run stops",
            params: {},
            input: { text: "Xin ch\u00e0o.", voiceId: "voice-1", renderId: "r1" },
            tools: [
                {
                    id: TOOL.speechGenerate,
                    args: { text: "Xin ch\u00e0o.", voiceId: "voice-1", languageCode: "vi" },
                    answer: answered({ file: { provider: "elevenlabs", handle: "h4", mimeType: "audio/mpeg", stored: "ws/staged/v4" } }, viaAccount(PROVIDER.elevenlabs)),
                },
                {
                    id: TOOL.filePut,
                    args: { type: "blocks-core.video.render", id: "r1", field: "voice", staged: "ws/staged/v4", name: "narration.mp3" },
                    answer: refused("too_big"),
                },
            ],
            failure: { kind: "cannot", why: `${TOOL.filePut} refused: too_big` },
        },
    ],
})
