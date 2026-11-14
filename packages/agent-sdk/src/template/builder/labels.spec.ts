import { z } from "zod"
import { graphSpecSchema } from "../../graph/graph-spec.schema"
import { graphSpecV2Schema, graphSpecV2WrittenSchema } from "../../graph/graph-spec-v2.schema"
import type { GraphSpecV2, GraphV2Step } from "../../graph/graph-spec-v2.types"
import { contractViewsOf, type ContractWords } from "../../graph/view/contract-view"
import { TRIGGER } from "../../names"
import { endRound, equals, handBack, ifNode, loop, node, outcome, ref, round, trigger, wait, waitFor } from "./graph-builder"
import type { TemplateGraphConfig } from "./graph-builder.types"
import { compileTemplateGraph } from "./graph-compile"
import { templateGraphProblems } from "./graph-problems"
import { exampleTriggerLookup, listOrders, openToolLookup, remindNote } from "./template.fixture"

// FE-MAP needs (R68): the map shows the WORKSPACE'S words on the engine's control steps (a condition's question, a wait, a loop and its
// two ways out, a hand-back, an outcome), never a generic word or a raw key. This spec proves the SDK half: the builder option, the stored
// form, both read schemas, the @1 schema, the outcome's words in the contract and in its view.

const WORDS = {
    loop: { vi: "Thanh toán", en: "Payment" },
    until: { vi: "Thoát khi đơn đã trả", en: "Leaves when paid" },
    exhausted: { vi: "Hết 3 vòng mà chưa trả", en: "3 rounds and still unpaid" },
    first: { vi: "Vòng đầu?", en: "First round?" },
    wait: { vi: "Chờ khách nhắn", en: "Wait for the customer" },
    handBack: { vi: "Trả lại tin", en: "Hand the message back" },
    paid: { vi: "Đã trả", en: "Paid" },
} as const

/** A graph whose `until` loop opens with a condition, waits for the person's line and hands a line back; two outcomes, one named. */
const labelledConfig = (labelled: boolean): TemplateGraphConfig => ({
    key: "test.labels",
    title: { key: "g" },
    input: z.object({ code: z.string().max(200) }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    start: "list",
    nodes: {
        list: node(listOrders, { next: "pay" }),
        pay: loop({
            ...(labelled ? { label: WORDS.loop, exits: { until: WORDS.until, exhausted: WORDS.exhausted } } : {}),
            until: equals(ref("steps.hear.output.trigger", { default: null }), "timeout"),
            max: 3,
            body: {
                start: "opening",
                nodes: {
                    opening: ifNode({ ...(labelled ? { label: WORDS.first } : {}), when: equals(round(), 1), yes: "note", no: "hear" }),
                    hear: wait({
                        ...(labelled ? { label: WORDS.wait } : {}),
                        for: { said: waitFor(TRIGGER.zaloMessageReceived) },
                        timeout: "1d",
                        next: { said: "back", timeout: endRound },
                    }),
                    note: node(remindNote, { input: { orderId: "o1" }, next: endRound }),
                    back: handBack({ ...(labelled ? { label: WORDS.handBack } : {}), wait: "hear" }),
                },
            },
            next: "paid",
            exhausted: "quiet",
        }),
        paid: outcome({ name: "paid", ...(labelled ? { label: WORDS.paid } : {}) }),
        quiet: outcome({ name: "quiet" }),
    },
})

const stepOf = (spec: GraphSpecV2, key: string): GraphV2Step | undefined => spec.nodes.find((step) => step.key === key)

const context = { tools: openToolLookup, triggers: exampleTriggerLookup, nullability: "strict" as const }

describe("control step labels: the builder and the stored form", () => {
    const compiled = compileTemplateGraph(labelledConfig(true), { nullability: "strict" })
    const spec = compiled.graph.spec

    it("compiles with no problem, the save's checks included", () => {
        expect(compiled.problems).toEqual([])
        expect(templateGraphProblems(spec, { ...context, nodes: compiled.graph.nodes })).toEqual([])
    })

    it("writes each control step's words on the step, and the loop's two ways out", () => {
        expect(stepOf(spec, "pay")).toMatchObject({ label: WORDS.loop, exits: { until: WORDS.until, exhausted: WORDS.exhausted } })
        expect(stepOf(spec, "opening")).toMatchObject({ kind: "if", label: WORDS.first })
        expect(stepOf(spec, "hear")).toMatchObject({ kind: "wait", label: WORDS.wait })
        expect(stepOf(spec, "back")).toMatchObject({ kind: "hand-back", label: WORDS.handBack })
        expect(stepOf(spec, "paid")).toMatchObject({ kind: "outcome", label: WORDS.paid })
    })

    it("gives the named outcome its words in the contract; an unnamed one keeps its key as label and no title", () => {
        expect(spec.outcomes).toEqual([
            { key: "paid", label: "paid", title: WORDS.paid, outputs: [] },
            { key: "quiet", label: "quiet", outputs: [] },
        ])
    })

    it("writes nothing for a step the graph does not name: the stored form is as before", () => {
        const plain = compileTemplateGraph(labelledConfig(false)).graph.spec
        for (const step of plain.nodes) expect(step).not.toHaveProperty("label")
        expect(stepOf(plain, "pay")).not.toHaveProperty("exits")
        expect(plain.outcomes.every((one) => one.title === undefined)).toBe(true)
    })

    it("both @2 read schemas take the words and a written document round-trips", () => {
        expect(graphSpecV2WrittenSchema.parse(spec)).toEqual(spec)
        expect(graphSpecV2Schema.parse(spec)).toEqual(spec)
    })

    it("the @1 schema takes a step's label and an until loop's exits, and refuses a label that is no spec text", () => {
        const onOne = {
            schema: "nivo/agent-graph@1",
            moduleKey: "test",
            trigger: { kind: "tag", sources: ["agent"] },
            grant: { tools: [], effects: [] },
            nodes: [
                { key: "pay", kind: "execute", step: "core.until", label: WORDS.loop, exits: { until: WORDS.until, exhausted: WORDS.exhausted } },
                { key: "exact", kind: "execute", step: "core.when", label: { key: "graphExact" } },
            ],
        }
        expect(graphSpecSchema.safeParse(onOne).success).toBe(true)
        expect(graphSpecSchema.safeParse({ ...onOne, nodes: [{ ...onOne.nodes[1], label: "Đủ tiền?" }] }).success).toBe(false)
    })
})

describe("control step labels: the outcome's words in the contract view", () => {
    const words: ContractWords = {
        sourceLabel: (kind) => kind,
        entryLabel: (openTo) => openTo,
        typeLabel: (type) => type,
        conditionWord: (op) => op,
        paramLabel: () => undefined,
        pathSeparator: () => ".",
        versionLatest: () => "latest",
        versionPinned: () => "v{version}",
        problem: (code) => code,
        agentLabel: () => undefined,
    }
    const views = contractViewsOf(words)
    const spec = {
        schema: "nivo/agent-graph@1" as const,
        moduleKey: "test",
        trigger: { kind: "tag" as const, sources: ["agent" as const] },
        grant: { tools: [], effects: [] },
        outcomes: [
            { key: "paid", label: "paid", title: WORDS.paid, outputs: [] },
            { key: "quiet", label: "quiet", outputs: [] },
        ],
        nodes: [
            { key: "paid", kind: "execute" as const, step: "core.outcome", params: { outcome: "paid", outputs: {} } },
            { key: "quiet", kind: "execute" as const, step: "core.outcome", params: { outcome: "quiet", outputs: {} } },
        ],
    }

    it.each([
        ["vi", "Đã trả"],
        ["en", "Paid"],
    ] as const)("reads a named outcome in its words (%s) and an unnamed one by its label", (locale, paid) => {
        expect(views.outcomeViewsOf(spec, locale).map((one) => one.label)).toEqual([paid, "quiet"])
        expect(views.outcomeEndViewOf(spec.nodes[0], spec, locale)?.label).toBe(paid)
        expect(views.outcomeEndViewOf(spec.nodes[1], spec, locale)?.label).toBe("quiet")
    })
})
