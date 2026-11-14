import { PROVIDER, TOOL, TRIGGER, type ProviderKey, type ToolId, type TriggerVerb } from "@nivo-lite/agent-sdk/names"
import {
    compileTemplateGraph,
    defineTemplateNode,
    node,
    ref,
    templateGraphProblems,
    toolOk,
    trigger,
    type ScriptedToolCall,
} from "@nivo-lite/agent-sdk/template"
import { isToolId } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { INSTALLED } from "@modules/domain/installed-plugins"
import {
    NIVO_PROVIDER,
    askCalledWritesProblems,
    calledToolsOf,
    templateToolLookupOf,
    templateTriggerLookup,
    writesTool,
} from "./template-lookups.policy"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"

/** A key by its form, as the @2 graph schema reads a saved graph's provider key (`nivo`, a provider such as `telegram`, a CRM's `crm.<id>`). */
const isProviderKeyForm = (value: string): value is ProviderKey => /^([a-z][a-z0-9_]{1,30}|crm.[a-z][a-z0-9-]{1,30})$/.test(value)

/** A key as the save check is handed it: `nivo` and a CRM's provider key (`crm.nivoweb`) are read as the keys they are. */
const keyOf = (key: string): ProviderKey => {
    if (!isProviderKeyForm(key)) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: `not a provider key: ${key}` } })
    return key
}

/** A tool id by the SDK's grammar, as the @2 graph schema reads a saved graph's tool (a source's generated tool, or one nobody owns). */
const isHandedToolId = (value: string): value is ToolId => isToolId(value)

/** A tool id as the save check is handed it from a saved graph. */
const toolIdOf = (id: string): ToolId => {
    if (!isHandedToolId(id)) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: `not a nivo.tool.* id: ${id}` } })
    return id
}

const NIVO = keyOf(NIVO_PROVIDER)

describe("the engine's lookups of the @2 save checks", () => {
    const tools = templateToolLookupOf()

    it("knows the core names, owns a tool by the tool specs (nivo: every tool no provider owns)", () => {
        expect(tools.known(TOOL.customerMessageSend)).toBe(true)
        expect(tools.known(toolIdOf("nivo.tool.nothing.here"))).toBe(false)
        expect(tools.owns(PROVIDER.zaloOa, TOOL.customerMessageSend)).toBe(true)
        expect(tools.owns(PROVIDER.telegram, TOOL.customerMessageSend)).toBe(true)
        expect(tools.owns(PROVIDER.smtp, TOOL.customerMessageSend)).toBe(false)
        expect(tools.owns(NIVO, TOOL.customerMessageSend)).toBe(false)
        expect(tools.owns(NIVO, TOOL.agentTag)).toBe(true)
    })

    it("owns the catalogue additions: Casso's credits, the mail send on smtp, and a CRM's generated operations on the CRM's provider key", () => {
        expect(tools.owns(PROVIDER.casso, TOOL.paymentCreditList)).toBe(true)
        expect(tools.owns(PROVIDER.sepay, TOOL.bankTransactionList)).toBe(true)
        expect(tools.owns(PROVIDER.smtp, TOOL.mailMessageSend)).toBe(true)
        expect(tools.owns(NIVO, TOOL.mailMessageSend)).toBe(false)
        const prices = toolIdOf("nivo.api.crm.nivoweb.get.prices")
        expect(tools.owns(keyOf("crm.nivoweb"), prices)).toBe(true)
        expect(tools.owns(keyOf("crm.other"), prices)).toBe(false)
        expect(tools.owns(keyOf("openapi"), prices)).toBe(false)
        expect(tools.owns(NIVO, prices)).toBe(false)
        expect(tools.known(prices)).toBe(true)
        // A shop's own CRM that no package declares owns its generated operations the same way.
        expect(tools.owns(keyOf("crm.shopcrm"), toolIdOf("nivo.api.crm.shopcrm.get.orders"))).toBe(true)
    })

    it("tells what each verb supplies PER PROVIDER, from the trigger registry over today's catalogues", () => {
        const namesOf = (verb: TriggerVerb, provider?: ProviderKey): ReadonlyArray<string> => {
            const supply = templateTriggerLookup.supplies(verb, provider)
            return supply.kind === "fixed" ? supply.params.map((one) => one.name) : [supply.kind]
        }
        /** The members of the `data` a verb supplies through a provider (the event's own facts, one trigger pipeline). */
        const dataOf = (verb: TriggerVerb, provider?: ProviderKey): ReadonlyArray<string> => {
            const supply = templateTriggerLookup.supplies(verb, provider)
            if (supply.kind !== "fixed") return [supply.kind]
            return supply.params.find((one) => one.name === "data")?.members?.map((one) => one.name) ?? []
        }
        expect(templateTriggerLookup.supplies(TRIGGER.workflowCalled)).toEqual({ kind: "caller" })
        // A customer channel supplies the message; the website form (the engine road) supplies the lead and its request.
        // R6: each channel its own verb, the website form its own (the engine road); a provider of another channel is unknown, and
        // Meta serves no verb.
        // One trigger pipeline: the scope is generic (`eventId`, `accountId`, `contactId`, `routeId`, `subject`, `data`, `locale`) and the
        // words of the line are a member of `data` (`trigger.data.text`), never a top-level member.
        expect(namesOf(TRIGGER.zaloMessageReceived, PROVIDER.zaloOa)).toEqual(["eventId", "accountId", "contactId", "routeId", "subject", "data", "locale"])
        expect(dataOf(TRIGGER.zaloMessageReceived, PROVIDER.zaloOa)).toContain("text")
        expect(namesOf(TRIGGER.zaloMessageReceived, PROVIDER.meta)).toEqual(["unknown"])
        expect(dataOf(TRIGGER.telegramMessageReceived, PROVIDER.telegram)).toContain("text")
        expect(namesOf(TRIGGER.telegramMessageReceived, PROVIDER.telegram)).not.toContain("text")
        expect(namesOf(TRIGGER.zaloMessageReceived, PROVIDER.telegram)).toEqual(["unknown"])
        expect(namesOf(TRIGGER.zaloMessageReceived)).toEqual(["unknown"])
        // The website form is the generic person-on-account scope too; its request and contact details are members of `data`.
        expect(namesOf(TRIGGER.websiteMessageReceived)).toEqual(["eventId", "accountId", "contactId", "routeId", "subject", "data", "locale"])
        expect(dataOf(TRIGGER.websiteMessageReceived)).toEqual(expect.arrayContaining(["request", "contact"]))
        expect(namesOf(TRIGGER.websiteMessageReceived, PROVIDER.zaloOa)).toEqual(["unknown"])
        // Every bank feed by its provider trigger names the transaction and the direction (Ledger, TOOLS-LEAD W2: SePay's core road, which
        // guaranteed the transaction id alone, left the registry). Every bank feed's row fills the declared members (`TriggerSpec.reads`):
        // the amount, the content, the time, the account and the bank reference.
        // Every bank feed is the generic account-event scope; the transaction, its direction and the declared row facts (amount, content,
        // time, account, bank reference) are members of `data` (E-RED: they were listed at the top, where a pipeline run never finds them).
        for (const feed of [PROVIDER.sepay, PROVIDER.casso]) {
            expect(namesOf(TRIGGER.paymentCreditReceived, feed)).toEqual(["eventId", "accountId", "data", "locale"])
            expect(dataOf(TRIGGER.paymentCreditReceived, feed)).toEqual([
                "transactionId",
                "direction",
                "amountVnd",
                "content",
                "at",
                "account",
                "bankRef",
            ])
        }
        expect(namesOf(TRIGGER.paymentCreditReceived)).toEqual(["unknown"])
        expect(namesOf(TRIGGER.mailMessageReceived, PROVIDER.imap)).toEqual([
            "eventIds",
            "count",
            "providerTrigger",
            "connectionId",
            "role",
        ])
        // The clock's slot is `data.slotMs` (the generic scope: its id, its data, the run's language).
        expect(templateTriggerLookup.supplies(TRIGGER.clockTick)).toEqual({
            kind: "fixed",
            params: [
                { name: "eventId", type: "string" },
                { name: "data", type: "object", members: [{ name: "slotMs", type: "integer" }] },
                { name: "locale", type: "string" },
            ],
        })
    })

    it("says who carries each verb: the engine's own road (no account) or a provider (at least one provider listed)", () => {
        const carriedBy = templateTriggerLookup.carriedBy
        expect(carriedBy === undefined).toBe(false)
        const of = (verb: TriggerVerb): string => carriedBy?.(verb) ?? "absent"
        expect(of(TRIGGER.workflowCalled)).toBe("engine")
        expect(of(TRIGGER.clockTick)).toBe("engine")
        expect(of(TRIGGER.timerDue)).toBe("engine")
        expect(of(TRIGGER.chatMessageReceived)).toBe("engine")
        expect(of(TRIGGER.websiteMessageReceived)).toBe("engine")
        expect(of(TRIGGER.zaloMessageReceived)).toBe("provider")
        expect(of(TRIGGER.telegramMessageReceived)).toBe("provider")
        expect(of(TRIGGER.paymentCreditReceived)).toBe("provider")
        expect(of(TRIGGER.mailMessageReceived)).toBe("provider")
    })
})

/** A one-node @2 graph whose node calls the tool of `call` at the node's ONE `mode` through the providers it lists (none: NIVO's own). */
const oneNodeGraph = (call: ScriptedToolCall, mode: "auto" | "ask", accounts: ReadonlyArray<ProviderKey> = []) => {
    const tool = call.id
    const step = defineTemplateNode({
        id: `test.one.${mode}`,
        title: { key: "t" },
        description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
        tools: [tool],
        mode,
        accounts,
        input: z.object({ orderId: z.string() }),
        output: z.object({ done: z.boolean() }),
        run: async (input, ctx) => {
            const answer = await ctx.tools.call(tool, { orderId: input.orderId })
            return { done: answer.ok }
        },
        examples: [
            {
                name: "calls",
                params: {},
                input: { orderId: "o-1" },
                tools: [call],
                output: { done: true },
            },
        ],
    })
    return compileTemplateGraph({
        key: "test.one",
        title: { key: "g" },
        input: z.object({ conversationId: z.string(), text: z.string() }),
        triggers: [trigger(TRIGGER.zaloMessageReceived, { accounts: [PROVIDER.zaloOa] })],
        start: "pay",
        nodes: { pay: node(step, { input: { orderId: ref("trigger.conversationId") } }) },
    }).graph
}

/** The codes the @2 save check (the engine's own lookups) answers for the graph, with where. */
const saveCodesOf = (
    call: ScriptedToolCall,
    mode: "auto" | "ask",
    accounts: ReadonlyArray<ProviderKey> = [],
): ReadonlyArray<string> => {
    const graph = oneNodeGraph(call, mode, accounts)
    return templateGraphProblems(graph.spec, { nodes: graph.nodes, tools: templateToolLookupOf() }).map(
        (problem) => `${problem.code}@${problem.at}`,
    )
}

const SETTLE: ScriptedToolCall = { id: TOOL.agentTag, answer: toolOk({}) }
const LINK: ScriptedToolCall = { id: TOOL.contactIdentityLink, answer: toolOk({}) }
const INVOICE: ScriptedToolCall = { id: TOOL.invoiceCreate, answer: toolOk({}) }
const POST: ScriptedToolCall = { id: TOOL.teamMessagePost, answer: toolOk({}) }
const READ: ScriptedToolCall = { id: TOOL.brainSearch, answer: toolOk({}) }

// nivo-frame `rights`: every node declares ONE mode; the save never judges a mode per tool (no ask-only tool, no unstated write).
describe("the @2 save check under the engine's lookups", () => {
    it("accepts either mode on any write or read, whatever it moves: the node's ONE mode is the only mode", () => {
        for (const call of [SETTLE, LINK, POST, READ]) {
            expect([call.id, saveCodesOf(call, "auto")]).toEqual([call.id, []])
            expect([call.id, saveCodesOf(call, "ask")]).toEqual([call.id, []])
        }
    })

    it("refuses a provider that owns none of the node's tools, and accepts one that owns it", () => {
        expect(saveCodesOf(INVOICE, "ask", [PROVIDER.zaloOa])).toEqual([
            `NODE_ACCOUNT_PROVIDER_NOT_OWNER@nodes.pay.accounts.0.${PROVIDER.zaloOa}`,
        ])
        expect(saveCodesOf({ id: TOOL.customerMessageSend, answer: toolOk({}) }, "auto", [PROVIDER.zaloOa])).toEqual([])
    })

    it("tells writes from reads by the engine's specs and the installed definitions", () => {
        expect(writesTool(TOOL.teamMessagePost)).toBe(true)
        expect(writesTool(TOOL.agentTag)).toBe(true)
        expect(writesTool(TOOL.brainSearch)).toBe(false)
        expect(writesTool("nivo.tool.nothing.here")).toBe(false)
    })
})

/**
 * A one-node @2 graph whose node DECLARES `declared` and CALLS, in its one example, the tools of `called` in order (the default record
 * tools a node holds undeclared among them), at the node's ONE `mode`.
 */
const callingGraph = (mode: "auto" | "ask", declared: ReadonlyArray<ToolId>, called: ReadonlyArray<ScriptedToolCall>) => {
    const step = defineTemplateNode({
        id: `test.calls.${mode}`,
        title: { key: "t" },
        description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
        tools: [...declared],
        mode,
        accounts: [],
        input: z.object({ orderId: z.string() }),
        output: z.object({ done: z.boolean() }),
        run: async (input, ctx) => {
            for (const call of called) await ctx.tools.call(call.id, { orderId: input.orderId })
            return { done: true }
        },
        examples: [{ name: "calls", params: {}, input: { orderId: "o-1" }, tools: [...called], output: { done: true } }],
    })
    return compileTemplateGraph({
        key: "test.calls",
        title: { key: "g" },
        input: z.object({ conversationId: z.string(), text: z.string() }),
        triggers: [trigger(TRIGGER.workflowCalled)],
        start: "confirm",
        nodes: { confirm: node(step, { input: { orderId: ref("trigger.conversationId") } }) },
    }).graph
}

/** The `NODE_ASK_WRITES_MANY` problems of a graph under the engine's save checks: the SDK's (declared tools) and the engine's (called tools). */
const askWritesOf = (graph: ReturnType<typeof callingGraph>): ReadonlyArray<string> =>
    [
        ...templateGraphProblems(graph.spec, { nodes: graph.nodes, tools: templateToolLookupOf() }),
        ...askCalledWritesProblems(graph.spec, graph.nodes),
    ]
        .filter((problem) => problem.code === "NODE_ASK_WRITES_MANY")
        .map((problem) => `${problem.at} (${problem.detail ?? ""})`)

const UPDATE: ScriptedToolCall = { id: TOOL.recordUpdate, answer: toolOk({}) }
const GET: ScriptedToolCall = { id: TOOL.recordGet, answer: toolOk({}) }
const SEND: ScriptedToolCall = { id: TOOL.customerMessageSend, answer: toolOk({}) }

// nivo-frame `rights` rule 11e: one approval card asks for ONE write, so a node step on `ask` holds at most one write tool.
describe("one write per node step on ask (NODE_ASK_WRITES_MANY under the engine's lookups)", () => {
    it("refuses a step on ask that DECLARES two writes, and names them", () => {
        const graph = callingGraph("ask", [TOOL.customerMessageSend, TOOL.teamMessagePost], [SEND, POST])
        expect(askWritesOf(graph)).toEqual([`nodes.confirm.tools (${TOOL.customerMessageSend}, ${TOOL.teamMessagePost})`])
    })

    it("refuses a step on ask that declares one write but CALLS a default record write too (its examples say so)", () => {
        const graph = callingGraph("ask", [TOOL.customerMessageSend], [UPDATE, SEND])
        expect(askWritesOf(graph)).toEqual([`nodes.confirm.tools (${TOOL.customerMessageSend}, ${TOOL.recordUpdate})`])
    })

    it("passes a step on ask with one write among reads, and a step on auto with many writes", () => {
        expect(askWritesOf(callingGraph("ask", [TOOL.customerMessageSend], [GET, SEND]))).toEqual([])
        expect(askWritesOf(callingGraph("ask", [], [GET, UPDATE]))).toEqual([])
        expect(askWritesOf(callingGraph("auto", [TOOL.customerMessageSend, TOOL.teamMessagePost], [UPDATE, SEND, POST]))).toEqual([])
    })

    it("reads the tools a node calls from its examples, the model's calls of its agent turns included", () => {
        const graph = callingGraph("ask", [TOOL.customerMessageSend], [GET, UPDATE, SEND])
        const [calls] = [...graph.nodes.values()]
        expect(calls === undefined ? [] : calledToolsOf(calls)).toEqual([TOOL.recordGet, TOOL.recordUpdate, TOOL.customerMessageSend])
    })

    // Ledger (E-RED 2026-11-14): `booking.book` is at catalogue version 8 now (later package passes; the confirm step is still the one
    // `ask` record write this case is about).
    it("passes every installed template graph: the booking confirmation asks for its one record write (booking.book version 8)", () => {
        const book = INSTALLED.templateGraphOf("booking.book")
        expect(book?.graph.spec.catalogue?.version).toBe(8)
        const confirm = book?.graph.spec.nodes.find((step) => step.key === "confirm")
        expect(confirm?.kind === "node" ? [confirm.step, confirm.mode] : null).toEqual(["booking.confirm", "ask"])
        for (const { graph } of INSTALLED.templates()
            .map((template) => INSTALLED.templateGraphOf(template.id))
            .filter((found) => found !== null)) {
            expect([graph.key, askWritesOf(graph)]).toEqual([graph.key, []])
        }
    })
})
