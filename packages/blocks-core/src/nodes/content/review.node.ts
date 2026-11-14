import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../bounds"
import { bilingualOf } from "../../messages/catalog"
import type { NodeSchema } from "../node-schema.types"
import { answered, refused, valueOrCannot } from "../tool-answers"
import { POST_TYPE, recordAnswerOf } from "./content.reads"

type NoParams = Record<string, never>

/** The post a person approves. */
export interface ReviewInput {
    /** The post. */
    readonly postId: string
}

/** Whether the person approved it. */
export interface ReviewOutput {
    /** The post. */
    readonly postId: string
    /** The posts of the week approved and waiting to be published. */
    readonly approved: boolean
}

const params: NodeSchema<NoParams> = z.strictObject({})
const input: NodeSchema<ReviewInput> = z.object({ postId: z.string().min(1).max(MAX_ID) })
const output: NodeSchema<ReviewOutput> = z.object({
    postId: z.string().min(1).max(MAX_ID).describe("The post."),
    approved: z.boolean().describe("True once a person approved it; false when the person declined."),
})

/** The one write the person approves: the post becomes approved. */
const approveArgs = (postId: string): JsonObject => ({ type: POST_TYPE, id: postId, patch: { status: "approved" } })

/**
 * `content.review`: the post becomes approved, and the node declares `ask`: the run stops on an approval card in /chat with
 * the post, a person approves or declines, and only an approval writes (`nivo-frame.rights`). A declined post stays a draft the owner
 * edits in the workbench. No AI call.
 */
export const contentReviewNode: TemplateNode<
    NodeSchema<ReviewInput>,
    NodeSchema<ReviewOutput>,
    NodeSchema<NoParams>
> = defineTemplateNode({
    id: "content.review",
    title: bilingualOf("nodeContentReviewTitle"),
    description: { vi: "Ch\u1edd b\u1ea1n duy\u1ec7t b\u00e0i \u0111\u0103ng. Duy\u1ec7t th\u00ec b\u00e0i chuy\u1ec3n sang \u0111\u00e3 duy\u1ec7t; t\u1eeb ch\u1ed1i th\u00ec b\u00e0i v\u1eabn l\u00e0 b\u1ea3n nh\u00e1p.", en: "Waits for you to approve a post. Approved, the post is marked approved; declined, it stays a draft." },
    tools: [],
    mode: "ask",
    accounts: [],
    params,
    input,
    output,
    run: async (given, context) => {
        const answer = await context.tools.call(TOOL.recordUpdate, approveArgs(given.postId))
        if (!answer.ok && answer.declined === true) return { postId: given.postId, approved: false }
        valueOrCannot(context, TOOL.recordUpdate, answer)
        return { postId: given.postId, approved: true }
    },
    examples: [
        {
            name: "a person approves the post on its card: it becomes approved",
            params: {},
            input: { postId: "post-1" },
            tools: [
                {
                    id: TOOL.recordUpdate,
                    args: approveArgs("post-1"),
                    answer: answered({ record: recordAnswerOf("post-1", { status: "approved" }) }),
                },
            ],
            output: { postId: "post-1", approved: true },
        },
        {
            name: "a person declines: the post stays a draft",
            params: {},
            input: { postId: "post-1" },
            tools: [{ id: TOOL.recordUpdate, args: approveArgs("post-1"), answer: refused("declined") }],
            output: { postId: "post-1", approved: false },
        },
    ],
})
