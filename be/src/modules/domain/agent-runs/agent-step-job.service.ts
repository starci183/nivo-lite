import { Injectable } from "@nestjs/common"
import { isAgentStepPayload } from "@modules/queues/agent-step"
import { AgentRunsService } from "./agent-runs.service"
import { AgentRunsError, AgentRunsErrorCode } from "./errors/agent-runs.error"

/** The shortest pause a queue accepts as a retry hint, seconds. */
const RETRY_MIN_SECONDS = 1

/** The longest pause a queue accepts as a retry hint, seconds. */
const RETRY_MAX_SECONDS = 3600

@Injectable()
/**
 * The door of the agent-step job into the engine: the job names one run, and the run is driven until it waits or ends. A job that finds a
 * live claim or a done step does nothing, so a redelivered job is harmless; a step held by its backoff defers the job to the end of the
 * backoff (a typed hand-back the queue honors as a deferral, no failure and no spent attempt), so the wait is never logged as an error.
 */
export class AgentStepJobService {
    constructor(private readonly runs: AgentRunsService) {}

    /** Drives the run a job names; a payload that names none ends the job with no retry. */
    async run(job: object): Promise<void> {
        if (!isAgentStepPayload(job)) {
            throw new AgentRunsError({ code: AgentRunsErrorCode.JobPayloadInvalid, params: { unrecoverable: 1 } })
        }
        const { retryAfterMs } = await this.runs.advance(job.runId, new AbortController().signal)
        if (retryAfterMs === null) return
        const seconds = Math.min(RETRY_MAX_SECONDS, Math.max(RETRY_MIN_SECONDS, Math.ceil(retryAfterMs / 1000)))
        throw new AgentRunsError({ code: AgentRunsErrorCode.StepDeferred, params: { deferSeconds: seconds } })
    }
}
