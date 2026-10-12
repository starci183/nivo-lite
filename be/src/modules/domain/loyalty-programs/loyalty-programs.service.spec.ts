import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LoyaltyProgramsService } from "./loyalty-programs.service"
import {
    SELECT_MODULE_STATUS,
    SELECT_PROGRAM,
    SELECT_PROGRAM_BY_SLUG,
    SELECT_SHOP_NAME,
} from "./persistence/loyalty-programs.sql"
import { DEFAULT_CONFIG } from "./policies/loyalty-config.policy"

const ROW = {
    workspace_id: "ws-1",
    slug: "spa-anna",
    name: "Spa Anna",
    enabled: true,
    config: {},
    created_at: new Date("2026-10-01T00:00:00.000Z"),
}

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [LoyaltyProgramsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(LoyaltyProgramsService)
}

describe("LoyaltyProgramsService", () => {
    describe("find", () => {
        it("answers the programme of the workspace with its rules resolved", async () => {
            const programs = await build(mockEntityManager({ query: [SELECT_PROGRAM, [ROW]] }))

            await expect(programs.find("ws-1")).resolves.toEqual({
                workspaceId: "ws-1",
                slug: "spa-anna",
                name: "Spa Anna",
                enabled: true,
                config: DEFAULT_CONFIG,
                createdAt: "2026-10-01T00:00:00.000Z",
            })
        })

        it("answers null when the workspace has none", async () => {
            const programs = await build(mockEntityManager({ query: [SELECT_PROGRAM, []] }))

            await expect(programs.find("ws-1")).resolves.toBeNull()
        })
    })

    describe("findBySlug", () => {
        it("answers the switched-on programme of the slug, or null", async () => {
            const found = await build(mockEntityManager({ query: [SELECT_PROGRAM_BY_SLUG, [ROW]] }))
            const missing = await build(mockEntityManager({ query: [SELECT_PROGRAM_BY_SLUG, []] }))

            await expect(found.findBySlug("spa-anna")).resolves.toMatchObject({ workspaceId: "ws-1" })
            await expect(missing.findBySlug("nobody")).resolves.toBeNull()
        })
    })

    describe("findActive", () => {
        it("answers the programme when the module runs and the owner switched it on", async () => {
            const programs = await build(
                mockEntityManager({
                    query: [
                        [SELECT_MODULE_STATUS, [{ status: "active" }]],
                        [SELECT_PROGRAM, [ROW]],
                    ],
                }),
            )

            await expect(programs.findActive("ws-1")).resolves.toMatchObject({ slug: "spa-anna" })
        })

        it("answers null when the module is not installed or is paused", async () => {
            const absent = await build(mockEntityManager({ query: [SELECT_MODULE_STATUS, []] }))
            const paused = await build(mockEntityManager({ query: [SELECT_MODULE_STATUS, [{ status: "paused" }]] }))

            await expect(absent.findActive("ws-1")).resolves.toBeNull()
            await expect(paused.findActive("ws-1")).resolves.toBeNull()
        })

        it("answers null when the programme is off or was never created", async () => {
            const off = await build(
                mockEntityManager({
                    query: [
                        [SELECT_MODULE_STATUS, [{ status: "active" }]],
                        [SELECT_PROGRAM, [{ ...ROW, enabled: false }]],
                    ],
                }),
            )
            const none = await build(
                mockEntityManager({
                    query: [
                        [SELECT_MODULE_STATUS, [{ status: "active" }]],
                        [SELECT_PROGRAM, []],
                    ],
                }),
            )

            await expect(off.findActive("ws-1")).resolves.toBeNull()
            await expect(none.findActive("ws-1")).resolves.toBeNull()
        })
    })

    describe("shopName", () => {
        it("answers the name of the workspace, empty when it is gone", async () => {
            const found = await build(mockEntityManager({ query: [SELECT_SHOP_NAME, [{ name: "Spa Anna" }]] }))
            const gone = await build(mockEntityManager({ query: [SELECT_SHOP_NAME, []] }))

            await expect(found.shopName("ws-1")).resolves.toBe("Spa Anna")
            await expect(gone.shopName("ws-1")).resolves.toBe("")
        })
    })
})
