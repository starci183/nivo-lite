import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectOpenclawGateway, threadKeyFor } from "@modules/integrations/openclaw"
import type { GatewayClient } from "@modules/integrations/openclaw"
import { InjectClock } from "@modules/platform/clock"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { isGenerateWithAgentPayload } from "@modules/queues/agents"
import { AgentSyncService } from "@modules/domain/openclaw-agent-sync"
import type { GenerationRunStatus, QueuedGeneration, TurnAttempt } from "./ai-generations.contracts"
import { InjectGenerationCompletion, InjectUsage } from "./ai-generations.decorators"
import { AiGenerationsLogEvent } from "./ai-generations.log-events"
import type { GenerationCompletion, UsageGate } from "./ai-generations.port"
import { AiGenerationsError, AiGenerationsErrorCode } from "./errors/ai-generations.error"
import {
    composeTurn,
    failureTextOf,
    isTimeoutCause,
    isWaiting,
    queuedOf,
    turnTimeoutOf,
    untilAborted,
} from "./generation.policy"
import type { FinishedGenerationRow, GenerationRow } from "./persistence/ai-generations.rows"
import {
    CANCEL_GENERATION,
    FAIL_GENERATION,
    FIND_GENERATION,
    FINISH_GENERATION,
    START_GENERATION,
} from "./persistence/ai-generations.sql"

const NOT_CONFIGURED = "openclaw_not_configured"
const EMPTY_ANSWER = "empty answer"
const TIMEOUT = "timeout"

@Injectable()
/**
 * Runs one queued generation: the prompt the app wrote goes once into a one-shot session of the workspace's internal "nivo" agent
 * (no history, nothing carried between requests) and the text lands on the `ai_generations` row the caller is looking at. It never
 * retries: the caller waits a bounded time and gives up on its own, so any failure is written on the row as the answer. A row the
 * caller already cancelled is left alone, and only text that was delivered is metered.
 */
export class GenerationRunnerService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        @InjectUsage() private readonly usage: UsageGate,
        @InjectOpenclawGateway() private readonly gateway: GatewayClient,
        private readonly sync: AgentSyncService,
        @Optional() @InjectJobClaims() private readonly claims?: JobClaims,
        @Optional() @InjectGenerationCompletion() private readonly completion?: GenerationCompletion,
    ) {}

    /** Runs a generation and fences its application effects before the job is acknowledged. */
    async runJob(job: ClaimedJob): Promise<void> {
        await this.run(job.payload)
        if (!isGenerateWithAgentPayload(job.payload)) return
        if (this.claims === undefined)
            throw new AiGenerationsError({
                code: AiGenerationsErrorCode.GenerationFailed,
                params: { reason: "job_claims", message: "" },
            })
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "apply-result" })
        await this.completion?.completeGeneration(job.payload.workspaceId, job.payload.generationId)
    }

    /** Runs the generation the job names; the row's own workspace is the tenant, whatever else the payload says. */
    async run(payload: object): Promise<GenerationRunStatus> {
        if (!isGenerateWithAgentPayload(payload)) return "dropped"
        const [row] = await this.entityManager.query<Array<GenerationRow>>(FIND_GENERATION, [
            payload.generationId,
            payload.workspaceId,
        ])
        if (row === undefined) return "dropped"
        const generation = queuedOf(row)
        if (!isWaiting(generation.status)) return "dropped"
        await this.entityManager.query(START_GENERATION, [generation.id, generation.workspaceId])
        const startedAt = this.clock.now().getTime()
        const attempt = await this.attempt(generation, startedAt)
        return attempt.text === null
            ? this.fail(generation, attempt, startedAt)
            : this.finish(generation, attempt, attempt.text, startedAt)
    }

    private async attempt(generation: QueuedGeneration, startedAt: number): Promise<TurnAttempt> {
        if (!this.gateway.enabled)
            return { text: null, usage: null, timings: {}, reason: NOT_CONFIGURED, timedOut: false }
        // One deadline for the whole call: the agent set-up counts against it as much as the turn does.
        const signal = AbortSignal.timeout(generation.input.timeoutMs)
        try {
            const agentId = await untilAborted(this.sync.ensureInternalAgent(generation.workspaceId), signal)
            const readyMs = this.clock.now().getTime() - startedAt
            const turn = await this.gateway.runTurn(
                {
                    agentId,
                    threadKey: threadKeyFor(agentId, `explicit:model-run-${generation.id}`),
                    message: composeTurn(generation.input),
                    idempotencyKey: `gen-${generation.id}`,
                    timeoutMs: turnTimeoutOf(Math.max(0, generation.input.timeoutMs - readyMs)),
                },
                signal,
            )
            const blank = turn.text.trim() === ""
            return {
                text: blank ? null : turn.text,
                usage: turn.usage,
                timings: { ...turn.timings, ready_ms: readyMs },
                reason: blank ? EMPTY_ANSWER : "",
                timedOut: false,
            }
        } catch (cause) {
            this.logger.error(AiGenerationsLogEvent.GenerationFailed, cause, { purpose: generation.purpose })
            const timedOut = signal.aborted || isTimeoutCause(cause)
            return {
                text: null,
                usage: null,
                timings: {},
                reason: timedOut ? TIMEOUT : failureTextOf(cause),
                timedOut,
            }
        }
    }

    private async finish(
        generation: QueuedGeneration,
        attempt: TurnAttempt,
        text: string,
        startedAt: number,
    ): Promise<GenerationRunStatus> {
        const finished = await this.entityManager.query<Array<FinishedGenerationRow>>(FINISH_GENERATION, [
            generation.id,
            generation.workspaceId,
            JSON.stringify({ text }),
            attempt.usage === null ? null : JSON.stringify(attempt.usage),
            JSON.stringify(this.timingsOf(attempt, startedAt)),
            this.clock.now().toISOString(),
        ])
        const [row] = finished
        if (row === undefined) return "dropped"
        await this.usage.record({
            workspaceId: generation.workspaceId,
            kind: row.usage_kind,
            module: row.module,
            usage: attempt.usage,
            completionChars: text.length,
        })
        return "done"
    }

    private async fail(
        generation: QueuedGeneration,
        attempt: TurnAttempt,
        startedAt: number,
    ): Promise<GenerationRunStatus> {
        // A deadline that passed is a cancelled request with the reason `timeout`, as it is when the caller gives up first.
        if (attempt.timedOut) {
            await this.entityManager.query(CANCEL_GENERATION, [
                generation.id,
                generation.workspaceId,
                this.clock.now().toISOString(),
            ])
            return "error"
        }
        await this.entityManager.query(FAIL_GENERATION, [
            generation.id,
            generation.workspaceId,
            attempt.reason,
            JSON.stringify(this.timingsOf(attempt, startedAt)),
            this.clock.now().toISOString(),
        ])
        return "error"
    }

    private timingsOf(attempt: TurnAttempt, startedAt: number): Readonly<Record<string, number>> {
        return { ...attempt.timings, total_ms: this.clock.now().getTime() - startedAt }
    }
}
