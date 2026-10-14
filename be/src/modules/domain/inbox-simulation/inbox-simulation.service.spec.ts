import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { InboundSimulationStoreService } from "@modules/domain/inbound-events"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { QUEUE_STATUS, type QueueStatusService } from "@modules/platform/queue"
import { DECISIONS_QUEUE, DecisionsJob, DecisionsQueue, decisionsDedupeKey } from "@modules/queues/decisions"
import { InboxSimulationService } from "./inbox-simulation.service"
import { InboxSimulationErrorCode } from "./errors/inbox-simulation.error"
import type { InboxSimulationInput } from "./inbox-simulation.contracts"
import type { SimulationResultRow } from "./persistence/inbox-simulation.rows"
import { FIND_SIMULATION_RESULT, NEW_SIMULATION_EVENT_ID } from "./persistence/inbox-simulation.sql"

const MEMBER: WorkspaceMember = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "An",
    status: "active",
}

const ROW: SimulationResultRow = {
    id: "event-row-1",
    event_id: "evt-1",
    duplicate_count: 0,
    amount_vnd: 1000,
    lead_id: "lead-1",
    status: "stored",
    work_id: null,
    work_department: null,
    work_status: null,
    queued_count: 0,
    failed_count: 0,
    waiting_count: 0,
}

const INPUT: InboxSimulationInput = {
    channel: "email",
    kind: "order",
    senderName: " Binh ",
    locale: "vi",
    eventId: " evt-1 ",
    items: " 2 boxes ",
}

const build = async () => {
    const entityManager = mockEntityManager({ query: [FIND_SIMULATION_RESULT, [ROW]] })
    const tx = fakeTransaction(entityManager)
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(MEMBER)
    const queueStatus = mock<QueueStatusService>()
    queueStatus.status.mockResolvedValue({ id: "job-1", state: "done", attempts: 1 })
    const store = mock<InboundSimulationStoreService>()
    store.record.mockResolvedValue({ inboundEventId: "event-row-1", duplicate: false })
    const decisions = mock<DecisionsQueue>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            InboxSimulationService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: InboundSimulationStoreService, useValue: store },
            { provide: DecisionsQueue, useValue: decisions },
            { provide: QUEUE_STATUS, useValue: queueStatus },
        ],
    }).compile()
    return { service: moduleRef.get(InboxSimulationService), entityManager, members, store, decisions, queueStatus, tx }
}

describe("InboxSimulationService", () => {
    it("reports a finished job as succeeded with the stored event and no work item", async () => {
        const { service, queueStatus } = await build()

        await expect(service.status("user-1", "ws-1", "event-row-1")).resolves.toEqual({
            id: "event-row-1",
            status: "succeeded",
            errorCode: null,
            event: {
                id: "event-row-1",
                eventId: "evt-1",
                duplicateCount: 0,
                amountVnd: 1000,
                leadId: "lead-1",
                status: "stored",
            },
            workItem: null,
        })

        expect(queueStatus.status).toHaveBeenCalledWith(
            "ws-1",
            DECISIONS_QUEUE,
            decisionsDedupeKey(DecisionsJob.SimulateInbound, "event-row-1"),
        )
    })

    it("records and enqueues a trimmed input in the same transaction", async () => {
        const { service, entityManager, members, store, decisions, queueStatus, tx } = await build()
        queueStatus.status.mockResolvedValue({ id: "job-1", state: "running", attempts: 1 })

        await expect(service.request("user-1", "ws-1", INPUT)).resolves.toEqual({
            id: "event-row-1",
            duplicate: false,
            status: "running",
        })

        const manager = store.record.mock.calls[0]?.[0]
        expect(entityManager.transaction).toHaveBeenCalledTimes(1)
        expect(manager).not.toBe(entityManager)
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(store.record).toHaveBeenCalledWith(manager, {
            workspaceId: "ws-1",
            channel: "email",
            kind: "order",
            origin: "simulated",
            senderName: "Binh",
            senderContact: null,
            body: "",
            amountVnd: null,
            externalRef: null,
            eventId: "evt-1",
        })
        expect(decisions.enqueueSimulateInbound).toHaveBeenCalledWith(
            {
                kind: "simulate_inbound",
                workspaceId: "ws-1",
                userId: "user-1",
                locale: "vi",
                inboundEventId: "event-row-1",
                items: "2 boxes",
            },
            manager,
        )
        expect(entityManager.query).not.toHaveBeenCalled()
        expect(tx.outcomes).toEqual(["commit"])
        expect(queueStatus.status).toHaveBeenCalledWith(
            "ws-1",
            DECISIONS_QUEUE,
            decisionsDedupeKey(DecisionsJob.SimulateInbound, "event-row-1"),
        )
    })

    it.each([undefined, null, " "])("generates an event identity when the supplied identity is %p", async (eventId) => {
        const { service, entityManager, store, decisions, queueStatus, tx } = await build()
        entityManager.query.mockResolvedValue([{ id: "generated-event" }])
        store.record.mockResolvedValue({ inboundEventId: "existing-row", duplicate: true })
        queueStatus.status.mockResolvedValue(null)

        await expect(service.request("user-1", "ws-1", { ...INPUT, eventId, items: undefined })).resolves.toEqual({
            id: "existing-row",
            duplicate: true,
            status: "queued",
        })

        expect(entityManager.query).toHaveBeenCalledWith(NEW_SIMULATION_EVENT_ID)
        expect(store.record).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ eventId: "generated-event" }),
        )
        expect(decisions.enqueueSimulateInbound).toHaveBeenCalledWith(
            {
                kind: "simulate_inbound",
                workspaceId: "ws-1",
                userId: "user-1",
                locale: "vi",
                inboundEventId: "existing-row",
                items: "",
            },
            store.record.mock.calls[0]?.[0],
        )
        expect(tx.outcomes).toEqual(["commit"])
    })

    it("rolls back when the database cannot generate an event identity", async () => {
        const { service, entityManager, store, decisions, queueStatus, tx } = await build()
        entityManager.query.mockResolvedValue([])

        await expect(service.request("user-1", "ws-1", { ...INPUT, eventId: null })).rejects.toMatchObject({
            code: InboxSimulationErrorCode.Invalid,
        })

        expect(entityManager.query).toHaveBeenCalledWith(NEW_SIMULATION_EVENT_ID)
        expect(store.record).not.toHaveBeenCalled()
        expect(decisions.enqueueSimulateInbound).not.toHaveBeenCalled()
        expect(queueStatus.status).not.toHaveBeenCalled()
        expect(tx.outcomes).toEqual(["rollback"])
    })

    it("requires membership before recording a request", async () => {
        const { service, members, store, decisions, tx } = await build()
        const refusal = { code: "WORKSPACE_MEMBER_REQUIRED" }
        members.require.mockRejectedValue(refusal)

        await expect(service.request("user-1", "ws-1", INPUT)).rejects.toBe(refusal)

        expect(store.record).not.toHaveBeenCalled()
        expect(decisions.enqueueSimulateInbound).not.toHaveBeenCalled()
        expect(tx.outcomes).toEqual([])
    })

    it("refuses a status read for an event that does not belong to this workspace", async () => {
        const { service, entityManager, members, queueStatus } = await build()
        entityManager.query.mockResolvedValue([])

        await expect(service.status("user-1", "ws-1", "missing")).rejects.toMatchObject({
            code: InboxSimulationErrorCode.NotFound,
        })

        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(entityManager.query).toHaveBeenCalledWith(FIND_SIMULATION_RESULT, ["ws-1", "missing"])
        expect(queueStatus.status).not.toHaveBeenCalled()
    })

    it("reports failed work and supplies empty strings for nullable persisted fields", async () => {
        const { service, entityManager } = await build()
        entityManager.query.mockResolvedValue([
            { ...ROW, event_id: null, work_id: "work-1", work_department: null, work_status: null, failed_count: 1 },
        ])

        await expect(service.status("user-1", "ws-1", "event-row-1")).resolves.toEqual({
            id: "event-row-1",
            status: "failed",
            errorCode: "INBOX_SIMULATION_FAILED",
            event: {
                id: "event-row-1",
                eventId: "",
                duplicateCount: 0,
                amountVnd: 1000,
                leadId: "lead-1",
                status: "stored",
            },
            workItem: { id: "work-1", department: "", status: "" },
        })
    })

    it("returns the persisted first work item while an absent job is treated as queued", async () => {
        const { service, entityManager, queueStatus } = await build()
        entityManager.query.mockResolvedValue([
            { ...ROW, work_id: "work-1", work_department: "sales", work_status: "waiting_decision" },
        ])
        queueStatus.status.mockResolvedValue(null)

        await expect(service.status("user-1", "ws-1", "event-row-1")).resolves.toEqual({
            id: "event-row-1",
            status: "queued",
            errorCode: null,
            event: {
                id: "event-row-1",
                eventId: "evt-1",
                duplicateCount: 0,
                amountVnd: 1000,
                leadId: "lead-1",
                status: "stored",
            },
            workItem: { id: "work-1", department: "sales", status: "waiting_decision" },
        })
    })
})
