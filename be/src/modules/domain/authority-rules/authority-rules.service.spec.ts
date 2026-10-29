import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { AuthorityActionsService } from "@modules/domain/authority-actions"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AuthorityRulesService } from "./authority-rules.service"
import {
    askRuleEntity,
    askRuleForAgentOne,
    askRuleForAgentsOneAndTwo,
    autoRuleForAgentOne,
    changeOf,
    discountApprovalRuleEntity,
    entityOf,
    recordOf,
    ruleOf,
    unlimitedAutoRuleEntity,
} from "@tests/fixtures/builders/authority-rules.builder"
import { AuthorityRulesErrorCode } from "./errors/authority-rules.error"
import { AuthorityRuleEntity } from "./persistence/entities"

const scope = { workspaceId: "ws-1" }

const build = async (entityManager: MockEntityManager, registered = true) => {
    const actions = mock<AuthorityActionsService>()
    actions.registeredUnder.mockResolvedValue(registered)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AuthorityRulesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: AuthorityActionsService, useValue: actions },
        ],
    }).compile()
    return moduleRef.get(AuthorityRulesService)
}

/** The SQL expression the upsert stamps the save moment with. */
const NOW_EXPRESSION: unknown = expect.any(Function)

/** The answer of an upsert that stored these rows. */
const upserted = (...rows: Array<AuthorityRuleEntity>): QueryBuilderAnswers => ({ execute: { raw: rows } })

/** A manager inside a transaction whose query builders answer `answers` in order. */
const saving = (...answers: Array<QueryBuilderAnswers>) => {
    const em = mockEntityManager()
    fakeTransaction(em)
    return { em, fakes: queueQueryBuilders(em, answers) }
}

describe("AuthorityRulesService > ruleFor", () => {
    it("answers null when the owner granted no rule", async () => {
        const service = await build(mockEntityManager({ findOne: [AuthorityRuleEntity, null] }))

        await expect(service.ruleFor(scope, "send_follow_up", null)).resolves.toBeNull()
    })

    it("answers an ask rule without reading the operating mode", async () => {
        const em = mockEntityManager({ findOne: [AuthorityRuleEntity, askRuleEntity()] })
        const service = await build(em)

        await expect(service.ruleFor(scope, "send_follow_up", null)).resolves.toEqual(ruleOf({ mode: "ask" }))
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
        expect(em.findOne).toHaveBeenCalledWith(AuthorityRuleEntity, {
            where: { workspaceId: "ws-1", action: "send_follow_up" },
        })
    })

    it("downgrades an auto rule while the instance assists", async () => {
        const em = mockEntityManager({ findOne: [AuthorityRuleEntity, entityOf()] })
        const [fake] = queueQueryBuilders(em, [{ getRawOne: { operatingMode: "assist" } }])
        const service = await build(em)

        await expect(service.ruleFor(scope, "send_follow_up", "inst-1")).resolves.toEqual(ruleOf({ mode: "ask" }))
        expect(fake?.callsOf("where")).toEqual([
            [
                "i.workspace_id = :workspaceId AND i.module_key = :department",
                { workspaceId: "ws-1", department: "sales" },
            ],
        ])
        expect(fake?.callsOf("andWhere")).toEqual([["i.id = :installationId", { installationId: "inst-1" }]])
    })

    it("keeps an auto rule on autopilot and reads the oldest installation when no instance is named", async () => {
        const em = mockEntityManager({ findOne: [AuthorityRuleEntity, entityOf()] })
        const [fake] = queueQueryBuilders(em, [{ getRawOne: { operatingMode: "autopilot" } }])
        const service = await build(em)

        await expect(service.ruleFor(scope, "send_follow_up", null)).resolves.toEqual(ruleOf())
        expect(fake?.callsOf("andWhere")).toEqual([])
        expect(fake?.callsOf("orderBy")).toEqual([["i.created_at", "ASC"]])
        expect(fake?.callsOf("addOrderBy")).toEqual([["i.id", "ASC"]])
    })

    it("answers a rule that lists agents to one of them", async () => {
        const rule = askRuleForAgentsOneAndTwo()
        const service = await build(mockEntityManager({ findOne: [AuthorityRuleEntity, rule] }))

        await expect(service.ruleFor(scope, "send_follow_up", null, "agent-2")).resolves.toEqual(
            ruleOf({ mode: "ask", agents: ["agent-1", "agent-2"] }),
        )
    })

    it("answers null to an agent the rule does not list, as if the owner granted none", async () => {
        const em = mockEntityManager({ findOne: [AuthorityRuleEntity, autoRuleForAgentOne()] })
        const service = await build(em)

        await expect(service.ruleFor(scope, "send_follow_up", null, "agent-9")).resolves.toBeNull()
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("answers a rule that lists agents to a caller that names none", async () => {
        const rule = askRuleForAgentOne()
        const service = await build(mockEntityManager({ findOne: [AuthorityRuleEntity, rule] }))

        await expect(service.ruleFor(scope, "send_follow_up", null)).resolves.toEqual(
            ruleOf({ mode: "ask", agents: ["agent-1"] }),
        )
    })

    it("keeps an auto rule when the module has no installation", async () => {
        const em = mockEntityManager({ findOne: [AuthorityRuleEntity, entityOf()] })
        queueQueryBuilders(em, [{ getRawOne: undefined }])
        const service = await build(em)

        await expect(service.ruleFor(scope, "send_follow_up", null)).resolves.toEqual(ruleOf())
    })
})

describe("AuthorityRulesService > approvalSetup", () => {
    it("answers the approval side of the rule with the group gathered", async () => {
        const em = mockEntityManager({
            findOne: [AuthorityRuleEntity, discountApprovalRuleEntity()],
        })
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
        expect(em.findOne).toHaveBeenCalledWith(AuthorityRuleEntity, {
            where: { workspaceId: "ws-1", action: "give_discount" },
        })
    })

    it("answers null when the owner granted no rule", async () => {
        const service = await build(mockEntityManager({ findOne: [AuthorityRuleEntity, null] }))

        await expect(service.approvalSetup("ws-1", "give_discount")).resolves.toBeNull()
    })
})

describe("AuthorityRulesService > list", () => {
    it("lists the stored rules", async () => {
        const em = mockEntityManager({ find: [AuthorityRuleEntity, [entityOf()]] })
        const service = await build(em)

        await expect(service.list("ws-1")).resolves.toEqual([recordOf()])
        expect(em.find).toHaveBeenCalledWith(AuthorityRuleEntity, {
            where: { workspaceId: "ws-1" },
            order: { department: "ASC", action: "ASC" },
            take: 500,
        })
    })
})

describe("AuthorityRulesService > save", () => {
    it("saves the rule", async () => {
        const { em, fakes } = saving(upserted(askRuleEntity()))
        const service = await build(em)

        await expect(service.save("ws-1", changeOf())).resolves.toEqual(recordOf({ mode: "ask" }))
        expect(em.createQueryBuilder).toHaveBeenCalledWith(AuthorityRuleEntity, "ar")
        expect(fakes[0]?.callsOf("values")).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    department: "sales",
                    action: "send_follow_up",
                    mode: "ask",
                    limitVnd: 1000,
                    requiredFields: ["contact"],
                    note: "",
                    updatedAt: NOW_EXPRESSION,
                },
            ],
        ])
        expect(fakes[0]?.callsOf("orUpdate")).toEqual([
            [
                ["mode", "limit_vnd", "required_fields", "updated_at"],
                ["workspace_id", "department", "action"],
            ],
        ])
    })
})

describe("AuthorityRulesService > save, approval settings", () => {
    it("saves the bands and approval settings as a patch of the keys the change names, and follows the bands", async () => {
        const { em, fakes } = saving(upserted(unlimitedAutoRuleEntity()))
        const service = await build(em)

        await service.save(
            "ws-1",
            changeOf({
                mode: "ask",
                note: "Be careful",
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

        expect(fakes[0]?.callsOf("values")).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    department: "sales",
                    action: "send_follow_up",
                    mode: "auto",
                    limitVnd: null,
                    requiredFields: ["contact"],
                    note: "Be careful",
                    updatedAt: NOW_EXPRESSION,
                    unit: "percent",
                    autoMax: 3,
                    askMax: 15,
                    approverRoles: ["manager"],
                    approverRooms: ["sales"],
                    approverMembers: ["11111111-1111-4111-8111-111111111111"],
                    approvalPolicy: "sequential",
                    timeoutMinutes: 45,
                    agents: ["22222222-2222-4222-8222-222222222222"],
                },
            ],
        ])
        expect(fakes[0]?.callsOf("orUpdate")).toEqual([
            [
                [
                    "mode",
                    "limit_vnd",
                    "required_fields",
                    "updated_at",
                    "note",
                    "unit",
                    "auto_max",
                    "ask_max",
                    "approver_roles",
                    "approver_rooms",
                    "approver_members",
                    "approval_policy",
                    "timeout_minutes",
                    "agents",
                ],
                ["workspace_id", "department", "action"],
            ],
        ])
    })
})

describe("AuthorityRulesService > save, refusals", () => {
    it("refuses settings that cannot hold before touching the table", async () => {
        const em = mockEntityManager()
        const service = await build(em)

        await expect(service.save("ws-1", changeOf({ auto_max: 20, ask_max: 10 }))).rejects.toMatchObject({
            code: AuthorityRulesErrorCode.InvalidBands,
        })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("refuses an action the registry does not know", async () => {
        const { em } = saving()
        const service = await build(em, false)

        await expect(service.save("ws-1", changeOf())).rejects.toMatchObject({
            code: AuthorityRulesErrorCode.UnknownAction,
            params: { action: "send_follow_up" },
        })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("refuses an action when the upsert stores no row", async () => {
        const { em } = saving(upserted())
        const service = await build(em)

        await expect(service.save("ws-1", changeOf())).rejects.toMatchObject({
            code: AuthorityRulesErrorCode.UnknownAction,
            params: { action: "send_follow_up" },
        })
    })
})

/** The SQL text of the expression a statement set or inserted for `key`. */
const expressionOf = (calls: ReadonlyArray<ReadonlyArray<unknown>> | undefined, key: string): unknown =>
    evaluatedValues(calls?.[0]?.[0])[key]

describe("AuthorityRulesService > save, database clock", () => {
    it("stamps the saved rule with the database time", async () => {
        const { em, fakes } = saving(upserted(askRuleEntity()))
        const service = await build(em)

        await service.save("ws-1", changeOf())

        expect(expressionOf(fakes[0]?.callsOf("values"), "updatedAt")).toBe("now()")
    })

    it("refuses an action when the upsert answers no row list", async () => {
        const { em } = saving({ execute: { raw: undefined } })
        const service = await build(em)

        await expect(service.save("ws-1", changeOf())).rejects.toMatchObject({
            code: AuthorityRulesErrorCode.UnknownAction,
        })
    })
})

describe("AuthorityRulesService > seedDefaults", () => {
    it("inserts the module defaults without changing their fields and keeps the rules the owner set", async () => {
        const rules = [
            { action: "send_follow_up", mode: "ask" as const, limit_vnd: 1000, required_fields: ["contact"] },
            { action: "reply", mode: "auto" as const, limit_vnd: null, required_fields: [] },
        ]
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [{ execute: { raw: [] } }])
        const service = await build(em)

        await expect(service.seedDefaults("ws-1", "sales", rules)).resolves.toBeUndefined()
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
        expect(em.createQueryBuilder).toHaveBeenCalledWith(AuthorityRuleEntity, "ar")
        expect(fake?.callsOf("values")).toEqual([
            [
                [
                    {
                        workspaceId: "ws-1",
                        department: "sales",
                        action: "send_follow_up",
                        mode: "ask",
                        limitVnd: 1000,
                        requiredFields: ["contact"],
                    },
                    {
                        workspaceId: "ws-1",
                        department: "sales",
                        action: "reply",
                        mode: "auto",
                        limitVnd: null,
                        requiredFields: [],
                    },
                ],
            ],
        ])
        expect(fake?.callsOf("orIgnore")).toEqual([[]])
    })

    it("writes nothing when the module has no defaults", async () => {
        const em = mockEntityManager()
        const service = await build(em)

        await expect(service.seedDefaults("ws-1", "sales", [])).resolves.toBeUndefined()
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("AuthorityRulesService > disableForAgent", () => {
    it("switches off the grants of a removed agent through the manager it is given", async () => {
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [{ execute: { raw: [] } }])
        const service = await build(mockEntityManager())

        await expect(service.disableForAgent("ws-1", "agent-1", em)).resolves.toBeUndefined()
        expect(em.createQueryBuilder).toHaveBeenCalledWith(AuthorityRuleEntity, "ar")
        expect(expressionOf(fake?.callsOf("set"), "mode")).toBe(
            "CASE WHEN agents = ARRAY[:agentId::uuid] THEN 'never' ELSE mode END",
        )
        expect(expressionOf(fake?.callsOf("set"), "agents")).toBe(
            "CASE WHEN agents = ARRAY[:agentId::uuid] THEN agents ELSE array_remove(agents, :agentId::uuid) END",
        )
        expect(expressionOf(fake?.callsOf("set"), "updatedAt")).toBe("now()")
        expect(fake?.callsOf("where")).toEqual([
            [
                "workspace_id = :workspaceId AND :agentId::uuid = ANY(agents)",
                { workspaceId: "ws-1", agentId: "agent-1" },
            ],
        ])
    })
})
