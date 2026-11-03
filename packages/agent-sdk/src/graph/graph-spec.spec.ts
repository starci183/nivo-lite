import { z } from "zod"
import { defineEffect, defineNode, defineTool, nodeIndexOf } from "../node"
import type { NodeDefinition } from "../node"
import type { DataRight } from "../rights/rights.types"
import { edgesOf, graphSpecProblems, nextKeyOf } from "./graph-spec"
import { graphSpecSchema } from "./graph-spec.schema"
import type { GraphSpec } from "./graph-spec.types"

const READ: DataRight = { kind: "order", access: "read", scope: "turn", fields: ["id"] }
const SEND: DataRight = { kind: "message", access: "write", scope: "turn", fields: ["body"] }

const send = defineEffect({ id: "channel.send", title: { key: "s" }, payload: z.object({}), rights: [SEND] })
const look = defineTool({
    id: "order.look",
    title: { key: "l" },
    args: z.object({}),
    result: z.object({}),
    mutates: false,
    rights: [],
})

const base = { title: { key: "t" }, params: z.object({}), input: z.object({}), run: () => Promise.resolve({} as never) }
const example = { name: "e", params: {}, input: {}, output: {} as never, effects: [] }

const check = defineNode({
    ...base,
    id: "order.check",
    role: "condition",
    output: z.object({ branch: z.enum(["yes", "no"]) }),
    rights: [READ],
    effects: [],
    tools: ["order.look"],
    examples: [example],
}) as unknown as NodeDefinition

const reply = defineNode({
    ...base,
    id: "core.reply",
    role: "output",
    output: z.object({}),
    rights: [],
    effects: ["channel.send"],
    examples: [example],
}) as unknown as NodeDefinition

const index = nodeIndexOf({ nodes: [check, reply], effects: [send], tools: [look], dataKinds: [] })

const SPEC: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["channel"] },
    grant: { rights: [READ, SEND], tools: ["order.look"], effects: ["channel.send"] },
    nodes: [
        { key: "check", kind: "condition", step: "order.check", routes: { yes: "say", no: "say-no" } },
        { key: "say", kind: "output", step: "core.reply", input: { at: { $ref: "check.branch" }, text: { $ref: "trigger.text" } } },
        { key: "say-no", kind: "output", step: "core.reply", next: "end" },
        { key: "end", kind: "output", step: "stop" },
    ],
}

describe("graphSpecSchema", () => {
    it("takes a spec with nested bindings and refuses an unknown member", () => {
        const nested = { ...SPEC, nodes: [{ ...SPEC.nodes[0], input: { a: { b: [{ $ref: "trigger.x" }, 1, null, true] } } }] }
        expect(graphSpecSchema.safeParse(nested).success).toBe(true)
        expect(graphSpecSchema.safeParse({ ...SPEC, extra: 1 }).success).toBe(false)
    })
})

describe("graph spec walking", () => {
    it("lists the edges of a node and picks the next key from the branch of a condition", () => {
        const [first, second] = SPEC.nodes
        expect(edgesOf({ ...second!, next: "x" })).toEqual(["x"])
        expect(edgesOf(first!)).toEqual(["say", "say-no"])
        expect(nextKeyOf(first!, { branch: "no" })).toBe("say-no")
        expect(nextKeyOf(first!, { branch: "maybe" })).toBeNull()
        expect(nextKeyOf(first!, null)).toBeNull()
        expect(nextKeyOf(first!, { branch: 1 })).toBeNull()
        expect(nextKeyOf(second!, {})).toBeNull()
        expect(nextKeyOf({ ...second!, next: "x" }, {})).toBe("x")
    })
})

describe("graphSpecProblems", () => {
    it("passes a sound spec", () => {
        expect(graphSpecProblems(SPEC, index)).toEqual([])
    })

    it("names duplicates, edges to nowhere, unreachable nodes and references that are not upstream", () => {
        const spec: GraphSpec = {
            ...SPEC,
            nodes: [
                { ...SPEC.nodes[0]!, routes: { yes: "say", no: "ghost" } },
                { key: "say", kind: "output", step: "core.reply", input: { x: { $ref: "lost.x" } } },
                { key: "say", kind: "output", step: "core.reply" },
                { key: "lost", kind: "output", step: "core.reply" },
            ],
        }
        expect(graphSpecProblems(spec, index)).toEqual([
            { code: "GRAPH_NODE_DUPLICATE", at: "say" },
            { code: "GRAPH_TARGET_UNKNOWN", at: "check->ghost" },
            { code: "GRAPH_NODE_UNREACHABLE", at: "lost" },
            { code: "GRAPH_REF_NOT_UPSTREAM", at: "say<-lost" },
        ])
    })

    it("names an uninstalled step and judges no minimum while one is missing", () => {
        const spec: GraphSpec = { ...SPEC, grant: { ...SPEC.grant, effects: [] }, nodes: [{ key: "a", kind: "output", step: "reply" }] }
        expect(graphSpecProblems(spec, index)).toEqual([{ code: "NODE_UNKNOWN", at: "a" }])
    })

    it("names a grant that holds more than the nodes need, or lists fewer effects and tools than they use", () => {
        const spec: GraphSpec = {
            ...SPEC,
            grant: {
                rights: [{ ...READ, fields: ["id", "secret"] }, SEND],
                tools: ["order.spare"],
                effects: ["order.spare"],
            },
        }
        expect(graphSpecProblems(spec, index)).toEqual([
            { code: "NODE_RIGHTS_UNGRANTED", at: "check" },
            { code: "GRAPH_GRANT_EXCESS", at: "order:read.secret" },
            { code: "GRAPH_GRANT_EXCESS", at: "order.spare" },
            { code: "GRAPH_GRANT_EXCESS", at: "order.spare" },
            { code: "GRAPH_EFFECTS_MISMATCH", at: "channel.send" },
            { code: "GRAPH_TOOLS_MISMATCH", at: "order.look" },
        ])
    })

    it("needs no right for an effect or tool the app did not install", () => {
        const bare = nodeIndexOf({ nodes: [check, reply], effects: [], tools: [], dataKinds: [] })
        const spec: GraphSpec = { ...SPEC, grant: { rights: [READ], tools: ["order.look"], effects: ["channel.send"] } }
        expect(graphSpecProblems(spec, bare)).toEqual([])
    })

    it("names a compensable node a pivot can reach, which could never be undone", () => {
        const undo = defineEffect({ id: "order.void", title: { key: "v" }, payload: z.object({ id: z.string() }), rights: [] })
        const record = defineEffect({ ...undo, id: "order.record", compensation: "order.void" })
        const keep = defineNode({ ...base, id: "order.keep", role: "output", output: z.object({}), rights: [], effects: ["order.record"], examples: [example] }) as unknown as NodeDefinition
        const saga = nodeIndexOf({ nodes: [keep, reply], effects: [send, undo, record], tools: [], dataKinds: [] })
        const spec: GraphSpec = {
            ...SPEC,
            grant: { rights: [SEND], tools: [], effects: ["order.record", "channel.send"] },
            nodes: [
                { key: "keep", kind: "output", step: "order.keep", next: "say" },
                { key: "say", kind: "output", step: "core.reply", next: "again" },
                { key: "again", kind: "output", step: "order.keep", next: "end" },
                { key: "end", kind: "output", step: "stop" },
            ],
        }
        expect(graphSpecProblems(spec, saga)).toEqual([{ code: "GRAPH_COMPENSABLE_AFTER_PIVOT", at: "again" }])
        expect(graphSpecProblems({ ...spec, nodes: [...spec.nodes.slice(0, 2), { key: "again", kind: "output", step: "order.gone" }] }, saga)).toEqual([
            { code: "NODE_UNKNOWN", at: "again" },
        ])
    })

    it("judges nothing reachable in an empty spec", () => {
        expect(graphSpecProblems({ ...SPEC, nodes: [] }, index)).toEqual([
            { code: "GRAPH_GRANT_EXCESS", at: "order:read.id" },
            { code: "GRAPH_GRANT_EXCESS", at: "message:write.body" },
            { code: "GRAPH_GRANT_EXCESS", at: "channel.send" },
            { code: "GRAPH_GRANT_EXCESS", at: "order.look" },
        ])
    })
})
