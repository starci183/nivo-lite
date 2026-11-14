import { z } from "zod"
import { defineEffect, defineNode, defineTool, nodeIndexOf } from "../node"
import type { NodeDefinition } from "../node"
import { edgesOf, graphSpecJsonSchema, graphSpecProblems, nextKeyOf } from "./graph-spec"
import { graphSpecSchema } from "./graph-spec.schema"
import type { GraphSpec } from "./graph-spec.types"
import { trusted } from "../schema/trusted"
import { present } from "../schema/present"

const send = defineEffect({ id: "channel.send", title: { key: "s" }, payload: z.object({}) })
const look = defineTool({
    id: "order.look",
    title: { key: "l" },
    args: z.object({}),
    result: z.object({}),
    mutates: false,
})

const base = {
    title: { key: "t" },
    params: z.object({}),
    input: z.object({}),
    run: () => Promise.resolve(trusted<never>({})),
}
const example = { name: "e", params: {}, input: {}, output: trusted<never>({}), effects: [] }

const check = trusted<NodeDefinition>(
    defineNode({
        ...base,
        id: "order.check",
        role: "condition",
        output: z.object({ branch: z.enum(["yes", "no"]) }),
        effects: [],
        tools: ["order.look"],
        examples: [example],
    }),
)

const reply = trusted<NodeDefinition>(
    defineNode({
        ...base,
        id: "core.reply",
        role: "output",
        output: z.object({}),
        effects: ["channel.send"],
        examples: [example],
    }),
)

const index = nodeIndexOf({ nodes: [check, reply], effects: [send], tools: [look], dataKinds: [] })

const SPEC: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["channel"] },
    grant: { tools: ["order.look"], effects: ["channel.send"] },
    nodes: [
        { key: "check", kind: "condition", step: "order.check", routes: { yes: "say", no: "say-no" } },
        {
            key: "say",
            kind: "output",
            step: "core.reply",
            input: { at: { $ref: "check.branch" }, text: { $ref: "trigger.text" } },
        },
        { key: "say-no", kind: "output", step: "core.reply", next: "end" },
        { key: "end", kind: "output", step: "stop" },
    ],
}

describe("graphSpecSchema", () => {
    it("takes a spec with nested bindings and refuses an unknown member", () => {
        const nested = {
            ...SPEC,
            nodes: [{ ...SPEC.nodes[0], input: { a: { b: [{ $ref: "trigger.x" }, 1, null, true] } } }],
        }
        expect(graphSpecSchema.safeParse(nested).success).toBe(true)
        expect(graphSpecSchema.safeParse({ ...SPEC, extra: 1 }).success).toBe(false)
    })

    it("drops the data rights of a grant stored before they were deleted, and still parses it", () => {
        const stored = {
            ...SPEC,
            grant: { ...SPEC.grant, rights: [{ kind: "order", access: "read", scope: "turn", fields: ["id"] }] },
        }

        expect(graphSpecSchema.parse(stored)).toEqual(SPEC)
        expect(graphSpecSchema.safeParse({ ...SPEC, grant: { ...SPEC.grant, extra: 1 } }).success).toBe(false)
    })
})

describe("graph spec walking", () => {
    it("lists the edges of a node and picks the next key from the branch of a condition", () => {
        const [first, second] = SPEC.nodes
        expect(edgesOf({ ...present(second), next: "x" })).toEqual(["x"])
        expect(edgesOf(present(first))).toEqual(["say", "say-no"])
        expect(nextKeyOf(present(first), { branch: "no" })).toBe("say-no")
        expect(nextKeyOf(present(first), { branch: "maybe" })).toBeNull()
        expect(nextKeyOf(present(first), null)).toBeNull()
        expect(nextKeyOf(present(first), { branch: 1 })).toBeNull()
        expect(nextKeyOf(present(second), {})).toBeNull()
        expect(nextKeyOf({ ...present(second), next: "x" }, {})).toBe("x")
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
                { ...present(SPEC.nodes[0]), routes: { yes: "say", no: "ghost" } },
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
        const spec: GraphSpec = {
            ...SPEC,
            grant: { ...SPEC.grant, effects: [] },
            nodes: [{ key: "a", kind: "output", step: "reply" }],
        }
        expect(graphSpecProblems(spec, index)).toEqual([{ code: "NODE_UNKNOWN", at: "a" }])
    })

    it("names a grant that holds more than the nodes need, or lists fewer effects and tools than they use", () => {
        const spec: GraphSpec = {
            ...SPEC,
            grant: {
                tools: ["order.spare"],
                effects: ["order.spare"],
            },
        }
        expect(graphSpecProblems(spec, index)).toEqual([
            { code: "NODE_TOOLS_UNGRANTED", at: "check" },
            { code: "GRAPH_GRANT_EXCESS", at: "order.spare" },
            { code: "GRAPH_GRANT_EXCESS", at: "order.spare" },
            { code: "GRAPH_EFFECTS_MISMATCH", at: "channel.send" },
            { code: "GRAPH_TOOLS_MISMATCH", at: "order.look" },
        ])
    })

    it("judges the grant by name only, for an effect or tool the app did not install too", () => {
        const bare = nodeIndexOf({ nodes: [check, reply], effects: [], tools: [], dataKinds: [] })
        const spec: GraphSpec = { ...SPEC, grant: { tools: ["order.look"], effects: ["channel.send"] } }
        expect(graphSpecProblems(spec, bare)).toEqual([])
    })

    it("judges nothing reachable in an empty spec", () => {
        expect(graphSpecProblems({ ...SPEC, nodes: [] }, index)).toEqual([
            { code: "GRAPH_GRANT_EXCESS", at: "channel.send" },
            { code: "GRAPH_GRANT_EXCESS", at: "order.look" },
        ])
    })
})

// Design change (R27/R28): the @1 envelope's `trigger.burst` and `graph-burst.ts` are deleted: the engine settles a burst from the
// trigger declaration only (Opus-1c); the schema refuses the old member.
describe("graph spec burst", () => {
    it("refuses the deleted trigger.burst member", () => {
        const spec = { ...trusted<Record<string, unknown>>(SPEC) }
        const trigger = { kind: "tag", sources: ["channel"], burst: { channel: { window: "6s" } } }
        expect(graphSpecSchema.safeParse({ ...spec, trigger }).success).toBe(false)
        expect(graphSpecSchema.safeParse({ ...spec, trigger: { kind: "tag", sources: ["channel"] } }).success).toBe(true)
    })
})

describe("graphSpecJsonSchema", () => {
    it("is the JSON Schema of the zod schema, titled and closed to unknown members", () => {
        expect(graphSpecJsonSchema()).toMatchObject({ additionalProperties: false, title: "NIVO agent graph spec" })
    })
})
