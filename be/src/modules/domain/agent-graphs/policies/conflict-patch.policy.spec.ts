import { Test } from "@nestjs/testing"
import { OWNER_EXAMPLE, graphOf } from "@tests/fixtures/builders/agent-graph.builder"
import type { GraphDocument, GraphSource } from "../agent-graphs.contracts"
import { applyConflict } from "./conflict-patch.policy"

/** The members of the subject under test. */
interface Subject {
    readonly applyConflict: typeof applyConflict
}

const SUBJECT = Symbol("conflict-patch.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { applyConflict } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const OLD: GraphSource = { kind: "brain", factId: "fact-1", passage: "Under 5M", valueHash: "hash-1" }
const PATCH = { oldFactId: "fact-1", newFactId: "fact-2", newValueHash: "hash-2" }

const citing = (source: GraphSource): GraphDocument => {
    const base = graphOf(OWNER_EXAMPLE)
    return {
        ...base,
        nodes: base.nodes.map((node) =>
            node.decide === undefined
                ? { ...node, sources: [source] }
                : {
                      ...node,
                      decide: {
                          ...node.decide,
                          branches: node.decide.branches.map((branch) => ({ ...branch, sources: [source] })),
                      },
                  },
        ),
    }
}

describe("conflict-patch.policy", () => {
    it("makes every node and branch that cited the replaced rule cite the rule in force, with its words", async () => {
        const subject = await build()

        const swapped = subject.applyConflict(citing(OLD), PATCH, "Under 10M")

        const text = JSON.stringify(swapped)
        expect(text).toContain('"factId":"fact-2"')
        expect(text).toContain("Under 10M")
        expect(text).toContain("hash-2")
        expect(text).not.toContain("fact-1")
    })

    it("changes no boundary and no person: only the rule behind them", async () => {
        const subject = await build()
        const before = citing(OLD)

        const swapped = subject.applyConflict(before, PATCH, "Under 10M")

        const strip = (document: GraphDocument | null): string =>
            JSON.stringify(document).replace(/"sources":\[[^\]]*\]/g, "")
        expect(strip(swapped)).toBe(strip(before))
    })

    it("leaves a rule of another fact alone and answers null when no node cites the replaced one", async () => {
        const subject = await build()
        const other: GraphSource = { kind: "brain", factId: "fact-9", passage: "Other", valueHash: "h" }

        expect(subject.applyConflict(citing(other), PATCH, "Under 10M")).toBeNull()
        expect(subject.applyConflict(graphOf(OWNER_EXAMPLE), PATCH, "Under 10M")).toBeNull()
    })
})
