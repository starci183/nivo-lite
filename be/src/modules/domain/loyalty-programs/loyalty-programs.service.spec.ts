import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { WorkspacesService } from "@modules/domain/workspaces"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { LoyaltyProgramsService } from "./loyalty-programs.service"
import { LoyaltyProgramEntity } from "./persistence/entities"
import { DEFAULT_CONFIG } from "./policies/loyalty-config.policy"

const ROW = Object.assign(new LoyaltyProgramEntity(), {
    workspaceId: "ws-1",
    slug: "spa-anna",
    name: "Spa Anna",
    enabled: true,
    config: {},
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
})

const WRITTEN = (row: object): QueryBuilderAnswers => ({ execute: { raw: [row] } })
const NOTHING: QueryBuilderAnswers = { execute: { raw: [] } }
const installed = (status: string): InstallationRecord => Object.assign(mock<InstallationRecord>(), { status })

const installations = mock<InstallationRecordsService>()
const workspaces = mock<WorkspacesService>()

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            LoyaltyProgramsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: WorkspacesService, useValue: workspaces },
        ],
    }).compile()
    return moduleRef.get(LoyaltyProgramsService)
}

beforeEach(() => {
    workspaces.nameOf.mockResolvedValue("Spa Anna")
})

const FOUND = {
    workspaceId: "ws-1",
    slug: "spa-anna",
    name: "Spa Anna",
    enabled: true,
    config: DEFAULT_CONFIG,
    createdAt: "2026-10-01T00:00:00.000Z",
}

describe("LoyaltyProgramsService", () => {
    describe("find", () => {
        it("answers the programme of the workspace with its rules resolved", async () => {
            const em = mockEntityManager({ findOne: [LoyaltyProgramEntity, ROW] })
            const programs = await build(em)

            await expect(programs.find("ws-1")).resolves.toEqual(FOUND)
            expect(em.findOne).toHaveBeenCalledWith(LoyaltyProgramEntity, { where: { workspaceId: "ws-1" } })
        })

        it("answers null when the workspace has none", async () => {
            const programs = await build(mockEntityManager({ findOne: [LoyaltyProgramEntity, null] }))

            await expect(programs.find("ws-1")).resolves.toBeNull()
        })
    })

    describe("configOf", () => {
        it("answers the rules of the programme, or the defaults when the workspace has none", async () => {
            const found = await build(mockEntityManager({ findOne: [LoyaltyProgramEntity, ROW] }))
            const none = await build(mockEntityManager({ findOne: [LoyaltyProgramEntity, null] }))

            await expect(found.configOf("ws-1")).resolves.toEqual(DEFAULT_CONFIG)
            await expect(none.configOf("ws-1")).resolves.toBe(DEFAULT_CONFIG)
        })
    })

    describe("findBySlug", () => {
        it("answers the switched-on programme of the slug, or null", async () => {
            const em = mockEntityManager({
                findOne: [
                    [LoyaltyProgramEntity, ROW],
                    [LoyaltyProgramEntity, null],
                ],
            })
            const programs = await build(em)

            await expect(programs.findBySlug("spa-anna")).resolves.toMatchObject({ workspaceId: "ws-1" })
            await expect(programs.findBySlug("nobody")).resolves.toBeNull()
            expect(em.findOne).toHaveBeenNthCalledWith(1, LoyaltyProgramEntity, {
                where: { slug: "spa-anna", enabled: true },
            })
        })
    })
})

describe("LoyaltyProgramsService", () => {
    describe("findActive", () => {
        it("answers the programme when the module runs and the owner switched it on", async () => {
            const em = mockEntityManager({ findOne: [LoyaltyProgramEntity, ROW] })
            installations.firstOfModule.mockResolvedValue(installed("ready"))
            const programs = await build(em)

            await expect(programs.findActive("ws-1")).resolves.toMatchObject({ slug: "spa-anna" })
            expect(installations.firstOfModule).toHaveBeenCalledWith("ws-1", "loyalty")
        })

        it("answers null when the module is not installed or is paused", async () => {
            const em = mockEntityManager()
            installations.firstOfModule.mockResolvedValueOnce(null).mockResolvedValueOnce(installed("paused"))
            const programs = await build(em)

            await expect(programs.findActive("ws-1")).resolves.toBeNull()
            await expect(programs.findActive("ws-1")).resolves.toBeNull()
        })

        it("answers null when the programme is off or was never created", async () => {
            const off = mockEntityManager({
                findOne: [LoyaltyProgramEntity, Object.assign(new LoyaltyProgramEntity(), { ...ROW, enabled: false })],
            })
            installations.firstOfModule.mockResolvedValue(installed("ready"))
            const none = mockEntityManager({ findOne: [LoyaltyProgramEntity, null] })

            await expect((await build(off)).findActive("ws-1")).resolves.toBeNull()
            await expect((await build(none)).findActive("ws-1")).resolves.toBeNull()
        })
    })

    describe("shopName", () => {
        it("answers the name of the workspace, empty when it is gone", async () => {
            const programs = await build(mockEntityManager())
            workspaces.nameOf.mockResolvedValueOnce("Spa Anna").mockResolvedValueOnce("")

            await expect(programs.shopName("ws-1")).resolves.toBe("Spa Anna")
            await expect(programs.shopName("ws-1")).resolves.toBe("")
            expect(workspaces.nameOf).toHaveBeenCalledWith("ws-1")
        })
    })
})

const UPDATE_PARAMS = (name: string | null, enabled: boolean | null, config: string | null) => [
    [{ name, enabled, config }],
]

const INSERT_PARAMS = (
    name: string | null,
    enabled: boolean | null,
    config: string,
    suffix: boolean,
    shop = "Spa Anna",
) => [[{ slug: shop === "" ? "cua-hang" : "spa-anna", shop, suffix, name, enabled, config }]]

describe("LoyaltyProgramsService", () => {
    describe("save", () => {
        it("updates supplied fields with the bounded name and resolved rules", async () => {
            const config = { ...DEFAULT_CONFIG, earn: { ...DEFAULT_CONFIG.earn, perThousandVnd: -3 } }
            const resolved = { ...DEFAULT_CONFIG, earn: { ...DEFAULT_CONFIG.earn, perThousandVnd: 0 } }
            const em = mockEntityManager()
            const [update] = queueQueryBuilders(em, [
                WRITTEN({ ...ROW, name: "N".repeat(80), enabled: false, config: resolved }),
            ])
            const programs = await build(em)

            await expect(
                programs.save("ws-1", { name: `  ${"N".repeat(81)}  `, enabled: false, config }),
            ).resolves.toEqual({ ...FOUND, name: "N".repeat(80), enabled: false, config: resolved })
            expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
            expect(update?.callsOf("update")).toEqual([[]])
            expect(evaluatedValues(update?.callsOf("set")[0]?.[0])).toEqual({
                name: "COALESCE(CAST(:name AS text), name)",
                enabled: "COALESCE(CAST(:enabled AS boolean), enabled)",
                config: "COALESCE(CAST(:config AS jsonb), config)",
                updatedAt: "now()",
            })
            expect(update?.callsOf("where")).toEqual([["workspace_id = :workspaceId", { workspaceId: "ws-1" }]])
            expect(update?.callsOf("setParameters")).toEqual(
                UPDATE_PARAMS("N".repeat(80), false, JSON.stringify(resolved)),
            )
        })

        it("creates a programme from the shop name and default rules for an empty patch", async () => {
            const em = mockEntityManager()
            const [update, insert] = queueQueryBuilders(em, [NOTHING, WRITTEN(ROW)])
            const programs = await build(em)

            await expect(programs.save("ws-1", {})).resolves.toEqual(FOUND)
            expect(em.createQueryBuilder).toHaveBeenCalledTimes(2)
            expect(update?.callsOf("setParameters")).toEqual(UPDATE_PARAMS(null, null, null))
            expect(workspaces.nameOf).toHaveBeenCalledWith("ws-1")
            expect(insert?.callsOf("insert")).toEqual([[]])
            expect(evaluatedValues(insert?.callsOf("values")[0]?.[0])).toEqual({
                workspaceId: "ws-1",
                slug: "CASE WHEN CAST(:suffix AS boolean) THEN CAST(:slug AS text) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8) ELSE CAST(:slug AS text) END",
                name: "COALESCE(CAST(:name AS text), CAST(:shop AS text))",
                enabled: "COALESCE(CAST(:enabled AS boolean), true)",
                config: "CAST(:config AS jsonb)",
            })
            expect(insert?.callsOf("setParameters")).toEqual(
                INSERT_PARAMS(null, null, JSON.stringify(DEFAULT_CONFIG), false),
            )
            expect(insert?.callsOf("orIgnore")).toHaveLength(1)
        })
    })
})

describe("LoyaltyProgramsService", () => {
    describe("save", () => {
        it("uses supplied programme fields and resolved rules on creation", async () => {
            const config = { ...DEFAULT_CONFIG, earn: { ...DEFAULT_CONFIG.earn, perThousandVnd: -3 } }
            const resolved = { ...DEFAULT_CONFIG, earn: { ...DEFAULT_CONFIG.earn, perThousandVnd: 0 } }
            const em = mockEntityManager()
            const [, insert] = queueQueryBuilders(em, [
                NOTHING,
                WRITTEN({ ...ROW, name: "N".repeat(80), enabled: false, config: resolved }),
            ])
            const programs = await build(em)

            await expect(
                programs.save("ws-1", { name: `  ${"N".repeat(81)}  `, enabled: false, config }),
            ).resolves.toEqual({ ...FOUND, name: "N".repeat(80), enabled: false, config: resolved })
            expect(insert?.callsOf("setParameters")).toEqual(
                INSERT_PARAMS("N".repeat(80), false, JSON.stringify(resolved), false),
            )
        })

        it("updates the programme that another request created before the insert", async () => {
            const em = mockEntityManager()
            const [, , raced] = queueQueryBuilders(em, [NOTHING, NOTHING, WRITTEN(ROW)])
            const programs = await build(em)

            await expect(programs.save("ws-1", {})).resolves.toEqual(FOUND)
            expect(em.createQueryBuilder).toHaveBeenCalledTimes(3)
            expect(raced?.callsOf("setParameters")).toEqual(UPDATE_PARAMS(null, null, null))
        })
    })
})

describe("LoyaltyProgramsService", () => {
    describe("save", () => {
        it("retries a conflicting slug with a suffix after finding no raced programme", async () => {
            const em = mockEntityManager()
            const [, first, raced, retry] = queueQueryBuilders(em, [
                NOTHING,
                NOTHING,
                NOTHING,
                WRITTEN({ ...ROW, slug: "spa-anna-abcdefgh" }),
            ])
            const programs = await build(em)

            await expect(programs.save("ws-1", {})).resolves.toEqual({ ...FOUND, slug: "spa-anna-abcdefgh" })
            expect(em.createQueryBuilder).toHaveBeenCalledTimes(4)
            expect(first?.callsOf("setParameters")).toEqual(
                INSERT_PARAMS(null, null, JSON.stringify(DEFAULT_CONFIG), false),
            )
            expect(raced?.callsOf("setParameters")).toEqual(UPDATE_PARAMS(null, null, null))
            expect(retry?.callsOf("setParameters")).toEqual(
                INSERT_PARAMS(null, null, JSON.stringify(DEFAULT_CONFIG), true),
            )
        })
    })
})

describe("LoyaltyProgramsService", () => {
    describe("save", () => {
        it("answers null after five failed inserts, checking for a raced programme after each", async () => {
            const em = mockEntityManager()
            const fakes = queueQueryBuilders(em, [NOTHING, ...Array.from({ length: 10 }, () => NOTHING)])
            workspaces.nameOf.mockResolvedValue("")
            const programs = await build(em)

            await expect(programs.save("ws-1", {})).resolves.toBeNull()
            expect(em.createQueryBuilder).toHaveBeenCalledTimes(11)
            for (let attempt = 0; attempt < 5; attempt += 1) {
                expect(fakes[1 + attempt * 2]?.callsOf("setParameters")).toEqual(
                    INSERT_PARAMS(null, null, JSON.stringify(DEFAULT_CONFIG), attempt > 0, ""),
                )
                expect(fakes[2 + attempt * 2]?.callsOf("setParameters")).toEqual(UPDATE_PARAMS(null, null, null))
            }
        })
    })
})
