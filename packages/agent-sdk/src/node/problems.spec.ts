import { z } from "zod"
import { defineDataKind, defineEffect } from "./effect"
import { defineNode } from "./node"
import type { NodeDefinition } from "./node.types"
import { branchesOf, graphNodeProblems, nodeIndexOf, nodeListProblems } from "./problems"
import { trusted } from "../schema/trusted"

const order = defineDataKind({ kind: "order", title: { key: "o" }, fields: z.object({ id: z.string().max(200) }) })
const message = defineDataKind({
    kind: "message",
    title: { key: "m" },
    fields: z.object({ body: z.string().max(200) }),
})
const send = defineEffect({ id: "channel.send", title: { key: "s" }, payload: z.object({}) })

const base = {
    title: { key: "t" },
    params: z.object({ limit: z.number() }),
    input: z.object({}),
    run: () => Promise.resolve(trusted<never>({ branch: "yes" })),
} as const

/** A condition hand-built with an effect, which defineNode refuses, so the list checks still see one. */
const pick = trusted<NodeDefinition>({
    ...defineNode({
        ...base,
        id: "order.pick",
        role: "condition",
        output: z.object({ branch: z.enum(["yes", "no"]) }),
        effects: [],
        examples: [{ name: "e", params: { limit: 1 }, input: {}, output: { branch: "yes" }, effects: [] }],
    }),
    effects: ["channel.send"],
})

const free = trusted<NodeDefinition>(
    defineNode({
        ...base,
        id: "order.free",
        role: "condition",
        output: z.object({ branch: z.string().max(200) }),
        effects: [],
        examples: [{ name: "e", params: { limit: 1 }, input: {}, output: { branch: "yes" }, effects: [] }],
    }),
)

const index = nodeIndexOf({ nodes: [pick, free], effects: [send], tools: [], dataKinds: [order, message] })
const grant = {}

describe("nodeListProblems", () => {
    it("is empty for a sound install", () => {
        expect(
            nodeListProblems({ nodes: [pick, free], effects: [send], tools: [], dataKinds: [order, message] }),
        ).toEqual([])
    })

    it("names duplicates; no data right is judged against the data kinds", () => {
        expect(
            nodeListProblems({
                nodes: [pick, pick],
                effects: [send, send],
                tools: [],
                dataKinds: [order, order],
            }),
        ).toEqual([
            { code: "NODE_DUPLICATE", at: "order.pick" },
            { code: "EFFECT_DUPLICATE", at: "channel.send" },
            { code: "DATA_KIND_DUPLICATE", at: "order" },
        ])
    })

    it("names an effect a node declares and nobody installed", () => {
        expect(nodeListProblems({ nodes: [pick], effects: [], tools: [], dataKinds: [order] })).toEqual([
            { code: "NODE_EFFECT_UNKNOWN", at: "order.pick:channel.send" },
        ])
    })
})

describe("branchesOf", () => {
    it("answers the options of an enum branch, null for free text or a non-object output", () => {
        expect(branchesOf(pick)).toEqual(["yes", "no"])
        expect(branchesOf(free)).toBeNull()
        expect(branchesOf({ ...free, output: z.string().max(200) })).toBeNull()
    })
})

describe("graphNodeProblems", () => {
    const ref = { key: "k", kind: "condition", step: "order.pick", params: { limit: 1 }, routes: { yes: "a", no: "b" } }

    it("leaves a built-in step alone and passes a sound node", () => {
        expect(graphNodeProblems({ key: "k", kind: "output", step: "reply" }, index, {})).toEqual([])
        expect(graphNodeProblems(ref, index, grant)).toEqual([])
        expect(graphNodeProblems({ ...ref, step: "order.free", routes: { any: "a" } }, index, {})).toEqual(
            [],
        )
    })

    it("names an unknown node", () => {
        expect(graphNodeProblems({ ...ref, step: "order.ghost" }, index, grant)).toEqual([
            { code: "NODE_UNKNOWN", at: "k" },
        ])
    })

    it("names a role mismatch, bad params and missing routes", () => {
        expect(graphNodeProblems({ key: "k", kind: "execute", step: "order.pick" }, index, {})).toEqual(
            [
                { code: "NODE_ROLE_MISMATCH", at: "k" },
                { code: "NODE_PARAMS_INVALID", at: "k" },
                { code: "NODE_ROUTE_MISSING", at: "k" },
            ],
        )
        expect(graphNodeProblems({ ...ref, step: "order.free", routes: {} }, index, grant)).toEqual([
            { code: "NODE_ROUTE_MISSING", at: "k" },
        ])
    })

    it("does not route an execute node", () => {
        const run = trusted<NodeDefinition>({ ...pick, id: "order.run", role: "execute", effects: ["order.ghost"] })
        const withRun = nodeIndexOf({ nodes: [run], effects: [], tools: [], dataKinds: [] })
        expect(
            graphNodeProblems({ key: "k", kind: "execute", step: "order.run", params: { limit: 1 } }, withRun, grant),
        ).toEqual([])
    })
})
