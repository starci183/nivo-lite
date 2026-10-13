import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AuthorityRulesService } from "./authority-rules.service"
import type { RuleChange } from "./authority-rules.contracts"
import { AuthorityRulesErrorCode } from "./errors/authority-rules.error"
import type { OperatingModeRow, RuleRecordRow, RuleRow } from "./persistence/authority-rules.rows"
import { FIND_OPERATING_MODE, FIND_RULE, LIST_RULES, UPSERT_RULE } from "./persistence/authority-rules.sql"

const scope = { workspaceId: "ws-1" }

const ruleRowOf = builder<RuleRow>({
    id: "rule-1",
    department: "sales",
    action: "send_follow_up",
    mode: "auto",
    limit_vnd: 20_000_000,
    required_fields: ["contact"],
})

const recordOf = builder<RuleRecordRow>({
    ...ruleRowOf(),
    workspace_id: "ws-1",
    note: "",
    updated_at: "2026-10-12T10:00:00.000Z",
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

describe("AuthorityRulesService", () => {
    describe("ruleFor", () => {
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

            await expect(service.ruleFor(scope, "send_follow_up", "inst-1")).resolves.toEqual(
                ruleRowOf({ mode: "ask" }),
            )
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

    describe("list", () => {
        it("lists the stored rules", async () => {
            const em = mockEntityManager({ query: [LIST_RULES, [recordOf()]] })
            const service = await build(em)

            await expect(service.list("ws-1")).resolves.toEqual([recordOf()])
            expect(em.query).toHaveBeenCalledWith(LIST_RULES, ["ws-1"])
        })
    })

    describe("save", () => {
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
            ])
        })

        it("refuses an action the registry does not know", async () => {
            const service = await build(mockEntityManager({ query: [UPSERT_RULE, []] }))

            await expect(service.save("ws-1", changeOf())).rejects.toMatchObject({
                code: AuthorityRulesErrorCode.UnknownAction,
                params: { action: "send_follow_up" },
            })
        })
    })
})
