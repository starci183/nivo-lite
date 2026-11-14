import { FakeClock, mock } from "@starci/jest-preset"
import type { GraphThreads, ThreadView } from "@modules/integrations/langgraph"
import type { Logger } from "@modules/platform/logging"
import type { ThreadRunsService } from "./thread-runs.service"
import { UntilRoundWakesService } from "./until-round-wakes.service"
import { parkPayloadOf, untilParkOf } from "./until-rounds.policy"

const REF = { workspaceId: "ws-1", runId: "run-1" }
const PARK = untilParkOf("poll", 2, "2026-11-12T08:30:00.000Z")

const viewOf = (question: unknown): ThreadView => ({
    version: "v1",
    status: "stopped",
    state: { trigger: {}, steps: {}, trouble: null, founderAnswers: [], loop: null },
    next: ["poll"],
    stop: { node: "poll", question },
})

const build = (at: string, question: unknown = PARK) => {
    const runs = mock<ThreadRunsService>()
    runs.roundDue.mockResolvedValue({ kind: "admitted", fresh: true })
    const port = mock<GraphThreads>()
    port.stateOf.mockResolvedValue(viewOf(question))
    const service = new UntilRoundWakesService(new FakeClock(new Date(at)), mock<Logger>(), runs, port)
    return { service, runs }
}

describe("UntilRoundWakesService", () => {
    it("admits the next round's wake when the park's timer comes, not before, and never for another park", async () => {
        const early = build("2026-11-12T08:29:00.000Z")
        await expect(early.service.fired(parkPayloadOf(REF, PARK), false)).resolves.toBe("early")
        await expect(early.service.fired(parkPayloadOf(REF, PARK), true)).resolves.toBe("admitted")
        const due = build("2026-11-12T08:30:00.000Z")
        await expect(due.service.fired(parkPayloadOf(REF, PARK), false)).resolves.toBe("admitted")
        expect(due.runs.roundDue).toHaveBeenCalledWith(REF, PARK)
        await expect(due.service.fired({ ...parkPayloadOf(REF, PARK), repeats: 3 }, false)).resolves.toBe("moved")
        const stop = build("2026-11-12T08:30:00.000Z", { stepKey: "note" })
        await expect(stop.service.fired(parkPayloadOf(REF, PARK), false)).resolves.toBe("closed")
    })

    it("is the sweep's backstop: a park past its instant and the grace gets its wake; one not due waits; a stop is no park", async () => {
        const waiting = build("2026-11-12T08:30:30.000Z")
        await expect(waiting.service.swept(REF, viewOf(PARK), 60_000)).resolves.toBe("waiting")
        expect(waiting.runs.roundDue).not.toHaveBeenCalled()
        const late = build("2026-11-12T08:32:00.000Z")
        await expect(late.service.swept(REF, viewOf(PARK), 60_000)).resolves.toBe("fired")
        await expect(late.service.swept(REF, viewOf({ stepKey: "note" }), 60_000)).resolves.toBeNull()
    })
})
