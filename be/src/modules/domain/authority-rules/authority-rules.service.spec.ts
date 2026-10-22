import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AuthorityRulesService } from "./authority-rules.service"
import type { RuleChange } from "./authority-rules.contracts"
import { AuthorityRulesErrorCode } from "./errors/authority-rules.error"
import type { ApprovalSetupRow, OperatingModeRow, RuleRecordRow, RuleRow } from "./persistence/authority-rules.rows"
import {
    FIND_APPROVAL_SETUP,
    FIND_OPERATING_MODE,
    FIND_RULE,
    LIST_RULES,
    SEED_DEFAULT_RULES,
    UPSERT_RULE,
} from "./persistence/authority-rules.sql"

const scope = { workspaceId: "ws-1" }

const ruleRowOf = builder<RuleRow>({
    id: "rule-1",
    department: "sales",
    action: "send_follow_up",
    mode: "auto",
    limit_vnd: 20_000_000,
    required_fields: ["contact"],
    unit: "vnd",
    auto_max: null,
    ask_max: null,
    agents: [],
})

const recordOf = builder<RuleRecordRow>({
    ...ruleRowOf(),
    workspace_id: "ws-1",
    note: "",
    updated_at: "2026-10-12T10:00:00.000Z",
    approver_roles: ["owner", "manager"],
    approver_rooms: [],
    approver_members: [],
    approval_policy: "any",
    timeout_minutes: 30,
})

const setupRowOf = builder<ApprovalSetupRow>({
    department: "sales",
    action: "give_discount",
    mode: "auto",
    unit: "percent",
    auto_max: 3,
    ask_max: 15,
    approver_roles: ["manager"],
    approver_rooms: ["sales"],
    approver_members: ["member-9"],
    approval_policy: "sequential",
    timeout_minutes: 45,
    agents: ["agent-1"],
})

const changeOf = builder<RuleChange>({
    action: "send_follow_up",
    department: "sales",
    mode: "ask",
    limit_vnd: 1000,
    required_fields: ["contact"],
    note: null,
})

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [AuthorityRulesService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(AuthorityRulesService)
}

describe("AuthorityRulesService > ruleFor", () => {
    it("answers null when the owner granted no rule", async () => {
        const service = await build(mockEntityManager({ query: [FIND_RULE, []] }))

        await expect(service.ruleFor(scope, "send_follow_up", null)).resolves.toBeNull()
    })

    it("answers an ask rule without reading the operating mode", async () => {
        const em = mockEntityManager({ query: [FIND_RULE, [ruleRowOf({ mode: "ask" })]] })
        const service = await build(em)

        await expect(service.ruleFor(scope, "send_follow_up", null)).resolves.toEqual(ruleRowOf({ mode: "ask" }))
        expect(em.query).toHaveBeenCalledTimes(1)
        expect(em.query).toHaveBeenCalledWith(FIND_RULE, ["ws-1", "send_follow_up"])
    })

    it("downgrades an auto rule while the instance assists", async () => {
        const assist = builder<OperatingModeRow>({ operating_mode: "assist" })
        const em = mockEntityManager({
            query: [
                [FIND_RULE, [ruleRowOf()]],
                [FIND_OPERATING_MODE, [assist()]],
            ],
        })
        const service = await build(em)

        await expect(service.ruleFor(scope, "send_follow_up", "inst-1")).resolves.toEqual(ruleRowOf({ mode: "ask" }))
        expect(em.query).toHaveBeenCalledWith(FIND_OPERATING_MODE, ["ws-1", "sales", "inst-1"])
    })

    it("keeps an auto rule on autopilot", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_RULE, [ruleRowOf()]],
                [FIND_OPERATING_MODE, [{ operating_mode: "autopilot" }]],
            ],
        })
        const service = await build(em)

        await expect(service.ruleFor(scope, "send_follow_up", null)).resolves.toEqual(ruleRowOf())
    })

    it("answers a rule that lists agents to one of them", async () => {
        const rule = ruleRowOf({ mode: "ask", agents: ["agent-1", "agent-2"] })
        const service = await build(mockEntityManager({ query: [FIND_RULE, [rule]] }))

        await expect(service.ruleFor(scope, "send_follow_up", null, "agent-2")).resolves.toEqual(rule)
    })

    it("answers null to an agent the rule does not list, as if the owner granted none", async () => {
        const em = mockEntityManager({ query: [FIND_RULE, [ruleRowOf({ agents: ["agent-1"] })]] })
        const service = await build(em)

        await expect(service.ruleFor(scope, "send_follow_up", null, "agent-9")).resolves.toBeNull()
        expect(em.query).toHaveBeenCalledTimes(1)
    })

    it("answers a rule that lists agents to a caller that names none", async () => {
        const rule = ruleRowOf({ mode: "ask", agents: ["agent-1"] })
        const service = await build(mockEntityManager({ query: [FIND_RULE, [rule]] }))

        await expect(service.ruleFor(scope, "send_follow_up", null)).resolves.toEqual(rule)
    })

    it("keeps an auto rule when the module has no installation", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_RULE, [ruleRowOf()]],
                [FIND_OPERATING_MODE, []],
            ],
        })
        const service = await build(em)

        await expect(service.ruleFor(scope, "send_follow_up", null)).resolves.toEqual(ruleRowOf())
    })
})

describe("AuthorityRulesService > approvalSetup", () => {
    it("answers the approval side of the rule with the group gathered", async () => {
        const em = mockEntityManager({ query: [FIND_APPROVAL_SETUP, [setupRowOf()]] })
        const service = await build(em)

        await expect(service.approvalSetup("ws-1", "give_discount")).resolves.toEqual({
            department: "sales",
            action: "give_discount",
            mode: "auto",
            unit: "percent",
            auto_max: 3,
            ask_max: 15,
            group: { roles: ["manager"], rooms: ["sales"], members: ["member-9"] },
            policy: "sequential",
            timeout_minutes: 45,
            agents: ["agent-1"],
        })
        expect(em.query).toHaveBeenCalledWith(FIND_APPROVAL_SETUP, ["ws-1", "give_discount"])
    })

    it("answers null when the owner granted no rule", async () => {
        const service = await build(mockEntityManager({ query: [FIND_APPROVAL_SETUP, []] }))

        await expect(service.approvalSetup("ws-1", "give_discount")).resolves.toBeNull()
    })
})

describe("AuthorityRulesService > list", () => {
    it("lists the stored rules", async () => {
        const em = mockEntityManager({ query: [LIST_RULES, [recordOf()]] })
        const service = await build(em)

        await expect(service.list("ws-1")).resolves.toEqual([recordOf()])
        expect(em.query).toHaveBeenCalledWith(LIST_RULES, ["ws-1"])
    })
})

describe("AuthorityRulesService > save", () => {
    it("saves the rule", async () => {
        const em = mockEntityManager({ query: [UPSERT_RULE, [recordOf({ mode: "ask" })]] })
        const service = await build(em)

        await expect(service.save("ws-1", changeOf())).resolves.toEqual(recordOf({ mode: "ask" }))
        expect(em.query).toHaveBeenCalledWith(UPSERT_RULE, [
            "ws-1",
            "send_follow_up",
            "ask",
            1000,
            ["contact"],
            "sales",
            null,
            "{}",
        ])
    })

    it("saves the bands and approval settings as a patch of the keys the change names, and follows the bands", async () => {
        const em = mockEntityManager({ query: [UPSERT_RULE, [recordOf({ mode: "auto", limit_vnd: null })]] })
        const service = await build(em)

        await service.save(
            "ws-1",
            changeOf({
                mode: "ask",
                unit: "percent",
                auto_max: 3,
                ask_max: 15,
                approver_roles: ["manager"],
                approver_rooms: ["sales"],
                approver_members: ["11111111-1111-4111-8111-111111111111"],
                approval_policy: "sequential",
                timeout_minutes: 45,
                agents: ["22222222-2222-4222-8222-222222222222"],
            }),
        )

        expect(em.query).toHaveBeenCalledWith(UPSERT_RULE, [
            "ws-1",
            "send_follow_up",
            "auto",
            null,
            ["contact"],
            "sales",
            null,
            JSON.stringify({
                unit: "percent",
                auto_max: 3,
                ask_max: 15,
                approver_roles: ["manager"],
                approver_rooms: ["sales"],
                approver_members: ["11111111-1111-4111-8111-111111111111"],
                approval_policy: "sequential",
                timeout_minutes: 45,
                agents: ["22222222-2222-4222-8222-222222222222"],
            }),
        ])
    })

    it("refuses settings that cannot hold before touching the table", async () => {
        const em = mockEntityManager()
        const service = await build(em)

        await expect(service.save("ws-1", changeOf({ auto_max: 20, ask_max: 10 }))).rejects.toMatchObject({
            code: AuthorityRulesErrorCode.InvalidBands,
        })
        expect(em.query).not.toHaveBeenCalled()
    })

    it("refuses an action the registry does not know", async () => {
        const service = await build(mockEntityManager({ query: [UPSERT_RULE, []] }))

        await expect(service.save("ws-1", changeOf())).rejects.toMatchObject({
            code: AuthorityRulesErrorCode.UnknownAction,
            params: { action: "send_follow_up" },
        })
    })
})

describe("AuthorityRulesService > seedDefaults", () => {
    it("passes the module defaults to the database as JSON without changing their fields", async () => {
        const rules = [
            { action: "send_follow_up", mode: "ask" as const, limit_vnd: 1000, required_fields: ["contact"] },
            { action: "reply", mode: "auto" as const, limit_vnd: null, required_fields: [] },
        ]
        const em = mockEntityManager({ query: [SEED_DEFAULT_RULES, []] })
        const service = await build(em)

        await expect(service.seedDefaults("ws-1", "sales", rules)).resolves.toBeUndefined()
        expect(em.query).toHaveBeenCalledTimes(1)
        expect(em.query).toHaveBeenCalledWith(SEED_DEFAULT_RULES, [
            "ws-1",
            "sales",
            '[{"action":"send_follow_up","mode":"ask","limit_vnd":1000,"required_fields":' +
                '["contact"]},{"action":"reply","mode":"auto","limit_vnd":null,"required_fields":[]}]',
        ])
    })
})
