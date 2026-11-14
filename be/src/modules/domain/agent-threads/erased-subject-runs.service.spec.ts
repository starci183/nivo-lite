import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { AgentRunsService } from "@modules/domain/agent-runs"
import { DeliveredWakesService } from "@modules/domain/provider-triggers"
import { runViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { ErasedSubjectRunsService, SUBJECT_ERASED } from "./erased-subject-runs.service"

const build = async () => {
    const runs = mock<AgentRunsService>()
    const wakes = mock<DeliveredWakesService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ErasedSubjectRunsService,
            { provide: AgentRunsService, useValue: runs },
            { provide: DeliveredWakesService, useValue: wakes },
        ],
    }).compile()
    return { service: moduleRef.get(ErasedSubjectRunsService), runs, wakes }
}

describe("ErasedSubjectRunsService (coordinator ruling R37: erasing a subject ends the runs parked on it)", () => {
    it("ends the runs parked on the subjects with `subject_erased` and drops the wakes held behind each, in the caller's transaction", async () => {
        const { service, runs, wakes } = await build()
        runs.endParkedOfSubjects.mockResolvedValue([runViewOf({ id: "run-1" }), runViewOf({ id: "run-2" })])
        wakes.dropWaiting.mockResolvedValue(1)
        const tx = mockEntityManager()
        const subjects = [
            { kind: "contactId", id: "c-1" },
            { kind: "routeId", id: "route-1" },
        ]

        await expect(service.ended(tx, "ws-1", subjects)).resolves.toBe(2)

        expect(runs.endParkedOfSubjects).toHaveBeenCalledWith(tx, "ws-1", subjects, SUBJECT_ERASED)
        expect(wakes.dropWaiting.mock.calls).toEqual([
            [tx, "ws-1", "run-1", SUBJECT_ERASED],
            [tx, "ws-1", "run-2", SUBJECT_ERASED],
        ])
    })

    it("reads and writes nothing for no subject", async () => {
        const { service, runs, wakes } = await build()

        await expect(service.ended(mockEntityManager(), "ws-1", [])).resolves.toBe(0)
        expect(runs.endParkedOfSubjects).not.toHaveBeenCalled()
        expect(wakes.dropWaiting).not.toHaveBeenCalled()
    })
})
