import { TOOL } from "@nivo-lite/agent-sdk/names"
import { type NodeContext, type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../../shared/bounds"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"
import { answered, valueOrCannot } from "../../../shared/nodes/tool-answers"
import { videoTitle } from "./video.copy"
import { SCENES_MAX, memberOf } from "./video.shapes"

/** The longest a signed address of a stored file lives, in seconds: seven days, the most the file store signs for. */
export const FILE_LINK_SECONDS = 604_800

/** The render record whose stored files are to be fetched by the compose service. */
export interface VideoLinksInput {
    /** The render whose files are listed. */
    readonly renderId: string
}

/** The signed address of each stored clip, in scene order, and of the narration when one was kept. */
export interface VideoLinksOutput {
    /** The clips of the render, each with the address of its file. */
    readonly clips: ReadonlyArray<{ readonly fileUrl: string }>
    /** The address of the voice-over file; null when the render has no voice. */
    readonly voiceUrl: string | null
}

const input: NodeSchema<VideoLinksInput> = z.object({ renderId: z.string().min(1).max(MAX_ID) })

const output: NodeSchema<VideoLinksOutput> = z.object({
    clips: z.array(z.object({ fileUrl: z.string().min(1).max(MAX_LINE * 8) })).min(1).max(SCENES_MAX),
    voiceUrl: z.string().min(1).max(MAX_LINE * 8).nullable(),
})

/** The object key of a stored file reference, or null. */
const keyOf = (file: unknown): string | null => {
    const key = memberOf(file, "key")
    return typeof key === "string" && key !== "" ? key : null
}

/** The signed address `nivo.tool.file.get` answers for one stored file; the run stops when it answers none. */
const addressOf = async (context: NodeContext, renderId: string, field: string, key: string | null): Promise<string> => {
    const got = valueOrCannot(
        context,
        TOOL.fileGet,
        await context.tools.call(TOOL.fileGet, {
            type: "blocks-core.video.render",
            id: renderId,
            field,
            ...(key === null ? {} : { key }),
            expiresInSeconds: FILE_LINK_SECONDS,
        }),
    )
    const url = memberOf(memberOf(got, "file"), "url")
    return typeof url === "string" && url !== "" ? url : context.fail({ kind: "cannot", why: `${TOOL.fileGet} answered no address` })
}

/**
 * `video.links` (Lay dia chi cac tep): the compose service fetches its inputs itself, so each stored file of the render record is
 * handed over as a signed address that outlives the render queue: one `nivo.tool.file.get` per clip (by its object key, scene order)
 * and one for the narration when a track was kept, every address valid for seven days. NIVO fetches none of them. A record with no
 * clip stops the run.
 */
export const videoLinksNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "video.links",
    title: videoTitle("nodeVideoLinksTitle"),
    description: { vi: "L\u1ea5y \u0111\u1ecba ch\u1ec9 t\u1ea1m th\u1eddi cho c\u00e1c \u0111o\u1ea1n phim v\u00e0 l\u1eddi \u0111\u1ecdc \u0111\u00e3 l\u01b0u \u0111\u1ec3 d\u1ecbch v\u1ee5 d\u1ef1ng video t\u1ea3i v\u1ec1.", en: "Gets temporary addresses for the stored clips and narration so the video service can fetch them." },
    tools: [],
    mode: "auto",
    accounts: [],
    input,
    output,
    run: async (given, context) => {
        const read = valueOrCannot(
            context,
            TOOL.recordGet,
            await context.tools.call(TOOL.recordGet, { type: "blocks-core.video.render", id: given.renderId }),
        )
        const values = memberOf(memberOf(read, "record"), "values")
        const stored = memberOf(values, "clips")
        const keys = Array.isArray(stored) ? stored.flatMap((file: unknown) => keyOf(file) ?? []) : []
        if (keys.length === 0) return context.fail({ kind: "cannot", why: "the render record holds no clip" })
        const clips: Array<{ readonly fileUrl: string }> = []
        for (const key of keys) clips.push({ fileUrl: await addressOf(context, given.renderId, "clips", key) })
        const voiceUrl = keyOf(memberOf(values, "voice")) === null ? null : await addressOf(context, given.renderId, "voice", null)
        return { clips, voiceUrl }
    },
    examples: [
        {
            name: "two stored clips and a narration get seven-day addresses, clips in scene order",
            params: {},
            input: { renderId: "r1" },
            tools: [
                {
                    id: TOOL.recordGet,
                    args: { type: "blocks-core.video.render", id: "r1" },
                    answer: answered({
                        record: {
                            id: "r1",
                            version: "2",
                            values: {
                                clips: [
                                    { key: "ws/blocks-core.video.render/r1/clips/o1", mime: "video/mp4", size: 2048, name: "scene-1.mp4" },
                                    { key: "ws/blocks-core.video.render/r1/clips/o2", mime: "video/mp4", size: 1024, name: "scene-2.mp4" },
                                ],
                                voice: { key: "ws/blocks-core.video.render/r1/voice/o3", mime: "audio/mpeg", size: 4096, name: "narration.mp3" },
                            },
                        },
                    }),
                },
                {
                    id: TOOL.fileGet,
                    args: { type: "blocks-core.video.render", id: "r1", field: "clips", key: "ws/blocks-core.video.render/r1/clips/o1", expiresInSeconds: 604_800 },
                    answer: answered({ file: { url: "https://files.example/c1.mp4", expiresAt: "2026-11-20T08:00:00.000Z" } }),
                },
                {
                    id: TOOL.fileGet,
                    args: { type: "blocks-core.video.render", id: "r1", field: "clips", key: "ws/blocks-core.video.render/r1/clips/o2", expiresInSeconds: 604_800 },
                    answer: answered({ file: { url: "https://files.example/c2.mp4", expiresAt: "2026-11-20T08:00:00.000Z" } }),
                },
                {
                    id: TOOL.fileGet,
                    args: { type: "blocks-core.video.render", id: "r1", field: "voice", expiresInSeconds: 604_800 },
                    answer: answered({ file: { url: "https://files.example/v.mp3", expiresAt: "2026-11-20T08:00:00.000Z" } }),
                },
            ],
            output: {
                clips: [{ fileUrl: "https://files.example/c1.mp4" }, { fileUrl: "https://files.example/c2.mp4" }],
                voiceUrl: "https://files.example/v.mp3",
            },
        },
        {
            name: "a render with no narration has no voice address",
            params: {},
            input: { renderId: "r1" },
            tools: [
                {
                    id: TOOL.recordGet,
                    args: { type: "blocks-core.video.render", id: "r1" },
                    answer: answered({
                        record: {
                            id: "r1",
                            version: "2",
                            values: { clips: [{ key: "ws/blocks-core.video.render/r1/clips/o1", mime: "video/mp4", size: 2048, name: "scene-1.mp4" }], voice: null },
                        },
                    }),
                },
                {
                    id: TOOL.fileGet,
                    args: { type: "blocks-core.video.render", id: "r1", field: "clips", key: "ws/blocks-core.video.render/r1/clips/o1", expiresInSeconds: 604_800 },
                    answer: answered({ file: { url: "https://files.example/c1.mp4", expiresAt: "2026-11-20T08:00:00.000Z" } }),
                },
            ],
            output: { clips: [{ fileUrl: "https://files.example/c1.mp4" }], voiceUrl: null },
        },
        {
            name: "a record with no clip stops the run",
            params: {},
            input: { renderId: "r1" },
            tools: [
                {
                    id: TOOL.recordGet,
                    args: { type: "blocks-core.video.render", id: "r1" },
                    answer: answered({ record: { id: "r1", version: "1", values: { clips: [] } } }),
                },
            ],
            failure: { kind: "cannot", why: "the render record holds no clip" },
        },
    ],
})
