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
    created_at: "2026-10-12T10:00:00.000Z",
    updated_at: "2026-10-12T10:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

const build = async (member: WorkspaceMember = memberOf()) => {
    const require = jest.fn().mockResolvedValue(member)
    const getWorkItem = jest.fn().mockResolvedValue(itemOf())
    const log = jest.fn().mockResolvedValue(undefined)
    const holdItem = jest.fn().mockResolvedValue(true)
    const assignItem = jest.fn().mockResolvedValue(true)
    const namesOf = jest.fn().mockResolvedValue([{ id: "staff-1", name: "Binh" }])
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => `${key}()`) })
    const members = mock<WorkspaceMembersService>({ require })
    const decisions = mock<DecisionsService>({ getWorkItem })
    const evidence = mock<EvidenceService>({ log })
    const items = mock<WorkItemsService>({ hold: holdItem, assign: assignItem })
    const staff = mock<StaffDirectoryService>({ namesOf })
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkPlacementService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: DecisionsService, useValue: decisions },
            { provide: EvidenceService, useValue: evidence },
            { provide: WorkItemsService, useValue: items },
            { provide: StaffDirectoryService, useValue: staff },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T10:00:00.000Z") },
        ],
    }).compile()
    return {
        service: moduleRef.get(WorkPlacementService),
        holdItem,
        assignItem,
        namesOf,
        log,
        getWorkItem,
        require,
        catalog,
    }
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

        it("refuses staff holding an item assigned to someone else", async () => {
            const { service, getWorkItem, holdItem, log } = await build(memberOf({ role: "staff", staffId: "staff-1" }))
            getWorkItem.mockResolvedValue(itemOf({ assigned_staff_id: "staff-2" }))

            await expect(
                service.hold("user-1", "ws-1", { workItemId: "item-1", note: "Need receipt", locale: "en" }),
            ).rejects.toMatchObject({ code: DecisionsErrorCode.NotAllowed })

            expect(holdItem).not.toHaveBeenCalled()
            expect(log).not.toHaveBeenCalled()
        })

        it("refuses to hold work that has already finished", async () => {
            const { service, getWorkItem, holdItem, log } = await build()
            getWorkItem.mockResolvedValue(itemOf({ status: "done" }))

            await expect(
                service.hold("user-1", "ws-1", { workItemId: "item-1", note: "Need receipt", locale: "en" }),
            ).rejects.toMatchObject({ code: DecisionsErrorCode.NotWaiting })

            expect(holdItem).not.toHaveBeenCalled()
            expect(log).not.toHaveBeenCalled()
        })

        it("refuses a hold when the item stops waiting before it is saved", async () => {
            const { service, holdItem, log, getWorkItem } = await build()
            holdItem.mockResolvedValue(false)

            await expect(
                service.hold("user-1", "ws-1", { workItemId: "item-1", note: "Need receipt", locale: "en" }),
            ).rejects.toMatchObject({ code: DecisionsErrorCode.NotWaiting })

            expect(holdItem).toHaveBeenCalledWith("ws-1", "item-1", {
                summary: "Send",
                fields: { hold_note: "Need receipt", hold_by: "An", hold_at: "2026-10-12T10:00:00.000Z" },
            })
            expect(log).not.toHaveBeenCalled()
            expect(getWorkItem).toHaveBeenCalledTimes(1)
        })
    })
})

describe("WorkPlacementService", () => {
    describe("hold", () => {
        it("lets assigned staff hold the work, preserves its fields and returns the refreshed item", async () => {
            const { service, getWorkItem, holdItem, log, catalog } = await build(
                memberOf({ role: "staff", staffId: "staff-1", displayName: "Binh" }),
            )
            const item = itemOf({
                assigned_staff_id: "staff-1",
                proposal: { summary: "Send", fields: { draft: "quote" } },
            })
            const refreshed = itemOf({
                assigned_staff_id: "staff-1",
                proposal: {
                    summary: "Send",
                    fields: {
                        draft: "quote",
                        hold_note: "Need a receipt",
                        hold_by: "Binh",
                        hold_at: "2026-10-12T10:00:00.000Z",
                    },
                },
            })
            getWorkItem.mockResolvedValueOnce(item).mockResolvedValueOnce(refreshed)

            await expect(
                service.hold("user-1", "ws-1", { workItemId: "item-1", note: " Need\n a\t receipt ", locale: "vi" }),
            ).resolves.toEqual(refreshed)

            expect(holdItem).toHaveBeenCalledWith("ws-1", "item-1", refreshed.proposal)
            expect(catalog.get).toHaveBeenCalledWith("decision.holdEvidence", { note: "Need a receipt" }, "vi")
            expect(log).toHaveBeenCalledWith(
                { workspaceId: "ws-1", actor: "Binh", locale: "vi" },
                {
                    lead_id: "lead-1",
                    work_item_id: "item-1",
                    kind: "work.held",
                    actor: "Binh",
                    summary: "decision.holdEvidence()",
                    evidence: "Need a receipt",
                },
            )
            expect(getWorkItem.mock.calls).toEqual([
                ["user-1", "ws-1", "item-1"],
                ["user-1", "ws-1", "item-1"],
            ])
        })
    })
})

describe("WorkPlacementService", () => {
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

        it.each([undefined, null])("takes back the assignment when staffId is %s", async (staffId) => {
            const { service, assignItem, namesOf, log, require, catalog, getWorkItem } = await build()
            const refreshed = itemOf({ assigned_staff_id: null, reason: "missing_data" })
            getWorkItem.mockResolvedValueOnce(itemOf({ assigned_staff_id: "staff-1" })).mockResolvedValueOnce(refreshed)

            await expect(
                service.assign("user-1", "ws-1", { workItemId: "item-1", staffId, locale: "vi" }),
            ).resolves.toEqual(refreshed)

            expect(require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
            expect(namesOf).not.toHaveBeenCalled()
            expect(assignItem).toHaveBeenCalledWith("ws-1", "item-1", null)
            expect(catalog.get).toHaveBeenCalledWith("decision.unassigned", {}, "vi")
            expect(log).toHaveBeenCalledWith(
                { workspaceId: "ws-1", actor: "An", locale: "vi" },
                {
                    lead_id: "lead-1",
                    work_item_id: "item-1",
                    kind: "work.assigned",
                    actor: "An",
                    summary: "decision.unassigned()",
                },
            )
            expect(getWorkItem.mock.calls).toEqual([
                ["user-1", "ws-1", "item-1"],
                ["user-1", "ws-1", "item-1"],
            ])
        })

        it("refuses assignment when the work item disappears before the write", async () => {
            const { service, assignItem, namesOf, log, getWorkItem } = await build()
            assignItem.mockResolvedValue(false)

            await expect(
                service.assign("user-1", "ws-1", { workItemId: "item-1", staffId: "staff-1", locale: "en" }),
            ).rejects.toMatchObject({ code: DecisionsErrorCode.NotFound })

            expect(namesOf).toHaveBeenCalledWith("ws-1", ["staff-1"])
            expect(assignItem).toHaveBeenCalledWith("ws-1", "item-1", "staff-1")
            expect(log).not.toHaveBeenCalled()
            expect(getWorkItem).toHaveBeenCalledTimes(1)
        })
    })
})
