import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { IsNull } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { KnowledgeProgressService } from "./knowledge-progress.service"
import { KnowledgeSourcesLogEvent } from "./knowledge-sources.log-events"
import { KnowledgeSourceEntity } from "./persistence/entities"
import { SourceCriticStageService } from "./source-critic-stage.service"
import { NOW } from "./source-input.policy"

const WS = "11111111-1111-4111-8111-111111111111"

const build = async (em: MockEntityManager) => {
    const progress = mock<KnowledgeProgressService>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SourceCriticStageService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: KnowledgeProgressService, useValue: progress },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(SourceCriticStageService), progress, logger }
}

describe("SourceCriticStageService enter", () => {
    it("gives a ready document with no stage the stage critic and tells every member", async () => {
        const em = mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 1 }] })
        const { service, progress } = await build(em)

        await service.enter(WS, "s1")

        expect(em.update).toHaveBeenCalledWith(
            KnowledgeSourceEntity,
            { id: "s1", workspaceId: WS, status: "ready", stage: IsNull() },
            { stage: "critic", updatedAt: NOW },
        )
        expect(progress.announce).toHaveBeenCalledWith(WS, "s1")
    })

    it("says nothing when the document is not ready or already wears a stage", async () => {
        const em = mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 0 }] })
        const { service, progress } = await build(em)

        await service.enter(WS, "s1")

        expect(progress.announce).not.toHaveBeenCalled()
    })
})

describe("SourceCriticStageService leave", () => {
    it("clears the stage only while it is still critic and tells every member", async () => {
        const em = mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 1 }] })
        const { service, progress } = await build(em)

        await service.leave(WS, "s1")

        expect(em.update).toHaveBeenCalledWith(
            KnowledgeSourceEntity,
            { id: "s1", workspaceId: WS, stage: "critic" },
            { stage: null, updatedAt: NOW },
        )
        expect(progress.announce).toHaveBeenCalledWith(WS, "s1")
    })

    it("never fails the run that calls it: a write that fails is logged", async () => {
        const em = mockEntityManager()
        em.update.mockRejectedValue(new Error("db"))
        const { service, logger, progress } = await build(em)

        await expect(service.leave(WS, "s1")).resolves.toBeUndefined()

        expect(logger.error).toHaveBeenCalledWith(KnowledgeSourcesLogEvent.ProgressFailed, expect.any(Error), {
            sourceId: "s1",
        })
        expect(progress.announce).not.toHaveBeenCalled()
    })
})
