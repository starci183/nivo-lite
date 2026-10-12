import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type {
    AuthorityProfile,
    AuthorityRuleRecord,
    ListWorkItemsQuery,
    RuleChange,
    WorkItem,
} from "./decisions.contracts"
import { DecisionsService } from "./decisions.service"
import { DecisionsErrorCode } from "./errors/decisions.error"
import { EvidenceService } from "./evidence.service"
import { FIND_AUTHORITY_PROFILE, LIST_RULES, UPSERT_AUTHORITY, UPSERT_RULE } from "./persistence/authority.sql"
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
})

const queryOf = builder<ListWorkItemsQuery>({ statuses: ["waiting_decision"], after: null, limit: 2 })

const build = async (entityManager: MockEntityManager) => {
    const members = mock<WorkspaceMembersService>({ require: jest.fn().mockResolvedValue(memberOf()) })
    const evidence = mock<EvidenceService>({ log: jest.fn().mockResolvedValue(undefined) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            DecisionsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: EvidenceService, useValue: evidence },
        ],
    }).compile()
    return { service: moduleRef.get(DecisionsService), members, evidence }
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
            expect(em.query).toHaveBeenCalledWith(LIST_WORK_ITEMS, ["ws-1", ["waiting_decision"], null, null, 3])
        })

        it("continues after a cursor and clamps the page size", async () => {
            const em = mockEntityManager({ query: [LIST_WORK_ITEMS, [viewOf("z")]] })
            const { service } = await build(em)
            const after = { createdAt: "2026-10-12T00:00:00Z", id: "y" }

            await expect(
                service.listWorkItems("user-1", "ws-1", queryOf({ statuses: [], after, limit: 1000 })),
            ).resolves.toEqual({ items: [itemOf({ id: "z" })], next: null })
            expect(em.query).toHaveBeenCalledWith(LIST_WORK_ITEMS, ["ws-1", [], "2026-10-12T00:00:00Z", "y", 101])
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
            const em = mockEntityManager({
                query: [
                    [FIND_AUTHORITY_PROFILE, [profileOf()]],
                    [LIST_RULES, [ruleOf()]],
                ],
            })
            const { service, members } = await build(em)

            await expect(service.readAuthority("user-1", "ws-1")).resolves.toEqual({
                profile: profileOf(),
                rules: [ruleOf()],
            })
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
        })

        it("answers no sheet before the workspace has one", async () => {
            const em = mockEntityManager({
                query: [
                    [FIND_AUTHORITY_PROFILE, []],
                    [LIST_RULES, []],
                ],
            })
            const { service } = await build(em)

            await expect(service.readAuthority("user-1", "ws-1")).resolves.toEqual({ profile: null, rules: [] })
        })
    })

    describe("updateAuthority", () => {
        it("merges the patch over the stored sheet, saves it and logs it", async () => {
            const saved = profileOf({ policies: "P2" })
            const em = mockEntityManager({
                query: [
                    [FIND_AUTHORITY_PROFILE, [profileOf()]],
                    [UPSERT_AUTHORITY, [saved]],
                ],
            })
            const { service, evidence } = await build(em)

            await expect(service.updateAuthority("user-1", "ws-1", { policies: "P2" })).resolves.toEqual(saved)

            expect(em.query).toHaveBeenCalledWith(UPSERT_AUTHORITY, [
                "ws-1",
                "P2",
                "R",
                "B",
                "L",
                null,
                null,
                null,
                "",
                "An",
            ])
            expect(evidence.log).toHaveBeenCalledWith(
                { workspaceId: "ws-1", actor: "An", locale: "en" },
                { kind: "authority.updated", actor: "An", summary: "policies" },
            )
        })

        it("creates the sheet when the workspace has none", async () => {
            const em = mockEntityManager({
                query: [
                    [FIND_AUTHORITY_PROFILE, []],
                    [UPSERT_AUTHORITY, [profileOf()]],
                ],
            })
            const { service } = await build(em)

            await service.updateAuthority("user-1", "ws-1", { goal_note: "grow" })

            expect(em.query).toHaveBeenCalledWith(UPSERT_AUTHORITY, [
                "ws-1",
                "",
                "",
                "",
                "",
                null,
                null,
                null,
                "grow",
                "An",
            ])
        })

        it("refuses when nothing came back from the save", async () => {
            const em = mockEntityManager({
                query: [
                    [FIND_AUTHORITY_PROFILE, []],
                    [UPSERT_AUTHORITY, []],
                ],
            })
            const { service } = await build(em)

            await expect(service.updateAuthority("user-1", "ws-1", {})).rejects.toMatchObject({
                code: DecisionsErrorCode.NotFound,
            })
        })
    })

    describe("saveRule", () => {
        it("saves the rule and logs it with its limit", async () => {
            const em = mockEntityManager({ query: [UPSERT_RULE, [ruleOf()]] })
            const { service, evidence } = await build(em)

            await expect(service.saveRule("user-1", "ws-1", changeOf())).resolves.toEqual(ruleOf())

            expect(em.query).toHaveBeenCalledWith(UPSERT_RULE, ["ws-1", "confirm_order", "ask", 1000, ["customer"]])
            expect(evidence.log).toHaveBeenCalledWith(
                { workspaceId: "ws-1", actor: "An", locale: "en" },
                { kind: "authority.rule_updated", actor: "An", summary: "sales.confirm_order -> ask < 1000" },
            )
        })

        it("logs a rule without a limit plainly", async () => {
            const em = mockEntityManager({ query: [UPSERT_RULE, [ruleOf({ limit_vnd: null })]] })
            const { service, evidence } = await build(em)

            await service.saveRule("user-1", "ws-1", changeOf({ limit_vnd: null }))

            expect(evidence.log).toHaveBeenCalledWith(
                { workspaceId: "ws-1", actor: "An", locale: "en" },
                { kind: "authority.rule_updated", actor: "An", summary: "sales.confirm_order -> ask" },
            )
        })

        it("refuses an action the registry does not know", async () => {
            const { service, evidence } = await build(mockEntityManager({ query: [UPSERT_RULE, []] }))

            await expect(service.saveRule("user-1", "ws-1", changeOf())).rejects.toMatchObject({
                code: DecisionsErrorCode.UnknownAction,
                params: { action: "confirm_order" },
            })
            expect(evidence.log).not.toHaveBeenCalled()
        })
    })
})
