import { z } from "zod"
import { LOOP_ITEM_SELF_KEY } from "../../graph/graph-spec-v2"
import { graphSpecV2Schema, graphSpecV2WrittenSchema } from "../../graph/graph-spec-v2.schema"
import type { GraphSpecV2, GraphV2Step } from "../../graph/graph-spec-v2.types"
import { TRIGGER } from "../../names"
import { DomainError } from "@starci/common"

/** A spec's own refusal: a document the case reads has no nodes. */
class SpecDocumentError extends DomainError<"SPEC_DOCUMENT_UNREADABLE"> {
    constructor(at: string) {
        super({ code: "SPEC_DOCUMENT_UNREADABLE", params: { at } })
    }
}
import type { JsonValue } from "../../schema/schema.types"
import {
    endItem,
    endRound,
    ifNode,
    item,
    loop,
    node,
    outcome,
    present,
    ref,
    round,
    trigger,
} from "./graph-builder"
import type { GraphStep, TemplateGraphConfig, UntilCondition } from "./graph-builder.types"
import { compileTemplateGraph, defineTemplateGraph, templateGraphText } from "./graph-compile"
import { templateGraphProblems } from "./graph-problems"
import { defineTemplateNode } from "./template-node"
import { TemplateDefinitionError } from "./template-problems"
import type { TemplateProblem } from "./template-problems"
import { listOrders, parseJson, remindCheck, remindNote, remindRecord, remindSend, roundConfig } from "./template.fixture"

/** An item with an id, as a function-typed item key (a type refusal below) would read it. */
interface IdEntry {
    readonly id: string
}

const codesOf = (problems: ReadonlyArray<TemplateProblem>): ReadonlyArray<string> =>
    problems.map((problem) => `${problem.code}@${problem.at}`)

const stepOf = (spec: GraphSpecV2, key: string): GraphV2Step | undefined => spec.nodes.find((step) => step.key === key)

/** A node that takes a round number. */
const roundNote = defineTemplateNode({
    id: "test.round-note",
    title: { key: "t" },
    description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
    tools: [],
    mode: "auto",
    accounts: [],
    input: z.object({ round: z.number().int() }),
    output: z.object({ noted: z.boolean() }),
    model: "claude-sonnet-5-5",
    run: () => Promise.resolve({ noted: true }),
    examples: [{ name: "notes", params: {}, input: { round: 1 }, output: { noted: true } }],
})

/** A graph around an `until` loop that stops by MEANING: the check routes `later` (paid), else it reminds again. */
const chaseConfig = (body: Readonly<Record<string, GraphStep>> | null = null): TemplateGraphConfig => ({
    key: "test.chase",
    title: { key: "g" },
    input: z.object({ orderId: z.string().max(200) }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    start: "chase",
    nodes: {
        chase: loop({
            until: { route: "check", stop: "later" },
            max: 3,
            every: { hours: 1 },
            body: {
                start: "check",
                nodes: body ?? {
                    check: node(remindCheck, {
                        input: { orderId: ref("trigger.orderId") },
                        routes: { due: "send", later: endRound },
                    }),
                    send: node(remindSend, { input: { orderId: ref("trigger.orderId") } }),
                },
            },
            next: "done",
            exhausted: "tell",
        }),
        tell: node(remindNote, { input: { orderId: ref("trigger.orderId"), why: "no answer" }, next: "gave-up" }),
        done: outcome({ name: "paid", output: { rounds: ref("steps.chase.output.rounds") } }),
        "gave-up": outcome({ name: "gave-up" }),
    },
})

/** A graph around an `until` loop that stops by DATA: until the send answers a message id; `last` is the send's output. */
const waitConfig: TemplateGraphConfig = {
    key: "test.wait",
    title: { key: "g" },
    input: z.object({ orderId: z.string().max(200) }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    start: "wait",
    nodes: {
        wait: loop({
            until: present(ref("steps.send.output.messageId")),
            max: 10,
            body: { start: "send", nodes: { send: node(remindSend, { input: { orderId: ref("trigger.orderId") } }) } },
            next: "record",
            exhausted: "gave-up",
        }),
        record: node(remindRecord, {
            input: { orderId: ref("trigger.orderId"), messageId: ref("steps.wait.output.last.messageId", { default: "" }) },
            next: "done",
        }),
        done: outcome({ name: "sent", output: { stopped: ref("steps.wait.output.stopped") } }),
        "gave-up": outcome({ name: "gave-up" }),
    },
}

/** A graph around an `over` loop with the given loop step. */
const overConfig = (each: GraphStep, after: Readonly<Record<string, GraphStep>> = {}): TemplateGraphConfig => ({
    key: "test.over",
    title: { key: "g" },
    input: z.object({ preset: z.string().max(200) }),
    triggers: [trigger(TRIGGER.clockTick, { args: { preset: "daily" } })],
    start: "list",
    nodes: { list: node(listOrders, { next: "each" }), each, ...after },
})

describe("loop until: both ways of stopping compile, typed, and round-trip", () => {
    it("by meaning: the route stop, the checkpoint wait, the two ends", () => {
        const compiled = compileTemplateGraph(chaseConfig())
        expect(codesOf(compiled.problems)).toEqual([])
        const spec = compiled.graph.spec
        expect(spec.nodes.map((step) => [step.key, step.kind, step.loop ?? null])).toEqual([
            ["chase", "loop", null],
            ["check", "node", "chase"],
            ["send", "node", "chase"],
            ["tell", "node", null],
            ["done", "outcome", null],
            ["gave-up", "outcome", null],
        ])
        expect(stepOf(spec, "chase")).toEqual({
            kind: "loop",
            key: "chase",
            step: "core.loop",
            params: { mode: "until", until: { route: "check", stop: "later" }, max: 3, every: { hours: 1 } },
            routes: { body: "check", exhausted: "tell" },
            next: "done",
        })
        // `endRound` is the route left out: the end of the round starts the check.
        expect(stepOf(spec, "check")).toMatchObject({ routeBy: "verdict", routes: { due: "send" } })
        expect(stepOf(spec, "send")).not.toHaveProperty("next")
        expect(spec.outcomes).toContainEqual({ key: "paid", label: "paid", outputs: [{ name: "rounds", type: "integer" }] })
    })

    it("by data: an expression over a body step, `last` typed from the round's one end", () => {
        const compiled = compileTemplateGraph(waitConfig)
        expect(codesOf(compiled.problems)).toEqual([])
        expect(stepOf(compiled.graph.spec, "wait")).toEqual({
            kind: "loop",
            key: "wait",
            step: "core.loop",
            params: {
                mode: "until",
                until: { op: "present", ref: { $ref: "steps.send.output.messageId", default: null } },
                max: 10,
            },
            routes: { body: "send", exhausted: "gave-up" },
            next: "record",
        })
        expect(compiled.graph.spec.outcomes).toContainEqual({
            key: "sent",
            label: "sent",
            outputs: [{ name: "stopped", type: "boolean" }],
        })
    })

    it.each<readonly [string, TemplateGraphConfig]>([
        ["until by meaning", chaseConfig()],
        ["until by data", waitConfig],
        ["over", roundConfig],
    ])("%s round-trips through JSON and both schemas, and holds at save", (_label, config) => {
        const compiled = compileTemplateGraph(config)
        const parsed = graphSpecV2Schema.parse(parseJson(JSON.stringify(compiled.graph.spec)))
        expect(parsed).toEqual(compiled.graph.spec)
        expect(templateGraphText(parsed)).toBe(templateGraphText(compiled.graph.spec))
        expect(graphSpecV2WrittenSchema.parse(parsed)).toEqual(parsed)
        expect(templateGraphProblems(parsed, { nodes: compiled.graph.nodes, nullability: "strict" })).toEqual([])
    })

    it("defineTemplateGraph takes both (strict nullability)", () => {
        expect(defineTemplateGraph(chaseConfig()).key).toBe("test.chase")
        expect(defineTemplateGraph(waitConfig).key).toBe("test.wait")
    })
})

describe("refs and an until loop", () => {
    const withAfter = (record: GraphStep): TemplateGraphConfig => ({
        ...waitConfig,
        nodes: { ...waitConfig.nodes, record },
    })
    const body = (nodes: Readonly<Record<string, GraphStep>>, start: string): TemplateGraphConfig => ({
        ...chaseConfig(nodes),
        nodes: {
            ...chaseConfig(nodes).nodes,
            chase: loop({ until: { route: "check", stop: "later" }, max: 3, body: { start, nodes }, next: "done", exhausted: "tell" }),
        },
    })
    const check = node(remindCheck, { input: { orderId: ref("trigger.orderId") }, routes: { due: "n", later: endRound } })

    it.each<readonly [string, TemplateGraphConfig, ReadonlyArray<string>]>([
        [
            "round() in an until body is a whole number",
            body({ check, n: node(roundNote, { input: { round: round() } }) }, "check"),
            [],
        ],
        [
            "item.* in an until body: rounds have no item",
            body({ check, n: node(remindNote, { input: { orderId: item("orderId") } }) }, "check"),
            ["GRAPH_REF_TYPE@nodes.n.params.orderId<-item.orderId"],
        ],
        [
            "the loop's own output from inside its body",
            body({ check, n: node(roundNote, { input: { round: ref("steps.chase.output.rounds") } }) }, "check"),
            ["GRAPH_REF_NOT_UPSTREAM@nodes.n.params.round<-steps.chase.output.rounds"],
        ],
        [
            "a body step from after the loop",
            withAfter(node(remindRecord, { input: { orderId: ref("trigger.orderId"), messageId: ref("steps.send.output.messageId", { default: "" }) }, next: "done" })),
            ["GRAPH_REF_NOT_UPSTREAM@nodes.record.params.messageId<-steps.send.output.messageId"],
        ],
        [
            "a member the until output lacks",
            withAfter(node(remindRecord, { input: { orderId: ref("trigger.orderId"), messageId: ref("steps.wait.output.lastOne", { default: "" }) }, next: "done" })),
            ["GRAPH_REF_TYPE@nodes.record.params.messageId<-steps.wait.output.lastOne"],
        ],
        [
            "rounds is a number, never a text",
            withAfter(node(remindRecord, { input: { orderId: ref("trigger.orderId"), messageId: ref("steps.wait.output.rounds") }, next: "done" })),
            ["GRAPH_REF_TYPE@nodes.record.params.messageId<-steps.wait.output.rounds"],
        ],
        [
            "last may be null: strict nullability wants a default",
            withAfter(node(remindRecord, { input: { orderId: ref("trigger.orderId"), messageId: ref("steps.wait.output.last.messageId") }, next: "done" })),
            ["GRAPH_REF_TYPE@nodes.record.params.messageId<-steps.wait.output.last.messageId"],
        ],
    ])("%s", (_label, config, codes) => {
        expect(codesOf(compileTemplateGraph(config, { nullability: "strict" }).problems)).toEqual(codes)
    })

    it("round() in an over body is refused", () => {
        const config = overConfig(
            loop({ over: ref("steps.list.output.orders"), body: { start: "n", nodes: { n: node(roundNote, { input: { round: round() } }) } } }),
        )
        expect(codesOf(compileTemplateGraph(config).problems)).toEqual(["GRAPH_REF_TYPE@nodes.n.params.round<-item.$round"])
    })
})

describe("loop over: a list, concurrent", () => {
    const body = {
        start: "note",
        nodes: { note: node(remindNote, { input: { orderId: item("orderId") } }) },
    }

    it("writes the defaults: max 50, concurrency 5, no collect: each item's output is null", () => {
        const compiled = compileTemplateGraph(
            overConfig(loop({ over: ref("steps.list.output.orders"), body }, ), {}),
        )
        expect(codesOf(compiled.problems)).toEqual([])
        expect(stepOf(compiled.graph.spec, "each")).toEqual({
            kind: "loop",
            key: "each",
            step: "core.loop",
            params: { mode: "over", items: { $ref: "steps.list.output.orders" }, max: 50, concurrency: 5 },
            routes: { body: "note" },
        })
    })

    it("writes a field path key, a lower concurrency, a cap and collect", () => {
        const compiled = compileTemplateGraph(
            overConfig(
                loop({
                    over: ref("steps.list.output.orders"),
                    key: "order.id",
                    concurrency: 2,
                    max: 7,
                    body: { ...body, collect: "note" },
                }),
            ),
        )
        expect(codesOf(compiled.problems)).toEqual([])
        expect(stepOf(compiled.graph.spec, "each")).toMatchObject({
            params: { mode: "over", itemKey: "order.id", concurrency: 2, max: 7, collect: "note" },
        })
    })

    it("reads an old for-each document as loop / over, sequential (concurrency 1), as it ran", () => {
        const spec = compileTemplateGraph(roundConfig).graph.spec
        const old: unknown = {
            ...spec,
            nodes: spec.nodes.map((step): unknown =>
                step.key === "each"
                    ? {
                          kind: "for-each",
                          key: "each",
                          step: "core.for-each",
                          params: { items: { $ref: "steps.list.output.orders" }, max: 50, collect: "record", itemKey: "orderId" },
                          routes: { body: "check" },
                          next: "report",
                      }
                    : step,
            ),
        }
        const read = graphSpecV2Schema.parse(old)
        expect(stepOf(read, "each")).toEqual({
            kind: "loop",
            key: "each",
            step: "core.loop",
            params: {
                mode: "over",
                items: { $ref: "steps.list.output.orders" },
                max: 50,
                collect: "record",
                itemKey: "orderId",
                concurrency: 1,
            },
            routes: { body: "check" },
            next: "report",
        })
        expect(read.nodes.filter((step) => step.key !== "each")).toEqual(spec.nodes.filter((step) => step.key !== "each"))
        expect(graphSpecV2WrittenSchema.safeParse(old).success).toBe(false)
    })
})

describe('loop over plain values: key "." is the item itself', () => {
    /** A node answering a list of the given item schema (or an untyped list), for the save to judge `"."` against. */
    const listOf = (name: string, items: z.ZodType | null) =>
        defineTemplateNode({
            id: `test.list-${name}`,
            title: { key: "t" },
            description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
            tools: [],
            mode: "auto",
            accounts: [],
            input: z.object({}),
            output: z.object({ codes: items === null ? z.unknown() : z.array(items).max(50) }),
            model: "claude-sonnet-5-5",
            run: () => Promise.resolve({ codes: [] }),
            examples: [{ name: "lists", params: {}, input: {}, output: { codes: [] } }],
        })
    /** A node that takes one value of any kind, the item itself. */
    const takeValue = defineTemplateNode({
        id: "test.take-value",
        title: { key: "t" },
        description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
        tools: [],
        mode: "auto",
        accounts: [],
        input: z.object({ value: z.unknown() }),
        output: z.object({ taken: z.boolean() }),
        model: "claude-sonnet-5-5",
        run: () => Promise.resolve({ taken: true }),
        examples: [{ name: "takes", params: {}, input: { value: "x" }, output: { taken: true } }],
    })
    const selfConfig = (list: ReturnType<typeof listOf>, key: string = LOOP_ITEM_SELF_KEY): TemplateGraphConfig => ({
        key: "test.self",
        title: { key: "g" },
        input: z.object({ preset: z.string().max(200) }),
        triggers: [trigger(TRIGGER.clockTick, { args: { preset: "daily" } })],
        start: "list",
        nodes: {
            list: node(list, { next: "each" }),
            each: loop({
                over: ref("steps.list.output.codes"),
                key,
                concurrency: 1,
                body: { start: "take", nodes: { take: node(takeValue, { input: { value: item() } }) }, collect: "take" },
            }),
        },
    })

    it.each<readonly [string, z.ZodType]>([
        ["strings", z.string().max(200)],
        ["numbers", z.number()],
        ["whole numbers", z.number().int()],
        ["a string enum", z.enum(["web", "seo"])],
        ["strings or numbers", z.union([z.string().max(200), z.number()])],
    ])("compiles over %s and stores itemKey \".\", which round-trips", (name, items) => {
        const compiled = compileTemplateGraph(selfConfig(listOf(name.replace(/\W+/gu, "-"), items)), { nullability: "strict" })
        expect(codesOf(compiled.problems)).toEqual([])
        expect(stepOf(compiled.graph.spec, "each")).toMatchObject({ params: { mode: "over", itemKey: "." } })
        const text = templateGraphText(compiled.graph.spec)
        const read = graphSpecV2WrittenSchema.parse(parseJson(text))
        expect(stepOf(read, "each")).toMatchObject({ params: { itemKey: "." } })
        expect(templateGraphText(read)).toBe(text)
    })

    it("leaves an untyped list to the run (the engine stops an item with no identity)", () => {
        expect(codesOf(compileTemplateGraph(selfConfig(listOf("untyped", null))).problems)).toEqual([])
        expect(codesOf(compileTemplateGraph(selfConfig(listOf("unknown", z.unknown()))).problems)).toEqual([])
    })

    it.each<readonly [string, z.ZodType]>([
        ["objects", z.object({ code: z.string().max(200) })],
        ["lists", z.array(z.string().max(200)).max(50)],
        ["booleans", z.boolean()],
        ["nulls", z.null()],
        ["strings or null", z.string().max(200).nullable()],
        ["strings or objects", z.union([z.string().max(200), z.object({ code: z.string().max(200) })])],
    ])("refuses \".\" over %s: LOOP_KEY_NOT_SCALAR", (name, items) => {
        expect(codesOf(compileTemplateGraph(selfConfig(listOf(name.replace(/\W+/gu, "-"), items))).problems)).toEqual([
            "LOOP_KEY_NOT_SCALAR@nodes.each.params.itemKey",
        ])
    })

    it.each(["..", "./id", ".id", "id.", " ."])("refuses %j as a key: only \".\" itself or a dotted field path", (key) => {
        expect(codesOf(compileTemplateGraph(selfConfig(listOf("texts", z.string().max(200)), key)).problems)).toEqual([
            "LOOP_KEY_INVALID@nodes.each.params.itemKey",
        ])
    })

    it("defineTemplateGraph throws on a \".\" over objects, naming the problem", () => {
        expect(() => defineTemplateGraph(selfConfig(listOf("objects", z.object({ code: z.string().max(200) }))))).toThrow(TemplateDefinitionError)
    })
})

describe("illegal loops do not compile", () => {
    it("refuses every wrong combination at compile time", () => {
        const list = ref("steps.list.output.orders")
        const stop = present(ref("trigger.text"))
        const body = { start: "a", nodes: {} }
        const ok = [
            loop({ over: list, body }),
            loop({ until: stop, body, max: 3, next: "a", exhausted: "b" }),
            loop({ until: { route: "a", stop: "later" }, body, max: 10, every: { days: 1 }, next: "a", exhausted: "b" }),
        ]
        // @ts-expect-error a config holding both `over` and `until`
        const both = loop({ over: list, until: stop, body, max: 3, next: "a", exhausted: "b" })
        // @ts-expect-error `until` without `max`
        const noMax = loop({ until: stop, body, next: "a", exhausted: "b" })
        // @ts-expect-error `until` without `exhausted`
        const noExhausted = loop({ until: stop, body, max: 3, next: "a" })
        // @ts-expect-error `until` without `next`
        const noNext = loop({ until: stop, body, max: 3, exhausted: "b" })
        // @ts-expect-error `until` past 30 rounds (R9: 30 is the most, for a body that parks at a wait)
        const tooMany = loop({ until: stop, body, max: 31, next: "a", exhausted: "b" })
        // @ts-expect-error `until` takes no `key`
        const untilKey = loop({ until: stop, key: "id", body, max: 3, next: "a", exhausted: "b" })
        // @ts-expect-error `until` takes no `concurrency`
        const untilConcurrency = loop({ until: stop, concurrency: 2, body, max: 3, next: "a", exhausted: "b" })
        // @ts-expect-error an `until` body has no `collect`
        const untilCollect = loop({ until: stop, body: { ...body, collect: "a" }, max: 3, next: "a", exhausted: "b" })
        // @ts-expect-error `over` with `exhausted`
        const overExhausted = loop({ over: list, body, exhausted: "b" })
        // @ts-expect-error `over` with `every`
        const overEvery = loop({ over: list, body, every: { hours: 1 } })
        // @ts-expect-error `over` past 5 at once
        const tooWide = loop({ over: list, body, concurrency: 6 })
        // @ts-expect-error a checkpoint wait of two units
        const twoUnits = loop({ until: stop, body, max: 3, every: { hours: 1, minutes: 30 }, next: "a", exhausted: "b" })
        // @ts-expect-error a checkpoint wait as text: the grammar is data
        const everyText = loop({ until: stop, body, max: 3, every: "15m", next: "a", exhausted: "b" })
        // @ts-expect-error an item key is a field path, never a function
        const keyFunction = loop({ over: list, key: (entry: IdEntry) => entry.id, body })
        // @ts-expect-error an until is data, never a function
        const untilFunction = loop({ until: () => true, body, max: 3, next: "a", exhausted: "b" })
        // @ts-expect-error a route stop and an expression in one object
        const routeAndExpr = loop({ until: { route: "a", stop: "b", op: "present" }, body, max: 3, next: "a", exhausted: "b" })
        expect([
            ...ok,
            both,
            noMax,
            noExhausted,
            noNext,
            tooMany,
            untilKey,
            untilConcurrency,
            untilCollect,
            overExhausted,
            overEvery,
            tooWide,
            twoUnits,
            everyText,
            keyFunction,
            untilFunction,
            routeAndExpr,
        ]).toHaveLength(19)
    })

    it("refuses an until given from untyped code without its ends", () => {
        const untyped: unknown = { until: present(ref("trigger.orderId")), body: { start: "check", nodes: {} }, max: 3 }
        const built = loop(untyped as Parameters<typeof loop>[0])
        const config: TemplateGraphConfig = { ...chaseConfig(), nodes: { ...chaseConfig().nodes, chase: built } }
        expect(codesOf(compileTemplateGraph(config).problems)).toEqual(
            expect.arrayContaining(["LOOP_EXHAUSTED_MISSING@nodes.chase.exhausted", "LOOP_NEXT_MISSING@nodes.chase.next"]),
        )
    })
})

/** The compiled chase document with its loop step rewritten, as raw JSON. */
const chaseWith = (rewrite: (loopStep: Readonly<Record<string, unknown>>) => unknown, steps?: (nodes: ReadonlyArray<unknown>) => ReadonlyArray<unknown>): unknown => {
    const spec: unknown = parseJson(JSON.stringify(compileTemplateGraph(chaseConfig()).graph.spec))
    if (typeof spec !== "object" || spec === null || !("nodes" in spec) || !Array.isArray(spec.nodes)) throw new SpecDocumentError("no nodes")
    const list: ReadonlyArray<unknown> = spec.nodes
    const nodes = list.map((step) =>
        typeof step === "object" && step !== null && "key" in step && step.key === "chase" ? rewrite({ ...step }) : step,
    )
    return { ...spec, nodes: steps === undefined ? nodes : steps(nodes) }
}

/** The compiled over document (`overConfig` with a body of one note and collect) with its loop step rewritten, as raw JSON. */
const overWith = (rewrite: (loopStep: Readonly<Record<string, unknown>>) => unknown): unknown => {
    const compiled = compileTemplateGraph(
        overConfig(
            loop({
                over: ref("steps.list.output.orders"),
                body: { start: "note", collect: "note", nodes: { note: node(remindNote, { input: { orderId: item("orderId") } }) } },
            }),
        ),
    )
    const spec: unknown = parseJson(JSON.stringify(compiled.graph.spec))
    if (typeof spec !== "object" || spec === null || !("nodes" in spec) || !Array.isArray(spec.nodes)) throw new SpecDocumentError("no nodes")
    const list: ReadonlyArray<unknown> = spec.nodes
    return {
        ...spec,
        nodes: list.map((step) =>
            typeof step === "object" && step !== null && "key" in step && step.key === "each" ? rewrite({ ...step }) : step,
        ),
    }
}

const paramsOf = (step: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> => {
    const params: unknown = step["params"]
    return typeof params === "object" && params !== null ? { ...params } : {}
}

describe("the runtime validator on raw JSON: the schema refuses the wrong shapes", () => {
    it.each<readonly [string, unknown]>([
        ["until without exhausted", chaseWith((step) => ({ ...step, routes: { body: "check" } }))],
        ["until without next", chaseWith(({ next: _next, ...step }) => step)],
        ["until with concurrency", chaseWith((step) => ({ ...step, params: { ...paramsOf(step), concurrency: 2 } }))],
        ["until with items", chaseWith((step) => ({ ...step, params: { ...paramsOf(step), items: { $ref: "trigger.orderId" } } }))],
        ["until without max", chaseWith((step) => ({ ...step, params: { mode: "until", until: { route: "check", stop: "later" } } }))],
        ["until with an every as text", chaseWith((step) => ({ ...step, params: { ...paramsOf(step), every: "15m" } }))],
        ["until with an every of two units", chaseWith((step) => ({ ...step, params: { ...paramsOf(step), every: { hours: 1, days: 1 } } }))],
        ["a mode that is neither", chaseWith((step) => ({ ...step, params: { ...paramsOf(step), mode: "while" } }))],
        ["over with exhausted", overWith((step) => ({ ...step, routes: { body: "note", exhausted: "note" } }))],
        ["over with every", overWith((step) => ({ ...step, params: { ...paramsOf(step), every: { hours: 1 } } }))],
        ["over with until", overWith((step) => ({ ...step, params: { ...paramsOf(step), until: { route: "note", stop: "x" } } }))],
        ["over without concurrency", overWith((step) => ({ ...step, params: { ...paramsOf(step), concurrency: undefined } }))],
        ["a cap that is no whole number", overWith((step) => ({ ...step, params: { ...paramsOf(step), max: 2.5 } }))],
    ])("%s", (_label, raw) => {
        expect(graphSpecV2Schema.safeParse(raw).success).toBe(false)
    })
})

describe("the runtime validator on raw JSON: the save judges the rest", () => {
    const nodes = compileTemplateGraph(chaseConfig()).graph.nodes
    const overNodes = new Map([...compileTemplateGraph(roundConfig).graph.nodes, [remindNote.id, remindNote]])
    const judge = (raw: unknown, index = nodes): ReadonlyArray<string> =>
        codesOf(templateGraphProblems(graphSpecV2Schema.parse(raw), { nodes: index, nullability: "strict" }))

    it.each<readonly [string, unknown, ReadonlyArray<string>]>([
        ["until: 10 rounds is the most", chaseWith((step) => ({ ...step, params: { ...paramsOf(step), max: 10 } })), []],
        ["until: 11 rounds", chaseWith((step) => ({ ...step, params: { ...paramsOf(step), max: 11 } })), ["LOOP_MAX_INVALID@nodes.chase.params.max"]],
        ["until: 0 rounds", chaseWith((step) => ({ ...step, params: { ...paramsOf(step), max: 0 } })), ["LOOP_MAX_INVALID@nodes.chase.params.max"]],
        ["every 0 minutes", chaseWith((step) => ({ ...step, params: { ...paramsOf(step), every: { minutes: 0 } } })), ["LOOP_EVERY_INVALID@nodes.chase.params.every"]],
        ["every 1441 minutes", chaseWith((step) => ({ ...step, params: { ...paramsOf(step), every: { minutes: 1441 } } })), ["LOOP_EVERY_INVALID@nodes.chase.params.every"]],
        ["every 31 days", chaseWith((step) => ({ ...step, params: { ...paramsOf(step), every: { days: 31 } } })), ["LOOP_EVERY_INVALID@nodes.chase.params.every"]],
        ["every 15 minutes", chaseWith((step) => ({ ...step, params: { ...paramsOf(step), every: { minutes: 15 } } })), []],
        [
            "a stop route on a step outside the body",
            chaseWith((step) => ({ ...step, params: { ...paramsOf(step), until: { route: "tell", stop: "later" } } })),
            ["LOOP_UNTIL_ROUTE_UNKNOWN@nodes.chase.params.until"],
        ],
        [
            "a stop route on a body node with no routes",
            chaseWith((step) => ({ ...step, params: { ...paramsOf(step), until: { route: "send", stop: "later" } } })),
            ["LOOP_UNTIL_ROUTE_UNKNOWN@nodes.chase.params.until"],
        ],
        [
            "a stop that is not one of the node's routes",
            chaseWith((step) => ({ ...step, params: { ...paramsOf(step), until: { route: "check", stop: "paid" } } })),
            ["LOOP_UNTIL_ROUTE_UNKNOWN@nodes.chase.params.until"],
        ],
        [
            "an until expression into the body that may not have run, with no default",
            chaseWith((step) => ({
                ...step,
                params: { ...paramsOf(step), until: { op: "present", ref: { $ref: "steps.send.output.messageId" } } },
            })),
            ["GRAPH_REF_NOT_DOMINATOR@nodes.chase.params.until.0<-steps.send.output.messageId"],
        ],
        [
            "an until expression into the body's start, which every round runs",
            chaseWith((step) => ({
                ...step,
                params: { ...paramsOf(step), until: { op: "eq", ref: { $ref: "steps.check.output.verdict" }, value: "later" } },
            })),
            [],
        ],
        [
            "an until expression too deep",
            chaseWith((step) => ({
                ...step,
                params: { ...paramsOf(step), until: { not: { not: { not: { not: { op: "present", ref: { $ref: "trigger.orderId" } } } } } } },
            })),
            ["EXPR_TOO_DEEP@nodes.chase.params.until"],
        ],
        [
            "a body step going back to its own loop: a leak, never a cycle",
            chaseWith(
                (step) => step,
                (list) => list.map((step) => (typeof step === "object" && step !== null && "key" in step && step.key === "send" ? { ...step, next: "chase" } : step)),
            ),
            ["LOOP_BODY_LEAK@nodes.send->chase"],
        ],
        [
            "a loop inside a loop",
            chaseWith(
                (step) => step,
                (list) =>
                    list.map((step) =>
                        typeof step === "object" && step !== null && "key" in step && step.key === "send"
                            ? {
                                  kind: "loop",
                                  key: "send",
                                  loop: "chase",
                                  step: "core.loop",
                                  params: { mode: "until", until: { op: "present", ref: { $ref: "trigger.orderId" } }, max: 2 },
                                  routes: { body: "check", exhausted: "check" },
                                  next: "check",
                              }
                            : step,
                    ),
            ),
            expect.arrayContaining(["LOOP_NESTED@nodes.send"]),
        ],
        [
            "an outcome inside a body",
            chaseWith(
                (step) => step,
                (list) =>
                    list.map((step) =>
                        typeof step === "object" && step !== null && "key" in step && step.key === "send"
                            ? { kind: "outcome", key: "send", loop: "chase", step: "core.outcome", params: { outcome: "x", outputs: {} } }
                            : step,
                    ),
            ),
            expect.arrayContaining(["LOOP_BODY_HANDOFF@nodes.send"]),
        ],
    ])("%s", (_label, raw, codes) => {
        expect(judge(raw)).toEqual(codes)
    })

    it.each<readonly [string, unknown, ReadonlyArray<string>]>([
        ["over: 51 items", overWith((step) => ({ ...step, params: { ...paramsOf(step), max: 51 } })), ["LOOP_MAX_INVALID@nodes.each.params.max"]],
        ["over: 0 at once", overWith((step) => ({ ...step, params: { ...paramsOf(step), concurrency: 0 } })), ["LOOP_CONCURRENCY_INVALID@nodes.each.params.concurrency"]],
        ["over: 6 at once", overWith((step) => ({ ...step, params: { ...paramsOf(step), concurrency: 6 } })), ["LOOP_CONCURRENCY_INVALID@nodes.each.params.concurrency"]],
        ["over: a field path key", overWith((step) => ({ ...step, params: { ...paramsOf(step), itemKey: "order.id_2" } })), []],
        ["over: a key with an empty segment", overWith((step) => ({ ...step, params: { ...paramsOf(step), itemKey: "a..b" } })), ["LOOP_KEY_INVALID@nodes.each.params.itemKey"]],
        ["over: a key that starts with a digit", overWith((step) => ({ ...step, params: { ...paramsOf(step), itemKey: "1a" } })), ["LOOP_KEY_INVALID@nodes.each.params.itemKey"]],
        ["over: a key that is code", overWith((step) => ({ ...step, params: { ...paramsOf(step), itemKey: "x => x.id" } })), ["LOOP_KEY_INVALID@nodes.each.params.itemKey"]],
        ["over: the item itself over a list of objects", overWith((step) => ({ ...step, params: { ...paramsOf(step), itemKey: "." } })), ["LOOP_KEY_NOT_SCALAR@nodes.each.params.itemKey"]],
        ["over: a collect outside the body", overWith((step) => ({ ...step, params: { ...paramsOf(step), collect: "list" } })), ["LOOP_COLLECT_UNKNOWN@nodes.each.params.collect"]],
    ])("%s", (_label, raw, codes) => {
        expect(judge(raw, overNodes)).toEqual(codes)
    })

    it("refuses a cycle that does not go through a loop", () => {
        const compiled = compileTemplateGraph({
            ...chaseConfig(),
            start: "a",
            nodes: {
                a: node(remindNote, { input: { orderId: ref("trigger.orderId") }, next: "b" }),
                b: node(remindNote, { input: { orderId: ref("trigger.orderId") }, next: "a" }),
            },
        })
        expect(codesOf(compiled.problems)).toContain("GRAPH_CYCLE@nodes")
    })
})

describe("nothing inside a graph is a function: the structural guard", () => {
    const fn = (): string => "x"
    const asValue = (value: unknown): JsonValue => value as JsonValue

    it.each<readonly [string, TemplateGraphConfig, ReadonlyArray<string>]>([
        [
            "a function bound to an input",
            chaseConfig({
                check: node(remindCheck, { input: { orderId: asValue(fn) as string }, routes: { due: "send", later: endRound } }),
                send: node(remindSend, { input: { orderId: ref("trigger.orderId") } }),
            }),
            ["GRAPH_VALUE_NOT_DATA@nodes.chase.body.nodes.check.input.orderId"],
        ],
        [
            "a class instance in a trigger's args",
            { ...chaseConfig(), triggers: [{ verb: TRIGGER.workflowCalled, args: { at: asValue(new Date(0)) } }] },
            ["GRAPH_VALUE_NOT_DATA@triggers.0.args.at"],
        ],
        [
            "a symbol and a bigint in an outcome's output",
            {
                ...chaseConfig(),
                nodes: {
                    ...chaseConfig().nodes,
                    "gave-up": outcome({ name: "gave-up", output: { a: asValue(Symbol("s")), b: asValue(BigInt(1)) } }),
                },
            },
            ["GRAPH_VALUE_NOT_DATA@nodes.gave-up.output.a", "GRAPH_VALUE_NOT_DATA@nodes.gave-up.output.b"],
        ],
        [
            "an undefined inside a list",
            {
                ...chaseConfig(),
                nodes: { ...chaseConfig().nodes, "gave-up": outcome({ name: "gave-up", output: { list: asValue([1, undefined]) } }) },
            },
            ["GRAPH_VALUE_NOT_DATA@nodes.gave-up.output.list.1"],
        ],
        [
            "a function as an until",
            {
                ...chaseConfig(),
                nodes: {
                    ...chaseConfig().nodes,
                    chase: {
                        kind: "loop",
                        mode: "until",
                        until: asValue(fn) as unknown as UntilCondition,
                        max: 2,
                        every: null,
                        body: { start: "x", nodes: { x: node(remindNote, { input: { orderId: "o" } }) } },
                        next: "done",
                        exhausted: "tell",
                    },
                },
            },
            expect.arrayContaining(["GRAPH_VALUE_NOT_DATA@nodes.chase.until"]),
        ],
    ])("%s", (_label, config, codes) => {
        expect(codesOf(compileTemplateGraph(config).problems)).toEqual(codes)
    })

    it("never walks the template node a step places (its run is the one function a template holds) nor the input schema", () => {
        expect(codesOf(compileTemplateGraph(chaseConfig()).problems)).toEqual([])
        expect(codesOf(compileTemplateGraph(roundConfig).problems)).toEqual([])
    })

    it("defineTemplateGraph throws at load with the problem", () => {
        const config: TemplateGraphConfig = {
            ...chaseConfig(),
            nodes: { ...chaseConfig().nodes, "gave-up": outcome({ name: "gave-up", output: { a: asValue(fn) } }) },
        }
        expect(() => defineTemplateGraph(config)).toThrow(TemplateDefinitionError)
        // A coded error's message is its code (DomainError, 2026-11-14): the problems are read from the error, not from its message.
        const thrown = (() => {
            try {
                defineTemplateGraph(config)
            } catch (error) {
                return error
            }
            return null
        })()
        expect(thrown instanceof TemplateDefinitionError ? thrown.problems.map((one) => `${one.code}@${one.at}`) : []).toContain("GRAPH_VALUE_NOT_DATA@nodes.gave-up.output.a")
    })

    it("an endItem outside a body is still refused, endRound alike", () => {
        expect(endRound).toBe(endItem)
        const config = chaseConfig()
        const compiled = compileTemplateGraph({
            ...config,
            nodes: { ...config.nodes, tell: ifNode({ when: present(ref("trigger.orderId")), yes: endRound, no: "gave-up" }) },
        })
        expect(codesOf(compiled.problems)).toContain("GRAPH_END_ITEM_OUTSIDE@nodes.tell.routes.yes")
    })
})
