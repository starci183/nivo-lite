import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { DecisionsErrorCode, DecisionsService, EvidenceService, WorkEngineService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import { InvoicesService } from "@modules/domain/invoices"
import { OrdersService } from "@modules/domain/orders"
import { WorkItemsService } from "@modules/domain/work-items"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { DecisionsQueue } from "@modules/queues/decisions"
import { SalesStatusService } from "./sales-status.service"
import { SalesWorkService } from "./sales-work.service"

const member: WorkspaceMember = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "Lan",
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
    status: "queued",
    decided_path: null,
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "Quote", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: "2026-10-12T09:00:00.000Z",
    updated_at: "2026-10-12T09:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

describe("SalesWorkService", () => {
    const build = async () => {
        const decisions = mock<DecisionsService>()
        decisions.getWorkItem.mockResolvedValue(itemOf())
        const members = mock<WorkspaceMembersService>()
        members.require.mockResolvedValue(member)
        const moduleRef = await Test.createTestingModule({
            providers: [
                SalesWorkService,
                { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>() },
                { provide: PRIMARY_ENTITY_MANAGER, useValue: mockEntityManager() },
                { provide: WorkspaceMembersService, useValue: members },
                { provide: DecisionsService, useValue: decisions },
                { provide: WorkItemsService, useValue: mock<WorkItemsService>() },
                { provide: OrdersService, useValue: mock<OrdersService>() },
                { provide: InvoicesService, useValue: mock<InvoicesService>() },
                { provide: WorkEngineService, useValue: mock<WorkEngineService>() },
                { provide: EvidenceService, useValue: mock<EvidenceService>() },
                { provide: DecisionsQueue, useValue: mock<DecisionsQueue>() },
                { provide: SalesStatusService, useValue: mock<SalesStatusService>() },
            ],
        }).compile()
        return moduleRef.get(SalesWorkService)
    }

    it("refuses to retry an item that has not failed", async () => {
        const service = await build()

        await expect(
            service.retry("user-1", { workspaceId: "ws-1", locale: "vi", id: "item-1" }),
        ).rejects.toMatchObject({ code: DecisionsErrorCode.NotFailed })
    })
})
