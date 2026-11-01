import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentRunItemClosedService } from "./agent-run-item-closed.service"
import type { StepDecision } from "./agent-runs.contracts"
import { AgentRunsService } from "./agent-runs.service"

const build = async () => {
    const em = mockEntityManager()
    const tx = fakeTransaction(em)
    const verdicts: Array<string> = []
    const runs = mock<AgentRunsService>({
        resumeWaiting: jest.fn((_tx: unknown, itemId: string, decision: StepDecision) => {
            verdicts.push(`${itemId}:${String(decision.approved)}:${decision.by}`)
            return Promise.resolve(true)
        }),
    })
    const container = await Test.createTestingModule({
        providers: [
            AgentRunItemClosedService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: AgentRunsService, useValue: runs },
        ],
    }).compile()
    return { service: container.get(AgentRunItemClosedService), verdicts, tx }
}

describe("AgentRunItemClosedService.closed", () => {
    it("finishes the wait on the item with the verdict and the person, in a transaction of its own", async () => {
        const { service, verdicts, tx } = await build()

        await service.closed("ws-1", "item-1", "approved", "member-1")
        await service.closed("ws-1", "item-2", "rejected", "member-2")

        expect(verdicts).toEqual(["item-1:true:member-1", "item-2:false:member-2"])
        expect(tx.commits).toBe(2)
    })
})
