import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import {
    DecisionsError,
    DecisionsErrorCode,
    DecisionsService,
    ModuleCatalogService,
    WorkDecisionService,
} from "@modules/domain/decisions"
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
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => key) })
    const decisions = mock<DecisionsService>({
        listWorkItems: jest.fn().mockResolvedValue({ items, next: null }),
    })
    const work = mock<WorkDecisionService>({ decide })
    const modules = mock<ModuleCatalogService>({ actionOf: jest.fn().mockResolvedValue(null) })
    const leads = mock<LeadRecordsService>({
        namesOf: jest.fn().mockResolvedValue([{ id: "lead-1", contact_name: "Anh Minh" }]),
    })
    const authority = mock<AuthorityChatService>({ apply })
    const moduleRef = await Test.createTestingModule({
        providers: [
            OwnerChatService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: DecisionsService, useValue: decisions },
            { provide: WorkDecisionService, useValue: work },
            { provide: ModuleCatalogService, useValue: modules },
            { provide: LeadRecordsService, useValue: leads },
            { provide: AuthorityChatService, useValue: authority },
        ],
    }).compile()
    return { service: moduleRef.get(OwnerChatService), decide, apply, catalog, decisions, modules, leads }
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

    it("has no decision example when the first waiting view is absent", async () => {
        const { service } = await build([])
        expect(service["example"]("approve", undefined, "en")).toBe("")
        expect(service["example"]("duyet", undefined, "vi")).toBe("")
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

    it("ignores another agent's handle and ordinary unaddressed conversation", async () => {
        const { service, decisions, apply } = await build([itemOf()])

        await expect(service.reply(memberOf(), "duyet @sales", "vi")).resolves.toEqual({
            handled: false,
            posted: false,
        })
        await expect(service.reply(memberOf(), "hello", "vi")).resolves.toEqual({ handled: false, posted: false })
        expect(decisions.listWorkItems).not.toHaveBeenCalled()
        expect(apply).not.toHaveBeenCalled()
    })

    it("answers an addressed decision with no waiting work and leaves unaddressed decisions alone", async () => {
        const { service, catalog, decisions, leads, apply } = await build([])

        await expect(service.reply(memberOf(), "@nivo approve", "en")).resolves.toEqual({
            handled: true,
            reply: "flowEngine.noWaiting",
            posted: false,
        })
        await expect(service.reply(memberOf(), "approve", "en")).resolves.toEqual({ handled: false, posted: false })
        expect(catalog.get).toHaveBeenCalledWith("flowEngine.noWaiting", {}, "en")
        expect(decisions.listWorkItems).toHaveBeenCalledWith("user-1", "ws-1", {
            statuses: ["waiting_decision"],
            action: null,
            limit: 100,
        })
        expect(leads.namesOf).toHaveBeenCalledWith("ws-1", [])
        expect(apply).not.toHaveBeenCalled()
    })

    it("fills a missing amount on a named item and describes the approved amount", async () => {
        const { service, decide, catalog, modules } = await build([
            itemOf({ missing_fields: ["amount_vnd"], proposal: { summary: "", fields: { order_no: "FB-1234" } } }),
            itemOf({ id: "other", lead_id: null, proposal: { summary: "", fields: {} } }),
        ])
        modules.actionOf.mockResolvedValue({
            action: "confirm_order",
            moduleKey: "sales",
            maxMode: null,
            next: [],
            label: { en: "Confirm order", vi: "Xac nhan" },
        })

        await expect(service.reply(memberOf(), "approve FB-1234 3 million", "en")).resolves.toEqual({
            handled: true,
            reply: "flowEngine.decided",
            posted: false,
        })
        expect(decide).toHaveBeenCalledWith("user-1", "ws-1", {
            workItemId: "item-1",
            decision: "approved",
            edits: { amount_vnd: 3_000_000 },
            note: "flowEngine.decisionNote",
            locale: "en",
        })
        expect(catalog.get).toHaveBeenCalledWith(
            "flowEngine.decided",
            { decision: "flowEngine.approvedWord", summary: "Confirm order FB-1234 · Anh Minh · \u20ab3,000,000" },
            "en",
        )
    })

    it("rejects a payment reconciliation without filling its missing amount", async () => {
        const { service, decide, catalog } = await build([
            itemOf({
                action: "reconcile_payment",
                missing_fields: ["amount_vnd"],
                proposal: { summary: "", fields: {} },
            }),
        ])

        await expect(service.reply(memberOf(), "reject 3 million", "en")).resolves.toEqual({
            handled: true,
            reply: "flowEngine.decided",
            posted: false,
        })
        expect(decide).toHaveBeenCalledWith("user-1", "ws-1", {
            workItemId: "item-1",
            decision: "rejected",
            edits: {},
            note: "flowEngine.decisionNote",
            locale: "en",
        })
        expect(catalog.get).toHaveBeenCalledWith(
            "flowEngine.decided",
            { decision: "flowEngine.rejectedWord", summary: "reconcile_payment · Anh Minh" },
            "en",
        )
    })

    it("does not edit an already present matching amount", async () => {
        const { service, decide } = await build([itemOf()])

        await expect(service.reply(memberOf(), "@nivo approve 5 million", "en")).resolves.toEqual({
            handled: true,
            reply: "flowEngine.decided",
            posted: false,
        })
        expect(decide).toHaveBeenCalledWith("user-1", "ws-1", {
            workItemId: "item-1",
            decision: "approved",
            edits: {},
            note: "flowEngine.decisionNote",
            locale: "en",
        })
    })

    it("lists nonmatching items oldest first, at most six, and reports the remainder", async () => {
        const items = Array.from({ length: 7 }, (_, index) =>
            itemOf({
                id: `item-${index + 1}`,
                lead_id: index === 0 ? "unknown" : null,
                created_at: `2026-10-${17 - index}T10:00:00.000Z`,
                proposal: { summary: "", fields: { order_no: `FB-${1000 + index}` } },
            }),
        )
        const { service, decide, catalog, leads } = await build(items)

        await expect(service.reply(memberOf(), "@nivo reject FB-9999", "en")).resolves.toEqual({
            handled: true,
            reply: "flowEngine.noMatch",
            posted: false,
        })
        expect(catalog.get).toHaveBeenCalledWith(
            "flowEngine.noMatch",
            {
                n: 0,
                verb: "flowEngine.verbReject",
                list: "1) confirm_order FB-1006; 2) confirm_order FB-1005; 3) confirm_order FB-1004; 4) confirm_order FB-1003; 5) confirm_order FB-1002; 6) confirm_order FB-1001; flowEngine.moreWaiting",
                example: "flowEngine.verbReject FB-1006",
            },
            "en",
        )
        expect(catalog.get).toHaveBeenCalledWith("flowEngine.moreWaiting", { n: 1 }, "en")
        expect(leads.namesOf).toHaveBeenCalledWith("ws-1", ["unknown"])
        expect(decide).not.toHaveBeenCalled()
    })

    it("lists only matching candidates and uses the customer as the decision example", async () => {
        const proposal = { summary: "", fields: { customer: "Lan" } }
        const { service, catalog, leads, decide } = await build([
            itemOf({ id: "a", proposal }),
            itemOf({ id: "b", proposal }),
            itemOf({ id: "c", lead_id: null, proposal: { summary: "", fields: { customer: "Hung" } } }),
        ])
        leads.namesOf.mockResolvedValue([])

        await expect(service.reply(memberOf(), "@nivo approve lan", "en")).resolves.toEqual({
            handled: true,
            reply: "flowEngine.which",
            posted: false,
        })
        expect(catalog.get).toHaveBeenCalledWith(
            "flowEngine.which",
            {
                n: 2,
                verb: "flowEngine.verbApprove",
                list: "1) confirm_order · Lan; 2) confirm_order · Lan",
                example: "flowEngine.verbApprove Lan",
            },
            "en",
        )
        expect(leads.namesOf).toHaveBeenCalledWith("ws-1", ["lead-1"])
        expect(decide).not.toHaveBeenCalled()
    })

    it.each([null, 2_000_000])("uses money in the example when no name or reference exists: %s", async (amount) => {
        const { service, catalog } = await build([
            itemOf({ lead_id: null, proposal: { summary: "", amount_vnd: amount, fields: {} } }),
            itemOf({ id: "other", lead_id: null, proposal: { summary: "", fields: {} } }),
        ])

        await expect(service.reply(memberOf(), "@nivo approve", "en")).resolves.toEqual({
            handled: true,
            reply: "flowEngine.which",
            posted: false,
        })
        expect(catalog.get).toHaveBeenCalledWith(
            "flowEngine.which",
            {
                n: 2,
                verb: "flowEngine.verbApprove",
                list:
                    amount === null
                        ? "1) confirm_order; 2) confirm_order"
                        : "1) confirm_order · \u20ab2,000,000; 2) confirm_order",
                example: `flowEngine.verbApprove \u20ab${amount === null ? "0" : "2,000,000"}`,
            },
            "en",
        )
    })

    it("localises a domain refusal returned by the decision step", async () => {
        const { service, decide, catalog } = await build([itemOf()])
        decide.mockRejectedValue(
            new DecisionsError({ code: DecisionsErrorCode.StillMissing, params: { fields: "customer" } }),
        )

        await expect(service.reply(memberOf(), "@nivo approve", "vi")).resolves.toEqual({
            handled: true,
            reply: "errors.DECISIONS_STILL_MISSING",
            posted: false,
        })
        expect(catalog.get).toHaveBeenCalledWith("errors.DECISIONS_STILL_MISSING", { fields: "customer" }, "vi")
    })

    it("localises authority refusals and propagates unexpected authority failures", async () => {
        const { service, apply, catalog } = await build([])
        apply.mockRejectedValueOnce(new DecisionsError({ code: DecisionsErrorCode.NotAllowed }))
        apply.mockRejectedValueOnce(new TypeError("offline"))

        await expect(service.reply(memberOf(), "@nivo change authority", "en")).resolves.toEqual({
            handled: true,
            reply: "errors.DECISIONS_NOT_ALLOWED",
            posted: false,
        })
        expect(catalog.get).toHaveBeenCalledWith("errors.DECISIONS_NOT_ALLOWED", {}, "en")
        await expect(service.reply(memberOf(), "@nivo change authority", "en")).rejects.toThrow("offline")
    })
})
