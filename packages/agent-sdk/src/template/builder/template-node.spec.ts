import { z } from "zod"
import { PROVIDER, TOOL } from "../../names"
import { checkTemplateNode, templateExampleMismatches, templateNodeListMismatches } from "./template-example"
import type { AnyTemplateNode } from "./template-example"
import {
    askWritesProblems,
    asJson,
    defineTemplateNode,
    templateNodeProblems,
    toolAnswerRead,
    toolDeclined,
    toolOk,
    toolRefused,
} from "./template-node"
import type { TemplateNodeShape } from "./template-node"
import type {
    DeclinedOf,
    NodeExample,
    ScriptedToolCall,
    TemplateNodeTools,
    ToolAnswerOf,
    ToolRefusal,
} from "./template-node.types"
import { TemplateDefinitionError } from "./template-problems"
import { trusted } from "../../schema/trusted"
import {
    listOrders,
    payRequest,
    remindCheck,
    remindNote,
    remindRecord,
    remindSend,
    roundReport,
} from "./template.fixture"

const shape = (over: Partial<TemplateNodeShape>): TemplateNodeShape => ({
    id: "test.shape",
    description: { vi: "G\u1eedi tin cho kh\u00e1ch.", en: "Sends the customer a message." },
    tools: [TOOL.customerMessageSend],
    mode: "auto",
    accounts: [],
    input: z.object({}),
    output: z.object({ branch: z.enum(["a", "b"]) }),
    examples: [{ name: "one" }],
    ...over,
})

describe("templateNodeProblems", () => {
    it.each<readonly [string, Partial<TemplateNodeShape>, ReadonlyArray<string>]>([
        ["a sound node", {}, []],
        ["no description", { description: undefined }, ["NODE_DESCRIPTION_MISSING"]],
        ["a description with no English", { description: { vi: "G\u1eedi tin cho kh\u00e1ch.", en: " " } }, ["NODE_DESCRIPTION_MISSING"]],
        ["a description with no Vietnamese", { description: { en: "Sends the customer a message." } }, ["NODE_DESCRIPTION_MISSING"]],
        ["a description as a catalogue key only", { description: { key: "node.send" } }, ["NODE_DESCRIPTION_MISSING"]],
        ["a malformed id", { id: "nodot" }, ["NODE_ID_MALFORMED"]],
        ["a tool listed twice", { tools: [TOOL.customerMessageSend, TOOL.customerMessageSend] }, ["NODE_TOOL_DUPLICATE"]],
        ["a requires not in tools", { requires: [TOOL.agentTag] }, ["NODE_TOOL_UNDECLARED"]],
        ["a duplicate provider", { accounts: [PROVIDER.zaloOa, PROVIDER.zaloOa] }, ["NODE_ACCOUNT_DUPLICATE"]],
        ["an input that is not an object", { input: z.string().max(200) }, ["NODE_SCHEMA_NOT_OBJECT"]],
        [
            "routes.by not an output member",
            { routes: { by: "verdict", names: ["a", "b"] } },
            ["NODE_ROUTES_BY_UNKNOWN"],
        ],
        [
            "routes.by on a non-object output",
            { output: z.string().max(200), routes: { by: "branch", names: ["a"] } },
            ["NODE_ROUTES_BY_UNKNOWN"],
        ],
        [
            "route names that are not the enum's options",
            { routes: { by: "branch", names: ["a", "c"] } },
            ["NODE_ROUTE_NAMES_INVALID"],
        ],
        [
            "route names duplicated",
            { output: z.object({ branch: z.string().max(200) }), routes: { by: "branch", names: ["a", "a"] } },
            ["NODE_ROUTE_NAMES_INVALID"],
        ],
        ["route names exactly the enum's options", { routes: { by: "branch", names: ["b", "a"] } }, []],
        ["no example", { examples: [] }, ["NODE_EXAMPLES_EMPTY"]],
        ["two examples of one name", { examples: [{ name: "x" }, { name: "x" }] }, ["NODE_EXAMPLE_NAME_DUPLICATE"]],
    ])("%s", (_label, over, codes) => {
        expect(templateNodeProblems(shape(over)).map((problem) => problem.code)).toEqual(codes)
    })

    it("defineTemplateNode refuses at load with every problem", () => {
        expect(() =>
            defineTemplateNode({
                id: "test.bad",
                title: { key: "t" },
                description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
                tools: [TOOL.customerMessageSend],
                mode: "auto",
                accounts: [PROVIDER.zaloOa],
                input: z.object({}),
                output: z.object({}),
                model: "claude-sonnet-5-5",
                requires: [TOOL.agentTag],
                run: () => Promise.resolve({}),
                examples: [{ name: "x", params: {}, input: {}, output: {} }],
            }),
        ).toThrow(TemplateDefinitionError)
    })
})

describe("askWritesProblems", () => {
    const writes = (tool: string): boolean => tool !== TOOL.contactGet

    it("refuses a node on `ask` that declares two write tools, naming them", () => {
        const node = { id: "test.two", tools: [TOOL.contactUpdate, TOOL.customerMessageSend, TOOL.contactGet], mode: "ask" }
        expect(askWritesProblems(node, writes)).toEqual([
            { code: "NODE_ASK_WRITES_MANY", at: "test.two.tools", detail: `${TOOL.contactUpdate}, ${TOOL.customerMessageSend}` },
        ])
    })

    it("lets a node on `ask` with one write and reads, and a node on `auto` with many writes", () => {
        expect(askWritesProblems({ id: "test.one", tools: [TOOL.customerMessageSend, TOOL.contactGet], mode: "ask" }, writes)).toEqual([])
        expect(
            askWritesProblems({ id: "test.auto", tools: [TOOL.contactUpdate, TOOL.customerMessageSend], mode: "auto" }, writes),
        ).toEqual([])
    })
})

describe("checkTemplateNode: the fixture nodes conform", () => {
    it("runs every example of every fixture node", async () => {
        const nodes: ReadonlyArray<AnyTemplateNode> = [
            listOrders,
            remindCheck,
            remindSend,
            remindRecord,
            remindNote,
            roundReport,
            payRequest,
        ]
        await expect(templateNodeListMismatches(nodes)).resolves.toEqual({})
    })
})

/** A node that calls the send tool once, then asks its agent, so one node drives every mismatch. */
const probe = defineTemplateNode({
    id: "test.probe",
    title: { key: "t" },
    description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
    tools: [TOOL.customerMessageSend, TOOL.leadOrderList],
    mode: "auto",
    accounts: [PROVIDER.zaloOa],
    input: z.object({ text: z.string().max(200), skipAgent: z.boolean().default(false) }),
    output: z.object({ said: z.boolean(), answer: z.string().max(200) }),
    model: "claude-sonnet-5-5",
    requires: [TOOL.customerMessageSend],
    run: async (input, ctx) => {
        const sent = await ctx.tools.call(TOOL.customerMessageSend, { text: input.text })
        if (input.skipAgent) return { said: sent.ok, answer: "" }
        const answer = await ctx.agent.run({ goal: "g", input: input.text, output: z.object({ answer: z.string().max(200) }) })
        return { said: sent.ok, answer: answer.answer }
    },
    examples: [
        {
            name: "says and answers",
            params: {},
            input: { text: "hi" },
            tools: [{ id: TOOL.customerMessageSend, args: { text: "hi" }, answer: toolOk({}) }],
            agent: [{ answer: { answer: "ok" } }],
            output: { said: true, answer: "ok" },
        },
    ],
})

/** Typed loosely on purpose: the table also holds inputs the schema refuses. */
type ProbeExample = NodeExample<z.ZodType, z.ZodType, z.ZodType>

const base: ProbeExample = {
    name: "base",
    params: {},
    input: { text: "hi" },
    tools: [{ id: TOOL.customerMessageSend, args: { text: "hi" }, answer: toolOk({}) }],
    agent: [{ answer: { answer: "ok" } }],
    output: { said: true, answer: "ok" },
}

describe("templateExampleMismatches", () => {
    it.each<readonly [string, ProbeExample, ReadonlyArray<RegExp>]>([
        ["the base example holds", base, []],
        ["a wrong output", { ...base, output: { said: true, answer: "no" } }, [/^output /]],
        [
            "args that differ",
            { ...base, tools: [{ id: TOOL.customerMessageSend, args: { text: "yo" }, answer: toolOk({}) }] },
            [/args/],
        ],
        [
            "a call out of order",
            { ...base, tools: [{ id: TOOL.leadOrderList, answer: toolOk({}) }] },
            [/expected nivo.tool.lead.order.list/],
        ],
        ["a call past the script", { ...base, tools: [] }, [/unexpected nivo.tool.customer.message.send/]],
        ["an agent run past the script", { ...base, agent: [] }, [/agent run 0: unexpected/]],
        ["an agent answer that does not fit", { ...base, agent: [{ answer: { answer: 3 } }] }, [/does not fit/]],
        [
            "a script left unused",
            { ...base, input: { text: "hi", skipAgent: true }, output: { said: true, answer: "" } },
            [/agent turn\(s\) left unused/],
        ],
        [
            "a requires met only by a refusal",
            {
                ...base,
                tools: [{ id: TOOL.customerMessageSend, answer: toolRefused("customer_opted_out") }],
                output: { said: false, answer: "ok" },
            },
            [/requires nivo.tool.customer.message.send/],
        ],
        [
            "an agent that fails as expected",
            {
                ...base,
                agent: [{ fail: { kind: "cannot", why: "w" } }],
                output: undefined,
                failure: { kind: "cannot", why: "w" },
            },
            [],
        ],
        [
            "a failure that was not expected",
            { ...base, agent: [{ fail: { kind: "cannot", why: "w" } }] },
            [/expected output/],
        ],
        [
            "an output where a failure was expected",
            { ...base, output: undefined, failure: { kind: "cannot", why: "w" } },
            [/expected failure/],
        ],
        [
            "an agent call to an undeclared tool",
            { ...base, agent: [{ answer: { answer: "ok" }, calls: [{ id: TOOL.agentTag, answer: toolOk({}) }] }] },
            [/not in the node's tools/],
        ],
        [
            "a failing agent turn carries the reads the model made before it gave up",
            {
                ...base,
                agent: [
                    {
                        fail: { kind: "confused", question: "q" },
                        calls: [{ id: TOOL.customerMessageSend, answer: toolRefused("customer_opted_out") }],
                    },
                ],
                output: undefined,
                failure: { kind: "confused", question: "q" },
            },
            [],
        ],
        [
            "a failing agent turn's call to an undeclared tool",
            {
                ...base,
                agent: [{ fail: { kind: "cannot", why: "w" }, calls: [{ id: TOOL.agentTag, answer: toolOk({}) }] }],
                output: undefined,
                failure: { kind: "cannot", why: "w" },
            },
            [/agent run 0: nivo.tool.agent.tag is not in the node's tools/],
        ],
        ["an input the schema refuses", { ...base, input: { text: 3 } }, [/input does not fit/]],
    ])("%s", async (_label, example, expected) => {
        const lines = await templateExampleMismatches(probe, example)
        expect(lines).toHaveLength(expected.length)
        expected.forEach((pattern, index) => expect(lines[index]).toMatch(pattern))
    })

    it("an example stopped midway reports its sentence alone, without the error code", async () => {
        const lines = await templateExampleMismatches(probe, {
            ...base,
            agent: [{ answer: { answer: "ok" }, calls: [{ id: TOOL.agentTag, answer: toolOk({}) }] }],
        })
        expect(lines).toEqual(["agent run 0: nivo.tool.agent.tag is not in the node's tools"])
    })

    it("an undeclared call from node code fails the example", async () => {
        const rogue = defineTemplateNode({
            id: "test.rogue",
            title: { key: "t" },
            description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
            tools: [],
            mode: "auto",
            accounts: [],
            input: z.object({}),
            output: z.object({}),
            model: "claude-sonnet-5-5",
            run: async (_input, ctx) => {
                await ctx.tools.call(TOOL.agentTag, {})
                return {}
            },
            examples: [{ name: "x", params: {}, input: {}, output: {} }],
        })
        expect(await checkTemplateNode(rogue)).toEqual([
            "x: tool call 0: nivo.tool.agent.tag is not in the node's tools",
        ])
    })

    it("a route the output names must be a declared name", async () => {
        const lines = await templateExampleMismatches(remindCheck, {
            name: "bad route",
            params: {},
            input: { orderId: "o1" },
            agent: [{ answer: { verdict: "due", note: "" }, calls: [{ id: TOOL.leadOrderList, answer: toolOk({}) }] }],
            output: { verdict: "due", note: "" },
        })
        expect(lines).toEqual([])
    })

    it("ctx.fail ends the node with its reason and the run reads its instant and item", async () => {
        const timed = defineTemplateNode({
            id: "test.timed",
            title: { key: "t" },
            description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
            tools: [],
            mode: "auto",
            accounts: [],
            input: z.object({}),
            output: z.object({ at: z.string().max(200), key: z.string().max(200) }),
            model: "claude-sonnet-5-5",
            run: (_input, ctx) =>
                ctx.run.item === null
                    ? Promise.resolve(ctx.fail({ kind: "cannot", why: "no item" }))
                    : Promise.resolve({ at: ctx.run.at, key: ctx.run.item.key }),
            examples: [
                {
                    name: "in a loop",
                    params: {},
                    input: {},
                    at: "2026-02-01",
                    item: { key: "o9", index: 0 },
                    output: { at: "2026-02-01", key: "o9" },
                },
                { name: "outside", params: {}, input: {}, failure: { kind: "cannot", why: "no item" } },
            ],
        })
        expect(await checkTemplateNode(timed)).toEqual([])
    })
})

describe("typed refusals and JSON inputs (checked by tsc)", () => {
    it("a closed tool's refusal is its literal union; an open tool's is any text", () => {
        const answer: ToolAnswerOf<typeof TOOL.customerMessageSend> = toolRefused("customer_opted_out")
        const said = answer.ok ? "sent" : answer.refusal === "customer_opted_out" ? "opted out" : "other"
        // @ts-expect-error -- not a refusal of the customer send
        const typo: ToolRefusal<typeof TOOL.customerMessageSend> = "customer_not_linked"
        const open: ToolRefusal<typeof TOOL.contactGet> = "anything"
        expect([said, typo, open]).toEqual(["opted out", "customer_not_linked", "anything"])
    })

    it("every tool that can ask answers its own `declined` member (a person said no to its approval); a read never does", () => {
        const answer: ToolAnswerOf<typeof TOOL.agentTag> = toolDeclined()
        const confirm: ToolRefusal<typeof TOOL.agentTag> = "conversation_mismatch"
        const readNever: [DeclinedOf<typeof TOOL.contactGet>] extends [never] ? true : false = true
        const writeAsks: DeclinedOf<typeof TOOL.mailMessageSend> = toolDeclined()
        // @ts-expect-error -- `declined` is no refusal code of a tool: it is the answer's own member
        const notARefusal: ToolRefusal<typeof TOOL.customerMessageSend> = "declined"
        expect(answer.ok ? "done" : answer.declined === true ? "declined" : "other").toBe("declined")
        expect([confirm, readNever, writeAsks.declined, notARefusal]).toEqual(["conversation_mismatch", true, true, "declined"])
    })

    it("a write's answer does not let the node read `refusal` before it handled `declined` (TypeScript forces the branch)", () => {
        const told = (answer: ToolAnswerOf<typeof TOOL.customerMessageSend>): string => {
            if (answer.ok) return "sent"
            // @ts-expect-error -- the declined member has no refusal: the node handles `answer.declined` first
            const unhandled: string = answer.refusal
            if (answer.declined === true) return "declined"
            return `${unhandled}:${answer.refusal}`
        }
        expect(told(toolDeclined())).toBe("declined")
        expect(told(toolRefused("customer_opted_out"))).toBe("customer_opted_out:customer_opted_out")
    })

    it("reads the engine's declined code on the wire as the declined member, and leaves any other answer as it is", () => {
        expect(toolAnswerRead(toolRefused("declined", { by: "owner" }))).toEqual({
            ok: false,
            declined: true,
            refusal: "declined",
            facts: { by: "owner" },
        })
        const refused = toolRefused("customer_opted_out")
        expect(toolAnswerRead(refused)).toBe(refused)
        const ok = toolOk({ id: "m1" })
        expect(toolAnswerRead(ok)).toBe(ok)
    })

    it("`ctx.tools.call` answers the tool's typed refusals; a scripted answer takes any code until the fixtures are typed", async () => {
        const scripted: ScriptedToolCall = { id: TOOL.agentTag, answer: toolRefused("conversation_mismatch") }
        const ok: ScriptedToolCall = { id: TOOL.agentTag, answer: toolOk({}) }
        const tools: TemplateNodeTools = { call: () => Promise.resolve(trusted<never>(toolDeclined())) }
        const compared = async (): Promise<string> => {
            const answer = await tools.call(TOOL.agentTag, { orderId: "o1" })
            if (answer.ok) return "confirmed"
            if (answer.declined === true) return "declined"
            // @ts-expect-error -- not a refusal of the order confirm: the typed refusal of `ctx.tools.call` refuses the comparison
            if (answer.refusal === "customer_opted_out") return "never"
            return answer.refusal
        }
        expect([scripted.answer.ok, ok.answer.ok, await compared()]).toEqual([false, true, "declined"])
    })

    it("asJson takes an interface of JSON members and refuses one that holds a Date", () => {
        interface Order {
            readonly id: string
            readonly lines: ReadonlyArray<{ readonly qty: number }>
            readonly note?: string
        }
        interface Dated {
            readonly at: Date
        }
        const order: Order = { id: "o1", lines: [{ qty: 2 }] }
        const dated: Dated = { at: new Date(0) }
        expect(asJson(order)).toEqual({ id: "o1", lines: [{ qty: 2 }] })
        // @ts-expect-error -- a Date is no JSON
        expect(asJson(dated)).toBe(dated)
    })
})
