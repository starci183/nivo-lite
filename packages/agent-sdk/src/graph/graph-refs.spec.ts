import { z } from "zod"
import { defineNode, nodeIndexOf } from "../node"
import type { NodeDefinition } from "../node"
import { trusted } from "../schema/trusted"
import { dominatorsOf } from "./graph-dominators"
import { graphRefProblems, refContextOf, refMessageKeyOf, refProblemText } from "./graph-refs"
import { nextKeyOf } from "./graph-spec"
import type { GraphSpec, GraphSpecNode } from "./graph-spec.types"

/** A list element of the for-each fixture: an object of a few bounded members. */
const ITEM = z.object({ sku: z.string().max(50).optional() })

/** The values map of the outcome fixture: bounded keys, bounded text values, at most a few entries. */
const BOUNDED_VALUES = z
    .record(z.string().max(50), z.string().max(200))
    .refine((entries) => Object.keys(entries).length <= 20)

/** The words of the problems in the one language the spec needs. */
const WORDS: Readonly<Record<string, string>> = {
    "workflowRef.refNotDominator": "{{node}}.{{field}} reads {{ref}}, but that step may not have run. Give it a default.",
}

const example = { name: "e", params: {}, input: {}, output: trusted<never>({}), effects: [] }

const node = (
    id: `${string}.${string}`,
    role: NodeDefinition["role"],
    output: z.ZodType,
    extra: Partial<NodeDefinition> = {},
): NodeDefinition =>
    trusted<NodeDefinition>(
        defineNode({
            id,
            role,
            title: { key: "t" },
            params: z.object({ limit: z.number().int().default(3), note: z.string().max(200).optional() }),
            input: z.object({ address: z.string().max(200).optional(), total: z.number().optional() }),
            output,
            rights: [],
            effects: [],
            run: () => Promise.resolve(trusted<never>({})),
            examples: [example],
            ...extra,
        }),
    )

const order = node(
    "sales.order",
    "execute",
    z.object({
        address: z.string().max(200),
        totalVnd: z.number().int(),
        lines: z.array(z.object({ sku: z.string().max(50) })).max(50),
    }),
    { failure: z.object({ missing: z.string().max(200) }) },
)
const has = node("sales.has", "condition", z.object({ branch: z.enum(["yes", "no"]) }))
const reply = node("core.reply", "output", z.object({}))
const forEach = trusted<NodeDefinition>(
    defineNode({
        id: "core.for-each",
        role: "execute",
        title: { key: "t" },
        params: z.object({ items: z.array(ITEM).max(50) }),
        input: z.object({}),
        output: z.object({ results: z.array(ITEM).max(50), okCount: z.number().int(), failed: z.array(ITEM).max(50) }),
        rights: [],
        effects: [],
        run: () => Promise.resolve(trusted<never>({})),
        examples: [{ ...example, params: { items: [] } }],
    }),
)
const outcome = node("core.outcome", "output", z.object({ outcome: z.string().max(50), values: BOUNDED_VALUES }), {
    params: z.object({ outcome: z.string().max(50), outputs: BOUNDED_VALUES }),
    examples: [{ ...example, params: { outcome: "won", outputs: {} } }],
})
const index = nodeIndexOf({ nodes: [order, has, reply, forEach, outcome], effects: [], tools: [], dataKinds: [] })

const kindOf = (step: string): GraphSpecNode["kind"] => {
    if (step === "sales.has") return "condition"
    return step === "core.reply" ? "output" : "execute"
}

const n = (key: string, step: string, rest: Partial<GraphSpecNode> = {}): GraphSpecNode => ({
    key,
    kind: kindOf(step),
    step,
    ...rest,
})

const spec = (nodes: ReadonlyArray<GraphSpecNode>): GraphSpec => ({
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["channel"] },
    grant: { rights: [], tools: [], effects: [] },
    nodes,
})

/** start -> order -> has -(yes)-> side -> end; has -(no)-> end. A graph draws no branch for a failure. */
const graph = (end: Partial<GraphSpecNode>): GraphSpec =>
    spec([
        n("start", "core.reply", { next: "order" }),
        n("order", "sales.order", { next: "has" }),
        n("has", "sales.has", { routes: { yes: "side", no: "end" } }),
        n("side", "core.reply", { next: "end" }),
        n("end", "core.reply", end),
    ])

const context = refContextOf(index, new Map([["accounting.payment", new Map([["settle", "sales.order"]])]]), {
    orderId: "string",
})

const codes = (s: GraphSpec): ReadonlyArray<string> =>
    graphRefProblems(s, context).map((problem) => `${problem.code}@${problem.nodeKey}.${problem.field}`)

describe("save-time ref validation", () => {
    it("finds the dominators over next and the routes of a branch", () => {
        const dominators = dominatorsOf(graph({}))
        expect([...(dominators.get("end") ?? [])].sort()).toEqual(["end", "has", "order", "start"])
        expect([...(dominators.get("side") ?? [])].sort()).toEqual(["has", "order", "side", "start"])
    })

    it("accepts sound refs: a dominator, the trigger, a lead fact, a non-dominator with a default", () => {
        const sound = graph({
            params: {
                address: { $ref: "steps.order.output.address" },
                total: { $ref: "steps.order.output.totalVnd" },
                note: { $ref: "steps.order.output.lines.0.sku" },
                limit: { $ref: "steps.side.output.count", default: 1 },
            },
        })
        expect(codes(sound)).toEqual(["REF_FIELD_UNKNOWN@end.limit"])
        const fine = graph({
            params: {
                address: { $ref: "lead.address" },
                note: { $ref: "trigger.orderId" },
                total: { $ref: "workflows.accounting.payment.steps.settle.output.totalVnd", default: 0 },
            },
        })
        expect(codes(fine)).toEqual([])
    })

    it("refuses an unknown node, field, param, workflow and a broken ref", () => {
        const broken = graph({
            params: {
                address: { $ref: "steps.ghost.output.x" },
                note: { $ref: "steps.order.output.colour" },
                shoe: 1,
                total: { $ref: "workflows.x.y.steps.a.output.b", default: 1 },
                limit: { $ref: "order.totalVnd" },
            },
        })
        expect(codes(broken)).toEqual([
            "PARAM_UNKNOWN@end.shoe",
            "REF_NODE_UNKNOWN@end.address",
            "REF_FIELD_UNKNOWN@end.note",
            "REF_WORKFLOW_UNKNOWN@end.total",
            "REF_SYNTAX@end.limit",
        ])
        expect(codes(graph({ params: { note: { $ref: "lead.shoeSize" } } }))).toEqual(["REF_SYNTAX@end.note"])
        expect(codes(graph({ params: { note: { $ref: "trigger.unknownMember" } } }))).toEqual([
            "REF_FIELD_UNKNOWN@end.note",
        ])
    })

    it("refuses a type mismatch and a bad fixed value", () => {
        const wrong = graph({ params: { address: { $ref: "steps.order.output.totalVnd" }, limit: "many" } })
        expect(codes(wrong)).toEqual(["PARAM_INVALID@end.limit", "REF_TYPE_MISMATCH@end.address"])
    })

    it("refuses a ref to a node that may not have run, without a default, and to itself", () => {
        expect(codes(graph({ params: { note: { $ref: "steps.side.output.x" } } }))).toEqual([
            "REF_NOT_DOMINATOR@end.note",
        ])
        expect(codes(graph({ params: { note: { $ref: "steps.end.output.x" } } }))).toEqual(["REF_SELF@end.note"])
        expect(codes(graph({ params: { note: { $ref: "steps.order.error.code" } } }))).toEqual([
            "REF_NOT_DOMINATOR@end.note",
        ])
        // A failure goes to the engine, never to a branch of the graph: a ref to it is never surely there, even from the next step.
        const afterOrder = spec([
            n("order", "sales.order", { next: "end" }),
            n("end", "core.reply", { params: { note: { $ref: "steps.order.error.fields.missing" } } }),
        ])
        expect(codes(afterOrder)).toEqual(["REF_NOT_DOMINATOR@end.note"])
        const withDefault = { $ref: "steps.order.error.fields.missing", default: "" }
        expect(codes(graph({ params: { note: withDefault } }))).toEqual([])
        const other = graph({ params: { total: { $ref: "workflows.accounting.payment.steps.settle.output.totalVnd" } } })
        expect(codes(other)).toEqual(["REF_NOT_DOMINATOR@end.total"])
    })

    it("checks the legacy input bindings as refs to step outputs", () => {
        const legacy = graph({ input: { address: { $ref: "order.address" }, total: { $ref: "side.count" } } })
        expect(codes(legacy)).toEqual(["REF_NOT_DOMINATOR@end.total"])
    })

    it("words each problem from a catalog by its i18n key", () => {
        const [problem] = graphRefProblems(graph({ params: { note: { $ref: "steps.side.output.x" } } }), context)
        expect(problem?.messageKey).toBe("workflowRef.refNotDominator")
        expect(refMessageKeyOf("REF_TYPE_MISMATCH")).toBe("workflowRef.refTypeMismatch")
        expect(problem === undefined ? "" : refProblemText(problem, WORDS)).toBe(
            "end.note reads steps.side.output.x, but that step may not have run. Give it a default.",
        )
        expect(problem === undefined ? "" : refProblemText(problem, {})).toBe("workflowRef.refNotDominator")
    })

    it("lets a for-each body read item.* and outer dominators, and the steps after it only the loop's output", () => {
        const looped = spec([
            n("order", "sales.order", { next: "loop" }),
            n("loop", "core.for-each", {
                params: { items: { $ref: "steps.order.output.lines" } },
                routes: { body: "each" },
                next: "after",
            }),
            n("each", "core.reply", {
                params: {
                    note: { $ref: "item.sku" },
                    limit: { $ref: "item.$index" },
                    address: { $ref: "steps.order.output.address" },
                },
            }),
            n("after", "core.reply", {
                params: {
                    limit: { $ref: "steps.loop.output.okCount" },
                    note: { $ref: "steps.each.output.x", default: "" },
                    address: { $ref: "item.sku" },
                },
            }),
        ])
        expect(codes(looped)).toEqual(["REF_LOOP_BODY@after.note", "REF_ITEM_OUTSIDE_LOOP@after.address"])
        const wrongItem = spec([
            n("order", "sales.order", { next: "loop" }),
            n("loop", "core.for-each", { params: { items: { $ref: "steps.order.output.lines" } }, routes: { body: "each" } }),
            n("each", "core.reply", { params: { note: { $ref: "item.colour" } } }),
        ])
        expect(codes(wrongItem)).toEqual(["REF_FIELD_UNKNOWN@each.note"])
    })

    it("types out.* from the outcome step that dominates the reader, and the caller of the trigger", () => {
        const outcomes = new Map([["won", { address: "string" as const, items: "array" as const }]])
        const withOutcomes = { ...context, workflowOutcomes: outcomes }
        const ended = spec([
            n("order", "sales.order", { next: "won" }),
            n("won", "core.outcome", {
                params: { outcome: "won", outputs: { address: { $ref: "steps.order.output.address" } } },
                next: "call",
            }),
            n("call", "core.reply", {
                params: {
                    address: { $ref: "out.address" },
                    total: { $ref: "out.items" },
                    note: { $ref: "trigger.caller.workflow" },
                },
            }),
            n("stray", "core.reply", { params: { note: { $ref: "out.address" } } }),
        ])
        const found = graphRefProblems(ended, withOutcomes).map((problem) => `${problem.code}@${problem.nodeKey}.${problem.field}`)
        expect(found).toEqual(["REF_TYPE_MISMATCH@call.total", "REF_OUT_OUTSIDE_OUTCOME@stray.note"])
        const unknown = spec([n("won", "core.outcome", { params: { outcome: "lost", outputs: {} } })])
        expect(graphRefProblems(unknown, withOutcomes).map((problem) => problem.code)).toEqual(["OUTCOME_UNKNOWN"])
    })

    it("goes on by next after a plain step and by the branch's route after a step that branches; a branch with no route ends the run", () => {
        expect(nextKeyOf(n("order", "sales.order", { next: "has" }), { address: "x" })).toBe("has")
        const branching = n("has", "sales.has", { routes: { yes: "side" } })
        expect(nextKeyOf(branching, { branch: "yes" })).toBe("side")
        expect(nextKeyOf(branching, { branch: "no" })).toBeNull()
        expect(nextKeyOf(n("a", "core.reply"), {})).toBeNull()
    })
})
