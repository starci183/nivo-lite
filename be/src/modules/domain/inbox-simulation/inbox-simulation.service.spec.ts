import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { InboundSimulationStoreService } from "@modules/domain/inbound-events"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { QUEUE_STATUS, type QueueStatusService } from "@modules/platform/queue"
import { DECISIONS_QUEUE, DecisionsJob, DecisionsQueue, decisionsDedupeKey } from "@modules/queues/decisions"
import { InboxSimulationService } from "./inbox-simulation.service"
import type { SimulationResultRow } from "./persistence/inbox-simulation.rows"
import { FIND_SIMULATION_RESULT } from "./persistence/inbox-simulation.sql"

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

const build = async () => {
    const entityManager = mockEntityManager({ query: [FIND_SIMULATION_RESULT, [ROW]] })
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(MEMBER)
    const queueStatus = mock<QueueStatusService>()
    queueStatus.status.mockResolvedValue({ id: "job-1", state: "done", attempts: 1 })
    const moduleRef = await Test.createTestingModule({
        providers: [
            InboxSimulationService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: InboundSimulationStoreService, useValue: mock<InboundSimulationStoreService>() },
            { provide: DecisionsQueue, useValue: mock<DecisionsQueue>() },
            { provide: QUEUE_STATUS, useValue: queueStatus },
        ],
    }).compile()
    return { service: moduleRef.get(InboxSimulationService), queueStatus }
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
})
