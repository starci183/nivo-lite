import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AuthorityService } from "@modules/domain/authority"
import { AuthorityActionsService } from "@modules/domain/authority-actions"
import type { AuthorityActionRecord } from "@modules/domain/authority-actions"
import type { AuthorityProfile } from "@modules/domain/authority"
import { InvoicesService } from "@modules/domain/invoices"
import type { ReconcileInvoiceRow } from "@modules/domain/invoices"
import { TransactionsService } from "@modules/domain/transactions"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import type { AuthorityRuleRecord, RuleChange } from "@modules/domain/authority-rules"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { WorkItem } from "./decisions.contracts"
import type { DecisionHistoryKind, ListWorkItemsQuery } from "./decisions-views.contracts"
import { DecisionHistoryService } from "./decision-history.service"
import { DecisionsService } from "./decisions.service"
import { WorkItemViewsService } from "./work-item-views.service"
import { DecisionsErrorCode } from "./errors/decisions.error"
import { EvidenceService } from "./evidence.service"
import type { WorkItemViewRow } from "./work-item-views.rows"

const CURSOR_AT = "2026-10-12T10:00:00.123456+00:00"

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
    decidedBy: null,
    deciderName: null,
    created_at: CURSOR_AT,
    updated_at: CURSOR_AT,
    completed_at: null,
    installation_id: null,
})

const viewOf = (id: string): WorkItemViewRow => ({ ...itemOf({ id }), cursor_at: CURSOR_AT })

const profileOf = builder<AuthorityProfile>({
    policies: "P",
    reply_style: "R",
    brand_voice: "B",
    limits_note: "L",
    goal_revenue_vnd: null,
    goal_new_customers: null,
    goal_first_reply_minutes: null,
    goal_note: "",
    updated_by: "An",
    updated_at: "2026-10-12T10:00:00.000Z",
})

const ruleOf = builder<AuthorityRuleRecord>({
    id: "rule-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "confirm_order",
    mode: "ask",
    limit_vnd: 1000,
    required_fields: ["customer"],
    note: "",
    updated_at: "2026-10-12T10:00:00.000Z",
    unit: "vnd",
    auto_max: null,
    ask_max: null,
    agents: [],
    approver_roles: ["owner", "manager"],
    approver_rooms: [],
    approver_members: [],
    approval_policy: "any",
    timeout_minutes: 30,
})

const changeOf = builder<RuleChange>({
    action: "confirm_order",
    mode: "ask",
    limit_vnd: 1000,
    required_fields: ["customer"],
    department: "sales",
    note: null,
})

const actionOf = builder<AuthorityActionRecord>({
    action: "confirm_order",
    module_key: "sales",
    sort_order: 1,
    default_mode: "ask",
    default_limit_vnd: null,
    default_required_fields: [],
    amount_limit: true,
    max_mode: null,
    label: { vi: "Xac nhan don", en: "Confirm order" },
})

const queryOf = builder<ListWorkItemsQuery>({ statuses: ["waiting_decision"], action: null, after: null, limit: 2 })

const invoiceOf = builder<ReconcileInvoiceRow>({
    id: "invoice-1",
    invoice_no: "INV-1",
    amount_vnd: 2500,
    status: "issued",
    customer: "Minh",
    company: "Tea",
    order_no: "ORDER-1",
    order_items: "Tea",
    order_status: "confirmed",
    issued_at: CURSOR_AT,
    due_at: null,
})

const build = async (entityManager: MockEntityManager = mockEntityManager()) => {
    const views = mock<WorkItemViewsService>()
    const history = mock<DecisionHistoryService>()
    const members = mock<WorkspaceMembersService>({ require: jest.fn().mockResolvedValue(memberOf()) })
    const evidence = mock<EvidenceService>({ log: jest.fn().mockResolvedValue(undefined) })
    const authority = mock<AuthorityService>({ profileOf: jest.fn(), save: jest.fn() })
    const rules = mock<AuthorityRulesService>({ list: jest.fn(), save: jest.fn() })
    const invoices = mock<InvoicesService>({ listForReconcile: jest.fn().mockResolvedValue([]) })
    const transactions = mock<TransactionsService>({ momentOf: jest.fn().mockResolvedValue(null) })
    const actions = mock<AuthorityActionsService>({
        list: jest
            .fn()
            .mockResolvedValue([actionOf(), actionOf({ action: "send_care", module_key: "chatbot", max_mode: "ask" })]),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            DecisionsService,
            { provide: DecisionHistoryService, useValue: history },
            { provide: WorkItemViewsService, useValue: views },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: EvidenceService, useValue: evidence },
            { provide: AuthorityService, useValue: authority },
            { provide: AuthorityRulesService, useValue: rules },
            { provide: AuthorityActionsService, useValue: actions },
            { provide: InvoicesService, useValue: invoices },
            { provide: TransactionsService, useValue: transactions },
        ],
    }).compile()
    return {
        service: moduleRef.get(DecisionsService),
        members,
        evidence,
        authority,
        rules,
        invoices,
        transactions,
        views,
        history,
    }
}

describe("DecisionsService", () => {
    describe("listAccountingWaiting", () => {
        it.each([undefined, 12])("reads waiting accounting work with limit %s", async (limit) => {
            const { service, members, views } = await build()
            const row = {
                ...itemOf(),
                proposal: { summary: "Legacy", fields: {} },
                lead: { id: "lead-1", contact_name: "Minh", company: "Tea", channel: "zalo" },
                assigned_staff_name: "Binh",
            }
            views.accountingWaiting.mockResolvedValue([row])

            await expect(service.listAccountingWaiting("user-1", "ws-1", limit)).resolves.toEqual([row])
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(views.accountingWaiting).toHaveBeenCalledWith("ws-1", limit ?? 500)
        })
    })

    describe("listDecisionHistory", () => {
        it.each<{
            kind: DecisionHistoryKind
            deciders: Array<string> | null
            outcome: string | null
        }>([
            { kind: "all", deciders: null, outcome: null },
            { kind: "human", deciders: ["owner", "staff"], outcome: null },
            { kind: "policy", deciders: ["policy"], outcome: null },
            { kind: "rejected", deciders: null, outcome: "rejected" },
        ])("filters $kind history with a bounded page size", async ({ kind, deciders, outcome }) => {
            const { service, members, history } = await build()
            history.list.mockResolvedValue([])

            await expect(
                service.listDecisionHistory("user-1", "ws-1", { kind, department: "sales", limit: 1000 }),
            ).resolves.toEqual([])
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(history.list).toHaveBeenCalledWith("ws-1", { deciders, outcome, department: "sales", limit: 100 })
        })
    })
})

describe("DecisionsService", () => {
    describe("listWorkItems", () => {
        it("answers a page and the cursor of the next one", async () => {
            const { service, members, views } = await build()
            views.list.mockResolvedValue([viewOf("a"), viewOf("b"), viewOf("c")])

            await expect(service.listWorkItems("user-1", "ws-1", queryOf())).resolves.toEqual({
                items: [itemOf({ id: "a" }), itemOf({ id: "b" })],
                next: { createdAt: CURSOR_AT, id: "b" },
            })
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(views.list).toHaveBeenCalledWith("ws-1", {
                statuses: ["waiting_decision"],
                after: null,
                action: null,
                limit: 3,
            })
        })

        it("continues after a cursor, clamps the page size and passes an action filter", async () => {
            const { service, views } = await build()
            views.list.mockResolvedValue([viewOf("z")])
            const after = { createdAt: "2026-10-12T00:00:00Z", id: "y" }

            await expect(
                service.listWorkItems(
                    "user-1",
                    "ws-1",
                    queryOf({ statuses: [], after, action: "issue_invoice", limit: 1000 }),
                ),
            ).resolves.toEqual({ items: [itemOf({ id: "z" })], next: null })
            expect(views.list).toHaveBeenCalledWith("ws-1", {
                statuses: [],
                after,
                action: "issue_invoice",
                limit: 101,
            })
        })
    })

    describe("getWorkItem", () => {
        it("answers the item", async () => {
            const { service, views } = await build()
            views.find.mockResolvedValue(viewOf("item-1"))

            await expect(service.getWorkItem("user-1", "ws-1", "item-1")).resolves.toEqual(itemOf())
            expect(views.find).toHaveBeenCalledWith("ws-1", "item-1")
        })

        it("refuses an item that is not in the workspace", async () => {
            const { service, views } = await build()
            views.find.mockResolvedValue(undefined)

            await expect(service.getWorkItem("user-1", "ws-1", "item-9")).rejects.toMatchObject({
                code: DecisionsErrorCode.NotFound,
            })
        })
    })
})

describe("DecisionsService", () => {
    describe("readAuthority", () => {
        it("answers the sheet and the rules for a manager", async () => {
            const { service, members, authority, rules } = await build(mockEntityManager())
            authority.profileOf.mockResolvedValue(profileOf())
            rules.list.mockResolvedValue([ruleOf()])

            await expect(service.readAuthority("user-1", "ws-1")).resolves.toEqual({
                profile: profileOf(),
                rules: [ruleOf()],
            })
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
            expect(authority.profileOf).toHaveBeenCalledWith("ws-1")
            expect(rules.list).toHaveBeenCalledWith("ws-1")
        })
    })

    describe("updateAuthority", () => {
        it("saves the patch stamped with the caller and logs it", async () => {
            const { service, authority, evidence } = await build(mockEntityManager())
            authority.save.mockResolvedValue(profileOf({ policies: "P2" }))

            await expect(
                service.updateAuthority("user-1", "ws-1", { policies: "P2", goal_note: "n" }),
            ).resolves.toEqual(profileOf({ policies: "P2" }))

            expect(authority.save).toHaveBeenCalledWith("ws-1", { policies: "P2", goal_note: "n" }, "An")
            expect(evidence.log).toHaveBeenCalledWith(
                { workspaceId: "ws-1", actor: "An", locale: "en" },
                { kind: "authority.updated", actor: "An", summary: "policies, goal_note" },
            )
        })
    })
})

describe("DecisionsService", () => {
    describe("saveRule", () => {
        it("allows automatic decisions for an uncapped action", async () => {
            const { service, rules, evidence } = await build(mockEntityManager())
            const change = changeOf({ mode: "auto", limit_vnd: null })
            const saved = ruleOf({ mode: "auto", limit_vnd: null })
            rules.save.mockResolvedValue(saved)

            await expect(service.saveRule("user-1", "ws-1", change)).resolves.toBe(saved)
            expect(rules.save).toHaveBeenCalledWith("ws-1", change)
            expect(evidence.log).toHaveBeenCalledWith(
                { workspaceId: "ws-1", actor: "An", locale: "en" },
                { kind: "authority.rule_updated", actor: "An", summary: "sales.confirm_order -> auto" },
            )
        })

        it("saves the rule and logs it with its limit", async () => {
            const { service, rules, evidence } = await build(mockEntityManager())
            rules.save.mockResolvedValue(ruleOf())

            await expect(service.saveRule("user-1", "ws-1", changeOf())).resolves.toEqual(ruleOf())

            expect(rules.save).toHaveBeenCalledWith("ws-1", changeOf())
            expect(evidence.log).toHaveBeenCalledWith(
                { workspaceId: "ws-1", actor: "An", locale: "en" },
                { kind: "authority.rule_updated", actor: "An", summary: "sales.confirm_order -> ask < 1000" },
            )
        })

        it("logs a rule without a limit plainly", async () => {
            const { service, rules, evidence } = await build(mockEntityManager())
            rules.save.mockResolvedValue(ruleOf({ limit_vnd: null }))

            await service.saveRule("user-1", "ws-1", changeOf({ limit_vnd: null }))

            expect(evidence.log).toHaveBeenCalledWith(
                { workspaceId: "ws-1", actor: "An", locale: "en" },
                { kind: "authority.rule_updated", actor: "An", summary: "sales.confirm_order -> ask" },
            )
        })

        it("refuses an action outside the registry", async () => {
            const { service, rules } = await build(mockEntityManager())

            await expect(
                service.saveRule("user-1", "ws-1", changeOf({ action: "launch_rocket" })),
            ).rejects.toMatchObject({ code: DecisionsErrorCode.UnknownAction, params: { action: "launch_rocket" } })
            expect(rules.save).not.toHaveBeenCalled()
        })

        it("refuses an action filed under another department", async () => {
            const { service, rules } = await build(mockEntityManager())

            await expect(
                service.saveRule("user-1", "ws-1", changeOf({ department: "accounting" })),
            ).rejects.toMatchObject({ code: DecisionsErrorCode.UnknownAction })
            expect(rules.save).not.toHaveBeenCalled()
        })

        it("refuses auto for an action that can never run by itself, and allows ask", async () => {
            const { service, rules } = await build(mockEntityManager())
            rules.save.mockResolvedValue(ruleOf())
            const capped = changeOf({ action: "send_care", department: "chatbot" })

            await expect(service.saveRule("user-1", "ws-1", { ...capped, mode: "auto" })).rejects.toMatchObject({
                code: DecisionsErrorCode.ModeCapped,
                params: { action: "send_care" },
            })
            await expect(service.saveRule("user-1", "ws-1", capped)).resolves.toEqual(ruleOf())
            expect(rules.save).toHaveBeenCalledTimes(1)
        })
    })
})

describe("DecisionsService", () => {
    describe("saveRule with bands", () => {
        it("refuses an auto band for an action that can never run by itself, whatever mode comes with it", async () => {
            const { service, rules } = await build(mockEntityManager())
            const capped = changeOf({ action: "send_care", department: "chatbot", auto_max: 3, ask_max: 15 })

            await expect(service.saveRule("user-1", "ws-1", capped)).rejects.toMatchObject({
                code: DecisionsErrorCode.ModeCapped,
                params: { action: "send_care" },
            })
            expect(rules.save).not.toHaveBeenCalled()
        })

        it("allows an ask band without an auto band for a capped action, and a never rule that carries bands", async () => {
            const { service, rules } = await build(mockEntityManager())
            rules.save.mockResolvedValue(ruleOf())
            const capped = changeOf({ action: "send_care", department: "chatbot" })

            await service.saveRule("user-1", "ws-1", { ...capped, auto_max: null, ask_max: 15 })
            await service.saveRule("user-1", "ws-1", { ...capped, mode: "never", auto_max: 3, ask_max: 15 })

            expect(rules.save).toHaveBeenCalledTimes(2)
        })
    })
})

describe("DecisionsService", () => {
    describe("reconcileDetails", () => {
        it("prefers the stored transaction and returns existing candidates in proposal order", async () => {
            const candidates = ["invoice-2", "missing", "invoice-1"].map((id) => ({ id, label: id, amount_vnd: 1000 }))
            const item = itemOf({
                subject_type: "transaction",
                subject_id: "tx-1",
                proposal: {
                    summary: "Match",
                    fields: { payer: "Claimant", claim: "Claim" },
                    amount_vnd: 1000,
                    candidates,
                },
            })
            const em = managerWithView(item)
            const { service, invoices, transactions, members } = await build(em)
            const moment = { amount_vnd: 2500, payer: "Payer", reference: "TRANSFER-1", occurred_at: CURSOR_AT }
            transactions.momentOf.mockResolvedValue(moment)
            invoices.listForReconcile.mockResolvedValue([invoiceOf(), invoiceOf({ id: "invoice-2" })])

            await expect(service.reconcileDetails("user-1", "ws-1", "item-1")).resolves.toEqual({
                payment: moment,
                candidates: [invoiceOf({ id: "invoice-2" }), invoiceOf()],
            })
            expect(members.require).toHaveBeenCalledTimes(2)
            expect(transactions.momentOf).toHaveBeenCalledWith("ws-1", "tx-1")
            expect(invoices.listForReconcile).toHaveBeenCalledWith("ws-1", ["invoice-2", "missing", "invoice-1"])
        })

        it("uses an invoice claim's amount, text fields and creation time when no transaction applies", async () => {
            const item = itemOf({
                subject_type: "invoice",
                proposal: { summary: "Claim", amount_vnd: 1200, fields: { payer: "Minh", claim: "Paid cash" } },
            })
            const em = managerWithView(item)
            const { service, invoices, transactions } = await build(em)

            await expect(service.reconcileDetails("user-1", "ws-1", "item-1")).resolves.toEqual({
                payment: { amount_vnd: 1200, payer: "Minh", reference: "Paid cash", occurred_at: CURSOR_AT },
                candidates: [],
            })
            expect(transactions.momentOf).not.toHaveBeenCalled()
            expect(invoices.listForReconcile).toHaveBeenCalledWith("ws-1", [])
        })

        it.each(["tx-1", null])(
            "answers null payment fields for missing transaction %s and nontext claims",
            async (subject_id) => {
                const item = itemOf({
                    subject_type: "transaction",
                    subject_id,
                    proposal: { summary: "Match", fields: { payer: 9, claim: null } },
                })
                const em = managerWithView(item)
                const { service, transactions } = await build(em)

                await expect(service.reconcileDetails("user-1", "ws-1", "item-1")).resolves.toEqual({
                    payment: { amount_vnd: null, payer: null, reference: null, occurred_at: null },
                    candidates: [],
                })
                expect(transactions.momentOf).toHaveBeenCalledTimes(subject_id === null ? 0 : 1)
            },
        )
    })
})
