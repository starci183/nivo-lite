import { Injectable, Optional } from "@nestjs/common"
import { InjectGraphThreads, type GraphThreads, type ThreadRef, type ThreadView } from "@modules/integrations/langgraph"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AgentThreadsLogEvent } from "./agent-threads.log-events"
import type { DeadlineFiring } from "./thread-deadlines.service"
import { ThreadRunsService } from "./thread-runs.service"
import { parkMatches, parkOfQuestion, type UntilParkPayload } from "./until-rounds.policy"

/** What the sweep made of a stopped thread: a park it fired, a park not due yet, or no park (a stop for a person). */
export type ParkSweep = "fired" | "waiting" | null

@Injectable()
/**
 * The wake of a `loop({ until, every })` parked between two rounds. When the park's timer comes (its thread-deadline job, or the minute
 * sweep once the park is past due), the thread is handed back to the drain as a WAKE of the run's own scope (`ThreadRunsService
 * .roundDue`), so the next round runs under the run's lease, behind whatever holds it, and survives a restart: the park is in the
 * checkpoint (LangGraph's interrupt), the timer is a stored job row, the wake a stored wake row. A timer for a park the thread no longer
 * waits on (the round already started, the run ended) does nothing.
 */
export class UntilRoundWakesService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly runs: ThreadRunsService,
        @Optional() @InjectGraphThreads() private readonly port?: GraphThreads,
    ) {}

    /**
     * A park's timer came (`now`: a person ran it now): the next round's wake is admitted when the thread still waits on that very park
     * and it is due; else nothing (`closed`: the thread waits on no park; `moved`: on another one; `early`: not due yet).
     */
    async fired(payload: UntilParkPayload, now: boolean): Promise<DeadlineFiring> {
        const ref: ThreadRef = { workspaceId: payload.workspaceId, runId: payload.runId }
        const view = (await this.port?.stateOf(ref)) ?? null
        const park = view?.status === "stopped" ? parkOfQuestion(view.stop?.question) : null
        if (park === null) return this.skipped(payload, "closed")
        if (!parkMatches(park, payload)) return this.skipped(payload, "moved")
        if (!now && Date.parse(park.dueAt) > this.clock.now().getTime()) return this.skipped(payload, "early")
        const admission = await this.runs.roundDue(ref, park)
        if (admission.kind === "refused") return this.skipped(payload, "refused")
        this.logger.info(AgentThreadsLogEvent.DeadlineFired, { runId: ref.runId, stepKey: park.parkKey, early: now })
        return "admitted"
    }

    /**
     * The sweep's look at a stopped thread: a park past its instant by `graceMs` (its job did not fire) gets its round's wake; a park
     * not due yet is left waiting; any other stop is not a park (null), and the sweep judges it as a stop.
     */
    async swept(ref: ThreadRef, view: ThreadView, graceMs: number): Promise<ParkSweep> {
        const park = parkOfQuestion(view.stop?.question)
        if (park === null) return null
        if (Date.parse(park.dueAt) > this.clock.now().getTime() - graceMs) return "waiting"
        const admission = await this.runs.roundDue(ref, park)
        return admission.kind === "admitted" && admission.fresh ? "fired" : "waiting"
    }

    private skipped(payload: UntilParkPayload, code: Exclude<DeadlineFiring, "admitted">): DeadlineFiring {
        this.logger.info(AgentThreadsLogEvent.DeadlineSkipped, { runId: payload.runId, stepKey: payload.stepKey, code })
        return code
    }
}
