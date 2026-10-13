import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AuthorityService } from "@modules/domain/authority"
import type { AuthorityProfile } from "@modules/domain/authority"
import { InvoicesService } from "@modules/domain/invoices"
import { StaffService } from "@modules/domain/staff"
import { TransactionsService } from "@modules/domain/transactions"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import type { AuthorityRuleRecord, RuleChange } from "@modules/domain/authority-rules"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { WorkItemsService } from "@modules/domain/work-items"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { WorkItem } from "./decisions.contracts"
import type { ListWorkItemsQuery } from "./decisions-views.contracts"
import { DecisionsService } from "./decisions.service"
import { DecisionsErrorCode } from "./errors/decisions.error"
import { EvidenceService } from "./evidence.service"
import type { WorkItemViewRow } from "./persistence/work-item-views.rows"
import { FIND_WORK_ITEM_VIEW, LIST_WORK_ITEMS } from "./persistence/work-item-views.sql"

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
    origin: "live",
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
})

const changeOf = builder<RuleChange>({
    action: "confirm_order",
    mode: "ask",
    limit_vnd: 1000,
    required_fields: ["customer"],
    department: "sales",
    note: null,
})

const queryOf = builder<ListWorkItemsQuery>({ statuses: ["waiting_decision"], action: null, after: null, limit: 2 })

const build = async (entityManager: MockEntityManager) => {
    const members = mock<WorkspaceMembersService>({ require: jest.fn().mockResolvedValue(memberOf()) })
    const evidence = mock<EvidenceService>({ log: jest.fn().mockResolvedValue(undefined) })
    const authority = mock<AuthorityService>({ profileOf: jest.fn(), save: jest.fn() })
    const rules = mock<AuthorityRulesService>({ list: jest.fn(), save: jest.fn() })
    const moduleRef = await Test.createTestingModule({
        providers: [
            DecisionsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: EvidenceService, useValue: evidence },
            { provide: AuthorityService, useValue: authority },
            { provide: AuthorityRulesService, useValue: rules },
            { provide: WorkItemsService, useValue: mock<WorkItemsService>() },
            { provide: StaffService, useValue: mock<StaffService>() },
            { provide: InvoicesService, useValue: mock<InvoicesService>() },
            { provide: TransactionsService, useValue: mock<TransactionsService>() },
        ],
    }).compile()
    return { service: moduleRef.get(DecisionsService), members, evidence, authority, rules }
}

describe("DecisionsService", () => {
    describe("listWorkItems", () => {
        it("answers a page and the cursor of the next one", async () => {
            const em = mockEntityManager({ query: [LIST_WORK_ITEMS, [viewOf("a"), viewOf("b"), viewOf("c")]] })
            const { service, members } = await build(em)

            await expect(service.listWorkItems("user-1", "ws-1", queryOf())).resolves.toEqual({
                items: [itemOf({ id: "a" }), itemOf({ id: "b" })],
                next: { createdAt: CURSOR_AT, id: "b" },
            })
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(em.query).toHaveBeenCalledWith(LIST_WORK_ITEMS, ["ws-1", ["waiting_decision"], null, null, 3, null])
        })

        it("continues after a cursor and clamps the page size", async () => {
            const em = mockEntityManager({ query: [LIST_WORK_ITEMS, [viewOf("z")]] })
            const { service } = await build(em)
            const after = { createdAt: "2026-10-12T00:00:00Z", id: "y" }

            await expect(
                service.listWorkItems("user-1", "ws-1", queryOf({ statuses: [], after, limit: 1000 })),
            ).resolves.toEqual({ items: [itemOf({ id: "z" })], next: null })
            expect(em.query).toHaveBeenCalledWith(LIST_WORK_ITEMS, ["ws-1", [], "2026-10-12T00:00:00Z", "y", 101, null])
        })
    })

    describe("getWorkItem", () => {
        it("answers the item", async () => {
            const em = mockEntityManager({ query: [FIND_WORK_ITEM_VIEW, [viewOf("item-1")]] })
            const { service } = await build(em)

            await expect(service.getWorkItem("user-1", "ws-1", "item-1")).resolves.toEqual(itemOf())
            expect(em.query).toHaveBeenCalledWith(FIND_WORK_ITEM_VIEW, ["ws-1", "item-1"])
        })

        it("refuses an item that is not in the workspace", async () => {
            const { service } = await build(mockEntityManager({ query: [FIND_WORK_ITEM_VIEW, []] }))

            await expect(service.getWorkItem("user-1", "ws-1", "item-9")).rejects.toMatchObject({
                code: DecisionsErrorCode.NotFound,
            })
        })
    })

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

    describe("saveRule", () => {
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
    })
})
