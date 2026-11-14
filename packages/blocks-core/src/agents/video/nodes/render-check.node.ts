import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../../shared/bounds"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"
import { answered, refused, textOrNull, valueOrCannot, viaAccount } from "../../../shared/nodes/tool-answers"
import { videoTitle } from "./video.copy"
import { memberOf } from "./video.shapes"

/** Where a render stands at the compose service. */
export const RENDER_STATUSES = ["queued", "rendering", "done", "failed"] as const

/** One status of a render. */
export type RenderStatus = (typeof RENDER_STATUSES)[number]

/** The render to read: the compose service's id of it (null when none was started, which stops the run). */
export interface VideoRenderCheckInput {
    /** The render to check; null when none was started. */
    readonly renderId: string | null
}

/** Where the render stands, the address of the video once done, the service's words once failed. */
export interface VideoRenderCheckOutput {
    /** Where the render stands at the provider. */
    readonly status: RenderStatus
    /** The address of the finished file; null until the render is done. */
    readonly outputUrl: string | null
    /** The provider's error text; null when there is none. */
    readonly error: string | null
}

const input: NodeSchema<VideoRenderCheckInput> = z.object({ renderId: z.string().min(1).max(MAX_ID).nullable() })

const output: NodeSchema<VideoRenderCheckOutput> = z.object({
    status: z.enum(RENDER_STATUSES).describe("queued or rendering: not finished; done: the video is ready; failed: the service could not make it."),
    outputUrl: z.string().min(1).max(MAX_LINE * 8).nullable().describe("The https address of the finished video, once done."),
    error: z.string().max(MAX_LINE).nullable(),
})

/** What a failed render says when the service gave no words. */
const NO_REASON = "the compose service gave no reason"

/** The status a read answered; the run stops on a word the contract does not name. */
const statusOf = (value: unknown): RenderStatus | null => RENDER_STATUSES.find((status) => status === value) ?? null

/**
 * `video.render-check` (Xem tien do dung video): reads one render at the connected compose service (the account that took it,
 * `nivo.tool.video.render.get`) and says where it stands. The graph runs it round after round, minutes apart, until the render is done
 * or failed. A read: it never asks.
 */
export const videoRenderCheckNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "video.render-check",
    title: videoTitle("nodeVideoRenderCheckTitle"),
    description: { vi: "H\u1ecfi d\u1ecbch v\u1ee5 d\u1ef1ng video xem video \u0111ang d\u1ef1ng \u0111\u1ebfn \u0111\u00e2u: \u0111ang d\u1ef1ng, xong hay l\u1ed7i.", en: "Asks the video service how the render stands: still going, done or failed." },
    tools: [TOOL.videoRenderGet],
    mode: "auto",
    accounts: [PROVIDER.shotstack, PROVIDER.creatomate, PROVIDER.json2video],
    input,
    output,
    run: async (given, context) => {
        if (given.renderId === null) return context.fail({ kind: "cannot", why: "no render was started" })
        const read = valueOrCannot(
            context,
            TOOL.videoRenderGet,
            await context.tools.call(TOOL.videoRenderGet, { renderId: given.renderId }),
        )
        const status = statusOf(memberOf(read, "status"))
        if (status === null) return context.fail({ kind: "cannot", why: `${TOOL.videoRenderGet} answered no known status` })
        const words = textOrNull(memberOf(read, "error"))
        const error = words ?? (status === "failed" ? NO_REASON : null)
        return { status, outputUrl: textOrNull(memberOf(read, "outputUrl")), error: error === null ? null : error.slice(0, MAX_LINE) }
    },
    examples: [
        {
            name: "the render is still being made",
            params: {},
            input: { renderId: "rnd-1" },
            tools: [
                {
                    id: TOOL.videoRenderGet,
                    args: { renderId: "rnd-1" },
                    answer: answered({ renderId: "rnd-1", status: "rendering", outputUrl: null, error: null, provider: "shotstack" }, viaAccount(PROVIDER.shotstack)),
                },
            ],
            output: { status: "rendering", outputUrl: null, error: null },
        },
        {
            name: "the render is done: the address of the video goes on",
            params: {},
            input: { renderId: "rnd-1" },
            tools: [
                {
                    id: TOOL.videoRenderGet,
                    args: { renderId: "rnd-1" },
                    answer: answered(
                        { renderId: "rnd-1", status: "done", outputUrl: "https://out.example/rnd-1.mp4", error: null, provider: "shotstack" },
                        viaAccount(PROVIDER.shotstack),
                    ),
                },
            ],
            output: { status: "done", outputUrl: "https://out.example/rnd-1.mp4", error: null },
        },
        {
            name: "the service failed the render: its words go on",
            params: {},
            input: { renderId: "rnd-2" },
            tools: [
                {
                    id: TOOL.videoRenderGet,
                    args: { renderId: "rnd-2" },
                    answer: answered(
                        { renderId: "rnd-2", status: "failed", outputUrl: null, error: "a clip could not be fetched", provider: "creatomate" },
                        viaAccount(PROVIDER.creatomate),
                    ),
                },
            ],
            output: { status: "failed", outputUrl: null, error: "a clip could not be fetched" },
        },
        {
            name: "no render was started: the run stops",
            params: {},
            input: { renderId: null },
            tools: [],
            failure: { kind: "cannot", why: "no render was started" },
        },
        {
            name: "a render the account does not hold stops the run",
            params: {},
            input: { renderId: "rnd-3" },
            tools: [{ id: TOOL.videoRenderGet, args: { renderId: "rnd-3" }, answer: refused("not_found") }],
            failure: { kind: "cannot", why: `${TOOL.videoRenderGet} refused: not_found` },
        },
    ],
})
