import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { OfficeLog } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { MessageCatalog } from "@modules/platform/i18n"
import { HiringErrorCode } from "./errors/hiring.error"
import type { HiringSettings } from "./hiring.contracts"
import type { SaveSettingsParams } from "./hiring-operations.contracts"
import { HiringDataService } from "./hiring-data.service"
import { HiringSettingsService } from "./hiring-settings.service"
import { HiringTextService } from "./hiring-text.service"
import { INIT_SETTINGS, SAVE_SETTINGS } from "./persistence/hiring.sql"

const text = (key: string, params: Record<string, string | number> = {}): string => `${key}${JSON.stringify(params)}`

const settingsOf = (overrides: Partial<HiringSettings> = {}): HiringSettings => ({
    workspaceId: "ws-1",
    publicSlug: "shop",
    retentionDays: 90,
    notifyNewCandidate: true,
    remindInterview: true,
    autoCloseWhenFilled: false,
    applyConsentText: "Store my application details",
    adTone: "Clear",
    ...overrides,
})

const outputOf = (overrides: Partial<HiringSettings> = {}) => ({
    publicSlug: "shop",
    retentionDays: 90,
    notifyNewCandidate: true,
    remindInterview: true,
    autoCloseWhenFilled: false,
    applyConsentText: "Store my application details",
    adTone: "Clear",
    ...overrides,
})

const build = async (entityManager: MockEntityManager) => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => text(key, params))
    const words = mock<HiringTextService>()
    words.text.mockImplementation((key, params) => catalog.get(key, params ?? {}, "vi"))
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "user-1",
        workspaceId: "ws-1",
        role: "manager",
        staffId: null,
        displayName: "Alex",
        status: "active",
    })
    const office = mock<OfficeLog>()
    office.workspaceName.mockResolvedValue("Shop")
    const data = mock<HiringDataService>()
    data.settings.mockResolvedValue(settingsOf())
    const moduleRef = await Test.createTestingModule({
        providers: [
            HiringSettingsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: OfficeLog, useValue: office },
            { provide: HiringDataService, useValue: data },
            { provide: HiringTextService, useValue: words },
        ],
    }).compile()
    return { service: moduleRef.get(HiringSettingsService), members, office, data, catalog }
}

describe("HiringSettingsService", () => {
    describe("ensure", () => {
        it("returns existing settings without creating a slug", async () => {
            const em = mockEntityManager()
            const { service, data, office } = await build(em)

            await expect(service.ensure("ws-1")).resolves.toEqual(settingsOf())

            expect(data.settings.mock.calls).toEqual([["ws-1"]])
            expect(office.workspaceName).not.toHaveBeenCalled()
            expect(em.query).not.toHaveBeenCalled()
        })

        it.each([
            ["Shop", "shop"],
            ["!!!", "doanh-nghiep"],
            ["A", "a-vn"],
            ["Admin", "admin-hr"],
            ["S".repeat(45), "s".repeat(40)],
        ])("creates settings from workspace name %s using slug %s", async (name, slug) => {
            const em = mockEntityManager({ query: [INIT_SETTINGS, [{ value: "created" }]] })
            const { service, data, office } = await build(em)
            office.workspaceName.mockResolvedValue(name)
            data.settings.mockResolvedValueOnce(undefined).mockResolvedValue(settingsOf({ publicSlug: slug }))

            await expect(service.ensure("ws-1")).resolves.toEqual(settingsOf({ publicSlug: slug }))

            expect(data.settings.mock.calls).toEqual([["ws-1"], ["ws-1"]])
            expect(office.workspaceName.mock.calls).toEqual([["ws-1"]])
            expect(em.query.mock.calls).toEqual([[INIT_SETTINGS, ["ws-1", slug]]])
        })

        it("reads settings when initialization reports that another caller created them", async () => {
            const em = mockEntityManager({ query: [INIT_SETTINGS, [{ value: "exists" }]] })
            const { service, data } = await build(em)
            data.settings.mockResolvedValueOnce(undefined)

            await expect(service.ensure("ws-1")).resolves.toEqual(settingsOf())

            expect(em.query.mock.calls).toEqual([[INIT_SETTINGS, ["ws-1", "shop"]]])
            expect(data.settings.mock.calls).toEqual([["ws-1"], ["ws-1"]])
        })

        it("retries missing, conflicting and temporarily unreadable rows with numbered slugs", async () => {
            const em = mockEntityManager({
                query: [
                    [INIT_SETTINGS, []],
                    [INIT_SETTINGS, [{ value: "taken" }]],
                    [INIT_SETTINGS, [{ value: "created" }]],
                    [INIT_SETTINGS, [{ value: "exists" }]],
                ],
            })
            const { service, data } = await build(em)
            data.settings
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined)
                .mockResolvedValue(settingsOf({ publicSlug: "shop-4" }))

            await expect(service.ensure("ws-1")).resolves.toEqual(settingsOf({ publicSlug: "shop-4" }))

            expect(em.query.mock.calls).toEqual([
                [INIT_SETTINGS, ["ws-1", "shop"]],
                [INIT_SETTINGS, ["ws-1", "shop-2"]],
                [INIT_SETTINGS, ["ws-1", "shop-3"]],
                [INIT_SETTINGS, ["ws-1", "shop-4"]],
            ])
            expect(data.settings.mock.calls).toEqual([["ws-1"], ["ws-1"], ["ws-1"]])
        })

        it("refuses after exactly twenty unavailable slugs", async () => {
            const em = mockEntityManager({ query: [INIT_SETTINGS, []] })
            const { service, data } = await build(em)
            data.settings.mockResolvedValue(undefined)

            await expect(service.ensure("ws-1")).rejects.toMatchObject({
                code: HiringErrorCode.SettingsSlugUnavailable,
            })

            expect(em.query.mock.calls).toEqual(
                Array.from({ length: 20 }, (_, index) => [
                    INIT_SETTINGS,
                    ["ws-1", index === 0 ? "shop" : `shop-${index + 1}`],
                ]),
            )
            expect(data.settings.mock.calls).toEqual([["ws-1"]])
        })
    })

    describe("read", () => {
        it("requires a manager and returns the public settings fields", async () => {
            const em = mockEntityManager()
            const { service, members } = await build(em)

            await expect(service.read("user-1", "ws-1")).resolves.toEqual(outputOf())

            expect(members.require.mock.calls).toEqual([["user-1", "ws-1", ["owner", "manager"]]])
            expect(em.query).not.toHaveBeenCalled()
        })

        it("propagates membership refusal before reading settings", async () => {
            const { service, members, data } = await build(mockEntityManager())
            const failure = new Error("Membership refused")
            members.require.mockRejectedValue(failure)

            await expect(service.read("user-1", "ws-1")).rejects.toBe(failure)

            expect(data.settings).not.toHaveBeenCalled()
        })
    })

    describe("save", () => {
        it("cleans every supplied field and returns the reloaded settings", async () => {
            const em = mockEntityManager({ query: [SAVE_SETTINGS, [{ value: "saved" }]] })
            const { service, members, data } = await build(em)
            const patch = {
                publicSlug: "new-shop",
                retentionDays: 180,
                notifyNewCandidate: false,
                remindInterview: false,
                autoCloseWhenFilled: true,
                applyConsentText: "Store my application for review",
                adTone: "Friendly",
            }
            data.settings.mockResolvedValueOnce(settingsOf()).mockResolvedValue(settingsOf(patch))

            await expect(
                service.save("user-1", "ws-1", {
                    ...patch,
                    publicSlug: "  New Shop  ",
                    applyConsentText: "  Store my application for review  ",
                    adTone: "  Friendly  ",
                }),
            ).resolves.toEqual(outputOf(patch))

            expect(members.require.mock.calls).toEqual([["user-1", "ws-1", ["owner", "manager"]]])
            expect(em.query.mock.calls).toEqual([[SAVE_SETTINGS, ["ws-1", JSON.stringify(patch)]]])
            expect(data.settings.mock.calls).toEqual([["ws-1"], ["ws-1"]])
        })

        it("saves an empty patch when no fields are supplied and accepts a missing result row", async () => {
            const em = mockEntityManager({ query: [SAVE_SETTINGS, []] })
            const { service } = await build(em)

            await expect(service.save("user-1", "ws-1", {})).resolves.toEqual(outputOf())

            expect(em.query.mock.calls).toEqual([[SAVE_SETTINGS, ["ws-1", "{}"]]])
        })

        it("uses the catalog tone when the supplied tone is blank", async () => {
            const em = mockEntityManager({ query: [SAVE_SETTINGS, [{ value: "saved" }]] })
            const { service, catalog } = await build(em)

            await expect(service.save("user-1", "ws-1", { adTone: "   " })).resolves.toEqual(outputOf())

            expect(em.query.mock.calls).toEqual([[SAVE_SETTINGS, ["ws-1", `{"adTone":"hiring.defaultTone{}"}`]]])
            expect(catalog.get.mock.calls).toEqual([["hiring.defaultTone", {}, "vi"]])
        })

        it("bounds the public slug and ad tone lengths", async () => {
            const em = mockEntityManager({ query: [SAVE_SETTINGS, [{ value: "saved" }]] })
            const { service } = await build(em)

            await expect(
                service.save("user-1", "ws-1", { publicSlug: "S".repeat(70), adTone: "T".repeat(210) }),
            ).resolves.toEqual(outputOf())

            expect(em.query.mock.calls).toEqual([
                [SAVE_SETTINGS, ["ws-1", JSON.stringify({ publicSlug: "s".repeat(60), adTone: "T".repeat(200) })]],
            ])
        })

        it.each([
            [7, 20],
            [730, 800],
        ])("accepts retention %s and consent length %s at the limits", async (retentionDays, length) => {
            const em = mockEntityManager({ query: [SAVE_SETTINGS, [{ value: "saved" }]] })
            const { service } = await build(em)
            const patch = { retentionDays, applyConsentText: "C".repeat(length) }

            await expect(service.save("user-1", "ws-1", patch)).resolves.toEqual(outputOf())

            expect(em.query.mock.calls).toEqual([[SAVE_SETTINGS, ["ws-1", JSON.stringify(patch)]]])
        })

        const invalidPatches: Array<[SaveSettingsParams, HiringErrorCode]> = [
            [{ publicSlug: "ab" }, HiringErrorCode.SlugInvalid],
            [{ publicSlug: "!!!" }, HiringErrorCode.SlugInvalid],
            [{ publicSlug: "Admin" }, HiringErrorCode.SlugReserved],
            [{ retentionDays: 7.5 }, HiringErrorCode.RetentionInvalid],
            [{ retentionDays: 6 }, HiringErrorCode.RetentionInvalid],
            [{ retentionDays: 731 }, HiringErrorCode.RetentionInvalid],
            [{ applyConsentText: "C".repeat(19) }, HiringErrorCode.ConsentTextInvalid],
            [{ applyConsentText: "C".repeat(801) }, HiringErrorCode.ConsentTextInvalid],
        ]

        it.each(invalidPatches)("refuses invalid patch %j with code %s", async (patch, code) => {
            const em = mockEntityManager()
            const { service, members } = await build(em)

            await expect(service.save("user-1", "ws-1", patch)).rejects.toMatchObject({ code })

            expect(members.require.mock.calls).toEqual([["user-1", "ws-1", ["owner", "manager"]]])
            expect(em.query).not.toHaveBeenCalled()
        })

        it("refuses a public slug already taken by another workspace", async () => {
            const em = mockEntityManager({ query: [SAVE_SETTINGS, [{ value: "taken" }]] })
            const { service, data } = await build(em)

            await expect(service.save("user-1", "ws-1", { publicSlug: "other-shop" })).rejects.toMatchObject({
                code: HiringErrorCode.SlugTaken,
            })

            expect(em.query.mock.calls).toEqual([[SAVE_SETTINGS, ["ws-1", `{"publicSlug":"other-shop"}`]]])
            expect(data.settings.mock.calls).toEqual([["ws-1"]])
        })
    })
})
