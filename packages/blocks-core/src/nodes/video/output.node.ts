import { TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../bounds"
import type { NodeSchema } from "../node-schema.types"
import { answered, refused, valueOrCannot } from "../tool-answers"
import { videoTitle } from "./video.copy"
import { memberOf } from "./video.shapes"

/** The render record that keeps the making and the address of the composed video at the compose service. */
export interface VideoOutputInput {
    /** The render whose finished file is read. */
    readonly renderId: string
    /** The https address of the finished video; null when the service gave none, which stops the run. */
    readonly outputUrl: string | null
}

/** The object key the composed video is stored under. */
export interface VideoOutputOutput {
    /** The key of the stored video, or null when a person declined. */
    readonly outputKey: string | null
    /** True when a person declined storing the video or marking the render done on its card: the video is not kept as done. */
    readonly declined: boolean
}

const input: NodeSchema<VideoOutputInput> = z.object({
    renderId: z.string().min(1).max(MAX_ID),
    outputUrl: z.string().min(1).max(MAX_LINE * 8).nullable(),
})

const output: NodeSchema<VideoOutputOutput> = z.object({
    outputKey: z.string().min(1).max(MAX_LINE).nullable().describe("The object key of the composed video in the file store; null when a person declined."),
    declined: z.boolean().describe("True when a person declined storing the video or marking the render done on its card: the video is not kept as done."),
})

/** The file name the composed video is kept under. */
const OUTPUT_NAME = "video.mp4"

/**
 * `video.output` (Luu video da dung): the compose service keeps its output for a limited time, so the finished video is copied at once
 * into the `output` field of the render record (`nivo.tool.file.put` with the service's https address, fetched once by the file
 * store) and the render is marked `done`. A video the file store refuses (its type, its size, the plan's storage) stops the run; a person declining the copy or the mark is `declined: true` (the graph ends the run `declined`).
 */
export const videoOutputNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "video.output",
    title: videoTitle("nodeVideoOutputTitle"),
    description: { vi: "Sao ch\u00e9p video \u0111\u00e3 d\u1ef1ng v\u1ec1 kho c\u1ee7a c\u1eeda h\u00e0ng ngay khi d\u1ef1ng xong v\u00e0 \u0111\u00e1nh d\u1ea5u ho\u00e0n t\u1ea5t.", en: "Copies the finished video into the shop's storage as soon as it is made and marks it done." },
    tools: [],
    mode: "auto",
    accounts: [],
    input,
    output,
    run: async (given, context) => {
        if (given.outputUrl === null) return context.fail({ kind: "cannot", why: "the compose service gave no address for the video" })
        const copied = await context.tools.call(TOOL.filePut, {
            type: "blocks-core.video.render",
            id: given.renderId,
            field: "output",
            url: given.outputUrl,
            name: OUTPUT_NAME,
        })
        if (!copied.ok && copied.declined === true) return { outputKey: null, declined: true }
        const stored = valueOrCannot(context, TOOL.filePut, copied)
        const outputKey = memberOf(memberOf(stored, "file"), "key")
        if (typeof outputKey !== "string" || outputKey === "")
            return context.fail({ kind: "cannot", why: `${TOOL.filePut} answered no file key` })
        const marked = await context.tools.call(TOOL.recordUpdate, {
            type: "blocks-core.video.render",
            id: given.renderId,
            patch: { state: "done", error: null },
        })
        if (!marked.ok && marked.declined === true) return { outputKey: null, declined: true }
        valueOrCannot(context, TOOL.recordUpdate, marked)
        return { outputKey, declined: false }
    },
    examples: [
        {
            name: "the composed video is copied into the render record and the render is done",
            params: {},
            input: { renderId: "r1", outputUrl: "https://out.example/rnd-1.mp4" },
            tools: [
                {
                    id: TOOL.filePut,
                    args: { type: "blocks-core.video.render", id: "r1", field: "output", url: "https://out.example/rnd-1.mp4", name: "video.mp4" },
                    answer: answered({ file: { key: "ws/blocks-core.video.render/r1/output/o9", mime: "video/mp4", size: 8_000_000, name: "video.mp4" } }),
                },
                {
                    id: TOOL.recordUpdate,
                    args: { type: "blocks-core.video.render", id: "r1", patch: { state: "done", error: null } },
                    answer: answered({ record: { id: "r1", version: "4", values: {} } }),
                },
            ],
            output: { outputKey: "ws/blocks-core.video.render/r1/output/o9", declined: false },
        },
        {
            name: "a person declines storing the video: nothing is kept and the node says declined",
            params: {},
            input: { renderId: "r1", outputUrl: "https://out.example/rnd-1.mp4" },
            tools: [
                {
                    id: TOOL.filePut,
                    args: { type: "blocks-core.video.render", id: "r1", field: "output", url: "https://out.example/rnd-1.mp4", name: "video.mp4" },
                    answer: refused("declined"),
                },
            ],
            output: { outputKey: null, declined: true },
        },
        {
            name: "a person declines marking the render done: the node says declined",
            params: {},
            input: { renderId: "r1", outputUrl: "https://out.example/rnd-1.mp4" },
            tools: [
                {
                    id: TOOL.filePut,
                    args: { type: "blocks-core.video.render", id: "r1", field: "output", url: "https://out.example/rnd-1.mp4", name: "video.mp4" },
                    answer: answered({ file: { key: "ws/blocks-core.video.render/r1/output/o9", mime: "video/mp4", size: 8_000_000, name: "video.mp4" } }),
                },
                {
                    id: TOOL.recordUpdate,
                    args: { type: "blocks-core.video.render", id: "r1", patch: { state: "done", error: null } },
                    answer: refused("declined"),
                },
            ],
            output: { outputKey: null, declined: true },
        },
        {
            name: "a render done with no address stops the run",
            params: {},
            input: { renderId: "r1", outputUrl: null },
            tools: [],
            failure: { kind: "cannot", why: "the compose service gave no address for the video" },
        },
        {
            name: "the file store refuses the video (too big): the run stops",
            params: {},
            input: { renderId: "r1", outputUrl: "https://out.example/rnd-1.mp4" },
            tools: [
                {
                    id: TOOL.filePut,
                    args: { type: "blocks-core.video.render", id: "r1", field: "output", url: "https://out.example/rnd-1.mp4", name: "video.mp4" },
                    answer: refused("too_big"),
                },
            ],
            failure: { kind: "cannot", why: `${TOOL.filePut} refused: too_big` },
        },
    ],
})
