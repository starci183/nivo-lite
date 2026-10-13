import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { GenerationsService } from "@modules/domain/ai-generations"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { ContentAiStoreService, ContentEditorService } from "@modules/domain/content-items"
import { ContentMediaService } from "@modules/domain/content-media"
import { ContentConfigurationService } from "@modules/domain/content-settings"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ContentAiCompletionService } from "./content-ai-completion.service"
import type { BrandMaterial } from "./content-ai-prompt.policy"
import { ContentAiService } from "./content-ai.service"
import { ContentBrandService } from "./content-brand.service"

const MEMBER: WorkspaceMember = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "An",
    status: "active",
}

const MATERIAL: BrandMaterial = {
    shop: "Lan",
    authority: { brandVoice: "warm", replyStyle: "short", limitsNote: "" },
    setup: { summary: "Cafe", facts: [], tone: "", claimsLimits: "", audience: "", channels: "" },
    sources: [],
    brainFacts: [],
}

const build = async () => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(MEMBER)
    const brand = mock<ContentBrandService>()
    brand.material.mockResolvedValue(MATERIAL)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContentAiService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: mockEntityManager() },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T10:00:00.000Z") },
            { provide: GenerationsService, useValue: mock<GenerationsService>() },
            { provide: ContentAiCompletionService, useValue: mock<ContentAiCompletionService>() },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: AuthorityRulesService, useValue: mock<AuthorityRulesService>() },
            { provide: ContentEditorService, useValue: mock<ContentEditorService>() },
            { provide: ContentAiStoreService, useValue: mock<ContentAiStoreService>() },
            { provide: ContentConfigurationService, useValue: mock<ContentConfigurationService>() },
            { provide: ContentMediaService, useValue: mock<ContentMediaService>() },
            { provide: ContentBrandService, useValue: brand },
        ],
    }).compile()
    return { service: moduleRef.get(ContentAiService), brand }
}

describe("ContentAiService", () => {
    it("returns the public brand material after proving membership", async () => {
        const { service, brand } = await build()

        await expect(service.brandFor("user-1", "ws-1")).resolves.toEqual(MATERIAL)

        expect(brand.material).toHaveBeenCalledWith("ws-1")
    })
})
