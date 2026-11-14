import { Test } from "@nestjs/testing"
import type { IntentBusiness } from "@modules/domain/intent-contracts"
import { END, TRIGGER, nodeOf } from "@tests/fixtures/builders/agent-graph.builder"
import type { GraphDocument } from "../agent-graphs.contracts"
import { contractWarnings } from "./contract-problems.policy"

const SUBJECT = Symbol("contract-problems.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { contractWarnings } }],
    }).compile()
    return moduleRef.get<{ contractWarnings: typeof contractWarnings }>(SUBJECT)
}

const graphWith = (action: string, contracts: ReadonlyArray<IntentBusiness> = []): GraphDocument => ({
    nodes: [nodeOf({ ...TRIGGER, key: "start", next: ["act"] }), nodeOf({ key: "act", action, next: ["end"] }), END],
    contracts,
})

const business = (patch: Partial<IntentBusiness>): IntentBusiness => ({
    intent: "send_quote",
    task: "Quote the work.",
    limits: [],
    sources: [],
    ...patch,
})

describe("contractWarnings", () => {
    it("has none for a graph with no contracts block, so a shipped graph and a rollback still publish", async () => {
        const subject = await build()
        const shipped: GraphDocument = { nodes: graphWith("send_quote").nodes }

        expect(subject.contractWarnings(shipped)).toEqual([])
    })

    it("warns of a contract for an intent the graph does not hold and of one with no task", async () => {
        const subject = await build()
        const graph = graphWith("send_quote", [business({ intent: "give_discount" }), business({ task: "  " })])

        expect(subject.contractWarnings(graph)).toEqual([
            { code: "contract_unknown_intent", nodeKey: "", branchKey: null, detail: "give_discount" },
            { code: "contract_no_task", nodeKey: "", branchKey: null, detail: "send_quote" },
        ])
    })
})
