import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../bounds"
import type { NodeSchema } from "../node-schema.types"
import { frontDeskSample } from "./front-desk.copy"
import { answered, refused } from "../tool-answers"
import { COMPLAINT_NOTIFY_GOAL } from "./front-desk.policy"
import { bilingualOf } from "../../messages/catalog"

type NoParams = Record<string, never>

/** What the team's notice is built from: the customer's words and what the reply step learned. */
export interface ComplaintNotifyInput {
    /** What the customer said, one message per line. */
    readonly text: string
    /** The reply step's one line for the team. */
    readonly summary: string
    /** The order the complaint is about, or null when still unknown. */
    readonly orderCode?: string | null | undefined
}

/** Whether the team was told, and the refusal when the post was refused. */
export interface ComplaintNotifyOutput {
    /** True once the notice is posted on /chat. */
    readonly posted: boolean
    /** The post tool's refusal code when it refused, else null. */
    readonly refusal: string | null
}

/** The notice the agent writes: a heading and the words. */
interface ComplaintNotice {
    readonly title: string
    readonly text: string
}

const TEXT_MAX = 8000
const NOTICE_TEXT_MAX = 2000

const params: NodeSchema<NoParams> = z.strictObject({})
const input: NodeSchema<ComplaintNotifyInput> = z.object({
    text: z.string().max(TEXT_MAX),
    summary: z.string().min(1).max(MAX_LINE),
    orderCode: z.string().max(MAX_ID).nullish(),
})
const output: NodeSchema<ComplaintNotifyOutput> = z.object({
    posted: z.boolean(),
    refusal: z.string().max(MAX_ID).nullable(),
})
const notice: NodeSchema<ComplaintNotice> = z.object({
    title: z.string().min(1).max(MAX_LINE).describe("A short heading for the team"),
    text: z
        .string()
        .min(1)
        .max(NOTICE_TEXT_MAX)
        .describe("The customer's own words quoted, the order if known, what went wrong"),
})

/** The team post of an example: the notice as the step posts it, to the owner (and the team's room when the agent may post there). */
const teamNotice = (text: string): Readonly<Record<string, string>> => ({
    kind: "message.text",
    intent: "notify",
    audience: "own",
    title: frontDeskSample("complaintTitle"),
    text,
})

/** What the post tool answers for a notice: the chat message it wrote (the effect's facts as `value`, not read). */
const postedAs = (id: string): JsonObject => ({ messageId: id })

/**
 * `chatbot.complaint-notify` (the front desk tells the team of a complaint): a SIDE step (`blocking: false`) after
 * `chatbot.complaint-reply`. The agent writes the team's notice (a heading, the customer's own words, the order if known); the step
 * posts it on /chat to the owner, and to the team's room when the agent may post there. A refused post is said in the output, never a
 * reason to stop the conversation's flow: the reply was already sent.
 */
export const chatbotComplaintNotifyNode: TemplateNode<
    NodeSchema<ComplaintNotifyInput>,
    NodeSchema<ComplaintNotifyOutput>,
    NodeSchema<NoParams>
> = defineTemplateNode({
    id: "chatbot.complaint-notify",
    title: bilingualOf("nodeChatbotComplaintNotifyTitle"),
    description: { vi: "B\u00e1o cho \u0111\u1ed9i bi\u1ebft kh\u00e1ch \u0111ang ph\u00e0n n\u00e0n: t\u00f3m t\u1eaft, l\u1eddi c\u1ee7a kh\u00e1ch v\u00e0 \u0111\u01a1n h\u00e0ng n\u1ebfu c\u00f3.", en: "Tells the team about a customer complaint: a summary, the customer's own words and the order if known." },
    tools: [TOOL.teamMessagePost],
    mode: "auto",
    accounts: [],
    params,
    input,
    output,
    model: "claude-sonnet-5-5",
    blocking: false,
    run: async (given, context) => {
        const written = await context.agent.run({
            goal: COMPLAINT_NOTIFY_GOAL,
            input: { message: given.text, summary: given.summary, orderCode: given.orderCode ?? null },
            output: notice,
            tools: [],
            maxTurns: 1,
        })
        const posted = await context.tools.call(TOOL.teamMessagePost, {
            kind: "message.text",
            intent: "notify",
            audience: "own",
            title: written.title,
            text: written.text,
        })
        return posted.ok ? { posted: true, refusal: null } : { posted: false, refusal: posted.declined === true ? "declined" : posted.refusal }
    },
    examples: [
        {
            name: "tells the team the customer's own words when the order is not known yet",
            params: {},
            input: {
                text: frontDeskSample("hoaHeo"),
                summary: frontDeskSample("summaryComplaintNoOrder"),
                orderCode: null,
            },
            agent: [
                { answer: { title: frontDeskSample("complaintTitle"), text: frontDeskSample("complaintTeamText") } },
            ],
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: teamNotice(frontDeskSample("complaintTeamText")),
                    answer: answered(postedAs("m-team-1")),
                },
            ],
            output: { posted: true, refusal: null },
        },
        {
            name: "tells the team the order once the customer named it",
            params: {},
            input: {
                text: frontDeskSample("maDon"),
                summary: frontDeskSample("summaryComplaint"),
                orderCode: "DH-102",
            },
            agent: [
                {
                    answer: {
                        title: frontDeskSample("complaintTitle"),
                        text: frontDeskSample("complaintTeamTextOrder"),
                    },
                },
            ],
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: teamNotice(frontDeskSample("complaintTeamTextOrder")),
                    answer: answered(postedAs("m-team-2")),
                },
            ],
            output: { posted: true, refusal: null },
        },
        {
            name: "a person declined the team post on its card: the refusal is said in the output and does not stop the flow",
            params: {},
            input: {
                text: frontDeskSample("hoaHeo"),
                summary: frontDeskSample("summaryComplaintNoOrder"),
                orderCode: null,
            },
            agent: [
                { answer: { title: frontDeskSample("complaintTitle"), text: frontDeskSample("complaintTeamText") } },
            ],
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: teamNotice(frontDeskSample("complaintTeamText")),
                    answer: refused("declined"),
                },
            ],
            output: { posted: false, refusal: "declined" },
        },
    ],
})
