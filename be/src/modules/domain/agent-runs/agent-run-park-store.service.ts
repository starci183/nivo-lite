import { Injectable } from "@nestjs/common"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import type { EntityManager } from "typeorm"
import { AgentStepQueue } from "@modules/queues/agent-step"
import { AgentRunsError, AgentRunsErrorCode } from "./errors/agent-runs.error"
import { stepViewOf } from "./agent-runs.mapper"
import { parseParked, parseResume } from "./policies/db-results.policy"
import { AgentRunStepEntity } from "./persistence/entities"
import type { ParkedQuery, ParkedRef, ResumeAnswer, ResumeWrite, RunStepView } from "./agent-runs-engine.contracts"

/** One row a database function answered: the value sits under the function's own name. */
type FunctionRow = Readonly<Record<string, unknown>>

const rejected = (): AgentRunsError => new AgentRunsError({ code: AgentRunsErrorCode.ResultRejected })

@Injectable()
/**
 * The rows of the runs that stopped for a fix: note the build a run parked under, read the step it stopped on, list the parked runs a machine may
 * try again, and put one back on that step. The reset and the job that drives it commit together; every write goes through a database function.
 */
export class AgentRunParkStoreService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly queue: AgentStepQueue,
    ) {}

    /** The first failed step of a run, or null when none failed. */
    async failedStepOf(runId: string): Promise<RunStepView | null> {
        const step = await this.entityManager.findOne(AgentRunStepEntity, {
            where: { runId, status: "failed" },
            order: { seq: "ASC" },
        })
        return step === null ? null : stepViewOf(step)
    }

    /** Records the build a run parked under; false when the run is not parked. */
    async markParked(runId: string, build: string): Promise<boolean> {
        const [row] = await callDbFunction<FunctionRow>(this.entityManager, "public.agent_run_park_mark", [
            runId,
            build,
        ])
        return row?.agent_run_park_mark === true
    }

    /**
     * Puts a parked run back on its failed step and writes the job that drives it, in one transaction: the job exists exactly when the reset
     * does. `input` replaces the failed step's input when a handler re-read it; `auto` bounds the tries of the machine by `max`.
     */
    resumeRun(request: ResumeWrite): Promise<ResumeAnswer> {
        return this.entityManager.transaction(async (tx) => {
            const [row] = await callDbFunction<FunctionRow>(tx, "public.agent_run_resume", [
                request.runId,
                request.actor,
                request.reason,
                request.input === undefined ? null : JSON.stringify(request.input),
                request.auto,
                request.max,
                request.backoffSeconds,
            ])
            const answer = parseResume(row?.agent_run_resume)
            if (answer === null) throw rejected()
            if (answer.kind === "resumed") {
                await this.queue.enqueueAdvance(
                    { workspaceId: answer.workspaceId, runId: request.runId },
                    answer.stepKey,
                    `resume-${String(answer.at)}`,
                    tx,
                )
            }
            return answer
        })
    }

    /** The parked runs a machine may run again, at most `limit`. */
    async parked(query: ParkedQuery): Promise<ReadonlyArray<ParkedRef>> {
        const rows = await callDbFunction<unknown>(this.entityManager, "public.agent_run_parked", [
            query.limit,
            query.build,
            query.byBuild,
            query.minAgeSeconds,
            query.max,
            query.exclude,
        ])
        const parked = parseParked(rows)
        if (parked === null) throw rejected()
        return parked
    }
}
