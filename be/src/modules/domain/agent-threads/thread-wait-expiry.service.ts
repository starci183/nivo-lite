import { Injectable, Optional } from "@nestjs/common"
import { AgentRunsService } from "@modules/domain/agent-runs"
import { InjectGraphThreads, type GraphThreads, type ThreadRef } from "@modules/integrations/langgraph"
import { eachInOrder } from "@modules/platform/primitives"
import { ThreadDeadlinesService, type DeadlineFiring } from "./thread-deadlines.service"
import { parkOfWaitQuestion, waitPayloadOf, type WaitPark } from "./thread-waits.policy"

/** The most parked runs one read answers. */
const PARKED_MAX = 50

/** A run parked at a `wait`: the run, its agent, its trigger as it began, and the park (what it waits for, until when). */
export interface ParkedWait {
    /** The run. */
    readonly runId: string
    /** The agent of the run. */
    readonly agentId: string
    /** The run's trigger context, intact (the person and the route it is about). */
    readonly context: Readonly<Record<string, unknown>>
    /** The park key of the wait (the step key its deadline job is filed under). */
    readonly parkKey: string
    /** When its time runs out (ISO 8601). */
    readonly dueAt: string
    /** The triggers the wait listens for: the key the wake names each by and its verb. */
    readonly waitsFor: ReadonlyArray<{ readonly key: string; readonly verb: string }>
}

@Injectable()
/**
 * The waits of the thread runs seen from outside the run (owner rulings R62 + R66, the dev Sandbox page's "Run đang chờ"): the
 * workspace's runs parked at a `wait`, and "expire this run's wait now", which runs THE REAL DEADLINE ROAD, `ThreadDeadlinesService.fireNow`
 * with the wait's own deadline payload (the same function the deadline job and a person's "run now" call), so the run takes its timeout
 * branch exactly as when the time runs out. Generic: it knows no business and no sandbox; who may call it and when is its caller's rule.
 */
export class ThreadWaitExpiryService {
    constructor(
        private readonly runs: AgentRunsService,
        private readonly deadlines: ThreadDeadlinesService,
        @Optional() @InjectGraphThreads() private readonly port?: GraphThreads,
    ) {}

    /** The workspace's runs parked at a wait, newest start first, at most `limit` (capped at 50); a run whose thread no longer parks is left out. */
    async parked(workspaceId: string, limit: number): Promise<ReadonlyArray<ParkedWait>> {
        const runs = await this.runs.parkedAtWait(workspaceId, Math.max(0, Math.min(limit, PARKED_MAX)))
        const found: Array<ParkedWait> = []
        await eachInOrder(runs, async (run) => {
            const park = await this.parkOf({ workspaceId, runId: run.id })
            if (park === null) return
            found.push({
                runId: run.id,
                agentId: run.agentId,
                context: run.context,
                parkKey: park.parkKey,
                dueAt: park.dueAt,
                waitsFor: park.on.map((one) => ({ key: one.key, verb: one.verb })),
            })
        })
        return found
    }

    /**
     * Expires the run's wait NOW through the real deadline road: `admitted` when the timeout's wake was written (the run resumes on its
     * timeout branch); `closed` when the run is not parked at a wait; `refused` when an event took the park first.
     */
    async expireNow(workspaceId: string, runId: string): Promise<DeadlineFiring> {
        const ref: ThreadRef = { workspaceId, runId }
        const park = await this.parkOf(ref)
        if (park === null) return "closed"
        return this.deadlines.fireNow(waitPayloadOf(ref, park))
    }

    /** The wait the thread is parked on, or null (no port, no thread, stopped for something else, or not stopped). */
    private async parkOf(ref: ThreadRef): Promise<WaitPark | null> {
        const view = (await this.port?.stateOf(ref)) ?? null
        return view?.status === "stopped" ? parkOfWaitQuestion(view.stop?.question) : null
    }
}
