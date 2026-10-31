import { Test } from "@nestjs/testing"
import { OWNER_EXAMPLE, branchOf, graphOf, nodeOf } from "@tests/fixtures/builders/agent-graph.builder"
import type { GraphSource } from "../agent-graphs.contracts"
import { sourcesIndexOf } from "./sources-index.policy"

/** The members of the subject under test. */
interface Subject {
    readonly sourcesIndexOf: typeof sourcesIndexOf
}

const SUBJECT = Symbol("sources-index.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { sourcesIndexOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const BRAIN: GraphSource = { kind: "brain", factId: "fact-1", passage: "Over 5tr, ask Dinh", valueHash: "hash-1" }
const TEMPLATE: GraphSource = { kind: "template", key: "reminder", version: 3 }
const ALL: ReadonlyArray<GraphSource> = [
    BRAIN,
    TEMPLATE,
    { kind: "chat", messageId: "msg-1", quote: "above 5tr tell Dinh" },
    { kind: "learned", proposalId: "prop-1" },
    { kind: "owner", memberId: "boss" },
    { kind: "rule", action: "pay_supplier" },
]

describe("sources-index.policy", () => {
    it("indexes every kind of source by what names it, with the hash of a Brain value", async () => {
        const subject = await build()

        const rows = subject.sourcesIndexOf({ nodes: [nodeOf({ sources: ALL })], rights: [] })

        expect(rows.map((row) => [row.kind, row.ref, row.valueHash])).toEqual([
            ["brain", "fact-1", "hash-1"],
            ["template", "reminder", ""],
            ["chat", "msg-1", ""],
            ["learned", "prop-1", ""],
            ["owner", "boss", ""],
            ["rule", "pay_supplier", ""],
        ])
    })

    it("keys a source of a branch by the node and the branch, and a source of the node by the node alone", async () => {
        const subject = await build()
        const graph = graphOf([branchOf({ key: "small", sources: [BRAIN] }), ...OWNER_EXAMPLE.slice(1)])

        const rows = subject.sourcesIndexOf(graph)

        expect(rows.filter((row) => row.kind === "brain")).toEqual([
            { nodeKey: "decide", branchKey: "small", kind: "brain", ref: "fact-1", valueHash: "hash-1" },
        ])
        expect(rows.filter((row) => row.kind === "rule").every((row) => row.branchKey === "")).toBe(true)
    })

    it("lists a source once however often a node repeats it", async () => {
        const subject = await build()

        const rows = subject.sourcesIndexOf({ nodes: [nodeOf({ sources: [TEMPLATE, TEMPLATE] })], rights: [] })

        expect(rows).toHaveLength(1)
    })
})
