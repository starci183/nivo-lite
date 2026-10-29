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
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import { entityRowBuilder } from "@tests/fixtures/builders/entity-row.builder"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { ContentConfigurationService } from "./content-configuration.service"
import { CONTENT_CADENCE_PRESETS } from "./content-configuration.templates"
import { ContentSettingsErrorCode } from "./errors/content-settings.error"
import { ContentSettingsEntity } from "./persistence/entities"

const EMPTY_SETTINGS = {
    workspaceId: "ws-1",
    brandVoice: "",
    avoid: "",
    cta: "",
    hashtags: [],
    automations: { today_reminder: false, offer_draft: false, weekly_summary: false },
    marks: {},
}

const settingsRow = entityRowBuilder<ContentSettingsEntity>({
    workspaceId: "ws-1",
    brandVoice: "warm",
    avoid: "slang",
    cta: "Book",
    hashtags: ["#tea", "#coffee"],
    automations: { today_reminder: true },
    marks: { reminder_day: "2026-10-12" },
    updatedAt: new Date("2026-10-12T00:00:00.000Z"),
    brandColors: [],
    brandFonts: [],
    brandTone: "",
    brandImagery: [],
    brandSource: "",
})

const STORED = {
    workspaceId: "ws-1",
    brandVoice: "warm",
    avoid: "slang",
    cta: "Book",
    hashtags: ["#tea", "#coffee"],
    automations: { today_reminder: true, offer_draft: false, weekly_summary: false },
    marks: { reminder_day: "2026-10-12" },
}

const build = async (
    em: MockEntityManager = mockEntityManager({ findOne: [ContentSettingsEntity, settingsRow()] }),
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

/** A transaction whose lock statements both answer. */
const lockedTransaction = () => {
    const tx = fakeTransaction(mockEntityManager())
    const fakes = queueQueryBuilders(tx.em, Array.from({ length: 4 }, () => [{ execute: {} }, { getOne: null }]).flat())
    return { tx, fakes }
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
                marks: { reminder_day: "2026-10-12" },
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
        const em = mockEntityManager({ findOne: [ContentSettingsEntity, settingsRow()] })
        const [insert] = queueQueryBuilders(em, [{ execute: {} }])
        const { settings } = await build(em)

        await expect(
            settings.saveBrand("user-1", "ws-1", {
                brandVoice: " warm ",
                avoid: " slang ",
                cta: " Book ",
                hashtags: "tea coffee tea",
            }),
        ).resolves.toEqual(STORED)

        expect(em.createQueryBuilder).toHaveBeenCalledWith(ContentSettingsEntity, "cs")
        expect(insert?.callsOf("values")).toEqual([
            [{ workspaceId: "ws-1", brandVoice: "warm", avoid: "slang", cta: "Book", hashtags: ["#tea", "#coffee"] }],
        ])
        expect(insert?.callsOf("orUpdate")).toEqual([[["brand_voice", "avoid", "cta", "hashtags"], ["workspace_id"]]])
    })
})

describe("ContentConfigurationService", () => {
    it("answers blank brand settings when none are stored", async () => {
        const em = mockEntityManager({ findOne: [ContentSettingsEntity, null] })
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
        const { tx, fakes } = lockedTransaction()
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
        const [ensure, lock] = fakes
        expect(ensure?.callsOf("values")).toEqual([[{ workspaceId: "ws-1" }]])
        expect(ensure?.callsOf("orIgnore")).toEqual([[]])
        expect(lock?.callsOf("where")).toEqual([["settings.workspaceId = :workspaceId", { workspaceId: "ws-1" }]])
        expect(lock?.callsOf("setLock")).toEqual([["pessimistic_write"]])
        expect(tx.commits).toBe(1)
    })
})

describe("ContentConfigurationService", () => {
    it("refuses a repeated theme id and an id the workspace does not have", async () => {
        const { tx } = lockedTransaction()
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
        const { tx } = lockedTransaction()
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
        const { tx } = lockedTransaction()
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
        const { tx } = lockedTransaction()
        const { settings, cadence } = await build(tx.em)
        await expect(settings.applyCadencePresets("user-1", "ws-1")).resolves.toEqual({
            count: CONTENT_CADENCE_PRESETS.length,
        })
        expect(cadence.replace).toHaveBeenCalledWith(expect.anything(), "ws-1", CONTENT_CADENCE_PRESETS)
    })

    it("switches one automation and keeps fifteen distinct hashtags", async () => {
        const em = mockEntityManager({ findOne: [ContentSettingsEntity, settingsRow()] })
        const [automation, brand] = queueQueryBuilders(em, [{ execute: {} }, { execute: {} }])
        const { settings } = await build(em)
        await expect(settings.setAutomation("user-1", "ws-1", "offer_draft", true)).resolves.toMatchObject({
            workspaceId: "ws-1",
            brandVoice: "warm",
        })
        expect(automation?.callsOf("setParameter")).toEqual([["automation", JSON.stringify({ offer_draft: true })]])
        expect(automation?.callsOf("onConflict")).toHaveLength(1)
        expect(evaluatedValues(automation?.callsOf("values")[0]?.[0])).toEqual({
            workspaceId: "ws-1",
            automations: ":automation::jsonb",
        })

        const tags = ["###", "#tag0", "#tag0", ...Array.from({ length: 16 }, (_, index) => `#tag${index + 1}`)].join(
            " ",
        )
        await settings.saveBrand("user-1", "ws-1", { brandVoice: "v", avoid: "a", cta: "c", hashtags: tags })
        const saved: unknown = brand?.callsOf("values")[0]?.[0]
        expect(saved).toMatchObject({
            hashtags: ["#tag0", ...Array.from({ length: 12 }, (_, index) => `#tag${index + 1}`)],
        })
    })

    it("answers the default brand when the switched workspace has no saved row", async () => {
        const em = mockEntityManager({ findOne: [ContentSettingsEntity, null] })
        queueQueryBuilders(em, [{ execute: {} }])
        const { settings } = await build(em)

        await expect(settings.setAutomation("user-1", "ws-1", "today_reminder", false)).resolves.toMatchObject({
            workspaceId: "ws-1",
            brandVoice: "",
        })
    })
})
