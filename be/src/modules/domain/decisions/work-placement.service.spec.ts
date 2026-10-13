import { FakeClock, builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { StaffDirectoryService } from "@modules/domain/staff"
import { WorkItemsService } from "@modules/domain/work-items"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { WorkItem } from "./decisions.contracts"
import { DecisionsService } from "./decisions.service"
import { DecisionsErrorCode } from "./errors/decisions.error"
import { EvidenceService } from "./evidence.service"
import { WorkPlacementService } from "./work-placement.service"

const memberOf = builder<WorkspaceMember>({
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "An",
    status: "active",
})

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "send_follow_up",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: null,
    depth: 0,
    status: "waiting_decision",
    decided_path: null,
    reason: "over_authority",
    reasons: ["over_authority"],
    missing_fields: [],
    proposal: { summary: "Send", fields: {} },
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

const build = async () => {
    const require = jest.fn().mockResolvedValue(memberOf())
    const getWorkItem = jest.fn().mockResolvedValue(itemOf())
    const log = jest.fn().mockResolvedValue(undefined)
    const holdItem = jest.fn().mockResolvedValue(true)
    const assignItem = jest.fn().mockResolvedValue(true)
    const namesOf = jest.fn().mockResolvedValue([{ id: "staff-1", name: "Binh" }])
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkPlacementService,
            {
                provide: MESSAGE_CATALOG,
                useValue: mock<MessageCatalog>({ get: jest.fn((key: string) => `${key}()`) }),
            },
            { provide: WorkspaceMembersService, useValue: mock<WorkspaceMembersService>({ require }) },
            { provide: DecisionsService, useValue: mock<DecisionsService>({ getWorkItem }) },
            { provide: EvidenceService, useValue: mock<EvidenceService>({ log }) },
            { provide: WorkItemsService, useValue: mock<WorkItemsService>({ hold: holdItem, assign: assignItem }) },
            { provide: StaffDirectoryService, useValue: mock<StaffDirectoryService>({ namesOf }) },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T10:00:00.000Z") },
        ],
    }).compile()
    return { service: moduleRef.get(WorkPlacementService), holdItem, assignItem, namesOf, log }
}

describe("WorkPlacementService", () => {
    describe("hold", () => {
        it("keeps a waiting item and records the note", async () => {
            const { service, holdItem, log } = await build()

            const result = await service.hold("user-1", "ws-1", {
                workItemId: "item-1",
                note: "  need  a receipt ",
                locale: "en",
            })

            expect(result.id).toBe("item-1")
            expect(holdItem).toHaveBeenCalledWith(
                "ws-1",
                "item-1",
                expect.objectContaining({
                    fields: { hold_note: "need a receipt", hold_by: "An", hold_at: "2026-10-12T10:00:00.000Z" },
                }),
            )
            expect(log).toHaveBeenCalled()
        })

        it("refuses an empty note", async () => {
            const { service, holdItem } = await build()

            await expect(
                service.hold("user-1", "ws-1", { workItemId: "item-1", note: "   ", locale: "en" }),
            ).rejects.toThrow(DecisionsErrorCode.HoldNoteRequired)
            expect(holdItem).not.toHaveBeenCalled()
        })
    })

    describe("assign", () => {
        it("names the staff member on the evidence", async () => {
            const { service, assignItem, log } = await build()

            await service.assign("user-1", "ws-1", { workItemId: "item-1", staffId: "staff-1", locale: "en" })

            expect(assignItem).toHaveBeenCalledWith("ws-1", "item-1", "staff-1")
            expect(log).toHaveBeenCalledWith(
                expect.objectContaining({ workspaceId: "ws-1" }),
                expect.objectContaining({ kind: "work.assigned", summary: "decision.assigned()" }),
            )
        })

        it("refuses a staff id the directory does not know", async () => {
            const { service, namesOf, assignItem } = await build()
            namesOf.mockResolvedValue([])

            await expect(
                service.assign("user-1", "ws-1", { workItemId: "item-1", staffId: "missing", locale: "en" }),
            ).rejects.toThrow(DecisionsErrorCode.StaffNotFound)
            expect(assignItem).not.toHaveBeenCalled()
        })
    })
})
