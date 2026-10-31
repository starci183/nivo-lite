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
})
