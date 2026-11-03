import { z } from "zod"
import type { DataRight } from "../rights/rights.types"
import { defineDataKind, defineEffect } from "./effect"
import { defineNode } from "./node"
import type { NodeDefinition } from "./node.types"
import { branchesOf, graphNodeProblems, nodeIndexOf, nodeListProblems } from "./problems"

const READ: DataRight = { kind: "order", access: "read", scope: "turn", fields: ["id"] }
const SEND: DataRight = { kind: "message", access: "write", scope: "turn", fields: ["body"] }

const order = defineDataKind({ kind: "order", title: { key: "o" }, fields: z.object({ id: z.string() }) })
const message = defineDataKind({ kind: "message", title: { key: "m" }, fields: z.object({ body: z.string() }) })
const send = defineEffect({ id: "channel.send", title: { key: "s" }, payload: z.object({}), rights: [SEND] })

const base = {
    title: { key: "t" },
    params: z.object({ limit: z.number() }),
    input: z.object({}),
    run: () => Promise.resolve({ branch: "yes" } as never),
} as const

/** A condition hand-built with an effect, which defineNode refuses, so the list checks still see one. */
const pick = {
    ...defineNode({
        ...base,
        id: "order.pick",
        role: "condition",
        output: z.object({ branch: z.enum(["yes", "no"]) }),
        rights: [READ],
        effects: [],
        examples: [{ name: "e", params: { limit: 1 }, input: {}, output: { branch: "yes" }, effects: [] }],
    }),
    effects: ["channel.send"],
} as unknown as NodeDefinition

const free = defineNode({
    ...base,
    id: "order.free",
    role: "condition",
    output: z.object({ branch: z.string() }),
    rights: [],
    effects: [],
    examples: [{ name: "e", params: { limit: 1 }, input: {}, output: { branch: "yes" }, effects: [] }],
}) as unknown as NodeDefinition

const index = nodeIndexOf({ nodes: [pick, free], effects: [send], tools: [], dataKinds: [order, message] })
const grant = { rights: [READ, SEND] }

describe("nodeListProblems", () => {
    it("is empty for a sound install", () => {
        expect(nodeListProblems({ nodes: [pick, free], effects: [send], tools: [], dataKinds: [order, message] })).toEqual([])
    })

    it("names duplicates, unknown effects, unknown kinds and unknown fields", () => {
        const rights: ReadonlyArray<DataRight> = [{ ...READ, fields: ["id", "secret"] }, { ...READ, kind: "ghost" }]
        const wide = { ...pick, rights }
        expect(
            nodeListProblems({ nodes: [pick, pick, wide], effects: [send, send], tools: [], dataKinds: [order, order] }),
        ).toEqual([
            { code: "NODE_DUPLICATE", at: "order.pick" },
            { code: "EFFECT_DUPLICATE", at: "channel.send" },
            { code: "DATA_KIND_DUPLICATE", at: "order" },
            { code: "RIGHT_FIELD_UNKNOWN", at: "order.pick:order.secret" },
            { code: "RIGHT_KIND_UNKNOWN", at: "order.pick:ghost" },
            { code: "RIGHT_KIND_UNKNOWN", at: "channel.send:message" },
            { code: "RIGHT_KIND_UNKNOWN", at: "channel.send:message" },
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
        expect(branchesOf({ ...free, output: z.string() })).toBeNull()
    })
})

describe("graphNodeProblems", () => {
    const ref = { key: "k", kind: "condition", step: "order.pick", params: { limit: 1 }, routes: { yes: "a", no: "b" } }

    it("leaves a built-in step alone and passes a sound node", () => {
        expect(graphNodeProblems({ key: "k", kind: "output", step: "reply" }, index, { rights: [] })).toEqual([])
        expect(graphNodeProblems(ref, index, grant)).toEqual([])
        expect(graphNodeProblems({ ...ref, step: "order.free", routes: { any: "a" } }, index, { rights: [] })).toEqual([])
    })

    it("names an unknown node", () => {
        expect(graphNodeProblems({ ...ref, step: "order.ghost" }, index, grant)).toEqual([
            { code: "NODE_UNKNOWN", at: "k" },
        ])
    })

    it("names a role mismatch, bad params, missing routes and an ungranted right", () => {
        expect(graphNodeProblems({ key: "k", kind: "execute", step: "order.pick" }, index, { rights: [READ] })).toEqual([
            { code: "NODE_ROLE_MISMATCH", at: "k" },
            { code: "NODE_PARAMS_INVALID", at: "k" },
            { code: "NODE_ROUTE_MISSING", at: "k" },
            { code: "NODE_RIGHTS_UNGRANTED", at: "k" },
        ])
        expect(graphNodeProblems({ ...ref, step: "order.free", routes: {} }, index, grant)).toEqual([
            { code: "NODE_ROUTE_MISSING", at: "k" },
        ])
    })

    it("does not route an execute node, and counts an uninstalled effect as no right", () => {
        const run = { ...pick, id: "order.run", role: "execute", effects: ["order.ghost"] } as unknown as NodeDefinition
        const withRun = nodeIndexOf({ nodes: [run], effects: [], tools: [], dataKinds: [] })
        expect(graphNodeProblems({ key: "k", kind: "execute", step: "order.run", params: { limit: 1 } }, withRun, grant)).toEqual(
            [],
        )
    })
})
