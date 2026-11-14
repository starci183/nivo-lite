import { z } from "zod"
import { graphSpecV2Schema, graphSpecV2WrittenSchema } from "../../graph/graph-spec-v2.schema"
import type { GraphSpecV2, StoredExpr, StoredRef } from "../../graph/graph-spec-v2.types"
import { TRIGGER } from "../../names"
import type { JsonValue } from "../../schema/schema.types"
import { exprHolds, exprTruth } from "./condition-eval"
import type { ExprTruth } from "./condition-eval"
import { exprProblems } from "./expr-problems"
import type { ExprValueKind } from "./expr-problems"
import {
    absent,
    and,
    callWorkflows,
    equals,
    gt,
    gte,
    ifNode,
    lt,
    lte,
    node,
    not,
    notEquals,
    or,
    outcome,
    present,
    ref,
    trigger,
} from "./graph-builder"
import type { Expr, TemplateGraphConfig } from "./graph-builder.types"
import { compileTemplateGraph } from "./graph-compile"
import { defineTemplateNode } from "./template-node"
import type { TemplateProblem } from "./template-problems"
import { listOrders, parseJson, remindNote } from "./template.fixture"

const codesOf = (problems: ReadonlyArray<TemplateProblem>): ReadonlyArray<string> =>
    problems.map((problem) => `${problem.code}@${problem.at}`)

const scope: Readonly<Record<string, JsonValue>> = {
    dryRun: false,
    invoiceNo: "HD-1",
    empty: [],
    amount: 5,
    at: "2026-01-02",
    later: "2026-01-02T10:00:00Z",
    label: "five",
}
const read = (stored: StoredRef): JsonValue => scope[stored.$ref] ?? stored.default ?? null
const at = (name: string, fallback: JsonValue = null): StoredRef => ({ $ref: name, default: fallback })
const yes = { op: "eq", ref: at("dryRun"), value: false } as const
const no = { op: "eq", ref: at("dryRun"), value: true } as const
const mismatch = { op: "gt", ref: at("label"), value: 1 } as const

describe("exprTruth / exprHolds: the evaluation table", () => {
    it.each<readonly [string, StoredExpr, ExprTruth]>([
        ["eq on a boolean", { op: "eq", ref: at("dryRun"), value: false }, true],
        ["eq is canonical JSON: a number never equals its text", { op: "eq", ref: at("amount"), value: "5" }, false],
        ["eq on objects by canonical JSON", { op: "eq", ref: at("missing", { b: 1, a: 2 }), value: { a: 2, b: 1 } }, true],
        ["ne", { op: "ne", ref: at("invoiceNo"), value: "HD-2" }, true],
        ["gt on numbers", { op: "gt", ref: at("amount"), value: 4 }, true],
        ["gte on numbers, equal", { op: "gte", ref: at("amount"), value: 5 }, true],
        ["lt on numbers", { op: "lt", ref: at("amount"), value: 5 }, false],
        ["lte on numbers", { op: "lte", ref: at("amount"), value: 4 }, false],
        ["lt on ISO dates", { op: "lt", ref: at("at"), value: "2026-01-03" }, true],
        ["gt on ISO instants with times", { op: "gt", ref: at("later"), value: "2026-01-02T09:59:59Z" }, true],
        ["a ref on the right", { op: "gte", ref: at("amount"), value: at("amount") }, true],
        ["order of a date against a number: unknown", { op: "gt", ref: at("at"), value: 1 }, "unknown"],
        ["order of free text: unknown", { op: "gt", ref: at("invoiceNo"), value: "HD-0" }, "unknown"],
        ["order against null (an absent value): unknown", { op: "lt", ref: at("nothing"), value: 3 }, "unknown"],
        ["an absent value reads its default", { op: "eq", ref: at("nothing", 7), value: 7 }, true],
        ["present", { op: "present", ref: at("invoiceNo") }, true],
        ["empty text is absent", { op: "absent", ref: at("nothing", "") }, true],
        ["an empty list is absent", { op: "absent", ref: at("empty") }, true],
        ["a missing value reads its default, null", { op: "absent", ref: at("nothing") }, true],
        ["and: all hold", { and: [yes, { op: "present", ref: at("invoiceNo") }] }, true],
        ["and: one fails", { and: [yes, no] }, false],
        ["and: false beats unknown", { and: [mismatch, no] }, false],
        ["and: unknown beats true", { and: [mismatch, yes] }, "unknown"],
        ["or: one holds", { or: [no, yes] }, true],
        ["or: true beats unknown", { or: [mismatch, yes] }, true],
        ["or: unknown beats false", { or: [mismatch, no] }, "unknown"],
        ["or: none holds", { or: [no, no] }, false],
        ["not", { not: no }, true],
        ["not of unknown stays unknown", { not: mismatch }, "unknown"],
        ["nested to depth 4", { and: [{ or: [{ not: no }, no] }, yes] }, true],
    ])("%s", (_label, expr, truth) => {
        expect(exprTruth(expr, read)).toBe(truth)
        // A mismatch never throws at run and never holds: an `if` goes `no`, an `until` runs another round.
        expect(exprHolds(expr, read)).toBe(truth === true)
    })
})

/** A kind lookup by the ref's name: `n*` numbers, `d*` dates, `s*` texts, `u*` unknown, `x*` missing. */
const kinds = (ref: StoredRef): ExprValueKind => {
    const first = ref.$ref.charAt(0)
    if (first === "n") return "number"
    if (first === "d") return "date"
    if (first === "s") return "string"
    if (first === "x") return "missing"
    return "unknown"
}
const leaf: StoredExpr = { op: "present", ref: at("u") }
/** A group of `count` leaves (at least one). */
const leaves = (count: number): readonly [StoredExpr, ...Array<StoredExpr>] => [leaf, ...Array.from({ length: count - 1 }, () => leaf)]
const deep = (depth: number): StoredExpr => (depth <= 1 ? leaf : { not: deep(depth - 1) })

describe("exprProblems: the one validator", () => {
    it.each<readonly [string, StoredExpr, ReadonlyArray<string>]>([
        ["depth 4 is the most", deep(4), []],
        ["depth 5 is too deep", deep(5), ["EXPR_TOO_DEEP@w"]],
        ["16 leaves are the most", { or: [{ and: leaves(8) }, { and: leaves(8) }] }, []],
        ["17 leaves are too many", { or: leaves(17) }, ["EXPR_TOO_LARGE@w"]],
        ["order between two numbers", { op: "gt", ref: at("n1"), value: at("n2") }, []],
        ["order between two dates", { op: "lt", ref: at("d1"), value: "2026-01-03T00:00:00Z" }, []],
        ["order of a number against a date", { op: "lt", ref: at("n1"), value: "2026-01-03" }, ["EXPR_TYPE_MISMATCH@w"]],
        ["order of plain text", { op: "gte", ref: at("s1"), value: "b" }, ["EXPR_TYPE_MISMATCH@w"]],
        ["order against a boolean", { op: "gt", ref: at("n1"), value: true }, ["EXPR_TYPE_MISMATCH@w"]],
        ["order of an unknown source is judged at run", { op: "gt", ref: at("u1"), value: "x" }, []],
        ["equality across kinds that never meet", { op: "eq", ref: at("n1"), value: "5" }, ["EXPR_TYPE_MISMATCH@w"]],
        ["equality of a date with text is legal", { op: "eq", ref: at("d1"), value: "never" }, []],
        ["equality with null is legal", { op: "ne", ref: at("n1"), value: null }, []],
        ["a ref that reads nothing", { op: "present", ref: at("x1") }, ["GRAPH_REF_TYPE@w.ref<-x1"]],
        [
            "each leaf has its path",
            { and: [{ op: "eq", ref: at("u2"), value: false }, { not: { op: "lt", ref: at("s1"), value: at("n1") } }] },
            ["EXPR_TYPE_MISMATCH@w.and.1.not"],
        ],
    ])("%s", (_label, expr, codes) => {
        expect(codesOf(exprProblems(expr, { at: "w", kindOf: kinds }))).toEqual(codes)
    })
})

describe("the builders and the object-literal form", () => {
    const r = ref("trigger.text")

    it("build exactly the stored data", () => {
        expect(present(r)).toEqual({ op: "present", ref: r })
        expect(absent(r)).toEqual({ op: "absent", ref: r })
        expect(equals(r, 1)).toEqual({ op: "eq", ref: r, value: 1 })
        expect(notEquals(r, r)).toEqual({ op: "ne", ref: r, value: r })
        expect([gt(r, 1), gte(r, 1), lt(r, 1), lte(r, 1)].map((entry) => entry.op)).toEqual(["gt", "gte", "lt", "lte"])
        expect(and(present(r), or(absent(r), not(equals(r, 2))))).toEqual({
            and: [
                { op: "present", ref: r },
                { or: [{ op: "absent", ref: r }, { not: { op: "eq", ref: r, value: 2 } }] },
            ],
        })
    })

    it("refuses at compile time a wrong expression", () => {
        const four: Expr = and(or(not(present(r))))
        const literal: Expr = { and: [{ or: [{ not: { op: "present", ref: r } }] }] }
        // @ts-expect-error depth 5 by the builders: the parts of `and` are at most 3 deep
        const fiveBuilt = and(and(or(not(present(r)))))
        // @ts-expect-error depth 5 as an object literal
        const fiveLiteral: Expr = { not: { not: { not: { not: { op: "present", ref: r } } } } }
        // @ts-expect-error a leaf and a group in one object
        const mixed: Expr = { op: "present", ref: r, and: [present(r)] }
        // @ts-expect-error two groups in one object
        const twoGroups: Expr = { and: [present(r)], or: [present(r)] }
        // @ts-expect-error a group with no part
        const empty = and()
        // @ts-expect-error an order compares numbers or ISO instants, never a boolean
        const orderBoolean = gt(r, true)
        // @ts-expect-error a presence test has no value
        const presenceValue: Expr = { op: "present", ref: r, value: 1 }
        // @ts-expect-error a condition is data, never a function
        const fn = ifNode({ when: () => true, yes: "a" })
        expect([four, literal, fiveBuilt, fiveLiteral, mixed, twoGroups, empty, orderBoolean, presenceValue, fn]).toHaveLength(10)
    })
})

/** A node whose output has a number, a date and a text, for typed comparisons. */
const dueRead = defineTemplateNode({
    id: "test.due-read",
    title: { key: "t" },
    description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
    tools: [],
    mode: "auto",
    accounts: [],
    input: z.object({}),
    output: z.object({ amount: z.number(), dueAt: z.iso.datetime().max(40), label: z.string().max(200) }),
    model: "claude-sonnet-5-5",
    run: () => Promise.resolve({ amount: 1, dueAt: "2026-01-01T00:00:00Z", label: "a" }),
    examples: [
        { name: "reads", params: {}, input: {}, output: { amount: 1, dueAt: "2026-01-01T00:00:00Z", label: "a" } },
    ],
})

/** A graph that reads, decides by `when`, and ends. */
const decide = (when: Expr): TemplateGraphConfig => ({
    key: "test.decide",
    title: { key: "g" },
    input: z.object({ text: z.string().max(200) }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    start: "read",
    nodes: {
        read: node(dueRead, { next: "check" }),
        check: ifNode({ when, yes: "done", no: "note" }),
        note: node(remindNote, { input: { orderId: "o" } }),
        done: outcome({ name: "done" }),
    },
})

describe("expressions at save, in a graph", () => {
    it.each<readonly [string, Expr, ReadonlyArray<string>]>([
        ["a number against a number", gt(ref("steps.read.output.amount"), 3), []],
        ["a date-time against an ISO instant", lt(ref("steps.read.output.dueAt"), "2026-02-01T00:00:00Z"), []],
        ["a date-time against a date-time", lte(ref("steps.read.output.dueAt"), ref("steps.read.output.dueAt")), []],
        [
            "plain text in an order",
            gt(ref("steps.read.output.label"), "b"),
            ["EXPR_TYPE_MISMATCH@nodes.check.params.when"],
        ],
        [
            "a number against an ISO instant",
            gte(ref("steps.read.output.amount"), "2026-02-01"),
            ["EXPR_TYPE_MISMATCH@nodes.check.params.when"],
        ],
        [
            "a number equal to text",
            and(present(ref("trigger.text")), equals(ref("steps.read.output.amount"), "3")),
            ["EXPR_TYPE_MISMATCH@nodes.check.params.when.and.1"],
        ],
        [
            "a member the source lacks, reported once",
            present(ref("steps.read.output.nothing")),
            ["GRAPH_REF_TYPE@nodes.check.params.when.0<-steps.read.output.nothing"],
        ],
        [
            "a ref that is not upstream",
            present(ref("steps.note.output.noted", { default: "" })),
            ["GRAPH_REF_NOT_UPSTREAM@nodes.check.params.when.0<-steps.note.output.noted"],
        ],
        [
            "17 leaves",
            {
                or: [
                    present(ref("trigger.text")),
                    ...Array.from({ length: 16 }, () => present(ref("trigger.text"))),
                ],
            },
            ["EXPR_TOO_LARGE@nodes.check.params.when"],
        ],
    ])("%s", (_label, when, codes) => {
        expect(codesOf(compileTemplateGraph(decide(when)).problems)).toEqual(codes)
    })

    it("stores and / or / not as written, with every ref's default null", () => {
        const spec = compileTemplateGraph(decide(and(present(ref("trigger.text")), not(gt(ref("steps.read.output.amount"), 3)))))
            .graph.spec
        expect(spec.nodes.find((step) => step.key === "check")).toMatchObject({
            params: {
                when: {
                    and: [
                        { op: "present", ref: { $ref: "trigger.text", default: null } },
                        { not: { op: "gt", ref: { $ref: "steps.read.output.amount", default: null }, value: 3 } },
                    ],
                },
            },
        })
    })

    it("takes no one-level `all` / `any` in the written form (the retired spellings): a graph writes `and` / `or`", () => {
        // @ts-expect-error `all` is no group of the expression language any more
        const retiredAll: Expr = { all: [present(ref("trigger.text"))] }
        // @ts-expect-error `any` is no group of the expression language any more
        const retiredAny: Expr = { any: [absent(ref("trigger.text"))] }
        expect([retiredAll, retiredAny]).toHaveLength(2)
    })

    it("reads a stored `all` / `any` as `and` / `or`; the written form refuses them", () => {
        const spec = compileTemplateGraph(decide(and(present(ref("trigger.text"))))).graph.spec
        const old: unknown = parseJson(JSON.stringify(spec).replace('"and":', '"all":'))
        expect(graphSpecV2Schema.parse(old)).toEqual(spec)
        expect(graphSpecV2WrittenSchema.safeParse(old).success).toBe(false)
        expect(graphSpecV2WrittenSchema.safeParse(spec).success).toBe(true)
    })

    it("callWorkflows: a list is a presence check, an expression is written as given", () => {
        const compiled = compileTemplateGraph({
            ...decide(present(ref("trigger.text"))),
            start: "list",
            nodes: {
                list: node(listOrders, { next: "calls" }),
                calls: callWorkflows({
                    calls: [
                        { agent: "sales", workflow: "consult", when: ref("steps.list.output.orders"), input: {} },
                        {
                            agent: "sales",
                            workflow: "follow",
                            when: and(present(ref("steps.list.output.orders")), not(present(ref("trigger.text")))),
                            input: {},
                        },
                    ],
                }),
            },
        })
        expect(codesOf(compiled.problems)).toEqual([])
        const whens = compiled.graph.spec.nodes.flatMap((step) => (step.kind === "if" ? [step.params.when] : []))
        expect(whens).toEqual([
            { op: "present", ref: { $ref: "steps.list.output.orders", default: null } },
            {
                and: [
                    { op: "present", ref: { $ref: "steps.list.output.orders", default: null } },
                    { not: { op: "present", ref: { $ref: "trigger.text", default: null } } },
                ],
            },
        ])
    })
})

describe("the stored expression of raw JSON", () => {
    const base: GraphSpecV2 = compileTemplateGraph(decide(present(ref("trigger.text")))).graph.spec
    const withWhen = (when: unknown): unknown => ({
        ...base,
        nodes: base.nodes.map((step) => (step.key === "check" ? { ...step, params: { when } } : step)),
    })

    it.each<readonly [string, unknown]>([
        ["a leaf with a group member", { op: "present", ref: { $ref: "trigger.text" }, and: [] }],
        ["an empty group", { and: [] }],
        ["an unknown operator", { op: "in", ref: { $ref: "trigger.text" }, value: [] }],
        ["a presence test with a value", { op: "present", ref: { $ref: "trigger.text" }, value: 1 }],
        ["two groups in one object", { and: [{ op: "present", ref: { $ref: "a.b" } }], or: [{ op: "present", ref: { $ref: "a.b" } }] }],
        ["a not of a list", { not: [{ op: "present", ref: { $ref: "trigger.text" } }] }],
    ])("refuses %s", (_label, when) => {
        expect(graphSpecV2Schema.safeParse(withWhen(when)).success).toBe(false)
    })

    it("reads a deep expression, and the save judges its depth", () => {
        const parsed = graphSpecV2Schema.parse(withWhen(deep(6)))
        expect(codesOf(compileTemplateGraph(decide(present(ref("trigger.text")))).problems)).toEqual([])
        const check = parsed.nodes.find((step) => step.key === "check")
        expect(check?.kind === "if" ? codesOf(exprProblems(check.params.when, { at: "w", kindOf: () => "unknown" })) : []).toEqual([
            "EXPR_TOO_DEEP@w",
        ])
    })
})
