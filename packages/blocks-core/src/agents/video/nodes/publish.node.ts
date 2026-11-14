import { TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../../shared/bounds"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"
import { answered, refused, valueOrCannot } from "../../../shared/nodes/tool-answers"
import { videoTitle } from "./video.copy"

/** The project whose draft a person approves to publish. */
export interface VideoPublishInput {
    /** The project to publish. */
    readonly projectId: string
}

/** The project, and whether a person declined it. */
export interface VideoPublishOutput {
    /** The project that was published. */
    readonly projectId: string
    /** True when a person declined the publish on its card: their decision, the draft stays in review; the graph routes on it. */
    readonly declined: boolean
}

const input: NodeSchema<VideoPublishInput> = z.object({ projectId: z.string().min(1).max(MAX_ID) })

const output: NodeSchema<VideoPublishOutput> = z.object({
    projectId: z.string().min(1).max(MAX_ID),
    declined: z.boolean().describe("True when a person declined the publish on its card; the graph routes on it."),
})

/**
 * `video.publish` (Dang video): marks the project published at the run's instant. The node declares `ask`: a person sees the draft on
 * the Video workbench and approves the publish on its card in /chat first. A person who declines decided the draft stays in review: a
 * decision, never a failure, so the node returns `declined: true` and the graph tells the team.
 */
export const videoPublishNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "video.publish",
    title: videoTitle("nodeVideoPublishTitle"),
    description: { vi: "Ch\u1edd b\u1ea1n duy\u1ec7t r\u1ed3i \u0111\u00e1nh d\u1ea5u video \u0111\u00e3 \u0111\u0103ng. T\u1eeb ch\u1ed1i th\u00ec video v\u1eabn \u1edf b\u01b0\u1edbc duy\u1ec7t.", en: "Waits for your approval, then marks the video published. Declined, it stays in review." },
    tools: [],
    mode: "ask",
    accounts: [],
    input,
    output,
    run: async (given, context) => {
        const called = await context.tools.call(TOOL.recordUpdate, {
            type: "blocks-core.video.project",
            id: given.projectId,
            patch: { status: "published", publishedAt: context.run.at },
        })
        if (!called.ok && called.declined === true) return { projectId: given.projectId, declined: true }
        valueOrCannot(context, TOOL.recordUpdate, called)
        return { projectId: given.projectId, declined: false }
    },
    examples: [
        {
            name: "a person approves the publish: the project is published at the run's instant",
            params: {},
            input: { projectId: "p1" },
            at: "2026-11-13T09:00:00.000Z",
            tools: [
                {
                    id: TOOL.recordUpdate,
                    args: { type: "blocks-core.video.project", id: "p1", patch: { status: "published", publishedAt: "2026-11-13T09:00:00.000Z" } },
                    answer: answered({ record: { id: "p1", version: "6", values: {} } }),
                },
            ],
            output: { projectId: "p1", declined: false },
        },
        {
            name: "a person declines the publish: the draft stays in review, the node says declined",
            params: {},
            input: { projectId: "p1" },
            at: "2026-11-13T09:00:00.000Z",
            tools: [
                {
                    id: TOOL.recordUpdate,
                    args: { type: "blocks-core.video.project", id: "p1", patch: { status: "published", publishedAt: "2026-11-13T09:00:00.000Z" } },
                    answer: refused("declined"),
                },
            ],
            output: { projectId: "p1", declined: true },
        },
    ],
})
