import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectOpenclawGateway, threadKeyFor } from "@modules/integrations/openclaw"
import type { GatewayClient } from "@modules/integrations/openclaw"
import { InjectClock } from "@modules/platform/clock"
import { InjectEventBus } from "@modules/platform/event-bus"
import type { EventBus } from "@modules/platform/event-bus"
import type { ClaimedJob } from "@modules/platform/jobs"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { isGenerateWithAgentPayload } from "@modules/queues/agents"
import { AgentSyncService } from "@modules/domain/openclaw-agent-sync"
import { AiGenerationCompletedEvent } from "@modules/events/api"
import type { AiGenerationCompletedPayload } from "@modules/events/api"
import type { GenerationRunStatus, QueuedGeneration, TurnAttempt } from "./ai-generations.contracts"
import { InjectUsage } from "./ai-generations.decorators"
import { AiGenerationsLogEvent } from "./ai-generations.log-events"
import type { UsageGate } from "./ai-generations.port"
import {
    composeTurn,
    failureTextOf,
    isTimeoutCause,
    isWaiting,
    queuedOf,
    turnTimeoutOf,
    untilAborted,
} from "./generation.policy"
import { AiGenerationEntity } from "./persistence/entities"

/** The generations that still wait for a text, so a cancel, a failure or a finish may change them. */
const OPEN_STATUSES = ["queued", "running"] as const

/** What a finished generation answers for the meter. */
interface Metering {
    /** The usage kind. */
    readonly usage_kind: string
    /** The usage module. */
    readonly module: string
}

/** The first row an UPDATE that returns the usage kind and module answered, or nothing when no row changed. */
const meteringOf = (raw: unknown): Metering | undefined => {
    const row: unknown = Array.isArray(raw) ? raw[0] : undefined
    if (typeof row !== "object" || row === null) return undefined
    const usage_kind: unknown = Reflect.get(row, "usage_kind")
    const module: unknown = Reflect.get(row, "module")
    return typeof usage_kind === "string" && typeof module === "string" ? { usage_kind, module } : undefined
}

const NOT_CONFIGURED = "openclaw_not_configured"
const EMPTY_ANSWER = "empty answer"
const TIMEOUT = "timeout"

@Injectable()
/**
 * Runs one queued generation: the prompt the app wrote goes once into a one-shot session of the workspace's internal "nivo" agent
 * (no history, nothing carried between requests) and the text lands on the `ai_generations` row the caller is looking at. It never
 * retries: the caller waits a bounded time and gives up on its own, so any failure is written on the row as the answer. A row the
 * caller already cancelled is left alone, and only text that was delivered is metered. The end of a generation is published as
 * `ai_generation_completed` in the transaction that writes it, so the capability that asked (content, video) applies the result
 * from the bus, retried until it holds, and a crash between the two loses nothing.
 */
export class GenerationRunnerService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        @InjectUsage() private readonly usage: UsageGate,
        @InjectOpenclawGateway() private readonly gateway: GatewayClient,
        private readonly sync: AgentSyncService,
        @InjectEventBus() private readonly bus: EventBus,
    ) {}

    /** Runs the generation the job names; the run publishes its end to the bus itself. */
    async runJob(job: ClaimedJob): Promise<void> {
        await this.run(job.payload)
    }

    /** Runs the generation the job names; the row's own workspace is the tenant, whatever else the payload says. */
    async run(payload: object): Promise<GenerationRunStatus> {
        if (!isGenerateWithAgentPayload(payload)) return "dropped"
        const row = await this.entityManager.findOne(AiGenerationEntity, {
            where: { id: payload.generationId, workspaceId: payload.workspaceId },
            select: {
                id: true,
                workspaceId: true,
                purpose: true,
                module: true,
                usageKind: true,
                status: true,
                input: true,
            },
        })
        if (row === null) return "dropped"
        const generation = queuedOf(row)
        if (!isWaiting(generation.status)) return "dropped"
        await this.entityManager.update(
            AiGenerationEntity,
            { id: generation.id, workspaceId: generation.workspaceId, status: "queued" },
            { status: "running" },
        )
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
        const row = await this.entityManager.transaction(async (tx) => {
            const result = await tx
                .createQueryBuilder(AiGenerationEntity, "g")
                .update()
                .set({
                    status: "done",
                    output: { text },
                    usage: attempt.usage === null ? null : { ...attempt.usage },
                    timings: this.timingsOf(attempt, startedAt),
                    finishedAt: this.clock.now(),
                })
                .where({ id: generation.id, workspaceId: generation.workspaceId, status: In(OPEN_STATUSES) })
                .returning("usage_kind, module")
                .execute()
            const written = meteringOf(result.raw)
            if (written !== undefined) await this.announce(tx, generation, "done")
            return written
        })
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
        await this.entityManager.transaction(async (tx) => {
            if (attempt.timedOut) {
                await tx.update(
                    AiGenerationEntity,
                    { id: generation.id, workspaceId: generation.workspaceId, status: In(OPEN_STATUSES) },
                    { status: "cancelled", error: "timeout", finishedAt: this.clock.now() },
                )
            } else {
                await tx.update(
                    AiGenerationEntity,
                    { id: generation.id, workspaceId: generation.workspaceId, status: In(OPEN_STATUSES) },
                    {
                        status: "error",
                        error: attempt.reason,
                        timings: this.timingsOf(attempt, startedAt),
                        finishedAt: this.clock.now(),
                    },
                )
            }
            await this.announce(tx, generation, attempt.timedOut ? "cancelled" : "error")
        })
        return "error"
    }

    /** Publishes the end of the generation in the transaction that wrote it; consumers read the row, so the status is a hint. */
    private async announce(
        tx: EntityManager,
        generation: QueuedGeneration,
        status: AiGenerationCompletedPayload["status"],
    ): Promise<void> {
        const event = AiGenerationCompletedEvent.create({
            generationId: generation.id,
            workspaceId: generation.workspaceId,
            purpose: generation.purpose,
            status,
        })
        await this.bus.publish(event, tx, event.eventId)
    }

    private timingsOf(attempt: TurnAttempt, startedAt: number): Readonly<Record<string, number>> {
        return { ...attempt.timings, total_ms: this.clock.now().getTime() - startedAt }
    }
}
