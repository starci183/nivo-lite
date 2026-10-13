import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ActionPerformerRegistry } from "@modules/domain/module-ops"
import type { PerformContext } from "@modules/domain/module-ops"
import { HiringInterviewsService } from "./hiring-interviews.service"
import { HiringOffersService } from "./hiring-offers.service"
import { HiringPerformersService } from "./hiring-performers.service"
import { HiringScreeningService } from "./hiring-screening.service"

const context: PerformContext = {
    workspaceId: "ws-1",
    workItemId: "work-1",
    actor: "Manager",
    draft: null,
    fields: { candidate_id: "candidate-1", interview_id: "interview-1", offer_id: "offer-1" },
}

const build = async () => {
    const registry = mock<ActionPerformerRegistry>()
    const screening = mock<HiringScreeningService>()
    const interviews = mock<HiringInterviewsService>()
    const offers = mock<HiringOffersService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            HiringPerformersService,
            { provide: ActionPerformerRegistry, useValue: registry },
            { provide: HiringScreeningService, useValue: screening },
            { provide: HiringInterviewsService, useValue: interviews },
            { provide: HiringOffersService, useValue: offers },
        ],
    }).compile()
    return { service: moduleRef.get(HiringPerformersService), registry, screening, interviews, offers }
}

describe("HiringPerformersService", () => {
    it("registers all three actions and delegates every perform and reject callback", async () => {
        const { service, registry, screening, interviews, offers } = await build()
        screening.perform.mockResolvedValue({ summary: "screening-result", evidence: "captured" })
        interviews.perform.mockResolvedValue({ summary: "interview-result", evidence: "pending" })
        offers.perform.mockResolvedValue({ summary: "offer-result", evidence: "captured", detail: "offer-1" })
        offers.reject.mockResolvedValue(undefined)

        service.onModuleInit()

        expect(registry.add.mock.calls.map(([performer]) => performer.action)).toEqual([
            "screen_candidate",
            "schedule_interview",
            "send_offer",
        ])
        const [screen, interview, offer] = registry.add.mock.calls.map(([performer]) => performer)
        expect(screen?.reject).toBeUndefined()
        expect(interview?.reject).toBeUndefined()
        await expect(screen?.perform(context)).resolves.toEqual({
            summary: "screening-result",
            evidence: "captured",
        })
        await expect(interview?.perform(context)).resolves.toEqual({
            summary: "interview-result",
            evidence: "pending",
        })
        await expect(offer?.perform(context)).resolves.toEqual({
            summary: "offer-result",
            evidence: "captured",
            detail: "offer-1",
        })
        await expect(offer?.reject?.(context)).resolves.toBeUndefined()

        expect(screening.perform.mock.calls).toEqual([[context]])
        expect(interviews.perform.mock.calls).toEqual([[context]])
        expect(offers.perform.mock.calls).toEqual([[context]])
        expect(offers.reject.mock.calls).toEqual([[context]])
    })
})
