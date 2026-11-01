import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { AgentRunStoreService } from "./agent-run-store.service"
import type { OptionalRunTrace, RunStepView } from "./agent-runs-engine.contracts"

@Injectable()
/**
 * The read side of the runs, for the trace: the steps of a run in order, each with the node of the published graph it is, where it
 * stands, how many tries it took and why it last failed. It reads and changes nothing.
 */
export class AgentRunTraceService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly store: AgentRunStoreService,
    ) {}

    /** The steps of a run, in order, with their node keys. */
    stepsOf(runId: string): Promise<ReadonlyArray<RunStepView>> {
        return this.store.stepsOf(this.entityManager, runId)
    }

    /** The run a wake opened with its steps in order, or null when the wake ran on today's prompt and wrote none. */
    async ofWake(wakeId: string): Promise<OptionalRunTrace> {
        const run = await this.store.runOfWake(wakeId)
        if (run === null) return null
        return { run, steps: await this.stepsOf(run.id) }
    }
}
