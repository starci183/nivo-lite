import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../bounds"
import type { NodeLocale, NodeSchema } from "../node-schema.types"
import { answered } from "../tool-answers"
import { videoLine, videoTitle } from "./video.copy"

/**
 * The project that could not be made, and why: the provider's words, or null when the making was still not done; and the render
 * record of the making when one was opened (null when the clips failed before any).
 */
export interface VideoStuckInput {
    /** The project whose render is stuck. */
    readonly projectId: string
    /** The stuck render; null when none was started. */
    readonly renderId: string | null
    /** The title of the video. */
    readonly title: string
    /** Why the render is stuck; null when no reason is known. */
    readonly error: string | null
    /** The language the notice is written in. */
    readonly locale: NodeLocale
}

/** The input as a graph binds it: the reason and the language may be absent. */
export interface VideoStuckGiven {
    /** The project whose render is stuck. */
    readonly projectId: string
    /** The stuck render; none when none was started. */
    readonly renderId?: string | null | undefined
    /** The title of the video. */
    readonly title: string
    /** Why the render is stuck; none when no reason is known. */
    readonly error?: string | null | undefined
    /** The language the notice is written in; the workspace default when absent. */
    readonly locale?: NodeLocale | undefined
}

/** Whether the project was marked failed and the team told. */
export interface VideoStuckOutput {
    /** True when the project was marked as stuck. */
    readonly marked: boolean
    /** True when the team notice was posted. */
    readonly posted: boolean
}

const input: NodeSchema<VideoStuckInput, VideoStuckGiven> = z.object({
    projectId: z.string().min(1).max(MAX_ID),
    renderId: z.string().min(1).max(MAX_ID).nullable().default(null),
    title: z.string().max(MAX_LINE),
    error: z.string().max(MAX_LINE).nullable().default(null),
    locale: z.enum(["vi", "en"]).default("vi"),
})

const output: NodeSchema<VideoStuckOutput> = z.object({
    marked: z.boolean().describe("True once the project (and the render record, when there is one) says it failed and why."),
    posted: z.boolean().describe("True once the team was told."),
})

/** Why, in the team's words: the provider's own, or that the scenes were not done in time. */
const whyOf = (given: VideoStuckInput): string => given.error ?? videoLine(given.locale, "videoStuckTimedOut")

/** The tool call that marks the render record of the making failed, or none when no render was opened. */
const renderFailedOf = (given: VideoStuckInput): ReadonlyArray<JsonObject> =>
    given.renderId === null
        ? []
        : [{ type: "blocks-core.video.render", id: given.renderId, patch: { state: "failed", error: whyOf(given).slice(0, MAX_LINE) } }]

/** The team line of a video that could not be made. */
const stuckLineOf = (given: VideoStuckInput): JsonObject => ({
    kind: "message.text",
    intent: "notify",
    audience: "founder",
    title: videoLine(given.locale, "videoStuckHeading"),
    text: videoLine(given.locale, "videoStuckLine").replaceAll("{title}", given.title).replaceAll("{why}", whyOf(given)),
})

/**
 * `video.stuck` (Bao video khong dung duoc): the end of a video that could not be made (a scene failed, the compose service refused or
 * failed the render, or the making was still not done after the last wait): the render record, when one was opened, and the project say
 * it failed and why, and the founder is told in /chat. A side node (`blocking: false`): a
 * write or a line that is refused is said in the output and the run still ends as `failed`.
 */
export const videoStuckNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "video.stuck",
    title: videoTitle("nodeVideoStuckTitle"),
    description: { vi: "B\u00e1o video kh\u00f4ng d\u1ef1ng \u0111\u01b0\u1ee3c: ghi l\u00fd do v\u00e0o d\u1ef1 \u00e1n v\u00e0 b\u00e1o ch\u1ee7 c\u1eeda h\u00e0ng.", en: "Reports a video that could not be made: records the reason on the project and tells the owner." },
    tools: [TOOL.teamMessagePost],
    mode: "auto",
    accounts: [],
    input,
    output,
    blocking: false,
    run: async (given, context) => {
        const renders: Array<boolean> = []
        for (const call of renderFailedOf(given)) renders.push((await context.tools.call(TOOL.recordUpdate, call)).ok)
        const marked = await context.tools.call(TOOL.recordUpdate, {
            type: "blocks-core.video.project",
            id: given.projectId,
            patch: { status: "failed", lastError: whyOf(given) },
        })
        const posted = await context.tools.call(TOOL.teamMessagePost, stuckLineOf(given))
        return { marked: marked.ok && renders.every(Boolean), posted: posted.ok }
    },
    examples: [
        {
            name: "the scenes were not done after the last wait: the project fails and the founder is told",
            params: {},
            input: { projectId: "p1", title: "\u01afu \u0111\u00e3i hoa h\u1ed3ng" },
            tools: [
                {
                    id: TOOL.recordUpdate,
                    args: { type: "blocks-core.video.project", id: "p1", patch: { status: "failed", lastError: "video ch\u01b0a xong sau nhi\u1ec1u l\u1ea7n ch\u1edd" } },
                    answer: answered({ record: { id: "p1", version: "5", values: {} } }),
                },
                {
                    id: TOOL.teamMessagePost,
                    args: stuckLineOf({ projectId: "p1", renderId: null, title: "\u01afu \u0111\u00e3i hoa h\u1ed3ng", error: null, locale: "vi" }),
                    answer: answered({ messageId: "m2" }),
                },
            ],
            output: { marked: true, posted: true },
        },
        {
            name: "the provider failed a scene: its words are kept on the project and told",
            params: {},
            input: { projectId: "p1", title: "Shop video", error: "prompt blocked", locale: "en" },
            tools: [
                {
                    id: TOOL.recordUpdate,
                    args: { type: "blocks-core.video.project", id: "p1", patch: { status: "failed", lastError: "prompt blocked" } },
                    answer: answered({ record: { id: "p1", version: "5", values: {} } }),
                },
                {
                    id: TOOL.teamMessagePost,
                    args: stuckLineOf({ projectId: "p1", renderId: null, title: "Shop video", error: "prompt blocked", locale: "en" }),
                    answer: answered({ messageId: "m3" }),
                },
            ],
            output: { marked: true, posted: true },
        },
        {
            name: "the compose service failed the render: the render record and the project fail with its words and the founder is told",
            params: {},
            input: { projectId: "p1", renderId: "r1", title: "Shop video", error: "a clip could not be fetched", locale: "en" },
            tools: [
                {
                    id: TOOL.recordUpdate,
                    args: { type: "blocks-core.video.render", id: "r1", patch: { state: "failed", error: "a clip could not be fetched" } },
                    answer: answered({ record: { id: "r1", version: "4", values: {} } }),
                },
                {
                    id: TOOL.recordUpdate,
                    args: { type: "blocks-core.video.project", id: "p1", patch: { status: "failed", lastError: "a clip could not be fetched" } },
                    answer: answered({ record: { id: "p1", version: "5", values: {} } }),
                },
                {
                    id: TOOL.teamMessagePost,
                    args: stuckLineOf({ projectId: "p1", renderId: "r1", title: "Shop video", error: "a clip could not be fetched", locale: "en" }),
                    answer: answered({ messageId: "m4" }),
                },
            ],
            output: { marked: true, posted: true },
        },
    ],
})
