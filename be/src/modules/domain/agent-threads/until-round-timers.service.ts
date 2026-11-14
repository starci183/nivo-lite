import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { ThreadRef } from "@modules/integrations/langgraph"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ThreadDeadlineQueue } from "@modules/queues/thread-deadline"
import { AgentThreadsLogEvent } from "./agent-threads.log-events"
import { parkPayloadOf, type UntilPark } from "./until-rounds.policy"
import { waitPayloadOf, type WaitPark } from "./thread-waits.policy"

/** The longest delay a job is written with: 20 days (a job's delay is kept as a 32-bit count of milliseconds). */
const TIMER_DELAY_MAX_MS = 20 * 24 * 60 * 60_000

@Injectable()
/**
 * The engine timer of a `loop({ until, every })` parked between two rounds: ONE delayed job of the thread-deadline queue (the durable
 * outbox row the deadlines of the stops already use, fired by the `fire-thread-deadline` job), due at `round end + every`, keyed by the
 * park (`<loop>[r<round>]`), so arming the same park again (the loop node runs again from its first line after a crash) adds no second
 * job. It is written BEFORE the interrupt that parks the thread, so no checkpoint of a park exists without its timer; an app with no
 * queue outbox arms nothing and the minute sweep of the threads fires a park that came (`UntilRoundWakesService.swept`).
 */
export class UntilRoundTimersService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        @Optional() private readonly queue?: ThreadDeadlineQueue,
    ) {}

    /**
     * Writes the timer of a park; false when this app has no queue (the sweep is then the timer). A wait longer than a job's delay may
     * be (`TIMER_DELAY_MAX_MS`) fires early, finds the park not due (`early`) and is left to the sweep, which fires it once it is.
     */
    async armed(ref: ThreadRef, park: UntilPark): Promise<boolean> {
        const queue = this.queue
        if (queue === undefined) return false
        const delayMs = Math.min(Date.parse(park.dueAt) - this.clock.now().getTime(), TIMER_DELAY_MAX_MS)
        const armed = await this.entityManager.transaction((tx) => queue.arm(parkPayloadOf(ref, park), delayMs, tx))
        if (armed === "written")
            this.logger.info(AgentThreadsLogEvent.DeadlineArmed, { runId: ref.runId, stepKey: park.parkKey, dueAt: park.dueAt })
        return armed !== "unqueued"
    }

    /**
     * Writes the deadline of a parked `wait` (ONE job per park key, so a wait node that runs again before its interrupt is kept adds no
     * second job), BEFORE the interrupt; false when this app has no queue (the minute sweep is then the deadline). A wait longer than a
     * job's delay fires early, finds the park not due and is left to the sweep.
     */
    async armedWait(ref: ThreadRef, park: WaitPark): Promise<boolean> {
        const queue = this.queue
        if (queue === undefined) return false
        const delayMs = Math.min(Date.parse(park.dueAt) - this.clock.now().getTime(), TIMER_DELAY_MAX_MS)
        const armed = await this.entityManager.transaction((tx) => queue.arm(waitPayloadOf(ref, park), Math.max(0, delayMs), tx))
        if (armed === "written")
            this.logger.info(AgentThreadsLogEvent.DeadlineArmed, { runId: ref.runId, stepKey: park.parkKey, dueAt: park.dueAt })
        return armed !== "unqueued"
    }
}
