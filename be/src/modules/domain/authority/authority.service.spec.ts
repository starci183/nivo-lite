import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AuthorityErrorCode } from "./errors/authority.error"
import { AuthorityService } from "./authority.service"
import type { AuthorityProfileRow, AuthorityRow } from "./persistence/authority.rows"
import {
    CREATE_AUTHORITY_IF_MISSING,
    FIND_AUTHORITY,
    FIND_AUTHORITY_PROFILE,
    UPSERT_AUTHORITY,
} from "./persistence/authority.sql"

const authorityRowOf = builder<AuthorityRow>({
    policies: "Refunds in 7 days",
    reply_style: "short",
    brand_voice: "warm",
    limits_note: "ask about discounts",
})

const profileOf = builder<AuthorityProfileRow>({
    ...authorityRowOf(),
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
        it("answers true when it created the empty sheet", async () => {
            const em = mockEntityManager({ query: [CREATE_AUTHORITY_IF_MISSING, [{ workspace_id: "ws-1" }]] })
            const service = await build(em)

            await expect(service.ensureSheet("ws-1")).resolves.toBe(true)
            expect(em.query).toHaveBeenCalledWith(CREATE_AUTHORITY_IF_MISSING, ["ws-1"])
        })

        it("answers false when the workspace already has a sheet", async () => {
            const em = mockEntityManager({ query: [CREATE_AUTHORITY_IF_MISSING, []] })
            const service = await build(em)

            await expect(service.ensureSheet("ws-1")).resolves.toBe(false)
        })
    })

    describe("load", () => {
        it("answers the house rules", async () => {
            const em = mockEntityManager({ query: [FIND_AUTHORITY, [authorityRowOf()]] })
            const service = await build(em)

            await expect(service.load({ workspaceId: "ws-1" })).resolves.toEqual(authorityRowOf())
            expect(em.query).toHaveBeenCalledWith(FIND_AUTHORITY, ["ws-1"])
        })

        it("answers null before the owner set any", async () => {
            const service = await build(mockEntityManager({ query: [FIND_AUTHORITY, []] }))

            await expect(service.load({ workspaceId: "ws-1" })).resolves.toBeNull()
        })
    })

    describe("profileOf", () => {
        it("answers the whole sheet", async () => {
            const em = mockEntityManager({ query: [FIND_AUTHORITY_PROFILE, [profileOf()]] })
            const service = await build(em)

            await expect(service.profileOf("ws-1")).resolves.toEqual(profileOf())
            expect(em.query).toHaveBeenCalledWith(FIND_AUTHORITY_PROFILE, ["ws-1"])
        })

        it("answers null before the owner set any", async () => {
            const service = await build(mockEntityManager({ query: [FIND_AUTHORITY_PROFILE, []] }))

            await expect(service.profileOf("ws-1")).resolves.toBeNull()
        })
    })

    describe("save", () => {
        it("lays the patch over the stored sheet and saves it", async () => {
            const saved = profileOf({ policies: "P2" })
            const em = mockEntityManager({
                query: [
                    [FIND_AUTHORITY_PROFILE, [profileOf()]],
                    [UPSERT_AUTHORITY, [saved]],
                ],
            })
            const service = await build(em)

            await expect(service.save("ws-1", { policies: "P2" }, "Binh")).resolves.toEqual(saved)

            expect(em.query).toHaveBeenCalledWith(UPSERT_AUTHORITY, [
                "ws-1",
                "P2",
                "short",
                "warm",
                "ask about discounts",
                null,
                null,
                null,
                "",
                "Binh",
            ])
        })

        it("creates the sheet when the workspace has none", async () => {
            const em = mockEntityManager({
                query: [
                    [FIND_AUTHORITY_PROFILE, []],
                    [UPSERT_AUTHORITY, [profileOf()]],
                ],
            })
            const service = await build(em)

            await service.save("ws-1", { goal_note: "grow" }, "Binh")

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
                "Binh",
            ])
        })

        it("fails when nothing came back from the save", async () => {
            const em = mockEntityManager({
                query: [
                    [FIND_AUTHORITY_PROFILE, []],
                    [UPSERT_AUTHORITY, []],
                ],
            })
            const service = await build(em)

            await expect(service.save("ws-1", {}, "Binh")).rejects.toMatchObject({
                code: AuthorityErrorCode.NotSaved,
            })
        })
    })
})
