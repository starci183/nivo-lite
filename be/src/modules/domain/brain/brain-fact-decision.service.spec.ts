import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { FactRecord } from "@modules/domain/brain-facts"
import type { FactDecision } from "./brain.contracts"
import { BrainChangeMessagesService } from "./brain-change-messages.service"
import { BrainService } from "./brain.service"
import { BrainFactDecisionService } from "./brain-fact-decision.service"

const DECISION: FactDecision = { workspaceId: "ws-1", id: "f-1", action: "apply" }

const build = async () => {
    const brain = mock<BrainService>()
    const changes = mock<BrainChangeMessagesService>()
    const fact = mock<FactRecord>({ id: "f-1" })
    brain.decideFact.mockResolvedValue(fact)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainFactDecisionService,
            { provide: BrainService, useValue: brain },
            { provide: BrainChangeMessagesService, useValue: changes },
        ],
    }).compile()
    return { service: moduleRef.get(BrainFactDecisionService), brain, changes, fact }
}

describe("BrainFactDecisionService", () => {
    it("decides the fact for the caller, then keeps the open change card of that request in line with the decided fact", async () => {
        const { service, brain, changes, fact } = await build()
        const order: Array<string> = []
        brain.decideFact.mockImplementation(() => {
            order.push("decide")
            return Promise.resolve(fact)
        })
        changes.follow.mockImplementation(() => {
            order.push("follow")
            return Promise.resolve()
        })

        await expect(service.decide("user-1", DECISION)).resolves.toBe(fact)

        expect(brain.decideFact).toHaveBeenCalledWith("user-1", DECISION)
        expect(changes.follow).toHaveBeenCalledWith("ws-1", fact)
        expect(order).toEqual(["decide", "follow"])
    })

    it("follows nothing when the decision is refused", async () => {
        const { service, brain, changes } = await build()
        brain.decideFact.mockRejectedValue(new Error("forbidden"))

        await expect(service.decide("user-1", DECISION)).rejects.toThrow("forbidden")
        expect(changes.follow).not.toHaveBeenCalled()
    })
})
