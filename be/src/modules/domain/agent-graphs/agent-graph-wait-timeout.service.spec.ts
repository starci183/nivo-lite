import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { AgentGraphAsksService } from "./agent-graph-asks.service"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import type { DecisionView } from "./agent-graph-decisions.service"
import { AgentGraphWaitTimeoutService } from "./agent-graph-wait-timeout.service"

const NOW = "2026-11-01T10:00:00.000Z"

const decision = (over: Partial<DecisionView> = {}): DecisionView => ({
    id: "d-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    workItemId: "item-1",
    versionId: "v-1",
    action: "refund",
    branchKey: "big",
    amount: 100,
    approvalRequestId: "req-1",
    closed: false,
    ...over,
})

const build = async (reads: ReadonlyArray<DecisionView | null>) => {
    const decisions = mock<AgentGraphDecisionsService>()
    reads.forEach((read) => decisions.byItem.mockResolvedValueOnce(read))
    const asks = mock<AgentGraphAsksService>({ ended: jest.fn().mockResolvedValue(undefined) })
    const container = await Test.createTestingModule({
        providers: [
            AgentGraphWaitTimeoutService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: AgentGraphDecisionsService, useValue: decisions },
            { provide: AgentGraphAsksService, useValue: asks },
        ],
    }).compile()
    return { service: container.get(AgentGraphWaitTimeoutService), asks }
}

describe("AgentGraphWaitTimeoutService.expire", () => {
    it("ends a wait whose item has no open decision or no request", async () => {
        const none = await build([null])
        const closed = await build([decision({ closed: true })])
        const bare = await build([decision({ approvalRequestId: null })])

        await expect(none.service.expire("item-1")).resolves.toEqual({ kind: "ended" })
        await expect(closed.service.expire("item-1")).resolves.toEqual({ kind: "ended" })
        await expect(bare.service.expire("item-1")).resolves.toEqual({ kind: "ended" })
        expect(none.asks.ended).not.toHaveBeenCalled()
    })

    it("runs the ask road of an expired request and ends the wait when the branch settled it", async () => {
        const { service, asks } = await build([decision(), decision({ closed: true })])

        await expect(service.expire("item-1")).resolves.toEqual({ kind: "ended" })

        expect(asks.ended).toHaveBeenCalledWith({ requestId: "req-1", outcome: "expired" })
    })

    it("renews the wait a day on when the branch asked a backup group, and ends it when the decision is gone", async () => {
        const backup = await build([decision(), decision()])
        const gone = await build([decision(), null])

        await expect(backup.service.expire("item-1")).resolves.toEqual({
            kind: "renewed",
            deadlineAt: new Date("2026-11-02T10:00:00.000Z"),
        })
        await expect(gone.service.expire("item-1")).resolves.toEqual({ kind: "ended" })
    })
})
