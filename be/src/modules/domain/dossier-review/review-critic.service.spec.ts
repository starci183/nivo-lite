import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { SourceCriticStageService } from "@modules/domain/knowledge-sources"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { DossierReviewRunEntity } from "./persistence/entities"
import { ReviewCriticService } from "./review-critic.service"

const WS = "11111111-1111-4111-8111-111111111111"

const runOf = (trigger: string, triggerRef: string | null): DossierReviewRunEntity =>
    Object.assign(new DossierReviewRunEntity(), { id: "r1", trigger, triggerRef })

const build = async (run: DossierReviewRunEntity | null, pending: boolean) => {
    const stage = mock<SourceCriticStageService>()
    const em = mockEntityManager({ findOne: [DossierReviewRunEntity, run], exists: [DossierReviewRunEntity, pending] })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ReviewCriticService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: SourceCriticStageService, useValue: stage },
        ],
    }).compile()
    return { service: moduleRef.get(ReviewCriticService), stage }
}

describe("ReviewCriticService settle", () => {
    it("lets every document go when no run of the workspace is queued or going", async () => {
        const { service, stage } = await build(runOf("document", "s1"), false)

        await expect(service.settle(WS, "r1")).resolves.toBe("all")

        expect(stage.leaveAll).toHaveBeenCalledWith(WS)
        expect(stage.leave).not.toHaveBeenCalled()
    })

    it("lets only the document the run was asked for go while another run waits", async () => {
        const { service, stage } = await build(runOf("document", "s1"), true)

        await expect(service.settle(WS, "r1")).resolves.toBe("one")

        expect(stage.leave).toHaveBeenCalledWith(WS, "s1")
        expect(stage.leaveAll).not.toHaveBeenCalled()
    })

    it("lets no document go for a run that was not asked for one while another run waits, or that is gone", async () => {
        const asked = await build(runOf("request", null), true)
        const gone = await build(null, true)

        await expect(asked.service.settle(WS, "r1")).resolves.toBe("none")
        await expect(gone.service.settle(WS, "r1")).resolves.toBe("none")

        expect(asked.stage.leave).not.toHaveBeenCalled()
        expect(gone.stage.leave).not.toHaveBeenCalled()
    })
})
