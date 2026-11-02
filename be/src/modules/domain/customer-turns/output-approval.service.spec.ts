import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { AgentRunsService } from "@modules/domain/agent-runs"
import { DurableWorkService, WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext, WorkItem, WorkSpec } from "@modules/domain/decisions"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { CLOCK } from "@modules/platform/clock"
import type { OutputApprovalWait } from "./output-approval.contracts"
import { OutputApprovalService } from "./output-approval.service"

const CTX: WorkContext = { workspaceId: "ws-1", actor: "OpenClaw", locale: "en" }
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)
const SPEC: WorkSpec = { action: "gateway_call", subject_type: "conversation", dedupeKey: "call-1" }
const WAIT: OutputApprovalWait = {
    wakeId: "wake-1",
    calls: [{ tool: "crm.order.place", argsJson: '{"sku":"a"}' }],
    scope: {
        conversationId: "c1",
        messageId: "m1",
        approvedBy: null,
        workItemId: null,
        planned: "Place the order",
        declined: false,
        outputNode: "write",
        approvalNode: "approval",
        replyNode: "reply",
    },
}

const build = async () => {
    const em = mockEntityManager()
    const tx = fakeTransaction(em)
    const item = mock<WorkItem>({ id: "work-1", workspace_id: "ws-1", status: "queued" })
    const durable = mock<DurableWorkService>({ enqueueWork: jest.fn().mockResolvedValue(item) })
    const runs = mock<AgentRunsService>({ waitOn: jest.fn().mockResolvedValue(undefined) })
    const engine = mock<WorkEngineService>({
        runWork: jest.fn().mockResolvedValue(item),
        runQueuedItem: jest.fn(() => {
            expect(tx.commits).toBe(1)
            return Promise.resolve({ ...item, status: "waiting_decision" } satisfies WorkItem)
        }),
    })
    const container = await Test.createTestingModule({
        providers: [
            OutputApprovalService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(new Date("2026-11-01T00:00:00.000Z")) },
            { provide: DurableWorkService, useValue: durable },
            { provide: AgentRunsService, useValue: runs },
            { provide: WorkEngineService, useValue: engine },
        ],
    }).compile()
    return { service: container.get(OutputApprovalService), tx, durable, runs, engine, item }
}

describe("OutputApprovalService", () => {
    it("commits the queued item and complete wait in one transaction before exposing approval", async () => {
        const { service, durable, runs, engine, tx } = await build()
        await expect(service.ask(CTX, { spec: SPEC, wait: WAIT })).resolves.toMatchObject({
            status: "waiting_decision",
        })
        const manager = durable.enqueueWork.mock.calls[0]?.[2]
        expect(runs.waitOn).toHaveBeenCalledWith(manager, {
            workspaceId: "ws-1",
            wakeId: "wake-1",
            workItemId: "work-1",
            deadlineAt: new Date("2026-11-04T00:00:00.000Z"),
            spec: objectLike({
                stepKey: "approval:work-1",
                nodeKey: "approval",
                kind: "approval",
                input: {
                    workItemId: "work-1",
                    deadlineAt: "2026-11-04T00:00:00.000Z",
                    calls: WAIT.calls,
                    scope: WAIT.scope,
                },
            }),
        })
        expect(tx.commits).toBe(1)
        expect(engine.runQueuedItem).toHaveBeenCalledWith(CTX, "work-1")
        expect(engine.runWork).not.toHaveBeenCalled()
    })

    it("rolls admission back and exposes no approval when wait registration fails", async () => {
        const { service, runs, engine, tx } = await build()
        runs.waitOn.mockRejectedValueOnce(new Error("wait unavailable"))
        await expect(service.ask(CTX, { spec: SPEC, wait: WAIT })).rejects.toThrow("wait unavailable")
        expect(tx.rollbacks).toBe(1)
        expect(tx.commits).toBe(0)
        expect(engine.runQueuedItem).not.toHaveBeenCalled()
    })

    it("writes no wait when durable admission fails", async () => {
        const { service, durable, runs, engine, tx } = await build()
        durable.enqueueWork.mockRejectedValueOnce(new Error("admission unavailable"))
        await expect(service.ask(CTX, { spec: SPEC, wait: WAIT })).rejects.toThrow("admission unavailable")
        expect(tx.rollbacks).toBe(1)
        expect(runs.waitOn).not.toHaveBeenCalled()
        expect(engine.runQueuedItem).not.toHaveBeenCalled()
    })

    it("keeps the durable item when another worker already claimed it after commit", async () => {
        const { service, engine, item } = await build()
        engine.runQueuedItem.mockResolvedValueOnce(null)
        await expect(service.ask(CTX, { spec: SPEC, wait: WAIT })).resolves.toBe(item)
    })

    it("leaves the legacy road to the existing engine without opening a transaction", async () => {
        const { service, engine, durable, runs, tx, item } = await build()
        await expect(service.ask(CTX, { spec: SPEC, wait: null })).resolves.toBe(item)
        expect(engine.runWork).toHaveBeenCalledWith(CTX, SPEC)
        expect(durable.enqueueWork).not.toHaveBeenCalled()
        expect(runs.waitOn).not.toHaveBeenCalled()
        expect(tx.commits).toBe(0)
    })
})
