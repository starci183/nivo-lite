import { Test } from "@nestjs/testing"
import type { IntentBusiness } from "@modules/domain/intent-contracts"
import { OWNER_EXAMPLE, graphOf } from "@tests/fixtures/builders/agent-graph.builder"
import { applyContract } from "./contract-patch.policy"

const SUBJECT = Symbol("contract-patch.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { applyContract } }],
    }).compile()
    return moduleRef.get<{ applyContract: typeof applyContract }>(SUBJECT)
}

const business = (patch: Partial<IntentBusiness> = {}): IntentBusiness => ({
    intent: "pay_supplier",
    task: "Pay a supplier from the statement.",
    limits: [],
    sources: [],
    ...patch,
})

describe("applyContract", () => {
    it("adds the contract of an intent the graph had none for", async () => {
        const subject = await build()
        const graph = graphOf(OWNER_EXAMPLE)

        const next = subject.applyContract(graph, business())

        expect(next?.contracts).toEqual([business()])
        expect(next?.nodes).toBe(graph.nodes)
    })

    it("replaces the contract the graph had for the intent and keeps the others", async () => {
        const subject = await build()
        const other = business({ intent: "send_quote", task: "Quote." })
        const graph = { ...graphOf(OWNER_EXAMPLE), contracts: [other, business({ task: "Old." })] }

        const next = subject.applyContract(graph, business())

        expect(next?.contracts).toEqual([other, business()])
    })

    it("is nothing when the graph already holds exactly that contract", async () => {
        const subject = await build()
        const graph = { ...graphOf(OWNER_EXAMPLE), contracts: [business()] }

        expect(subject.applyContract(graph, business())).toBeNull()
    })
})
