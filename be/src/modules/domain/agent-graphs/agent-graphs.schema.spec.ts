import { graphSpecJsonSchema, graphSpecSchema } from "@nivo-lite/agent-sdk/graph"
import { LEGACY_BRANCH_MODE_MEMBER } from "@nivo-lite/agent-sdk/template"
import { graphVocabulary } from "@modules/domain/intent-contracts"
import committed from "./agent-graph-spec.schema.json"
import { conditionSchema as condition, graphDocumentSchema as graph } from "./agent-graphs.schema"
import { snapshotHashOf } from "./policies/workflow-view.policy"

const node = (key: string) => ({
    key,
    kind: "output",
    step: "reply",
    title: "Reply",
    doneBy: "agent",
    knows: [],
    does: "Answers the customer",
    uses: [],
    reads: [],
    writes: [],
    approver: null,
    sources: [],
    none: [],
    next: [],
})

describe("agent-graphs.schema", () => {
    it("accepts a term and a nested group of terms, and refuses an unknown operator or a stray key", () => {
        expect(condition.safeParse({ fact: "amount", op: "gte", value: 5 }).success).toBe(true)
        expect(condition.safeParse({ fact: "kind", op: "in", value: ["a", "b"] }).success).toBe(true)
        expect(condition.safeParse({ fact: "amount", op: "known" }).success).toBe(true)
        expect(
            condition.safeParse({ all: [{ fact: "a", op: "eq", value: true }, { any: [{ fact: "b", op: "known" }] }] })
                .success,
        ).toBe(true)
        expect(condition.safeParse({ fact: "amount", op: "near", value: 5 }).success).toBe(false)
        expect(condition.safeParse({ fact: "amount", op: "known", extra: 1 }).success).toBe(false)
    })

    it("accepts a graph with nodes, refuses a node of an unknown kind or a graph with a stray key, and reads an old row that stored rights without them", () => {
        const legacy = [{ kind: "brain", scope: "workspace", hide: [], mask: [] }]

        expect(graph.safeParse({ nodes: [node("n1")] }).success).toBe(true)
        expect(graph.safeParse({ nodes: [{ ...node("n1"), kind: "other" }] }).success).toBe(false)
        expect(graph.safeParse({ nodes: [node("n1")], extra: 1 }).success).toBe(false)
        const old = graph.safeParse({ nodes: [node("n1")], rights: legacy })
        expect(old.success).toBe(true)
        expect(old.success && "rights" in old.data).toBe(false)
    })

    it("reads a deciding node with a branch, its approver and the sources of its words", () => {
        const group = { roles: ["owner"], rooms: [], members: [] }
        const branch = {
            key: "b1",
            when: "else",
            mode: "ask",
            next: "n2",
            approver: { group, policy: "any", timeoutMinutes: 60, onTimeout: { kind: "backup", group } },
            sources: [{ kind: "chat", messageId: "m1", quote: "ask me" }],
        }
        const deciding = {
            ...node("n1"),
            kind: "condition",
            decide: { intent: "pay", facts: ["amount"], branches: [branch] },
        }

        expect(graph.safeParse({ nodes: [deciding] }).success).toBe(true)
    })

    it("reads the target of a hand-over and the sources of money a trigger accepts, and refuses them past their bounds", () => {
        const handing = { ...node("n1"), action: "hand_over_conversation", handoverTo: "support" }
        const trigger = {
            ...node("n2"),
            kind: "trigger",
            step: "customer_message",
            triggerSources: ["sepay", "chat_text"],
        }

        expect(graph.safeParse({ nodes: [handing, trigger] }).success).toBe(true)
        expect(graph.safeParse({ nodes: [{ ...handing, handoverTo: "x".repeat(101) }] }).success).toBe(
            false,
        )
        expect(graph.safeParse({ nodes: [{ ...trigger, triggerSources: [""] }] }).success).toBe(false)
        expect(
            graph.safeParse({
                nodes: [{ ...trigger, triggerSources: Array.from({ length: 11 }, () => "sepay") }],
            }).success,
        ).toBe(false)
        expect(graph.safeParse({ nodes: [{ ...trigger, triggerSources: ["x".repeat(41)] }] }).success).toBe(
            false,
        )
    })
})

describe("agent-graphs.schema the contracts of a graph", () => {
    const contract = {
        intent: "reply_customer",
        task: "A deposit comes first.",
        limits: [
            {
                text: "Deposit is 30%.",
                triggers: ["customer_message"],
                trusts: ["outsider"],
                sources: [
                    { kind: "brain", factId: "f1", passage: "Deposit 30%", valueHash: "h" },
                    { kind: "chat", messageId: "m1", quote: "30% deposit" },
                    { kind: "owner", memberId: "boss" },
                ],
            },
        ],
        sources: [],
    }

    it("takes a graph with no contracts block and one with the business half of an intent", () => {
        expect(graph.safeParse({ nodes: [node("a")] }).success).toBe(true)
        expect(graph.safeParse({ nodes: [node("a")], contracts: [contract] }).success).toBe(true)
    })

    it("refuses a contract with a stray key, an unknown trigger, an empty limit or a source of a kind it does not know", () => {
        const refused = (patch: object) =>
            graph.safeParse({ nodes: [node("a")], contracts: [{ ...contract, ...patch }] }).success
        const limit = (patch: object) => ({ ...contract.limits[0], ...patch })

        expect(refused({ extra: 1 })).toBe(false)
        expect(refused({ limits: [limit({ triggers: [""] })] })).toBe(false)
        expect(refused({ limits: [limit({ text: "" })] })).toBe(false)
        expect(refused({ sources: [{ kind: "template", key: "k", version: 1 }] })).toBe(false)
        expect(refused({ task: "x".repeat(601) })).toBe(false)
    })

    it("reads the providers and steps from the vocabulary, so a plug-in provider is accepted only once it is registered", () => {
        const withProvider = { ...node("n1"), uses: [{ provider: "ghn", tool: null, scope: "read", label: "Ship" }] }

        expect(graph.safeParse({ nodes: [withProvider] }).success).toBe(false)

        graphVocabulary.add({ providers: ["ghn"] })

        expect(graph.safeParse({ nodes: [withProvider] }).success).toBe(true)
    })
})

/** The graph shapes the seed ships, each of which the node graph schema of a document must take. */
// No `burst` on the trigger: the time-window coalescing is deleted (no burst: one run per subject, the waiting events are the run's
// queue), and the strict schema refuses the member, so the seeded shape carries none.
const SEEDED = ["sales", "chatbot", "accounting"].map((moduleKey) => ({
    schema: "nivo/agent-graph@1",
    moduleKey,
    trigger: { kind: "tag", sources: ["channel", "agent"] },
    grant: { tools: [], effects: [] },
    nodes: [{ key: "end", kind: "output", step: "stop" }],
}))

describe("agent-graph-spec.schema.json", () => {
    it("is exactly the JSON Schema the SDK generates from graphSpecSchema, so the seed and the parser never disagree", () => {
        // Regenerate after a change of graphSpecSchema: write `graphSpecJsonSchema()` of @nivo-lite/agent-sdk/graph to this file.
        expect(committed).toEqual(graphSpecJsonSchema())
    })

    it("describes the seeded graphs, which the zod schema parses", () => {
        for (const spec of SEEDED) expect(graphSpecSchema.safeParse(spec).success).toBe(true)
        expect(committed).toMatchObject({ additionalProperties: false, title: "NIVO agent graph spec" })
    })
})

describe("agent-graphs.schema: a branch stored before its member was named mode", () => {
    const FLOW = {
        schema: "nivo/agent-graph@1",
        moduleKey: "sales",
        trigger: { kind: "tag", sources: ["channel"] },
        grant: { tools: [], effects: [] },
        nodes: [{ key: "end", kind: "output", step: "stop" }],
    }

    /** A branch as its entries, so the stored shape is built without writing an object that holds the legacy member. */
    const branchOf = (members: ReadonlyArray<readonly [string, string]>): unknown =>
        Object.fromEntries([["key", "b1"], ["when", "else"], ...members, ["next", "n2"], ["approver", null], ["sources", []]])

    const documentOf = (branch: unknown): unknown => ({
        nodes: [{ ...node("n1"), kind: "condition", decide: { intent: "pay", facts: ["amount"], branches: [branch] } }],
        flow: FLOW,
    })

    const STORED = documentOf(branchOf([[LEGACY_BRANCH_MODE_MEMBER, "ask"]]))
    const TODAY = documentOf(branchOf([["mode", "ask"]]))

    it("reads the stored branch exactly as the same graph written today, the legacy member gone", () => {
        const stored = graph.parse(STORED)
        expect(stored).toEqual(graph.parse(TODAY))
        expect(stored.nodes[0]?.decide?.branches[0]?.mode).toBe("ask")
        expect(JSON.stringify(stored)).not.toContain(`"${LEGACY_BRANCH_MODE_MEMBER}"`)
    })

    it("never rewrites what it read, and leaves the hash of the version's snapshot as it was", () => {
        const before = JSON.stringify(STORED)
        const stored = graph.parse(STORED)
        expect(JSON.stringify(STORED)).toBe(before)
        expect(stored.flow).toBeDefined()
        if (stored.flow === undefined) return
        expect(snapshotHashOf(stored.flow)).toBe(snapshotHashOf(graphSpecSchema.parse(FLOW)))
        const today = graph.parse(TODAY)
        expect(today.flow === undefined ? null : snapshotHashOf(today.flow)).toBe(snapshotHashOf(stored.flow))
    })

    it("refuses a branch that carries both members, one with neither, and a legacy member of a value mode does not take", () => {
        const both = branchOf([[LEGACY_BRANCH_MODE_MEMBER, "auto"], ["mode", "ask"]])
        expect(graph.safeParse(documentOf(both)).success).toBe(false)
        expect(graph.safeParse(documentOf(branchOf([]))).success).toBe(false)
        expect(graph.safeParse(documentOf(branchOf([[LEGACY_BRANCH_MODE_MEMBER, "later"]]))).success).toBe(false)
    })
})
