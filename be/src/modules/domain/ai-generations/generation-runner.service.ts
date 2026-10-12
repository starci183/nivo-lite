import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectOpenclawGateway, threadKeyFor } from "@modules/integrations/openclaw"
import type { GatewayClient } from "@modules/integrations/openclaw"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { GenerateWithAgentPayload } from "@modules/queues/agents"
import { AgentSyncService } from "@modules/domain/openclaw-agent-sync"
import type { GenerationRunStatus, QueuedGeneration, TurnAttempt } from "./ai-generations.contracts"
import { InjectUsage } from "./ai-generations.decorators"
import { AiGenerationsLogEvent } from "./ai-generations.log-events"
import type { UsageGate } from "./ai-generations.port"
import { composeTurn, failureTextOf, isWaiting, queuedOf, turnTimeoutOf } from "./generation.policy"
import type { FinishedGenerationRow, GenerationRow } from "./persistence/ai-generations.rows"
import { FAIL_GENERATION, FIND_GENERATION, FINISH_GENERATION, START_GENERATION } from "./persistence/ai-generations.sql"

const NOT_CONFIGURED = "openclaw_not_configured"
const EMPTY_ANSWER = "empty answer"

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
    ) {}

    /** Runs the generation the job names; the row's own workspace is the tenant, whatever else the payload says. */
    async run(payload: GenerateWithAgentPayload): Promise<GenerationRunStatus> {
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
        if (!this.gateway.enabled) return { text: null, usage: null, timings: {}, reason: NOT_CONFIGURED }
        try {
            const agentId = await this.sync.ensureInternalAgent(generation.workspaceId)
            const readyMs = this.clock.now().getTime() - startedAt
            const turn = await this.gateway.runTurn(
                {
                    agentId,
                    threadKey: threadKeyFor(agentId, `explicit:model-run-${generation.id}`),
                    message: composeTurn(generation.input),
                    idempotencyKey: `gen-${generation.id}`,
                    timeoutMs: turnTimeoutOf(generation.input.timeoutMs),
                },
                AbortSignal.timeout(generation.input.timeoutMs),
            )
            const blank = turn.text.trim() === ""
            return {
                text: blank ? null : turn.text,
                usage: turn.usage,
                timings: { ...turn.timings, ready_ms: readyMs },
                reason: blank ? EMPTY_ANSWER : "",
            }
        } catch (cause) {
            this.logger.error(AiGenerationsLogEvent.GenerationFailed, cause, { purpose: generation.purpose })
            return { text: null, usage: null, timings: {}, reason: failureTextOf(cause) }
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
