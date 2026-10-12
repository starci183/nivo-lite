import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AuthorityService } from "./authority.service"
import type { WorkContext } from "./decisions.contracts"
import type { AuthorityRow, OperatingModeRow, RuleRow } from "./persistence/authority.rows"
import { FIND_AUTHORITY, FIND_OPERATING_MODE, FIND_RULE } from "./persistence/authority.sql"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "An", locale: "en" }

const ruleRowOf = builder<RuleRow>({
    id: "rule-1",
    department: "sales",
    action: "send_follow_up",
    mode: "auto",
    limit_vnd: 20_000_000,
    required_fields: ["contact"],
})

const authorityRowOf = builder<AuthorityRow>({
    policies: "Refunds in 7 days",
    reply_style: "short",
    brand_voice: "warm",
    limits_note: "ask about discounts",
})

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [AuthorityService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(AuthorityService)
}

describe("AuthorityService", () => {
    describe("load", () => {
        it("answers the house rules", async () => {
            const em = mockEntityManager({ query: [FIND_AUTHORITY, [authorityRowOf()]] })
            const service = await build(em)

            await expect(service.load(ctx)).resolves.toEqual(authorityRowOf())
            expect(em.query).toHaveBeenCalledWith(FIND_AUTHORITY, ["ws-1"])
        })

        it("answers null before the owner set any", async () => {
            const service = await build(mockEntityManager({ query: [FIND_AUTHORITY, []] }))

            await expect(service.load(ctx)).resolves.toBeNull()
        })
    })

    describe("ruleFor", () => {
        it("answers null when the owner granted no rule", async () => {
            const service = await build(mockEntityManager({ query: [FIND_RULE, []] }))

            await expect(service.ruleFor(ctx, "send_follow_up", null)).resolves.toBeNull()
        })

        it("answers an ask rule without reading the operating mode", async () => {
            const em = mockEntityManager({ query: [FIND_RULE, [ruleRowOf({ mode: "ask" })]] })
            const service = await build(em)

            await expect(service.ruleFor(ctx, "send_follow_up", null)).resolves.toEqual(ruleRowOf({ mode: "ask" }))
            expect(em.query).toHaveBeenCalledTimes(1)
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

            await expect(service.ruleFor(ctx, "send_follow_up", "inst-1")).resolves.toEqual(ruleRowOf({ mode: "ask" }))
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

            await expect(service.ruleFor(ctx, "send_follow_up", null)).resolves.toEqual(ruleRowOf())
        })

        it("keeps an auto rule when the module has no installation", async () => {
            const service = await build(
                mockEntityManager({
                    query: [
                        [FIND_RULE, [ruleRowOf()]],
                        [FIND_OPERATING_MODE, []],
                    ],
                }),
            )

            await expect(service.ruleFor(ctx, "send_follow_up", null)).resolves.toEqual(ruleRowOf())
        })
    })
})
