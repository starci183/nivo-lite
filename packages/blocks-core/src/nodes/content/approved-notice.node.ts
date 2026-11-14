import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../bounds"
import { bilingualOf, messageOf } from "../../messages/catalog"
import { CHANNEL_RULES } from "../../rules/content/channels"
import { CONTENT_CHANNELS, type ContentChannel } from "../../rules/content/post"
import { fillTemplate } from "../../rules/content/week"
import type { NodeSchema } from "../node-schema.types"
import { answered } from "../tool-answers"

type NoParams = Record<string, never>

/** The approved post the team is told about. */
export interface ApprovedNoticeInput {
    /** The post. */
    readonly postId: string
    /** The social channel. */
    readonly channel: ContentChannel
    /** The title of the post. */
    readonly title: string
}

/** Whether the team was told, and the post tool's refusal when it refused. */
export interface ApprovedNoticeOutput {
    /** Whether the team was told. */
    readonly posted: boolean
    /** The post tool's refusal when it refused, else null. */
    readonly refusal: string | null
}

const params: NodeSchema<NoParams> = z.strictObject({})
const input: NodeSchema<ApprovedNoticeInput> = z.object({
    postId: z.string().min(1).max(MAX_ID),
    channel: z.enum(CONTENT_CHANNELS),
    title: z.string().max(MAX_LINE),
})
const output: NodeSchema<ApprovedNoticeOutput> = z.object({
    posted: z.boolean().describe("True once the team was told."),
    refusal: z.string().max(MAX_ID).nullable().describe("The post tool's refusal when it refused, else null."),
})

/** The team line: an approved post waits to be published by hand on its channel. */
const noticeOf = (given: ApprovedNoticeInput): JsonObject => ({
    kind: "message.text",
    intent: "notify",
    title: messageOf("vi", "nodeContentApprovedNoticeHeading"),
    text: fillTemplate(messageOf("vi", "nodeContentApprovedNoticeLine"), {
        title: given.title,
        channel: CHANNEL_RULES[given.channel].label,
    }),
})

const EXAMPLE: ApprovedNoticeInput = { postId: "post-1", channel: "zalo", title: "Flowers to thank a teacher" }

/**
 * `content.approved-notice`: tells the team on /chat that a post is approved and waits to be published on its channel.
 * No tool publishes to Meta or Zalo OA yet (SHAPE-NOTES `3-A-content`: needs provider tool `post.publish`), so the post is published by
 * hand and marked published in the workbench. A side node (`blocking: false`): a refused post is said in the output. No AI call.
 */
export const contentApprovedNoticeNode: TemplateNode<
    NodeSchema<ApprovedNoticeInput>,
    NodeSchema<ApprovedNoticeOutput>,
    NodeSchema<NoParams>
> = defineTemplateNode({
    id: "content.approved-notice",
    title: bilingualOf("nodeContentApprovedNoticeTitle"),
    description: { vi: "B\u00e1o cho \u0111\u1ed9i bi\u1ebft b\u00e0i vi\u1ebft \u0111\u00e3 \u0111\u01b0\u1ee3c duy\u1ec7t v\u00e0 \u0111ang ch\u1edd \u0111\u0103ng l\u00ean k\u00eanh.", en: "Tells the team a post is approved and waits to be published on its channel." },
    tools: [TOOL.teamMessagePost],
    mode: "auto",
    accounts: [],
    params,
    input,
    output,
    blocking: false,
    run: async (given, context) => {
        const posted = await context.tools.call(TOOL.teamMessagePost, noticeOf(given))
        return posted.ok ? { posted: true, refusal: null } : { posted: false, refusal: posted.declined === true ? "declined" : posted.refusal }
    },
    examples: [
        {
            name: "tells the team the Zalo post is approved and waits to be published",
            params: {},
            input: EXAMPLE,
            tools: [{ id: TOOL.teamMessagePost, args: noticeOf(EXAMPLE), answer: answered({ messageId: "m-1" }) }],
            output: { posted: true, refusal: null },
        },
    ],
})
