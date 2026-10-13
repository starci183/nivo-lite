import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { DecisionsService, ModuleCatalogService, WorkDecisionService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import { LeadRecordsService } from "@modules/domain/leads"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { AuthorityChatService } from "./authority-chat.service"
import { OwnerChatService } from "./owner-chat.service"

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
    action: "confirm_order",
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
    proposal: { summary: "Confirm", amount_vnd: 5_000_000, fields: { order_no: "FB-1234" } },
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

const build = async (items: ReadonlyArray<WorkItem>) => {
    const decide = jest.fn().mockResolvedValue(items[0])
    const apply = jest.fn().mockResolvedValue({ summary: "saved", authority: null, rules: [] })
    const moduleRef = await Test.createTestingModule({
        providers: [
            OwnerChatService,
            {
                provide: MESSAGE_CATALOG,
                useValue: mock<MessageCatalog>({ get: jest.fn((key: string) => key) }),
            },
            {
                provide: DecisionsService,
                useValue: mock<DecisionsService>({
                    listWorkItems: jest.fn().mockResolvedValue({ items, next: null }),
                }),
            },
            { provide: WorkDecisionService, useValue: mock<WorkDecisionService>({ decide }) },
            {
                provide: ModuleCatalogService,
                useValue: mock<ModuleCatalogService>({ actionOf: jest.fn().mockResolvedValue(null) }),
            },
            {
                provide: LeadRecordsService,
                useValue: mock<LeadRecordsService>({
                    namesOf: jest.fn().mockResolvedValue([{ id: "lead-1", contact_name: "Anh Minh" }]),
                }),
            },
            { provide: AuthorityChatService, useValue: mock<AuthorityChatService>({ apply }) },
        ],
    }).compile()
    return { service: moduleRef.get(OwnerChatService), decide, apply }
}

describe("OwnerChatService", () => {
    it("approves the one waiting item the message names", async () => {
        const { service, decide } = await build([
            itemOf(),
            itemOf({ id: "item-2", lead_id: null, proposal: { summary: "", fields: {} } }),
        ])

        const answer = await service.reply(memberOf(), "@nivo duyet don FB-1234", "vi")

        expect(answer).toEqual({ handled: true, reply: "flowEngine.decided", posted: false })
        expect(decide).toHaveBeenCalledWith(
            "user-1",
            "ws-1",
            expect.objectContaining({ workItemId: "item-1", decision: "approved" }),
        )
    })

    it("changes nothing when the message cannot tell which item it means", async () => {
        const { service, decide } = await build([itemOf(), itemOf({ id: "item-2" })])

        const answer = await service.reply(memberOf(), "@nivo dong y", "vi")

        expect(answer.reply).toBe("flowEngine.which")
        expect(decide).not.toHaveBeenCalled()
    })

    it("never approves a payment reconciliation by chat", async () => {
        const { service, decide } = await build([itemOf({ action: "reconcile_payment" })])

        const answer = await service.reply(memberOf(), "@nivo dong y", "vi")

        expect(answer.reply).toBe("flowEngine.reconcileNeedsCard")
        expect(decide).not.toHaveBeenCalled()
    })

    it("hands an addressed message that decides nothing to the authority chat", async () => {
        const { service, apply } = await build([])

        const answer = await service.reply(memberOf(), "@nivo muc tieu 300 trieu", "vi")

        expect(answer).toEqual({ handled: true, reply: "saved", posted: false })
        expect(apply).toHaveBeenCalledWith(memberOf(), "muc tieu 300 trieu", "vi")
    })

    it("refuses staff who address NIVO and ignores their other messages", async () => {
        const { service } = await build([itemOf()])
        const staff = memberOf({ role: "staff", staffId: "staff-1" })

        await expect(service.reply(staff, "@nivo dong y", "vi")).resolves.toEqual({
            handled: true,
            reply: "flowEngine.forbidden",
            posted: false,
        })
        await expect(service.reply(staff, "dong y", "vi")).resolves.toEqual({ handled: false, posted: false })
    })
})
