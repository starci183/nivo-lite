import { FakeClock, builder, fakeInbox, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import type { EntityManager } from "typeorm"
import { StaffDirectoryService } from "@modules/domain/staff"
import { WorkItemsService } from "@modules/domain/work-items"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { WorkItem } from "./decisions.contracts"
import { DecisionsService } from "./decisions.service"
import { DecisionsErrorCode } from "./errors/decisions.error"
import { EvidenceService } from "./evidence.service"
import type { HoldWorkRequest } from "./work-decision.contracts"
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
    const tx = fakeTransaction(mockEntityManager())
    const inbox = fakeInbox()
    const claimKey = inbox.claim.bind(inbox)
    const claimedBy = new WeakMap<EntityManager, Array<{ source: string; eventId: string }>>()
    const execute = tx.em.transaction.getMockImplementation()
    expect(execute).toEqual(expect.any(Function))
    tx.em.transaction.mockImplementation(
        (
            first: Parameters<EntityManager["transaction"]>[0] | Parameters<EntityManager["transaction"]>[1],
            second?: Parameters<EntityManager["transaction"]>[1],
        ) =>
            Promise.resolve(
                execute?.("READ COMMITTED", async (manager) => {
                    const claims: Array<{ source: string; eventId: string }> = []
                    claimedBy.set(manager, claims)
                    const work = typeof first === "function" ? first : second
                    expect(work).toEqual(expect.any(Function))
                    try {
                        return await work?.(manager)
                    } catch (cause) {
                        await Promise.all(claims.map(({ source, eventId }) => inbox.release(source, eventId)))
                        throw cause
                    }
                }),
            ),
    )
    inbox.claim = async (source: string, eventId: string, manager?: EntityManager): Promise<boolean> => {
        const claimed = await claimKey(source, eventId)
        if (claimed && manager !== undefined) claimedBy.get(manager)?.push({ source, eventId })
        return claimed
    }
    const transactionalInbox: Inbox = inbox
    const claim = jest.spyOn(transactionalInbox, "claim")
    const clock = new FakeClock("2026-10-12T10:00:00.000Z")
    const require = jest.fn().mockResolvedValue(member)
    const getWorkItem = jest.fn().mockResolvedValue(itemOf())
    const log = jest
        .fn<ReturnType<EvidenceService["log"]>, Parameters<EvidenceService["log"]>>()
        .mockResolvedValue(undefined)
    const holdItem = jest
        .fn<ReturnType<WorkItemsService["hold"]>, Parameters<WorkItemsService["hold"]>>()
        .mockResolvedValue(true)
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
            { provide: CLOCK, useValue: clock },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: INBOX, useValue: inbox },
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
        tx,
        inbox,
        claim,
        clock,
    }
}

describe("WorkPlacementService hold retries", () => {
    it("records a retried hold once even after the clock and input spacing change", async () => {
        const { service, holdItem, log, clock } = await build()
        await service.hold("user-1", "ws-1", { workItemId: "item-1", note: "Need a receipt", locale: "en" })
        clock.advance(60_000)
        await service.hold("user-1", "ws-1", { workItemId: "item-1", note: "  Need\n a receipt ", locale: "vi" })

        expect(holdItem).toHaveBeenCalledTimes(1)
        expect(log).toHaveBeenCalledTimes(1)
    })

    it("records concurrent deliveries of the same hold once", async () => {
        const { service, holdItem, log } = await build()
        const request: HoldWorkRequest = { workItemId: "item-1", note: "Need a receipt", locale: "en" }

        await Promise.all([service.hold("user-1", "ws-1", request), service.hold("user-1", "ws-1", request)])

        expect(holdItem).toHaveBeenCalledTimes(1)
        expect(log).toHaveBeenCalledTimes(1)
    })

    it("keeps different notes, people, items and workspaces as separate holds", async () => {
        const { service, holdItem, log, getWorkItem } = await build()
        const request: HoldWorkRequest = { workItemId: "item-1", note: "Need a receipt", locale: "en" }

        await service.hold("user-1", "ws-1", request)
        await service.hold("user-1", "ws-1", { ...request, note: "Need a signature" })
        await service.hold("user-2", "ws-1", request)
        getWorkItem.mockResolvedValue(itemOf({ id: "item-2" }))
        await service.hold("user-1", "ws-1", { ...request, workItemId: "item-2" })
        await service.hold("user-1", "ws-2", { ...request, workItemId: "item-2" })

        expect(holdItem).toHaveBeenCalledTimes(5)
        expect(log).toHaveBeenCalledTimes(5)
    })
})

describe("WorkPlacementService hold transactions", () => {
    it("claims the retry key in the same transaction as the hold and evidence", async () => {
        const { service, claim, holdItem, log, tx } = await build()

        await service.hold("user-1", "ws-1", { workItemId: "item-1", note: "Need a receipt", locale: "en" })

        const manager = claim.mock.calls[0]?.[2]
        expect(isTransactionManager(manager)).toBe(true)
        expect(claim).toHaveBeenCalledWith("work.hold", expect.stringMatching(/^[0-9a-f]{64}$/u), manager)
        expect(holdItem.mock.calls[0]?.[3]).toBe(manager)
        expect(log.mock.calls[0]?.[2]).toBe(manager)
        expect(tx.commits).toBe(1)
    })

    it("rolls back the claim and hold when evidence cannot be written", async () => {
        const { service, log, holdItem, tx } = await build()
        const failure = new Error("evidence unavailable")
        log.mockRejectedValueOnce(failure)

        await expect(
            service.hold("user-1", "ws-1", { workItemId: "item-1", note: "Need a receipt", locale: "en" }),
        ).rejects.toBe(failure)

        expect(tx.rollbacks).toBe(1)
        expect(tx.commits).toBe(0)

        await service.hold("user-1", "ws-1", { workItemId: "item-1", note: "Need a receipt", locale: "en" })

        expect(holdItem).toHaveBeenCalledTimes(2)
        expect(log).toHaveBeenCalledTimes(2)
        expect(tx.commits).toBe(1)
    })

    it("does not hold or log when claiming the retry key fails", async () => {
        const { service, claim, holdItem, log, tx } = await build()
        const failure = new Error("inbox unavailable")
        claim.mockRejectedValue(failure)

        await expect(
            service.hold("user-1", "ws-1", { workItemId: "item-1", note: "Need a receipt", locale: "en" }),
        ).rejects.toBe(failure)

        expect(holdItem).not.toHaveBeenCalled()
        expect(log).not.toHaveBeenCalled()
        expect(tx.rollbacks).toBe(1)
    })
})

describe("WorkPlacementService hold notes", () => {
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
            expect.any(Object),
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

describe("WorkPlacementService hold permissions", () => {
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

        expect(holdItem).toHaveBeenCalledWith(
            "ws-1",
            "item-1",
            {
                summary: "Send",
                fields: { hold_note: "Need receipt", hold_by: "An", hold_at: "2026-10-12T10:00:00.000Z" },
            },
            expect.any(Object),
        )
        expect(log).not.toHaveBeenCalled()
        expect(getWorkItem).toHaveBeenCalledTimes(1)
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

            expect(holdItem).toHaveBeenCalledWith("ws-1", "item-1", refreshed.proposal, expect.any(Object))
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
                expect.any(Object),
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
