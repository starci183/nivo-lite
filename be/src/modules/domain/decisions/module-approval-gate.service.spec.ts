import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { ModuleApprovalRequest } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { WorkItem } from "./decisions.contracts"
import { DecisionsError, DecisionsErrorCode } from "./errors/decisions.error"
import { ModuleApprovalGateService } from "./module-approval-gate.service"
import { FIND_WORK_ITEM_VIEW } from "./persistence/work-item-views.sql"
import { WorkEngineService } from "./work-engine.service"

const MEMBER_ID = "11111111-1111-4111-8111-111111111111"

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "inventory",
    action: "send_purchase_order",
    subject_type: "purchase_order",
    subject_id: "po-1",
    lead_id: null,
    inbound_event_id: null,
    parent_id: null,
    chain_id: null,
    depth: 0,
    status: "waiting_decision",
    decided_path: null,
    reason: "over_authority",
    reasons: ["over_authority"],
    missing_fields: [],
    proposal: { summary: "PO", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: "2026-10-12T10:00:00.000Z",
    updated_at: "2026-10-12T10:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

const memberOf = builder<WorkspaceMember>({
    userId: MEMBER_ID,
    workspaceId: "ws-1",
    role: "staff",
    staffId: null,
    displayName: "Chi",
    status: "active",
})

const request: ModuleApprovalRequest = {
    workspaceId: "ws-1",
    actor: "NIVO",
    action: "screen_candidate",
    subjectType: "candidate",
    subjectId: "cand-1",
    dedupeKey: "screen_candidate:cand-1",
    summary: "Screen",
    draft: "notes",
    fields: { candidate_id: "cand-1", urgent: true },
}

const setup = async (
    engine: Partial<WorkEngineService>,
    rows: ReadonlyArray<WorkItem> = [],
): Promise<ModuleApprovalGateService> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            ModuleApprovalGateService,
            { provide: WorkEngineService, useValue: mock<WorkEngineService>(engine) },
            {
                provide: WorkspaceMembersService,
                useValue: mock<WorkspaceMembersService>({ require: jest.fn().mockResolvedValue(memberOf()) }),
            },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: mockEntityManager({ query: [FIND_WORK_ITEM_VIEW, rows] }) },
        ],
    }).compile()
    return moduleRef.get(ModuleApprovalGateService)
}

describe("ModuleApprovalGateService", () => {
    it("runs a module request as a preset work item and answers its status", async () => {
        const runWork = jest.fn().mockResolvedValue(itemOf({ status: "done" }))
        const subject = await setup({ runWork })

        await expect(subject.request(request)).resolves.toEqual({ status: "done", workItemId: "item-1" })

        expect(runWork).toHaveBeenCalledWith(
            { workspaceId: "ws-1", actor: "NIVO", locale: "vi" },
            {
                action: "screen_candidate",
                subject_type: "inbound",
                subject_id: "cand-1",
                dedupeKey: "screen_candidate:cand-1",
                origin: "live",
                preset: true,
                seed: { summary: "Screen", draft: "notes", fields: { candidate_id: "cand-1", urgent: "true" } },
            },
        )
    })

    it("resumes the item as the member a user id names", async () => {
        const resumeWork = jest.fn().mockResolvedValue(itemOf({ status: "rejected" }))
        const subject = await setup({ resumeWork })

        await expect(
            subject.decide({ workspaceId: "ws-1", workItemId: "item-1", decision: "rejected", decidedBy: MEMBER_ID }),
        ).resolves.toEqual({ status: "rejected", workItemId: "item-1" })

        expect(resumeWork).toHaveBeenCalledWith(
            expect.anything(),
            "item-1",
            "rejected",
            {},
            {
                name: "Chi",
                kind: "staff",
            },
        )
    })

    it("answers the current status of an item no longer waiting", async () => {
        const resumeWork = jest.fn().mockRejectedValue(new DecisionsError({ code: DecisionsErrorCode.NotWaiting }))
        const subject = await setup({ resumeWork }, [itemOf({ status: "done" })])

        await expect(
            subject.decide({ workspaceId: "ws-1", workItemId: "item-1", decision: "rejected", decidedBy: MEMBER_ID }),
        ).resolves.toEqual({ status: "done", workItemId: "item-1" })
    })
})
