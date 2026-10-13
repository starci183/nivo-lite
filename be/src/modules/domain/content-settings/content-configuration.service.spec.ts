import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { ContentCadenceService } from "@modules/domain/content-cadence"
import { ContentPillarsService } from "@modules/domain/content-pillars"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ContentConfigurationService } from "./content-configuration.service"
import { ContentSettingsErrorCode } from "./errors/content-settings.error"
import { SAVE_CONFIGURATION_BRAND, SELECT_CONFIGURATION_BRAND } from "./persistence/content-configuration.sql"

const EMPTY_SETTINGS = {
    workspaceId: "ws-1",
    brandVoice: "",
    avoid: "",
    cta: "",
    hashtags: [],
    automations: { today_reminder: false, offer_draft: false, weekly_summary: false },
    marks: {},
}

const build = async () => {
    const em = mockEntityManager({
        query: [
            [SAVE_CONFIGURATION_BRAND, []],
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
    })
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
    return { settings: moduleRef.get(ContentConfigurationService), em, members }
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
        const moduleRef = await Test.createTestingModule({
            providers: [
                ContentConfigurationService,
                { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
                { provide: WorkspaceMembersService, useValue: members },
                { provide: ContentPillarsService, useValue: pillars },
                { provide: ContentCadenceService, useValue: cadence },
                { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>() },
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
})
