import { z } from "zod"
import { PROVIDER, TOOL, TRIGGER } from "../../names"
import type { TemplateTriggerLookup, TemplateToolLookup } from "./graph-problems"
import { ifNode, item, loop, node, outcome, present, ref, trigger } from "./graph-builder"
import type { TemplateGraphConfig } from "./graph-builder.types"
import { defineTemplateNode, toolOk, toolRefused } from "./template-node"

const textOf = (value: unknown): string | null => (typeof value === "string" ? value : null)

/**
 * The value a JSON text holds, for a spec that reads a stored document back; `undefined` when the text is no JSON (the spec then fails on
 * the assertion it makes of the value, never on a throw far from it).
 */
export const parseJson = (text: string): unknown => {
    try {
        return JSON.parse(text)
    } catch (cause) {
        return cause instanceof SyntaxError ? undefined : cause
    }
}

/** Lists the open orders: a read through NIVO's own tool. */
export const listOrders = defineTemplateNode({
    id: "test.orders-list",
    title: { key: "t" },
    description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
    tools: [TOOL.orderOpenList],
    mode: "auto",
    accounts: [],
    input: z.object({}),
    output: z.object({ orders: z.array(z.object({ orderId: z.string().max(200), amount: z.number() })).max(50) }),
    model: "claude-sonnet-5-5",
    run: async (_input, ctx) => {
        const answer = await ctx.tools.call(TOOL.orderOpenList, {})
        if (!answer.ok) return ctx.fail({ kind: "cannot", why: answer.refusal })
        const orders = answer.value["orders"]
        return { orders: Array.isArray(orders) ? orders.flatMap((order) => parsedOrder(order)) : [] }
    },
    examples: [
        {
            name: "lists the open orders",
            params: {},
            input: {},
            tools: [{ id: TOOL.orderOpenList, args: {}, answer: toolOk({ orders: [{ orderId: "o1", amount: 5 }] }) }],
            output: { orders: [{ orderId: "o1", amount: 5 }] },
        },
    ],
})

const orderSchema = z.object({ orderId: z.string().max(200), amount: z.number() })
const parsedOrder = (value: unknown): ReadonlyArray<z.output<typeof orderSchema>> => {
    const parsed = orderSchema.safeParse(value)
    return parsed.success ? [parsed.data] : []
}

/** Decides with the model whether an order is due: a routing node. */
export const remindCheck = defineTemplateNode({
    id: "test.remind-check",
    title: { key: "t" },
    description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
    tools: [TOOL.leadOrderList],
    mode: "auto",
    accounts: [],
    input: z.object({ orderId: z.string().max(200) }),
    output: z.object({ verdict: z.enum(["due", "later"]), note: z.string().max(200) }),
    model: "claude-sonnet-5-5",
    requires: [TOOL.leadOrderList],
    routes: { by: "verdict", names: ["due", "later"] },
    run: (input, ctx) =>
        ctx.agent.run({
            goal: "Say whether the order is due for a reminder.",
            input: { orderId: input.orderId },
            output: z.object({ verdict: z.enum(["due", "later"]), note: z.string().max(200) }),
            maxTurns: 3,
        }),
    examples: [
        {
            name: "an order past its date is due",
            params: {},
            input: { orderId: "o1" },
            agent: [
                {
                    answer: { verdict: "due", note: "3 days late" },
                    calls: [{ id: TOOL.leadOrderList, answer: toolOk({}) }],
                },
            ],
            output: { verdict: "due", note: "3 days late" },
        },
        {
            name: "a confused model ends the node",
            params: {},
            input: { orderId: "o2" },
            agent: [{ fail: { kind: "confused", question: "Which date?" } }],
            failure: { kind: "confused", question: "Which date?" },
        },
    ],
})

/** Tells the customer, through the first bound messaging provider. */
export const remindSend = defineTemplateNode({
    id: "test.remind-send",
    title: { key: "t" },
    description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
    tools: [TOOL.customerMessageSend],
    mode: "ask",
    accounts: [PROVIDER.zaloOa, PROVIDER.telegram],
    input: z.object({ orderId: z.string().max(200) }),
    output: z.object({ messageId: z.string().max(200).nullable() }),
    params: z.object({ tone: z.enum(["warm", "short"]).default("warm") }),
    model: "claude-sonnet-5-5",
    run: async (input, ctx) => {
        const answer = await ctx.tools.call(TOOL.customerMessageSend, {
            orderId: input.orderId,
            tone: ctx.params.tone,
            at: ctx.run.at,
        })
        return { messageId: answer.ok ? textOf(answer.value["messageId"]) : null }
    },
    examples: [
        {
            name: "sends and answers the message id",
            params: {},
            input: { orderId: "o1" },
            tools: [
                {
                    id: TOOL.customerMessageSend,
                    args: { orderId: "o1", tone: "warm", at: "2026-01-05T09:00:00.000+07:00" },
                    answer: toolOk({ messageId: "m1" }, PROVIDER.zaloOa),
                },
            ],
            output: { messageId: "m1" },
        },
        {
            name: "a refusal is a fact, never a throw",
            params: { tone: "short" },
            input: { orderId: "o1" },
            tools: [{ id: TOOL.customerMessageSend, answer: toolRefused("customer_opted_out") }],
            output: { messageId: null },
        },
    ],
})

/** Records that the reminder went. */
export const remindRecord = defineTemplateNode({
    id: "test.remind-record",
    title: { key: "t" },
    description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
    tools: [TOOL.ledgerEntryAppend],
    mode: "auto",
    accounts: [],
    input: z.object({ orderId: z.string().max(200), messageId: z.string().max(200) }),
    output: z.object({ recorded: z.boolean() }),
    model: "claude-sonnet-5-5",
    run: async (input, ctx) => {
        const answer = await ctx.tools.call(TOOL.ledgerEntryAppend, {
            entry: { orderId: input.orderId, messageId: input.messageId },
        })
        return { recorded: answer.ok }
    },
    examples: [
        {
            name: "records",
            params: {},
            input: { orderId: "o1", messageId: "m1" },
            tools: [{ id: TOOL.ledgerEntryAppend, answer: toolOk({}) }],
            output: { recorded: true },
        },
    ],
})

/** Notes an order that waits: a node with no tool. */
export const remindNote = defineTemplateNode({
    id: "test.remind-note",
    title: { key: "t" },
    description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
    tools: [],
    mode: "auto",
    accounts: [],
    input: z.object({ orderId: z.string().max(200), why: z.string().max(200).optional() }),
    output: z.object({ noted: z.string().max(200) }),
    model: "claude-sonnet-5-5",
    run: (input) => Promise.resolve({ noted: input.orderId }),
    examples: [{ name: "notes", params: {}, input: { orderId: "o1" }, output: { noted: "o1" } }],
})

/** Tells the team what the round did: a side node. */
export const roundReport = defineTemplateNode({
    id: "test.round-report",
    title: { key: "t" },
    description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
    tools: [TOOL.teamMessagePost],
    mode: "auto",
    accounts: [],
    input: z.object({ items: z.array(z.object({ key: z.string().max(200), output: z.unknown() })).max(50) }),
    output: z.object({ posted: z.boolean() }),
    model: "claude-sonnet-5-5",
    blocking: false,
    run: async (input, ctx) => {
        const answer = await ctx.tools.call(TOOL.teamMessagePost, { count: input.items.length })
        return { posted: answer.ok }
    },
    examples: [
        {
            name: "posts the count",
            params: {},
            input: { items: [] },
            tools: [{ id: TOOL.teamMessagePost, args: { count: 0 }, answer: toolOk({}) }],
            output: { posted: true },
        },
    ],
})

/** Asks for a ledger entry on one of two bank providers, then tells the customer: the node declares `ask`. */
export const payRequest = defineTemplateNode({
    id: "test.pay-request",
    title: { key: "t" },
    description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
    tools: [TOOL.ledgerEntryAppend, TOOL.customerMessageSend],
    mode: "ask",
    accounts: [PROVIDER.sepay, PROVIDER.casso, PROVIDER.zaloOa],
    input: z.object({ orderId: z.string().max(200) }),
    output: z.object({ asked: z.boolean() }),
    model: "claude-sonnet-5-5",
    run: async (input, ctx) => {
        const answer = await ctx.tools.call(TOOL.ledgerEntryAppend, { entry: { orderId: input.orderId } })
        return { asked: answer.ok }
    },
    examples: [
        {
            name: "asks",
            params: {},
            input: { orderId: "o1" },
            tools: [{ id: TOOL.ledgerEntryAppend, answer: toolOk({}, PROVIDER.sepay) }],
            output: { asked: true },
        },
    ],
})

/** The reminder round: a list, a loop whose body has a routing node, three more nodes and an `ifNode`, a report and an outcome. */
export const roundConfig: TemplateGraphConfig = {
    key: "test.round",
    title: { key: "graphRound" },
    input: z.object({ preset: z.string().max(200), leadId: z.string().max(200).optional() }),
    triggers: [trigger(TRIGGER.clockTick, { args: { preset: "daily" } })],
    start: "list",
    nodes: {
        list: node(listOrders, { next: "each" }),
        each: loop({
            over: ref("steps.list.output.orders"),
            key: "orderId",
            body: {
                start: "check",
                collect: "record",
                nodes: {
                    check: node(remindCheck, {
                        input: { orderId: item("orderId") },
                        routes: { due: "send", later: "note" },
                    }),
                    send: node(remindSend, {
                        input: { orderId: item("orderId") },
                        params: { tone: "short" },
                        next: "sent",
                    }),
                    sent: ifNode({ when: present(ref("steps.send.output.messageId")), yes: "record", no: "note" }),
                    record: node(remindRecord, {
                        input: {
                            orderId: item("orderId"),
                            messageId: ref("steps.send.output.messageId", { default: "" }),
                        },
                    }),
                    note: node(remindNote, {
                        input: { orderId: item("orderId"), why: ref("steps.check.output.note", { default: "" }) },
                    }),
                },
            },
            next: "report",
        }),
        report: node(roundReport, { input: { items: ref("steps.each.output.items") }, next: "done" }),
        done: outcome({ name: "done", output: { posted: ref("steps.report.output.posted") } }),
    },
}

/** The engine's tool lookup as a spec stands it in: every tool known, only `sepay` / `casso` own the ledger entry. No tool is special. */
export const openToolLookup: TemplateToolLookup = {
    known: () => true,
    owns: (provider, tool) =>
        tool !== TOOL.ledgerEntryAppend || provider === PROVIDER.sepay || provider === PROVIDER.casso,
}

/** The engine's trigger lookup as a spec stands it in: the clock supplies `preset`, a workflow call supplies what the caller maps. */
export const exampleTriggerLookup: TemplateTriggerLookup = {
    supplies: (verb) => {
        if (verb === TRIGGER.workflowCalled) return { kind: "caller" }
        if (verb === TRIGGER.clockTick) return { kind: "fixed", params: [{ name: "preset", type: "string" }] }
        if (verb === TRIGGER.zaloMessageReceived) {
            return {
                kind: "fixed",
                params: [
                    { name: "conversationId", type: "string" },
                    { name: "text", type: "string" },
                ],
            }
        }
        return { kind: "unknown" }
    },
}
