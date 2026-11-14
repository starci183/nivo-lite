import { z } from "zod"
import { defineEffect, defineNode, defineTool, nodeIndexOf } from "../node"
import type { NodeDefinition } from "../node"
import { trusted } from "../schema/trusted"
import { templateGraphHash } from "../template"
import { nodeAccountRequestsOf } from "./graph-accounts"
import type { NodeAccountLookup } from "./graph-accounts"
import { graphSpecProblems } from "./graph-spec"
import { graphSpecSchema } from "./graph-spec.schema"
import type { GraphNodeAccount, GraphSpec } from "./graph-spec.types"

const send = defineEffect({ id: "channel.send", title: { key: "s" }, payload: z.object({}) })
const charge = defineTool({
    id: "bank.charge",
    title: { key: "c" },
    args: z.object({}),
    result: z.object({}),
    mutates: true,
})

const reply = trusted<NodeDefinition>(
    defineNode({
        id: "core.reply",
        title: { key: "t" },
        params: z.object({}),
        input: z.object({}),
        run: () => Promise.resolve(trusted<never>({})),
        role: "output",
        output: z.object({}),
        effects: ["channel.send"],
        tools: ["bank.charge"],
        examples: [{ name: "e", params: {}, input: {}, output: trusted<never>({}), effects: [] }],
    }),
)

const index = nodeIndexOf({ nodes: [reply], effects: [send], tools: [charge], dataKinds: [] })

const MESSAGING: GraphNodeAccount = {
    kind: "messaging",
    provider: null,
    connectionId: null,
    operations: { "channel.send": "auto" },
}

const BANK: GraphNodeAccount = {
    kind: "payment",
    provider: "sepay",
    connectionId: null,
    operations: { "bank.charge": "ask" },
}

const specOf = (accounts: ReadonlyArray<GraphNodeAccount> | undefined): GraphSpec => ({
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["channel"] },
    grant: { tools: ["bank.charge"], effects: ["channel.send"] },
    nodes: [
        {
            key: "say",
            kind: "output",
            step: "core.reply",
            next: "end",
            ...(accounts === undefined ? {} : { accounts }),
        },
        { key: "end", kind: "output", step: "stop" },
    ],
})

/** A host that knows two kinds and the bank's one provider. */
const HOST: NodeAccountLookup = {
    knows: (kind, provider) =>
        (kind === "messaging" && provider === null) ||
        (kind === "payment" && (provider === null || provider === "sepay")),
}

describe("the accounts a graph node asks for", () => {
    it("parses a node with accounts, a null provider and a null connection, and refuses an unknown member or mode", () => {
        expect(graphSpecSchema.parse(specOf([MESSAGING, BANK]))).toEqual(specOf([MESSAGING, BANK]))
        expect(graphSpecSchema.safeParse(specOf([trusted({ ...MESSAGING, extra: 1 })])).success).toBe(false)
        expect(
            graphSpecSchema.safeParse(specOf([trusted({ ...MESSAGING, operations: { "channel.send": "never" } })]))
                .success,
        ).toBe(false)
        expect(graphSpecSchema.safeParse(specOf([trusted({ ...MESSAGING, kind: "Messaging" })])).success).toBe(false)
    })

    it("leaves a graph that asks for no account exactly as it was: same parse, same hash, no problem", () => {
        const plain = specOf(undefined)
        const parsed = graphSpecSchema.parse(plain)
        expect(parsed).toEqual(plain)
        expect(parsed.nodes.every((node) => !("accounts" in node))).toBe(true)
        expect(templateGraphHash(parsed)).toBe(templateGraphHash(plain))
        expect(graphSpecProblems(plain, index)).toEqual([])
        expect(graphSpecProblems(plain, index, undefined, HOST)).toEqual([])
    })

    it("passes a node with accounts, and an empty list that asks for nothing", () => {
        expect(graphSpecProblems(specOf([MESSAGING, BANK]), index)).toEqual([])
        expect(graphSpecProblems(specOf([MESSAGING, BANK]), index, undefined, HOST)).toEqual([])
        expect(graphSpecProblems(specOf([]), index, undefined, HOST)).toEqual([])
    })

    it("names a second entry for one kind, provider and connection, and judges no operation of an entry", () => {
        const empty: GraphNodeAccount = { ...BANK, operations: {} }
        const stray = { ...MESSAGING, operations: { "nivo.tool.ledger.entry.append": "ask" } } as const
        expect(graphSpecProblems(specOf([MESSAGING, empty, MESSAGING]), index)).toEqual([
            { code: "NODE_ACCOUNT_DUPLICATE", at: "say.accounts.2" },
        ])
        expect(graphSpecProblems(specOf([stray]), index)).toEqual([])
        const bound: GraphNodeAccount = { ...MESSAGING, connectionId: "c1" }
        expect(graphSpecProblems(specOf([MESSAGING, bound]), index)).toEqual([])
    })

    it("names an unknown kind or a provider of another kind, only when the host told what it knows", () => {
        const odd: GraphNodeAccount = { ...MESSAGING, kind: "fax" }
        const misplaced: GraphNodeAccount = { ...MESSAGING, provider: "sepay" }
        expect(graphSpecProblems(specOf([odd, misplaced]), index)).toEqual([])
        expect(graphSpecProblems(specOf([odd, misplaced]), index, undefined, HOST)).toEqual([
            { code: "NODE_ACCOUNT_KIND_UNKNOWN", at: "say.accounts.0" },
            { code: "NODE_ACCOUNT_KIND_UNKNOWN", at: "say.accounts.1" },
        ])
    })

    it("lists the request as one row per node, account and operation", () => {
        expect(nodeAccountRequestsOf(specOf([MESSAGING, BANK]).nodes)).toEqual([
            {
                nodeKey: "say",
                kind: "messaging",
                provider: null,
                connectionId: null,
                operation: "channel.send",
                mode: "auto",
            },
            {
                nodeKey: "say",
                kind: "payment",
                provider: "sepay",
                connectionId: null,
                operation: "bank.charge",
                mode: "ask",
            },
        ])
        expect(nodeAccountRequestsOf(specOf(undefined).nodes)).toEqual([])
    })
})
