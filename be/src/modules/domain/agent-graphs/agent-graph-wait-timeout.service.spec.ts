import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
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
    path: [],
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
    return { service: container.get(AgentGraphWaitTimeoutService), asks, decisions }
}

describe("AgentGraphWaitTimeoutService.expire", () => {
    it("ends a wait whose item has no open decision or no request", async () => {
        const none = await build([null])
        const closed = await build([decision({ closed: true })])
        const bare = await build([decision({ approvalRequestId: null })])

        await expect(none.service.expire("ws-1", "item-1")).resolves.toEqual({ kind: "ended" })
        await expect(closed.service.expire("ws-1", "item-1")).resolves.toEqual({ kind: "ended" })
        await expect(bare.service.expire("ws-1", "item-1")).resolves.toEqual({ kind: "ended" })
        expect(none.asks.ended).not.toHaveBeenCalled()
    })

    it("runs the ask road of an expired request and ends the wait when the branch settled it", async () => {
        const { service, asks } = await build([decision(), decision({ closed: true })])

        await expect(service.expire("ws-1", "item-1")).resolves.toEqual({ kind: "ended" })

        expect(asks.ended).toHaveBeenCalledWith({ workspaceId: "ws-1", requestId: "req-1", outcome: "expired" })
    })

    it("renews the wait a day on when the branch asked a backup group, and ends it when the decision is gone", async () => {
        const backup = await build([decision(), decision()])
        const gone = await build([decision(), null])

        await expect(backup.service.expire("ws-1", "item-1")).resolves.toEqual({
            kind: "renewed",
            deadlineAt: new Date("2026-11-02T10:00:00.000Z"),
        })
        await expect(gone.service.expire("ws-1", "item-1")).resolves.toEqual({ kind: "ended" })
    })
})

describe("AgentGraphWaitTimeoutService.expire in an owner transaction", () => {
    it("reads and expires the request through the caller manager before renewing the backup wait", async () => {
        const manager = mockEntityManager()
        const { service, asks, decisions } = await build([decision(), decision()])

        await expect(service.expire("ws-1", "item-1", manager)).resolves.toEqual({
            kind: "renewed",
            deadlineAt: new Date("2026-11-02T10:00:00.000Z"),
        })
        expect(decisions.byItem.mock.calls).toEqual([
            ["ws-1", "item-1", manager],
            ["ws-1", "item-1", manager],
        ])
        expect(asks.ended).toHaveBeenCalledWith(
            { workspaceId: "ws-1", requestId: "req-1", outcome: "expired" },
            manager,
        )
    })

    it.each([null, decision({ closed: true })])(
        "ends a wait whose reread is settled in the caller transaction",
        async (after) => {
            const manager = mockEntityManager()
            const { service, decisions } = await build([decision(), after])

            await expect(service.expire("ws-1", "item-1", manager)).resolves.toEqual({ kind: "ended" })
            expect(decisions.byItem.mock.calls).toEqual([
                ["ws-1", "item-1", manager],
                ["ws-1", "item-1", manager],
            ])
        },
    )
})
