import { type NodeDefinition, defineNode } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { MAX_BODY, MAX_ID, MAX_LINE } from "../../bounds"
import { bilingualOf } from "../../messages/catalog"
import { TOOL } from "../../vocabulary/tool-ids"
import type { NodeSchema } from "../node-schema.types"
import { frontDeskSample } from "./front-desk.copy"
import { COMPLAINT_GOAL, MESSAGE_FIELDS, MESSAGE_READ_LIMIT, type ThreadRow, threadLinesOf } from "./front-desk.policy"

type NoParams = Record<string, never>

/** What the complaint is taken from. */
export interface ComplaintInput {
    /** The conversation the complaint came in. */
    readonly conversationId: string
    /** What the customer said, one message per line. */
    readonly text: string
    /** The one line the front desk's decision wrote, or null when it is not bound. */
    readonly summary?: string | null | undefined
    /** The code of the customer's last order, from lead memory, or null when the lead has none. */
    readonly lastOrderCode?: string | null | undefined
}

/** What the step did: the words sent, the team told, and the line for the owner. */
export interface ComplaintOutput {
    /** The words sent to the customer. */
    readonly reply: string
    /** Always true: the team was told on /chat. */
    readonly posted: true
    /** One line in Vietnamese for the team: who complains about what, and the order if known. */
    readonly summary: string
}

const TEXT_MAX = 8000
/** The most turns the agent takes: a reply, a team post, the answer, and one try more after a refusal. */
const MAX_TURNS = 5

const params: NodeSchema<NoParams> = z.strictObject({})
const input: NodeSchema<ComplaintInput> = z.object({
    conversationId: z.string().min(1).max(MAX_ID),
    text: z.string().min(1).max(TEXT_MAX),
    summary: z.string().max(MAX_LINE).nullish(),
    lastOrderCode: z.string().max(MAX_ID).nullish(),
})
const output: NodeSchema<ComplaintOutput> = z.object({
    reply: z.string().min(1).max(MAX_BODY).describe("The words sent to the customer"),
    posted: z.literal(true).describe("True once the team was told on /chat"),
    summary: z
        .string()
        .min(1)
        .max(MAX_LINE)
        .describe("One line in Vietnamese for the team: who complains about what, and the order if known"),
})
const RIGHTS = [{ kind: "message", access: "read", scope: "turn", fields: [...MESSAGE_FIELDS] }] as const
/** What the template grants the step: its read, and the write the customer send needs. */
const GRANT = { rights: [...RIGHTS, { kind: "message", access: "write", scope: "turn", fields: ["body"] }] } as const

/** A stored line of the example conversation. */
const line = (role: string, text: string, sentAt: string): Readonly<Record<string, string>> => ({
    conversationId: "c1",
    role,
    text,
    sentAt,
    status: "posted",
})

/**
 * `chatbot.complaint` (the front desk takes a complaint): an agent step. It reads the thread, apologises to the customer without
 * promising what only a person may decide, asking at most for the one fact still missing, and tells the team on /chat with the
 * customer's words and the order if known. Both calls are required. When it cannot, it ends confused and the engine takes over.
 */
export const chatbotComplaintNode: NodeDefinition<
    NodeSchema<ComplaintInput>,
    NodeSchema<ComplaintOutput>,
    NodeSchema<NoParams>
> = defineNode({
    id: "chatbot.complaint",
    role: "output",
    title: bilingualOf("nodeChatbotComplaintTitle"),
    params,
    input,
    output,
    rights: [...RIGHTS],
    effects: [TOOL.customerMessageSend, TOOL.teamMessagePost],
    requires: [TOOL.customerMessageSend, TOOL.teamMessagePost],
    run: async (given, context) => {
        const rows = await context.data.read<ThreadRow>("message", {
            where: { conversationId: given.conversationId, status: "posted" },
            fields: [...MESSAGE_FIELDS],
            limit: MESSAGE_READ_LIMIT,
        })
        const decision = await context.agent.run({
            goal: COMPLAINT_GOAL,
            input: {
                conversationId: given.conversationId,
                message: given.text,
                conversation: threadLinesOf(rows),
                known: { summary: given.summary ?? null, lastOrderCode: given.lastOrderCode ?? null },
            },
            output,
            maxTurns: MAX_TURNS,
            purpose: "complaint",
        })
        if (decision.kind === "confused") return context.confused(decision.confusion)
        return decision.value
    },
    examples: [
        {
            name: "apologises, asks for the order it does not know, and tells the team the customer's words",
            grant: GRANT,
            params: {},
            input: { conversationId: "c1", text: frontDeskSample("hoaHeo") },
            model: [
                {
                    call: {
                        tool: TOOL.customerMessageSend,
                        args: { conversationId: "c1", text: frontDeskSample("complaintReply") },
                    },
                },
                {
                    call: {
                        tool: TOOL.teamMessagePost,
                        args: {
                            kind: "message.text",
                            intent: "notify",
                            audience: "own",
                            title: frontDeskSample("complaintTitle"),
                            text: frontDeskSample("complaintTeamText"),
                        },
                    },
                },
                {
                    done: {
                        reply: frontDeskSample("complaintReply"),
                        posted: true,
                        summary: frontDeskSample("summaryComplaintNoOrder"),
                    },
                },
            ],
            output: {
                reply: frontDeskSample("complaintReply"),
                posted: true,
                summary: frontDeskSample("summaryComplaintNoOrder"),
            },
            effects: [
                {
                    kind: TOOL.customerMessageSend,
                    payload: { conversationId: "c1", text: frontDeskSample("complaintReply") },
                },
                {
                    kind: TOOL.teamMessagePost,
                    payload: {
                        kind: "message.text",
                        intent: "notify",
                        audience: "own",
                        title: frontDeskSample("complaintTitle"),
                        text: frontDeskSample("complaintTeamText"),
                    },
                },
            ],
        },
        {
            name: "a bare order number after the shop asked for it completes the complaint: confirms, asks nothing, tells the team the order",
            grant: GRANT,
            params: {},
            input: { conversationId: "c1", text: frontDeskSample("maDon") },
            store: {
                message: [
                    line("user", frontDeskSample("hoaHeo"), "2026-11-09T10:00:00Z"),
                    line("agent", frontDeskSample("shopAsk"), "2026-11-09T10:01:00Z"),
                ],
            },
            model: [
                {
                    call: {
                        tool: TOOL.customerMessageSend,
                        args: { conversationId: "c1", text: frontDeskSample("complaintDoneReply") },
                    },
                },
                {
                    call: {
                        tool: TOOL.teamMessagePost,
                        args: {
                            kind: "message.text",
                            intent: "notify",
                            audience: "own",
                            title: frontDeskSample("complaintTitle"),
                            text: frontDeskSample("complaintTeamTextOrder"),
                        },
                    },
                },
                {
                    done: {
                        reply: frontDeskSample("complaintDoneReply"),
                        posted: true,
                        summary: frontDeskSample("summaryComplaint"),
                    },
                },
            ],
            output: {
                reply: frontDeskSample("complaintDoneReply"),
                posted: true,
                summary: frontDeskSample("summaryComplaint"),
            },
            effects: [TOOL.customerMessageSend, TOOL.teamMessagePost],
        },
    ],
})
