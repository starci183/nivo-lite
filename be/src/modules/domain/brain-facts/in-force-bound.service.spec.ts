import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { HASH_STATEMENT, LOCK_HASH, LOCK_STATEMENT, advisoryLockAnswers } from "@tests/fixtures/builders/advisory-lock.builder"
import { BrainFactsReadService } from "./brain-facts-read.service"
import { BrainFactsError, BrainFactsErrorCode } from "./errors/brain-facts.error"
import { InForceBoundService, type GuardedBound } from "./in-force-bound.service"

const WS = "11111111-1111-4111-8111-111111111111"
const BOUND = { truths: 3, bytes: 1_000 }

const build = async () => {
    const reads = mock<BrainFactsReadService>()
    const moduleRef = await Test.createTestingModule({
        providers: [InForceBoundService, { provide: BrainFactsReadService, useValue: reads }],
    }).compile()
    return { service: moduleRef.get(InForceBoundService), reads }
}

describe("InForceBoundService: the check and the write are one step (D-U-1)", () => {
    it("locks the workspace first, counts, lets the write run, counts again, and answers what the write answered", async () => {
        const { service, reads } = await build()
        const tx = mockEntityManager({ query: advisoryLockAnswers })
        const steps: Array<string> = []
        reads.heldInForce.mockImplementation(() => {
            steps.push("count")
            return Promise.resolve(steps.length === 1 ? { truths: 2, bytes: 200 } : { truths: 3, bytes: 300 })
        })

        const write = (): Promise<string> => {
            steps.push("write")
            return Promise.resolve("written")
        }
        await expect(service.within(tx, WS, BOUND, write)).resolves.toBe("written")

        expect(tx.query.mock.calls).toEqual([
            [HASH_STATEMENT, [`brain-facts.in-force:${WS}`, 0]],
            [LOCK_STATEMENT, [LOCK_HASH]],
        ])
        expect(steps).toEqual(["count", "write", "count"])
        expect(reads.heldInForce).toHaveBeenCalledWith(tx, WS)
    })

    it("refuses a write that added to what is in force and left it above the bound: the caller's transaction rolls back", async () => {
        const { service, reads } = await build()
        reads.heldInForce.mockResolvedValueOnce({ truths: 3, bytes: 300 }).mockResolvedValueOnce({ truths: 4, bytes: 400 })

        await expect(
            service.within(mockEntityManager({ query: advisoryLockAnswers }), WS, BOUND, () => Promise.resolve("written")),
        ).rejects.toMatchObject({ code: BrainFactsErrorCode.InForceFull })
    })

    it("runs a write with no bound as it is: no lock, no count (the founder's own decision)", async () => {
        const { service, reads } = await build()

        // `query` is not stubbed: a lock statement would throw.
        await expect(service.within(mockEntityManager(), WS, undefined, () => Promise.resolve("written"))).resolves.toBe("written")

        expect(reads.heldInForce).not.toHaveBeenCalled()
    })

    it("runs the guard of a guarded bound under the lock, before the count and the write", async () => {
        const { service, reads } = await build()
        const tx = mockEntityManager({ query: advisoryLockAnswers })
        const steps: Array<string> = []
        reads.heldInForce.mockImplementation(() => {
            steps.push("count")
            return Promise.resolve({ truths: 1, bytes: 100 })
        })
        const guard = (): Promise<void> => {
            // The lock's two statements were sent before the guard ran.
            steps.push(`guard after ${String(tx.query.mock.calls.length)} statements`)
            return Promise.resolve()
        }
        const write = (): Promise<string> => {
            steps.push("write")
            return Promise.resolve("written")
        }

        const bound: GuardedBound = { ...BOUND, guard }
        await expect(service.within(tx, WS, bound, write)).resolves.toBe("written")

        expect(steps).toEqual(["guard after 2 statements", "count", "write", "count"])
    })

    it("a guard that refuses stops the write: its error reaches the caller and nothing is written or counted", async () => {
        const { service, reads } = await build()
        const write = jest.fn(() => Promise.resolve("written"))
        const bound: GuardedBound = { ...BOUND, guard: () => Promise.reject(new BrainFactsError({ code: BrainFactsErrorCode.InForceFull })) }

        await expect(
            service.within(mockEntityManager({ query: advisoryLockAnswers }), WS, bound, write),
        ).rejects.toMatchObject({ code: BrainFactsErrorCode.InForceFull })

        expect(write).not.toHaveBeenCalled()
        expect(reads.heldInForce).not.toHaveBeenCalled()
    })
})
