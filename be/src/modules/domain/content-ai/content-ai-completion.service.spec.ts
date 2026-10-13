import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { GenerationsService } from "@modules/domain/ai-generations"
import { ContentPlansService } from "@modules/domain/content-plans"
import { ContentAiStoreService, ContentEditorService } from "@modules/domain/content-items"
import { EvidenceService } from "@modules/domain/decisions"
import { EventsService } from "@modules/domain/events"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ContentAiCompletionService } from "./content-ai-completion.service"

const build = async () => {
    const generations = mock<GenerationsService>()
    generations.state.mockResolvedValue(null)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContentAiCompletionService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: mockEntityManager() },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T10:00:00.000Z") },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: GenerationsService, useValue: generations },
            { provide: AuthorityRulesService, useValue: mock<AuthorityRulesService>() },
            { provide: ContentEditorService, useValue: mock<ContentEditorService>() },
            { provide: ContentAiStoreService, useValue: mock<ContentAiStoreService>() },
            { provide: ContentPlansService, useValue: mock<ContentPlansService>() },
            { provide: EvidenceService, useValue: mock<EvidenceService>() },
            { provide: EventsService, useValue: mock<EventsService>() },
        ],
    }).compile()
    return { service: moduleRef.get(ContentAiCompletionService), generations }
}

describe("ContentAiCompletionService", () => {
    it("ignores a generation this capability does not own", async () => {
        const { service, generations } = await build()

        await expect(service.complete("ws-1", "gen-1")).resolves.toBeUndefined()

        expect(generations.state).toHaveBeenCalledWith("ws-1", "gen-1")
    })
})
