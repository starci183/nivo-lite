import { graphSpecV2Schema } from "../../graph/graph-spec-v2.schema"
import type { StoredExpr, StoredRef } from "../../graph/graph-spec-v2.types"
import type { JsonValue } from "../../schema/schema.types"
import { caseFolded, exprHolds, exprTruth } from "./condition-eval"
import { exprProblems } from "./expr-problems"
import type { ExprValueKind } from "./expr-problems"
import { z } from "zod"
import { TRIGGER } from "../../names"
import { contains, equals, ifNode, node, outcome, ref, trigger } from "./graph-builder"
import { compileTemplateGraph, storedExprOf } from "./graph-compile"
import { remindNote } from "./template.fixture"

// `contains(text, part)`: an exact substring test on two texts (integrity comparison of data fields, like `equals`), case as given unless
// the leaf declares `{ caseFold: true }`; and `equals` over two refs.

const scope: Readonly<Record<string, JsonValue>> = {
    content: "CK DH A12 thanh toan",
    code: "A12",
    lower: "dh a12",
    count: 3,
    other: 3,
    none: null,
}
const read = (stored: StoredRef): JsonValue => scope[stored.$ref] ?? stored.default ?? null
const at = (name: string): StoredRef => ({ $ref: name, default: null })

describe("contains: the evaluation", () => {
    it.each<readonly [string, StoredExpr, ReturnType<typeof exprTruth>]>([
        ["a ref holds a literal part", { op: "contains", ref: at("content"), value: "A12" }, true],
        ["a ref holds another ref", { op: "contains", ref: at("content"), value: at("code") }, true],
        ["case as given: a lower-case part is not found", { op: "contains", ref: at("content"), value: at("lower") }, false],
        ["caseFold: the folded texts are compared", { op: "contains", ref: at("content"), value: at("lower"), caseFold: true }, true],
        ["the empty part is in every text", { op: "contains", ref: at("content"), value: "" }, true],
        ["a number is no text: unknown", { op: "contains", ref: at("count"), value: "3" }, "unknown"],
        ["an absent text (null): unknown", { op: "contains", ref: at("none"), value: "x" }, "unknown"],
    ])("%s", (_name, expr, truth) => {
        expect(exprTruth(expr, read)).toBe(truth)
    })

    it("an unknown truth does not hold (an `if` goes `no`)", () => {
        expect(exprHolds({ op: "contains", ref: at("count"), value: "3" }, read)).toBe(false)
    })

    it("equals over two refs: an integer equals an integer", () => {
        expect(exprHolds({ op: "eq", ref: at("count"), value: at("other") }, read)).toBe(true)
        expect(exprHolds({ op: "eq", ref: at("count"), value: at("code") }, read)).toBe(false)
    })
})

describe("caseFolded: locale-free simple case folding", () => {
    it("folds per code point, the same in every locale (no Turkish dotless rule, final sigma folds to sigma)", () => {
        expect(caseFolded("\u0110\u01a0N H\u00c0NG")).toBe("\u0111\u01a1n h\u00e0ng")
        expect(caseFolded("\u0130")).toBe("\u0130".toLowerCase().length === 1 ? "i" : "\u0130")
        expect(caseFolded("\u039f\u0394\u039f\u03a3")).toBe(caseFolded("\u03bf\u03b4\u03bf\u03c2"))
        expect(caseFolded("\u017f")).toBe("s")
        expect(caseFolded("\u1e9e")).toBe("\u00df")
    })
})

describe("contains: the builder and the stored form", () => {
    it("writes `op: contains`, the part as a literal or a ref, and `caseFold` only when declared", () => {
        expect(storedExprOf(contains(ref("trigger.content"), "A12"))).toEqual({
            op: "contains",
            ref: { $ref: "trigger.content", default: null },
            value: "A12",
        })
        expect(storedExprOf(contains(ref("trigger.content"), ref("steps.order.output.code"), { caseFold: true }))).toEqual({
            op: "contains",
            ref: { $ref: "trigger.content", default: null },
            value: { $ref: "steps.order.output.code", default: null },
            caseFold: true,
        })
    })

    it("the @2 schema reads a contains leaf and refuses `caseFold` on another operator", () => {
        const base = compileTemplateGraph({
            key: "test.contains",
            title: { key: "g" },
            input: z.object({ text: z.string().max(200) }),
            triggers: [trigger(TRIGGER.workflowCalled)],
            start: "check",
            nodes: {
                check: ifNode({ when: contains(ref("trigger.text"), "x"), yes: "done", no: "note" }),
                note: node(remindNote, { input: { orderId: "o" } }),
                done: outcome({ name: "done" }),
            },
        }).graph.spec
        const when = (leaf: unknown): unknown => ({
            ...base,
            nodes: base.nodes.map((step) => (step.key === "check" ? { ...step, params: { when: leaf } } : step)),
        })
        expect(graphSpecV2Schema.safeParse(base).success).toBe(true)
        expect(
            graphSpecV2Schema.safeParse(when({ op: "contains", ref: { $ref: "trigger.text" }, value: "x", caseFold: true })).success,
        ).toBe(true)
        expect(
            graphSpecV2Schema.safeParse(when({ op: "eq", ref: { $ref: "trigger.text" }, value: "x", caseFold: true })).success,
        ).toBe(false)
    })
})

describe("contains: the save check (exprProblems)", () => {
    const kinds: Readonly<Record<string, ExprValueKind>> = { "trigger.text": "string", "trigger.n": "number", "trigger.u": "unknown" }
    const context = { at: "w", kindOf: (stored: StoredRef): ExprValueKind => kinds[stored.$ref] ?? "missing" }
    const codes = (expr: StoredExpr) => exprProblems(expr, context).map((one) => `${one.code}@${one.at}`)

    it("takes two texts (or a side the source does not type)", () => {
        expect(codes({ op: "contains", ref: { $ref: "trigger.text" }, value: "x" })).toEqual([])
        expect(codes({ op: "contains", ref: { $ref: "trigger.u" }, value: { $ref: "trigger.text" } })).toEqual([])
    })

    it("refuses a side that is no text (EXPR_TYPE_MISMATCH)", () => {
        expect(codes({ op: "contains", ref: { $ref: "trigger.n" }, value: "x" })).toEqual(["EXPR_TYPE_MISMATCH@w"])
        expect(codes({ op: "contains", ref: { $ref: "trigger.text" }, value: 3 })).toEqual(["EXPR_TYPE_MISMATCH@w"])
    })

    it("equals over two refs of one family is sound", () => {
        expect(codes(storedExprOf(equals(ref("trigger.n"), ref("trigger.n"))))).toEqual([])
    })
})
