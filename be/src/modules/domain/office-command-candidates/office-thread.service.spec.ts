import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { OfficeCommandCandidatesErrorCode } from "./errors/office-command-candidates.error"
import type { MessageView } from "./office-command-candidates.contracts"
import { OfficeThreadService } from "./office-thread.service"
import type { ApprovalRow } from "./persistence/office-thread.rows"
import { LIST_DECIDED_APPROVALS, LIST_MESSAGES, LIST_PENDING_APPROVALS } from "./persistence/office-thread.sql"

const member: WorkspaceMember = {
    userId: "u-1",
    workspaceId: "ws-1",
    role: "staff",
    staffId: "s-1",
    displayName: "An",
    status: "active",
}

const messageOf = builder<MessageView>({
    id: "m-1",
    author_kind: "human",
    author_name: "An",
    author_user_id: null,
    agent_id: null,
    staff_id: null,
    body: "hi",
    lead_id: null,
    work_item_id: null,
    lead_name: null,
    department: null,
    room: null,
    card_json: null,
    card_state: null,
    created_at: "2026-10-12T10:00:00+00:00",
})

const approvalOf = builder<ApprovalRow>({
    id: "x-1",
    responsibility_id: "r-1",
    agent_id: null,
    kind: "follow_up",
    draft: "Hello",
    status: "pending_approval",
    decided_by: null,
    work_item_id: null,
    decided_at: null,
    created_at: "2026-10-12T10:00:00+00:00",
    lead_id: "l-1",
    next_action: "Call",
    owner_name: "An",
    contact_name: "Lan",
    company: null,
    channel: "zalo",
    agent_name: null,
    assigned_staff_id: null,
})

const build = async (entityManager: MockEntityManager) => {
    const members = mock<WorkspaceMembersService>({ require: jest.fn().mockResolvedValue(member) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            OfficeThreadService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(OfficeThreadService), members }
}

describe("OfficeThreadService", () => {
    describe("messages", () => {
        it("reads the newest page after proving membership and asks for one row more than the page", async () => {
            const rows = [messageOf({ id: "m-3" }), messageOf({ id: "m-2" }), messageOf({ id: "m-1" })]
            const em = mockEntityManager({ query: [LIST_MESSAGES, rows] })
            const { service, members } = await build(em)

            const page = await service.messages("u-1", "ws-1", { before: null, limit: 2, room: null })

            expect(members.require).toHaveBeenCalledWith("u-1", "ws-1")
            expect(em.query).toHaveBeenCalledWith(LIST_MESSAGES, ["ws-1", null, null, 3, null])
            expect(page.messages.map((line) => line.id)).toEqual(["m-3", "m-2"])
            expect(page.next).toEqual({ createdAt: "2026-10-12T10:00:00+00:00", id: "m-2" })
        })

        it("continues after a cursor and clamps the page size", async () => {
            const em = mockEntityManager({ query: [LIST_MESSAGES, []] })
            const { service } = await build(em)
            const id = "0b6f0c5e-2d41-4f55-9c9a-7a1c2f3e4d5b"

            const page = await service.messages("u-1", "ws-1", {
                before: { createdAt: "2026-10-12T10:00:00Z", id },
                limit: 9999,
                room: "marketing",
            })

            expect(em.query).toHaveBeenCalledWith(LIST_MESSAGES, ["ws-1", "2026-10-12T10:00:00Z", id, 101, "marketing"])
            expect(page).toEqual({ messages: [], next: null })
        })

        it("refuses a cursor that is not a position", async () => {
            const { service } = await build(mockEntityManager())

            await expect(
                service.messages("u-1", "ws-1", { before: { createdAt: "later", id: "x" }, limit: 10, room: null }),
            ).rejects.toMatchObject({ code: OfficeCommandCandidatesErrorCode.PageInvalid })
        })

        it("refuses a room that is not a Hub room", async () => {
            const em = mockEntityManager()
            const { service } = await build(em)

            await expect(
                service.messages("u-1", "ws-1", { before: null, limit: 10, room: "lobby" }),
            ).rejects.toMatchObject({
                code: OfficeCommandCandidatesErrorCode.PageInvalid,
            })
            expect(em.query).not.toHaveBeenCalled()
        })
    })

    describe("approvals", () => {
        it("lists the waiting executions as cards", async () => {
            const em = mockEntityManager({ query: [LIST_PENDING_APPROVALS, [approvalOf()]] })
            const { service, members } = await build(em)

            const cards = await service.pendingApprovals("u-1", "ws-1")

            expect(members.require).toHaveBeenCalledWith("u-1", "ws-1")
            expect(em.query).toHaveBeenCalledWith(LIST_PENDING_APPROVALS, ["ws-1", 100])
            expect(cards).toHaveLength(1)
            expect(cards[0]).toMatchObject({ id: "x-1", leadName: "Lan", agentName: "An", channel: "zalo" })
        })

        it("lists the last eight decided executions", async () => {
            const em = mockEntityManager({ query: [LIST_DECIDED_APPROVALS, [approvalOf({ status: "approved" })]] })
            const { service } = await build(em)

            const cards = await service.decidedApprovals("u-1", "ws-1")

            expect(em.query).toHaveBeenCalledWith(LIST_DECIDED_APPROVALS, ["ws-1", 8])
            expect(cards[0]?.status).toBe("approved")
        })
    })
})
