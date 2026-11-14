import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { AgentRunsService } from "@modules/domain/agent-runs"
import { AgentTasksService } from "@modules/domain/agent-work"
import { DeliveredWakesService } from "@modules/domain/provider-triggers"
import { runViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { ErasedSubjectRunsService, SUBJECT_ERASED } from "./erased-subject-runs.service"

const build = async () => {
    const runs = mock<AgentRunsService>()
    const wakes = mock<DeliveredWakesService>({ dropOfScopes: jest.fn().mockResolvedValue(0) })
    const tasks = mock<AgentTasksService>({ dropOfKeyStarts: jest.fn().mockResolvedValue(0) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ErasedSubjectRunsService,
            { provide: AgentRunsService, useValue: runs },
            { provide: DeliveredWakesService, useValue: wakes },
            { provide: AgentTasksService, useValue: tasks },
        ],
    }).compile()
    return { service: moduleRef.get(ErasedSubjectRunsService), runs, wakes, tasks }
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
        expect(wakes.dropOfScopes).not.toHaveBeenCalled()
    })

    // R72 Q1 (MX D-01): after `deleteContact` two delivery-check timers of the erased person stayed `open` and would have fired, and the
    // events of the person no run took yet (held by a freeze, pending) were left to run. Erasing ends EVERYTHING pending, in the same tx.
    it("ends everything pending in the same transaction: parked runs, every wake still waiting in the subjects' scopes, every timer armed for them", async () => {
        const { service, runs, wakes, tasks } = await build()
        runs.endParkedOfSubjects.mockResolvedValue([runViewOf({ id: "run-1" })])
        wakes.dropWaiting.mockResolvedValue(1)
        wakes.dropOfScopes.mockResolvedValue(2)
        tasks.dropOfKeyStarts.mockResolvedValue(2)
        const tx = mockEntityManager()
        const subjects = [
            { kind: "contactId", id: "c-1" },
            { kind: "contactId", id: "c-merged" },
            { kind: "routeId", id: "route-1" },
        ]

        await expect(service.endedAll(tx, "ws-1", subjects)).resolves.toEqual({ runs: 1, wakes: 3, timers: 2 })

        expect(wakes.dropOfScopes).toHaveBeenCalledWith(
            tx,
            "ws-1",
            ["key:contactId=c-1", "key:contactId=c-merged", "key:routeId=route-1"],
            SUBJECT_ERASED,
        )
        // A person's timers are keyed `timer:contact:<id>:<ref>`, a conversation's `timer:conversation:<route>:<ref>` (timerTaskKeyOf).
        expect(tasks.dropOfKeyStarts).toHaveBeenCalledWith(tx, "ws-1", [
            "timer:contact:c-1:",
            "timer:contact:c-merged:",
            "timer:conversation:route-1:",
        ])
    })

    it("a subject of another kind (an order, a render job) has its waiting wakes dropped and arms no timer to drop", async () => {
        const { service, runs, wakes, tasks } = await build()
        runs.endParkedOfSubjects.mockResolvedValue([])
        const tx = mockEntityManager()

        await service.endedAll(tx, "ws-1", [{ kind: "orderId", id: "o-1" }])

        expect(wakes.dropOfScopes).toHaveBeenCalledWith(tx, "ws-1", ["key:orderId=o-1"], SUBJECT_ERASED)
        expect(tasks.dropOfKeyStarts).toHaveBeenCalledWith(tx, "ws-1", [])
    })
})
