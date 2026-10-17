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
    INSERT_PROGRAM,
    UPDATE_PROGRAM,
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

    describe("configOf", () => {
        it("answers the rules of the programme, or the defaults when the workspace has none", async () => {
            const found = await build(mockEntityManager({ query: [SELECT_PROGRAM, [ROW]] }))
            const none = await build(mockEntityManager({ query: [SELECT_PROGRAM, []] }))

            await expect(found.configOf("ws-1")).resolves.toEqual(DEFAULT_CONFIG)
            await expect(none.configOf("ws-1")).resolves.toBe(DEFAULT_CONFIG)
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
})

describe("LoyaltyProgramsService", () => {
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

describe("LoyaltyProgramsService", () => {
    describe("save", () => {
        const expected = {
            workspaceId: "ws-1",
            slug: "spa-anna",
            name: "Spa Anna",
            enabled: true,
            config: DEFAULT_CONFIG,
            createdAt: "2026-10-01T00:00:00.000Z",
        }

        it("updates supplied fields with the bounded name and resolved rules", async () => {
            const config = { ...DEFAULT_CONFIG, earn: { ...DEFAULT_CONFIG.earn, perThousandVnd: -3 } }
            const resolved = { ...DEFAULT_CONFIG, earn: { ...DEFAULT_CONFIG.earn, perThousandVnd: 0 } }
            const manager = mockEntityManager({
                query: [UPDATE_PROGRAM, [{ ...ROW, name: "N".repeat(80), enabled: false, config: resolved }]],
            })
            const programs = await build(manager)

            await expect(
                programs.save("ws-1", { name: `  ${"N".repeat(81)}  `, enabled: false, config }),
            ).resolves.toEqual({ ...expected, name: "N".repeat(80), enabled: false, config: resolved })
            expect(manager.query).toHaveBeenCalledTimes(1)
            expect(manager.query).toHaveBeenCalledWith(UPDATE_PROGRAM, [
                "ws-1",
                "N".repeat(80),
                false,
                JSON.stringify(resolved),
            ])
        })

        it("creates a programme from the shop name and default rules for an empty patch", async () => {
            const manager = mockEntityManager({
                query: [
                    [UPDATE_PROGRAM, []],
                    [SELECT_SHOP_NAME, [{ name: "Spa Anna" }]],
                    [INSERT_PROGRAM, [ROW]],
                ],
            })
            const programs = await build(manager)

            await expect(programs.save("ws-1", {})).resolves.toEqual(expected)
            expect(manager.query).toHaveBeenCalledTimes(3)
            expect(manager.query).toHaveBeenNthCalledWith(1, UPDATE_PROGRAM, ["ws-1", null, null, null])
            expect(manager.query).toHaveBeenNthCalledWith(2, SELECT_SHOP_NAME, ["ws-1"])
            expect(manager.query).toHaveBeenNthCalledWith(3, INSERT_PROGRAM, [
                "ws-1",
                "spa-anna",
                "Spa Anna",
                null,
                null,
                JSON.stringify(DEFAULT_CONFIG),
                false,
            ])
        })
    })
})

describe("LoyaltyProgramsService", () => {
    describe("save", () => {
        const expected = {
            workspaceId: "ws-1",
            slug: "spa-anna",
            name: "Spa Anna",
            enabled: true,
            config: DEFAULT_CONFIG,
            createdAt: "2026-10-01T00:00:00.000Z",
        }

        it("uses supplied programme fields and resolved rules on creation", async () => {
            const config = { ...DEFAULT_CONFIG, earn: { ...DEFAULT_CONFIG.earn, perThousandVnd: -3 } }
            const resolved = { ...DEFAULT_CONFIG, earn: { ...DEFAULT_CONFIG.earn, perThousandVnd: 0 } }
            const manager = mockEntityManager({
                query: [
                    [UPDATE_PROGRAM, []],
                    [SELECT_SHOP_NAME, [{ name: "Spa Anna" }]],
                    [INSERT_PROGRAM, [{ ...ROW, name: "N".repeat(80), enabled: false, config: resolved }]],
                ],
            })
            const programs = await build(manager)

            await expect(
                programs.save("ws-1", { name: `  ${"N".repeat(81)}  `, enabled: false, config }),
            ).resolves.toEqual({ ...expected, name: "N".repeat(80), enabled: false, config: resolved })
            expect(manager.query).toHaveBeenCalledWith(INSERT_PROGRAM, [
                "ws-1",
                "spa-anna",
                "Spa Anna",
                "N".repeat(80),
                false,
                JSON.stringify(resolved),
                false,
            ])
        })

        it("updates the programme that another request created before the insert", async () => {
            const manager = mockEntityManager({
                query: [
                    [UPDATE_PROGRAM, []],
                    [UPDATE_PROGRAM, [ROW]],
                    [SELECT_SHOP_NAME, [{ name: "Spa Anna" }]],
                    [INSERT_PROGRAM, []],
                ],
            })
            const programs = await build(manager)

            await expect(programs.save("ws-1", {})).resolves.toEqual(expected)
            expect(manager.query).toHaveBeenCalledTimes(4)
            expect(manager.query).toHaveBeenNthCalledWith(4, UPDATE_PROGRAM, ["ws-1", null, null, null])
        })
    })
})

describe("LoyaltyProgramsService", () => {
    describe("save", () => {
        const expected = {
            workspaceId: "ws-1",
            slug: "spa-anna",
            name: "Spa Anna",
            enabled: true,
            config: DEFAULT_CONFIG,
            createdAt: "2026-10-01T00:00:00.000Z",
        }

        it("retries a conflicting slug with a suffix after finding no raced programme", async () => {
            const manager = mockEntityManager({
                query: [
                    [UPDATE_PROGRAM, []],
                    [SELECT_SHOP_NAME, [{ name: "Spa Anna" }]],
                    [INSERT_PROGRAM, []],
                    [INSERT_PROGRAM, [{ ...ROW, slug: "spa-anna-abcdefgh" }]],
                ],
            })
            const programs = await build(manager)

            await expect(programs.save("ws-1", {})).resolves.toEqual({ ...expected, slug: "spa-anna-abcdefgh" })
            expect(manager.query).toHaveBeenCalledTimes(5)
            expect(manager.query).toHaveBeenNthCalledWith(3, INSERT_PROGRAM, [
                "ws-1",
                "spa-anna",
                "Spa Anna",
                null,
                null,
                JSON.stringify(DEFAULT_CONFIG),
                false,
            ])
            expect(manager.query).toHaveBeenNthCalledWith(4, UPDATE_PROGRAM, ["ws-1", null, null, null])
            expect(manager.query).toHaveBeenNthCalledWith(5, INSERT_PROGRAM, [
                "ws-1",
                "spa-anna",
                "Spa Anna",
                null,
                null,
                JSON.stringify(DEFAULT_CONFIG),
                true,
            ])
        })
    })
})

describe("LoyaltyProgramsService", () => {
    describe("save", () => {
        it("answers null after five failed inserts, checking for a raced programme after each", async () => {
            const manager = mockEntityManager({
                query: [
                    [UPDATE_PROGRAM, []],
                    [SELECT_SHOP_NAME, []],
                    [INSERT_PROGRAM, []],
                ],
            })
            const programs = await build(manager)

            await expect(programs.save("ws-1", {})).resolves.toBeNull()
            expect(manager.query).toHaveBeenCalledTimes(12)
            for (let attempt = 0; attempt < 5; attempt += 1) {
                expect(manager.query).toHaveBeenNthCalledWith(3 + attempt * 2, INSERT_PROGRAM, [
                    "ws-1",
                    "cua-hang",
                    "",
                    null,
                    null,
                    JSON.stringify(DEFAULT_CONFIG),
                    attempt > 0,
                ])
                expect(manager.query).toHaveBeenNthCalledWith(4 + attempt * 2, UPDATE_PROGRAM, [
                    "ws-1",
                    null,
                    null,
                    null,
                ])
            }
        })
    })
})
