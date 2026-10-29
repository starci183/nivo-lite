import { builder, mockEntityManager } from "@starci/jest-preset"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { entityOf, entityWithRevenueGoal } from "@tests/fixtures/builders/authority.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { Authority, AuthorityProfile } from "./authority.contracts"
import { AuthorityErrorCode } from "./errors/authority.error"
import { AuthorityService } from "./authority.service"
import { AuthorityEntity } from "./persistence/entities"

/** Stands for the `() => "now()"` expression a write hands the database. */
const SQL_EXPRESSION: unknown = expect.any(Function)

const authorityOf = builder<Authority>({
    policies: "Refunds in 7 days",
    reply_style: "short",
    brand_voice: "warm",
    limits_note: "ask about discounts",
})

const profileOf = builder<AuthorityProfile>({
    ...authorityOf(),
    goal_revenue_vnd: null,
    goal_new_customers: null,
    goal_first_reply_minutes: null,
    goal_note: "",
    updated_by: "An",
    updated_at: "2026-10-12T10:00:00.000Z",
})

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [AuthorityService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(AuthorityService)
}

describe("AuthorityService", () => {
    describe("ensureSheet", () => {
        it.each([
            [[{ workspace_id: "ws-1" }], true],
            [[], false],
        ])("answers whether this call created the empty sheet: %j", async (raw, created) => {
            const em = mockEntityManager()
            const fake = fakeQueryBuilder({ execute: { raw } })
            em.createQueryBuilder.mockReturnValue(fake.builder)
            const service = await build(em)

            await expect(service.ensureSheet("ws-1")).resolves.toBe(created)
            expect(fake.callsOf("values")).toEqual([[{ workspaceId: "ws-1", updatedBy: "NIVO" }]])
            expect(fake.callsOf("orIgnore")).toHaveLength(1)
            expect(fake.callsOf("returning")).toEqual([["workspace_id"]])
        })
    })
})

describe("AuthorityService", () => {
    describe("load", () => {
        it("answers the house rules", async () => {
            const em = mockEntityManager({ findOne: [AuthorityEntity, entityOf()] })
            const service = await build(em)

            await expect(service.load({ workspaceId: "ws-1" })).resolves.toEqual(authorityOf())
            expect(em.findOne).toHaveBeenCalledWith(AuthorityEntity, {
                select: { policies: true, replyStyle: true, brandVoice: true, limitsNote: true },
                where: { workspaceId: "ws-1" },
            })
        })

        it("answers null before the owner set any", async () => {
            const service = await build(mockEntityManager({ findOne: [AuthorityEntity, null] }))

            await expect(service.load({ workspaceId: "ws-1" })).resolves.toBeNull()
        })
    })
})

describe("AuthorityService", () => {
    describe("profileOf", () => {
        it("answers the whole sheet", async () => {
            const em = mockEntityManager({ findOne: [AuthorityEntity, entityWithRevenueGoal()] })
            const service = await build(em)

            await expect(service.profileOf("ws-1")).resolves.toEqual(profileOf({ goal_revenue_vnd: 5000000 }))
            expect(em.findOne).toHaveBeenCalledWith(AuthorityEntity, { where: { workspaceId: "ws-1" } })
        })

        it("answers null before the owner set any", async () => {
            const service = await build(mockEntityManager({ findOne: [AuthorityEntity, null] }))

            await expect(service.profileOf("ws-1")).resolves.toBeNull()
        })
    })
})

describe("AuthorityService", () => {
    describe("save", () => {
        it("lays the patch over the stored sheet and saves it", async () => {
            const saved = Object.assign(entityOf(), { policies: "P2", goalRevenueVnd: "5000000", updatedBy: "Binh" })
            const em = mockEntityManager({
                findOne: [
                    [AuthorityEntity, entityOf()],
                    [AuthorityEntity, saved],
                ],
                upsert: [AuthorityEntity, {}],
            })
            const service = await build(em)

            await expect(service.save("ws-1", { policies: "P2" }, "Binh")).resolves.toEqual(
                profileOf({ policies: "P2", updated_by: "Binh", goal_revenue_vnd: 5000000 }),
            )

            const stamp = { policies: "P2", updatedBy: "Binh", updatedAt: SQL_EXPRESSION }
            expect(em.upsert).toHaveBeenCalledWith(
                AuthorityEntity,
                expect.objectContaining({ workspaceId: "ws-1", replyStyle: "short", goalRevenueVnd: null, ...stamp }),
                ["workspaceId"],
            )
        })

        it("creates the sheet when the workspace has none", async () => {
            const em = mockEntityManager({
                findOne: [
                    [AuthorityEntity, null],
                    [AuthorityEntity, Object.assign(entityOf(), { goalNote: "grow" })],
                ],
                upsert: [AuthorityEntity, {}],
            })
            const service = await build(em)

            await service.save("ws-1", { goal_note: "grow" }, "Binh")

            expect(em.upsert).toHaveBeenCalledWith(
                AuthorityEntity,
                expect.objectContaining({
                    policies: "",
                    replyStyle: "",
                    brandVoice: "",
                    limitsNote: "",
                    goalNote: "grow",
                    updatedBy: "Binh",
                }),
                ["workspaceId"],
            )
        })
    })
})

describe("AuthorityService", () => {
    describe("save", () => {
        it("stores the revenue goal as text and stamps the save with the database time", async () => {
            const em = mockEntityManager({
                findOne: [AuthorityEntity, entityWithRevenueGoal()],
                upsert: [AuthorityEntity, {}],
            })
            const service = await build(em)

            await service.save("ws-1", {}, "Binh")

            const values = em.upsert.mock.calls[0]?.[1]
            expect(evaluatedValues(values).goalRevenueVnd).toBe("5000000")
            expect(evaluatedValues(values).updatedAt).toBe("now()")
        })

        it("fails when the saved sheet cannot be read back", async () => {
            const em = mockEntityManager({ findOne: [AuthorityEntity, null], upsert: [AuthorityEntity, {}] })
            const service = await build(em)

            await expect(service.save("ws-1", {}, "Binh")).rejects.toMatchObject({
                code: AuthorityErrorCode.NotSaved,
            })
        })
    })
})
