import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { DecisionsErrorCode, DecisionsService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import { ExecutionsService } from "@modules/domain/executions"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { DecisionsQueue } from "@modules/queues/decisions"
import { SalesDecisionsService } from "./sales-decisions.service"
import { SalesStatusService } from "./sales-status.service"

const member: WorkspaceMember = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "staff",
    staffId: "staff-2",
    displayName: "An",
    status: "active",
}

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "send_quote",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "waiting_decision",
    decided_path: null,
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "Quote", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: "staff-1",
    execution_id: null,
    origin: "live",
    created_at: "2026-10-12T09:00:00.000Z",
    updated_at: "2026-10-12T09:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

describe("SalesDecisionsService", () => {
    const build = async () => {
        const decisions = mock<DecisionsService>()
        decisions.getWorkItem.mockResolvedValue(itemOf())
        const members = mock<WorkspaceMembersService>()
        members.require.mockResolvedValue(member)
        const moduleRef = await Test.createTestingModule({
            providers: [
                SalesDecisionsService,
                { provide: PRIMARY_ENTITY_MANAGER, useValue: mockEntityManager() },
                { provide: WorkspaceMembersService, useValue: members },
                { provide: DecisionsService, useValue: decisions },
                { provide: ExecutionsService, useValue: mock<ExecutionsService>() },
                { provide: DecisionsQueue, useValue: mock<DecisionsQueue>() },
                { provide: SalesStatusService, useValue: mock<SalesStatusService>() },
            ],
        }).compile()
        return moduleRef.get(SalesDecisionsService)
    }

    it("refuses a decision from a staff member who is not the assignee", async () => {
        const service = await build()

        await expect(
            service.decideWorkItem("user-1", { workspaceId: "ws-1", locale: "vi", id: "item-1", decision: "approved" }),
        ).rejects.toMatchObject({ code: DecisionsErrorCode.NotAllowed })
    })
})
