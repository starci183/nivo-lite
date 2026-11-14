import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../bounds"
import type { NodeLocale, NodeSchema } from "../node-schema.types"
import { answered, refused, valueOrCannot } from "../tool-answers"
import { videoLine, videoTitle } from "./video.copy"
import { SCENES_MAX } from "./video.shapes"

/** The made video to hand for review: its project and title, how many clips it joins, whether it carries a narration. */
export interface VideoReviewInput {
    /** The project under review. */
    readonly projectId: string
    /** The title of the video. */
    readonly title: string
    /** How many clips the video has. */
    readonly clips: number
    /** True when the voice-over was kept. */
    readonly voiceKept: boolean
    /** The language the review notice is written in. */
    readonly locale: NodeLocale
}

/** The input as a graph binds it: the language may be absent. */
export interface VideoReviewGiven {
    /** The project under review. */
    readonly projectId: string
    /** The title of the video. */
    readonly title: string
    /** How many clips the video has. */
    readonly clips: number
    /** True when the voice-over was kept. */
    readonly voiceKept: boolean
    /** The language the review notice is written in; the workspace default when absent. */
    readonly locale?: NodeLocale | undefined
}

/** Whether the team was told. */
export interface VideoReviewOutput {
    /** True when the review notice was posted. */
    readonly posted: boolean
    /** True when a person declined moving the project to review on its card: the team was not told. */
    readonly declined: boolean
}

const input: NodeSchema<VideoReviewInput, VideoReviewGiven> = z.object({
    projectId: z.string().min(1).max(MAX_ID),
    title: z.string().max(MAX_LINE),
    clips: z.number().int().min(1).max(SCENES_MAX),
    voiceKept: z.boolean(),
    locale: z.enum(["vi", "en"]).default("vi"),
})

const output: NodeSchema<VideoReviewOutput> = z.object({
    posted: z.boolean().describe("True once the team was told where the files are."),
    declined: z.boolean().describe("True when a person declined moving the project to review on its card: nothing was done and the team was not told."),
})

/** The team line that the files wait: the project's title and how many clips (and a narration) are stored. */
const reviewLineOf = (given: VideoReviewInput): JsonObject => ({
    kind: "message.text",
    intent: "notify",
    audience: "founder",
    title: videoLine(given.locale, "videoReviewHeading"),
    text: videoLine(given.locale, given.voiceKept ? "videoReviewLineWithVoice" : "videoReviewLine")
        .replaceAll("{title}", given.title)
        .replaceAll("{clips}", String(given.clips)),
})

/**
 * `video.review` (Gui video de duyet): moves the project to `review` and tells the founder in /chat that the composed video waits on the
 * render record of the project on the Video workbench (the clips and the narration it was made from stay beside it). A team line that
 * cannot be posted is said in the output; a person declining the move to review is `declined: true` (the graph ends the run `declined`).
 */
export const videoReviewNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "video.review",
    title: videoTitle("nodeVideoReviewTitle"),
    description: { vi: "Chuy\u1ec3n video sang b\u01b0\u1edbc duy\u1ec7t v\u00e0 b\u00e1o ch\u1ee7 c\u1eeda h\u00e0ng r\u1eb1ng video \u0111\u00e3 d\u1ef1ng xong, \u0111ang ch\u1edd xem.", en: "Moves the video to review and tells the owner it is made and waiting to be watched." },
    tools: [TOOL.teamMessagePost],
    mode: "auto",
    accounts: [],
    input,
    output,
    run: async (given, context) => {
        const moved = await context.tools.call(TOOL.recordUpdate, {
            type: "blocks-core.video.project",
            id: given.projectId,
            patch: { status: "review", lastError: null },
        })
        if (!moved.ok && moved.declined === true) return { posted: false, declined: true }
        valueOrCannot(context, TOOL.recordUpdate, moved)
        const posted = await context.tools.call(TOOL.teamMessagePost, reviewLineOf(given))
        return { posted: posted.ok, declined: false }
    },
    examples: [
        {
            name: "the composed video of three clips and a narration is done: the project moves on and the founder is told where it is",
            params: {},
            input: { projectId: "p1", title: "\u01afu \u0111\u00e3i hoa h\u1ed3ng", clips: 3, voiceKept: true },
            tools: [
                {
                    id: TOOL.recordUpdate,
                    args: { type: "blocks-core.video.project", id: "p1", patch: { status: "review", lastError: null } },
                    answer: answered({ record: { id: "p1", version: "5", values: {} } }),
                },
                {
                    id: TOOL.teamMessagePost,
                    args: reviewLineOf({ projectId: "p1", title: "\u01afu \u0111\u00e3i hoa h\u1ed3ng", clips: 3, voiceKept: true, locale: "vi" }),
                    answer: answered({ messageId: "m1" }),
                },
            ],
            output: { posted: true, declined: false },
        },
        {
            name: "a person declines moving the project to review: nothing more is done and the node says declined",
            params: {},
            input: { projectId: "p1", title: "\u01afu \u0111\u00e3i hoa h\u1ed3ng", clips: 3, voiceKept: true },
            tools: [
                {
                    id: TOOL.recordUpdate,
                    args: { type: "blocks-core.video.project", id: "p1", patch: { status: "review", lastError: null } },
                    answer: refused("declined"),
                },
            ],
            output: { posted: false, declined: true },
        },
        {
            name: "a script with no words has no narration: the founder is told",
            params: {},
            input: { projectId: "p1", title: "Gi\u1edbi thi\u1ec7u ti\u1ec7m", clips: 2, voiceKept: false, locale: "en" },
            tools: [
                {
                    id: TOOL.recordUpdate,
                    args: { type: "blocks-core.video.project", id: "p1", patch: { status: "review", lastError: null } },
                    answer: answered({ record: { id: "p1", version: "5", values: {} } }),
                },
                {
                    id: TOOL.teamMessagePost,
                    args: reviewLineOf({ projectId: "p1", title: "Gi\u1edbi thi\u1ec7u ti\u1ec7m", clips: 2, voiceKept: false, locale: "en" }),
                    answer: answered({ messageId: "m2" }),
                },
            ],
            output: { posted: true, declined: false },
        },
    ],
})
