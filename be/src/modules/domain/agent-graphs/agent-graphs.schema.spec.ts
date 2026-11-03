import { graphVocabulary } from "@modules/domain/intent-contracts"
import { conditionSchema as condition, graphDocumentSchema as graph } from "./agent-graphs.schema"

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

    it("accepts a graph with nodes and rights, and refuses a node of an unknown kind or a graph with a stray key", () => {
        const rights = [{ kind: "brain", scope: "workspace", hide: [], mask: [] }]

        expect(graph.safeParse({ nodes: [node("n1")], rights }).success).toBe(true)
        expect(graph.safeParse({ nodes: [{ ...node("n1"), kind: "other" }], rights }).success).toBe(false)
        expect(graph.safeParse({ nodes: [node("n1")], rights, extra: 1 }).success).toBe(false)
    })

    it("reads a deciding node with a branch, its approver and the sources of its words", () => {
        const group = { roles: ["owner"], rooms: [], members: [] }
        const branch = {
            key: "b1",
            when: "else",
            then: "ask",
            next: "n2",
            approver: { group, policy: "any", timeoutMinutes: 60, onTimeout: { kind: "backup", group } },
            sources: [{ kind: "chat", messageId: "m1", quote: "ask me" }],
        }
        const deciding = {
            ...node("n1"),
            kind: "condition",
            decide: { intent: "pay", facts: ["amount"], branches: [branch] },
        }

        expect(graph.safeParse({ nodes: [deciding], rights: [] }).success).toBe(true)
    })

    it("reads the target of a hand-over and the sources of money a trigger accepts, and refuses them past their bounds", () => {
        const handing = { ...node("n1"), action: "hand_over_conversation", handoverTo: "support" }
        const trigger = {
            ...node("n2"),
            kind: "trigger",
            step: "customer_message",
            triggerSources: ["sepay", "chat_text"],
        }

        expect(graph.safeParse({ nodes: [handing, trigger], rights: [] }).success).toBe(true)
        expect(graph.safeParse({ nodes: [{ ...handing, handoverTo: "x".repeat(101) }], rights: [] }).success).toBe(
            false,
        )
        expect(graph.safeParse({ nodes: [{ ...trigger, triggerSources: [""] }], rights: [] }).success).toBe(false)
        expect(
            graph.safeParse({
                nodes: [{ ...trigger, triggerSources: Array.from({ length: 11 }, () => "sepay") }],
                rights: [],
            }).success,
        ).toBe(false)
        expect(graph.safeParse({ nodes: [{ ...trigger, triggerSources: ["x".repeat(41)] }], rights: [] }).success).toBe(
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
        expect(graph.safeParse({ nodes: [node("a")], rights: [] }).success).toBe(true)
        expect(graph.safeParse({ nodes: [node("a")], rights: [], contracts: [contract] }).success).toBe(true)
    })

    it("refuses a contract with a stray key, an unknown trigger, an empty limit or a source of a kind it does not know", () => {
        const refused = (patch: object) =>
            graph.safeParse({ nodes: [node("a")], rights: [], contracts: [{ ...contract, ...patch }] }).success
        const limit = (patch: object) => ({ ...contract.limits[0], ...patch })

        expect(refused({ extra: 1 })).toBe(false)
        expect(refused({ limits: [limit({ triggers: [""] })] })).toBe(false)
        expect(refused({ limits: [limit({ text: "" })] })).toBe(false)
        expect(refused({ sources: [{ kind: "template", key: "k", version: 1 }] })).toBe(false)
        expect(refused({ task: "x".repeat(601) })).toBe(false)
    })

    it("reads the providers and steps from the vocabulary, so a plug-in provider is accepted only once it is registered", () => {
        const withProvider = { ...node("n1"), uses: [{ provider: "ghn", tool: null, scope: "read", label: "Ship" }] }

        expect(graph.safeParse({ nodes: [withProvider], rights: [] }).success).toBe(false)

        graphVocabulary.add({ providers: ["ghn"] })

        expect(graph.safeParse({ nodes: [withProvider], rights: [] }).success).toBe(true)
    })
})
