import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ContentCadenceService } from "@modules/domain/content-cadence"
import type { ContentCadenceDraft } from "@modules/domain/content-cadence"
import { ContentPillarsService } from "@modules/domain/content-pillars"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ContentConfigurationService } from "./content-configuration.service"
import { CONTENT_CADENCE_PRESETS } from "./content-configuration.templates"
import { ContentSettingsErrorCode } from "./errors/content-settings.error"
import {
    ENSURE_CONFIGURATION,
    LOCK_CONFIGURATION,
    SAVE_CONFIGURATION_BRAND,
    SELECT_CONFIGURATION_BRAND,
    SET_CONFIGURATION_AUTOMATION,
} from "./persistence/content-configuration.sql"

const EMPTY_SETTINGS = {
    workspaceId: "ws-1",
    brandVoice: "",
    avoid: "",
    cta: "",
    hashtags: [],
    automations: { today_reminder: false, offer_draft: false, weekly_summary: false },
    marks: {},
}

const build = async (
    em: MockEntityManager = mockEntityManager({
        query: [
            [SAVE_CONFIGURATION_BRAND, []],
            [SET_CONFIGURATION_AUTOMATION, []],
            [
                SELECT_CONFIGURATION_BRAND,
                [
                    {
                        workspace_id: "ws-1",
                        brand_voice: "warm",
                        avoid: "slang",
                        cta: "Book",
                        hashtags: ["#tea", "#coffee"],
                        automations: { today_reminder: true },
                        marks: { week: "2026-10-12" },
                    },
                ],
            ],
        ],
    }),
) => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "user-1",
        workspaceId: "ws-1",
        role: "owner",
        staffId: null,
        displayName: "An",
        status: "active",
    })
    const pillars = mock<ContentPillarsService>()
    pillars.list.mockResolvedValue([])
    const cadence = mock<ContentCadenceService>()
    cadence.list.mockResolvedValue([])
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key: string) => key)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContentConfigurationService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ContentPillarsService, useValue: pillars },
            { provide: ContentCadenceService, useValue: cadence },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()
    return { settings: moduleRef.get(ContentConfigurationService), em, members, pillars, cadence, catalog }
}

describe("ContentConfigurationService", () => {
    it("reads empty themes and the stored brand after membership is proved", async () => {
        const { settings, members } = await build()

        await expect(settings.readConfiguration("user-1", "ws-1")).resolves.toEqual({
            pillars: [],
            cadence: [],
            settings: {
                workspaceId: "ws-1",
                brandVoice: "warm",
                avoid: "slang",
                cta: "Book",
                hashtags: ["#tea", "#coffee"],
                automations: { today_reminder: true, offer_draft: false, weekly_summary: false },
                marks: { week: "2026-10-12" },
            },
        })

        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
    })

    it("refuses a theme list that repeats a name", async () => {
        const { settings } = await build()

        await expect(
            settings.savePillars("user-1", "ws-1", [
                { name: "Tea", description: "", weight: 1, active: true },
                { name: " tea ", description: "", weight: 1, active: true },
            ]),
        ).rejects.toMatchObject({ code: ContentSettingsErrorCode.Duplicate })
    })

    it("saves the brand voice and at most the distinct hashtags", async () => {
        const { settings, em } = await build()

        await expect(
            settings.saveBrand("user-1", "ws-1", {
                brandVoice: " warm ",
                avoid: " slang ",
                cta: " Book ",
                hashtags: "tea coffee tea",
            }),
        ).resolves.toEqual({
            workspaceId: "ws-1",
            brandVoice: "warm",
            avoid: "slang",
            cta: "Book",
            hashtags: ["#tea", "#coffee"],
            automations: { today_reminder: true, offer_draft: false, weekly_summary: false },
            marks: { week: "2026-10-12" },
        })

        expect(em.query).toHaveBeenCalledWith(SAVE_CONFIGURATION_BRAND, [
            "ws-1",
            "warm",
            "slang",
            "Book",
            ["#tea", "#coffee"],
        ])
    })
})

describe("ContentConfigurationService", () => {
    it("answers blank brand settings when none are stored", async () => {
        const em = mockEntityManager({ query: [SELECT_CONFIGURATION_BRAND, []] })
        const members = mock<WorkspaceMembersService>()
        members.require.mockResolvedValue({
            userId: "user-1",
            workspaceId: "ws-1",
            role: "owner",
            staffId: null,
            displayName: "An",
            status: "active",
        })
        const pillars = mock<ContentPillarsService>()
        const cadence = mock<ContentCadenceService>()
        const catalog = mock<MessageCatalog>()
        const moduleRef = await Test.createTestingModule({
            providers: [
                ContentConfigurationService,
                { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
                { provide: WorkspaceMembersService, useValue: members },
                { provide: ContentPillarsService, useValue: pillars },
                { provide: ContentCadenceService, useValue: cadence },
                { provide: MESSAGE_CATALOG, useValue: catalog },
            ],
        }).compile()
        const settings = moduleRef.get(ContentConfigurationService)
        pillars.list.mockResolvedValue([])
        cadence.list.mockResolvedValue([])

        await expect(settings.readAuthorizedConfiguration("ws-1")).resolves.toEqual({
            pillars: [],
            cadence: [],
            settings: EMPTY_SETTINGS,
        })
    })

    it("replaces themes when every kept id still exists", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                query: [
                    [ENSURE_CONFIGURATION, []],
                    [LOCK_CONFIGURATION, []],
                ],
            }),
        )
        const { settings, pillars } = await build(tx.em)
        pillars.list.mockResolvedValue([
            { id: "p1", workspaceId: "ws-1", name: "Tea", description: "", weight: 1, sort: 0, active: true },
        ])
        const rows = [
            { id: "p1", name: "Tea", description: "", weight: 2, active: true },
            { name: "Coffee", description: "", weight: 1, active: false },
        ]

        await expect(settings.savePillars("user-1", "ws-1", rows)).resolves.toEqual({ count: 2 })
        expect(pillars.replace).toHaveBeenCalledWith(expect.anything(), "ws-1", rows)
        expect(tx.em.query).toHaveBeenCalledWith(ENSURE_CONFIGURATION, ["ws-1"])
        expect(tx.em.query).toHaveBeenCalledWith(LOCK_CONFIGURATION, ["ws-1"])
        expect(tx.commits).toBe(1)
    })
})

describe("ContentConfigurationService", () => {
    it("refuses a repeated theme id and an id the workspace does not have", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                query: [
                    [ENSURE_CONFIGURATION, []],
                    [LOCK_CONFIGURATION, []],
                ],
            }),
        )
        const { settings, pillars } = await build(tx.em)
        pillars.list.mockResolvedValue([])
        const same = { id: "p1", name: "Tea", description: "", weight: 1, active: true }

        await expect(settings.savePillars("user-1", "ws-1", [same, { ...same, name: "Other" }])).rejects.toMatchObject({
            code: ContentSettingsErrorCode.Duplicate,
        })
        await expect(settings.savePillars("user-1", "ws-1", [same])).rejects.toMatchObject({
            code: ContentSettingsErrorCode.PillarNotFound,
        })
        expect(pillars.replace).not.toHaveBeenCalled()
    })

    it("adds the suggested themes only when the workspace has none", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                query: [
                    [ENSURE_CONFIGURATION, []],
                    [LOCK_CONFIGURATION, []],
                ],
            }),
        )
        const { settings, pillars, catalog } = await build(tx.em)
        await expect(settings.applyPillarPresets("user-1", "ws-1")).resolves.toEqual({ count: 5 })
        expect(catalog.get).toHaveBeenCalledWith("content.preset.0.name", {}, "vi")
        expect(pillars.replace).toHaveBeenCalledWith(
            expect.anything(),
            "ws-1",
            expect.arrayContaining([
                expect.objectContaining({ name: "content.preset.0.name", weight: 3, active: true }),
            ]),
        )

        pillars.list.mockResolvedValue([
            { id: "p1", workspaceId: "ws-1", name: "Tea", description: "", weight: 1, sort: 0, active: true },
        ])
        await expect(settings.applyPillarPresets("user-1", "ws-1")).resolves.toEqual({ count: 1 })
        expect(pillars.replace).toHaveBeenCalledTimes(1)
    })

    it("replaces the cadence and refuses a repeated channel", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                query: [
                    [ENSURE_CONFIGURATION, []],
                    [LOCK_CONFIGURATION, []],
                ],
            }),
        )
        const { settings, cadence } = await build(tx.em)
        const row: ContentCadenceDraft = { channel: "facebook", postsPerWeek: 2, days: [1], time: "09:00" }
        const rows = [row]
        await expect(settings.saveCadence("user-1", "ws-1", rows)).resolves.toEqual({ count: 1 })
        expect(cadence.replace).toHaveBeenCalledWith(expect.anything(), "ws-1", rows)
        await expect(settings.saveCadence("user-1", "ws-1", [row, { ...row }])).rejects.toMatchObject({
            code: ContentSettingsErrorCode.Duplicate,
        })
    })
})

describe("ContentConfigurationService", () => {
    it("applies the suggested Facebook and Zalo cadence", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                query: [
                    [ENSURE_CONFIGURATION, []],
                    [LOCK_CONFIGURATION, []],
                ],
            }),
        )
        const { settings, cadence } = await build(tx.em)
        await expect(settings.applyCadencePresets("user-1", "ws-1")).resolves.toEqual({
            count: CONTENT_CADENCE_PRESETS.length,
        })
        expect(cadence.replace).toHaveBeenCalledWith(expect.anything(), "ws-1", CONTENT_CADENCE_PRESETS)
    })

    it("switches one automation and keeps fifteen distinct hashtags", async () => {
        const { settings, em } = await build()
        await expect(settings.setAutomation("user-1", "ws-1", "offer_draft", true)).resolves.toMatchObject({
            workspaceId: "ws-1",
            brandVoice: "warm",
        })
        expect(em.query).toHaveBeenCalledWith(SET_CONFIGURATION_AUTOMATION, [
            "ws-1",
            JSON.stringify({ offer_draft: true }),
        ])

        const tags = ["###", "#tag0", "#tag0", ...Array.from({ length: 16 }, (_, index) => `#tag${index + 1}`)].join(
            " ",
        )
        await settings.saveBrand("user-1", "ws-1", { brandVoice: "v", avoid: "a", cta: "c", hashtags: tags })
        const saved = em.query.mock.calls.find((call) => call[0] === SAVE_CONFIGURATION_BRAND)?.[1]?.[4]
        expect(saved).toEqual(["#tag0", ...Array.from({ length: 12 }, (_, index) => `#tag${index + 1}`)])
    })
})
