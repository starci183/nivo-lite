import { definePlugin, type Plugin } from "@nivo-lite/agent-sdk/installation"
import { defineNode, type NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { PROVIDER, TOOL, TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    callWorkflow,
    defineTemplateAgent,
    defineTemplateGraph,
    defineTemplateNode,
    node,
    outcome,
    ref,
    toolOk,
    trigger,
    type NodeContext,
    type TemplateAgent,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"

// THE WORLD'S DESK (X3, after the flip of 2026-11-12): the engine worlds of package 0-9 (stops, the replay ledger, one line per stop,
// kill / lease / version pin, rights per account, approvals) prove the ENGINE's rules on an AGENT STEP THAT ACTS ITSELF: its agent
// sends a line, posts to the team, files a proposal, creates a QR, appends a ledger line, under the step's `requires`. The shipped
// nodes no longer have such a step (the front desk's answer sends once, after its agent; the team chat files its proposal in a node of
// its own; the QR and the ledger nodes call their tool directly, no agent), so these worlds keep their subject on this fixture: the
// same shape as the core's front desk of version 6 and the steps the worlds used, written as TEMPLATE nodes (the road production now
// runs), installed beside the core through `jest.mock("@nivo-lite/plugin-registry")` in each spec. The core flows themselves are walked
// on the shipped graphs by their own worlds (twin-walk, consult, reconcile, sales-care, ...).

/** The world desk's agent key: the module of its graphs. */
export const DESK_AGENT = "wdesk"

/** The world desk's front desk (its primary graph). */
export const DESK_FRONT = "wdesk.front-desk"

/** The purpose of the understand step's agent (`<node id>:agent`). */
export const DESK_UNDERSTAND = "wdesk.understand:agent"
/** The purpose of the answer step's agent. */
export const DESK_ANSWER = "wdesk.answer:agent"
/** The purpose of the complaint step's agent. */
export const DESK_COMPLAINT = "wdesk.complaint:agent"
/** The purpose of the team chat turn's agent (template road). */
export const DESK_CHAT = "wdesk.chat:agent"
/** The purpose of the team chat turn's agent on the `defineNode` road. */
export const DESK_LEGACY_CHAT = "wdesk.legacy-chat:team-chat"
/** The purpose of the QR step's agent. */
export const DESK_QR = "wdesk.qr:agent"
/** The purpose of the ledger step's agent. */
export const DESK_LEDGER = "wdesk.ledger:agent"

const MODEL = "claude-sonnet-5-5"
const ID_MAX = 200
const TEXT_MAX = 8000

/** What the customer wants now: the four routes of the front desk. */
const branchOutput = z.object({
    branch: z.enum(["buy", "paid", "complaint", "question"]),
    summary: z.string().min(1).max(500),
})

/** Understands the customer's new message: a decision of its agent (no tool), routed by its own member `branch`. */
export const deskUnderstandNode = defineTemplateNode({
    id: "wdesk.understand",
    title: { vi: "Hi\u1ec3u kh\u00e1ch", en: "Understand" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [],
    mode: "auto",
    accounts: [],
    input: z.object({ conversationId: z.string().min(1).max(ID_MAX), text: z.string().min(1).max(TEXT_MAX) }),
    output: branchOutput,
    model: MODEL,
    routes: { by: "branch", names: ["buy", "paid", "complaint", "question"] },
    run: (given, ctx) =>
        ctx.agent.run({
            goal: "Say which way the customer's message goes (buy, paid, complaint, question) and sum it up in one line.",
            input: { conversationId: given.conversationId, message: given.text },
            output: branchOutput,
            tools: [],
            maxTurns: 1,
        }),
    examples: [
        {
            name: "a question",
            params: {},
            input: { conversationId: "c1", text: "Shop mo cua may gio?" },
            agent: [{ answer: { branch: "question", summary: "gio mo cua" } }],
            output: { branch: "question", summary: "gio mo cua" },
        },
    ],
})

/** The longest reply the answer step takes (the core's message body bound). */
const BODY_MAX = 20_000

const replyOutput = z.object({ reply: z.string().min(1).max(BODY_MAX) })

/** The members of the conversation read a step reads: the lines, newest first. */
const threadAnswer = z.object({ facts: z.array(z.looseObject({ role: z.string().max(500), text: z.string().max(500), at: z.string().max(500) })).max(500) })

/**
 * The conversation of the run, oldest first, as `who: words` lines: read through the context read on every run of the step (so a re-run
 * after a crash reads the line the step sent before it, as the core's steps do). A refused read is the step's trouble.
 */
const threadOf = async (ctx: NodeContext): Promise<ReadonlyArray<string>> => {
    const read = await ctx.tools.call(TOOL.conversationMessageList, { limit: 20 })
    if (!read.ok) return ctx.fail({ kind: "cannot", why: `thread_refused:${read.refusal}` }, read.facts)
    return threadAnswer
        .parse(read.value)
        .facts.toSorted((left, right) => left.at.localeCompare(right.at))
        .map((fact) => `${fact.role === "user" ? "customer" : "shop"}: ${fact.text}`)
}

/** The answer of a conversation read in an example. */
const THREAD_READ = { id: TOOL.conversationMessageList, args: { limit: 20 }, answer: toolOk({ facts: [] }) }

/** Answers a question: its agent searches the shop's truths and SENDS the line itself; the step requires a send. */
export const deskAnswerNode = defineTemplateNode({
    id: "wdesk.answer",
    title: { vi: "Tr\u1ea3 l\u1eddi", en: "Answer" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [TOOL.conversationMessageList, TOOL.brainSearch, TOOL.customerMessageSend],
    mode: "auto",
    accounts: [],
    input: z.object({ conversationId: z.string().min(1).max(ID_MAX), text: z.string().min(1).max(TEXT_MAX) }),
    output: replyOutput,
    model: MODEL,
    requires: [TOOL.customerMessageSend],
    run: async (given, ctx) =>
        ctx.agent.run({
            goal: "Answer the customer's question from the shop's truths; send your answer to the conversation yourself.",
            input: { conversationId: given.conversationId, message: given.text, conversation: [...(await threadOf(ctx))] },
            output: replyOutput,
            tools: [TOOL.brainSearch, TOOL.customerMessageSend],
            maxTurns: 4,
        }),
    examples: [
        {
            name: "sends the answer",
            params: {},
            input: { conversationId: "c1", text: "Shop mo cua may gio?" },
            tools: [THREAD_READ],
            agent: [
                {
                    answer: { reply: "8h-21h" },
                    calls: [{ id: TOOL.customerMessageSend, args: { conversationId: "c1", text: "8h-21h" }, answer: toolOk({}) }],
                },
            ],
            output: { reply: "8h-21h" },
        },
    ],
})

const complaintOutput = z.object({ summary: z.string().min(1).max(500) })

/** Takes a complaint: its agent replies to the customer and tells the team; the step requires both. */
export const deskComplaintNode = defineTemplateNode({
    id: "wdesk.complaint",
    title: { vi: "Khi\u1ebfu n\u1ea1i", en: "Complaint" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [TOOL.conversationMessageList, TOOL.customerMessageSend, TOOL.teamMessagePost],
    mode: "auto",
    accounts: [],
    input: z.object({
        conversationId: z.string().min(1).max(ID_MAX),
        text: z.string().min(1).max(TEXT_MAX),
        summary: z.string().max(500).nullish(),
    }),
    output: complaintOutput,
    model: MODEL,
    requires: [TOOL.customerMessageSend, TOOL.teamMessagePost],
    run: async (given, ctx) =>
        ctx.agent.run({
            goal: "Apologise to the customer once and tell the team what went wrong.",
            input: {
                conversationId: given.conversationId,
                message: given.text,
                conversation: [...(await threadOf(ctx))],
                known: { summary: given.summary ?? null },
            },
            output: complaintOutput,
            tools: [TOOL.customerMessageSend, TOOL.teamMessagePost],
            maxTurns: 4,
        }),
    examples: [
        {
            name: "replies and tells the team",
            params: {},
            input: { conversationId: "c1", text: "Hoa heo" },
            tools: [THREAD_READ],
            agent: [
                {
                    answer: { summary: "hoa heo" },
                    calls: [
                        { id: TOOL.customerMessageSend, args: { conversationId: "c1", text: "Xin loi" }, answer: toolOk({}) },
                        { id: TOOL.teamMessagePost, args: { text: "hoa heo" }, answer: toolOk({}) },
                    ],
                },
            ],
            output: { summary: "hoa heo" },
        },
    ],
})

const roomLine = z.object({
    id: z.string().min(1).max(ID_MAX),
    by: z.enum(["person", "agent", "system"]),
    name: z.string().max(ID_MAX),
    text: z.string().max(TEXT_MAX),
    at: z.string().max(ID_MAX),
})

/** What a team chat turn reads: the asked message, who asked, where, and the room around it. */
const chatInput = z.object({
    roomId: z.string().min(1).max(ID_MAX),
    messageId: z.string().min(1).max(ID_MAX),
    text: z.string().min(1).max(TEXT_MAX),
    room: z.enum(["direct", "common"]),
    intent: z.enum(["answer", "capture"]),
    asker: z.object({ name: z.string().max(ID_MAX), standing: z.enum(["owner", "manager", "staff"]) }),
    lines: z.array(roomLine).max(50),
    locale: z.enum(["vi", "en"]),
})

const chatOutput = z.object({ answer: z.string().min(1).max(TEXT_MAX) })

/** The truth-graph tools of a chat turn: the search, and the one write it may ask for (a proposal the owner decides). */
const CHAT_TOOLS = [TOOL.brainSearch, TOOL.brainChangePropose] as const

/**
 * A team chat turn on the template road: its agent may FILE a truth change itself (a call that asks the owner first); the step then posts
 * the agent's answer in the room as a reply to the asked message.
 */
export const deskChatNode = defineTemplateNode({
    id: "wdesk.chat",
    title: { vi: "Tr\u00f2 chuy\u1ec7n \u0111\u1ed9i", en: "Team chat" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [...CHAT_TOOLS, TOOL.teamMessagePost],
    mode: "auto",
    accounts: [],
    input: chatInput,
    output: chatOutput,
    model: MODEL,
    run: async (given, ctx) => {
        const said = await ctx.agent.run({
            goal: "Answer the person; file a truth change when they tell you a new fact of the shop.",
            input: { text: given.text, intent: given.intent, messageId: given.messageId, room: given.room },
            output: chatOutput,
            tools: [...CHAT_TOOLS],
            maxTurns: 6,
        })
        const posted = await ctx.tools.call(TOOL.teamMessagePost, { kind: "chat.answer", messageId: given.messageId, text: said.answer })
        if (!posted.ok) return ctx.fail({ kind: "cannot", why: `post_refused:${posted.declined === true ? "declined" : posted.refusal}` }, posted.facts)
        return said
    },
    examples: [
        {
            name: "answers",
            params: {},
            input: {
                roomId: "r1",
                messageId: "m1",
                text: "Phi ship?",
                room: "direct",
                intent: "answer",
                asker: { name: "Anh", standing: "owner" },
                lines: [],
                locale: "vi",
            },
            agent: [{ answer: { answer: "20k" } }],
            tools: [{ id: TOOL.teamMessagePost, args: { kind: "chat.answer", messageId: "m1", text: "20k" }, answer: toolOk({}) }],
            output: { answer: "20k" },
        },
    ],
})

/** The same team chat turn on the `defineNode` road (the road the control nodes still take): it posts its answer to the room. */
export const deskLegacyChatNode: NodeDefinition = defineNode({
    id: "wdesk.legacy-chat",
    role: "output",
    title: { vi: "Tr\u00f2 chuy\u1ec7n \u0111\u1ed9i (c\u0169)", en: "Team chat (defineNode)" },
    params: z.object({}),
    input: chatInput,
    output: chatOutput,
    effects: [TOOL.teamMessagePost],
    tools: [...CHAT_TOOLS],
    run: async (given, context) => {
        const decision = await context.agent.run({
            goal: "Answer the person; file a truth change when they tell you a new fact of the shop.",
            input: given,
            output: chatOutput,
            maxTurns: 6,
            purpose: "team-chat",
        })
        if (decision.kind === "confused") return context.confused(decision.confusion)
        await context.effect(TOOL.teamMessagePost, { kind: "chat.answer", messageId: given.messageId, text: decision.value.answer })
        return decision.value
    },
    examples: [
        {
            name: "one",
            params: {},
            input: {
                roomId: "r1",
                messageId: "m1",
                text: "Phi ship?",
                room: "direct",
                intent: "answer",
                asker: { name: "Anh", standing: "owner" },
                lines: [],
                locale: "vi",
            },
            output: { answer: "20k" },
            effects: [],
        },
    ],
})

const ledgerOutput = z.object({ ref: z.string().min(1).max(ID_MAX) })

/** Writes a settled payment into the ledger: its agent appends the line; the step REQUIRES the append. */
export const deskLedgerNode = defineTemplateNode({
    id: "wdesk.ledger",
    title: { vi: "Ghi s\u1ed5", en: "Ledger" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [TOOL.ledgerEntryAppend],
    mode: "auto",
    accounts: [],
    input: z.object({ transactionId: z.string().min(1).max(ID_MAX), orderId: z.string().min(1).max(ID_MAX) }),
    output: ledgerOutput,
    model: MODEL,
    requires: [TOOL.ledgerEntryAppend],
    run: (given, ctx) =>
        ctx.agent.run({
            goal: "Append the settled payment to the ledger and say where it went.",
            input: { ...given },
            output: ledgerOutput,
            maxTurns: 3,
        }),
    examples: [
        {
            name: "appends",
            params: {},
            input: { transactionId: "tx-1", orderId: "o1" },
            agent: [
                {
                    answer: { ref: "Ledger!A2:H2" },
                    calls: [{ id: TOOL.ledgerEntryAppend, args: { entry: { transactionId: "tx-1" } }, answer: toolOk({ ref: "Ledger!A2:H2" }) }],
                },
            ],
            output: { ref: "Ledger!A2:H2" },
        },
    ],
})

/** The purpose of the care step's agent. */
export const DESK_CARE = "wdesk.care:agent"

/** What the care step reads of the care tool's answer: the members at the top of `value` (the effect's facts). */
const careArmed = z.object({ taskId: z.string().min(1).max(ID_MAX), dueAt: z.string().min(1).max(ID_MAX) })

const careOutput = careArmed.extend({ subject: z.string().max(ID_MAX) })

/** The check-in the care step arms: a hand-over to the desk's module about the customer's record, carrying the instant it is due as plain context. */
const careArgsOf = (leadId: string) => ({
    toModuleKey: "wdesk",
    text: "check in on the delivery",
    leadId,
    context: { dueAt: "2026-11-15T02:00:00.000Z" },
})

/**
 * Arms a check-in for the customer through `nivo.tool.agent.tag` and reads what it answered the way the converted nodes do:
 * `value.taskId` / `value.dueAt`, and the record it wrote in `meta.subject`. Then its agent says the check-in is armed (a turn that can
 * be confused, so a world stops the step AFTER the write and runs it again). It re-points the step that wrote an order (the order tool is
 * removed: money is out of the engine): the same shape, an effect that answers facts and a subject.
 */
export const deskCareNode = defineTemplateNode({
    id: "wdesk.care",
    title: { vi: "H\u1eb9n ch\u0103m s\u00f3c", en: "Arm the check-in" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [TOOL.agentTag],
    mode: "auto",
    accounts: [],
    input: z.object({ leadId: z.string().min(1).max(ID_MAX) }),
    output: careOutput,
    model: MODEL,
    run: async (given, ctx) => {
        const written = await ctx.tools.call(TOOL.agentTag, careArgsOf(given.leadId))
        if (!written.ok) return ctx.fail({ kind: "cannot", why: `care_refused:${written.declined === true ? "declined" : written.refusal}` }, written.facts)
        const armed = careArmed.safeParse(written.value)
        if (!armed.success) return ctx.fail({ kind: "cannot", why: `${TOOL.agentTag} answered no task` })
        const subject = written.meta !== undefined && "subject" in written.meta ? written.meta.subject : null
        await ctx.agent.run({
            goal: "Say that the check-in is armed.",
            input: { taskId: armed.data.taskId, dueAt: armed.data.dueAt },
            output: z.object({ ok: z.boolean() }),
            tools: [],
            maxTurns: 1,
        })
        return { ...armed.data, subject: subject === null ? "" : `${subject.kind}:${subject.id}` }
    },
    examples: [
        {
            name: "arms the check-in and reads its task",
            params: {},
            input: { leadId: "l1" },
            tools: [
                {
                    id: TOOL.agentTag,
                    args: careArgsOf("l1"),
                    answer: toolOk({ taskId: "t1", dueAt: "2026-11-15T02:00:00.000Z" }),
                },
            ],
            agent: [{ answer: { ok: true } }],
            output: { taskId: "t1", dueAt: "2026-11-15T02:00:00.000Z", subject: "" },
        },
    ],
})

/**
 * The front desk's contract, as the core's (the one event pipeline's GENERIC trigger scope of a channel message): the route and the person
 * the engine met, the event's subject and its data (one line; the rest of a burst is the run's queue). No chat member.
 */
const deskInput = z.object({
    eventId: z.string().min(1).max(ID_MAX),
    routeId: z.string().min(1).max(ID_MAX),
    contactId: z.string().max(ID_MAX).nullish(),
    accountId: z.string().max(ID_MAX).nullish(),
    subject: z.object({ channel: z.string().min(1).max(ID_MAX), id: z.string().min(1).max(ID_MAX), name: z.string().max(ID_MAX).nullish() }).nullish(),
    data: z.object({
        messageKey: z.string().max(ID_MAX).nullish(),
        text: z.string().max(500).min(1),
        at: z.string().max(ID_MAX).nullish(),
        files: z.array(z.unknown()).nullish(),
        resume: z.string().max(ID_MAX).nullish(),
    }),
})

const handOff = {
    conversationId: ref("trigger.routeId"),
    text: ref("trigger.data.text"),
    channel: ref("trigger.subject.channel"),
    contactId: ref("trigger.contactId", { default: null }),
}

/** The world's front desk: the core's of version 6 (understand, then consult / reconcile / complaint / answer), on template nodes. */
const deskFront = defineTemplateGraph({
    key: DESK_FRONT,
    title: { vi: "L\u1ec5 t\u00e2n (th\u1ebf gi\u1edbi)", en: "Front desk (world)" },
    input: deskInput,
    triggers: [trigger(TRIGGER.zaloMessageReceived, { accounts: [PROVIDER.zaloOa] })],
    openTo: "any",
    start: "understand",
    nodes: {
        understand: node(deskUnderstandNode, {
            input: { conversationId: ref("trigger.routeId"), text: ref("trigger.data.text") },
            routes: { buy: "to-consult", paid: "to-reconcile", complaint: "complaint", question: "answer" },
        }),
        "to-consult": callWorkflow({ agent: "sales", workflow: "consult", version: "latest", input: handOff }),
        "to-reconcile": callWorkflow({ agent: "accounting", workflow: "reconcile", version: "latest", input: handOff }),
        complaint: node(deskComplaintNode, {
            input: {
                conversationId: ref("trigger.routeId"),
                text: ref("trigger.data.text"),
                summary: ref("steps.understand.output.summary"),
            },
            next: "to-owner",
        }),
        "to-owner": outcome({ name: "owner", output: { summary: ref("steps.complaint.output.summary") } }),
        answer: node(deskAnswerNode, {
            input: { conversationId: ref("trigger.routeId"), text: ref("trigger.data.text") },
        }),
    },
})

/** The world's desk agent: the front desk (primary). Its other nodes are run by the worlds' own @1 graphs (`step: "wdesk.<node>"`). */
export const DESK_AGENT_TEMPLATE: TemplateAgent = defineTemplateAgent({
    key: DESK_AGENT,
    label: { vi: "L\u1ec5 t\u00e2n th\u1ebf gi\u1edbi", en: "World desk" },
    accounts: [PROVIDER.zaloOa],
    graphs: [deskFront],
    primary: DESK_FRONT,
})

/**
 * The world's desk plugin: the template agent, the template nodes no graph of it holds (the chat turn, the QR, the ledger, the order), and the
 * one `defineNode` node (the chat turn on the old road).
 */
export const DESK_PLUGIN: Plugin = definePlugin({
    key: DESK_AGENT,
    label: { vi: "Th\u1ebf gi\u1edbi", en: "World" },
    templateAgents: [DESK_AGENT_TEMPLATE],
    templateNodes: [deskChatNode, deskLedgerNode, deskCareNode],
    nodes: [deskLegacyChatNode],
})
