import { Test } from "@nestjs/testing"
import type { GraphEvidence } from "@modules/domain/work-items"
import { OWNER_EXAMPLE, graphOf, nodeOf } from "@tests/fixtures/builders/agent-graph.builder"
import { evidenceAccepted } from "./evidence.policy"

/** The members of the subject under test. */
interface Subject {
    readonly evidenceAccepted: typeof evidenceAccepted
}

const SUBJECT = Symbol("evidence.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { evidenceAccepted } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const claim: GraphEvidence = { key: "amount_vnd", value: 300_000, kind: "claimed", via: "chat_text" }
const image: GraphEvidence = { key: "amount_vnd", value: 450_000, kind: "claimed", via: "chat_image" }
const feed: GraphEvidence = { key: "amount_vnd", value: 500_000, kind: "received", via: "sepay" }

/** The graph of the owner example with a trigger that accepts only the sources named, or every source when none is. */
const graphAccepting = (sources: ReadonlyArray<string> | undefined) => {
    const base = graphOf(OWNER_EXAMPLE)
    return {
        ...base,
        nodes: base.nodes.map((node) =>
            node.kind === "trigger" ? nodeOf({ ...node, triggerSources: sources }) : node,
        ),
    }
}

describe("evidence.policy evidenceAccepted", () => {
    it("keeps only the entries whose road a trigger of the graph chooses", async () => {
        const subject = await build()

        expect(subject.evidenceAccepted(graphAccepting(["chat_text", "chat_image"]), [claim, image, feed])).toEqual([
            claim,
            image,
        ])
        expect(subject.evidenceAccepted(graphAccepting(["sepay"]), [claim, image])).toEqual([])
    })

    it("counts every road when no trigger chose, whether the setting is unset or empty", async () => {
        const subject = await build()
        const evidence = [claim, feed]

        expect(subject.evidenceAccepted(graphAccepting(undefined), evidence)).toBe(evidence)
        expect(subject.evidenceAccepted(graphAccepting([]), evidence)).toBe(evidence)
    })

    it("passes an undefined list on as it is", async () => {
        const subject = await build()

        expect(subject.evidenceAccepted(graphAccepting(["sepay"]), undefined)).toBeUndefined()
        expect(subject.evidenceAccepted(graphAccepting(undefined), undefined)).toBeUndefined()
    })

    it("reads the choice of the trigger nodes only, so another node cannot narrow it", async () => {
        const subject = await build()
        const base = graphOf(OWNER_EXAMPLE)
        const stray = {
            ...base,
            nodes: base.nodes.map((node) =>
                node.kind === "trigger" ? node : nodeOf({ ...node, triggerSources: ["sepay"] }),
            ),
        }
        const withoutTrigger = { ...base, nodes: base.nodes.filter((node) => node.kind !== "trigger") }

        expect(subject.evidenceAccepted(stray, [claim, feed])).toEqual([claim, feed])
        expect(subject.evidenceAccepted(withoutTrigger, [claim])).toEqual([claim])
    })
})
