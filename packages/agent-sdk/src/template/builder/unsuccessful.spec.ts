import { z } from "zod"
import { graphSpecSchema } from "../../graph/graph-spec.schema"
import { graphSpecV2Schema, graphSpecV2WrittenSchema } from "../../graph/graph-spec-v2.schema"
import type { GraphSpecV2, GraphV2Step } from "../../graph/graph-spec-v2.types"
import { TOOL, TRIGGER } from "../../names"
import { endRound, equals, loop, node, outcome, ref, trigger } from "./graph-builder"
import { defineTemplateNode, toolDeclined, toolOk } from "./template-node"
import type { GraphStep, NoticeFact, TemplateGraphConfig } from "./graph-builder.types"
import { compileTemplateGraph } from "./graph-compile"
import { templateGraphProblems } from "./graph-problems"
import type { TemplateProblem } from "./template-problems"
import { exampleTriggerLookup, listOrders, openToolLookup, remindNote, remindSend } from "./template.fixture"

// R68: a step declares its UNSUCCESSFUL ending (a customer send refused other than `route_held`, an approval declined, the node's
// `cannot`) and the ENGINE tells the team and follows the step's one policy word; an `until` loop declares the notice of running out of
// rounds. This spec proves the SDK half: the builder option, the stored form with its default policy, the schemas, the save checks.

const codesOf = (problems: ReadonlyArray<TemplateProblem>): ReadonlyArray<string> => problems.map((one) => `${one.code}@${one.at}`)

const context = { tools: openToolLookup, triggers: exampleTriggerLookup, nullability: "strict" as const }

/** Every problem of a graph: the compile's own (the builder, the contract) and the save's, with the engine's lookups. */
const problemsOf = (config: TemplateGraphConfig): ReadonlyArray<string> => {
    const compiled = compileTemplateGraph(config, { nullability: "strict" })
    const saved = codesOf(templateGraphProblems(compiled.graph.spec, { ...context, nodes: compiled.graph.nodes }))
    return [...new Set([...codesOf(compiled.problems), ...saved])]
}

const stepOf = (spec: GraphSpecV2, key: string): GraphV2Step | undefined => spec.nodes.find((step) => step.key === key)

/** The order the notice names, read from the step before. */
const DECLINED = { declined: outcome({ name: "declined" }) }

const ORDER: NoticeFact = { label: { vi: "Mã đơn", en: "Order" }, value: ref("steps.list.output.orders") }

/** A graph: list the orders, send the reminder (the step under test), note it, end `done`; `extra` adds steps (the `declined` outcome). */
const sendConfig = (send: GraphStep, extra: Readonly<Record<string, GraphStep>> = {}): TemplateGraphConfig => ({
    key: "test.unsuccessful",
    title: { key: "g" },
    input: z.object({ code: z.string().max(200) }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    start: "list",
    nodes: {
        list: node(listOrders, { next: "send" }),
        send,
        note: node(remindNote, { input: { orderId: "o1" }, next: "done" }),
        done: outcome({ name: "done" }),
        ...extra,
    },
})

/** A graph whose `until` loop sends a reminder each round and runs out after 3 rounds. */
const loopConfig = (send: GraphStep, unsuccessful?: { readonly facts: ReadonlyArray<NoticeFact> }): TemplateGraphConfig => ({
    key: "test.unsuccessful-loop",
    title: { key: "g" },
    input: z.object({ code: z.string().max(200) }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    start: "list",
    nodes: {
        list: node(listOrders, { next: "pay" }),
        pay: loop({
            until: equals(ref("steps.send.output.messageId", { default: null }), "never"),
            max: 3,
            body: { start: "send", nodes: { send } },
            next: "done",
            exhausted: "unpaid",
            ...(unsuccessful === undefined ? {} : { unsuccessful }),
        }),
        done: outcome({ name: "done" }),
        unpaid: outcome({ name: "unpaid" }),
    },
})

describe("unsuccessful: the stored form and its default policy", () => {
    it("a main step that declares nothing but facts ends the run: `then: end` is written with its outcome and facts", () => {
        const compiled = compileTemplateGraph(
            sendConfig(node(remindSend, { input: { orderId: "o1" }, next: "note", unsuccessful: { outcome: "declined", facts: [ORDER] } }), DECLINED),
        )
        expect(stepOf(compiled.graph.spec, "send")).toMatchObject({
            unsuccessful: {
                then: "end",
                outcome: "declined",
                facts: [{ label: { vi: "Mã đơn", en: "Order" }, value: { $ref: "steps.list.output.orders", default: null } }],
            },
        })
        expect(
            problemsOf(sendConfig(node(remindSend, { input: { orderId: "o1" }, next: "note", unsuccessful: { outcome: "declined", facts: [ORDER] } }), DECLINED)),
        ).toEqual([])
    })

    it("a step inside a loop body goes on by default (`then: continue`, no outcome)", () => {
        const compiled = compileTemplateGraph(
            loopConfig(node(remindSend, { input: { orderId: "o1" }, next: endRound, unsuccessful: { facts: [ORDER] } })),
        )
        expect(stepOf(compiled.graph.spec, "send")).toMatchObject({ loop: "pay", unsuccessful: { then: "continue", facts: [{ label: ORDER.label }] } })
        expect(problemsOf(loopConfig(node(remindSend, { input: { orderId: "o1" }, next: endRound, unsuccessful: { facts: [ORDER] } })))).toEqual([])
    })

    it("a step that declares nothing carries no member: the engine's road for it is today's", () => {
        const compiled = compileTemplateGraph(sendConfig(node(remindSend, { input: { orderId: "o1" }, next: "note" })))
        expect(stepOf(compiled.graph.spec, "send")).not.toHaveProperty("unsuccessful")
    })

    it("an `until` loop's notice is stored as its facts; the run then takes `exhausted` as drawn", () => {
        const compiled = compileTemplateGraph(
            loopConfig(node(remindSend, { input: { orderId: "o1" }, next: endRound, unsuccessful: { then: "continue" } }), { facts: [ORDER] }),
        )
        expect(stepOf(compiled.graph.spec, "pay")).toMatchObject({
            routes: { body: "send", exhausted: "unpaid" },
            unsuccessful: { facts: [{ value: { $ref: "steps.list.output.orders", default: null } }] },
        })
    })

    it("both read schemas and the @1 schema take the member; a written document round-trips", () => {
        const compiled = compileTemplateGraph(
            loopConfig(node(remindSend, { input: { orderId: "o1" }, next: endRound, unsuccessful: { facts: [ORDER] } }), { facts: [ORDER] }),
        )
        expect(graphSpecV2WrittenSchema.parse(compiled.graph.spec)).toEqual(compiled.graph.spec)
        expect(graphSpecV2Schema.parse(compiled.graph.spec)).toEqual(compiled.graph.spec)
        const onOne = {
            schema: "nivo/agent-graph@1",
            moduleKey: "test",
            trigger: { kind: "tag", sources: ["agent"] },
            grant: { tools: [], effects: [] },
            nodes: [
                { key: "send", kind: "execute", step: "test.remind-send", next: "declined", unsuccessful: { then: "end", outcome: "declined", facts: [{ label: { vi: "a", en: "a" }, value: { $ref: "trigger.code", default: null } }] } },
                { key: "pay", kind: "execute", step: "core.until", unsuccessful: { facts: [] } },
            ],
        }
        expect(graphSpecSchema.safeParse(onOne).success).toBe(true)
        expect(graphSpecSchema.safeParse({ ...onOne, nodes: [{ ...onOne.nodes[0], unsuccessful: { then: "stop", facts: [] } }] }).success).toBe(false)
    })
})

describe("unsuccessful: the save checks", () => {
    const send = (unsuccessful: object, next = "note"): GraphStep => node(remindSend, { input: { orderId: "o1" }, next, unsuccessful })

    it.each([
        ["a main step ends the run by default but names no outcome", send({ facts: [ORDER] }), ["GRAPH_UNSUCCESSFUL_OUTCOME_MISSING@nodes.send.unsuccessful.outcome"]],
        ["`end` written with no outcome", send({ then: "end" }), ["GRAPH_UNSUCCESSFUL_OUTCOME_MISSING@nodes.send.unsuccessful.outcome"]],
        ["an outcome that is no step", send({ outcome: "nowhere" }), ["GRAPH_UNSUCCESSFUL_OUTCOME_UNKNOWN@nodes.send.unsuccessful.outcome"]],
        ["an outcome that is a node step, not an outcome", send({ outcome: "note" }), ["GRAPH_UNSUCCESSFUL_OUTCOME_UNKNOWN@nodes.send.unsuccessful.outcome"]],
        ["an outcome beside `continue`", send({ then: "continue", outcome: "done" }), ["GRAPH_UNSUCCESSFUL_OUTCOME_UNUSED@nodes.send.unsuccessful.outcome"]],
        ["seven notice facts", send({ then: "continue", facts: Array.from({ length: 7 }, () => ORDER) }), ["GRAPH_UNSUCCESSFUL_FACTS_TOO_MANY@nodes.send.unsuccessful.facts"]],
        [
            "a fact that reads the step's own output (it may have none: a `cannot`)",
            send({ then: "continue", facts: [{ label: { vi: "x", en: "x" }, value: ref("steps.send.output.messageId") }] }),
            ["GRAPH_REF_NOT_UPSTREAM@nodes.send.unsuccessful.facts.0<-steps.send.output.messageId"],
        ],
        [
            "a fact that reads a member its source does not declare",
            send({ then: "continue", facts: [{ label: { vi: "x", en: "x" }, value: ref("steps.list.output.missing") }] }),
            ["GRAPH_REF_TYPE@nodes.send.unsuccessful.facts.0<-steps.list.output.missing"],
        ],
    ])("%s", (_name, step, expected) => {
        expect(problemsOf(sendConfig(step))).toEqual(expected)
    })

    it("an outcome reached ONLY by an unsuccessful ending is no unreachable step", () => {
        expect(problemsOf(sendConfig(send({ outcome: "declined" }), DECLINED))).toEqual([])
    })

    it("`end` in the body of an `over` loop whose items run at once is refused; in a sequential body it stands", () => {
        const overConfig = (concurrency: 1 | 3): TemplateGraphConfig => ({
            ...sendConfig(send({}), {}),
            nodes: {
                list: node(listOrders, { next: "each" }),
                each: loop({
                    over: ref("steps.list.output.orders"),
                    key: "orderId",
                    concurrency,
                    body: { start: "send", nodes: { send: node(remindSend, { input: { orderId: "o1" }, unsuccessful: { then: "end", outcome: "declined" } }) } },
                    next: "done",
                }),
                done: outcome({ name: "done" }),
                declined: outcome({ name: "declined" }),
            },
        })
        expect(problemsOf(overConfig(3))).toEqual(["GRAPH_UNSUCCESSFUL_END_IN_FANOUT@nodes.send.unsuccessful.then"])
        expect(problemsOf(overConfig(1))).toEqual([])
    })

    it("an `until` loop with more than six notice facts is refused", () => {
        const many = { facts: Array.from({ length: 7 }, () => ORDER) }
        expect(problemsOf(loopConfig(node(remindSend, { input: { orderId: "o1" }, next: endRound }), many))).toEqual([
            "GRAPH_UNSUCCESSFUL_FACTS_TOO_MANY@nodes.pay.unsuccessful.facts",
        ])
    })

    it("a hand-made notice still drawn after an engine-reported step is no problem (the conversion removes it)", () => {
        const config = sendConfig(send({ then: "continue", facts: [ORDER] }), {})
        const withNotice: TemplateGraphConfig = {
            ...config,
            nodes: { ...config.nodes, send: send({ then: "continue", facts: [ORDER] }, "notice"), notice: node(remindNote, { input: { orderId: "o1", why: "refused" }, next: "note" }) },
        }
        expect(problemsOf(withNotice)).toEqual([])
    })
})

// G-SLIM (R68): a step whose declined approval ENDS the run never goes on in its declined form, so the steps after it read the recorded
// form: the decline needs no `if` any more for the save check to type the refs past it (the graph drops its "was it declined" pair).
describe("unsuccessful: the declined form never passes an `end` step", () => {
    const recordOrder = defineTemplateNode({
        id: "test.order-record",
        title: { key: "t" },
        description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
        tools: [TOOL.orderOpenList],
        mode: "ask",
        accounts: [],
        input: z.object({}),
        output: z.discriminatedUnion("declined", [
            z.object({ declined: z.literal(false), orderId: z.string().max(200) }),
            z.object({ declined: z.literal(true), orderId: z.null() }),
        ]),
        run: async (_input, ctx) => {
            const answer = await ctx.tools.call(TOOL.orderOpenList, {})
            if (!answer.ok && answer.declined === true) return { declined: true as const, orderId: null }
            return { declined: false as const, orderId: "o1" }
        },
        examples: [
            { name: "records", params: {}, input: {}, tools: [{ id: TOOL.orderOpenList, args: {}, answer: toolOk({}) }], output: { declined: false, orderId: "o1" } },
            { name: "declined", params: {}, input: {}, tools: [{ id: TOOL.orderOpenList, args: {}, answer: toolDeclined() }], output: { declined: true, orderId: null } },
        ],
    })
    const recordConfig = (unsuccessful: object | undefined): TemplateGraphConfig => ({
        key: "test.unsuccessful-narrow",
        title: { key: "g" },
        input: z.object({ code: z.string().max(200) }),
        triggers: [trigger(TRIGGER.workflowCalled)],
        start: "record",
        nodes: {
            record: node(recordOrder, { next: "send", ...(unsuccessful === undefined ? {} : { unsuccessful }) }),
            send: node(remindSend, { input: { orderId: ref("steps.record.output.orderId") }, next: "done" }),
            done: outcome({ name: "done" }),
            ...DECLINED,
        },
    })

    it("past a step that ends `declined`, its output reads as the recorded form: a text where the declined form has null", () => {
        expect(problemsOf(recordConfig({ outcome: "declined" }))).toEqual([])
    })

    it("past a step that goes on (`continue`) or declares nothing, the declined form still reaches the next step: the ref is refused", () => {
        expect(problemsOf(recordConfig({ then: "continue" }))).toContain("GRAPH_REF_TYPE@nodes.send.params.orderId<-steps.record.output.orderId")
        expect(problemsOf(recordConfig(undefined))).toContain("GRAPH_REF_TYPE@nodes.send.params.orderId<-steps.record.output.orderId")
    })
})
